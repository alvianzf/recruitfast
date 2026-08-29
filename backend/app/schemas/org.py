import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RecruiterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str
    role: str
    status: str
    team_id: uuid.UUID | None


class RecruiterInvite(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(min_length=8)


class ReassignJobsRequest(BaseModel):
    to_recruiter_id: uuid.UUID


class AssignTeamRequest(BaseModel):
    team_id: uuid.UUID | None


class OrgProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    slug: str | None
    logo_url: str | None
    description: str | None
    office_location: str | None
    contact_email: str | None
    preferred_currency: str


class OrgProfileUpdate(BaseModel):
    logo_url: str | None = None
    description: str | None = None
    office_location: str | None = None
    contact_email: str | None = None
    preferred_currency: str | None = None
