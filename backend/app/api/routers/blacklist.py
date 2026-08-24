from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user, get_db
from app.models.blacklist import EmailBlacklistEntry
from app.schemas.blacklist import BlacklistEntryOut, BlacklistStatus

router = APIRouter(prefix="/blacklist", tags=["blacklist"])


@router.get("", response_model=list[BlacklistStatus])
def check_blacklist(
    email: list[str] = Query(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[BlacklistStatus]:
    # Global, cross-tenant lookup by design — see docs/01 and the
    # EmailBlacklistEntry model docstring. Only reason + date are
    # returned; which tenant filed the entry is never exposed.
    normalized = {e.strip().lower() for e in email if e.strip()}
    if not normalized:
        return []

    rows = (
        db.query(EmailBlacklistEntry)
        .filter(EmailBlacklistEntry.email.in_(normalized))
        .order_by(EmailBlacklistEntry.created_at.desc())
        .all()
    )

    entries_by_email: dict[str, list[BlacklistEntryOut]] = {e: [] for e in normalized}
    for row in rows:
        entries_by_email[row.email.lower()].append(BlacklistEntryOut(reason=row.reason, created_at=row.created_at))

    return [
        BlacklistStatus(email=e, blacklisted=len(entries) > 0, entries=entries)
        for e, entries in entries_by_email.items()
    ]
