"""Local dev seed data — NOT for production use.

Creates the platform-owned Freelance Org tenant (there must be exactly
one, per docs/02) plus one demo Org tenant and one user per role so the
app is actually usable end-to-end without a real registration/approval
cycle. Passwords here are throwaway local dev credentials, printed to
stdout — never commit them anywhere.

Run with: backend/.venv/Scripts/python.exe scripts/seed_dev.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal, set_rls_context  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.tenant import Tenant, TenantType, TenantStatus  # noqa: E402
from app.models.user import User, UserRole, UserStatus  # noqa: E402
from app.services.slugs import generate_unique_slug  # noqa: E402

DEV_PASSWORD = "devpass123"


def get_or_create_tenant(db, *, type_: TenantType, name: str) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.type == type_, Tenant.name == name).first()
    if tenant is None:
        # Freelance Org has no slug — fixed /jobs/public route instead
        # (docs/10). Org tenants get one so their job board is reachable.
        slug = generate_unique_slug(db, name) if type_ == TenantType.org else None
        tenant = Tenant(type=type_, name=name, status=TenantStatus.active, slug=slug)
        db.add(tenant)
        db.flush()
    elif type_ == TenantType.org and tenant.slug is None:
        tenant.slug = generate_unique_slug(db, name)  # backfill for a pre-existing seed run
        db.flush()
    return tenant


def get_or_create_user(db, *, email: str, full_name: str, role: UserRole, tenant_id, status: UserStatus) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        user = User(
            tenant_id=tenant_id,
            role=role,
            full_name=full_name,
            email=email,
            password_hash=hash_password(DEV_PASSWORD),
            status=status,
        )
        db.add(user)
        db.flush()
    return user


def main() -> None:
    db = SessionLocal()
    try:
        # Seed data spans multiple tenants — bypass RLS for this
        # superadmin-equivalent maintenance session on purpose.
        set_rls_context(db, tenant_id=None, role="superadmin")

        freelance_org = get_or_create_tenant(db, type_=TenantType.freelance_org, name="Freelance Org")
        demo_org = get_or_create_tenant(db, type_=TenantType.org, name="Acme Recruiting Co")

        superadmin = get_or_create_user(
            db, email="superadmin@recruitfast.dev", full_name="Platform Superadmin",
            role=UserRole.superadmin, tenant_id=None, status=UserStatus.active,
        )
        org_admin = get_or_create_user(
            db, email="admin@acme.dev", full_name="Acme Admin",
            role=UserRole.org_admin, tenant_id=demo_org.id, status=UserStatus.active,
        )
        org_recruiter = get_or_create_user(
            db, email="recruiter@acme.dev", full_name="Acme Recruiter",
            role=UserRole.recruiter, tenant_id=demo_org.id, status=UserStatus.active,
        )
        freelancer = get_or_create_user(
            db, email="freelancer@recruitfast.dev", full_name="Jamie Freelancer",
            role=UserRole.recruiter, tenant_id=freelance_org.id, status=UserStatus.active,
        )

        db.commit()

        print("Seeded. Dev login credentials (password for all: %r):" % DEV_PASSWORD)
        for u in (superadmin, org_admin, org_recruiter, freelancer):
            print(f"  {u.role.value:<12} {u.email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
