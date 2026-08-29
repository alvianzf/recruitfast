import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, model_validator


class ScreeningQuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    question_text: str
    question_type: str
    expected_answer: str | None
    min_value: int | None
    required: bool
    position: int


class ScreeningQuestionCreate(BaseModel):
    question_text: str
    question_type: str = "text"
    expected_answer: str | None = None
    min_value: int | None = None
    # Not every question needs to gate eligibility — a free-text question
    # can just collect information. expected_answer/min_value are only
    # required (and only meaningful) when this is true.
    required: bool = True

    @model_validator(mode="after")
    def _validate_answer_shape(self) -> "ScreeningQuestionCreate":
        if self.question_type not in ("text", "number", "boolean"):
            raise ValueError("question_type must be 'text', 'number', or 'boolean'")
        if self.required:
            if self.question_type == "text" and not (self.expected_answer or "").strip():
                raise ValueError("expected_answer is required for a required text question")
            if self.question_type == "number" and self.min_value is None:
                raise ValueError("min_value is required for a required number question")
            if self.question_type == "boolean":
                normalized = (self.expected_answer or "").strip().lower()
                if normalized not in ("yes", "no"):
                    raise ValueError("expected_answer must be 'yes' or 'no' for a required boolean question")
                self.expected_answer = normalized
        return self


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
    location: str | None
