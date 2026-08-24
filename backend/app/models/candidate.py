import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import CITEXT, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Candidate(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "candidates"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str | None] = mapped_column(CITEXT, nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    source: Mapped[str | None] = mapped_column(String, nullable=True)
    blacklisted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    blacklist_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    dedup_fingerprint: Mapped[str | None] = mapped_column(String, nullable=True, index=True)


class ParseStatus(str, enum.Enum):
    pending = "pending"
    needs_review = "needs_review"
    confirmed = "confirmed"
    failed = "failed"


class CandidateDocument(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A versioned CV upload for a candidate, optionally tied to a job.

    Reapplication to the same job creates a new row here (new version),
    never a second pipeline_placements row — see docs/03.
    """

    __tablename__ = "candidate_documents"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    candidate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False)
    job_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=True)
    file_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    version_no: Mapped[int] = mapped_column(Integer, nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    parsed_fields: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    parse_confidence: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    parse_status: Mapped[ParseStatus] = mapped_column(
        Enum(ParseStatus, name="parse_status"), nullable=False, default=ParseStatus.pending
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
