import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class JobStatus(str, enum.Enum):
    open = "open"
    on_hold = "on_hold"
    filled = "filled"
    cancelled = "cancelled"


class JobVisibility(str, enum.Enum):
    public = "public"
    unlisted = "unlisted"


class Job(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "jobs"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    owner_recruiter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    overview: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    jd_file_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True
    )
    custom_fields: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus, name="job_status"), nullable=False, default=JobStatus.open)
    # Public board listing vs. link-only — see docs/10-job-board-and-applications.md.
    visibility: Mapped[JobVisibility] = mapped_column(
        Enum(JobVisibility, name="job_visibility"), nullable=False, default=JobVisibility.public
    )
    # Gates whether the GitHub URL default application question is shown.
    is_technical_role: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    pipeline_template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pipeline_templates.id"), nullable=True
    )
