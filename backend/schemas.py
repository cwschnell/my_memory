from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional
import uuid

class ClientOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    name: str

    model_config = {"from_attributes": True}

class ClientCreate(BaseModel):
    name: str

class RecordingOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    transcript: str
    summary: str
    status: str
    date_recorded: Optional[date] = None
    type: str
    client_id: Optional[uuid.UUID] = None
    client: Optional[ClientOut] = None
    user_email: Optional[str] = None

    model_config = {"from_attributes": True}

class StatusUpdate(BaseModel):
    status: str  # urgent | done | postpone | pending

class DateUpdate(BaseModel):
    date_recorded: date

class ClientUpdate(BaseModel):
    client_id: Optional[uuid.UUID] = None


# Lodge Schemas

class GuestCreate(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    nationality: Optional[str] = None
    id_number: Optional[str] = None
    passport_number: Optional[str] = None
    date_of_birth: Optional[str] = None
    date_of_issue: Optional[str] = None
    date_of_expiry: Optional[str] = None
    issuing_authority: Optional[str] = None
    place_of_birth: Optional[str] = None
    user_email: Optional[str] = None
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    notes: Optional[str] = None

class GuestOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    nationality: Optional[str] = None
    id_number: Optional[str] = None
    passport_number: Optional[str] = None
    date_of_birth: Optional[date] = None
    date_of_issue: Optional[date] = None
    date_of_expiry: Optional[date] = None
    issuing_authority: Optional[str] = None
    place_of_birth: Optional[str] = None
    user_email: Optional[str] = None
    notes: Optional[str] = None
    has_passport_image: bool = False

    model_config = {"from_attributes": True}


class ReservationCreate(BaseModel):
    guest_id: Optional[uuid.UUID] = None
    room_or_unit: Optional[str] = None
    check_in: date
    check_out: date
    num_adults: int = 1
    num_children: int = 0
    rate_per_night_usd: float = 0.0
    total_usd: float = 0.0
    deposit_paid: bool = False
    status: str = "enquiry"
    source: str = "direct"
    notes: Optional[str] = None

class ReservationOut(ReservationCreate):
    id: uuid.UUID
    created_at: datetime
    guest: Optional[GuestOut] = None

    model_config = {"from_attributes": True}


class LodgeTaskCreate(BaseModel):
    title: str
    assigned_to: Optional[str] = None
    area: str = "other"
    due_date: Optional[date] = None
    recurrence: str = "none"
    is_complete: bool = False
    notes: Optional[str] = None

class LodgeTaskOut(LodgeTaskCreate):
    id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class IncidentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    area: Optional[str] = None
    severity: str = "medium"
    reported_by: Optional[str] = None
    is_resolved: bool = False

class IncidentOut(IncidentCreate):
    id: uuid.UUID
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DailyLogCreate(BaseModel):
    log_date: date
    occupancy_count: int = 0
    revenue_usd: float = 0.0
    notes: Optional[str] = None
    weather: Optional[str] = None

class DailyLogOut(DailyLogCreate):
    id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
