"""Org recruiter-seat-limit check — used by org.py when an org_admin
invites a recruiter. org_admin seats are a separate concept and are
never counted against this limit or gated by it.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.tenant import Tenant
from app.models.user import User, UserRole, UserStatus


def active_recruiter_seat_count(db: Session, tenant_id: uuid.UUID) -> int:
    return (
        db.query(func.count(User.id))
        .filter(
            User.tenant_id == tenant_id,
            User.role == UserRole.recruiter,
            User.status == UserStatus.active,
            User.deleted_at.is_(None),
        )
        .scalar()
        or 0
    )


def check_recruiter_seat_available(db: Session, tenant: Tenant) -> None:
    """Raises 400 if `tenant` has no room for another active recruiter.
    tenant.max_recruiter_seats = None means unlimited (the Custom
    /pricing tier, or any org a superadmin exempts) — never checked."""
    if tenant.max_recruiter_seats is None:
        return
    if active_recruiter_seat_count(db, tenant.id) >= tenant.max_recruiter_seats:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"{tenant.name} is at its recruiter seat limit ({tenant.max_recruiter_seats}). "
            "A superadmin needs to raise it before inviting another recruiter.",
        )
