import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class AuditLogPlatform(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Superadmin-visible tier: tenant/user provisioning, billing, auth,
    Assisted Access grants. Never joins into recruiter content — see
    docs/01 for why this must be a separate table, not a filtered view."""

    __tablename__ = "audit_log_platform"

    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String, nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class AuditLogOrg(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Org Admin/recruiter-visible tier, scoped by tenant_id + RLS: job/
    candidate CRUD, stage moves, admin overrides, note edits."""

    __tablename__ = "audit_log_org"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String, nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
