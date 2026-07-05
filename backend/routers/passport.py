from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Guest
import base64
import os
import json
import re
import httpx
import logging

logger = logging.getLogger("passport")

router = APIRouter(prefix="/passport", tags=["passport"])

# Load NVIDIA API Key with local file fallback
NVIDIA_API_KEY = os.getenv("NVIDIA-KEY") or os.getenv("NVIDIA_API_KEY")
if not NVIDIA_API_KEY:
    try:
        secrets_path = r"c:\Users\Andrisa\Documents\Projects\mem_assist\secrets\nvapi-pgmqbRBYjl1Htlp0uOz0hz_NE3fp9.txt"
        if os.path.exists(secrets_path):
            with open(secrets_path, "r") as f:
                NVIDIA_API_KEY = f.read().strip()
    except Exception as e:
        logger.warning(f"Failed to load local NVIDIA key from secrets folder: {e}")

NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

PASSPORT_PROMPT = """
You are a passport OCR extraction system. Analyse this passport image and extract every field visible.
Return ONLY a valid JSON object with exactly these keys (use null for any field not visible):

{
  "full_name": "SURNAME GIVEN_NAMES as a single string, given name first",
  "nationality": "nationality as written on passport",
  "passport_number": "document/passport number",
  "id_number": "national identity number if present",
  "date_of_birth": "YYYY-MM-DD",
  "date_of_issue": "YYYY-MM-DD",
  "date_of_expiry": "YYYY-MM-DD",
  "issuing_authority": "issuing authority as written",
  "place_of_birth": "place or country code of birth",
  "sex": "M or F",
  "country_code": "3-letter country code e.g. ZAF"
}

Rules:
- Dates MUST be in YYYY-MM-DD format. Convert "02 SEP 1952" → "1952-09-02".
- Pay extreme attention to the Date of Issue and Date of Expiry! They are critical. Locate them carefully on the personal details page (often labeled 'Date of issue / Date de délivrance' and 'Date of expiry / Date d'expiration'). Extract both and format them as YYYY-MM-DD.
- full_name: given name first, then surname. E.g. "CHRISTOPH WILHELM SCHNELL".
- Do not include any markdown formatting or text outside the JSON object.
- If you cannot read a field clearly, set it to null rather than guessing.
"""

@router.post("/scan")
async def scan_passport(file: UploadFile = File(...)):
    """
    Accept a passport image upload, send to NVIDIA NIM Vision API, return extracted fields as JSON.
    Does NOT save to DB — the client saves the guest profile separately.
    """
    if not NVIDIA_API_KEY:
        raise HTTPException(status_code=500, detail="NVIDIA_API_KEY not configured on server")

    # Read image bytes
    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:  # 10 MB guard
        raise HTTPException(status_code=413, detail="Image too large. Max 10 MB.")

    # Determine media type
    content_type = file.content_type or "image/jpeg"
    if content_type not in ("image/jpeg", "image/png", "image/webp"):
        content_type = "image/jpeg"

    # Base64 encode
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    # Build prompt payload
    payload = {
        "model": "meta/llama-3.2-11b-vision-instruct",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": PASSPORT_PROMPT
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{content_type};base64,{image_b64}"
                        }
                    }
                ]
            }
        ],
        "temperature": 0.1,
        "max_tokens": 1024
    }

    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(NVIDIA_URL, json=payload, headers=headers)
            if resp.status_code != 200:
                logger.error(f"NVIDIA API responded with status {resp.status_code}: {resp.text}")
                raise HTTPException(status_code=502, detail=f"NVIDIA API responded with status {resp.status_code}")
            
            res_json = resp.json()
            raw_text = res_json["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.error(f"NVIDIA request failed: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to contact NVIDIA API: {e}")

    # Robust JSON extraction
    start_idx = raw_text.find("{")
    end_idx = raw_text.rfind("}")
    if start_idx != -1 and end_idx != -1:
        json_str = raw_text[start_idx:end_idx+1]
    else:
        # Strip markdown fences if present
        json_str = re.sub(r"^```(?:json)?\s*", "", raw_text)
        json_str = re.sub(r"\s*```$", "", json_str).strip()

    try:
        extracted = json.loads(json_str)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"NVIDIA returned non-JSON content: {raw_text[:300]}")

    return {"success": True, "data": extracted}


@router.post("/guests/{guest_id}/passport-image")
async def upload_passport_image(
    guest_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Store the raw passport image bytes into the guest record in PostgreSQL.
    """
    import uuid
    try:
        g_uuid = uuid.UUID(guest_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid guest UUID format")

    result = await db.execute(select(Guest).where(Guest.id == g_uuid))
    guest = result.scalar_one_or_none()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    image_bytes = await file.read()
    guest.passport_image = image_bytes
    await db.commit()
    return {"success": True, "message": "Passport image stored successfully"}


@router.get("/guests/{guest_id}/passport-image")
async def get_passport_image(
    guest_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Return the stored passport image.
    """
    import uuid
    try:
        g_uuid = uuid.UUID(guest_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid guest UUID format")

    result = await db.execute(select(Guest).where(Guest.id == g_uuid))
    guest = result.scalar_one_or_none()
    if not guest or not guest.passport_image:
        raise HTTPException(status_code=404, detail="No passport image found")
    return Response(content=guest.passport_image, media_type="image/jpeg")


@router.get("/search")
async def search_passports_by_date(
    date: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Search for guests who have a reservation overlapping the specified date (YYYY-MM-DD).
    """
    from datetime import datetime, date as date_type
    from models import Reservation
    try:
        parsed_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    stmt = (
        select(Guest)
        .join(Reservation, Guest.id == Reservation.guest_id)
        .where(Reservation.check_in <= parsed_date)
        .where(Reservation.check_out >= parsed_date)
        .distinct()
    )
    result = await db.execute(stmt)
    guests = result.scalars().all()
    
    out = []
    for g in guests:
        out.append({
            "id": str(g.id),
            "full_name": g.full_name,
            "passport_number": g.passport_number,
            "id_number": g.id_number,
            "nationality": g.nationality,
            "has_passport_image": bool(g.passport_image),
            "date_of_expiry": g.date_of_expiry.isoformat() if g.date_of_expiry else None,
            "place_of_birth": g.place_of_birth,
            "user_email": g.user_email
        })
    return out
