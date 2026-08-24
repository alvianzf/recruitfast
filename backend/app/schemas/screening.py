import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ScreeningQuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    question_text: str
    expected_answer: str
    position: int


class ScreeningQuestionCreate(BaseModel):
    question_text: str
    expected_answer: str


class ApplicationCandidateSummary(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str | None
    phone: str | None
    current_position: str | None


class ApplicationOut(BaseModel):
    id: uuid.UUID
    candidate: ApplicationCandidateSummary
    cover_letter: str | None
    answers: list[dict[str, Any]]
    eligible: bool
    placement_id: uuid.UUID | None
    created_at: datetime


class OpenProfileCandidate(BaseModel):
    id: uuid.UUID
    full_name: str
    current_position: str | None
    total_years_experience: str | None
