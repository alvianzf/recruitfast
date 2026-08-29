import asyncio
import hashlib
import html
import json
import re
import uuid

from fastapi import APIRouter, Form, HTTPException, Request, UploadFile, File, status
from fastapi.responses import HTMLResponse, Response
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.config import settings
from app.core.database import raw_session, set_rls_context
from app.core.limiter import limiter
from app.models.candidate import Candidate, CandidateDocument, ParseStatus
from app.models.document import Document
from app.models.job import Job, JobStatus
from app.models.job_application import JobApplication, JobScreeningQuestion, ScreeningQuestionType
from app.models.job_view import JobView
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
from app.services.cv_parser import MAX_FILE_SIZE_BYTES, SUPPORTED_EXTENSIONS, UnsupportedFileType, extract_text, parse_cv_text
from app.services.dedup import compute_fingerprint

router = APIRouter(prefix="/public", tags=["public"])
# Unprefixed, for the handful of paths a crawler/browser expects to find
# at the domain root by convention (sitemap.xml) rather than under /public.
root_router = APIRouter(tags=["public"])


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


_TRUE_ANSWERS = {"yes", "y", "true", "1"}
_FALSE_ANSWERS = {"no", "n", "false", "0"}


def _normalize_boolean_answer(raw: str) -> bool | None:
    """None means "not a recognizable yes/no answer" — treated as not
    matched, same as a wrong text answer, never as a crash."""
    value = (raw or "").strip().lower()
    if value in _TRUE_ANSWERS:
        return True
    if value in _FALSE_ANSWERS:
        return False
    return None


def _record_job_view(db, request: Request, job: Job) -> None:
    # Salted hash, never the raw IP — see app/models/job_view.py. Reuses
    # jwt_secret as the pepper purely to avoid adding another config
    # value; this hash isn't protecting anything as sensitive as a token.
    client_ip = request.client.host if request.client else "unknown"
    visitor_hash = hashlib.sha256(f"{client_ip}:{settings.jwt_secret}".encode()).hexdigest()
    stmt = (
        pg_insert(JobView)
        .values(tenant_id=job.tenant_id, job_id=job.id, visitor_hash=visitor_hash)
        .on_conflict_do_nothing(index_elements=["job_id", "visitor_hash"])
    )
    db.execute(stmt)


def _board_path(tenant: Tenant) -> str:
    if tenant.type == TenantType.freelance_org:
        return "/jobs"
    return f"/jobs/{tenant.slug}"


def _posted_by_name(db, job: Job) -> str:
    if job.owner_recruiter_id is None:
        return "the hiring team"
    recruiter = db.query(User).filter(User.id == job.owner_recruiter_id).first()
    return recruiter.full_name if recruiter else "the hiring team"


def _public_salary(job: Job) -> tuple[int | None, int | None, str | None]:
    # Confidential salary is never serialized on a /public/* response —
    # a server-side gate, not a client-side hide. See docs/10.
    if job.salary_confidential:
        return None, None, None
    return job.salary_min, job.salary_max, job.salary_currency


def _open_public_jobs(db, tenant_id: uuid.UUID):
    from app.models.job import JobVisibility

    return (
        db.query(Job)
        .filter(
            Job.tenant_id == tenant_id,
            Job.status == JobStatus.open,
            Job.visibility == JobVisibility.public,
            Job.deleted_at.is_(None),
        )
        .order_by(Job.created_at.desc())
        .all()
    )


def _job_summary(db, j: Job, tenant: Tenant | None = None) -> PublicJobSummary:
    salary_min, salary_max, salary_currency = _public_salary(j)
    is_org = tenant is not None and tenant.type == TenantType.org
    return PublicJobSummary(
        id=j.id,
        slug=j.slug,
        title=j.title,
        overview=j.overview,
        applicant_count=_applicant_count(db, j.id),
        work_mode=j.work_mode.value if j.work_mode else None,
        location=j.location,
        seniority=j.seniority.value if j.seniority else None,
        job_type=j.job_type.value if j.job_type else None,
        salary_min=salary_min,
        salary_max=salary_max,
        salary_currency=salary_currency,
        created_at=j.created_at,
        org_name=tenant.name if is_org else None,
        org_logo_url=tenant.logo_url if is_org else None,
        board_path=_board_path(tenant) if tenant is not None else None,
    )


def _board_response(db, tenant: Tenant) -> PublicBoardResponse:
    jobs = _open_public_jobs(db, tenant.id)
    is_org = tenant.type == TenantType.org
    return PublicBoardResponse(
        org_name=tenant.name,
        org_logo_url=tenant.logo_url if is_org else None,
        org_description=tenant.description if is_org else None,
        org_office_location=tenant.office_location if is_org else None,
        org_contact_email=tenant.contact_email if is_org else None,
        jobs=[_job_summary(db, j, tenant) for j in jobs],
    )


@router.get("/boards/all", response_model=PublicBoardResponse)
def all_jobs_board() -> PublicBoardResponse:
    # Every open, public-visibility job across every tenant — Freelance
    # Org postings and every Org's postings alike. An org's own board
    # (below) stays scoped to just that org. See docs/10.
    with raw_session() as db:
        tenants = db.query(Tenant).all()
        entries = []
        for tenant in tenants:
            set_rls_context(db, tenant_id=str(tenant.id), role="recruiter")
            for j in _open_public_jobs(db, tenant.id):
                entries.append((j, tenant))
        entries.sort(key=lambda pair: pair[0].created_at, reverse=True)
        return PublicBoardResponse(
            org_name="All Jobs",
            jobs=[_job_summary(db, j, tenant) for j, tenant in entries],
        )


@router.get("/boards/{slug}", response_model=PublicBoardResponse)
def org_board(slug: str) -> PublicBoardResponse:
    with raw_session() as db:
        tenant = db.query(Tenant).filter(Tenant.slug == slug, Tenant.type == TenantType.org).first()
        if tenant is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Not found")
        set_rls_context(db, tenant_id=str(tenant.id), role="recruiter")
        return _board_response(db, tenant)


@router.get("/jobs/{slug}", response_model=PublicJobDetail)
def public_job_detail(slug: str, request: Request) -> PublicJobDetail:
    with raw_session() as db:
        # Deliberately no set_rls_context call before this lookup — the
        # public_open_jobs policy (migration 0008) grants SELECT on
        # status='open' rows regardless of session context, and calling
        # set_rls_context first would set app.tenant_id to '' , which the
        # OTHER (tenant_isolation) policy's ''::uuid cast hard-errors on —
        # Postgres evaluates every permissive policy's USING clause even
        # once one already matched. See migration 0008's docstring.
        #
        # Looked up by slug, not id — the public apply URL never exposes
        # the internal UUID. See app/services/slugs.py, migration 0013.
        job = db.query(Job).filter(Job.slug == slug, Job.status == JobStatus.open, Job.deleted_at.is_(None)).first()
        if job is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Job not found")
        # tenants isn't RLS-protected, safe to query before re-scoping below.
        tenant = db.query(Tenant).filter(Tenant.id == job.tenant_id).first()
        # Now that we know the real tenant_id, re-scope properly for the
        # rest of this request's queries (screening questions, etc.).
        set_rls_context(db, tenant_id=str(job.tenant_id), role="recruiter")
        _record_job_view(db, request, job)

        questions = (
            db.query(JobScreeningQuestion)
            .filter(JobScreeningQuestion.job_id == job.id)
            .order_by(JobScreeningQuestion.position)
            .all()
        )
        is_org = tenant.type == TenantType.org
        salary_min, salary_max, salary_currency = _public_salary(job)
        return PublicJobDetail(
            id=job.id,
            title=job.title,
            overview=job.overview,
            description=job.description,
            is_technical_role=job.is_technical_role,
            applicant_count=_applicant_count(db, job.id),
            work_mode=job.work_mode.value if job.work_mode else None,
            location=job.location,
            seniority=job.seniority.value if job.seniority else None,
            job_type=job.job_type.value if job.job_type else None,
            salary_min=salary_min,
            salary_max=salary_max,
            salary_currency=salary_currency,
            posted_by_name=_posted_by_name(db, job),
            org_name=tenant.name if is_org else None,
            org_logo_url=tenant.logo_url if is_org else None,
            created_at=job.created_at,
            board_path=_board_path(tenant),
            screening_questions=[
                PublicScreeningQuestionOut(
                    id=q.id,
                    question_text=q.question_text,
                    question_type=q.question_type.value,
                    required=q.required,
                    position=q.position,
                )
                for q in questions
            ],
        )


@router.post("/jobs/{slug}/apply", response_model=ApplyResponse, status_code=201)
@limiter.limit("5/minute")
async def apply_to_job(
    request: Request,
    slug: str,
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
        job = db.query(Job).filter(Job.slug == slug, Job.status == JobStatus.open, Job.deleted_at.is_(None)).first()
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
        # Security: this is a fully public, unauthenticated endpoint, and
        # a successful parse now triggers a paid LLM API call — without a
        # size/type check here, anyone could POST arbitrarily large files
        # to exhaust memory/disk, or spam this endpoint to run up the LLM
        # bill. candidates.py's authenticated cv_parse_preview already
        # enforced both checks; this path was missing them entirely.
        filename = cv.filename or "cv"
        ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in SUPPORTED_EXTENSIONS:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Unsupported file type — use PDF or DOCX")
        # Bounded read — see the comment above on why this can't be a
        # plain `await cv.read()` on a public, unauthenticated endpoint.
        content = await cv.read(MAX_FILE_SIZE_BYTES + 1)
        if len(content) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="File exceeds 10 MB limit")
        temp_id, temp_path = storage.save_temp(content, filename)
        parsed_fields, parse_confidence = {}, {}
        try:
            text = extract_text(temp_path)
            # See candidates.py's cv_parse_preview for why this is
            # offloaded to a thread — the LLM tier is a blocking call
            # that can take tens of seconds.
            parsed_fields, parse_confidence, _status = await asyncio.to_thread(parse_cv_text, text)
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
            .filter(
                Candidate.tenant_id == job.tenant_id,
                Candidate.dedup_fingerprint == fingerprint,
                Candidate.deleted_at.is_(None),
            )
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
        # Not every question gates eligibility (required=False is purely
        # informational — no pass/fail), and not every gating question is
        # a text match: question_type="number" needs a minimum numeric
        # threshold (e.g. "years of React experience"), and
        # question_type="boolean" needs a yes/no comparison tolerant of
        # how the answer was phrased ("y", "Yes", "true" all mean the
        # same thing) rather than exact string equality. See
        # app/models/job_application.py.
        questions = db.query(JobScreeningQuestion).filter(JobScreeningQuestion.job_id == job.id).all()
        answers_by_qid = {a.get("question_id"): a.get("answer", "") for a in answers_raw}
        answer_records = []
        eligible = True
        for q in questions:
            given_raw = answers_by_qid.get(str(q.id), "")
            if not q.required:
                matched = True
            elif q.question_type == ScreeningQuestionType.number:
                try:
                    matched = float(given_raw) >= (q.min_value or 0)
                except (TypeError, ValueError):
                    matched = False
            elif q.question_type == ScreeningQuestionType.boolean:
                given_bool = _normalize_boolean_answer(given_raw)
                matched = given_bool is not None and given_bool == (q.expected_answer == "yes")
            else:
                matched = given_raw.strip().lower() == (q.expected_answer or "").strip().lower()
            if not matched:
                eligible = False
            answer_records.append(
                {
                    "question_id": str(q.id),
                    "question_text": q.question_text,
                    "question_type": q.question_type.value,
                    "required": q.required,
                    "expected_answer": q.expected_answer,
                    "min_value": q.min_value,
                    "answer": given_raw,
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


_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")


def _strip_html(value: str) -> str:
    """Plain text for a meta description / OG description — job.description
    is recruiter-authored HTML (see docs/10's WYSIWYG note). A regex strip
    is good enough here: the output is truncated and only ever read by a
    social-media crawler or a search snippet, not re-rendered as markup."""
    return _WHITESPACE_RE.sub(" ", _TAG_RE.sub(" ", value)).strip()


@root_router.get("/sitemap.xml", include_in_schema=False)
def sitemap() -> Response:
    # Job listings are DB-driven content that changes constantly, so this
    # is generated on request rather than a static file — see docs/10.
    base = settings.frontend_base_url.rstrip("/")
    urls = [f"{base}/", f"{base}/jobs", f"{base}/pricing", f"{base}/about", f"{base}/faq"]
    with raw_session() as db:
        org_tenants = db.query(Tenant).filter(Tenant.type == TenantType.org, Tenant.slug.is_not(None)).all()
        for tenant in org_tenants:
            urls.append(f"{base}/jobs/{tenant.slug}")
            set_rls_context(db, tenant_id=str(tenant.id), role="recruiter")
            for job in _open_public_jobs(db, tenant.id):
                urls.append(f"{base}/apply/{job.slug}")

        # Freelance Org jobs only ever appear on the all-jobs board (see
        # docs/10's "All Jobs vs. an org's own board"), but each job's own
        # apply page is still a real crawlable URL.
        freelance_org = db.query(Tenant).filter(Tenant.type == TenantType.freelance_org).first()
        if freelance_org:
            set_rls_context(db, tenant_id=str(freelance_org.id), role="recruiter")
            for job in _open_public_jobs(db, freelance_org.id):
                urls.append(f"{base}/apply/{job.slug}")

    body = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url in urls:
        body.append(f"<url><loc>{html.escape(url)}</loc></url>")
    body.append("</urlset>")
    return Response(content="\n".join(body), media_type="application/xml")


@router.get("/jobs/{slug}/share", response_class=HTMLResponse, include_in_schema=False)
def job_share_preview(slug: str) -> HTMLResponse:
    """A standalone, crawlable HTML page carrying Open Graph / Twitter Card
    tags for one job, meant to be what a social-media bot fetches when a
    /apply/{slug} link is shared (this app is a client-rendered SPA with no
    server-side rendering, so a crawler hitting the real SPA URL directly
    would only ever see an empty <div id="root">, never the job's actual
    title/salary/description). Redirects real browsers on to the SPA apply
    page immediately; a bot that doesn't execute the redirect still reads
    the OG tags in the initial HTML response. Wiring actual bot user-agent
    detection at the reverse proxy (so /apply/{slug} transparently serves
    this instead of the SPA for known crawler user agents) is a deployment
    concern, not an application one, see docs/10."""
    with raw_session() as db:
        job = db.query(Job).filter(Job.slug == slug, Job.status == JobStatus.open, Job.deleted_at.is_(None)).first()
        if job is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Job not found")
        tenant = db.query(Tenant).filter(Tenant.id == job.tenant_id).first()
        set_rls_context(db, tenant_id=str(job.tenant_id), role="recruiter")

        salary_min, salary_max, salary_currency = _public_salary(job)
        parts = [job.title]
        if job.seniority:
            parts.append(job.seniority.value.replace("_", " ").title())
        if job.location:
            parts.append(job.location)
        if salary_min:
            currency_prefix = salary_currency or ""
            amount = f"{currency_prefix} {salary_min:,}".strip()
            if salary_max and salary_max != salary_min:
                amount += " - " + f"{currency_prefix} {salary_max:,}".strip()
            parts.append(amount)
        summary_bits = [p for p in parts[1:] if p]
        description = " · ".join(summary_bits)
        if job.overview:
            description = f"{description} — {job.overview}" if description else job.overview
        elif job.description:
            description = f"{description} — {_strip_html(job.description)[:200]}" if description else _strip_html(job.description)[:200]
        description = description[:300]

        org_name = tenant.name if tenant and tenant.type == TenantType.org else "FastRecruit"
        # Org tenants with their own uploaded logo use it; everything else
        # (Freelance Org jobs, an org with no logo yet) falls back to the
        # app's own branded share card rather than shipping no og:image at
        # all — see frontend/public/og-share.png.
        org_logo = tenant.logo_url if tenant and tenant.type == TenantType.org and tenant.logo_url else None
        og_image = org_logo or f"{settings.frontend_base_url.rstrip('/')}/og-share.png"
        apply_url = f"{settings.frontend_base_url.rstrip('/')}/apply/{job.slug}"

        title = html.escape(f"{job.title} at {org_name}")
        description_esc = html.escape(description)
        apply_url_esc = html.escape(apply_url)
        image_tag = f'<meta property="og:image" content="{html.escape(og_image)}" />'

        return HTMLResponse(f"""<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>{title}</title>
<meta name="description" content="{description_esc}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{description_esc}" />
<meta property="og:url" content="{apply_url_esc}" />
{image_tag}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{title}" />
<meta name="twitter:description" content="{description_esc}" />
<meta name="twitter:image" content="{html.escape(og_image)}" />
<meta http-equiv="refresh" content="0; url={apply_url_esc}" />
<script>window.location.replace("{apply_url_esc}");</script>
</head>
<body>
<p>Redirecting to <a href="{apply_url_esc}">{title}</a>...</p>
</body>
</html>""")
