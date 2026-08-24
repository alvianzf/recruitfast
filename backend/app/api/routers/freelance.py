from fastapi import APIRouter, HTTPException, status

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.freelance import FreelanceApplication
from app.models.tenant import Tenant, TenantType
from app.models.user import User, UserRole, UserStatus
from app.schemas.freelance import FreelanceRegisterRequest, FreelanceRegisterResponse

router = APIRouter(prefix="/freelance", tags=["freelance"])


@router.post("/register", response_model=FreelanceRegisterResponse, status_code=201)
def register_freelance(payload: FreelanceRegisterRequest) -> FreelanceRegisterResponse:
    # Public, pre-auth endpoint — no tenant known yet, so this runs without
    # the RLS-scoped session. See docs/01 freelance registration flow.
    db = SessionLocal()
    try:
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
            status=UserStatus.pending_approval,
            specialization_tags=[payload.specialization] if payload.specialization else None,
        )
        db.add(user)
        db.flush()

        db.add(
            FreelanceApplication(
                user_id=user.id,
                linkedin_url=payload.linkedin_url,
                years_experience=payload.years_experience,
                specialization=payload.specialization,
                notes=payload.notes,
            )
        )
        db.commit()
        return FreelanceRegisterResponse()
    finally:
        db.close()
