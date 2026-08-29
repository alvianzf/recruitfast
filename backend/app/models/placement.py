import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class PlacementStatus(str, enum.Enum):
    active = "active"
    rejected = "rejected"
    withdrawn = "withdrawn"


class PipelinePlacement(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A candidate's position in one job's pipeline.

    One row per (candidate, job) — a candidate attached to N jobs has N
    placements, each moved independently. See docs/03.
    """

    __tablename__ = "pipeline_placements"
    __table_args__ = (UniqueConstraint("candidate_id", "job_id", name="uq_placement_candidate_job"),)

    # Denormalized from jobs.tenant_id so RLS can filter this table
    # directly (see docs/02 RLS model) without a join-based policy.
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    candidate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    current_stage_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("job_stages.id"), nullable=False)
    status: Mapped[PlacementStatus] = mapped_column(
        Enum(PlacementStatus, name="placement_status"), nullable=False, default=PlacementStatus.active
    )
    status_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    moved_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    # Captured when the recruiter is prompted after this placement fills
    # a job (headcount auto-close or manual "mark Won") — the actual
    # negotiated outcome, distinct from the job's advertised salary
    # range. Drives the dashboard's placement-value figure. See docs/05.
    starting_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    offer_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    offer_rate_currency: Mapped[str | None] = mapped_column(String, nullable=True)


class StageHistory(UUIDPrimaryKeyMixin, Base):
    """Immutable, append-only. References stage IDs with a label snapshot
    so a later stage rename never rewrites past history."""

    __tablename__ = "stage_history"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    placement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pipeline_placements.id"), nullable=False
    )
    from_stage_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("job_stages.id"), nullable=True)
    to_stage_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("job_stages.id"), nullable=False)
    stage_label_snapshot: Mapped[str] = mapped_column(String, nullable=False)
    moved_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    moved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    was_admin_override: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
