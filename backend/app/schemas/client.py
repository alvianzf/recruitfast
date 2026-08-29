import uuid

from pydantic import BaseModel, ConfigDict, EmailStr

from app.schemas.metrics import PlacementValueMetrics


class ClientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    email: str
    contact_person: str | None
    phone: str | None
    notes: str | None


class ClientCreate(BaseModel):
    name: str
    email: EmailStr
    contact_person: str | None = None
    phone: str | None = None
    notes: str | None = None


class ClientUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    contact_person: str | None = None
    phone: str | None = None
    notes: str | None = None


class ClientMetrics(BaseModel):
    client: ClientOut
    job_count: int
    open_job_count: int
    placement_count: int
    revenue: PlacementValueMetrics
