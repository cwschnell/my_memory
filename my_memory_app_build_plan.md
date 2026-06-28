# My Memory App — Agentic Build Plan
> **Target Harness:** Claude Code / Antigravity 2.0  
> **Read this file top-to-bottom. Execute each phase in order. Do not skip phases.**  
> **Project root (desktop):** `C:\Users\Andrisa\Documents\Projects\mem_assist`  
> **Android app:** Flutter/Dart — app name `my_memory`  
> **Backend:** Python (FastAPI) + PostgreSQL + Supabase + React/Vite (admin/web viewer)  
> **Transcription service:** OpenAI Whisper API (cloud, requires OPENAI_API_KEY)  
> **Summarisation:** Claude API via `claude-haiku-3-5` (requires ANTHROPIC_API_KEY)  

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Android Phone                       │
│   Flutter/Dart app "My Memory"                       │
│   - Record voice → send audio file via HTTP POST     │
│   - Date picker → fetch 3-word summaries for day     │
│   - Tap summary → deep-link to full message view     │
│   - Status column: Urgent / Done / Postpone          │
└───────────────────┬─────────────────────────────────┘
                    │ HTTP (local WiFi or tunnel)
                    ▼
┌─────────────────────────────────────────────────────┐
│        Docker Desktop Container (Windows)            │
│        Path: C:\Users\Andrisa\Documents\             │
│               Projects\mem_assist                    │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  FastAPI     │  │  PostgreSQL  │  │  React/   │  │
│  │  Python      │◄─►  (via       │  │  Vite     │  │
│  │  Backend     │  │  Supabase)   │  │  Web UI   │  │
│  └──────┬───────┘  └──────────────┘  └───────────┘  │
│         │                                            │
│         ├──► OpenAI Whisper API (transcription)      │
│         └──► Anthropic Claude API (summarisation)    │
└─────────────────────────────────────────────────────┘
```

---

## Environment Variables Required
Create a file `C:\Users\Andrisa\Documents\Projects\mem_assist\.env` with:

```env
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DATABASE_URL=postgresql://memuser:mempass@db:5432/memassist
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
SECRET_KEY=generate_a_random_32char_string_here
```

> **Agent instruction:** Generate SECRET_KEY automatically using `python -c "import secrets; print(secrets.token_hex(32))"` during setup.

---

## Phase 1 — Project Scaffold

### 1.1 Create folder structure

```
mem_assist/
├── .env
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── recordings.py
│   │   └── todos.py
│   └── services/
│       ├── __init__.py
│       ├── transcription.py
│       └── summariser.py
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   └── client.ts
│       └── pages/
│           ├── Dashboard.tsx
│           └── MessageDetail.tsx
├── flutter_app/
│   └── (Flutter project — see Phase 5)
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql
```

> **Agent instruction:** Create all directories and empty placeholder files now. Then fill each file in subsequent phases.

---

## Phase 2 — Docker Compose & Infrastructure

### 2.1 Create `docker-compose.yml`

```yaml
version: '3.9'

services:
  db:
    image: postgres:16-alpine
    container_name: mem_assist_db
    restart: always
    environment:
      POSTGRES_USER: memuser
      POSTGRES_PASSWORD: mempass
      POSTGRES_DB: memassist
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./supabase/migrations:/docker-entrypoint-initdb.d

  backend:
    build: ./backend
    container_name: mem_assist_backend
    restart: always
    env_file: .env
    ports:
      - "8000:8000"
    depends_on:
      - db
    volumes:
      - ./backend:/app
      - audio_uploads:/app/uploads

  frontend:
    build: ./frontend
    container_name: mem_assist_frontend
    restart: always
    ports:
      - "5173:5173"
    depends_on:
      - backend
    volumes:
      - ./frontend/src:/app/src

volumes:
  pgdata:
  audio_uploads:
```

---

## Phase 3 — Database Schema

### 3.1 Create `supabase/migrations/001_initial_schema.sql`

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Recordings table: stores voice memos
CREATE TABLE IF NOT EXISTS recordings (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    audio_path    TEXT,
    transcript    TEXT NOT NULL,
    summary       TEXT NOT NULL,          -- exactly 3 words
    status        TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'urgent', 'done', 'postpone')),
    date_recorded DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Index for date-based queries (date picker)
CREATE INDEX IF NOT EXISTS idx_recordings_date ON recordings(date_recorded);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_recordings_status ON recordings(status);

-- Function: auto-set date_recorded from created_at on insert
CREATE OR REPLACE FUNCTION set_date_recorded()
RETURNS TRIGGER AS $$
BEGIN
    NEW.date_recorded := NEW.created_at::DATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_date_recorded
BEFORE INSERT ON recordings
FOR EACH ROW EXECUTE FUNCTION set_date_recorded();
```

---

## Phase 4 — Python FastAPI Backend

### 4.1 Create `backend/requirements.txt`

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
asyncpg==0.29.0
alembic==1.13.1
python-multipart==0.0.9
httpx==0.27.0
openai==1.30.1
anthropic==0.26.0
python-dotenv==1.0.1
pydantic==2.7.1
pydantic-settings==2.2.1
supabase==2.4.0
aiofiles==23.2.1
```

### 4.2 Create `backend/Dockerfile`

```dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/uploads

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

### 4.3 Create `backend/database.py`

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").replace(
    "postgresql://", "postgresql+asyncpg://"
)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

### 4.4 Create `backend/models.py`

```python
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
```

### 4.5 Create `backend/schemas.py`

```python
from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional
import uuid

class RecordingOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    transcript: str
    summary: str
    status: str
    date_recorded: date

    model_config = {"from_attributes": True}

class StatusUpdate(BaseModel):
    status: str  # urgent | done | postpone | pending
```

### 4.6 Create `backend/services/transcription.py`

```python
"""
Uses OpenAI Whisper API to transcribe an audio file.
The phone sends audio as .m4a or .webm; Whisper handles both.
"""
import os
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

async def transcribe_audio(audio_path: str) -> str:
    """Send audio file to OpenAI Whisper and return transcript text."""
    with open(audio_path, "rb") as audio_file:
        response = await client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="en",           # change to "pt" for Portuguese if needed
            response_format="text"
        )
    return response.strip()
```

### 4.7 Create `backend/services/summariser.py`

```python
"""
Uses Anthropic Claude Haiku to summarise a transcript into exactly 3 words.
Fast and cost-effective. Returns exactly 3 words, no punctuation.
"""
import os
import re
import anthropic

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = (
    "You are a memory assistant. The user gives you a voice note transcript. "
    "Your ONLY job is to summarise it into EXACTLY 3 words — no more, no less. "
    "No punctuation. No explanation. Just 3 words. Example: 'Buy milk tomorrow'"
)

def summarise_to_three_words(transcript: str) -> str:
    message = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=20,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": transcript}]
    )
    raw = message.content[0].text.strip()
    # Safety: ensure exactly 3 words
    words = re.findall(r'\b\w+\b', raw)
    if len(words) >= 3:
        return " ".join(words[:3]).title()
    return raw.title()
```

### 4.8 Create `backend/routers/recordings.py`

```python
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Path
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, cast, Date
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
    """Receive audio from Flutter app, transcribe, summarise, store."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"{uuid.uuid4()}_{audio.filename}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    # Save audio file
    async with aiofiles.open(filepath, "wb") as f:
        content = await audio.read()
        await f.write(content)

    # Transcribe
    try:
        transcript = await transcribe_audio(filepath)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    # Summarise
    try:
        summary = summarise_to_three_words(transcript)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarisation failed: {str(e)}")

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
    result = await db.execute(
        select(Recording).where(Recording.id == recording_id)
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
    result = await db.execute(
        select(Recording).where(Recording.id == recording_id)
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    rec.status = update.status
    await db.commit()
    await db.refresh(rec)
    return rec
```

### 4.9 Create `backend/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import engine, Base
from routers import recordings

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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

@app.get("/health")
async def health():
    return {"status": "ok"}
```

---

## Phase 5 — React/Vite Frontend (Web Viewer)

### 5.1 Create `frontend/package.json`

```json
{
  "name": "my-memory-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5173",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.1",
    "axios": "^1.7.2",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.4.5",
    "vite": "^5.2.12"
  }
}
```

### 5.2 Create `frontend/vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
```

### 5.3 Create `frontend/src/api/client.ts`

```typescript
import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getByDate = (dateStr: string) =>
  api.get(`/recordings/by-date/${dateStr}`).then(r => r.data)

export const getRecording = (id: string) =>
  api.get(`/recordings/${id}`).then(r => r.data)

export const updateStatus = (id: string, status: string) =>
  api.patch(`/recordings/${id}/status`, { status }).then(r => r.data)

export default api
```

### 5.4 Create `frontend/src/pages/Dashboard.tsx`

```tsx
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { getByDate, updateStatus } from '../api/client'

interface Recording {
  id: string
  summary: string
  transcript: string
  status: string
  created_at: string
}

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(false)

  const fetchRecordings = async (dateStr: string) => {
    setLoading(true)
    try {
      const data = await getByDate(dateStr)
      setRecordings(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRecordings(selectedDate) }, [selectedDate])

  const handleStatus = async (id: string, status: string) => {
    await updateStatus(id, status)
    fetchRecordings(selectedDate)
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24, fontFamily: 'sans-serif' }}>
      <h1>🧠 My Memory</h1>
      <div style={{ marginBottom: 24 }}>
        <label><strong>Select Date: </strong></label>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          style={{ padding: 8, fontSize: 16 }}
        />
      </div>

      {loading ? <p>Loading...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#2E5090', color: '#fff' }}>
              <th style={{ padding: 10, textAlign: 'left' }}>Time</th>
              <th style={{ padding: 10, textAlign: 'left' }}>Summary (3 words)</th>
              <th style={{ padding: 10, textAlign: 'center' }}>Urgent</th>
              <th style={{ padding: 10, textAlign: 'center' }}>Done</th>
              <th style={{ padding: 10, textAlign: 'center' }}>Postpone</th>
            </tr>
          </thead>
          <tbody>
            {recordings.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 16, textAlign: 'center' }}>No recordings for this date.</td></tr>
            )}
            {recordings.map((r, i) => (
              <tr key={r.id} style={{ background: i % 2 === 0 ? '#f5f5f5' : '#fff' }}>
                <td style={{ padding: 10 }}>
                  {format(new Date(r.created_at), 'HH:mm')}
                </td>
                <td style={{ padding: 10 }}>
                  <a href={`/message/${r.id}`} style={{ color: '#2E5090', fontWeight: 'bold', textDecoration: 'none' }}>
                    {r.summary}
                  </a>
                </td>
                <td style={{ padding: 10, textAlign: 'center' }}>
                  <input type="radio" name={r.id} checked={r.status === 'urgent'}
                    onChange={() => handleStatus(r.id, 'urgent')} />
                </td>
                <td style={{ padding: 10, textAlign: 'center' }}>
                  <input type="radio" name={r.id} checked={r.status === 'done'}
                    onChange={() => handleStatus(r.id, 'done')} />
                </td>
                <td style={{ padding: 10, textAlign: 'center' }}>
                  <input type="radio" name={r.id} checked={r.status === 'postpone'}
                    onChange={() => handleStatus(r.id, 'postpone')} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

### 5.5 Create `frontend/src/pages/MessageDetail.tsx`

```tsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { getRecording } from '../api/client'

export default function MessageDetail() {
  const { id } = useParams()
  const [rec, setRec] = useState<any>(null)

  useEffect(() => {
    if (id) getRecording(id).then(setRec)
  }, [id])

  if (!rec) return <p style={{ padding: 24 }}>Loading...</p>

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 24, fontFamily: 'sans-serif' }}>
      <h2>🧠 My Memory — Full Message</h2>
      <p><strong>Date:</strong> {format(new Date(rec.created_at), 'dd MMM yyyy HH:mm')}</p>
      <p><strong>Summary:</strong> <em>{rec.summary}</em></p>
      <p><strong>Status:</strong> {rec.status}</p>
      <hr />
      <h3>Full Transcript</h3>
      <p style={{ lineHeight: 1.7, background: '#f5f7fa', padding: 16, borderRadius: 8 }}>
        {rec.transcript}
      </p>
      <a href="/" style={{ color: '#2E5090' }}>← Back to Dashboard</a>
    </div>
  )
}
```

### 5.6 Create `frontend/src/App.tsx`

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import MessageDetail from './pages/MessageDetail'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/message/:id" element={<MessageDetail />} />
      </Routes>
    </BrowserRouter>
  )
}
```

### 5.7 Create `frontend/src/main.tsx`

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)
```

### 5.8 Create `frontend/index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Memory</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 5.9 Create `frontend/Dockerfile`

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]
```

---

## Phase 6 — Flutter Android App

### 6.1 Agent instruction: Scaffold Flutter project

```bash
cd C:\Users\Andrisa\Documents\Projects\mem_assist
flutter create --org com.memassist --project-name my_memory flutter_app
cd flutter_app
```

### 6.2 Add dependencies to `flutter_app/pubspec.yaml`

Under `dependencies:` add:

```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.2.1
  record: ^5.1.0          # audio recording
  path_provider: ^2.1.3
  intl: ^0.19.0
  url_launcher: ^6.3.0
  shared_preferences: ^2.2.3
  permission_handler: ^11.3.1
  just_audio: ^0.9.39
```

Run: `flutter pub get`

### 6.3 Android permissions — `flutter_app/android/app/src/main/AndroidManifest.xml`

Add inside `<manifest>` before `<application>`:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
```

### 6.4 Create `flutter_app/lib/config.dart`

```dart
// IMPORTANT: Change BASE_URL to your computer's local IP address on your WiFi network.
// Find it by running: ipconfig (Windows) and looking for IPv4 Address.
// Example: 192.168.1.105
// The phone and computer must be on the same WiFi network.

const String BASE_URL = 'http://192.168.1.105:8000';
```

> **Agent instruction:** Do NOT hardcode the IP. Leave the comment and placeholder. Instruct the user to update this before building.

### 6.5 Create `flutter_app/lib/models/recording.dart`

```dart
class Recording {
  final String id;
  final DateTime createdAt;
  final String transcript;
  final String summary;
  String status;
  final DateTime dateRecorded;

  Recording({
    required this.id,
    required this.createdAt,
    required this.transcript,
    required this.summary,
    required this.status,
    required this.dateRecorded,
  });

  factory Recording.fromJson(Map<String, dynamic> json) {
    return Recording(
      id: json['id'],
      createdAt: DateTime.parse(json['created_at']),
      transcript: json['transcript'],
      summary: json['summary'],
      status: json['status'],
      dateRecorded: DateTime.parse(json['date_recorded']),
    );
  }
}
```

### 6.6 Create `flutter_app/lib/services/api_service.dart`

```dart
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../config.dart';
import '../models/recording.dart';

class ApiService {
  static Future<Recording> uploadAudio(File audioFile) async {
    final uri = Uri.parse('$BASE_URL/recordings/upload');
    final request = http.MultipartRequest('POST', uri);
    request.files.add(await http.MultipartFile.fromPath(
      'audio',
      audioFile.path,
      contentType: MediaType('audio', 'm4a'),
    ));
    final response = await request.send();
    final body = await response.stream.bytesToString();
    if (response.statusCode == 201) {
      return Recording.fromJson(jsonDecode(body));
    }
    throw Exception('Upload failed: $body');
  }

  static Future<List<Recording>> getByDate(DateTime date) async {
    final dateStr = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    final uri = Uri.parse('$BASE_URL/recordings/by-date/$dateStr');
    final response = await http.get(uri);
    if (response.statusCode == 200) {
      final List data = jsonDecode(response.body);
      return data.map((j) => Recording.fromJson(j)).toList();
    }
    throw Exception('Failed to load recordings');
  }

  static Future<Recording> getRecording(String id) async {
    final uri = Uri.parse('$BASE_URL/recordings/$id');
    final response = await http.get(uri);
    if (response.statusCode == 200) {
      return Recording.fromJson(jsonDecode(response.body));
    }
    throw Exception('Failed to load recording');
  }

  static Future<void> updateStatus(String id, String status) async {
    final uri = Uri.parse('$BASE_URL/recordings/$id/status');
    await http.patch(uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'status': status}),
    );
  }
}
```

### 6.7 Create `flutter_app/lib/screens/record_screen.dart`

```dart
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import '../services/api_service.dart';

class RecordScreen extends StatefulWidget {
  const RecordScreen({super.key});
  @override
  State<RecordScreen> createState() => _RecordScreenState();
}

class _RecordScreenState extends State<RecordScreen> {
  final AudioRecorder _recorder = AudioRecorder();
  bool _isRecording = false;
  bool _isUploading = false;
  String? _lastSummary;
  String? _statusMessage;

  Future<void> _toggleRecord() async {
    // Request microphone permission
    final micStatus = await Permission.microphone.request();
    if (!micStatus.isGranted) {
      setState(() => _statusMessage = 'Microphone permission denied');
      return;
    }

    if (_isRecording) {
      // Stop and upload
      final path = await _recorder.stop();
      setState(() { _isRecording = false; _isUploading = true; _statusMessage = 'Sending to computer...'; });

      if (path != null) {
        try {
          final recording = await ApiService.uploadAudio(File(path));
          setState(() {
            _isUploading = false;
            _lastSummary = recording.summary;
            _statusMessage = 'Saved! Summary: "${recording.summary}"';
          });
        } catch (e) {
          setState(() {
            _isUploading = false;
            _statusMessage = 'Error: ${e.toString()}';
          });
        }
      }
    } else {
      // Start recording
      final dir = await getTemporaryDirectory();
      final filePath = '${dir.path}/memo_${DateTime.now().millisecondsSinceEpoch}.m4a';
      await _recorder.start(
        const RecordConfig(encoder: AudioEncoder.aacLc, sampleRate: 16000),
        path: filePath,
      );
      setState(() { _isRecording = true; _statusMessage = 'Recording... tap to stop'; });
    }
  }

  @override
  void dispose() {
    _recorder.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F4F8),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1F3864),
        title: const Text('🧠 My Memory', style: TextStyle(color: Colors.white)),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            GestureDetector(
              onTap: _isUploading ? null : _toggleRecord,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 160,
                height: 160,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _isRecording
                    ? const Color(0xFFC00000)
                    : _isUploading
                      ? Colors.grey
                      : const Color(0xFF2E5090),
                  boxShadow: [BoxShadow(
                    color: (_isRecording ? Colors.red : Colors.blue).withOpacity(0.4),
                    blurRadius: 30, spreadRadius: 4,
                  )],
                ),
                child: Icon(
                  _isUploading
                    ? Icons.cloud_upload
                    : _isRecording
                      ? Icons.stop
                      : Icons.mic,
                  size: 72,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(height: 32),
            if (_isUploading)
              const CircularProgressIndicator(color: Color(0xFF2E5090)),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Text(
                _statusMessage ?? 'Tap the button to record a memory',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16, color: Color(0xFF333333)),
              ),
            ),
            if (_lastSummary != null) ...[
              const SizedBox(height: 24),
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 32),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF2E5090)),
                ),
                child: Text(
                  '💡 $_lastSummary',
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF1F3864)),
                  textAlign: TextAlign.center,
                ),
              ),
            ]
          ],
        ),
      ),
    );
  }
}
```

### 6.8 Create `flutter_app/lib/screens/list_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:intl/intl.dart';
import '../models/recording.dart';
import '../services/api_service.dart';
import '../config.dart';

class ListScreen extends StatefulWidget {
  const ListScreen({super.key});
  @override
  State<ListScreen> createState() => _ListScreenState();
}

class _ListScreenState extends State<ListScreen> {
  DateTime _selectedDate = DateTime.now();
  List<Recording> _recordings = [];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _fetchRecordings();
  }

  Future<void> _fetchRecordings() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService.getByDate(_selectedDate);
      setState(() { _recordings = data; _loading = false; });
    } catch (e) {
      setState(() { _loading = false; });
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2024),
      lastDate: DateTime.now(),
    );
    if (picked != null && picked != _selectedDate) {
      setState(() => _selectedDate = picked);
      _fetchRecordings();
    }
  }

  Future<void> _openFullMessage(String id) async {
    final url = '$BASE_URL/../message/$id'; // Points to React web frontend
    final uri = Uri.parse('http://${BASE_URL.replaceAll('http://', '').split(':')[0]}:5173/message/$id');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _updateStatus(Recording rec, String status) async {
    await ApiService.updateStatus(rec.id, status);
    setState(() => rec.status = status);
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'urgent': return const Color(0xFFC00000);
      case 'done': return const Color(0xFF1E6B2E);
      case 'postpone': return const Color(0xFF888888);
      default: return const Color(0xFF2E5090);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1F3864),
        title: const Text('🧠 My Memory', style: TextStyle(color: Colors.white)),
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_today, color: Colors.white),
            onPressed: _pickDate,
          )
        ],
      ),
      body: Column(
        children: [
          // Date header
          GestureDetector(
            onTap: _pickDate,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              color: const Color(0xFF2E5090),
              child: Text(
                DateFormat('EEEE, d MMMM yyyy').format(_selectedDate),
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          // Column headers
          Container(
            color: const Color(0xFFD5E8F0),
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
            child: const Row(
              children: [
                Expanded(flex: 3, child: Text('Summary', style: TextStyle(fontWeight: FontWeight.bold))),
                SizedBox(width: 48, child: Text('Urgent', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11))),
                SizedBox(width: 48, child: Text('Done', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11))),
                SizedBox(width: 56, child: Text('Postpone', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11))),
              ],
            ),
          ),
          // List
          Expanded(
            child: _loading
              ? const Center(child: CircularProgressIndicator(color: Color(0xFF2E5090)))
              : _recordings.isEmpty
                ? const Center(child: Text('No recordings for this date.', style: TextStyle(color: Colors.grey)))
                : ListView.builder(
                    itemCount: _recordings.length,
                    itemBuilder: (context, index) {
                      final rec = _recordings[index];
                      return Container(
                        color: index.isEven ? Colors.white : const Color(0xFFF5F7FA),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
                          child: Row(
                            children: [
                              Expanded(
                                flex: 3,
                                child: GestureDetector(
                                  onTap: () => _openFullMessage(rec.id),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        rec.summary,
                                        style: TextStyle(
                                          color: _statusColor(rec.status),
                                          fontWeight: FontWeight.bold,
                                          fontSize: 15,
                                          decoration: TextDecoration.underline,
                                        ),
                                      ),
                                      Text(
                                        DateFormat('HH:mm').format(rec.createdAt),
                                        style: const TextStyle(fontSize: 11, color: Colors.grey),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              SizedBox(
                                width: 48,
                                child: Radio<String>(
                                  value: 'urgent',
                                  groupValue: rec.status,
                                  activeColor: const Color(0xFFC00000),
                                  onChanged: (v) => _updateStatus(rec, v!),
                                ),
                              ),
                              SizedBox(
                                width: 48,
                                child: Radio<String>(
                                  value: 'done',
                                  groupValue: rec.status,
                                  activeColor: const Color(0xFF1E6B2E),
                                  onChanged: (v) => _updateStatus(rec, v!),
                                ),
                              ),
                              SizedBox(
                                width: 56,
                                child: Radio<String>(
                                  value: 'postpone',
                                  groupValue: rec.status,
                                  activeColor: const Color(0xFF888888),
                                  onChanged: (v) => _updateStatus(rec, v!),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
```

### 6.9 Create `flutter_app/lib/main.dart`

```dart
import 'package:flutter/material.dart';
import 'screens/record_screen.dart';
import 'screens/list_screen.dart';

void main() {
  runApp(const MyMemoryApp());
}

class MyMemoryApp extends StatelessWidget {
  const MyMemoryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'My Memory',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1F3864)),
        useMaterial3: true,
      ),
      home: const MainNav(),
    );
  }
}

class MainNav extends StatefulWidget {
  const MainNav({super.key});
  @override
  State<MainNav> createState() => _MainNavState();
}

class _MainNavState extends State<MainNav> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    RecordScreen(),
    ListScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        selectedItemColor: const Color(0xFF1F3864),
        onTap: (i) => setState(() => _currentIndex = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.mic), label: 'Record'),
          BottomNavigationBarItem(icon: Icon(Icons.list), label: 'My Memos'),
        ],
      ),
    );
  }
}
```

---

## Phase 7 — Build & Run Instructions

### 7.1 Start the backend containers

```bash
cd C:\Users\Andrisa\Documents\Projects\mem_assist
docker-compose up --build -d
```

Verify: open browser at `http://localhost:8000/health` → should return `{"status":"ok"}`  
Web frontend: `http://localhost:5173`

### 7.2 Find your computer's local IP address

```bash
ipconfig
# Look for: IPv4 Address . . . . . . . . . . : 192.168.x.x
```

### 7.3 Update Flutter config

Open `flutter_app/lib/config.dart` and replace the IP:

```dart
const String BASE_URL = 'http://192.168.YOUR.IP:8000';
```

### 7.4 Build and install the Flutter app

```bash
cd flutter_app
flutter pub get
flutter build apk --release
# APK location: build/app/outputs/flutter-apk/app-release.apk
# Install via USB: flutter install
# Or copy APK to phone and install manually (enable Unknown Sources in Android settings)
```

### 7.5 Ensure phone and computer are on the same WiFi network

Both the phone and the Windows machine must be connected to the same WiFi router. The phone communicates with the backend using the local IP address set in `config.dart`.

---

## Phase 8 — Agent Verification Checklist

After building, the agent must verify:

- [ ] `docker-compose up` runs without errors
- [ ] `http://localhost:8000/health` returns `{"status":"ok"}`
- [ ] `http://localhost:8000/docs` (FastAPI Swagger) is accessible
- [ ] `http://localhost:5173` loads the React dashboard
- [ ] PostgreSQL database is accessible on port 5432
- [ ] The `recordings` table exists in the `memassist` database
- [ ] Flutter app builds without errors (`flutter build apk`)
- [ ] All required environment variables are documented in `.env`

---

## Phase 9 — API Keys Checklist (User must supply)

| Key | Purpose | Where to get |
|-----|---------|--------------|
| `OPENAI_API_KEY` | Whisper transcription | platform.openai.com |
| `ANTHROPIC_API_KEY` | Claude 3-word summary | console.anthropic.com |
| `SUPABASE_URL` | Supabase project URL | supabase.com dashboard |
| `SUPABASE_ANON_KEY` | Supabase public key | supabase.com dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key | supabase.com dashboard |

> **Note on Supabase:** The app uses a local PostgreSQL container as the primary database. Supabase credentials are optional and can be used to sync data to the cloud for remote access. If not needed, the `SUPABASE_*` variables can be left blank for local-only operation.

---

## Technology Stack Summary

| Component | Technology | Version |
|-----------|-----------|---------|
| Android app | Flutter + Dart | 3.x |
| Voice recording | `record` Flutter package | 5.x |
| Audio transcription | OpenAI Whisper API | whisper-1 |
| 3-word summarisation | Anthropic Claude Haiku | claude-haiku-4-5 |
| Backend API | Python FastAPI | 0.111 |
| Database | PostgreSQL | 16 |
| ORM | SQLAlchemy (async) | 2.0 |
| Cloud sync (optional) | Supabase | 2.x |
| Web frontend | React + Vite + TypeScript | 18 / 5 |
| Container platform | Docker Desktop (Windows) | latest |
| Deep-link viewer | React Router + url_launcher | 6.x |

---

*End of build plan. Agent: execute Phase 1 through Phase 7 in sequence.*
