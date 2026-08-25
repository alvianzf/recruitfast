from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def set_rls_context(session: Session, *, tenant_id: str | None, role: str, user_id: str | None = None) -> None:
    """Set the Postgres session variables RLS policies key off.

    Called once per request after auth, before any tenant-scoped query.
    tenant_id is None for the superadmin role, whose DB policies grant no
    access to recruiter-content tables regardless of this value. user_id
    backs the Freelance Org's per-recruiter candidate privacy policy (see
    migration 0012 and docs/02) — every other RLS policy ignores it.
    """
    # `SET LOCAL` is a utility statement and does not accept bind
    # parameters ("SET LOCAL app.role = :role" is a syntax error at the
    # driver level) — set_config() is the parameterized equivalent,
    # with is_local=true matching SET LOCAL's transaction scope.
    session.execute(text("SELECT set_config('app.role', :role, true)"), {"role": role})
    session.execute(
        text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
        {"tenant_id": tenant_id or ""},
    )
    session.execute(
        text("SELECT set_config('app.user_id', :user_id, true)"),
        {"user_id": user_id or ""},
    )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def raw_session():
    """For pre-auth / cross-tenant endpoints that can't use the
    `get_db` FastAPI dependency (no authenticated request context yet —
    login, registration, the public job board). Always explicitly
    commits or rolls back before closing.

    This matters specifically because of connection pooling: any
    `SET LOCAL`/`set_config(..., true)` value (used by set_rls_context)
    is transaction-scoped and only actually clears on COMMIT or ROLLBACK.
    A bare `SessionLocal(); ...; db.close()` with no explicit commit/
    rollback can leave a stray value active on the underlying pooled
    connection, which then leaks into whichever *unrelated* request
    happens to check out that same physical connection next — surfacing
    as a confusing, intermittent "invalid input syntax for type uuid: ''"
    error somewhere that looks completely unrelated to its actual cause.
    Found and fixed while building the public job board (docs/10) — see
    that migration/router history for the debugging trail.
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
