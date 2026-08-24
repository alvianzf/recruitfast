from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def set_rls_context(session: Session, *, tenant_id: str | None, role: str) -> None:
    """Set the Postgres session variables RLS policies key off.

    Called once per request after auth, before any tenant-scoped query.
    tenant_id is None for the superadmin role, whose DB policies grant no
    access to recruiter-content tables regardless of this value.
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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
