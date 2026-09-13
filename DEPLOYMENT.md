# Deployment Guide

This repository contains the complete Mess QR Attendance System, including the Backend, Mobile App, and Admin Dashboard. This guide explains how to deploy each component to production.

## 1. Supabase (Database & Storage)

We use Supabase for PostgreSQL database, authentication, and avatar storage.

1. Create a new project at [Supabase](https://supabase.com).
2. Go to **SQL Editor** in the Supabase dashboard.
3. Copy the contents of `supabase/migrations/001_initial.sql` and run it. This will create all tables, policies, and the `photos` storage bucket.
4. Go to **Project Settings -> API** to get your `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`. You will need these for the backend.

## 2. Render (Backend)

The Node.js backend is configured to be easily deployed to Render.

1. Connect your GitHub repository to [Render](https://render.com).
2. Create a new **Web Service**.
3. Choose the repository (`mess-manager`).
4. Set the Root Directory to `backend`.
5. Under Settings, set the **Build Command** to: `npm install; npm run build`
6. Set the **Start Command** to: `npm start`
7. Add the following Environment Variables in the Render dashboard:
   - `PORT`: `10000`
   - `NODE_ENV`: `production`
   - `JWT_ACCESS_SECRET`: A strong random string (min 32 chars)
   - `JWT_REFRESH_SECRET`: Another strong random string (min 32 chars)
   - `QR_HMAC_SECRET`: A strong random string for QR signatures (min 32 chars)
   - `UPSTASH_REDIS_REST_URL`: Your Upstash Redis REST URL
   - `UPSTASH_REDIS_REST_TOKEN`: Your Upstash Redis REST Token
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
   - `GMAIL_USER`: Your Gmail address (e.g., `you@gmail.com`)
   - `GMAIL_APP_PASSWORD`: Your Google App Password

> [!IMPORTANT]
> To use Gmail for SMTP, you must generate an **App Password** in your Google Account settings (Security -> 2-Step Verification -> App Passwords).

## 3. Vercel (Admin Dashboard)

The React Admin Dashboard is a Vite app that deploys easily to Vercel.

1. Connect your GitHub repository to [Vercel](https://vercel.com).
2. Import the repository.
3. Set the **Root Directory** to `admin-dashboard`.
4. Vercel will automatically detect Vite.
5. In the Environment Variables section, add:
   - `VITE_API_URL`: The URL of your deployed Render backend (e.g., `https://mess-manager-backend.onrender.com`).
6. Click Deploy.

## 4. GitHub Actions (Mobile App APK Build)

The mobile app APK automatically builds whenever you create and push a new GitHub Release tag. It uses Expo Application Services (EAS) to build the APK in the cloud.

1. Create an account at [Expo](https://expo.dev) if you don't have one.
2. Ensure `mobile/app.json` has your actual Expo Project ID and matching slug.
3. Generate an Expo Access Token in your Expo Account Settings.
4. Go to your GitHub repository **Settings -> Secrets and variables -> Actions**.
5. Add a new Repository Secret named `EXPO_TOKEN` and paste your Expo token.
6. Make sure you have push access to the repository to trigger GitHub Actions.

### Triggering a Build

To trigger an automated build and publish the Android APK to GitHub Releases:

1. Create a new tag locally and push it:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
2. The GitHub Action will automatically build the Android APK. You can check the progress in the **Actions** tab on GitHub.
3. Once completed (~8-9 minutes), a new GitHub Release will be created with `mess-qr-app-android.apk` attached and ready for download!

*(Note: For iOS Simulator builds, you can manually run the **Build iOS Simulator** action from the GitHub Actions tab at any time.)*

## 5. Adding the First Admin

To log in to the admin dashboard, you need an admin user in the database. Since there is no public sign-up for admins, you must insert the first admin manually.

Go to the Supabase **SQL Editor** and run:

```sql
INSERT INTO users (id, name, email, role, is_active)
VALUES (
  gen_random_uuid(),
  'Super Admin',
  'your-email@college.edu', -- Replace with your email
  'admin',
  true
);
```

You can now log in to the admin dashboard using this email!
