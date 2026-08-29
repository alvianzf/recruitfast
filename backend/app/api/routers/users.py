import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user, get_db
from app.core.security import hash_password, verify_password
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.user import ChangePasswordRequest, UserMeOut, UserMeUpdate

router = APIRouter(prefix="/users", tags=["users"])


def _get_self(db: Session, current_user: CurrentUser) -> User:
    # users isn't RLS-protected (see app/api/routers/metrics.py's
    # org_recruiter_performance for the same direct-filter pattern), and
    # this is always the caller's own row by primary key, so no tenant
    # filter is needed here either.
    user = db.query(User).filter(User.id == uuid.UUID(current_user.user_id)).first()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _to_me_out(db: Session, user: User) -> UserMeOut:
    tenant_type = None
    if user.tenant_id is not None:
        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
        tenant_type = tenant.type.value if tenant else None
    return UserMeOut(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role.value,
        avatar_url=user.avatar_url,
        tenant_id=user.tenant_id,
        tenant_type=tenant_type,
    )


@router.get("/me", response_model=UserMeOut)
def get_me(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)) -> UserMeOut:
    return _to_me_out(db, _get_self(db, current_user))


@router.patch("/me", response_model=UserMeOut)
def update_me(
    payload: UserMeUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> UserMeOut:
    user = _get_self(db, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.flush()
    return _to_me_out(db, user)


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_my_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    user = _get_self(db, current_user)
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="New password must be at least 8 characters")
    user.password_hash = hash_password(payload.new_password)
