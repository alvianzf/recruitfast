import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PublicJobSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    title: str
    overview: str | None
    applicant_count: int
    work_mode: str | None
    location: str | None
    seniority: str | None
    job_type: str | None
    salary_min: int | None
    salary_max: int | None
    salary_currency: str | None
    created_at: datetime
    # Only populated on the all-jobs board (org-specific boards already
    # know their own org from the top-level org_name) — see docs/10.
    org_name: str | None = None
    org_logo_url: str | None = None
    # Always populated (unlike org_name/org_logo_url above) — lets the
    # org name/logo on a job card link back to that org's own board even
    # from the all-jobs board. /jobs for the Freelance Org, /jobs/{slug}
    # for an Org tenant. Same value PublicJobDetail.board_path carries.
    board_path: str | None = None


class PublicBoardResponse(BaseModel):
    org_name: str
    # Org profile fields — null for the Freelance Org, which has no
    # org profile to show. See app/api/routers/org.py.
    org_logo_url: str | None = None
    org_description: str | None = None
    org_office_location: str | None = None
    org_contact_email: str | None = None
    jobs: list[PublicJobSummary]


class PublicScreeningQuestionOut(BaseModel):
    # Deliberately no expected_answer/min_value — the actual pass
    # criteria never ships to the public form. question_type/required
    # only drive how the form renders the input (text vs number field,
    # asterisk for required) and client-side validation, not the real
    # eligibility check (that's always re-evaluated server-side).
    id: uuid.UUID
    question_text: str
    question_type: str
    required: bool
    position: int


class PublicJobDetail(BaseModel):
    id: uuid.UUID
    title: str
    overview: str | None
    description: str | None
    is_technical_role: bool
    applicant_count: int
    work_mode: str | None
    location: str | None
    seniority: str | None
    job_type: str | None
    salary_min: int | None
    salary_max: int | None
    salary_currency: str | None
    screening_questions: list[PublicScreeningQuestionOut]
    # Who's hiring — the recruiter who owns the job, and (for an Org
    # tenant, not the Freelance Org) that org's name/logo. See docs/10.
    posted_by_name: str
    org_name: str | None
    org_logo_url: str | None
    created_at: datetime
    # Frontend route back to the board this job came from — /jobs for
    # the all-jobs board, /jobs/{slug} for an Org tenant. Lets the
    # post-apply "browse other jobs" link go back to the right board
    # instead of guessing.
    board_path: str


class ApplyResponse(BaseModel):
    eligible: bool
    message: str
