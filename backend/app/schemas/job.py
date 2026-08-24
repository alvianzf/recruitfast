import uuid

from pydantic import BaseModel, ConfigDict


class JobCreate(BaseModel):
    title: str
    overview: str | None = None
    description: str | None = None


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    overview: str | None
    status: str
