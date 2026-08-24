from datetime import datetime

from pydantic import BaseModel


class BlacklistEntryOut(BaseModel):
    reason: str
    created_at: datetime


class BlacklistStatus(BaseModel):
    email: str
    blacklisted: bool
    entries: list[BlacklistEntryOut]
