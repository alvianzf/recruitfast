import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class FreelanceApplicationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class FreelanceApplication(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "freelance_applications"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    linkedin_url: Mapped[str | None] = mapped_column(String, nullable=True)
    years_experience: Mapped[int | None] = mapped_column(Integer, nullable=True)
    specialization: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[FreelanceApplicationStatus] = mapped_column(
        Enum(FreelanceApplicationStatus, name="freelance_application_status"),
        nullable=False,
        default=FreelanceApplicationStatus.pending,
    )
    decided_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
