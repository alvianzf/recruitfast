import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user, get_db
from app.models.candidate import Candidate, CandidateDocument, ParseStatus
from app.models.document import Document
from app.schemas.candidate import (
    CandidateDetailOut,
    CandidateOut,
    CurrentDocumentOut,
    CVCommitRequest,
    CVCommitResponse,
    CVPreviewItem,
    CVPreviewResponse,
    PossibleDuplicate,
)
from app.schemas.screening import OpenProfileCandidate
from app.services import storage
from app.services.cv_parser import SUPPORTED_EXTENSIONS, UnsupportedFileType, extract_text, parse_cv_text
from app.services.dedup import compute_fingerprint

router = APIRouter(prefix="/candidates", tags=["candidates"])

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024


@router.get("", response_model=list[CandidateOut])
def list_candidates(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[Candidate]:
    return (
        db.query(Candidate)
        .filter(Candidate.tenant_id == current_user.tenant_id, Candidate.deleted_at.is_(None))
        .order_by(Candidate.created_at.desc())
        .all()
    )


@router.get("/open-profiles", response_model=list[OpenProfileCandidate])
def open_profiles(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[Candidate]:
    # Deliberately NO tenant_id filter — this is the one endpoint meant to
    # surface the cross-tenant RLS exception on `candidates`
    # (open_to_other_roles = true). Every other candidate query in this
    # codebase adds an explicit tenant_id filter on top of RLS; this one
    # doesn't, on purpose. See docs/10 "Open profiles". Only summary
    # fields are exposed (schema-level, not RLS) — no resume/notes/other
    # pipeline history crosses the tenant boundary.
    #
    # Registered ABOVE /{candidate_id} deliberately — a path-param route
    # registered first would otherwise swallow "open-profiles" as if it
    # were a candidate_id (Starlette matches routes in registration
    # order per method; the UUID type coercion only happens after a
    # route already matched, so a literal segment doesn't "fall through"
    # to try the next route on a type mismatch — it 422s instead).
    return db.query(Candidate).filter(Candidate.open_to_other_roles.is_(True), Candidate.deleted_at.is_(None)).all()


@router.get("/{candidate_id}", response_model=CandidateDetailOut)
def get_candidate(
    candidate_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> CandidateDetailOut:
    candidate = (
        db.query(Candidate)
        .filter(Candidate.id == candidate_id, Candidate.tenant_id == current_user.tenant_id, Candidate.deleted_at.is_(None))
        .first()
    )
    if candidate is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    current_doc = (
        db.query(CandidateDocument, Document)
        .join(Document, Document.id == CandidateDocument.file_id)
        .filter(CandidateDocument.candidate_id == candidate_id, CandidateDocument.is_current.is_(True))
        .order_by(CandidateDocument.version_no.desc())
        .first()
    )

    detail = CandidateDetailOut.model_validate(candidate)
    if current_doc:
        cd, doc = current_doc
        detail.current_document = CurrentDocumentOut(
            original_filename=doc.original_filename,
            parsed_fields=cd.parsed_fields,
            parse_confidence=cd.parse_confidence,
            parse_status=cd.parse_status.value,
        )
    return detail


@router.get("/{candidate_id}/cv")
def download_candidate_cv(
    candidate_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> FileResponse:
    # Two-segment path, so this can't collide with GET /{candidate_id}
    # regardless of route registration order — see docs/02's route-
    # ordering gotcha, which only applies to same-depth paths.
    candidate = (
        db.query(Candidate)
        .filter(Candidate.id == candidate_id, Candidate.tenant_id == current_user.tenant_id, Candidate.deleted_at.is_(None))
        .first()
    )
    if candidate is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    current_doc = (
        db.query(Document)
        .join(CandidateDocument, CandidateDocument.file_id == Document.id)
        .filter(CandidateDocument.candidate_id == candidate_id, CandidateDocument.is_current.is_(True))
        .order_by(CandidateDocument.version_no.desc())
        .first()
    )
    if current_doc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No CV on file for this candidate")

    file_path = storage.STORAGE_ROOT / current_doc.storage_key
    if not file_path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="CV file is missing from storage")

    return FileResponse(file_path, media_type=current_doc.mime_type, filename=current_doc.original_filename)


@router.post("/cv/parse-preview", response_model=CVPreviewResponse)
async def cv_parse_preview(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> CVPreviewResponse:
    """Parses each dropped file and returns a preview — writes nothing.
    See docs/09-candidate-intake.md for the two-phase preview/commit flow.
    """
    items: list[CVPreviewItem] = []

    for upload in files:
        filename = upload.filename or "unknown"
        ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

        content = await upload.read()
        if len(content) > MAX_FILE_SIZE_BYTES:
            items.append(
                CVPreviewItem(temp_id="", filename=filename, parse_status="failed", error="File exceeds 10 MB limit")
            )
            continue
        if ext not in SUPPORTED_EXTENSIONS:
            items.append(
                CVPreviewItem(
                    temp_id="",
                    filename=filename,
                    parse_status="failed",
                    error="Unsupported file type — use PDF or DOCX (.doc isn't supported yet)",
                )
            )
            continue

        temp_id, temp_path = storage.save_temp(content, filename)

        try:
            text = extract_text(temp_path)
            parsed_fields, parse_confidence, parse_status_value = parse_cv_text(text)
        except UnsupportedFileType as exc:
            items.append(CVPreviewItem(temp_id=temp_id, filename=filename, parse_status="failed", error=str(exc)))
            continue
        except Exception:
            items.append(
                CVPreviewItem(
                    temp_id=temp_id,
                    filename=filename,
                    parse_status="failed",
                    error="Could not read this file — add the candidate manually instead.",
                )
            )
            continue

        possible_duplicate = None
        if parsed_fields.get("email") or parsed_fields.get("phone"):
            fingerprint = compute_fingerprint(
                full_name=parsed_fields.get("name"),
                email=parsed_fields.get("email"),
                phone=parsed_fields.get("phone"),
            )
            existing = (
                db.query(Candidate)
                .filter(Candidate.tenant_id == current_user.tenant_id, Candidate.dedup_fingerprint == fingerprint)
                .first()
            )
            if existing:
                possible_duplicate = PossibleDuplicate(
                    candidate_id=existing.id, full_name=existing.full_name, email=existing.email
                )

        items.append(
            CVPreviewItem(
                temp_id=temp_id,
                filename=filename,
                parsed_fields=parsed_fields,
                parse_confidence=parse_confidence,
                parse_status=parse_status_value,
                possible_duplicate=possible_duplicate,
            )
        )

    return CVPreviewResponse(items=items)


@router.post("/cv/commit", response_model=CVCommitResponse)
def cv_commit(
    payload: CVCommitRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> CVCommitResponse:
    created: list[Candidate] = []
    skipped_count = 0

    for item in payload.items:
        if item.resolution == "skip":
            skipped_count += 1
            temp_path = storage.temp_path_for(item.temp_id, item.filename)
            storage.cleanup_temp(temp_path)
            continue

        if not item.full_name:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"{item.filename}: full name is required")

        temp_path = storage.temp_path_for(item.temp_id, item.filename)
        if not temp_path.exists():
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail=f"{item.filename}: upload expired — please re-upload this file",
            )

        checksum = storage.sha256_of_file(temp_path)
        mime_type = "application/pdf" if temp_path.suffix.lower() == ".pdf" else (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        storage_key = storage.promote_temp_to_permanent(temp_path, str(current_user.tenant_id))

        document = Document(
            tenant_id=uuid.UUID(current_user.tenant_id),
            storage_key=storage_key,
            mime_type=mime_type,
            original_filename=item.filename,
            checksum_sha256=checksum,
        )
        db.add(document)
        db.flush()

        fingerprint = compute_fingerprint(full_name=item.full_name, email=item.email, phone=item.phone)
        candidate = Candidate(
            tenant_id=uuid.UUID(current_user.tenant_id),
            owner_user_id=uuid.UUID(current_user.user_id),
            full_name=item.full_name,
            email=item.email,
            phone=item.phone,
            source="cv_upload",
            current_position=item.current_position,
            total_years_experience=item.total_years_experience,
            dedup_fingerprint=fingerprint,
        )
        db.add(candidate)
        db.flush()

        db.add(
            CandidateDocument(
                tenant_id=uuid.UUID(current_user.tenant_id),
                candidate_id=candidate.id,
                job_id=None,
                file_id=document.id,
                version_no=1,
                is_current=True,
                parsed_fields=item.parsed_fields or {},
                parse_confidence=item.parse_confidence or {},
                parse_status=ParseStatus.needs_review,
                uploaded_by=uuid.UUID(current_user.user_id),
            )
        )
        created.append(candidate)

    return CVCommitResponse(created=created, skipped_count=skipped_count)
