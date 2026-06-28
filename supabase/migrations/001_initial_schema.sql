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

DROP TRIGGER IF EXISTS trg_set_date_recorded ON recordings;
CREATE TRIGGER trg_set_date_recorded
BEFORE INSERT ON recordings
FOR EACH ROW EXECUTE FUNCTION set_date_recorded();
