import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

DEFAULT_STAGE_NAMES = [
    "Sourced",
    "CV Shortlist",
    "Contacted",
    "First Cut",
    "User Interview",
    "Offer",
    "Signed",
    "Reject",
]


class PipelineTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "pipeline_templates"

    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String, nullable=False, default="Default Hiring Pipeline")


class PipelineTemplateStage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "pipeline_template_stages"

    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pipeline_templates.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    is_terminal_reject: Mapped[bool] = mapped_column(Boolean, default=False)
    is_terminal_success: Mapped[bool] = mapped_column(Boolean, default=False)


class JobStage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A job's own pipeline — cloned from a template at job creation."""

    __tablename__ = "job_stages"

    # Denormalized from jobs.tenant_id so RLS can filter this table
    # directly (see docs/02 RLS model) without a join-based policy.
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    is_terminal_reject: Mapped[bool] = mapped_column(Boolean, default=False)
    is_terminal_success: Mapped[bool] = mapped_column(Boolean, default=False)
