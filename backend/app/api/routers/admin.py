import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_db, require_role
from app.core.database import raw_session
from app.core.security import hash_password
from app.models.freelance import FreelanceApplication
from app.models.tenant import Tenant, TenantType
from app.models.user import User, UserRole, UserStatus
from app.schemas.admin import (
    AdminUserOut,
    OrgAdminCreate,
    OrganizationCreate,
    OrganizationOut,
    OrgSeatsUpdate,
    SuperadminCreate,
    UserStatusUpdate,
)
from app.schemas.freelance import FreelanceApplicationOut
from app.services.seats import active_recruiter_seat_count
from app.services.slugs import generate_unique_slug

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/freelance-applications", response_model=list[FreelanceApplicationOut])
def list_freelance_applications(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("superadmin")),
) -> list[FreelanceApplicationOut]:
    # users/freelance_applications aren't RLS-protected — this is
    # pre-tenant account metadata, the one recruiter-adjacent thing a
    # Superadmin is allowed to see (docs/01). Everything else on this
    # session's RLS context is still locked out.
    #
    # Registration grants immediate access — there's no approval gate to
    # queue against, so this lists every registration (most recent first)
    # for visibility only. Deactivating a bad-faith account is done via
    # the generic PATCH /admin/users/{id}/status, same as any other user.
    rows = (
        db.query(FreelanceApplication, User)
        .join(User, User.id == FreelanceApplication.user_id)
        .order_by(FreelanceApplication.created_at.desc())
        .all()
    )
    return [
        FreelanceApplicationOut(
            id=app.id,
            full_name=user.full_name,
            email=user.email,
            linkedin_url=app.linkedin_url,
            years_experience=app.years_experience,
            specialization=app.specialization,
            notes=app.notes,
            status=app.status.value,
            created_at=app.created_at,
        )
        for app, user in rows
    ]


# --- Organization / user management ---------------------------------------
#
# Every endpoint below is gated by require_role("superadmin"), which reads
# current_user.role off the *decoded, signature-verified* JWT (see
# app/api/deps.py) — never off a client-supplied field. None of the create
# payloads below (OrganizationCreate, OrgAdminCreate, SuperadminCreate)
# accept a role at all; the role assigned to each new user is hardcoded at
# the call site to match the endpoint's own name. So there's no request
# body a non-superadmin (or a superadmin, for that matter) could shape to
# end up with a different role than the endpoint grants. The only way to
# forge superadmin access is to forge a valid JWT, which requires
# settings.jwt_secret — see the startup warning in main.py if that's still
# the "change-me" default.


def _to_organization_out(db: Session, tenant: Tenant) -> OrganizationOut:
    return OrganizationOut(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        status=tenant.status.value,
        created_at=tenant.created_at,
        max_recruiter_seats=tenant.max_recruiter_seats,
        active_recruiter_seat_count=active_recruiter_seat_count(db, tenant.id),
    )


@router.get("/organizations", response_model=list[OrganizationOut])
def list_organizations(
    current_user: CurrentUser = Depends(require_role("superadmin")),
) -> list[OrganizationOut]:
    with raw_session() as db:
        tenants = db.query(Tenant).filter(Tenant.type == TenantType.org).order_by(Tenant.created_at.desc()).all()
        # Built inside the session — raw_session() closes on exit, and
        # FastAPI serializes the response after this function returns, so
        # returning bare ORM instances here would DetachedInstanceError.
        return [_to_organization_out(db, t) for t in tenants]


@router.post("/organizations", response_model=OrganizationOut, status_code=201)
def create_organization(
    payload: OrganizationCreate,
    current_user: CurrentUser = Depends(require_role("superadmin")),
) -> OrganizationOut:
    with raw_session() as db:
        if db.query(User).filter(User.email == payload.admin_email).first() is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Email already registered")

        tenant = Tenant(type=TenantType.org, name=payload.name, slug=generate_unique_slug(db, payload.name))
        db.add(tenant)
        db.flush()

        db.add(
            User(
                tenant_id=tenant.id,
                role=UserRole.org_admin,
                full_name=payload.admin_full_name,
                email=payload.admin_email,
                password_hash=hash_password(payload.admin_password),
                status=UserStatus.active,
            )
        )
        db.flush()
        return _to_organization_out(db, tenant)


@router.patch("/organizations/{tenant_id}/seats", response_model=OrganizationOut)
def update_org_seats(
    tenant_id: uuid.UUID,
    payload: OrgSeatsUpdate,
    current_user: CurrentUser = Depends(require_role("superadmin")),
) -> OrganizationOut:
    # Deliberately allowed even if it sets max_recruiter_seats below the
    # org's current active recruiter count — this never deactivates
    # anyone, it only blocks *future* recruiter invites until the org is
    # back under the limit (or a superadmin raises it again). See
    # app/services/seats.py's check_recruiter_seat_available, the actual
    # enforcement point (in org.py's invite_recruiter). org_admin seats
    # are a separate concept and are never gated by this field.
    with raw_session() as db:
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.type == TenantType.org).first()
        if tenant is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Organization not found")
        tenant.max_recruiter_seats = payload.max_recruiter_seats
        db.flush()
        return _to_organization_out(db, tenant)


@router.post("/organizations/{tenant_id}/admins", response_model=AdminUserOut, status_code=201)
def register_org_admin(
    tenant_id: uuid.UUID,
    payload: OrgAdminCreate,
    current_user: CurrentUser = Depends(require_role("superadmin")),
) -> AdminUserOut:
    with raw_session() as db:
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id, Tenant.type == TenantType.org).first()
        if tenant is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Organization not found")
        if db.query(User).filter(User.email == payload.email).first() is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Email already registered")

        user = User(
            tenant_id=tenant.id,
            role=UserRole.org_admin,
            full_name=payload.full_name,
            email=payload.email,
            password_hash=hash_password(payload.password),
            status=UserStatus.active,
        )
        db.add(user)
        db.flush()
        return AdminUserOut(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            role=user.role.value,
            status=user.status.value,
            tenant_id=user.tenant_id,
            tenant_name=tenant.name,
            created_at=user.created_at,
        )


@router.post("/superadmins", response_model=AdminUserOut, status_code=201)
def create_superadmin(
    payload: SuperadminCreate,
    current_user: CurrentUser = Depends(require_role("superadmin")),
) -> AdminUserOut:
    with raw_session() as db:
        if db.query(User).filter(User.email == payload.email).first() is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Email already registered")

        user = User(
            tenant_id=None,
            role=UserRole.superadmin,
            full_name=payload.full_name,
            email=payload.email,
            password_hash=hash_password(payload.password),
            status=UserStatus.active,
        )
        db.add(user)
        db.flush()
        return AdminUserOut(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            role=user.role.value,
            status=user.status.value,
            tenant_id=None,
            tenant_name=None,
            created_at=user.created_at,
        )


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    current_user: CurrentUser = Depends(require_role("superadmin")),
) -> list[AdminUserOut]:
    with raw_session() as db:
        rows = (
            db.query(User, Tenant.name)
            .outerjoin(Tenant, Tenant.id == User.tenant_id)
            .filter(User.deleted_at.is_(None))
            .order_by(User.created_at.desc())
            .all()
        )
        return [
            AdminUserOut(
                id=user.id,
                full_name=user.full_name,
                email=user.email,
                role=user.role.value,
                status=user.status.value,
                tenant_id=user.tenant_id,
                tenant_name=tenant_name,
                created_at=user.created_at,
            )
            for user, tenant_name in rows
        ]


@router.patch("/users/{user_id}/status", response_model=AdminUserOut)
def update_user_status(
    user_id: uuid.UUID,
    payload: UserStatusUpdate,
    current_user: CurrentUser = Depends(require_role("superadmin")),
) -> AdminUserOut:
    with raw_session() as db:
        user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
        if str(user.id) == current_user.user_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Cannot change your own account status")
        try:
            user.status = UserStatus(payload.status)
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid status") from None
        db.flush()
        tenant_name = None
        if user.tenant_id is not None:
            tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
            tenant_name = tenant.name if tenant else None
        return AdminUserOut(
            id=user.id,
            full_name=user.full_name,
            email=user.email,
            role=user.role.value,
            status=user.status.value,
            tenant_id=user.tenant_id,
            tenant_name=tenant_name,
            created_at=user.created_at,
        )
