# Supabase Setup

## 1. Create project

Create project at https://supabase.com/dashboard.

## 2. Enable phone OTP

Open `Authentication` → `Providers` → `Phone`.

Enable phone login and configure an SMS provider. Supabase phone OTP requires an SMS provider in production.

## 3. Create cloud schema

Open Supabase `SQL Editor`, paste and run:

```text
supabase/schema.sql
```

RLS policies restrict every row to authenticated user's `owner_id`.

## 4. Add app environment

Copy `.env.example` to `.env` and fill values from Supabase project settings:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Use publishable key only. Never put `service_role` or secret key in Expo app.

## 5. Start app

```powershell
npm install
npx expo start
```

## 6. First data sync

1. Login with phone OTP.
2. Add or keep local RT data.
3. Open `Menu`.
4. Press `Upload Lokal`.
5. On another device, login with same phone and press `Pulihkan Cloud`.

`Pulihkan Cloud` replaces local SQLite rows. It does not merge records. Upload first when local data is authoritative.

## Local-only mode

If `.env` is missing, app runs local-only with SQLite. Cloud login and sync card stay hidden.
