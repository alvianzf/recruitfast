import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class OrganizationCreate(BaseModel):
    name: str
    admin_full_name: str
    admin_email: EmailStr
    admin_password: str = Field(min_length=8)


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str | None
    status: str
    created_at: datetime
    # org_admin seats are a separate, uncapped concept — this is
    # recruiter-role seats only. See app/services/seats.py.
    max_recruiter_seats: int | None
    active_recruiter_seat_count: int = 0


class OrgSeatsUpdate(BaseModel):
    # Explicit, not Optional-with-default: the caller always states intent
    # — a number, or null for unlimited (the Custom /pricing tier) — there
    # is no "leave as-is" case for a single-field endpoint like this one.
    max_recruiter_seats: int | None = Field(default=None, ge=1)


class OrgAdminCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(min_length=8)


class SuperadminCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(min_length=8)


class AdminUserOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    role: str
    status: str
    tenant_id: uuid.UUID | None
    tenant_name: str | None
    created_at: datetime


class UserStatusUpdate(BaseModel):
    # Deliberately status-only — role changes aren't exposed here, so
    # there's no field on this schema a caller could use to self-promote
    # even if the require_role("superadmin") gate were ever misconfigured.
    status: str
