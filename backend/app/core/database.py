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
    session.execute(text("SET LOCAL app.role = :role"), {"role": role})
    session.execute(
        text("SET LOCAL app.tenant_id = :tenant_id"),
        {"tenant_id": tenant_id or ""},
    )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
