import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user, get_db
from app.models.candidate import Candidate
from app.models.job import Job
from app.models.pipeline import JobStage
from app.models.placement import PipelinePlacement, PlacementStatus, StageHistory
from app.schemas.candidate import CandidateOut
from app.schemas.pipeline import (
    BlacklistUpdate,
    CandidateSummary,
    JobStageCreate,
    JobStageOut,
    JobStageRename,
    JobStageReorder,
    PlacementCreate,
    PlacementMove,
    PlacementOut,
    PlacementStatusUpdate,
)
router = APIRouter(tags=["pipeline"])


def _get_job_or_404(db: Session, job_id: uuid.UUID, tenant_id: str) -> Job:
    job = db.query(Job).filter(Job.id == job_id, Job.tenant_id == uuid.UUID(tenant_id)).first()
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


# ---- Job stages ----------------------------------------------------------


@router.get("/jobs/{job_id}/stages", response_model=list[JobStageOut])
def list_stages(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[JobStage]:
    _get_job_or_404(db, job_id, current_user.tenant_id)
    return db.query(JobStage).filter(JobStage.job_id == job_id).order_by(JobStage.position).all()


@router.post("/jobs/{job_id}/stages", response_model=JobStageOut, status_code=201)
def add_stage(
    job_id: uuid.UUID,
    payload: JobStageCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> JobStage:
    job = _get_job_or_404(db, job_id, current_user.tenant_id)
    max_position = db.query(JobStage).filter(JobStage.job_id == job_id).count()
    stage = JobStage(tenant_id=job.tenant_id, job_id=job_id, name=payload.name, position=max_position)
    db.add(stage)
    db.flush()
    return stage


@router.patch("/stages/{stage_id}", response_model=JobStageOut)
def rename_stage(
    stage_id: uuid.UUID,
    payload: JobStageRename,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> JobStage:
    stage = db.query(JobStage).filter(JobStage.id == stage_id, JobStage.tenant_id == uuid.UUID(current_user.tenant_id)).first()
    if stage is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Stage not found")
    # Renaming is metadata-only — past stage_history rows keep their
    # snapshotted label, so this never rewrites history. See docs/03.
    stage.name = payload.name
    db.flush()
    return stage


@router.put("/jobs/{job_id}/stages/reorder", response_model=list[JobStageOut])
def reorder_stages(
    job_id: uuid.UUID,
    payload: JobStageReorder,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[JobStage]:
    _get_job_or_404(db, job_id, current_user.tenant_id)
    stages = {s.id: s for s in db.query(JobStage).filter(JobStage.job_id == job_id).all()}
    if set(payload.stage_ids) != set(stages.keys()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="stage_ids must include every stage on this job exactly once")
    for position, stage_id in enumerate(payload.stage_ids):
        stages[stage_id].position = position
    db.flush()
    return db.query(JobStage).filter(JobStage.job_id == job_id).order_by(JobStage.position).all()


@router.delete("/stages/{stage_id}", status_code=204)
def delete_stage(
    stage_id: uuid.UUID,
    reassign_to_stage_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    stage = db.query(JobStage).filter(JobStage.id == stage_id, JobStage.tenant_id == uuid.UUID(current_user.tenant_id)).first()
    if stage is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Stage not found")

    occupied = db.query(PipelinePlacement).filter(PipelinePlacement.current_stage_id == stage_id).all()
    if occupied:
        if reassign_to_stage_id is None:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=f"{len(occupied)} candidate(s) are in this stage — pass reassign_to_stage_id to move them first.",
            )
        target = db.query(JobStage).filter(JobStage.id == reassign_to_stage_id, JobStage.job_id == stage.job_id).first()
        if target is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="reassign_to_stage_id is not a stage on this job")
        for placement in occupied:
            db.add(
                StageHistory(
                    tenant_id=placement.tenant_id,
                    placement_id=placement.id,
                    from_stage_id=placement.current_stage_id,
                    to_stage_id=target.id,
                    stage_label_snapshot=target.name,
                    moved_by=uuid.UUID(current_user.user_id),
                )
            )
            placement.current_stage_id = target.id

    db.delete(stage)


# ---- Pipeline placements ---------------------------------------------------


def _to_placement_out(placement: PipelinePlacement, candidate: Candidate) -> PlacementOut:
    return PlacementOut(
        id=placement.id,
        candidate_id=placement.candidate_id,
        job_id=placement.job_id,
        current_stage_id=placement.current_stage_id,
        status=placement.status.value,
        status_reason=placement.status_reason,
        candidate=CandidateSummary.model_validate(candidate),
    )


@router.get("/jobs/{job_id}/placements", response_model=list[PlacementOut])
def list_placements(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[PlacementOut]:
    _get_job_or_404(db, job_id, current_user.tenant_id)
    rows = (
        db.query(PipelinePlacement, Candidate)
        .join(Candidate, Candidate.id == PipelinePlacement.candidate_id)
        .filter(PipelinePlacement.job_id == job_id)
        .all()
    )
    return [_to_placement_out(p, c) for p, c in rows]


@router.post("/jobs/{job_id}/placements", response_model=PlacementOut, status_code=201)
def attach_candidate(
    job_id: uuid.UUID,
    payload: PlacementCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> PlacementOut:
    job = _get_job_or_404(db, job_id, current_user.tenant_id)
    candidate = db.query(Candidate).filter(Candidate.id == payload.candidate_id, Candidate.tenant_id == job.tenant_id).first()
    if candidate is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Candidate not found")

    existing = (
        db.query(PipelinePlacement)
        .filter(PipelinePlacement.candidate_id == candidate.id, PipelinePlacement.job_id == job_id)
        .first()
    )
    if existing is not None:
        # Reapplication semantics (docs/03): attaching an already-attached
        # candidate is a no-op on the placement, never a duplicate row.
        return _to_placement_out(existing, candidate)

    first_stage = db.query(JobStage).filter(JobStage.job_id == job_id).order_by(JobStage.position).first()
    if first_stage is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="This job has no pipeline stages")

    placement = PipelinePlacement(
        tenant_id=job.tenant_id,
        candidate_id=candidate.id,
        job_id=job_id,
        current_stage_id=first_stage.id,
        status=PlacementStatus.active,
        moved_by=uuid.UUID(current_user.user_id),
    )
    db.add(placement)
    db.flush()
    db.add(
        StageHistory(
            tenant_id=job.tenant_id,
            placement_id=placement.id,
            from_stage_id=None,
            to_stage_id=first_stage.id,
            stage_label_snapshot=first_stage.name,
            moved_by=uuid.UUID(current_user.user_id),
        )
    )
    return _to_placement_out(placement, candidate)


def _is_admin_override(db: Session, job: Job, current_user: CurrentUser) -> bool:
    return current_user.role == "org_admin" and str(job.owner_recruiter_id) != current_user.user_id


@router.patch("/placements/{placement_id}/move", response_model=PlacementOut)
def move_placement(
    placement_id: uuid.UUID,
    payload: PlacementMove,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> PlacementOut:
    placement = (
        db.query(PipelinePlacement)
        .filter(PipelinePlacement.id == placement_id, PipelinePlacement.tenant_id == uuid.UUID(current_user.tenant_id))
        .first()
    )
    if placement is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Placement not found")
    target = db.query(JobStage).filter(JobStage.id == payload.to_stage_id, JobStage.job_id == placement.job_id).first()
    if target is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="to_stage_id is not a stage on this job")
    job = db.query(Job).filter(Job.id == placement.job_id).first()

    db.add(
        StageHistory(
            tenant_id=placement.tenant_id,
            placement_id=placement.id,
            from_stage_id=placement.current_stage_id,
            to_stage_id=target.id,
            stage_label_snapshot=target.name,
            moved_by=uuid.UUID(current_user.user_id),
            was_admin_override=_is_admin_override(db, job, current_user),
        )
    )
    placement.current_stage_id = target.id
    placement.moved_by = uuid.UUID(current_user.user_id)
    # Dragging into the Reject-flagged column is the natural gesture for
    # rejecting a candidate — set status to match so reporting (docs/05)
    # counts it correctly, not just the visual board position.
    if target.is_terminal_reject and placement.status == PlacementStatus.active:
        placement.status = PlacementStatus.rejected

    candidate = db.query(Candidate).filter(Candidate.id == placement.candidate_id).first()
    return _to_placement_out(placement, candidate)


@router.patch("/placements/{placement_id}/status", response_model=PlacementOut)
def update_placement_status(
    placement_id: uuid.UUID,
    payload: PlacementStatusUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> PlacementOut:
    if payload.status not in ("rejected", "withdrawn"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="status must be 'rejected' or 'withdrawn'")

    placement = (
        db.query(PipelinePlacement)
        .filter(PipelinePlacement.id == placement_id, PipelinePlacement.tenant_id == uuid.UUID(current_user.tenant_id))
        .first()
    )
    if placement is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Placement not found")

    placement.status = PlacementStatus(payload.status)
    placement.status_reason = payload.reason

    # Both terminal statuses land the card in the job's Reject-flagged
    # column for board consistency — status still distinguishes why
    # (recruiter-rejected vs candidate-withdrew). See docs/03.
    reject_stage = db.query(JobStage).filter(JobStage.job_id == placement.job_id, JobStage.is_terminal_reject.is_(True)).first()
    if reject_stage and placement.current_stage_id != reject_stage.id:
        db.add(
            StageHistory(
                tenant_id=placement.tenant_id,
                placement_id=placement.id,
                from_stage_id=placement.current_stage_id,
                to_stage_id=reject_stage.id,
                stage_label_snapshot=reject_stage.name,
                moved_by=uuid.UUID(current_user.user_id),
            )
        )
        placement.current_stage_id = reject_stage.id

    candidate = db.query(Candidate).filter(Candidate.id == placement.candidate_id).first()
    return _to_placement_out(placement, candidate)


@router.post("/candidates/{candidate_id}/blacklist", response_model=CandidateOut)
def blacklist_candidate(
    candidate_id: uuid.UUID,
    payload: BlacklistUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> Candidate:
    candidate = (
        db.query(Candidate)
        .filter(Candidate.id == candidate_id, Candidate.tenant_id == uuid.UUID(current_user.tenant_id))
        .first()
    )
    if candidate is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    candidate.blacklisted = True
    candidate.blacklist_reason = payload.reason
    return candidate


@router.post("/jobs/{job_id}/placements/from-open-profile/{candidate_id}", response_model=PlacementOut, status_code=201)
def attach_from_open_profile(
    job_id: uuid.UUID,
    candidate_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> PlacementOut:
    job = _get_job_or_404(db, job_id, current_user.tenant_id)
    # Unlike the regular attach_candidate endpoint, this permits a
    # candidate outside the caller's own tenant — but ONLY when they've
    # opted in via open_to_other_roles. Every other attach path still
    # requires same-tenant. See docs/10.
    candidate = (
        db.query(Candidate)
        .filter(Candidate.id == candidate_id, Candidate.open_to_other_roles.is_(True), Candidate.deleted_at.is_(None))
        .first()
    )
    if candidate is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Candidate not found or not open to other roles")

    existing = (
        db.query(PipelinePlacement)
        .filter(PipelinePlacement.candidate_id == candidate.id, PipelinePlacement.job_id == job_id)
        .first()
    )
    if existing is not None:
        return _to_placement_out(existing, candidate)

    first_stage = db.query(JobStage).filter(JobStage.job_id == job_id).order_by(JobStage.position).first()
    if first_stage is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="This job has no pipeline stages")

    placement = PipelinePlacement(
        tenant_id=job.tenant_id,  # the ATTACHING org's tenant, not the candidate's origin tenant
        candidate_id=candidate.id, job_id=job_id, current_stage_id=first_stage.id,
        status=PlacementStatus.active, moved_by=uuid.UUID(current_user.user_id),
    )
    db.add(placement)
    db.flush()
    db.add(
        StageHistory(
            tenant_id=job.tenant_id, placement_id=placement.id, from_stage_id=None, to_stage_id=first_stage.id,
            stage_label_snapshot=first_stage.name, moved_by=uuid.UUID(current_user.user_id),
        )
    )
    return _to_placement_out(placement, candidate)
