from sqlalchemy import Column, String, Text, Date, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from database import Base

class Recording(Base):
    __tablename__ = "recordings"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    audio_path    = Column(String, nullable=True)
    transcript    = Column(Text, nullable=False)
    summary       = Column(String(100), nullable=False)
    status        = Column(String(20), nullable=False, default="pending")
    date_recorded = Column(Date, nullable=False, server_default=func.current_date())
