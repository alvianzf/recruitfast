import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class CandidateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str | None
    phone: str | None
    source: str | None
    current_position: str | None
    total_years_experience: str | None
    blacklisted: bool
    open_to_other_roles: bool
    linkedin_url: str | None
    github_url: str | None
    portfolio_url: str | None


class CandidateUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    source: str | None = None
    current_position: str | None = None
    total_years_experience: str | None = None
    linkedin_url: str | None = None
    github_url: str | None = None
    portfolio_url: str | None = None
    # "Open Profile" — the candidate is discoverable by any recruiter in
    # any tenant (the cross-tenant RLS exception on `candidates`), not
    # just this tenant/team. Previously only settable by the candidate
    # themselves at public-application time; recruiters can now also flip
    # it for candidates they added directly. See docs/01, docs/02.
    open_to_other_roles: bool | None = None


class CurrentDocumentOut(BaseModel):
    original_filename: str
    parsed_fields: dict[str, Any]
    parse_confidence: dict[str, Any]
    parse_status: str


class PlacementSummary(BaseModel):
    job_id: uuid.UUID
    job_title: str
    stage_name: str
    status: str


class CandidateDetailOut(CandidateOut):
    current_document: CurrentDocumentOut | None = None
    placements: list[PlacementSummary] = []


class PossibleDuplicate(BaseModel):
    candidate_id: uuid.UUID
    full_name: str
    email: str | None


class CVPreviewItem(BaseModel):
    temp_id: str
    filename: str
    parsed_fields: dict[str, Any] | None = None
    parse_confidence: dict[str, Any] | None = None
    parse_status: str
    error: str | None = None
    possible_duplicate: PossibleDuplicate | None = None


class CVPreviewResponse(BaseModel):
    items: list[CVPreviewItem]


class CVCommitItem(BaseModel):
    temp_id: str
    filename: str
    resolution: Literal["create", "skip"]
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    current_position: str | None = None
    total_years_experience: str | None = None
    parsed_fields: dict[str, Any] | None = None
    parse_confidence: dict[str, Any] | None = None


class CVCommitRequest(BaseModel):
    items: list[CVCommitItem]


class CVCommitResponse(BaseModel):
    created: list[CandidateOut]
    skipped_count: int
