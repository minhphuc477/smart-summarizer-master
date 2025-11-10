# Canvas Version History

Track, browse, and restore previous canvas states with automatic and manual snapshots.

## What it does
- Creates a `canvas_versions` table capturing snapshots (canvas metadata, nodes, edges)
- Auto-snapshots after each successful canvas save
- Manual snapshots via the History dialog button
- Lists versions with who/when/type and basic diff counts
- One-click restore replaces current canvas nodes/edges and metadata

## Database migration
File: `migrations/supabase-migration-canvas-versions.sql`

Run this in Supabase SQL Editor (Dashboard → SQL → New Query). If re-running, policy creation is safe because the script drops policies if they exist.

Verify:
```sql
SELECT * FROM canvas_versions ORDER BY created_at DESC LIMIT 5;
```

## API
- List: `GET /api/canvases/:id/versions` → `{ versions: [...] }`
- Manual snapshot: `POST /api/canvases/:id/versions` (optional JSON `{ change_description: string }`)
- Restore: `POST /api/canvases/:id/versions/:versionId/restore`

All endpoints are protected by RLS; only owners can view or restore their canvas versions.

## UI usage
Open a canvas → click "History". You can:
- Inspect version list (timestamp, user, type, diff counts)
- Click "Save Snapshot" to create a manual snapshot
- Click "Restore" on any row to revert the canvas

## Diff summary
Each snapshot may include a `diff_summary` with counts such as nodes/edges added/removed. The UI currently displays node+edge counts when available.

## Troubleshooting
- "permission denied for table canvas_versions": Ensure migration ran and RLS policies exist.
- Manual snapshot fails: Confirm you are the canvas owner; check network tab for 401/403.
- Versions list is empty: Snapshots are created after saves; try saving the canvas first, or use "Save Snapshot".

## Rollback (optional)
```sql
-- Remove policies
DROP POLICY IF EXISTS "Users can read versions of own canvases" ON public.canvas_versions;
DROP POLICY IF EXISTS "Users can insert versions for own canvases" ON public.canvas_versions;
DROP POLICY IF EXISTS "Users can delete versions of own canvases" ON public.canvas_versions;

-- Disable and drop table
ALTER TABLE public.canvas_versions DISABLE ROW LEVEL SECURITY;
DROP TABLE IF EXISTS public.canvas_versions;
```

## Notes
- This feature complements existing note versioning and uses separate storage.
- RLS ensures only canvas owners can read/restore versions.
