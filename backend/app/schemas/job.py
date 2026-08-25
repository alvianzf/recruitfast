import uuid

from pydantic import BaseModel, ConfigDict


class JobCreate(BaseModel):
    title: str
    overview: str | None = None
    description: str | None = None
    # If true, the job is created unassigned (visible to the whole org's
    # recruiters to self-claim) instead of self-assigning to the creator.
    # See docs/01 "Unassigned Jobs" queue.
    unassigned: bool = False


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    title: str
    overview: str | None
    status: str
    owner_recruiter_id: uuid.UUID | None


class AssignJobRequest(BaseModel):
    recruiter_id: uuid.UUID
