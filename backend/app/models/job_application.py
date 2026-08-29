import enum
import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

MAX_FREELANCE_SCREENING_QUESTIONS = 4


class ScreeningQuestionType(str, enum.Enum):
    text = "text"
    number = "number"
    boolean = "boolean"


class JobScreeningQuestion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Up to 4 for freelance recruiters, unlimited for Org — enforced in
    the API layer, not the schema. See docs/10.

    Added 2026-08-27: not every question needs to gate eligibility (a
    free-text "why do you want this role?" question has no right answer),
    and not every gating question is a text match ("years of React
    experience" needs a minimum threshold, not exact string equality).
    `required=False` means the answer is collected but never affects
    `JobApplication.eligible`. `expected_answer`/`min_value` are
    therefore both nullable now (only one is meaningful, depending on
    question_type, and neither is used at all when required=False) — see
    ScreeningQuestionCreate's validator for what combination is actually
    enforced at creation time."""

    __tablename__ = "job_screening_questions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[ScreeningQuestionType] = mapped_column(
        Enum(ScreeningQuestionType, name="screening_question_type"), nullable=False, default=ScreeningQuestionType.text
    )
    expected_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    min_value: Mapped[int | None] = mapped_column(Integer, nullable=True)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
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
