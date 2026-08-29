import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text, func, select, union
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, column_property, mapped_column

from app.core.database import Base
from app.models.candidate import Candidate
from app.models.client import Client
from app.models.job_application import JobApplication
from app.models.job_view import JobView
from app.models.mixins import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.placement import PipelinePlacement
from app.models.team import Team


class JobStatus(str, enum.Enum):
    open = "open"
    on_hold = "on_hold"
    won = "won"  # successfully closed with a hire — was "filled"
    lost = "lost"  # requisition fell through — was "cancelled"


class JobVisibility(str, enum.Enum):
    public = "public"
    unlisted = "unlisted"


class WorkMode(str, enum.Enum):
    remote = "remote"
    onsite = "onsite"
    hybrid = "hybrid"


class Seniority(str, enum.Enum):
    entry = "entry"
    mid = "mid"
    senior = "senior"
    lead = "lead"
    executive = "executive"


class JobType(str, enum.Enum):
    full_time = "full_time"
    part_time = "part_time"
    contract = "contract"
    internship = "internship"
    temporary = "temporary"


class Job(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "jobs"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    # A job is owned by at most one of: a specific recruiter
    # (owner_recruiter_id), a team (team_id — any recruiter on that team
    # can self-claim it), or neither (fully open — any org recruiter can
    # self-claim it). Never both owner_recruiter_id and team_id at once;
    # assigning one clears the other. See app/api/routers/jobs.py.
    owner_recruiter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    team_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    # Public URL identifier — {slugify(title)}-{5 random chars}, always
    # suffixed (not just on collision) so the public apply link never
    # exposes the internal UUID. See app/services/slugs.py, docs/10.
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    overview: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    jd_file_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True
    )
    custom_fields: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Number of hires this job needs. When the count of active placements
    # sitting in an is_terminal_success stage reaches this, the job
    # auto-closes to won — see pipeline.py's move_placement.
    headcount: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus, name="job_status"), nullable=False, default=JobStatus.open)
    # Public board listing vs. link-only — see docs/10-job-board-and-applications.md.
    visibility: Mapped[JobVisibility] = mapped_column(
        Enum(JobVisibility, name="job_visibility"), nullable=False, default=JobVisibility.public
    )
    # Gates whether the GitHub URL default application question is shown.
    is_technical_role: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Null = not specified. Drives the public job board's work-mode filter.
    work_mode: Mapped[WorkMode | None] = mapped_column(Enum(WorkMode, name="work_mode"), nullable=True)
    # Free-text city/region — most meaningful for onsite/hybrid, but not
    # restricted to those (e.g. "Remote (US)" is a reasonable value too).
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    # Null = not specified, same convention as work_mode/location — drives
    # the public job board's seniority/job-type filters.
    seniority: Mapped[Seniority | None] = mapped_column(Enum(Seniority, name="seniority"), nullable=True)
    job_type: Mapped[JobType | None] = mapped_column(Enum(JobType, name="job_type"), nullable=True)
    # Optional. salary_max = null means a fixed figure (salary_min alone);
    # both set means a range. Neither set means "not disclosed" — no
    # separate type enum needed, presence of salary_max is the signal.
    salary_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    salary_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    salary_currency: Mapped[str | None] = mapped_column(String, nullable=True)
    # When true, salary_min/max/currency are still visible internally
    # (recruiter/org_admin) but never serialized on any /public/* response
    # — a server-side gate, not a client-side hide. See public_board.py.
    salary_confidential: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    pipeline_template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pipeline_templates.id"), nullable=True
    )
    # Org-only, optional — which of the org's own clients this job is
    # being worked on behalf of. Always null for Freelance Org jobs (no
    # client roster there). See app/models/client.py.
    client_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True)


# Added post-class (not deferred) so it rides along in the same SELECT
# whenever a Job is queried, rather than firing an extra query per row —
# JobOut serializes a whole list of jobs at once (see app/api/routers/
# jobs.py's list_jobs), where a deferred column_property would N+1.
Job.unique_visitor_count = column_property(
    select(func.count(JobView.id)).where(JobView.job_id == Job.id).correlate_except(JobView).scalar_subquery()
)
# Distinct candidates linked to this job by ANY means — a public
# application (job_applications) OR a direct pipeline attach
# (pipeline_placements: Attach Candidate, Find Candidates, Open Profiles,
# CV upload's own attach flow, mark-eligible's auto-placement) — not just
# public applicants. Originally only counted job_applications, so
# manually-attached candidates never moved the number at all (bug found
# 2026-08-27: "attach from Candidate list doesn't increment the count").
# Union (not UNION ALL) so a candidate who both applied AND was placed
# (mark_eligible creates the placement from the application) is counted
# once, not twice. Both halves filter out soft-deleted candidates so
# deleting one actually decrements the count — the same class of gap as
# the Kanban "deleted candidate stuck on the board" bug, see docs/02.
_applicant_placement_candidates = (
    select(PipelinePlacement.candidate_id.label("candidate_id"), PipelinePlacement.job_id.label("job_id"))
    .join(Candidate, Candidate.id == PipelinePlacement.candidate_id)
    .where(Candidate.deleted_at.is_(None))
)
_applicant_application_candidates = (
    select(JobApplication.candidate_id.label("candidate_id"), JobApplication.job_id.label("job_id"))
    .join(Candidate, Candidate.id == JobApplication.candidate_id)
    .where(Candidate.deleted_at.is_(None))
)
_applicant_candidates = union(_applicant_placement_candidates, _applicant_application_candidates).subquery()

Job.applicant_count = column_property(
    select(func.count(func.distinct(_applicant_candidates.c.candidate_id)))
    .where(_applicant_candidates.c.job_id == Job.id)
    .correlate_except(_applicant_candidates)
    .scalar_subquery()
)
Job.client_name = column_property(
    select(Client.name).where(Client.id == Job.client_id).correlate_except(Client).scalar_subquery()
)
Job.team_name = column_property(
    select(Team.name).where(Team.id == Job.team_id).correlate_except(Team).scalar_subquery()
)
