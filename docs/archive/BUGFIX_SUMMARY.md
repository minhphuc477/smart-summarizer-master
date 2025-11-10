# Bug Fixes - November 9, 2025

## Issues Identified & Fixes Applied

### 1. ✅ Build Warning (PWA Source Map)
**Problem:** `/_next/static/chunks/7280.a678ea2ca4a12bde.js.map is 3.21 MB, and won't be precached`

**Fix Applied:** Updated `next.config.ts`:
- Excluded source maps from PWA precaching with `buildExcludes: [/\.map$/]`
- Increased `maximumFileSizeToCacheInBytes` to 5MB
- Added empty `runtimeCaching` array

**Test:** Run `npm run build` - warning should be gone

---

### 2. ⚠️ Semantic Search Dimension Mismatch
**Problem:** Database has 1536-dim embeddings but code generates 384-dim (Xenova/all-MiniLM-L6-v2)
**Error:** "different vector dimensions 1536 and 384"

**Fix Created:** `migrations/fix-dimension-and-canvas-versions.sql`
- Drops existing `embedding` column and recreates with `vector(384)`
- Recreates `match_notes` and `match_notes_by_folder` functions with correct dimension
- Creates ivfflat index for fast vector search

**MANUAL STEPS REQUIRED:**
1. Run `migrations/fix-dimension-and-canvas-versions.sql` in Supabase SQL Editor
2. After migration, backfill embeddings:
   ```bash
   curl -X POST http://localhost:3000/api/admin/backfill-embeddings \
     -H "Content-Type: application/json" \
     -d '{"limit":100}'
   ```
3. Test semantic search - should show similarity % > 0

---

### 3. ⚠️ Workspace Dropdown Issues
**Problem:** 
- Shows "member with crown" icon (this is correct for owner role)
- Created workspaces don't appear in dropdown

**Root Cause:** Existing workspaces created before the recent fix don't have `workspace_members` entries

**Fix Created:** `migrations/fix-workspace-members.sql`
- Backfills `workspace_members` for all existing workspaces
- Ensures all workspace owners have member entries with role='owner'

**MANUAL STEPS REQUIRED:**
1. Run `migrations/fix-workspace-members.sql` in Supabase SQL Editor
2. Refresh the page
3. Workspaces should now appear in dropdown

**Note:** The crown icon is CORRECT - it indicates you're the owner of that workspace.

---

### 4. ⚠️ Canvas Versions 500 Error
**Problem:** `GET /api/canvases/[id]/versions` returns 500

**Root Cause:** `canvas_versions` table doesn't exist

**Fix Created:** Table creation included in `migrations/fix-dimension-and-canvas-versions.sql`
- Creates `canvas_versions` table with proper schema
- Adds RLS policies
- Creates indexes for performance

**MANUAL STEPS REQUIRED:**
1. Run `migrations/fix-dimension-and-canvas-versions.sql` (same as step 2)
2. Test: Save a canvas → click History icon → should show versions

---

### 5. ✅ Resumable Upload Failures  
**Problem:** "Failed to create resumable upload" when uploading PDFs

**Fixes Applied:**
1. **lib/resumableUpload.ts:**
   - Fixed TUS metadata format (bucketName, objectName, contentType, cacheControl)
   - Added proper error messages with status codes
   - Improved URL construction for Supabase Storage

2. **components/PDFManager.tsx:**
   - Added try-catch around resumable upload initialization
   - Automatically falls back to standard upload if resumable fails
   - Better error handling and user feedback

**Test:** Upload a large PDF (>8MB) - should either use resumable or fallback to standard

---

### 6. 🔍 Missing Saved Canvases
**Problem:** Old canvases don't show anywhere

**Investigation Needed:**
After running the canvas_versions migration, check:
1. Does `/canvas` page show list of canvases?
2. Check database: `SELECT id, title, user_id, created_at FROM canvases ORDER BY created_at DESC LIMIT 10;`
3. If canvases exist but don't show, check RLS policies on canvases table

**Possible Fix:** May need to update canvas list query or RLS policies

---

### 7. 🔍 Template Editing in Canvas
**Problem:** Users cannot alter or fill template words in canvas nodes

**Investigation Needed:**
Check `components/CanvasEditor.tsx` and `components/canvas-nodes/*` for:
1. How template nodes are rendered
2. Whether they have contentEditable or input fields
3. If there's a separate edit mode

**Likely Fix:** Add editing capability to template nodes, similar to text nodes

---

### 8. 🔍 Note Import to Canvas Flow
**Problem:** Importing notes creates whole note instead of logical flow

**Current Behavior:** Likely creates single node with all note content

**Desired Behavior:** 
- Parse note content (summary, takeaways, actions)
- Create connected nodes for each section
- Arrange in logical flow

**Implementation Needed:**
Update note import logic in `components/CanvasEditor.tsx` to:
1. Parse note structure
2. Create separate nodes for summary, each takeaway, each action
3. Connect them with edges
4. Auto-layout (e.g., vertical flow or tree)

---

## Migration Execution Order

Run these in Supabase SQL Editor in this order:

1. **fix-dimension-and-canvas-versions.sql** (fixes semantic search + canvas versions)
2. **fix-workspace-members.sql** (fixes workspace dropdown)

Then run:
```bash
# Backfill embeddings
curl -X POST http://localhost:3000/api/admin/backfill-embeddings \
  -H "Content-Type: application/json" \
  -d '{"limit":100}'
```

---

## Testing Checklist

After applying all fixes:

- [ ] Build completes without warnings: `npm run build`
- [ ] Semantic search shows % match > 0
- [ ] Workspaces appear in dropdown after creation
- [ ] Can switch between workspaces
- [ ] Canvas save creates version history entry
- [ ] Canvas history dialog shows versions
- [ ] PDF upload works (both small and large files)
- [ ] Resumable upload either works or falls back gracefully
- [ ] Can view list of all saved canvases
- [ ] Template nodes can be edited (pending implementation)
- [ ] Note import creates flow structure (pending implementation)

---

## Code Changes Summary

### Modified Files:
1. `next.config.ts` - Fixed PWA warning
2. `lib/resumableUpload.ts` - Fixed TUS upload metadata
3. `components/PDFManager.tsx` - Added resumable upload fallback

### Created Files:
1. `migrations/fix-dimension-and-canvas-versions.sql` - Core database fixes
2. `migrations/fix-workspace-members.sql` - Workspace membership backfill
3. `BUGFIX_SUMMARY.md` - This file

---

## Still TODO (Requires Further Investigation)

1. **Canvas List Visibility** - Find where old canvases went
2. **Template Node Editing** - Add edit capability to template nodes  
3. **Smart Note Import** - Create flow structure from note content

---

Generated: November 9, 2025
