import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class FreelanceRegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(min_length=8)
    phone: str | None = None
    linkedin_url: str | None = None
    years_experience: int | None = None
    specialization: str | None = None
    notes: str | None = None


class FreelanceRegisterResponse(BaseModel):
    status: str = "active"


class FreelanceApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str
    linkedin_url: str | None
    years_experience: int | None
    specialization: str | None
    notes: str | None
    status: str
    created_at: datetime
