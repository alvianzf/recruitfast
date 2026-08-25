import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user, get_db, require_role
from app.models.job import Job
from app.models.pipeline import DEFAULT_STAGE_NAMES, JobStage
from app.models.user import User
from app.schemas.job import AssignJobRequest, JobCreate, JobOut
from app.services.slugs import generate_job_slug

router = APIRouter(prefix="/jobs", tags=["jobs"])


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


@router.post("", response_model=JobOut, status_code=201)
def create_job(
    payload: JobCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> Job:
    job = Job(
        tenant_id=uuid.UUID(current_user.tenant_id),
        owner_recruiter_id=None if payload.unassigned else uuid.UUID(current_user.user_id),
        title=payload.title,
        slug=generate_job_slug(payload.title),
        overview=payload.overview,
        description=payload.description,
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
                is_terminal_success=(name == "Offer"),
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
    recruiter = (
        db.query(User)
        .filter(User.id == payload.recruiter_id, User.tenant_id == uuid.UUID(current_user.tenant_id))
        .first()
    )
    if recruiter is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="recruiter_id is not in this org")
    job.owner_recruiter_id = recruiter.id
    return job


@router.post("/{job_id}/claim", response_model=JobOut)
def claim_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> Job:
    # Self-claim from the Unassigned Jobs queue — docs/01. Any recruiter
    # can claim any unassigned job in their tenant; first to claim wins
    # (no locking needed at this scale — a claimed job simply won't match
    # the filter below for a second claimant).
    job = (
        db.query(Job)
        .filter(Job.id == job_id, Job.tenant_id == current_user.tenant_id, Job.owner_recruiter_id.is_(None))
        .first()
    )
    if job is None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Job not found or already claimed")
    job.owner_recruiter_id = uuid.UUID(current_user.user_id)
    return job
