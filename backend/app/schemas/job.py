import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class JobCreate(BaseModel):
    title: str
    overview: str | None = None
    description: str | None = None
    headcount: int = Field(default=1, ge=1)
    work_mode: str | None = None
    location: str | None = None
    seniority: str | None = None
    job_type: str | None = None
    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)
    salary_currency: str | None = None
    salary_confidential: bool = False
    # Org-only, optional — assigns the job to a whole team at creation
    # (any recruiter on that team can self-claim it) instead of leaving
    # it fully open to the org. An org_admin never becomes the job's
    # owner_recruiter_id — see docs/01 "admins don't do recruiter work".
    # Assigning to one specific recruiter is a separate step, via
    # POST /jobs/{id}/assign, same as before.
    team_id: uuid.UUID | None = None
    # Org-only, optional — which client this job is being worked on
    # behalf of. Always ignored/null for Freelance Org jobs.
    client_id: uuid.UUID | None = None


class JobUpdate(BaseModel):
    title: str | None = None
    overview: str | None = None
    description: str | None = None
    headcount: int | None = Field(default=None, ge=1)
    work_mode: str | None = None
    location: str | None = None
    seniority: str | None = None
    job_type: str | None = None
    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)
    salary_currency: str | None = None
    salary_confidential: bool | None = None
    # Manual close/reopen — recruiters can set this regardless of
    # headcount; auto-close (move_placement) sets it to "won" the same way.
    status: str | None = None
    client_id: uuid.UUID | None = None
    clear_client: bool = False  # PATCH can't otherwise distinguish "unset" from "leave as-is"


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    title: str
    overview: str | None
    description: str | None
    headcount: int
    work_mode: str | None
    location: str | None
    seniority: str | None
    job_type: str | None
    salary_min: int | None
    salary_max: int | None
    salary_currency: str | None
    salary_confidential: bool
    status: str
    owner_recruiter_id: uuid.UUID | None
    team_id: uuid.UUID | None
    team_name: str | None = None
    created_at: datetime
    unique_visitor_count: int
    applicant_count: int
    client_id: uuid.UUID | None
    client_name: str | None = None


class AssignJobRequest(BaseModel):
    # Exactly one of the two — a job is owned by a specific recruiter or
    # by a team, never both. Providing neither/both is a 422.
    recruiter_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _exactly_one_target(self) -> "AssignJobRequest":
        if (self.recruiter_id is None) == (self.team_id is None):
            raise ValueError("Provide exactly one of recruiter_id or team_id")
        return self
