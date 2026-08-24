import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

MAX_FREELANCE_SCREENING_QUESTIONS = 4


class JobScreeningQuestion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Up to 4 for freelance recruiters, unlimited for Org — enforced in
    the API layer, not the schema. See docs/10."""

    __tablename__ = "job_screening_questions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    expected_answer: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)


class JobApplication(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A public application to a job — see docs/10. `answers` mirrors
    JobScreeningQuestion at submit time (question text/expected answer
    snapshotted, same immutability rationale as stage_history's label
    snapshot: a later question edit shouldn't rewrite past applications)."""

    __tablename__ = "job_applications"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    candidate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=False)
    cover_letter: Mapped[str | None] = mapped_column(Text, nullable=True)
    answers: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    eligible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    placement_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pipeline_placements.id"), nullable=True
    )
