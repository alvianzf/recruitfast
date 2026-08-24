import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_db, require_role
from app.core.security import hash_password
from app.models.job import Job
from app.models.team import Team
from app.models.user import User, UserRole, UserStatus
from app.schemas.org import AssignTeamRequest, RecruiterInvite, RecruiterOut, ReassignJobsRequest

router = APIRouter(prefix="/org", tags=["org"])


@router.get("/recruiters", response_model=list[RecruiterOut])
def list_recruiters(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("org_admin")),
) -> list[User]:
    # users isn't RLS-protected (account metadata, not recruiter content —
    # see docs/02), so tenant scoping is explicit here rather than implicit.
    return (
        db.query(User)
        .filter(User.tenant_id == uuid.UUID(current_user.tenant_id), User.deleted_at.is_(None))
        .order_by(User.full_name)
        .all()
    )


@router.post("/recruiters", response_model=RecruiterOut, status_code=201)
def invite_recruiter(
    payload: RecruiterInvite,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("org_admin")),
) -> User:
    # No email/invite-link infrastructure yet (same constraint noted on
    # the freelance rejection endpoint) — the Admin sets an initial
    # password directly rather than the recruiter setting their own via
    # an emailed activation link. Revisit once email sending exists.
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        tenant_id=uuid.UUID(current_user.tenant_id),
        role=UserRole.recruiter,
        full_name=payload.full_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        status=UserStatus.active,
    )
    db.add(user)
    db.flush()
    return user


@router.patch("/recruiters/{recruiter_id}/deactivate", response_model=RecruiterOut)
def deactivate_recruiter(
    recruiter_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("org_admin")),
) -> User:
    user = (
        db.query(User)
        .filter(User.id == recruiter_id, User.tenant_id == uuid.UUID(current_user.tenant_id))
        .first()
    )
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Recruiter not found")
    user.status = UserStatus.deactivated
    return user


@router.patch("/recruiters/{recruiter_id}/team", response_model=RecruiterOut)
def assign_recruiter_team(
    recruiter_id: uuid.UUID,
    payload: AssignTeamRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("org_admin")),
) -> User:
    user = (
        db.query(User)
        .filter(User.id == recruiter_id, User.tenant_id == uuid.UUID(current_user.tenant_id))
        .first()
    )
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Recruiter not found")

    if payload.team_id is not None:
        team = (
            db.query(Team)
            .filter(Team.id == payload.team_id, Team.tenant_id == uuid.UUID(current_user.tenant_id))
            .first()
        )
        if team is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="team_id is not a team in this org")

    user.team_id = payload.team_id
    return user


@router.post("/recruiters/{recruiter_id}/reassign-jobs")
def reassign_jobs(
    recruiter_id: uuid.UUID,
    payload: ReassignJobsRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("org_admin")),
) -> dict:
    target = (
        db.query(User)
        .filter(User.id == payload.to_recruiter_id, User.tenant_id == uuid.UUID(current_user.tenant_id))
        .first()
    )
    if target is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="to_recruiter_id is not a recruiter in this org")

    # jobs IS RLS-protected — the update is naturally tenant-scoped by the
    # session context get_db already set up, no explicit tenant_id filter
    # needed here for correctness (added anyway as defense-in-depth,
    # matching the pattern used elsewhere).
    updated = (
        db.query(Job)
        .filter(Job.owner_recruiter_id == recruiter_id, Job.tenant_id == uuid.UUID(current_user.tenant_id))
        .update({Job.owner_recruiter_id: payload.to_recruiter_id})
    )
    return {"reassigned_count": updated}
