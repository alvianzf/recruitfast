import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import UUIDPrimaryKeyMixin


class JobView(UUIDPrimaryKeyMixin, Base):
    """One row per (job, unique visitor). visitor_hash is a salted hash
    of the requester's IP — never the raw IP — so a repeat visit from the
    same person doesn't inflate the count (unique constraint below) and
    no raw IP address is retained. Powers the unique-visitor count on the
    internal Jobs table. See docs/10."""

    __tablename__ = "job_views"
    __table_args__ = (UniqueConstraint("job_id", "visitor_hash", name="uq_job_view_visitor"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    visitor_hash: Mapped[str] = mapped_column(String, nullable=False)
    viewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
