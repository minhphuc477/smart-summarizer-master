# Migration Instructions - Smart Summarizer Fixes

## Issue Summary
1. **Semantic Search Error**: Vector dimension mismatch (1536 vs 384)
2. **Canvas Versions 500**: Missing canvas_versions table
3. **Workspace Dropdown**: ✅ FIXED - All workspaces now have members

## Step 1: Apply Database Migration

Run the migration in **Supabase SQL Editor**:
- File: `migrations/fix-dimension-and-canvas-versions.sql`

This migration will:
- ✅ Fix embedding dimension from 1536 to 384 (for Xenova/all-MiniLM-L6-v2)
- ✅ Create canvas_versions table with RLS policies
- ✅ Drop and recreate semantic search functions with correct vector dimension
- ✅ Add proper indexes for performance

**Expected output:**
```
NOTICE: Dropped function: public.match_notes(...)
NOTICE: Dropped function: public.match_notes_by_folder(...)
NOTICE: Current embedding dimension: 384
NOTICE: ✓ Migration completed successfully!
```

## Step 2: Regenerate All Embeddings

After the migration, **all existing embeddings will be cleared** (dimension changed). You need to regenerate them:

### Option A: Via API (Recommended)
```bash
# Login to your app first, then run:
curl -X POST http://localhost:3000/api/admin/backfill-embeddings \
  -H "Content-Type: application/json" \
  -d '{"limit": 100}'
```

### Option B: Via UI
1. Login to the app
2. Navigate to History component
3. Click "Backfill Embeddings" button (if available)

This will regenerate embeddings for up to 100 notes at a time. If you have more notes, run it multiple times.

## Step 3: Verify Fixes

### Test Semantic Search
1. Go to main page
2. Enter a search query (e.g., "meeting notes")
3. ✅ Should show: Results with % similarity scores (not "keyword matches" error)

### Test Canvas Versions
1. Open or create a canvas
2. Make some changes
3. Click "Save Canvas"
4. Click "History" icon (clock icon)
5. ✅ Should show: Version list with timestamps

### Test Workspace Dropdown
1. Click workspace dropdown in header
2. ✅ Should show: All 7 workspaces listed
3. ✅ Should show: Crown icon (👑) for owner role

## Expected Results After Migration

| Feature | Before | After |
|---------|--------|-------|
| Semantic Search | ❌ "different vector dimensions" error | ✅ Shows similarity % scores |
| Canvas Versions | ❌ 500 error on GET | ✅ Version history visible |
| Workspace Dropdown | ✅ Already working | ✅ Continues to work |
| Embedding Dimension | 1536 (wrong) | 384 (correct) |

## Troubleshooting

### If semantic search still fails:
```sql
-- Check embedding dimension is correct
SELECT atttypmod - 4 AS embedding_dimension
FROM pg_attribute
WHERE attrelid = 'public.notes'::regclass AND attname = 'embedding';
-- Should return: 384

-- Check if embeddings exist
SELECT COUNT(*) as notes_with_embeddings
FROM notes WHERE embedding IS NOT NULL;
-- Should increase after backfill
```

### If canvas versions fail:
```sql
-- Verify table exists
SELECT COUNT(*) FROM canvas_versions;

-- Check RLS policies
SELECT policyname, cmd FROM pg_policies 
WHERE tablename = 'canvas_versions';
```

### If workspace dropdown empty:
```sql
-- Check workspace_members
SELECT w.name, wm.role, wm.user_id
FROM workspaces w
JOIN workspace_members wm ON w.id = wm.workspace_id
WHERE wm.user_id = '[YOUR_USER_ID]';
```

## Build Warnings (Optional Fix)

The PWA warning about large source map can be ignored or fixed by adding to `next.config.ts`:

```typescript
runtimeCaching: [
  {
    urlPattern: /^https?.*/,
    handler: 'NetworkFirst',
    options: {
      cacheName: 'offlineCache',
      expiration: {
        maxEntries: 200,
      },
    },
  },
],
maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
```

---

## Quick Checklist

- [ ] Run `fix-dimension-and-canvas-versions.sql` in Supabase
- [ ] Run embedding backfill API endpoint
- [ ] Test semantic search (should show % scores)
- [ ] Test canvas version history (should list versions)
- [ ] Verify workspace dropdown shows all workspaces

After completing these steps, all critical issues should be resolved!
