# College Mess QR Attendance App

A full-stack monorepo for a QR-based meal attendance system for college messes.

## Structure

```
mess-app/
├── backend/          # Node.js + TypeScript + Express (hosted on Render)
├── mobile/           # React Native + Expo (iOS + Android)
├── admin-dashboard/  # React + Vite web app (hosted on Vercel)
└── supabase/         # DB migrations
```

## Tech Stack

| Layer | Technology |
|---|---|
| Database | Supabase (PostgreSQL) |
| Photo Storage | Supabase Storage |
| Backend | Express + TypeScript on Render |
| Mobile | React Native + Expo (EAS Build) |
| Admin | React + Vite on Vercel |
| OTP Cache | Upstash Redis |
| Email | Gmail SMTP via Nodemailer |
| APK Hosting | GitHub Releases |

## Getting Started

See `backend/README.md`, `mobile/README.md`, `admin-dashboard/README.md` for per-package setup.
