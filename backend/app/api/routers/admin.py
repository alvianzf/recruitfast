import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_db, require_role
from app.core.database import raw_session
from app.models.freelance import FreelanceApplication, FreelanceApplicationStatus
from app.models.user import User, UserStatus
from app.schemas.freelance import FreelanceApplicationOut, FreelanceRejectRequest

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/freelance-applications", response_model=list[FreelanceApplicationOut])
def list_freelance_applications(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("superadmin")),
) -> list[FreelanceApplicationOut]:
    # users/freelance_applications aren't RLS-protected — this is
    # pre-tenant account metadata, the one recruiter-adjacent thing a
    # Superadmin is allowed to see (docs/01). Everything else on this
    # session's RLS context is still locked out.
    rows = (
        db.query(FreelanceApplication, User)
        .join(User, User.id == FreelanceApplication.user_id)
        .filter(FreelanceApplication.status == FreelanceApplicationStatus.pending)
        .order_by(FreelanceApplication.created_at)
        .all()
    )
    return [
        FreelanceApplicationOut(
            id=app.id,
            full_name=user.full_name,
            email=user.email,
            linkedin_url=app.linkedin_url,
            years_experience=app.years_experience,
            specialization=app.specialization,
            notes=app.notes,
            status=app.status.value,
            created_at=app.created_at,
        )
        for app, user in rows
    ]


@router.post("/freelance-applications/{application_id}/approve", status_code=204)
def approve_freelance_application(
    application_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role("superadmin")),
) -> None:
    with raw_session() as db:
        application = db.query(FreelanceApplication).filter(FreelanceApplication.id == application_id).first()
        if application is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Application not found")
        user = db.query(User).filter(User.id == application.user_id).first()

        application.status = FreelanceApplicationStatus.approved
        application.decided_by = uuid.UUID(current_user.user_id)
        user.status = UserStatus.active


@router.post("/freelance-applications/{application_id}/reject", status_code=204)
def reject_freelance_application(
    application_id: uuid.UUID,
    payload: FreelanceRejectRequest,  # noqa: ARG001 — accepted per docs/01 (reason emailed to
    # applicant); no email service is wired up yet, so it's not sent or persisted right now.
    current_user: CurrentUser = Depends(require_role("superadmin")),
) -> None:
    with raw_session() as db:
        application = db.query(FreelanceApplication).filter(FreelanceApplication.id == application_id).first()
        if application is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Application not found")
        user = db.query(User).filter(User.id == application.user_id).first()

        # Rejection deletes the pending account entirely — docs/01: "no
        # residual data — nothing was created yet". application.user_id
        # is a FK to users, so the application row has to go too rather
        # than being kept as a decision record; there's genuinely nothing
        # to retain a decision *about* once the account is gone.
        db.delete(application)
        db.delete(user)
