import uuid

from pydantic import BaseModel


class StageFunnelPoint(BaseModel):
    stage_name: str
    count: int


class StageConversionPoint(BaseModel):
    # Time spent IN this stage before the placement moved on to whatever
    # came next — attributed to the stage being left, not the one entered.
    # Computed from stage_history (app/models/placement.py), which is
    # append-only, so this reflects every move ever made, not just active
    # placements. See docs/05.
    stage_name: str
    avg_days: float
    min_days: float
    max_days: float
    count: int


class PlacementValueByCurrency(BaseModel):
    currency: str
    total: int


class PlacementValueMetrics(BaseModel):
    # One bucket per distinct currency actually in use — never summed
    # across currencies as raw numbers (that was last session's
    # simplification, and it was wrong). total_in_preferred_currency is
    # None when live conversion isn't available (see app/services/forex.py)
    # rather than silently showing a wrong or partial number.
    by_currency: list[PlacementValueByCurrency]
    preferred_currency: str
    total_in_preferred_currency: float | None = None


class OpportunityMetrics(BaseModel):
    # Advertised value (salary midpoint x headcount) of jobs still open —
    # what could still be earned — versus jobs marked lost — what never
    # was. Not adjusted for partial fills on multi-headcount jobs, and
    # only counts jobs with a salary set at all — see docs/05.
    potential_unrealized: PlacementValueMetrics
    opportunity_lost: PlacementValueMetrics


class JobPipelineMetrics(BaseModel):
    # One row per job ("pipeline" — every job gets its own, see docs/03).
    # Supersedes the old jobs_open_30_60_90 bucket count: this shows every
    # job's actual age rather than three unlabeled counts, plus how fast
    # candidates move through it and how often it converts.
    job_id: uuid.UUID
    job_title: str
    status: str
    headcount: int
    candidate_count: int
    job_age_days: int
    avg_stage_days: float | None
    min_stage_days: float | None
    max_stage_days: float | None
    # Fraction (0-1) of this job's placements that ever reached the
    # is_terminal_success (Signed) stage. None if the job has no
    # placements yet, not zero.
    conversion_rate: float | None


class RecruiterMetrics(BaseModel):
    open_jobs: int
    total_candidates: int
    stage_funnel: list[StageFunnelPoint]
    active_offers: int
    placement_value: PlacementValueMetrics
    opportunity: OpportunityMetrics
    # Days from a placement's first stage_history entry to the one that
    # first landed it in an is_terminal_success stage (Signed) — only
    # counted for placements that actually got there. None means no
    # placement has reached Signed yet, not zero days.
    time_to_hire_avg_days: float | None = None
    time_to_hire_min_days: float | None = None
    time_to_hire_max_days: float | None = None
    stage_conversion: list[StageConversionPoint] = []
    pipeline_breakdown: list[JobPipelineMetrics] = []


class JobsByStatusPoint(BaseModel):
    status: str
    count: int


class RecruiterWorkloadPoint(BaseModel):
    recruiter_name: str
    open_jobs: int


class OrgMetrics(BaseModel):
    jobs_by_status: list[JobsByStatusPoint]
    recruiter_workload: list[RecruiterWorkloadPoint]
    jobs_open_30_60_90: dict[str, int]
    placement_value: PlacementValueMetrics
    opportunity: OpportunityMetrics
    time_to_hire_avg_days: float | None = None
    time_to_hire_min_days: float | None = None
    time_to_hire_max_days: float | None = None
    stage_conversion: list[StageConversionPoint] = []
    pipeline_breakdown: list[JobPipelineMetrics] = []


class RecruiterPerformancePoint(BaseModel):
    recruiter_id: str
    recruiter_name: str
    team_name: str | None
    open_jobs: int
    active_candidates: int
    offers: int
    won_jobs: int
    lost_jobs: int


class PlatformMetrics(BaseModel):
    active_org_tenants: int
    freelance_org_members: int
    total_recruiters: int
    freelance_queue_depth: int
