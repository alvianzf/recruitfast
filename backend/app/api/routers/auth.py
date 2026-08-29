import uuid

from fastapi import APIRouter, HTTPException, Request, status
from jose import JWTError

from app.core.database import raw_session
from app.core.limiter import limiter
from app.core.security import create_access_token, create_refresh_token, decode_token, verify_password
from app.models.user import User, UserStatus
from app.schemas.auth import LoginRequest, RefreshRequest, TokenResponse

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
        # No path creates pending_approval users today (freelance
        # self-registration grants immediate access) — kept as a guard
        # rail in case a future gate (e.g. a subscription/payment check)
        # reuses this status.
        if user.status == UserStatus.pending_approval:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account is not active yet",
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


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
def refresh(request: Request, payload: RefreshRequest) -> TokenResponse:
    # access_token_expire_minutes is short (15 min) by design; this is what
    # actually keeps a session alive past that without a full re-login.
    # Re-reading the user here (rather than trusting the refresh token's
    # claims alone) also means a deactivated/removed account stops
    # renewing within one access-token lifetime, not just at next login.
    try:
        claims = decode_token(payload.refresh_token)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    if claims.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    with raw_session() as db:
        try:
            user_id = uuid.UUID(claims["sub"])
        except (KeyError, ValueError):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        user = db.query(User).filter(User.id == user_id, User.deleted_at.is_(None)).first()
        if user is None or user.status != UserStatus.active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account no longer active")

        access_token = create_access_token(
            user_id=str(user.id),
            tenant_id=str(user.tenant_id) if user.tenant_id else None,
            role=user.role.value,
        )
        new_refresh_token = create_refresh_token(user_id=str(user.id))
        return TokenResponse(access_token=access_token, refresh_token=new_refresh_token)
