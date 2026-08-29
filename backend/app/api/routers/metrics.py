import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user, get_db, require_role
from app.core import cache
from app.core.database import raw_session
from app.models.candidate import Candidate
from app.models.job import Job, JobStatus
from app.models.pipeline import JobStage
from app.models.placement import PipelinePlacement, PlacementStatus, StageHistory
from app.models.team import Team
from app.models.tenant import Tenant, TenantType
from app.models.user import User, UserRole, UserStatus
from app.schemas.metrics import (
    JobPipelineMetrics,
    JobsByStatusPoint,
    OpportunityMetrics,
    OrgMetrics,
    PlacementValueByCurrency,
    PlacementValueMetrics,
    PlatformMetrics,
    RecruiterMetrics,
    RecruiterPerformancePoint,
    RecruiterWorkloadPoint,
    StageConversionPoint,
    StageFunnelPoint,
)
from app.services import forex

router = APIRouter(prefix="/metrics", tags=["metrics"])

# No currency column defaults to a real value anywhere in the schema
# (offer_rate_currency and salary_currency are both nullable) — this app
# is IDR-first (see docs/05), so untagged amounts are treated as IDR
# rather than silently dropped from the totals.
UNTAGGED_CURRENCY_FALLBACK = "IDR"


def _currency_metrics(rows: list[tuple[str, float | None]], preferred_currency: str) -> PlacementValueMetrics:
    by_currency = [
        PlacementValueByCurrency(currency=currency, total=int(total or 0)) for currency, total in rows if total
    ]
    total_in_preferred = 0.0
    all_converted = True
    for bucket in by_currency:
        if bucket.currency == preferred_currency:
            total_in_preferred += bucket.total
            continue
        converted = forex.convert(bucket.total, bucket.currency, preferred_currency)
        if converted is None:
            all_converted = False
        else:
            total_in_preferred += converted
    return PlacementValueMetrics(
        by_currency=by_currency,
        preferred_currency=preferred_currency,
        total_in_preferred_currency=round(total_in_preferred, 2) if all_converted else None,
    )


def _placement_value_metrics(
    db: Session,
    preferred_currency: str,
    owner_recruiter_id: uuid.UUID | None = None,
    team_id: uuid.UUID | None = None,
    client_id: uuid.UUID | None = None,
) -> PlacementValueMetrics:
    currency_col = func.coalesce(PipelinePlacement.offer_rate_currency, UNTAGGED_CURRENCY_FALLBACK)
    q = (
        db.query(currency_col, func.sum(PipelinePlacement.offer_rate))
        .join(Job, Job.id == PipelinePlacement.job_id)
        .filter(PipelinePlacement.offer_rate.is_not(None))
    )
    if owner_recruiter_id is not None:
        q = q.filter(Job.owner_recruiter_id == owner_recruiter_id)
    elif team_id is not None:
        q = q.join(User, User.id == Job.owner_recruiter_id).filter(User.team_id == team_id)
    if client_id is not None:
        q = q.filter(Job.client_id == client_id)
    rows = q.group_by(currency_col).all()
    return _currency_metrics(rows, preferred_currency)


def _opportunity_metrics(
    db: Session,
    tenant_id: uuid.UUID,
    preferred_currency: str,
    owner_recruiter_id: uuid.UUID | None = None,
    team_id: uuid.UUID | None = None,
) -> OpportunityMetrics:
    # Advertised value, not adjusted for partial fills on multi-headcount
    # jobs — see OpportunityMetrics' docstring.
    salary_midpoint = (Job.salary_min + func.coalesce(Job.salary_max, Job.salary_min)) / 2.0
    currency_col = func.coalesce(Job.salary_currency, UNTAGGED_CURRENCY_FALLBACK)

    def _bucket(status_filter) -> PlacementValueMetrics:
        q = db.query(currency_col, func.sum(salary_midpoint * Job.headcount)).filter(
            Job.tenant_id == tenant_id, Job.deleted_at.is_(None), Job.salary_min.is_not(None), status_filter
        )
        if owner_recruiter_id is not None:
            q = q.filter(Job.owner_recruiter_id == owner_recruiter_id)
        elif team_id is not None:
            q = q.join(User, User.id == Job.owner_recruiter_id).filter(User.team_id == team_id)
        rows = q.group_by(currency_col).all()
        return _currency_metrics(rows, preferred_currency)

    return OpportunityMetrics(
        potential_unrealized=_bucket(Job.status.in_([JobStatus.open, JobStatus.on_hold])),
        opportunity_lost=_bucket(Job.status == JobStatus.lost),
    )


def _pipeline_breakdown(
    db: Session,
    tenant_id: uuid.UUID,
    owner_recruiter_id: uuid.UUID | None = None,
    team_id: uuid.UUID | None = None,
) -> list[JobPipelineMetrics]:
    jobs_q = db.query(Job).filter(Job.tenant_id == tenant_id, Job.deleted_at.is_(None))
    if owner_recruiter_id is not None:
        jobs_q = jobs_q.filter(Job.owner_recruiter_id == owner_recruiter_id)
    elif team_id is not None:
        jobs_q = jobs_q.join(User, User.id == Job.owner_recruiter_id).filter(User.team_id == team_id)
    jobs = jobs_q.order_by(Job.created_at.desc()).all()
    if not jobs:
        return []
    job_ids = [j.id for j in jobs]

    candidate_counts = dict(
        db.query(PipelinePlacement.job_id, func.count(PipelinePlacement.id))
        .filter(PipelinePlacement.job_id.in_(job_ids))
        .group_by(PipelinePlacement.job_id)
        .all()
    )

    history_rows = (
        db.query(
            PipelinePlacement.job_id,
            StageHistory.placement_id,
            StageHistory.moved_at,
            JobStage.is_terminal_success,
        )
        .join(JobStage, JobStage.id == StageHistory.to_stage_id)
        .join(PipelinePlacement, PipelinePlacement.id == StageHistory.placement_id)
        .filter(PipelinePlacement.job_id.in_(job_ids))
        .order_by(StageHistory.placement_id, StageHistory.moved_at)
        .all()
    )

    by_placement: dict[uuid.UUID, list[tuple[uuid.UUID, datetime, bool]]] = defaultdict(list)
    for job_id, placement_id, moved_at, is_terminal in history_rows:
        by_placement[placement_id].append((job_id, moved_at, is_terminal))

    stage_days_by_job: dict[uuid.UUID, list[float]] = defaultdict(list)
    reached_terminal_by_job: dict[uuid.UUID, int] = defaultdict(int)

    for entries in by_placement.values():
        job_id = entries[0][0]
        for i in range(len(entries) - 1):
            _, moved_at, _ = entries[i]
            _, next_moved_at, _ = entries[i + 1]
            stage_days_by_job[job_id].append((next_moved_at - moved_at).total_seconds() / 86400)
        if any(is_terminal for _, _, is_terminal in entries):
            reached_terminal_by_job[job_id] += 1

    now = datetime.now(timezone.utc)
    breakdown: list[JobPipelineMetrics] = []
    for job in jobs:
        days = stage_days_by_job.get(job.id, [])
        placement_count = candidate_counts.get(job.id, 0)
        reached = reached_terminal_by_job.get(job.id, 0)
        breakdown.append(
            JobPipelineMetrics(
                job_id=job.id,
                job_title=job.title,
                status=job.status.value,
                headcount=job.headcount,
                candidate_count=placement_count,
                job_age_days=(now - job.created_at).days,
                avg_stage_days=round(sum(days) / len(days), 1) if days else None,
                min_stage_days=round(min(days), 1) if days else None,
                max_stage_days=round(max(days), 1) if days else None,
                conversion_rate=round(reached / placement_count, 2) if placement_count else None,
            )
        )
    return breakdown


def _conversion_metrics(
    db: Session,
    tenant_id: uuid.UUID,
    owner_recruiter_id: uuid.UUID | None = None,
    team_id: uuid.UUID | None = None,
) -> dict:
    # stage_history is append-only and covers every move ever made (see
    # app/models/placement.py) — this reads straight off it rather than
    # adding a new table. Grouped in Python, not SQL, since "duration
    # between this row and the next row for the same placement" isn't a
    # simple aggregate.
    q = (
        db.query(
            StageHistory.placement_id,
            StageHistory.stage_label_snapshot,
            StageHistory.moved_at,
            JobStage.is_terminal_success,
        )
        .join(JobStage, JobStage.id == StageHistory.to_stage_id)
        .join(PipelinePlacement, PipelinePlacement.id == StageHistory.placement_id)
        .filter(StageHistory.tenant_id == tenant_id)
    )
    if owner_recruiter_id is not None:
        q = q.join(Job, Job.id == PipelinePlacement.job_id).filter(Job.owner_recruiter_id == owner_recruiter_id)
    elif team_id is not None:
        q = (
            q.join(Job, Job.id == PipelinePlacement.job_id)
            .join(User, User.id == Job.owner_recruiter_id)
            .filter(User.team_id == team_id)
        )
    rows = q.order_by(StageHistory.placement_id, StageHistory.moved_at).all()

    by_placement: dict[uuid.UUID, list[tuple[str, datetime, bool]]] = defaultdict(list)
    for placement_id, label, moved_at, is_terminal in rows:
        by_placement[placement_id].append((label, moved_at, is_terminal))

    stage_durations: dict[str, list[float]] = defaultdict(list)
    time_to_hire: list[float] = []

    for entries in by_placement.values():
        for i in range(len(entries) - 1):
            label, moved_at, _ = entries[i]
            _, next_moved_at, _ = entries[i + 1]
            stage_durations[label].append((next_moved_at - moved_at).total_seconds() / 86400)
        first_moved_at = entries[0][1]
        for _, moved_at, is_terminal in entries:
            if is_terminal:
                time_to_hire.append((moved_at - first_moved_at).total_seconds() / 86400)
                break

    stage_conversion = [
        StageConversionPoint(
            stage_name=name,
            avg_days=round(sum(vals) / len(vals), 1),
            min_days=round(min(vals), 1),
            max_days=round(max(vals), 1),
            count=len(vals),
        )
        for name, vals in stage_durations.items()
    ]

    return {
        "time_to_hire_avg_days": round(sum(time_to_hire) / len(time_to_hire), 1) if time_to_hire else None,
        "time_to_hire_min_days": round(min(time_to_hire), 1) if time_to_hire else None,
        "time_to_hire_max_days": round(max(time_to_hire), 1) if time_to_hire else None,
        "stage_conversion": stage_conversion,
    }


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

    tenant_id = uuid.UUID(current_user.tenant_id)
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    preferred_currency = tenant.preferred_currency if tenant else UNTAGGED_CURRENCY_FALLBACK

    placement_value = _placement_value_metrics(db, preferred_currency, owner_recruiter_id=my_id)
    opportunity = _opportunity_metrics(db, tenant_id, preferred_currency, owner_recruiter_id=my_id)
    pipeline_breakdown = _pipeline_breakdown(db, tenant_id, owner_recruiter_id=my_id)
    conversion = _conversion_metrics(db, tenant_id, owner_recruiter_id=my_id)

    return RecruiterMetrics(
        open_jobs=open_jobs,
        total_candidates=total_candidates,
        stage_funnel=stage_funnel,
        active_offers=active_offers,
        placement_value=placement_value,
        opportunity=opportunity,
        pipeline_breakdown=pipeline_breakdown,
        **conversion,
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

    tenant_id = uuid.UUID(current_user.tenant_id)
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    preferred_currency = tenant.preferred_currency if tenant else UNTAGGED_CURRENCY_FALLBACK

    placement_value = _placement_value_metrics(db, preferred_currency, team_id=team_id)
    opportunity = _opportunity_metrics(db, tenant_id, preferred_currency, team_id=team_id)
    pipeline_breakdown = _pipeline_breakdown(db, tenant_id, team_id=team_id)
    conversion = _conversion_metrics(db, tenant_id, team_id=team_id)

    return OrgMetrics(
        jobs_by_status=jobs_by_status,
        recruiter_workload=recruiter_workload,
        jobs_open_30_60_90=buckets,
        placement_value=placement_value,
        opportunity=opportunity,
        pipeline_breakdown=pipeline_breakdown,
        **conversion,
    )


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
    recruiter_ids = [r.id for r in recruiters]

    team_names = {t.id: t.name for t in db.query(Team).all()}

    # Batched instead of 5 queries per recruiter (was a documented N+1 —
    # see docs/08-open-questions-and-gaps.md) — one grouped query per
    # metric, scoped to exactly this page's recruiter_ids, then bucketed
    # in Python. Constant query count regardless of team size.
    job_counts: dict[tuple[uuid.UUID, JobStatus], int] = {}
    if recruiter_ids:
        for owner_id, job_status, count in (
            db.query(Job.owner_recruiter_id, Job.status, func.count(Job.id))
            .filter(Job.owner_recruiter_id.in_(recruiter_ids), Job.deleted_at.is_(None))
            .group_by(Job.owner_recruiter_id, Job.status)
            .all()
        ):
            job_counts[(owner_id, job_status)] = count

    active_candidates_by_recruiter: dict[uuid.UUID, int] = {}
    offers_by_recruiter: dict[uuid.UUID, int] = {}
    if recruiter_ids:
        active_candidates_by_recruiter = dict(
            db.query(Job.owner_recruiter_id, func.count(PipelinePlacement.id))
            .join(Job, Job.id == PipelinePlacement.job_id)
            .filter(Job.owner_recruiter_id.in_(recruiter_ids), PipelinePlacement.status == PlacementStatus.active)
            .group_by(Job.owner_recruiter_id)
            .all()
        )
        offers_by_recruiter = dict(
            db.query(Job.owner_recruiter_id, func.count(PipelinePlacement.id))
            .join(JobStage, JobStage.id == PipelinePlacement.current_stage_id)
            .join(Job, Job.id == PipelinePlacement.job_id)
            .filter(
                Job.owner_recruiter_id.in_(recruiter_ids),
                JobStage.is_terminal_success.is_(True),
                PipelinePlacement.status == PlacementStatus.active,
            )
            .group_by(Job.owner_recruiter_id)
            .all()
        )

    points: list[RecruiterPerformancePoint] = []
    for recruiter in recruiters:
        points.append(
            RecruiterPerformancePoint(
                recruiter_id=str(recruiter.id),
                recruiter_name=recruiter.full_name,
                team_name=team_names.get(recruiter.team_id) if recruiter.team_id else None,
                open_jobs=job_counts.get((recruiter.id, JobStatus.open), 0),
                active_candidates=active_candidates_by_recruiter.get(recruiter.id, 0),
                offers=offers_by_recruiter.get(recruiter.id, 0),
                won_jobs=job_counts.get((recruiter.id, JobStatus.won), 0),
                lost_jobs=job_counts.get((recruiter.id, JobStatus.lost), 0),
            )
        )
    return points


_PLATFORM_METRICS_CACHE_KEY = "metrics:platform"
_PLATFORM_METRICS_CACHE_TTL_SECONDS = 60


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
    #
    # Not tenant-scoped (superadmin-only, platform-wide by definition), so
    # one shared cache key is correct — no risk of leaking one tenant's
    # numbers into another's cached response. A short TTL trades a minute
    # of staleness for not re-running 4 queries on every dashboard poll;
    # cache.get_json/set_json are no-ops if Redis isn't running, so this
    # degrades to the original always-live behavior with no code path
    # change needed.
    cached = cache.get_json(_PLATFORM_METRICS_CACHE_KEY)
    if cached is not None:
        return PlatformMetrics(**cached)

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
        result = PlatformMetrics(
            active_org_tenants=active_org_tenants,
            freelance_org_members=freelance_org_members,
            total_recruiters=total_recruiters,
            freelance_queue_depth=freelance_queue_depth,
        )
        cache.set_json(_PLATFORM_METRICS_CACHE_KEY, result.model_dump(), _PLATFORM_METRICS_CACHE_TTL_SECONDS)
        return result
