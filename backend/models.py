from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey
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
