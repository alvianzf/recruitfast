import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user, get_db
from app.models.candidate import Candidate
from app.models.import_batch import CandidateImportBatch, ImportBatchStatus
from app.schemas.bulk_import import (
    ImportCommitRequest,
    ImportCommitResponse,
    ImportPossibleDuplicate,
    ImportPreviewResponse,
    ImportRowPreview,
)
from app.services import bulk_import, storage
from app.services.dedup import compute_fingerprint

router = APIRouter(prefix="/candidates/import", tags=["candidates"])


@router.get("/template.csv")
def download_template_csv() -> Response:
    content = bulk_import.generate_template_csv()
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=recruitfast_candidates_template.csv"},
    )


@router.get("/template.xlsx")
def download_template_xlsx() -> Response:
    content = bulk_import.generate_template_xlsx()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=recruitfast_candidates_template.xlsx"},
    )


@router.post("/preview", response_model=ImportPreviewResponse)
async def preview_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ImportPreviewResponse:
    filename = file.filename or "upload"
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in (".csv", ".xlsx"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Only .csv and .xlsx are supported")

    content = await file.read()
    temp_id, temp_path = storage.save_temp(content, filename)

    try:
        raw_rows = bulk_import.parse_uploaded_file(temp_path, filename)
    except bulk_import.RowLimitExceeded as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Could not read this file: {exc}") from exc

    rows: list[ImportRowPreview] = []
    valid_count = warning_count = error_count = 0

    for i, raw in enumerate(raw_rows):
        row_status, messages = bulk_import.validate_row(raw)
        possible_duplicate = None
        if row_status != "error" and (raw.get("email") or raw.get("phone")):
            fingerprint = compute_fingerprint(
                full_name=raw.get("full_name"), email=raw.get("email"), phone=raw.get("phone")
            )
            existing = (
                db.query(Candidate)
                .filter(Candidate.tenant_id == current_user.tenant_id, Candidate.dedup_fingerprint == fingerprint)
                .first()
            )
            if existing:
                possible_duplicate = ImportPossibleDuplicate(candidate_id=existing.id, full_name=existing.full_name)
                if row_status == "valid":
                    row_status = "warning"
                messages.append("Possible duplicate of an existing candidate")

        if row_status == "valid":
            valid_count += 1
        elif row_status == "warning":
            warning_count += 1
        else:
            error_count += 1

        rows.append(
            ImportRowPreview(
                row_index=i,
                full_name=raw.get("full_name", ""),
                email=raw.get("email") or None,
                phone=raw.get("phone") or None,
                source=raw.get("source") or None,
                linkedin_url=raw.get("linkedin_url") or None,
                notes=raw.get("notes") or None,
                status=row_status,
                messages=messages,
                possible_duplicate=possible_duplicate,
            )
        )

    return ImportPreviewResponse(
        temp_id=temp_id,
        filename=filename,
        rows=rows,
        valid_count=valid_count,
        warning_count=warning_count,
        error_count=error_count,
    )


@router.post("/commit", response_model=ImportCommitResponse)
def commit_import(
    payload: ImportCommitRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ImportCommitResponse:
    temp_path = storage.temp_path_for(payload.temp_id, payload.filename)
    # The file itself isn't needed again (rows already carry everything),
    # but clean it up now that the import is being finalized.
    storage.cleanup_temp(temp_path)

    created_count = 0
    skipped_count = 0

    batch = CandidateImportBatch(
        tenant_id=uuid.UUID(current_user.tenant_id),
        uploaded_by=uuid.UUID(current_user.user_id),
        original_filename=payload.filename,
        total_rows=len(payload.rows),
        status=ImportBatchStatus.processing,
    )
    db.add(batch)
    db.flush()

    for row in payload.rows:
        if row.resolution == "skip" or not row.full_name.strip():
            skipped_count += 1
            continue

        fingerprint = compute_fingerprint(full_name=row.full_name, email=row.email, phone=row.phone)
        candidate = Candidate(
            tenant_id=uuid.UUID(current_user.tenant_id),
            owner_user_id=uuid.UUID(current_user.user_id),
            full_name=row.full_name,
            email=row.email,
            phone=row.phone,
            source=row.source or "csv_import",
            linkedin_url=row.linkedin_url,
            dedup_fingerprint=fingerprint,
        )
        db.add(candidate)
        created_count += 1

        if row.notes:
            from app.models.note import Note, NoteVisibility

            db.flush()
            db.add(
                Note(
                    tenant_id=uuid.UUID(current_user.tenant_id),
                    candidate_id=candidate.id,
                    author_id=uuid.UUID(current_user.user_id),
                    body=row.notes,
                    visibility=NoteVisibility.team,
                )
            )

    batch.created_count = created_count
    batch.skipped_count = skipped_count
    batch.status = ImportBatchStatus.completed

    return ImportCommitResponse(batch_id=batch.id, created_count=created_count, skipped_count=skipped_count)
