from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import engine, Base
from routers import recordings, clients, auth, updates
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.error(f"Database initialization error during startup: {e}")
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

@app.get("/")
async def root():
    return {"message": "My Memory API is online and healthy", "docs": "/docs", "health": "/health"}

@app.get("/health")
async def health():
    return {"status": "ok"}
