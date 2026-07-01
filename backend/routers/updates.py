from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import os

from database import get_db
from models import AppRelease

router = APIRouter(prefix="/updates", tags=["updates"])

class LatestReleaseResponse(BaseModel):
    version: str
    apk_url: str
    release_notes: Optional[str] = None
    update_available: bool = False

class RegisterReleaseRequest(BaseModel):
    version: str
    apk_url: str
    release_notes: Optional[str] = None

@router.get("/latest", response_model=LatestReleaseResponse)
async def get_latest_update(current_version: str = "1.0.0", db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AppRelease).order_by(AppRelease.created_at.desc()))
    latest = result.scalars().first()

    default_supabase_url = os.getenv("SUPABASE_APK_URL", "https://supabase.co/storage/v1/object/public/apk/app-release.apk")
    
    if not latest:
        # Default fallback if no release registered in DB yet
        ver = os.getenv("LATEST_APK_VERSION", "1.0.0")
        return LatestReleaseResponse(
            version=ver,
            apk_url=default_supabase_url,
            release_notes="Standard memory app release.",
            update_available=(ver != current_version and ver > current_version)
        )

    is_newer = (latest.version != current_version and latest.version > current_version)
    return LatestReleaseResponse(
        version=latest.version,
        apk_url=latest.apk_url,
        release_notes=latest.release_notes,
        update_available=is_newer
    )

@router.post("/register", response_model=LatestReleaseResponse)
async def register_update(req: RegisterReleaseRequest, db: AsyncSession = Depends(get_db)):
    release = AppRelease(
        version=req.version,
        apk_url=req.apk_url,
        release_notes=req.release_notes
    )
    db.add(release)
    await db.commit()
    await db.refresh(release)
    return LatestReleaseResponse(
        version=release.version,
        apk_url=release.apk_url,
        release_notes=release.release_notes,
        update_available=True
    )
