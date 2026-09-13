-- ============================================================
-- College Mess QR Attendance App — Initial Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension (already enabled in Supabase by default)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. Students (master registry, set up by admin)
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  roll_no       TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  department    TEXT,
  hostel_block  TEXT,
  photo_url     TEXT,                          -- Supabase Storage signed URL set by admin
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. Staff / Admin accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS staff (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  role        TEXT CHECK (role IN ('admin', 'mess_staff')) NOT NULL DEFAULT 'mess_staff',
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. Meal Windows (created & managed by admin via dashboard)
--    Cron reads this table — nothing is hardcoded in the app.
-- ============================================================
CREATE TABLE IF NOT EXISTS meal_windows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_type   TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')) NOT NULL,
  date        DATE NOT NULL,
  start_time  TIMESTAMPTZ NOT NULL,
  end_time    TIMESTAMPTZ NOT NULL,
  status      TEXT CHECK (status IN ('upcoming', 'open', 'closed')) DEFAULT 'upcoming',
  created_by  UUID REFERENCES staff(id),
  UNIQUE (meal_type, date)
);

-- ============================================================
-- 4. Meal Window Templates (admin sets default timings per meal)
--    Cron uses these to auto-create tomorrow's meal_windows rows.
-- ============================================================
CREATE TABLE IF NOT EXISTS meal_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_type   TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')) UNIQUE NOT NULL,
  start_time  TIME NOT NULL,   -- e.g. '07:30:00'
  end_time    TIME NOT NULL,   -- e.g. '10:00:00'
  is_enabled  BOOLEAN DEFAULT TRUE,
  updated_by  UUID REFERENCES staff(id),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Default meal templates (admin can update anytime via dashboard)
INSERT INTO meal_templates (meal_type, start_time, end_time) VALUES
  ('breakfast', '07:30:00', '10:00:00'),
  ('lunch',     '12:00:00', '14:30:00'),
  ('dinner',    '19:00:00', '21:30:00')
ON CONFLICT (meal_type) DO NOTHING;

-- ============================================================
-- 5. HOT Attendance Table (only today's meals; kept tiny)
--    UNIQUE constraint is your "no double meal" rule.
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id),
  meal_window_id  UUID NOT NULL REFERENCES meal_windows(id),
  scanned_at      TIMESTAMPTZ DEFAULT now(),
  scanned_by      UUID REFERENCES staff(id),   -- NULL = manual admin override
  is_manual       BOOLEAN DEFAULT FALSE,
  override_note   TEXT,                         -- filled when is_manual=TRUE
  UNIQUE (student_id, meal_window_id)           -- THE core rule
);

CREATE INDEX IF NOT EXISTS idx_attendance_meal_window ON attendance(meal_window_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);

-- ============================================================
-- 6. COLD Archive Table (full history; never queried at scan-time)
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_archive (
  id              UUID PRIMARY KEY,
  student_id      UUID NOT NULL,
  meal_window_id  UUID NOT NULL,
  scanned_at      TIMESTAMPTZ,
  scanned_by      UUID,
  is_manual       BOOLEAN DEFAULT FALSE,
  override_note   TEXT,
  archived_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_archive_student ON attendance_archive(student_id);
CREATE INDEX IF NOT EXISTS idx_archive_meal ON attendance_archive(meal_window_id);
CREATE INDEX IF NOT EXISTS idx_archive_scanned_at ON attendance_archive(scanned_at);

-- ============================================================
-- 7. Refresh Tokens (for JWT rotation)
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,        -- references students.id or staff.id
  user_type   TEXT CHECK (user_type IN ('student', 'staff')) NOT NULL,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  revoked     BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- 8. Audit Log (manual overrides, admin actions)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action      TEXT NOT NULL,
  actor_id    UUID NOT NULL,
  actor_type  TEXT CHECK (actor_type IN ('student', 'staff')) NOT NULL,
  target_id   UUID,
  meta        JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Row Level Security (disable for service_role key used by backend)
-- The backend uses SUPABASE_SERVICE_ROLE_KEY so RLS won't block it.
-- Enable RLS only if you expose tables directly to client.
-- ============================================================
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE meal_windows DISABLE ROW LEVEL SECURITY;
ALTER TABLE meal_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_archive DISABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;
