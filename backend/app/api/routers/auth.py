from fastapi import APIRouter, HTTPException, Request, status

from app.core.database import raw_session
from app.core.limiter import limiter
from app.core.security import create_access_token, create_refresh_token, verify_password
from app.models.user import User, UserStatus
from app.schemas.auth import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest) -> TokenResponse:
    # Pre-auth lookup by email, so no tenant is known yet — the users
    # table holds account metadata, not recruiter content, so it isn't
    # RLS-restricted the way jobs/candidates are. See docs/02.
    with raw_session() as db:
        user = db.query(User).filter(User.email == payload.email, User.deleted_at.is_(None)).first()
        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
        if user.status == UserStatus.pending_approval:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your freelance recruiter application is still pending Superadmin approval",
            )
        if user.status == UserStatus.deactivated:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")

        access_token = create_access_token(
            user_id=str(user.id),
            tenant_id=str(user.tenant_id) if user.tenant_id else None,
            role=user.role.value,
        )
        refresh_token = create_refresh_token(user_id=str(user.id))
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)
