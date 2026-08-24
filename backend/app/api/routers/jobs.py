import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user, get_db
from app.models.job import Job
from app.models.pipeline import DEFAULT_STAGE_NAMES, JobStage
from app.schemas.job import JobCreate, JobOut

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[JobOut])
def list_jobs(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[Job]:
    # RLS restricts rows to current_user's tenant; the explicit filter
    # below is defense-in-depth, not the only guard. See docs/02.
    return db.query(Job).filter(Job.tenant_id == current_user.tenant_id, Job.deleted_at.is_(None)).all()


@router.post("", response_model=JobOut, status_code=201)
def create_job(
    payload: JobCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> Job:
    job = Job(
        tenant_id=uuid.UUID(current_user.tenant_id),
        owner_recruiter_id=uuid.UUID(current_user.user_id),
        title=payload.title,
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
