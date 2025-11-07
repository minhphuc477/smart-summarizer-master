# Supabase Realtime Setup Guide

## Step 1: Apply the SQL Migration

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com/
   - Select your project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run the Migration**
   - Open the file: `supabase-migration-realtime-collaboration.sql`
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click "Run" or press `Cmd/Ctrl + Enter`

4. **Verify Success**
   - Check for "Success. No rows returned" message
   - Or verify tables created: `comments`, `presence`, `note_versions`, `comment_notifications`

## Step 2: Enable Realtime for Tables

### Option A: Using Supabase Dashboard (Recommended)

1. **Navigate to Database Settings**
   - Click "Database" in left sidebar
   - Click "Replication" tab

2. **Enable Realtime for Each Table**
   Enable Realtime for these tables by toggling them on:
   - ✅ `comments`
   - ✅ `presence`
   - ✅ `note_versions`
   - ✅ `comment_notifications`
   - ✅ `notes` (already enabled in migration)
   - ✅ `folders` (already enabled in migration)
   - ✅ `workspaces` (already enabled in migration)

3. **Save Changes**
   - Click "Save" or changes apply automatically

### Option B: Using SQL (Alternative)

The migration already includes these commands, but if needed:

```sql
-- Enable Realtime publication for tables
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE presence;
ALTER PUBLICATION supabase_realtime ADD TABLE note_versions;
ALTER PUBLICATION supabase_realtime ADD TABLE comment_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE folders;
ALTER PUBLICATION supabase_realtime ADD TABLE workspaces;
```

## Step 3: Verify Setup

### Check Tables Exist

Run this SQL query:

```sql
SELECT 
  tablename 
FROM 
  pg_tables 
WHERE 
  schemaname = 'public' 
  AND tablename IN ('comments', 'presence', 'note_versions', 'comment_notifications')
ORDER BY 
  tablename;
```

Expected result: 4 rows

### Check Realtime is Enabled

Run this SQL query:

```sql
SELECT 
  schemaname, 
  tablename 
FROM 
  pg_publication_tables 
WHERE 
  pubname = 'supabase_realtime'
  AND tablename IN ('comments', 'presence', 'note_versions', 'comment_notifications', 'notes', 'folders', 'workspaces')
ORDER BY 
  tablename;
```

Expected result: 7 rows (all tables listed)

## Step 4: Test Realtime Connection

Use the diagnostic script:

```bash
npm run test:realtime
```

Or manually test in the app:

1. Open the app: http://localhost:3000
2. Sign in with a user account
3. Create or view a note
4. Click the "View Details" button (📨 icon)
5. Go to the "Comments" tab
6. Add a test comment
7. Open the same note in another browser/tab with a different user
8. You should see the comment appear in real-time!

## Troubleshooting

### Issue: Tables not created
**Solution**: Re-run the migration SQL. Check for error messages.

### Issue: Realtime not working
**Solutions**:
1. Verify Realtime is enabled in Database → Replication
2. Check browser console for connection errors
3. Verify Supabase env vars are correct in `.env.local`
4. Restart the dev server: `npm run dev`

### Issue: RLS policies blocking access
**Solution**: Check that users are properly authenticated. The policies require:
- User must be signed in (`auth.uid()`)
- User must have access to the note (owner, workspace member, or public note)

### Issue: "Permission denied" errors
**Solution**: 
1. Check RLS policies are applied correctly
2. Verify user has proper workspace membership
3. Test with the note owner's account first

## Environment Variables

Ensure these are set in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## What Gets Enabled

### Real-time Comments
- Users can add/reply to comments
- Comments sync instantly across all viewers
- @mentions notify users
- Resolve threads

### Live Presence
- See who's viewing/editing each note
- Real-time status updates (editing, viewing, idle)
- Cursor positions (optional)

### Version History
- Automatic snapshots on note changes
- Restore previous versions
- Track who made changes

## Next Steps

After setup is complete:
1. Test with multiple users
2. Verify real-time sync works
3. Test on mobile devices
4. Monitor Realtime connection in Supabase Dashboard → Logs

## Support

If issues persist:
1. Check Supabase Dashboard → Logs
2. Check browser console for errors
3. Verify all tables exist and have data
4. Test with simple SQL queries first
