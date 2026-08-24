from pydantic import BaseModel, EmailStr


class FreelanceRegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    phone: str | None = None
    linkedin_url: str | None = None
    years_experience: int | None = None
    specialization: str | None = None
    notes: str | None = None


class FreelanceRegisterResponse(BaseModel):
    status: str = "pending_approval"
