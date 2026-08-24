import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NoteAuthor(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str


class NoteOut(BaseModel):
    id: uuid.UUID
    body: str
    visibility: str
    author: NoteAuthor
    created_at: datetime


class NoteCreate(BaseModel):
    body: str
    visibility: str = "team"  # "team" | "private"
