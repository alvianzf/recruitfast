from pydantic import BaseModel


class StageFunnelPoint(BaseModel):
    stage_name: str
    count: int


class RecruiterMetrics(BaseModel):
    open_jobs: int
    total_candidates: int
    stage_funnel: list[StageFunnelPoint]
    active_offers: int


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


class PlatformMetrics(BaseModel):
    active_org_tenants: int
    freelance_org_members: int
    total_recruiters: int
    freelance_queue_depth: int
