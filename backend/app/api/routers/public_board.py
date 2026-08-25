import json
import uuid

from fastapi import APIRouter, Form, HTTPException, UploadFile, File, status
from sqlalchemy import func

from app.core.database import raw_session, set_rls_context
from app.models.candidate import Candidate, CandidateDocument, ParseStatus
from app.models.document import Document
from app.models.job import Job, JobStatus
from app.models.job_application import JobApplication, JobScreeningQuestion
from app.models.pipeline import JobStage
from app.models.placement import PipelinePlacement, PlacementStatus
from app.models.tenant import Tenant, TenantType
from app.models.user import User, UserRole, UserStatus
from app.schemas.public_board import (
    ApplyResponse,
    PublicBoardResponse,
    PublicJobDetail,
    PublicJobSummary,
    PublicScreeningQuestionOut,
)
from app.services import storage
from app.services.cv_parser import UnsupportedFileType, extract_text, parse_cv_text
from app.services.dedup import compute_fingerprint

router = APIRouter(prefix="/public", tags=["public"])


def _attribution_user_id(db, job: Job) -> uuid.UUID:
    """uploaded_by/moved_by are FKs to users — there is no user for a
    public applicant, so attribute the resulting rows to the job's owner
    (falling back to any active user in the tenant if the job is
    unassigned). Not a perfect fit semantically, but the alternative —
    making these columns nullable — would weaken "who did this" for every
    *other* (recruiter-initiated) row too, for the sake of the one public
    code path. See docs/10.
    """
    if job.owner_recruiter_id is not None:
        return job.owner_recruiter_id
    fallback = (
        db.query(User)
        .filter(User.tenant_id == job.tenant_id, User.status == UserStatus.active, User.role != UserRole.superadmin)
        .first()
    )
    if fallback is None:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No recruiter available to attribute this application to")
    return fallback.id


def _applicant_count(db, job_id: uuid.UUID) -> int:
    return db.query(func.count(JobApplication.id)).filter(JobApplication.job_id == job_id).scalar() or 0


def _board_response(db, tenant: Tenant) -> PublicBoardResponse:
    jobs = (
        db.query(Job)
        .filter(Job.tenant_id == tenant.id, Job.status == JobStatus.open, Job.deleted_at.is_(None))
        .order_by(Job.created_at.desc())
        .all()
    )
    # Unlisted jobs never appear in the board listing — docs/10.
    from app.models.job import JobVisibility

    jobs = [j for j in jobs if j.visibility == JobVisibility.public]
    return PublicBoardResponse(
        org_name=tenant.name,
        jobs=[
            PublicJobSummary(id=j.id, title=j.title, overview=j.overview, applicant_count=_applicant_count(db, j.id))
            for j in jobs
        ],
    )


@router.get("/boards/freelance", response_model=PublicBoardResponse)
def freelance_board() -> PublicBoardResponse:
    with raw_session() as db:
        tenant = db.query(Tenant).filter(Tenant.type == TenantType.freelance_org).first()
        if tenant is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Freelance board not available")
        # tenants isn't RLS-protected, so no context was needed for that
        # lookup — set it now, scoped to this tenant, before touching jobs.
        set_rls_context(db, tenant_id=str(tenant.id), role="recruiter")
        return _board_response(db, tenant)


@router.get("/boards/{slug}", response_model=PublicBoardResponse)
def org_board(slug: str) -> PublicBoardResponse:
    with raw_session() as db:
        tenant = db.query(Tenant).filter(Tenant.slug == slug, Tenant.type == TenantType.org).first()
        if tenant is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found")
        set_rls_context(db, tenant_id=str(tenant.id), role="recruiter")
        return _board_response(db, tenant)


@router.get("/jobs/{job_id}", response_model=PublicJobDetail)
def public_job_detail(job_id: uuid.UUID) -> PublicJobDetail:
    with raw_session() as db:
        # Deliberately no set_rls_context call before this lookup — the
        # public_open_jobs policy (migration 0008) grants SELECT on
        # status='open' rows regardless of session context, and calling
        # set_rls_context first would set app.tenant_id to '' , which the
        # OTHER (tenant_isolation) policy's ''::uuid cast hard-errors on —
        # Postgres evaluates every permissive policy's USING clause even
        # once one already matched. See migration 0008's docstring.
        job = db.query(Job).filter(Job.id == job_id, Job.status == JobStatus.open, Job.deleted_at.is_(None)).first()
        if job is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Job not found")
        # Now that we know the real tenant_id, re-scope properly for the
        # rest of this request's queries (screening questions, etc.).
        set_rls_context(db, tenant_id=str(job.tenant_id), role="recruiter")

        questions = (
            db.query(JobScreeningQuestion)
            .filter(JobScreeningQuestion.job_id == job_id)
            .order_by(JobScreeningQuestion.position)
            .all()
        )
        return PublicJobDetail(
            id=job.id,
            title=job.title,
            overview=job.overview,
            description=job.description,
            is_technical_role=job.is_technical_role,
            applicant_count=_applicant_count(db, job.id),
            screening_questions=[
                PublicScreeningQuestionOut(id=q.id, question_text=q.question_text, position=q.position)
                for q in questions
            ],
        )


@router.post("/jobs/{job_id}/apply", response_model=ApplyResponse, status_code=201)
async def apply_to_job(
    job_id: uuid.UUID,
    full_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    cover_letter: str | None = Form(None),
    years_of_experience: str = Form(...),
    linkedin_url: str = Form(...),
    github_url: str | None = Form(None),
    portfolio_url: str | None = Form(None),
    open_to_other_roles: bool = Form(False),
    answers_json: str = Form("[]"),  # [{"question_id": "...", "answer": "..."}]
    cv: UploadFile = File(...),
) -> ApplyResponse:
    with raw_session() as db:
        # No set_rls_context call before this lookup — see the comment in
        # public_job_detail above / migration 0008's docstring for why.
        job = db.query(Job).filter(Job.id == job_id, Job.status == JobStatus.open, Job.deleted_at.is_(None)).first()
        if job is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="This job isn't accepting applications")

        # Computed before set_rls_context (users isn't RLS-protected, so
        # this is safe pre-context) because the candidate this application
        # creates/updates needs owner_user_id — and, for a Freelance Org
        # job, app.user_id itself — set to the SAME attributed recruiter,
        # or the freelance-candidate-privacy policy (migration 0012)
        # rejects the write. See docs/02.
        attributed_user_id = _attribution_user_id(db, job)

        # Every write from here on happens inside this job's own tenant's
        # RLS scope — a public applicant is, functionally, acting as a
        # "recruiter" of their own application within that one tenant.
        set_rls_context(db, tenant_id=str(job.tenant_id), role="recruiter", user_id=str(attributed_user_id))

        try:
            answers_raw = json.loads(answers_json)
        except json.JSONDecodeError:
            answers_raw = []

        # --- CV parse (no preview step for a public applicant — one
        # clear submit action, see docs/10) ---
        filename = cv.filename or "cv"
        ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        content = await cv.read()
        temp_id, temp_path = storage.save_temp(content, filename)
        parsed_fields, parse_confidence = {}, {}
        try:
            text = extract_text(temp_path)
            parsed_fields, parse_confidence, _status = parse_cv_text(text)
        except (UnsupportedFileType, Exception):
            pass  # never block a public application on a parse failure

        checksum = storage.sha256_of_file(temp_path)
        mime_type = "application/pdf" if ext == ".pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        storage_key = storage.promote_temp_to_permanent(temp_path, str(job.tenant_id))

        document = Document(
            tenant_id=job.tenant_id, storage_key=storage_key, mime_type=mime_type,
            original_filename=filename, checksum_sha256=checksum,
        )
        db.add(document)
        db.flush()

        # --- dedup: reuse an existing candidate in this tenant if the
        # fingerprint matches (same email+phone+name), same rule as
        # recruiter-side CV upload (docs/04) ---
        fingerprint = compute_fingerprint(full_name=full_name, email=email, phone=phone)
        candidate = (
            db.query(Candidate)
            .filter(Candidate.tenant_id == job.tenant_id, Candidate.dedup_fingerprint == fingerprint)
            .first()
        )
        if candidate is None:
            candidate = Candidate(
                tenant_id=job.tenant_id,
                owner_user_id=attributed_user_id,
                full_name=full_name,
                dedup_fingerprint=fingerprint,
            )
            db.add(candidate)

        candidate.email = email
        candidate.phone = phone
        candidate.source = "job_board"
        candidate.total_years_experience = years_of_experience  # self-reported overrides CV-parse guess
        candidate.linkedin_url = linkedin_url
        candidate.github_url = github_url
        candidate.portfolio_url = portfolio_url
        candidate.open_to_other_roles = open_to_other_roles
        if parsed_fields.get("position"):
            candidate.current_position = parsed_fields["position"]
        db.flush()

        next_version = (
            db.query(func.coalesce(func.max(CandidateDocument.version_no), 0))
            .filter(CandidateDocument.candidate_id == candidate.id, CandidateDocument.job_id == job.id)
            .scalar()
            + 1
        )
        db.query(CandidateDocument).filter(
            CandidateDocument.candidate_id == candidate.id, CandidateDocument.job_id == job.id
        ).update({CandidateDocument.is_current: False})
        db.add(
            CandidateDocument(
                tenant_id=job.tenant_id, candidate_id=candidate.id, job_id=job.id, file_id=document.id,
                version_no=next_version, is_current=True, parsed_fields=parsed_fields,
                parse_confidence=parse_confidence, parse_status=ParseStatus.needs_review,
                uploaded_by=attributed_user_id,
            )
        )

        # --- eligibility against the job's custom screening questions ---
        questions = db.query(JobScreeningQuestion).filter(JobScreeningQuestion.job_id == job_id).all()
        answers_by_qid = {a.get("question_id"): a.get("answer", "") for a in answers_raw}
        answer_records = []
        eligible = True
        for q in questions:
            given = (answers_by_qid.get(str(q.id)) or "").strip().lower()
            expected = q.expected_answer.strip().lower()
            matched = given == expected
            if not matched:
                eligible = False
            answer_records.append(
                {
                    "question_id": str(q.id),
                    "question_text": q.question_text,
                    "expected_answer": q.expected_answer,
                    "answer": answers_by_qid.get(str(q.id), ""),
                    "matched": matched,
                }
            )

        application = JobApplication(
            tenant_id=job.tenant_id, job_id=job.id, candidate_id=candidate.id,
            cover_letter=cover_letter, answers=answer_records, eligible=eligible,
        )
        db.add(application)
        db.flush()

        if eligible:
            placement = _ensure_placement(db, job, candidate, attributed_user_id)
            application.placement_id = placement.id

        return ApplyResponse(
            eligible=eligible,
            message="Application received!" if eligible else "Application received — thanks for applying.",
        )


def _ensure_placement(db, job: Job, candidate: Candidate, attributed_user_id: uuid.UUID) -> PipelinePlacement:
    existing = (
        db.query(PipelinePlacement)
        .filter(PipelinePlacement.candidate_id == candidate.id, PipelinePlacement.job_id == job.id)
        .first()
    )
    if existing is not None:
        return existing
    first_stage = db.query(JobStage).filter(JobStage.job_id == job.id).order_by(JobStage.position).first()
    placement = PipelinePlacement(
        tenant_id=job.tenant_id, candidate_id=candidate.id, job_id=job.id,
        current_stage_id=first_stage.id, status=PlacementStatus.active, moved_by=attributed_user_id,
    )
    db.add(placement)
    db.flush()
    return placement
