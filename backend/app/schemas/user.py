import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserMeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str
    role: str
    avatar_url: str | None
    tenant_id: uuid.UUID | None
    # Lets the frontend tell a freelance recruiter apart from an Org
    # recruiter for copy purposes (e.g. candidate visibility wording) —
    # "team" framing makes no sense for a freelancer who has no team.
    # None only for a superadmin, who has no tenant at all.
    tenant_type: str | None


class UserMeUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    avatar_url: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)
