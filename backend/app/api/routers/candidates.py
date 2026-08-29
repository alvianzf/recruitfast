import asyncio
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user, get_db
from app.core.limiter import limiter
from app.models.candidate import Candidate, CandidateDocument, ParseStatus
from app.models.document import Document
from app.models.job import Job
from app.models.pipeline import JobStage
from app.models.placement import PipelinePlacement
from app.schemas.candidate import (
    CandidateDetailOut,
    CandidateOut,
    CandidateSearchRequest,
    CandidateSearchResult,
    CandidateUpdate,
    CurrentDocumentOut,
    CVCommitRequest,
    CVCommitResponse,
    CVPreviewItem,
    CVPreviewResponse,
    MatchedSkillOut,
    PlacementSummary,
    PossibleDuplicate,
    SkillFilterIn,
)
from app.schemas.screening import OpenProfileCandidate
from app.services import storage
from app.services.cv_parser import MAX_FILE_SIZE_BYTES, SUPPORTED_EXTENSIONS, UnsupportedFileType, extract_text, parse_cv_text
from app.services.dedup import compute_fingerprint

router = APIRouter(prefix="/candidates", tags=["candidates"])


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


def _findable_candidates(db: Session, tenant_id: uuid.UUID) -> list[Candidate]:
    # The pool "Find Candidates" searches: this tenant's own candidates,
    # plus every open-profile candidate platform-wide (same cross-tenant
    # RLS exception as /open-profiles above) — reusing candidates already
    # in the system for a different job, not just this tenant's own.
    return (
        db.query(Candidate)
        .filter(
            Candidate.deleted_at.is_(None),
            (Candidate.tenant_id == tenant_id) | (Candidate.open_to_other_roles.is_(True)),
        )
        .all()
    )


def _current_skill_entries_by_candidate(db: Session, candidate_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[dict]]:
    if not candidate_ids:
        return {}
    docs = (
        db.query(CandidateDocument)
        .filter(CandidateDocument.candidate_id.in_(candidate_ids), CandidateDocument.is_current.is_(True))
        .all()
    )
    # technical_skills is {category: [{name, years_of_experience, last_used}]}
    # from CV parsing (app/services/cv_parser.py, llm_cv_parser.py) — flatten
    # across categories since search matches on skill name, not category.
    by_candidate: dict[uuid.UUID, list[dict]] = {}
    for doc in docs:
        skills_by_category = (doc.parsed_fields or {}).get("technical_skills") or {}
        flat: list[dict] = []
        for entries in skills_by_category.values():
            if isinstance(entries, list):
                flat.extend(e for e in entries if isinstance(e, dict) and e.get("name"))
        by_candidate[doc.candidate_id] = flat
    return by_candidate


def _skill_filter_match(entries: list[dict], filt: SkillFilterIn) -> dict | None:
    target = filt.name.strip().lower()
    for entry in entries:
        if str(entry.get("name", "")).strip().lower() != target:
            continue
        conditions: list[bool] = []
        if filt.min_years is not None:
            try:
                conditions.append(int(str(entry.get("years_of_experience", "")).strip()) >= filt.min_years)
            except (TypeError, ValueError):
                conditions.append(False)
        if filt.used_since_year is not None:
            try:
                conditions.append(int(str(entry.get("last_used", "")).strip()) >= filt.used_since_year)
            except (TypeError, ValueError):
                conditions.append(False)
        if not conditions:
            return entry  # skill named, no year/recency condition to satisfy
        ok = all(conditions) if filt.condition_match == "all" else any(conditions)
        if ok:
            return entry
    return None


@router.get("/skills", response_model=list[str])
def list_known_skills(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[str]:
    # Powers the skill autocomplete on Find Candidates — same pool as
    # /candidates/search below. Registered above /{candidate_id} for the
    # same reason as /open-profiles (see its comment).
    candidates = _findable_candidates(db, uuid.UUID(current_user.tenant_id))
    skills_by_candidate = _current_skill_entries_by_candidate(db, [c.id for c in candidates])
    names: set[str] = set()
    for entries in skills_by_candidate.values():
        for entry in entries:
            name = str(entry.get("name", "")).strip()
            if name:
                names.add(name)
    return sorted(names, key=str.lower)


@router.post("/search", response_model=list[CandidateSearchResult])
def search_candidates(
    payload: CandidateSearchRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[CandidateSearchResult]:
    if not payload.skills:
        return []

    tenant_id = uuid.UUID(current_user.tenant_id)
    candidates = _findable_candidates(db, tenant_id)
    skills_by_candidate = _current_skill_entries_by_candidate(db, [c.id for c in candidates])

    results: list[CandidateSearchResult] = []
    for candidate in candidates:
        entries = skills_by_candidate.get(candidate.id, [])
        if not entries:
            continue
        matched = [m for f in payload.skills if (m := _skill_filter_match(entries, f)) is not None]
        satisfied = len(matched) == len(payload.skills) if payload.skill_match == "all" else len(matched) > 0
        if not satisfied:
            continue
        results.append(
            CandidateSearchResult(
                id=candidate.id,
                full_name=candidate.full_name,
                current_position=candidate.current_position,
                total_years_experience=candidate.total_years_experience,
                location=candidate.location,
                scope="org" if candidate.tenant_id == tenant_id else "public",
                matched_skills=[
                    MatchedSkillOut(
                        name=str(m.get("name", "")),
                        years_of_experience=m.get("years_of_experience"),
                        last_used=m.get("last_used"),
                    )
                    for m in matched
                ],
            )
        )
    return results


@router.get("/{candidate_id}", response_model=CandidateDetailOut)
def get_candidate(
    candidate_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> CandidateDetailOut:
    # Same-tenant OR open-to-other-roles — Candidate Quick View is opened
    # from Open Profiles too, which lists candidates platform-wide (see
    # docs/10). Mirrors attach_from_open_profile's filter and the RLS
    # exception on `candidates` itself (migration 0001); CV/notes reads
    # below rely on the matching RLS exception added in migration 0031.
    candidate = (
        db.query(Candidate)
        .filter(
            Candidate.id == candidate_id,
            Candidate.deleted_at.is_(None),
            or_(Candidate.tenant_id == current_user.tenant_id, Candidate.open_to_other_roles.is_(True)),
        )
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

    placement_rows = (
        db.query(PipelinePlacement, JobStage, Job)
        .join(JobStage, JobStage.id == PipelinePlacement.current_stage_id)
        .join(Job, Job.id == PipelinePlacement.job_id)
        .filter(PipelinePlacement.candidate_id == candidate_id)
        .order_by(PipelinePlacement.updated_at.desc())
        .all()
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
    detail.placements = [
        PlacementSummary(
            id=placement.id,
            job_id=job.id,
            job_title=job.title,
            stage_name=stage.name,
            status=placement.status.value,
            applied_at=placement.created_at,
            last_moved_at=placement.updated_at,
        )
        for placement, stage, job in placement_rows
    ]
    return detail


@router.patch("/{candidate_id}", response_model=CandidateOut)
def update_candidate(
    candidate_id: uuid.UUID,
    payload: CandidateUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> Candidate:
    candidate = (
        db.query(Candidate)
        .filter(Candidate.id == candidate_id, Candidate.tenant_id == current_user.tenant_id, Candidate.deleted_at.is_(None))
        .first()
    )
    if candidate is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    updates = payload.model_dump(exclude_unset=True)
    if "full_name" in updates and not updates["full_name"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="full_name cannot be blank")
    # Once a candidate has opted in to being visible platform-wide, that's
    # their consent to revoke, not a recruiter's — a recruiter (even the
    # one who owns this record) flipping it back would silently pull the
    # candidate out of every other org's Open Profiles/Find Candidates
    # results without the candidate knowing. Only a superadmin can revert
    # it (e.g. handling a candidate's own request to opt back out).
    if (
        "open_to_other_roles" in updates
        and updates["open_to_other_roles"] is False
        and candidate.open_to_other_roles
        and current_user.role != "superadmin"
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="This candidate opted in to being visible to all recruiters — only a superadmin can revoke it.",
        )
    for field, value in updates.items():
        setattr(candidate, field, value)

    return candidate


@router.delete("/{candidate_id}", status_code=204)
def delete_candidate(
    candidate_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    # Candidate row is soft-deleted (consistent with the SoftDeleteMixin
    # convention used everywhere else — every existing read already
    # filters on deleted_at.is_(None)), but every CV file this candidate
    # ever uploaded is hard-deleted, both on disk and its `documents` /
    # `candidate_documents` rows — a dangling DB row pointing at a file
    # that no longer exists is worse than no row at all, and there's no
    # UI path to view an old version of a deleted candidate anyway.
    candidate = (
        db.query(Candidate)
        .filter(Candidate.id == candidate_id, Candidate.tenant_id == current_user.tenant_id, Candidate.deleted_at.is_(None))
        .first()
    )
    if candidate is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    documents = (
        db.query(Document)
        .join(CandidateDocument, CandidateDocument.file_id == Document.id)
        .filter(CandidateDocument.candidate_id == candidate_id)
        .all()
    )
    for document in documents:
        file_path = storage.STORAGE_ROOT / document.storage_key
        file_path.unlink(missing_ok=True)

    db.query(CandidateDocument).filter(CandidateDocument.candidate_id == candidate_id).delete()
    for document in documents:
        db.delete(document)

    candidate.deleted_at = datetime.now(timezone.utc)


@router.get("/{candidate_id}/cv")
def download_candidate_cv(
    candidate_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> FileResponse:
    # Two-segment path, so this can't collide with GET /{candidate_id}
    # regardless of route registration order — see docs/02's route-
    # ordering gotcha, which only applies to same-depth paths.
    # Same-tenant OR open-to-other-roles — see get_candidate's comment above.
    candidate = (
        db.query(Candidate)
        .filter(
            Candidate.id == candidate_id,
            Candidate.deleted_at.is_(None),
            or_(Candidate.tenant_id == current_user.tenant_id, Candidate.open_to_other_roles.is_(True)),
        )
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
@limiter.limit("20/minute")
async def cv_parse_preview(
    request: Request,
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

        # Bounded read (MAX_FILE_SIZE_BYTES + 1, not the whole file) so an
        # oversized upload can't buffer arbitrarily large amounts of
        # memory just to discover it should be rejected.
        content = await upload.read(MAX_FILE_SIZE_BYTES + 1)
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
            # Same file re-uploaded (by content hash, not filename) reuses
            # the prior parse instead of paying for another LLM call — the
            # checksum is already how commit-time dedup works
            # (documents.checksum_sha256), just checked earlier here.
            checksum = storage.sha256_of_bytes(content)
            reused = (
                db.query(CandidateDocument)
                .join(Document, Document.id == CandidateDocument.file_id)
                .filter(Document.checksum_sha256 == checksum, Document.tenant_id == uuid.UUID(current_user.tenant_id))
                .order_by(CandidateDocument.created_at.desc())
                .first()
            )
            if reused is not None:
                parsed_fields = reused.parsed_fields
                parse_confidence = reused.parse_confidence
                parse_status_value = reused.parse_status.value
            else:
                text = extract_text(temp_path)
                # parse_cv_text may call the LLM tier, a blocking network
                # call that can legitimately take tens of seconds — run it
                # in a worker thread so it doesn't stall the event loop
                # (and every other in-flight request) for the duration.
                parsed_fields, parse_confidence, parse_status_value = await asyncio.to_thread(parse_cv_text, text)
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
                .filter(
                    Candidate.tenant_id == current_user.tenant_id,
                    Candidate.dedup_fingerprint == fingerprint,
                    Candidate.deleted_at.is_(None),
                )
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
            location=item.location,
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
