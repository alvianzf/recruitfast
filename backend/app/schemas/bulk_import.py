import uuid
from typing import Literal

from pydantic import BaseModel


class ImportPossibleDuplicate(BaseModel):
    candidate_id: uuid.UUID
    full_name: str


class ImportRowPreview(BaseModel):
    row_index: int
    full_name: str
    email: str | None = None
    phone: str | None = None
    source: str | None = None
    linkedin_url: str | None = None
    notes: str | None = None
    status: Literal["valid", "warning", "error"]
    messages: list[str] = []
    possible_duplicate: ImportPossibleDuplicate | None = None


class ImportPreviewResponse(BaseModel):
    temp_id: str
    filename: str
    rows: list[ImportRowPreview]
    valid_count: int
    warning_count: int
    error_count: int


class ImportCommitRow(BaseModel):
    row_index: int
    resolution: Literal["create", "skip"]
    full_name: str
    email: str | None = None
    phone: str | None = None
    source: str | None = None
    linkedin_url: str | None = None
    notes: str | None = None


class ImportCommitRequest(BaseModel):
    temp_id: str
    filename: str
    rows: list[ImportCommitRow]


class ImportCommitResponse(BaseModel):
    batch_id: uuid.UUID
    created_count: int
    skipped_count: int
