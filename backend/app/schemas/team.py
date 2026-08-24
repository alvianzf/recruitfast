import uuid

from pydantic import BaseModel, ConfigDict


class TeamCreate(BaseModel):
    name: str


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    member_count: int = 0
