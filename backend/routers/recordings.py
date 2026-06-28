from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Path
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
import aiofiles, os, uuid

from database import get_db
from models import Recording
from schemas import RecordingOut, StatusUpdate
from services.transcription import transcribe_audio
from services.summariser import summarise_to_three_words

router = APIRouter(prefix="/recordings", tags=["recordings"])
UPLOAD_DIR = "/app/uploads"

@router.post("/upload", response_model=RecordingOut, status_code=201)
async def upload_recording(
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Receive audio from Flutter app, transcribe/translate, summarise, store."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"{uuid.uuid4()}_{audio.filename}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    # Save audio file
    async with aiofiles.open(filepath, "wb") as f:
        content = await audio.read()
        await f.write(content)

    # Transcribe & Translate to English
    try:
        transcript = await transcribe_audio(filepath)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    # Summarise
    try:
        summary = await summarise_to_three_words(transcript)
    except Exception as e:
        summary = "Voice Note Recorded"

    # Store in DB
    recording = Recording(
        audio_path=filepath,
        transcript=transcript,
        summary=summary,
        status="pending"
    )
    db.add(recording)
    await db.commit()
    await db.refresh(recording)
    return recording


@router.get("/by-date/{date_str}", response_model=list[RecordingOut])
async def get_by_date(
    date_str: str = Path(..., description="Date in YYYY-MM-DD format"),
    db: AsyncSession = Depends(get_db)
):
    """Return all recordings for a specific date (for date picker)."""
    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Date must be YYYY-MM-DD")

    result = await db.execute(
        select(Recording)
        .where(Recording.date_recorded == target_date)
        .order_by(Recording.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{recording_id}", response_model=RecordingOut)
async def get_recording(recording_id: str, db: AsyncSession = Depends(get_db)):
    """Fetch a single full recording by ID (for deep-link)."""
    try:
        rec_uuid = uuid.UUID(recording_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    result = await db.execute(
        select(Recording).where(Recording.id == rec_uuid)
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    return rec


@router.patch("/{recording_id}/status", response_model=RecordingOut)
async def update_status(
    recording_id: str,
    update: StatusUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update status: urgent | done | postpone | pending."""
    if update.status not in ("urgent", "done", "postpone", "pending"):
        raise HTTPException(status_code=400, detail="Invalid status value")
        
    try:
        rec_uuid = uuid.UUID(recording_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    result = await db.execute(
        select(Recording).where(Recording.id == rec_uuid)
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    rec.status = update.status
    await db.commit()
    await db.refresh(rec)
    return rec
