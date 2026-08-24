from typing import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, set_rls_context
from app.core.security import decode_token

bearer_scheme = HTTPBearer()


class CurrentUser:
    def __init__(self, user_id: str, tenant_id: str | None, role: str):
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.role = role


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> CurrentUser:
    try:
        claims = decode_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    if claims.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    return CurrentUser(user_id=claims["sub"], tenant_id=claims.get("tenant_id"), role=claims["role"])


def require_role(*roles: str):
    """Dependency factory — 403s unless current_user.role is one of `roles`.
    Use for endpoints scoped to a single role (e.g. superadmin-only admin
    routes) beyond what RLS already enforces at the data layer."""

    def _check(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Not authorized for this action")
        return current_user

    return _check


def get_db(current_user: CurrentUser = Depends(get_current_user)) -> Generator[Session, None, None]:
    """Tenant/role-scoped DB session — sets the Postgres session vars RLS
    policies key off before yielding, per request. See docs/02 RLS model.

    One transaction for the whole request, committed here at teardown —
    not by route handlers. `SET LOCAL` (used by set_rls_context) is
    transaction-scoped: a mid-request `db.commit()` in a route would end
    that transaction and silently reset app.tenant_id, breaking RLS on
    any query the route makes afterward (e.g. a post-commit refresh).
    Routes should `db.flush()` when they need generated IDs and leave
    committing to this dependency.
    """
    db = SessionLocal()
    try:
        set_rls_context(db, tenant_id=current_user.tenant_id, role=current_user.role)
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
