import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class JobStageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    position: int
    is_terminal_reject: bool
    is_terminal_success: bool


class JobStageCreate(BaseModel):
    name: str


class JobStageRename(BaseModel):
    name: str


class JobStageReorder(BaseModel):
    stage_ids: list[uuid.UUID]


class CandidateSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    current_position: str | None


class PlacementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    candidate_id: uuid.UUID
    job_id: uuid.UUID
    current_stage_id: uuid.UUID
    status: str
    status_reason: str | None
    starting_date: date | None
    offer_rate: int | None
    offer_rate_currency: str | None
    candidate: CandidateSummary


class PlacementOfferDetails(BaseModel):
    starting_date: date | None = None
    offer_rate: int | None = Field(default=None, ge=0)
    offer_rate_currency: str | None = None


class PlacementCreate(BaseModel):
    candidate_id: uuid.UUID


class PlacementMove(BaseModel):
    to_stage_id: uuid.UUID


class PlacementStatusUpdate(BaseModel):
    status: str  # "rejected" | "withdrawn" | "active"
    reason: str | None = None


class BlacklistUpdate(BaseModel):
    reason: str = Field(min_length=1)
