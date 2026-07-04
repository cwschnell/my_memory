from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey, Boolean, Numeric, Integer, LargeBinary
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from database import Base

class Client(Base):
    __tablename__ = "clients"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    name       = Column(Text, nullable=False, unique=True)

    recordings = relationship("Recording", back_populates="client")


class Recording(Base):
    __tablename__ = "recordings"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    audio_path    = Column(String, nullable=True)
    transcript    = Column(Text, nullable=False)
    summary       = Column(String(100), nullable=False)
    status        = Column(String(20), nullable=False, default="pending")
    date_recorded = Column(Date, nullable=True, server_default=func.current_date())
    type          = Column(String(20), nullable=False, default="memo")
    client_id     = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    user_email    = Column(String(255), nullable=True, index=True)

    client        = relationship("Client", back_populates="recordings")


class UserAuth(Base):
    __tablename__ = "user_auth"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    email          = Column(String(255), nullable=False, unique=True)
    pin            = Column(String(50), nullable=True)
    pin_expires_at = Column(DateTime(timezone=True), nullable=True)
    token          = Column(String(255), nullable=True, unique=True)
    role           = Column(String(20), default="user", nullable=True)


class AppRelease(Base):
    __tablename__ = "app_releases"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    version       = Column(String(50), nullable=False)
    apk_url       = Column(String(500), nullable=False)
    release_notes = Column(Text, nullable=True)


class Guest(Base):
    __tablename__ = "guests"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    full_name         = Column(String(255), nullable=False)
    email             = Column(String(255), nullable=True)
    phone             = Column(String(50), nullable=True)
    nationality       = Column(String(100), nullable=True)
    id_number         = Column(String(100), nullable=True)       # SA ID / national ID
    passport_number   = Column(String(100), nullable=True)       # passport document number
    date_of_birth     = Column(Date, nullable=True)
    date_of_issue     = Column(Date, nullable=True)
    date_of_expiry    = Column(Date, nullable=True)
    issuing_authority = Column(String(255), nullable=True)       # e.g. DEPT OF HOME AFFAIRS
    place_of_birth    = Column(String(100), nullable=True)       # e.g. ZAF
    passport_image    = Column(LargeBinary, nullable=True)       # raw JPEG/PNG bytes
    notes             = Column(Text, nullable=True)

    reservations = relationship("Reservation", back_populates="guest", cascade="all, delete-orphan")


class Reservation(Base):
    __tablename__ = "reservations"

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())
    guest_id           = Column(UUID(as_uuid=True), ForeignKey("guests.id", ondelete="CASCADE"), nullable=True)
    room_or_unit       = Column(String(100), nullable=True)
    check_in           = Column(Date, nullable=False)
    check_out          = Column(Date, nullable=False)
    num_adults         = Column(Integer, default=1)
    num_children       = Column(Integer, default=0)
    rate_per_night_usd = Column(Numeric(10, 2), default=0)
    total_usd          = Column(Numeric(10, 2), default=0)
    deposit_paid       = Column(Boolean, default=False)
    status             = Column(String(50), default="enquiry")  # enquiry, confirmed, checked_in, checked_out, cancelled
    source             = Column(String(50), default="direct")   # direct, booking.com, airbnb, agent, walk-in, other
    notes              = Column(Text, nullable=True)

    guest              = relationship("Guest", back_populates="reservations")


class LodgeTask(Base):
    __tablename__ = "lodge_tasks"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    title       = Column(String(255), nullable=False)
    assigned_to = Column(String(100), nullable=True)
    area        = Column(String(50), default="other")  # housekeeping, maintenance, kitchen, bar, reception, garden, boat, other
    due_date    = Column(Date, nullable=True)
    recurrence  = Column(String(20), default="none")   # none, daily, weekly, monthly
    is_complete = Column(Boolean, default=False)
    notes       = Column(Text, nullable=True)


class Incident(Base):
    __tablename__ = "incidents"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    title       = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    area        = Column(String(100), nullable=True)
    severity    = Column(String(20), default="medium")  # low, medium, high, critical
    reported_by = Column(String(100), nullable=True)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)


class DailyLog(Base):
    __tablename__ = "daily_log"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    log_date        = Column(Date, nullable=False, unique=True)
    occupancy_count = Column(Integer, default=0)
    revenue_usd     = Column(Numeric(10, 2), default=0)
    notes           = Column(Text, nullable=True)
    weather         = Column(String(100), nullable=True)
