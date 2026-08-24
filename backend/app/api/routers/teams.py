import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_db, require_role
from app.models.team import Team
from app.models.user import User
from app.schemas.team import TeamCreate, TeamOut

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("", response_model=list[TeamOut])
def list_teams(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("org_admin")),
) -> list[TeamOut]:
    rows = (
        db.query(Team, func.count(User.id))
        .outerjoin(User, (User.team_id == Team.id) & (User.deleted_at.is_(None)))
        .group_by(Team.id)
        .order_by(Team.name)
        .all()
    )
    return [TeamOut(id=team.id, name=team.name, member_count=count) for team, count in rows]


@router.post("", response_model=TeamOut, status_code=201)
def create_team(
    payload: TeamCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("org_admin")),
) -> TeamOut:
    team = Team(tenant_id=uuid.UUID(current_user.tenant_id), name=payload.name)
    db.add(team)
    db.flush()
    return TeamOut(id=team.id, name=team.name, member_count=0)


@router.delete("/{team_id}", status_code=204)
def delete_team(
    team_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("org_admin")),
) -> None:
    team = db.query(Team).filter(Team.id == team_id, Team.tenant_id == uuid.UUID(current_user.tenant_id)).first()
    if team is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Team not found")

    # Members keep their account, just lose the team label — deleting a
    # team is not a reason to touch their jobs/candidates.
    db.query(User).filter(User.team_id == team_id, User.tenant_id == uuid.UUID(current_user.tenant_id)).update(
        {User.team_id: None}
    )
    db.delete(team)
