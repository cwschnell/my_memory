from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional
import uuid

class RecordingOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    transcript: str
    summary: str
    status: str
    date_recorded: date

    model_config = {"from_attributes": True}

class StatusUpdate(BaseModel):
    status: str  # urgent | done | postpone | pending
