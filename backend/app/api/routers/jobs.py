import enum
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user, get_db, require_role
from app.models.client import Client
from app.models.job import Job, JobStatus, JobType, Seniority, WorkMode
from app.models.pipeline import DEFAULT_STAGE_NAMES, JobStage
from app.models.team import Team
from app.models.user import User, UserRole
from app.schemas.job import AssignJobRequest, JobCreate, JobOut, JobUpdate
from app.services.slugs import generate_job_slug

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _parse_enum(enum_cls: type[enum.Enum], value: str | None, field_name: str) -> enum.Enum | None:
    if value is None:
        return None
    try:
        return enum_cls(value)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Invalid {field_name}") from None


def _resolve_team_id(db: Session, tenant_id: str, team_id: uuid.UUID | None) -> uuid.UUID | None:
    if team_id is None:
        return None
    team = db.query(Team).filter(Team.id == team_id, Team.tenant_id == tenant_id).first()
    if team is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="team_id is not in this org")
    return team.id


def _resolve_client_id(db: Session, tenant_id: str, client_id: uuid.UUID | None) -> uuid.UUID | None:
    # RLS scopes the query, but a Postgres FK constraint validates against
    # the referenced row's existence regardless of the *querying* role's
    # RLS visibility — so without this explicit tenant check, a client_id
    # belonging to another tenant would still satisfy the FK and silently
    # attach. See docs/11-security-review.md.
    if client_id is None:
        return None
    client = db.query(Client).filter(Client.id == client_id, Client.tenant_id == tenant_id).first()
    if client is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="client_id is not in this org")
    return client.id


@router.get("", response_model=list[JobOut])
def list_jobs(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[Job]:
    # RLS restricts rows to current_user's tenant; the explicit filter
    # below is defense-in-depth, not the only guard. See docs/02.
    return db.query(Job).filter(Job.tenant_id == current_user.tenant_id, Job.deleted_at.is_(None)).all()


@router.get("/{job_id}", response_model=JobOut)
def get_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> Job:
    job = (
        db.query(Job)
        .filter(Job.id == job_id, Job.tenant_id == current_user.tenant_id, Job.deleted_at.is_(None))
        .first()
    )
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


@router.patch("/{job_id}", response_model=JobOut)
def update_job(
    job_id: uuid.UUID,
    payload: JobUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> Job:
    job = (
        db.query(Job)
        .filter(Job.id == job_id, Job.tenant_id == current_user.tenant_id, Job.deleted_at.is_(None))
        .first()
    )
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Job not found")

    data = payload.model_dump(exclude_unset=True)
    clear_client = data.pop("clear_client", False)
    if "client_id" in data:
        job.client_id = _resolve_client_id(db, current_user.tenant_id, data.pop("client_id"))
    elif clear_client:
        job.client_id = None
    if "status" in data:
        status_value = data.pop("status")
        try:
            job.status = JobStatus(status_value)
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid status") from None
    if "work_mode" in data:
        job.work_mode = _parse_enum(WorkMode, data.pop("work_mode"), "work_mode")
    if "seniority" in data:
        job.seniority = _parse_enum(Seniority, data.pop("seniority"), "seniority")
    if "job_type" in data:
        job.job_type = _parse_enum(JobType, data.pop("job_type"), "job_type")
    for field, value in data.items():
        setattr(job, field, value)
    return job


@router.post("", response_model=JobOut, status_code=201)
def create_job(
    payload: JobCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> Job:
    # An org_admin never becomes a job's owner_recruiter_id — creating a
    # job isn't "doing recruiter work," so an admin-created job is always
    # either open to the whole org or assigned to a team, never
    # self-owned. A recruiter-created job is always owned by its creator
    # (that's what recruiter work is). See docs/01.
    is_admin = current_user.role == "org_admin"
    job = Job(
        tenant_id=uuid.UUID(current_user.tenant_id),
        owner_recruiter_id=None if is_admin else uuid.UUID(current_user.user_id),
        team_id=_resolve_team_id(db, current_user.tenant_id, payload.team_id) if is_admin else None,
        title=payload.title,
        slug=generate_job_slug(payload.title),
        overview=payload.overview,
        description=payload.description,
        headcount=payload.headcount,
        work_mode=_parse_enum(WorkMode, payload.work_mode, "work_mode"),
        location=payload.location,
        seniority=_parse_enum(Seniority, payload.seniority, "seniority"),
        job_type=_parse_enum(JobType, payload.job_type, "job_type"),
        salary_min=payload.salary_min,
        salary_max=payload.salary_max,
        salary_currency=payload.salary_currency,
        salary_confidential=payload.salary_confidential,
        client_id=_resolve_client_id(db, current_user.tenant_id, payload.client_id),
    )
    db.add(job)
    db.flush()  # assigns job.id before we clone stages

    # Clone-on-create: this job gets its own independent stage set, so
    # future edits here never touch other jobs. See docs/03.
    for position, name in enumerate(DEFAULT_STAGE_NAMES):
        db.add(
            JobStage(
                tenant_id=job.tenant_id,
                job_id=job.id,
                name=name,
                position=position,
                is_terminal_reject=(name == "Reject"),
                is_terminal_success=(name == "Signed"),
            )
        )

    return job


@router.post("/{job_id}/assign", response_model=JobOut)
def assign_job(
    job_id: uuid.UUID,
    payload: AssignJobRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("org_admin")),
) -> Job:
    job = db.query(Job).filter(Job.id == job_id, Job.tenant_id == current_user.tenant_id).first()
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Job not found")

    if payload.recruiter_id is not None:
        # role == recruiter, not just "any user in this org" — an
        # org_admin (including the caller assigning to themselves) is
        # never a valid assignment target. Admins don't do recruiter work.
        recruiter = (
            db.query(User)
            .filter(
                User.id == payload.recruiter_id,
                User.tenant_id == uuid.UUID(current_user.tenant_id),
                User.role == UserRole.recruiter,
            )
            .first()
        )
        if recruiter is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="recruiter_id is not a recruiter in this org")
        job.owner_recruiter_id = recruiter.id
        job.team_id = None
    else:
        job.team_id = _resolve_team_id(db, current_user.tenant_id, payload.team_id)
        job.owner_recruiter_id = None
    # job was loaded (with its column_property values, e.g. team_name)
    # before this mutation — without a refresh, the response would
    # serialize the pre-mutation team_name/client_name rather than what
    # was just set.
    db.flush()
    db.refresh(job)
    return job


@router.post("/{job_id}/claim", response_model=JobOut)
def claim_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("recruiter")),
) -> Job:
    # Self-claim from the Unassigned Jobs queue — docs/01. Recruiter-only
    # (an org_admin never does recruiter work, including claiming a job
    # for themselves). Any recruiter can claim a fully-open job; a
    # team-assigned job can only be claimed by a recruiter on that team.
    # First to claim wins (no locking needed at this scale — a claimed
    # job simply won't match the filter below for a second claimant).
    claimer = db.query(User).filter(User.id == uuid.UUID(current_user.user_id)).first()
    claimable_team_filter = (
        Job.team_id.is_(None) if claimer is None or claimer.team_id is None else
        or_(Job.team_id.is_(None), Job.team_id == claimer.team_id)
    )
    job = (
        db.query(Job)
        .filter(
            Job.id == job_id,
            Job.tenant_id == current_user.tenant_id,
            Job.owner_recruiter_id.is_(None),
            claimable_team_filter,
        )
        .first()
    )
    if job is None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Job not found, already claimed, or not open to your team")
    job.owner_recruiter_id = uuid.UUID(current_user.user_id)
    job.team_id = None
    return job
