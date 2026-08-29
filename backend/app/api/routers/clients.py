import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser, get_current_user, get_db, require_role
from app.api.routers.metrics import UNTAGGED_CURRENCY_FALLBACK, _placement_value_metrics
from app.models.client import Client
from app.models.job import Job, JobStatus
from app.models.placement import PipelinePlacement, PlacementStatus
from app.models.tenant import Tenant
from app.schemas.client import ClientCreate, ClientMetrics, ClientOut, ClientUpdate

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("", response_model=list[ClientOut])
def list_clients(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[Client]:
    # Any org member can read the roster (needed for the job-form
    # dropdown) — only org_admin can create/edit. RLS scopes this to the
    # caller's tenant; Freelance Org tenants simply never have rows here.
    return db.query(Client).filter(Client.tenant_id == current_user.tenant_id).order_by(Client.name).all()


@router.post("", response_model=ClientOut, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("org_admin")),
) -> Client:
    client = Client(tenant_id=uuid.UUID(current_user.tenant_id), **payload.model_dump())
    db.add(client)
    db.flush()
    return client


@router.patch("/{client_id}", response_model=ClientOut)
def update_client(
    client_id: uuid.UUID,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("org_admin")),
) -> Client:
    client = db.query(Client).filter(Client.id == client_id, Client.tenant_id == current_user.tenant_id).first()
    if client is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Client not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(client, field, value)
    return client


@router.get("/{client_id}/metrics", response_model=ClientMetrics)
def client_metrics(
    client_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ClientMetrics:
    client = db.query(Client).filter(Client.id == client_id, Client.tenant_id == current_user.tenant_id).first()
    if client is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Client not found")

    job_count = db.query(Job).filter(Job.client_id == client_id, Job.deleted_at.is_(None)).count()
    open_job_count = (
        db.query(Job)
        .filter(Job.client_id == client_id, Job.deleted_at.is_(None), Job.status == JobStatus.open)
        .count()
    )
    placement_count = (
        db.query(PipelinePlacement)
        .join(Job, Job.id == PipelinePlacement.job_id)
        .filter(Job.client_id == client_id, PipelinePlacement.status == PlacementStatus.active)
        .count()
    )

    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    preferred_currency = tenant.preferred_currency if tenant else UNTAGGED_CURRENCY_FALLBACK
    revenue = _placement_value_metrics(db, preferred_currency, client_id=client_id)

    return ClientMetrics(
        client=client,
        job_count=job_count,
        open_job_count=open_job_count,
        placement_count=placement_count,
        revenue=revenue,
    )
