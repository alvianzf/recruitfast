import enum
import uuid

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class TenantType(str, enum.Enum):
    org = "org"
    freelance_org = "freelance_org"


class TenantStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"


class Tenant(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tenants"

    type: Mapped[TenantType] = mapped_column(Enum(TenantType, name="tenant_type"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # Public job board identifier — {base_url}/careers/{slug}. Null for
    # the Freelance Org (fixed /careers/public route instead). See docs/10.
    slug: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    status: Mapped[TenantStatus] = mapped_column(
        Enum(TenantStatus, name="tenant_status"), nullable=False, default=TenantStatus.active
    )
    plan_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plans.id"), nullable=True
    )
