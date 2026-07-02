from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta, timezone
import random, uuid, os, logging
from typing import Optional, List

from database import get_db
from models import UserAuth

logger = logging.getLogger("auth")

router = APIRouter(prefix="/auth", tags=["auth"])

SUPER_ADMIN_EMAIL = "andrisa.schnell@gmail.com"
SUPER_ADMIN_PIN = "385138"

class SendPinRequest(BaseModel):
    email: str

class VerifyPinRequest(BaseModel):
    email: str
    pin: str

class RegisterRequest(BaseModel):
    email: str
    pin: str

class AuthResponse(BaseModel):
    token: str
    email: str
    role: str = "user"

class AdminUserOut(BaseModel):
    id: str
    email: str
    pin: Optional[str] = None
    role: str = "user"
    created_at: str

class AdminUserCreate(BaseModel):
    admin_email: str
    email: str
    pin: str
    role: str = "user"

class AdminUserUpdate(BaseModel):
    admin_email: str
    email: Optional[str] = None
    pin: Optional[str] = None
    role: Optional[str] = None

async def ensure_super_admin(db: AsyncSession):
    result = await db.execute(select(UserAuth).where(UserAuth.email == SUPER_ADMIN_EMAIL))
    admin = result.scalar_one_or_none()
    if not admin:
        admin = UserAuth(
            email=SUPER_ADMIN_EMAIL,
            pin=SUPER_ADMIN_PIN,
            role="admin"
        )
        db.add(admin)
        await db.commit()
    elif admin.role != "admin" or admin.pin != SUPER_ADMIN_PIN:
        admin.role = "admin"
        admin.pin = SUPER_ADMIN_PIN
        await db.commit()
    return admin

async def verify_admin_access(admin_email: str, db: AsyncSession):
    clean_email = admin_email.strip().lower()
    await ensure_super_admin(db)
    result = await db.execute(select(UserAuth).where(UserAuth.email == clean_email))
    user = result.scalar_one_or_none()
    if not user or getattr(user, "role", "user") != "admin":
        if clean_email != SUPER_ADMIN_EMAIL:
            raise HTTPException(status_code=403, detail="Super Admin privileges required.")
    return user

@router.post("/register", response_model=AuthResponse)
async def register_user(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    email_clean = req.email.strip().lower()
    pin_clean = req.pin.strip()

    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Invalid email address.")
    if len(pin_clean) < 4 or len(pin_clean) > 20:
        raise HTTPException(status_code=400, detail="PIN must be between 4 and 20 digits.")

    await ensure_super_admin(db)

    result = await db.execute(select(UserAuth).where(UserAuth.email == email_clean))
    user = result.scalar_one_or_none()

    role = "user"
    if email_clean == SUPER_ADMIN_EMAIL:
        role = "admin"
        pin_clean = SUPER_ADMIN_PIN

    if user:
        # Update existing user permanent PIN
        user.pin = pin_clean
        user.pin_expires_at = None
        if email_clean == SUPER_ADMIN_EMAIL:
            user.role = "admin"
    else:
        user = UserAuth(
            email=email_clean,
            pin=pin_clean,
            pin_expires_at=None,
            role=role
        )
        db.add(user)

    token = uuid.uuid4().hex + uuid.uuid4().hex
    user.token = token
    await db.commit()

    return AuthResponse(token=token, email=email_clean, role=getattr(user, "role", role) or role)

@router.post("/verify-pin", response_model=AuthResponse)
@router.post("/login", response_model=AuthResponse)
async def verify_pin(req: VerifyPinRequest, db: AsyncSession = Depends(get_db)):
    email_clean = req.email.strip().lower()
    pin_clean = req.pin.strip()

    await ensure_super_admin(db)

    result = await db.execute(select(UserAuth).where(UserAuth.email == email_clean))
    user = result.scalar_one_or_none()

    if email_clean == SUPER_ADMIN_EMAIL and pin_clean == SUPER_ADMIN_PIN:
        if not user:
            user = await ensure_super_admin(db)
        token = uuid.uuid4().hex + uuid.uuid4().hex
        user.token = token
        user.role = "admin"
        user.pin = SUPER_ADMIN_PIN
        await db.commit()
        return AuthResponse(token=token, email=email_clean, role="admin")

    if not user or not user.pin or user.pin != pin_clean:
        raise HTTPException(status_code=401, detail="Invalid Email or PIN.")

    now = datetime.now(timezone.utc)
    if user.pin_expires_at:
        exp = user.pin_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < now:
            raise HTTPException(status_code=401, detail="Temporary PIN has expired. Please register your permanent PIN.")

    token = uuid.uuid4().hex + uuid.uuid4().hex
    user.token = token
    # Keep permanent PIN intact so users can log in again anytime
    await db.commit()

    role = getattr(user, "role", "user") or "user"
    return AuthResponse(token=token, email=email_clean, role=role)

@router.post("/send-pin")
async def send_pin(req: SendPinRequest, db: AsyncSession = Depends(get_db)):
    # Legacy endpoint: auto-generates a temporary PIN or returns existing PIN
    email_clean = req.email.strip().lower()
    await ensure_super_admin(db)
    result = await db.execute(select(UserAuth).where(UserAuth.email == email_clean))
    user = result.scalar_one_or_none()

    if user and user.pin:
        pin = user.pin
    else:
        pin = f"{random.randint(100000, 999999)}"
        if user:
            user.pin = pin
            user.pin_expires_at = None
        else:
            user = UserAuth(email=email_clean, pin=pin, role="user")
            db.add(user)
        await db.commit()

    return {
        "status": "ok",
        "message": f"Login PIN for {email_clean} is: {pin}",
        "dev_pin": pin
    }

@router.get("/get-pin")
async def get_pin(email: str, db: AsyncSession = Depends(get_db)):
    email_clean = email.strip().lower()
    result = await db.execute(select(UserAuth).where(UserAuth.email == email_clean))
    user = result.scalar_one_or_none()
    if not user or not user.pin:
        raise HTTPException(status_code=404, detail="No active PIN found for this email.")
    return {"email": email_clean, "pin": user.pin}

# ==========================================
# SUPER ADMIN USER MANAGEMENT ENDPOINTS
# ==========================================

@router.get("/admin/users", response_model=List[AdminUserOut])
async def admin_list_users(admin_email: str, db: AsyncSession = Depends(get_db)):
    await verify_admin_access(admin_email, db)
    result = await db.execute(select(UserAuth).order_by(UserAuth.created_at.desc()))
    users = result.scalars().all()
    out = []
    for u in users:
        out.append(AdminUserOut(
            id=str(u.id),
            email=u.email,
            pin=u.pin,
            role=getattr(u, "role", "user") or "user",
            created_at=u.created_at.isoformat() if u.created_at else ""
        ))
    return out

@router.post("/admin/users", response_model=AdminUserOut)
async def admin_create_user(req: AdminUserCreate, db: AsyncSession = Depends(get_db)):
    await verify_admin_access(req.admin_email, db)
    email_clean = req.email.strip().lower()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Invalid email address.")

    result = await db.execute(select(UserAuth).where(UserAuth.email == email_clean))
    existing = result.scalar_one_or_none()
    if existing:
        existing.pin = req.pin.strip()
        existing.role = req.role or "user"
        await db.commit()
        u = existing
    else:
        u = UserAuth(
            email=email_clean,
            pin=req.pin.strip(),
            role=req.role or "user"
        )
        db.add(u)
        await db.commit()

    return AdminUserOut(
        id=str(u.id),
        email=u.email,
        pin=u.pin,
        role=getattr(u, "role", "user") or "user",
        created_at=u.created_at.isoformat() if u.created_at else ""
    )

@router.put("/admin/users/{user_id}", response_model=AdminUserOut)
async def admin_update_user(user_id: str, req: AdminUserUpdate, db: AsyncSession = Depends(get_db)):
    await verify_admin_access(req.admin_email, db)
    result = await db.execute(select(UserAuth).where(UserAuth.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if req.email:
        user.email = req.email.strip().lower()
    if req.pin is not None:
        user.pin = req.pin.strip()
    if req.role is not None:
        user.role = req.role

    await db.commit()
    return AdminUserOut(
        id=str(user.id),
        email=user.email,
        pin=user.pin,
        role=getattr(user, "role", "user") or "user",
        created_at=user.created_at.isoformat() if user.created_at else ""
    )

@router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin_email: str, db: AsyncSession = Depends(get_db)):
    await verify_admin_access(admin_email, db)
    result = await db.execute(select(UserAuth).where(UserAuth.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.email == SUPER_ADMIN_EMAIL:
        raise HTTPException(status_code=400, detail="Cannot delete Super Admin.")

    await db.delete(user)
    await db.commit()
    return {"status": "ok", "message": f"User {user.email} deleted."}
