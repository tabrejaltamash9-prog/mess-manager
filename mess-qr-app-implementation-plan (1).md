# College Mess QR Attendance App — Full Implementation Plan

## 0. Core design decision made up front

The one real risk with a QR-based system isn't a student scanning twice — a simple "one record per student per meal" database rule already blocks that completely (see the `UNIQUE(student_id, meal_window_id)` constraint below). The actual risk is a student **screenshotting their QR and sending it to a friend**, who then eats using that QR before the real student does.

**Fix chosen: a static, single-use QR per student per meal (your original idea) + mandatory photo verification by staff at scan time.**

- Each student's QR for a given meal is simple and fixed — no rotation, no extra complexity.
- The database enforces one scan per student per meal window (this is your "already taken" rule).
- To close the "shared screenshot" gap, the moment staff scan a QR, the app shows the **student's registered photo, name, roll number, and email** on screen. Staff visually confirm the person in front of them matches the photo before handing out food. If someone else's photo pops up, staff simply refuse — no technical complexity needed to prevent identity sharing, just a quick human glance.
- This is simpler to build, simpler to explain to your team, and sufficient for a college mess setting.

*(A more advanced option — a QR that automatically changes every 30 seconds, so an old screenshot stops working on its own — exists and is used by things like event ticket apps, but it adds real implementation complexity. Since photo verification already covers the same risk in a much simpler way, it's not needed here.)*

Everything below is designed around the static QR + photo-check approach.

---

## 1. Roles in the system

| Role | What they do |
|---|---|
| **Student** | Logs in via email OTP once, opens app at mealtime, shows rotating QR |
| **Mess Staff** | Logs into a scanner mode, scans QR, sees accept/reject + student photo |
| **Admin** | Registers students (bulk CSV), configures meal window timings, views reports, handles exceptions |

You don't need three separate apps — one app, three role-based views, gated by login.

---

## 2. Database schema (PostgreSQL)

```sql
-- Master student registry (set up once by admin)
CREATE TABLE students (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  roll_no       TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  department    TEXT,
  hostel_block  TEXT,
  photo_url     TEXT NOT NULL,       -- uploaded by admin at registration; shown to staff on every scan
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Staff / admin accounts
CREATE TABLE staff (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  role        TEXT CHECK (role IN ('admin','mess_staff')) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- OTP requests (short-lived, table or Redis — Redis preferred)
CREATE TABLE otp_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  otp_hash    TEXT NOT NULL,
  attempts    INT DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- One row per meal, per day. Opened/closed by a scheduled job.
CREATE TABLE meal_windows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_type   TEXT CHECK (meal_type IN ('breakfast','lunch','dinner')) NOT NULL,
  date        DATE NOT NULL,
  start_time  TIMESTAMPTZ NOT NULL,
  end_time    TIMESTAMPTZ NOT NULL,
  status      TEXT CHECK (status IN ('upcoming','open','closed')) DEFAULT 'upcoming',
  UNIQUE (meal_type, date)
);

-- HOT table: only today's active meal lives here. Kept small on purpose.
CREATE TABLE attendance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID REFERENCES students(id),
  meal_window_id  UUID REFERENCES meal_windows(id),
  scanned_at      TIMESTAMPTZ DEFAULT now(),
  scanned_by      UUID REFERENCES staff(id),
  UNIQUE (student_id, meal_window_id)   -- <-- this line IS your "no double meal" rule
);

-- COLD table: archive, for reports/analytics/disputes. Never queried at scan-time.
CREATE TABLE attendance_archive (
  LIKE attendance INCLUDING ALL,
  archived_at TIMESTAMPTZ DEFAULT now()
);
```

**On "delete records to save space" — a correction worth making:** an attendance row is tiny (~100 bytes). Even a college of 5,000 students × 3 meals × 365 days is about 5.5 million rows/year — roughly 500 MB. That's nothing for Postgres. Deleting isn't actually necessary for space; what *is* worth doing is **moving each meal's rows from the hot `attendance` table into `attendance_archive` right after the window closes**, then truncating the hot table. This keeps the "has this student already eaten *this* meal" lookup fast (tiny table, indexed on 2 columns) while still preserving full history for reports, wastage analysis, or a student disputing "I was marked absent but I ate." Pure deletion throws away data you'll want later for zero real storage benefit.

---

## 3. Meal window lifecycle (this is the scheduling backbone)

A cron worker (node-cron, or a serverless scheduled function) does:

1. **~15 min before each meal**: create the day's `meal_windows` row, status `upcoming`.
2. **At start_time**: flip to `open`. QR scanning now validates against this window.
3. **At end_time** (e.g., 2–3 hrs later, per your spec): flip to `closed`. Any scan attempt after this returns "Meal window closed."
4. **Shortly after closing**: batch-copy that window's rows from `attendance` → `attendance_archive`, then delete them from `attendance`. Hot table stays near-empty between meals.

This directly implements your requirement: one QR context per meal, automatically expiring, with the "already taken" and "closed window" cases both handled centrally by the server — not by the app, which is important since the app is not a trusted source of truth.

---

## 4. Registration & login flow

**Admin side (one-time setup, per student):**
- Admin panel (web dashboard) registers each student with: name, roll no., college email, department, hostel block, **and a photo** — either one-by-one or bulk (CSV for text fields + a folder of photos named by roll no./email, matched automatically on upload).
- This is the *only* place photos ever get uploaded. Students never upload or change their own photo through the app — it's fixed at registration, exactly as you wanted.

**Student side (this is the entire student-facing flow — nothing more):**
1. Student opens app, enters college email.
2. Backend checks the email exists in `students` and is active.
3. Backend generates a 6-digit OTP, stores a **hash** of it (never plaintext) with a 5-minute expiry, rate-limited (e.g. max 5 requests/hour/email).
4. Email sent via college SMTP or a transactional service (SendGrid/AWS SES/Resend).
5. Student enters OTP → verified → backend issues a JWT (access + refresh token) → student is logged in.
6. Home screen shows the student's own QR for the currently open meal.

No password, no profile setup, no photo upload — matches exactly what you described.

---

## 5. Scan verification flow (the core transaction)

1. Staff app scans QR → decodes `{student_id, meal_window_id}` (a fixed, signed value generated once when that meal's QR is issued — signed with a server secret so it can't be forged, but otherwise simple and static).
2. POST to `/api/verify-scan`.
3. Server checks, in order:
   - Is the signature valid and untampered? (else → "Invalid QR")
   - Is `meal_window_id` currently `open`? (else → "Window closed")
   - Does a row already exist in `attendance` for `(student_id, meal_window_id)`? (if yes → **"Already taken at HH:MM"**, showing the original scan time — this is your core rule)
   - If all clear: insert the attendance row, return **success + student's name, roll number, email, and photo**.
4. Staff app immediately displays the student's photo full-screen alongside name/roll no., so staff can glance at the person in front of them and confirm the match before serving food. Rejections show the specific reason (already taken / window closed / invalid).

The double-scan protection is a single atomic insert guarded by the `UNIQUE(student_id, meal_window_id)` constraint — so even if two staff members at two counters scan the same student within milliseconds of each other, the database itself guarantees only one succeeds, not the app logic.

---

## 6. Tech stack recommendation

| Layer | Choice | Why |
|---|---|---|
| Mobile app (Android + iOS, one codebase) | **React Native + Expo** | Single codebase, `expo-camera`/vision-camera for scanning, EAS Build lets you produce both iOS and Android binaries without owning a Mac |
| QR generation (student side) | `react-native-qrcode-svg`, rendering a signed value fetched once per meal from the backend | Simple, static per meal, no rotation logic needed |
| Photo storage | S3-compatible bucket (e.g. Supabase Storage, Cloudinary, or AWS S3) | Admin uploads once at registration; app/staff-scanner just fetches the URL |
| QR scanning (staff side) | `expo-camera` barcode scanner / `react-native-vision-camera` + `vision-camera-code-scanner` | Fast, works offline for decode (verification still needs network) |
| Backend | **Node.js + TypeScript + Express (or NestJS)** | Matches JS TOTP libs, easy to scale, huge ecosystem |
| Database | **PostgreSQL** (Supabase or Neon for managed hosting, or self-host) | Relational integrity for the "no double meal" constraint, cheap at this scale |
| Cache / OTP store | **Redis** | OTP storage with TTL, rate limiting |
| Auth | JWT (short-lived access + refresh token) | Standard, stateless |
| Email (OTP) | Nodemailer via college SMTP, or SendGrid/AWS SES | Reliable delivery, avoid spam folder issues |
| Push notifications | Expo push / Firebase Cloud Messaging | "Breakfast window is open" reminders (optional) |
| Admin dashboard | React (web), not part of the mobile app | Bulk uploads, reports, and meal-window config are easier as a web table UI |
| Hosting | Render/Railway/Fly.io (backend), Vercel (admin dashboard), Supabase/Neon (DB) | Free/cheap tiers sufficient for a single college |
| Monitoring | Sentry | Catch scan-flow bugs before students complain |

---

## 7. UI/UX flow

**Student app**
- Onboarding → Enter college email → Enter OTP
- Home screen: current meal name + countdown to window open/close, big "Show QR" button
- QR screen: full-screen brightness-boosted QR, auto-refreshing every ~30s, small live countdown ring so the student knows it's still valid
- History tab: past week's meals taken (pulled from archive via API), useful for the student to self-check
- Profile: name, roll no., department (read-only; edits go through admin)

**Mess staff app (scanner mode)**
- Login (email OTP, same mechanism, staff role)
- Full-screen camera scanner with torch toggle
- Result screen: green tick + **large student photo, name, roll no., email** (success — staff check the photo against the person before serving), or red cross + explicit reason ("Already taken at 8:12 AM" / "Window closed" / "Invalid code")
- Running counter: "142 of 480 scanned" for that meal, visible during service

**Admin dashboard (web)**
- Student roster: bulk CSV upload/edit/deactivate
- Meal window settings: start/end time per meal, with a "close early" override button
- Reports: daily attendance %, no-shows by hostel block, historical trends (queried from `attendance_archive`)
- Manual override: mark a student present without a scan, for edge cases (lost phone, guest meal), logged with the admin's ID for accountability

---

## 8. Edge cases worth deciding now, not after launch

- **No internet at the counter**: verification needs the server (that's what makes it trustworthy), so a stable wifi/hotspot at the mess counter is a hard requirement — flag this to whoever manages the venue before you build.
- **Phone lost or swapped**: since login is just email + OTP with nothing device-specific stored, the student simply logs in again on the new phone — no admin action needed.
- **Student shares their QR screenshot anyway**: the photo check at the counter is your safeguard here — staff see a mismatched face and refuse. Worth briefing staff on this explicitly during rollout.
- **Guest meals / genuine exceptions**: give admin a manual "mark present" override, logged and auditable — don't build a workaround into the student flow itself.
- **Multiple counters serving the same meal simultaneously**: handled for free by the DB unique constraint, as long as all counters hit the same backend.

---

## 9. Suggested build order

1. Backend: schema + OTP login + meal window cron + scan verification endpoint (this is the entire trust boundary — get it right and tested before touching UI)
2. Staff scanner app (simpler UI, tests the core logic end-to-end fastest)
3. Student app (QR display + TOTP generation)
4. Admin dashboard (bulk upload, reports)
5. Polish: push notifications, history tab, offline-tolerant UX messaging

If you want, I can start scaffolding the backend (schema + auth + scan endpoint) as actual code next.
