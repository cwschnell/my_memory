from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import engine, Base
from routers import recordings, clients, auth, updates, lodge, passport
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async def init_db():
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                try:
                    from sqlalchemy import text
                    logger.info("Running table migrations...")
                    await conn.execute(text("ALTER TABLE user_auth ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'"))
                    await conn.execute(text("ALTER TABLE user_auth ALTER COLUMN pin TYPE VARCHAR(50)"))
                    await conn.execute(text("ALTER TABLE recordings ADD COLUMN IF NOT EXISTS user_email VARCHAR(255)"))
                    await conn.execute(text("UPDATE recordings SET user_email = 'andrisa.schnell@gmail.com' WHERE user_email IS NULL"))
                    await conn.execute(text("ALTER TABLE guests ADD COLUMN IF NOT EXISTS passport_number VARCHAR(100)"))
                    await conn.execute(text("ALTER TABLE guests ADD COLUMN IF NOT EXISTS date_of_birth DATE"))
                    await conn.execute(text("ALTER TABLE guests ADD COLUMN IF NOT EXISTS date_of_issue DATE"))
                    await conn.execute(text("ALTER TABLE guests ADD COLUMN IF NOT EXISTS date_of_expiry DATE"))
                    await conn.execute(text("ALTER TABLE guests ADD COLUMN IF NOT EXISTS issuing_authority VARCHAR(255)"))
                    await conn.execute(text("ALTER TABLE guests ADD COLUMN IF NOT EXISTS place_of_birth VARCHAR(100)"))
                    await conn.execute(text("ALTER TABLE guests ADD COLUMN IF NOT EXISTS passport_image BYTEA"))
                    logger.info("Table migrations completed.")
                except Exception as ex:
                    logger.warning(f"Column migration warning: {ex}")
        await asyncio.wait_for(init_db(), timeout=25.0)
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.error(f"Database initialization warning/timeout during startup: {e}")
    yield

app = FastAPI(title="My Memory API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recordings.router)
app.include_router(clients.router)
app.include_router(auth.router)
app.include_router(updates.router)
app.include_router(lodge.router)
app.include_router(passport.router)

@app.get("/")
async def root():
    return {"message": "My Memory API is online and healthy", "docs": "/docs", "health": "/health"}

@app.get("/health")
async def health():
    return {"status": "ok"}
