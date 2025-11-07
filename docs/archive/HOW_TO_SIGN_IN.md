# How to Fix Authentication (401 Errors)

## The Problem
You're signed into **Supabase Dashboard** but NOT into your **Next.js app at localhost:3000**.
They are separate domains and don't share sessions!

## The Solution

### Step 1: Configure Supabase Auth Redirect URLs
1. Go to your Supabase Dashboard: https://hibvddhjqiwwrxdcbbiy.supabase.co/project/_/auth/url-configuration
2. Add these URLs to "Redirect URLs":
   ```
   http://localhost:3000
   http://localhost:3000/auth/callback
   http://127.0.0.1:3000
   http://127.0.0.1:3000/auth/callback
   ```
3. Click "Save"

### Step 2: Sign In Through Your Next.js App
1. Open http://localhost:3000 in your browser
2. Click the **"Sign In"** button in the app (top right or in the UI)
3. This will redirect you to Google OAuth
4. After authorizing, you'll be redirected back to localhost:3000
5. Now your browser will have the session cookies for localhost:3000

### Step 3: Verify It Works
After signing in through the app:
- Open http://localhost:3000/api/debug/auth
- You should see: `"authenticated": true`
- Check your browser console - no more "Invalid Refresh Token" errors
- The `/api/folders`, `/api/personas`, `/api/workspaces` endpoints should return 200

## Why This Happened

- ❌ **Wrong**: Signing into supabase.co dashboard
- ✅ **Right**: Signing into localhost:3000 through the app's "Sign In" button

The Supabase dashboard login is for managing your project.
Your app needs its own login flow to get session cookies at localhost:3000.

## Current Status

- ✅ Database tables exist
- ✅ RLS policies configured
- ✅ Views created (folder_stats)
- ✅ App has Google OAuth configured
- ❌ No valid session at localhost:3000 (need to sign in through the app!)

## After Following These Steps

You should see:
- ✅ No "Invalid Refresh Token" errors
- ✅ `/api/folders` returns 200 with your folders
- ✅ `/api/personas` returns 200 with your personas
- ✅ `/api/workspaces` returns 200 with your workspaces
- ✅ All authenticated features work!
