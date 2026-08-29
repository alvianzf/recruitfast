from fastapi import APIRouter, HTTPException, Request, status

from app.core.database import raw_session
from app.core.limiter import limiter
from app.core.security import hash_password
from app.models.freelance import FreelanceApplication, FreelanceApplicationStatus
from app.models.tenant import Tenant, TenantType
from app.models.user import User, UserRole, UserStatus
from app.schemas.freelance import FreelanceRegisterRequest, FreelanceRegisterResponse

router = APIRouter(prefix="/freelance", tags=["freelance"])


@router.post("/register", response_model=FreelanceRegisterResponse, status_code=201)
@limiter.limit("5/minute")
def register_freelance(request: Request, payload: FreelanceRegisterRequest) -> FreelanceRegisterResponse:
    # Public, pre-auth endpoint — no tenant known yet, so this runs without
    # the RLS-scoped session. See docs/01 freelance registration flow.
    with raw_session() as db:
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

        freelance_org = db.query(Tenant).filter(Tenant.type == TenantType.freelance_org).first()
        if freelance_org is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Freelance Org tenant is not provisioned",
            )

        user = User(
            tenant_id=freelance_org.id,
            role=UserRole.recruiter,
            full_name=payload.full_name,
            email=payload.email,
            password_hash=hash_password(payload.password),
            status=UserStatus.active,
            specialization_tags=[payload.specialization] if payload.specialization else None,
        )
        db.add(user)
        db.flush()

        # No approval gate today — self-registration grants immediate
        # access. Kept as an application record (pre-set to approved,
        # decided_by left null) for Superadmin visibility and as the
        # future hook point for a subscription/payment gate.
        db.add(
            FreelanceApplication(
                user_id=user.id,
                linkedin_url=payload.linkedin_url,
                years_experience=payload.years_experience,
                specialization=payload.specialization,
                notes=payload.notes,
                status=FreelanceApplicationStatus.approved,
            )
        )
        return FreelanceRegisterResponse()
