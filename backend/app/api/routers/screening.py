import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user, get_db
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.job_application import (
    MAX_FREELANCE_SCREENING_QUESTIONS,
    JobApplication,
    JobScreeningQuestion,
    ScreeningQuestionType,
)
from app.models.pipeline import JobStage
from app.models.placement import PipelinePlacement, PlacementStatus
from app.models.tenant import Tenant, TenantType
from app.schemas.screening import (
    ApplicationCandidateSummary,
    ApplicationOut,
    ScreeningQuestionCreate,
    ScreeningQuestionOut,
)

router = APIRouter(tags=["screening"])


def _is_freelancer(db: Session, current_user: CurrentUser) -> bool:
    if not current_user.tenant_id:
        return False
    tenant = db.query(Tenant).filter(Tenant.id == uuid.UUID(current_user.tenant_id)).first()
    return tenant is not None and tenant.type == TenantType.freelance_org


@router.get("/jobs/{job_id}/screening-questions", response_model=list[ScreeningQuestionOut])
def list_screening_questions(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[JobScreeningQuestion]:
    return (
        db.query(JobScreeningQuestion)
        .filter(JobScreeningQuestion.job_id == job_id)
        .order_by(JobScreeningQuestion.position)
        .all()
    )


@router.post("/jobs/{job_id}/screening-questions", response_model=ScreeningQuestionOut, status_code=201)
def add_screening_question(
    job_id: uuid.UUID,
    payload: ScreeningQuestionCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> JobScreeningQuestion:
    job = db.query(Job).filter(Job.id == job_id, Job.tenant_id == uuid.UUID(current_user.tenant_id)).first()
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Job not found")

    current_count = db.query(JobScreeningQuestion).filter(JobScreeningQuestion.job_id == job_id).count()
    if _is_freelancer(db, current_user) and current_count >= MAX_FREELANCE_SCREENING_QUESTIONS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Freelance recruiters are capped at {MAX_FREELANCE_SCREENING_QUESTIONS} screening questions per job",
        )

    question = JobScreeningQuestion(
        tenant_id=job.tenant_id,
        job_id=job_id,
        question_text=payload.question_text,
        question_type=ScreeningQuestionType(payload.question_type),
        expected_answer=payload.expected_answer,
        min_value=payload.min_value,
        required=payload.required,
        position=current_count,
    )
    db.add(question)
    db.flush()
    return question


@router.delete("/screening-questions/{question_id}", status_code=204)
def delete_screening_question(
    question_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    question = (
        db.query(JobScreeningQuestion)
        .filter(JobScreeningQuestion.id == question_id, JobScreeningQuestion.tenant_id == uuid.UUID(current_user.tenant_id))
        .first()
    )
    if question is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Question not found")
    db.delete(question)


def _to_application_out(app: JobApplication, candidate: Candidate) -> ApplicationOut:
    return ApplicationOut(
        id=app.id,
        candidate=ApplicationCandidateSummary(
            id=candidate.id, full_name=candidate.full_name, email=candidate.email,
            phone=candidate.phone, current_position=candidate.current_position,
        ),
        cover_letter=app.cover_letter,
        answers=app.answers,
        eligible=app.eligible,
        placement_id=app.placement_id,
        created_at=app.created_at,
    )


@router.get("/jobs/{job_id}/applications", response_model=list[ApplicationOut])
def list_applications(
    job_id: uuid.UUID,
    eligible: bool | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[ApplicationOut]:
    query = (
        db.query(JobApplication, Candidate)
        .join(Candidate, Candidate.id == JobApplication.candidate_id)
        .filter(JobApplication.job_id == job_id, Candidate.deleted_at.is_(None))
    )
    if eligible is not None:
        query = query.filter(JobApplication.eligible == eligible)
    rows = query.order_by(JobApplication.created_at.desc()).all()
    return [_to_application_out(a, c) for a, c in rows]


@router.post("/jobs/{job_id}/applications/{application_id}/mark-eligible", response_model=ApplicationOut)
def mark_eligible(
    job_id: uuid.UUID,
    application_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ApplicationOut:
    application = (
        db.query(JobApplication)
        .filter(JobApplication.id == application_id, JobApplication.job_id == job_id)
        .first()
    )
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Application not found")

    application.eligible = True
    if application.placement_id is None:
        job = db.query(Job).filter(Job.id == job_id).first()
        first_stage = db.query(JobStage).filter(JobStage.job_id == job_id).order_by(JobStage.position).first()
        existing = (
            db.query(PipelinePlacement)
            .filter(PipelinePlacement.candidate_id == application.candidate_id, PipelinePlacement.job_id == job_id)
            .first()
        )
        if existing is None:
            placement = PipelinePlacement(
                tenant_id=job.tenant_id, candidate_id=application.candidate_id, job_id=job_id,
                current_stage_id=first_stage.id, status=PlacementStatus.active,
                moved_by=uuid.UUID(current_user.user_id),
            )
            db.add(placement)
            db.flush()
            application.placement_id = placement.id
        else:
            application.placement_id = existing.id

    candidate = db.query(Candidate).filter(Candidate.id == application.candidate_id).first()
    return _to_application_out(application, candidate)
