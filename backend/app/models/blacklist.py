import uuid

from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import CITEXT, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class EmailBlacklistEntry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Platform-wide blacklist-by-email registry.

    Deliberately NOT tenant-scoped or RLS-protected — the whole point is
    that a recruiter in one tenant sees an email another tenant flagged.
    `tenant_id` is kept for audit only and is never exposed via the API;
    the check endpoint returns just reason + date. See docs/01.
    """

    __tablename__ = "email_blacklist_entries"

    email: Mapped[str] = mapped_column(CITEXT, nullable=False, index=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
