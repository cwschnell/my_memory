from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Path, Header
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_, case
from sqlalchemy.orm import selectinload
from datetime import date
from typing import Optional, List, Dict
import aiofiles, os, uuid

from database import get_db
from models import Recording, Client, ShoppingItem
from schemas import RecordingOut, StatusUpdate, DateUpdate, ClientUpdate, TextUpdate, TranscriptPayload, ShoppingItemOut, ShoppingItemUpdate, TextRecordingCreate
from services.transcription import transcribe_audio
from services.summariser import summarise_to_three_words, categorize_shopping_item, extract_shopping_items, clean_transcript

router = APIRouter(prefix="/recordings", tags=["recordings"])
UPLOAD_DIR = "/app/uploads"

async def get_active_lodge_id(x_lodge_id: Optional[str] = Header(None, alias="X-Lodge-Id")) -> Optional[uuid.UUID]:
    if not x_lodge_id:
        return None
    try:
        return uuid.UUID(x_lodge_id)
    except ValueError:
        return None

@router.post("/upload", response_model=RecordingOut, status_code=201)
async def upload_recording(
    audio: UploadFile = File(...),
    type: str = Form("memo"),
    client_id: Optional[str] = Form(None),
    client_name: Optional[str] = Form(None),
    user_email: Optional[str] = Form(None),
    lodge_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """Receive audio from app, transcribe/translate, summarise, store."""
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

    # Summarise or Extract Shopping Items
    extracted_items = []
    try:
        if type == "shopping":
            extracted_items = await extract_shopping_items(transcript)
            summary = ", ".join(extracted_items) if extracted_items else transcript[:50]
        else:
            summary = await summarise_to_three_words(transcript)
    except Exception as e:
        import re
        words = re.findall(r'\b[A-Za-z0-9]+\b', transcript)
        summary = " ".join(words[:3]).title() if words else "New Voice Memo"

    # Handle client creation/lookup if provided
    target_client_id = None
    if client_id and client_id.strip() and client_id.strip().lower() not in ("null", "none"):
        try:
            target_client_id = uuid.UUID(client_id.strip())
        except ValueError:
            target_client_id = None

    if target_client_id is None and client_name and client_name.strip():
        name_clean = client_name.strip()
        existing = await db.execute(select(Client).where(Client.name.ilike(name_clean)))
        c_obj = existing.scalar_one_or_none()
        if c_obj:
            target_client_id = c_obj.id
        else:
            new_c = Client(name=name_clean)
            db.add(new_c)
            await db.commit()
            await db.refresh(new_c)
            target_client_id = new_c.id

    rec_type = type if type in ("memo", "shopping") else "memo"
    date_rec = date.today() if rec_type == "memo" else None

    target_lodge_id = None
    if lodge_id and lodge_id.strip() and lodge_id.strip().lower() not in ("null", "none"):
        try:
            target_lodge_id = uuid.UUID(lodge_id.strip())
        except ValueError:
            target_lodge_id = None

    recording = Recording(
        audio_path=filepath,
        transcript=transcript,
        summary=summary,
        status="pending",
        type=rec_type,
        client_id=target_client_id,
        date_recorded=date_rec,
        user_email=user_email,
        lodge_id=target_lodge_id
    )
    db.add(recording)
    await db.commit()
    
    # Extract & Populate ShoppingItem table if rec_type is shopping
    if rec_type == "shopping" and extracted_items:
        for item_str in extracted_items:
            clean_item_name = item_str.strip().title()
            if not clean_item_name:
                continue
            
            conds = [func.lower(ShoppingItem.item_name) == clean_item_name.lower()]
            if user_email:
                conds.append(ShoppingItem.user_email == user_email)
            if target_lodge_id:
                conds.append(ShoppingItem.lodge_id == target_lodge_id)

            stmt_item = select(ShoppingItem).where(and_(*conds))
            ex_res = await db.execute(stmt_item)
            existing_item = ex_res.scalars().first()
            if existing_item:
                existing_item.status = "active"
                existing_item.item_name = clean_item_name
                existing_item.recording_id = recording.id
                existing_item.created_at = func.now()
            else:
                new_item = ShoppingItem(
                    item_name=clean_item_name,
                    status="active",
                    recording_id=recording.id,
                    user_email=user_email,
                    lodge_id=target_lodge_id
                )
                db.add(new_item)
        await db.commit()

    # Reload with client relationship
    res = await db.execute(
        select(Recording).options(selectinload(Recording.client)).where(Recording.id == recording.id)
    )
    return res.scalar_one()

@router.post("/text", response_model=RecordingOut, status_code=201)
async def create_text_recording(
    payload: TextRecordingCreate,
    db: AsyncSession = Depends(get_db)
):
    """Receive typed text from app, summarise, extract items, store."""
    transcript = payload.text.strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    extracted_items = []
    try:
        if payload.type == "shopping":
            extracted_items = await extract_shopping_items(transcript)
            summary = ", ".join(extracted_items) if extracted_items else transcript[:50]
        else:
            summary = await summarise_to_three_words(transcript)
    except Exception as e:
        import re
        words = re.findall(r'\b[A-Za-z0-9]+\b', transcript)
        summary = " ".join(words[:3]).title() if words else "New Typed Memo"

    target_client_id = None
    if payload.client_id and payload.client_id.strip() and payload.client_id.strip().lower() not in ("null", "none"):
        try:
            target_client_id = uuid.UUID(payload.client_id.strip())
        except ValueError:
            target_client_id = None

    if target_client_id is None and payload.client_name and payload.client_name.strip():
        name_clean = payload.client_name.strip()
        existing = await db.execute(select(Client).where(Client.name.ilike(name_clean)))
        c_obj = existing.scalar_one_or_none()
        if c_obj:
            target_client_id = c_obj.id
        else:
            new_c = Client(name=name_clean)
            db.add(new_c)
            await db.commit()
            await db.refresh(new_c)
            target_client_id = new_c.id

    rec_type = payload.type if payload.type in ("memo", "shopping") else "memo"
    date_rec = date.today() if rec_type == "memo" else None

    target_lodge_id = None
    if payload.lodge_id and payload.lodge_id.strip() and payload.lodge_id.strip().lower() not in ("null", "none"):
        try:
            target_lodge_id = uuid.UUID(payload.lodge_id.strip())
        except ValueError:
            target_lodge_id = None

    recording = Recording(
        audio_path=None,
        transcript=transcript,
        summary=summary,
        status="pending",
        type=rec_type,
        client_id=target_client_id,
        date_recorded=date_rec,
        user_email=payload.user_email,
        lodge_id=target_lodge_id
    )
    db.add(recording)
    await db.commit()
    
    if rec_type == "shopping" and extracted_items:
        for item_str in extracted_items:
            clean_item_name = item_str.strip().title()
            if not clean_item_name:
                continue
            
            conds = [func.lower(ShoppingItem.item_name) == clean_item_name.lower()]
            if payload.user_email:
                conds.append(ShoppingItem.user_email == payload.user_email)
            if target_lodge_id:
                conds.append(ShoppingItem.lodge_id == target_lodge_id)

            stmt_item = select(ShoppingItem).where(and_(*conds))
            ex_res = await db.execute(stmt_item)
            existing_item = ex_res.scalars().first()
            if existing_item:
                existing_item.status = "active"
                existing_item.item_name = clean_item_name
                existing_item.recording_id = recording.id
                existing_item.created_at = func.now()
            else:
                new_item = ShoppingItem(
                    item_name=clean_item_name,
                    status="active",
                    recording_id=recording.id,
                    user_email=payload.user_email,
                    lodge_id=target_lodge_id
                )
                db.add(new_item)
        await db.commit()

    res = await db.execute(
        select(Recording).options(selectinload(Recording.client)).where(Recording.id == recording.id)
    )
    return res.scalar_one()

@router.get("/by-date/{date_str}", response_model=List[RecordingOut])
async def get_by_date(
    date_str: str = Path(..., description="Date in YYYY-MM-DD format"),
    user_email: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    lodge_id: Optional[uuid.UUID] = Depends(get_active_lodge_id)
):
    """
    Return all memo recordings for a specific date AND any past unresolved Urgent memos
    so Urgent messages stay on top of the list for all future days until marked Done.
    """
    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Date must be YYYY-MM-DD")

    conditions = [
        Recording.type == "memo",
        Recording.status != "done",
        Recording.date_recorded <= target_date
    ]
    if user_email:
        conditions.append(Recording.user_email == user_email)
    if lodge_id:
        conditions.append(Recording.lodge_id == lodge_id)

    stmt = (
        select(Recording)
        .options(selectinload(Recording.client))
        .where(and_(*conditions))
        .order_by(
            case((Recording.status == "urgent", 0), else_=1),
            Recording.created_at.desc()
        )
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/shopping/items", response_model=List[ShoppingItemOut])
async def get_shopping_items(
    user_email: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    lodge_id: Optional[uuid.UUID] = Depends(get_active_lodge_id)
):
    return await get_active_shopping_items(user_email, db, lodge_id)


@router.get("/shopping/active", response_model=List[ShoppingItemOut])
async def get_active_shopping_items(
    user_email: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    lodge_id: Optional[uuid.UUID] = Depends(get_active_lodge_id)
):
    """Return active shopping items for flat list display."""
    conditions = [ShoppingItem.status == "active"]
    if user_email:
        conditions.append(ShoppingItem.user_email == user_email)
    if lodge_id:
        conditions.append(ShoppingItem.lodge_id == lodge_id)
    stmt = (
        select(ShoppingItem)
        .where(and_(*conditions))
        .order_by(ShoppingItem.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.delete("/shopping/items/{item_id}")
async def delete_shopping_item_route(
    item_id: str,
    db: AsyncSession = Depends(get_db)
):
    return await delete_shopping_item(item_id, db)


@router.patch("/shopping/items/{item_id}/status")
async def delete_shopping_item(
    item_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Mark a shopping item as deleted/done."""
    try:
        item_uuid = uuid.UUID(item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    res = await db.execute(select(ShoppingItem).where(ShoppingItem.id == item_uuid))
    item = res.scalar_one_or_none()
    if not item:
        # Fallback: check if it's a recording ID
        rec_res = await db.execute(select(Recording).where(Recording.id == item_uuid))
        rec = rec_res.scalar_one_or_none()
        if rec:
            rec.status = "done"
            await db.commit()
            return {"message": "Recording marked done"}
        raise HTTPException(status_code=404, detail="Shopping item not found")

    item.status = "deleted"
    await db.commit()
    return {"message": "Item deleted"}


@router.put("/shopping/items/{item_id}", response_model=ShoppingItemOut)
async def update_shopping_item_name(
    item_id: str,
    update: ShoppingItemUpdate,
    db: AsyncSession = Depends(get_db)
):
    try:
        item_uuid = uuid.UUID(item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    res = await db.execute(select(ShoppingItem).where(ShoppingItem.id == item_uuid))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Shopping item not found")
    item.item_name = update.item_name
    await db.commit()
    await db.refresh(item)
    return item


@router.post("/shopping/items/{item_id}/clean", response_model=ShoppingItemOut)
async def clean_shopping_item(
    item_id: str,
    payload: TranscriptPayload,
    db: AsyncSession = Depends(get_db)
):
    try:
        item_uuid = uuid.UUID(item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    res = await db.execute(select(ShoppingItem).where(ShoppingItem.id == item_uuid))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Shopping item not found")
    cleaned = await clean_transcript(payload.transcript)
    item.item_name = cleaned
    await db.commit()
    await db.refresh(item)
    return item


@router.post("/shopping/items/{item_id}/resummarize", response_model=ShoppingItemOut)
async def resummarize_shopping_item(
    item_id: str,
    payload: TranscriptPayload,
    db: AsyncSession = Depends(get_db)
):
    try:
        item_uuid = uuid.UUID(item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    res = await db.execute(select(ShoppingItem).where(ShoppingItem.id == item_uuid))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Shopping item not found")
    try:
        cat_res = await categorize_shopping_item(payload.transcript)
        new_name = cat_res.get('item_name', payload.transcript)
    except Exception:
        new_name = payload.transcript
    item.item_name = new_name
    await db.commit()
    await db.refresh(item)
    return item



@router.get("/shopping/history", response_model=List[ShoppingItemOut])
async def get_shopping_history(
    user_email: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    lodge_id: Optional[uuid.UUID] = Depends(get_active_lodge_id)
):
    """Return historical deleted/done shopping list items."""
    conditions = [ShoppingItem.status != "active"]
    if user_email:
        conditions.append(ShoppingItem.user_email == user_email)
    if lodge_id:
        conditions.append(ShoppingItem.lodge_id == lodge_id)
    stmt = (
        select(ShoppingItem)
        .where(and_(*conditions))
        .order_by(ShoppingItem.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/calendar/done-counts")
async def get_calendar_done_counts(
    user_email: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    lodge_id: Optional[uuid.UUID] = Depends(get_active_lodge_id)
):
    """Return counts of completed ('done') memos grouped by date_recorded for calendar view."""
    conditions = [Recording.type == "memo", Recording.status == "done", Recording.date_recorded.isnot(None)]
    if user_email:
        conditions.append(Recording.user_email == user_email)
    if lodge_id:
        conditions.append(Recording.lodge_id == lodge_id)
    stmt = (
        select(Recording.date_recorded, func.count(Recording.id).label("count"))
        .where(and_(*conditions))
        .group_by(Recording.date_recorded)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return {row.date_recorded.isoformat(): row.count for row in rows}


@router.get("/calendar/done-by-date/{date_str}", response_model=List[RecordingOut])
async def get_done_by_date(
    date_str: str = Path(..., description="Date in YYYY-MM-DD format"),
    user_email: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    lodge_id: Optional[uuid.UUID] = Depends(get_active_lodge_id)
):
    """Return all completed ('done') memos for a specific past date."""
    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Date must be YYYY-MM-DD")

    conditions = [Recording.type == "memo", Recording.status == "done", Recording.date_recorded == target_date]
    if user_email:
        conditions.append(Recording.user_email == user_email)
    if lodge_id:
        conditions.append(Recording.lodge_id == lodge_id)
    stmt = (
        select(Recording)
        .options(selectinload(Recording.client))
        .where(and_(*conditions))
        .order_by(Recording.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/postponed", response_model=List[RecordingOut])
async def get_postponed_memos(
    user_email: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    lodge_id: Optional[uuid.UUID] = Depends(get_active_lodge_id)
):
    """
    Return all postponed memo recordings with date_recorded >= today (today and future dates).
    """
    today = date.today()
    conditions = [
        Recording.type == "memo",
        Recording.status == "postpone",
        Recording.date_recorded >= today
    ]
    if user_email:
        conditions.append(Recording.user_email == user_email)
    if lodge_id:
        conditions.append(Recording.lodge_id == lodge_id)

    stmt = (
        select(Recording)
        .options(selectinload(Recording.client))
        .where(and_(*conditions))
        .order_by(Recording.date_recorded.asc(), Recording.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{recording_id}", response_model=RecordingOut)
async def get_recording(recording_id: str, db: AsyncSession = Depends(get_db)):
    """Fetch a single recording by ID."""
    try:
        rec_uuid = uuid.UUID(recording_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    result = await db.execute(
        select(Recording).options(selectinload(Recording.client)).where(Recording.id == rec_uuid)
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
        select(Recording).options(selectinload(Recording.client)).where(Recording.id == rec_uuid)
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    rec.status = update.status
    await db.commit()
    await db.refresh(rec)
    return rec


@router.patch("/{recording_id}/date", response_model=RecordingOut)
async def update_date(
    recording_id: str,
    update: DateUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Reschedule date_recorded for a memo."""
    try:
        rec_uuid = uuid.UUID(recording_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    result = await db.execute(
        select(Recording).options(selectinload(Recording.client)).where(Recording.id == rec_uuid)
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    rec.date_recorded = update.date_recorded
    await db.commit()
    await db.refresh(rec)
    return rec


@router.patch("/{recording_id}/client", response_model=RecordingOut)
async def update_client(
    recording_id: str,
    update: ClientUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update or assign client_id for a recording."""
    try:
        rec_uuid = uuid.UUID(recording_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    result = await db.execute(
        select(Recording).options(selectinload(Recording.client)).where(Recording.id == rec_uuid)
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    rec.client_id = update.client_id
    await db.commit()
    await db.refresh(rec)
    return rec


@router.patch("/{recording_id}/text", response_model=RecordingOut)
async def update_text(
    recording_id: str,
    update: TextUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update summary and transcript of a recording."""
    try:
        rec_uuid = uuid.UUID(recording_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    result = await db.execute(
        select(Recording).options(selectinload(Recording.client)).where(Recording.id == rec_uuid)
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    
    rec.summary = update.summary
    rec.transcript = update.transcript
    await db.commit()
    await db.refresh(rec)
    return rec


@router.post("/{recording_id}/resummarize", response_model=RecordingOut)
async def resummarize_recording(
    recording_id: str,
    payload: TranscriptPayload,
    db: AsyncSession = Depends(get_db)
):
    """Generate a new summary based on the provided transcript and update the recording."""
    try:
        rec_uuid = uuid.UUID(recording_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    result = await db.execute(
        select(Recording).options(selectinload(Recording.client)).where(Recording.id == rec_uuid)
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")

    try:
        if rec.type == "shopping":
            cat_res = await categorize_shopping_item(payload.transcript)
            new_summary = f"[{cat_res['category']}] {cat_res['item_name']}"
        else:
            new_summary = await summarise_to_three_words(payload.transcript)
    except Exception as e:
        import re
        words = re.findall(r'\b[A-Za-z0-9]+\b', payload.transcript)
        new_summary = " ".join(words[:3]).title() if words else "New Voice Memo"

    rec.transcript = payload.transcript
    rec.summary = new_summary
    await db.commit()
    await db.refresh(rec)
    return rec


@router.post("/{recording_id}/clean-transcript", response_model=RecordingOut)
async def clean_recording_transcript(
    recording_id: str,
    payload: TranscriptPayload,
    db: AsyncSession = Depends(get_db)
):
    """Use LLM to clean up the transcript spelling/grammar and return the updated recording."""
    try:
        rec_uuid = uuid.UUID(recording_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    result = await db.execute(
        select(Recording).options(selectinload(Recording.client)).where(Recording.id == rec_uuid)
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")

    cleaned = await clean_transcript(payload.transcript)
    
    rec.transcript = cleaned
    await db.commit()
    await db.refresh(rec)
    return rec



@router.delete("/{recording_id}", status_code=204)
async def delete_recording(recording_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a recording from database and delete audio file from disk."""
    try:
        rec_uuid = uuid.UUID(recording_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    result = await db.execute(select(Recording).where(Recording.id == rec_uuid))
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")

    # Remove file if it exists
    if rec.audio_path and os.path.exists(rec.audio_path):
        try:
            os.remove(rec.audio_path)
        except Exception:
            pass

    await db.delete(rec)
    await db.commit()
    return None
