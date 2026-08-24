import uuid

from pydantic import BaseModel, ConfigDict, EmailStr


class RecruiterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    email: str
    role: str
    status: str


class RecruiterInvite(BaseModel):
    full_name: str
    email: EmailStr
    password: str


class ReassignJobsRequest(BaseModel):
    to_recruiter_id: uuid.UUID
