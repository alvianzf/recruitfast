import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user, get_db, require_role
from app.core.database import raw_session
from app.models.candidate import Candidate
from app.models.job import Job, JobStatus
from app.models.pipeline import JobStage
from app.models.placement import PipelinePlacement, PlacementStatus
from app.models.team import Team
from app.models.tenant import Tenant, TenantType
from app.models.user import User, UserRole, UserStatus
from app.schemas.metrics import (
    JobsByStatusPoint,
    OrgMetrics,
    PlatformMetrics,
    RecruiterMetrics,
    RecruiterPerformancePoint,
    RecruiterWorkloadPoint,
    StageFunnelPoint,
)

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/recruiter", response_model=RecruiterMetrics)
def recruiter_metrics(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> RecruiterMetrics:
    my_id = uuid.UUID(current_user.user_id)

    open_jobs = (
        db.query(func.count(Job.id))
        .filter(Job.owner_recruiter_id == my_id, Job.status == JobStatus.open, Job.deleted_at.is_(None))
        .scalar()
        or 0
    )
    total_candidates = db.query(func.count(Candidate.id)).filter(Candidate.deleted_at.is_(None)).scalar() or 0

    funnel_rows = (
        db.query(JobStage.name, JobStage.position, func.count(PipelinePlacement.id))
        .join(PipelinePlacement, PipelinePlacement.current_stage_id == JobStage.id)
        .join(Job, Job.id == JobStage.job_id)
        .filter(Job.owner_recruiter_id == my_id, PipelinePlacement.status == PlacementStatus.active)
        .group_by(JobStage.name, JobStage.position)
        .order_by(JobStage.position)
        .all()
    )
    stage_funnel = [StageFunnelPoint(stage_name=name, count=count) for name, _pos, count in funnel_rows]

    active_offers = (
        db.query(func.count(PipelinePlacement.id))
        .join(JobStage, JobStage.id == PipelinePlacement.current_stage_id)
        .join(Job, Job.id == PipelinePlacement.job_id)
        .filter(
            Job.owner_recruiter_id == my_id,
            JobStage.is_terminal_success.is_(True),
            PipelinePlacement.status == PlacementStatus.active,
        )
        .scalar()
        or 0
    )

    return RecruiterMetrics(
        open_jobs=open_jobs,
        total_candidates=total_candidates,
        stage_funnel=stage_funnel,
        active_offers=active_offers,
    )


@router.get("/org", response_model=OrgMetrics)
def org_metrics(
    team_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("org_admin")),
) -> OrgMetrics:
    status_q = db.query(Job.status, func.count(Job.id)).filter(Job.deleted_at.is_(None))
    if team_id is not None:
        status_q = status_q.join(User, User.id == Job.owner_recruiter_id).filter(User.team_id == team_id)
    status_rows = status_q.group_by(Job.status).all()
    jobs_by_status = [JobsByStatusPoint(status=s.value, count=c) for s, c in status_rows]

    workload_q = (
        db.query(User.full_name, func.count(Job.id))
        .join(Job, Job.owner_recruiter_id == User.id)
        .filter(Job.status == JobStatus.open, Job.deleted_at.is_(None))
    )
    if team_id is not None:
        workload_q = workload_q.filter(User.team_id == team_id)
    workload_rows = workload_q.group_by(User.full_name).all()
    recruiter_workload = [RecruiterWorkloadPoint(recruiter_name=name, open_jobs=count) for name, count in workload_rows]

    now = datetime.now(timezone.utc)
    open_jobs_q = db.query(Job).filter(Job.status == JobStatus.open, Job.deleted_at.is_(None))
    if team_id is not None:
        open_jobs_q = open_jobs_q.join(User, User.id == Job.owner_recruiter_id).filter(User.team_id == team_id)
    buckets = {"30-60": 0, "60-90": 0, "90+": 0}
    for job in open_jobs_q.all():
        age_days = (now - job.created_at).days
        if 30 <= age_days < 60:
            buckets["30-60"] += 1
        elif 60 <= age_days < 90:
            buckets["60-90"] += 1
        elif age_days >= 90:
            buckets["90+"] += 1

    return OrgMetrics(jobs_by_status=jobs_by_status, recruiter_workload=recruiter_workload, jobs_open_30_60_90=buckets)


@router.get("/org/recruiters", response_model=list[RecruiterPerformancePoint])
def org_recruiter_performance(
    team_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("org_admin")),
) -> list[RecruiterPerformancePoint]:
    recruiters_q = db.query(User).filter(
        User.tenant_id == uuid.UUID(current_user.tenant_id),
        User.role == UserRole.recruiter,
        User.deleted_at.is_(None),
    )
    if team_id is not None:
        recruiters_q = recruiters_q.filter(User.team_id == team_id)
    recruiters = recruiters_q.order_by(User.full_name).all()

    team_names = {t.id: t.name for t in db.query(Team).all()}

    points: list[RecruiterPerformancePoint] = []
    for recruiter in recruiters:
        open_jobs = (
            db.query(func.count(Job.id))
            .filter(Job.owner_recruiter_id == recruiter.id, Job.status == JobStatus.open, Job.deleted_at.is_(None))
            .scalar()
            or 0
        )
        won_jobs = (
            db.query(func.count(Job.id))
            .filter(Job.owner_recruiter_id == recruiter.id, Job.status == JobStatus.won, Job.deleted_at.is_(None))
            .scalar()
            or 0
        )
        lost_jobs = (
            db.query(func.count(Job.id))
            .filter(Job.owner_recruiter_id == recruiter.id, Job.status == JobStatus.lost, Job.deleted_at.is_(None))
            .scalar()
            or 0
        )
        active_candidates = (
            db.query(func.count(PipelinePlacement.id))
            .join(Job, Job.id == PipelinePlacement.job_id)
            .filter(Job.owner_recruiter_id == recruiter.id, PipelinePlacement.status == PlacementStatus.active)
            .scalar()
            or 0
        )
        offers = (
            db.query(func.count(PipelinePlacement.id))
            .join(JobStage, JobStage.id == PipelinePlacement.current_stage_id)
            .join(Job, Job.id == PipelinePlacement.job_id)
            .filter(
                Job.owner_recruiter_id == recruiter.id,
                JobStage.is_terminal_success.is_(True),
                PipelinePlacement.status == PlacementStatus.active,
            )
            .scalar()
            or 0
        )
        points.append(
            RecruiterPerformancePoint(
                recruiter_id=str(recruiter.id),
                recruiter_name=recruiter.full_name,
                team_name=team_names.get(recruiter.team_id) if recruiter.team_id else None,
                open_jobs=open_jobs,
                active_candidates=active_candidates,
                offers=offers,
                won_jobs=won_jobs,
                lost_jobs=lost_jobs,
            )
        )
    return points


@router.get("/platform", response_model=PlatformMetrics)
def platform_metrics(current_user: CurrentUser = Depends(require_role("superadmin"))) -> PlatformMetrics:
    # tenants/users aren't RLS-protected (account metadata, not recruiter
    # content) — but jobs/candidates ARE, with a policy that excludes the
    # superadmin role entirely, by design (docs/02). That means even a
    # bare COUNT(*) on jobs/candidates is unreachable from this role as
    # currently modeled — a real gap vs. docs/05's "aggregate jobs/
    # candidates platform-wide" metric. Fixing it needs a dedicated
    # aggregate mechanism (e.g. a SECURITY DEFINER count-only function or
    # a periodically refreshed materialized view) rather than loosening
    # the RLS policy for convenience — left as follow-up, not shipped
    # here. This endpoint only reports what's honestly reachable today.
    with raw_session() as db:
        active_org_tenants = (
            db.query(func.count(Tenant.id)).filter(Tenant.type == TenantType.org).scalar() or 0
        )
        freelance_org = db.query(Tenant).filter(Tenant.type == TenantType.freelance_org).first()
        freelance_org_members = 0
        if freelance_org:
            freelance_org_members = (
                db.query(func.count(User.id))
                .filter(User.tenant_id == freelance_org.id, User.status == UserStatus.active)
                .scalar()
                or 0
            )
        total_recruiters = (
            db.query(func.count(User.id))
            .filter(User.role == UserRole.recruiter, User.status == UserStatus.active)
            .scalar()
            or 0
        )
        from app.models.freelance import FreelanceApplication, FreelanceApplicationStatus

        freelance_queue_depth = (
            db.query(func.count(FreelanceApplication.id))
            .filter(FreelanceApplication.status == FreelanceApplicationStatus.pending)
            .scalar()
            or 0
        )
        return PlatformMetrics(
            active_org_tenants=active_org_tenants,
            freelance_org_members=freelance_org_members,
            total_recruiters=total_recruiters,
            freelance_queue_depth=freelance_queue_depth,
        )
