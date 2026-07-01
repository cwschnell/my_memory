from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta, timezone
import random, uuid, os, logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from database import get_db
from models import UserAuth

logger = logging.getLogger("auth")

router = APIRouter(prefix="/auth", tags=["auth"])

class SendPinRequest(BaseModel):
    email: str

class VerifyPinRequest(BaseModel):
    email: str
    pin: str

class AuthResponse(BaseModel):
    token: str
    email: str

def send_pin_email(to_email: str, pin: str):
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")

    # Always log clearly for immediate local development / verification
    logger.info(f"\n=========================================\n🔑 [2FA LOGIN PIN] For {to_email}: {pin}\n=========================================\n")

    if not (smtp_host and smtp_user and smtp_pass):
        logger.warning(f"SMTP credentials not fully set. Logged PIN {pin} for {to_email} to server console.")
        return

    try:
        msg = MIMEMultipart()
        msg["From"] = smtp_user
        msg["To"] = to_email
        msg["Subject"] = f"Your Login PIN: {pin}"

        body = f"Hello,\n\nYour 4-digit login PIN for My Memory App is: {pin}\n\nIt expires in 15 minutes.\n\nThanks,\nMy Memory Team"
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        logger.info(f"Sent 2FA PIN email to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send email via SMTP: {e}")

@router.post("/send-pin")
async def send_pin(req: SendPinRequest, db: AsyncSession = Depends(get_db)):
    email_clean = req.email.strip().lower()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Invalid email address.")

    pin = f"{random.randint(1000, 9999)}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    result = await db.execute(select(UserAuth).where(UserAuth.email == email_clean))
    user = result.scalar_one_or_none()

    if user:
        user.pin = pin
        user.pin_expires_at = expires_at
    else:
        user = UserAuth(
            email=email_clean,
            pin=pin,
            pin_expires_at=expires_at
        )
        db.add(user)

    await db.commit()
    smtp_set = bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_USER") and os.getenv("SMTP_PASS"))
    send_pin_email(email_clean, pin)
    
    resp = {"status": "ok", "message": f"4-digit PIN sent to {email_clean}"}
    if not smtp_set:
        resp["dev_pin"] = pin
        resp["message"] = f"[DEV MODE] SMTP not configured on server. Your 4-digit PIN is: {pin}"
    return resp

@router.get("/get-pin")
async def get_pin(email: str, db: AsyncSession = Depends(get_db)):
    email_clean = email.strip().lower()
    result = await db.execute(select(UserAuth).where(UserAuth.email == email_clean))
    user = result.scalar_one_or_none()
    if not user or not user.pin:
        raise HTTPException(status_code=404, detail="No active PIN found for this email.")
    return {"email": email_clean, "pin": user.pin}

@router.post("/verify-pin", response_model=AuthResponse)
async def verify_pin(req: VerifyPinRequest, db: AsyncSession = Depends(get_db)):
    email_clean = req.email.strip().lower()
    pin_clean = req.pin.strip()

    result = await db.execute(select(UserAuth).where(UserAuth.email == email_clean))
    user = result.scalar_one_or_none()

    if not user or not user.pin or user.pin != pin_clean:
        raise HTTPException(status_code=401, detail="Invalid 4-digit PIN.")

    # Check expiration robustly
    now = datetime.now(timezone.utc)
    if user.pin_expires_at:
        exp = user.pin_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < now:
            raise HTTPException(status_code=401, detail="PIN has expired. Please request a new one.")

    # Generate persistent session token
    token = uuid.uuid4().hex + uuid.uuid4().hex
    user.token = token
    user.pin = None # clear PIN once used
    await db.commit()

    return AuthResponse(token=token, email=email_clean)
