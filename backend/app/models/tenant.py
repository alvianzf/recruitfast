import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
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
    # Public career page profile — org_admin-editable, shown on the org's
    # /jobs/{slug} board. See app/api/routers/org.py, docs/10.
    logo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    office_location: Mapped[str | None] = mapped_column(String, nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String, nullable=True)
    # Drives the converted placement-value total on the dashboard (see
    # app/api/routers/metrics.py, app/services/forex.py) — placements can
    # carry an offer_rate in any currency, so a single org-level
    # preference is what "the" total is expressed in.
    preferred_currency: Mapped[str] = mapped_column(String, nullable=False, default="IDR")
    # Superadmin-set cap on active *recruiter*-role users in this org
    # tenant — org_admin seats are separate and never counted against it
    # (an org can register more than one admin; that's not gated by this
    # field). Mirrors /pricing's "1 admin seat + 3 recruiter seats"
    # Organization tier (added 2026-08-26) without wiring the still-unused
    # plans/subscriptions billing tables — see
    # docs/07-tech-stack.md#billing. Default 3. Null means unlimited — the
    # Custom tier, or any org a superadmin wants to exempt entirely.
    # Always null/unused for the Freelance Org tenant.
    max_recruiter_seats: Mapped[int | None] = mapped_column(Integer, nullable=True, default=3)
