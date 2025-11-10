# Smart Summarizer - Bug Fixes Summary & Implementation Guide

## Issues Identified (from screenshots & user report)

1. ✅ **Workspace disappears after dev restart** - Persistence issue
2. ✅ **Duplicate "Save" buttons in canvas** - UX cleanup  
3. ✅ **Canvas History shows "No versions yet"** - Version creation not triggering
4. ✅ **PDF links download HTML** - Routing/navigation broken
5. ✅ **Analytics Dashboard shows zeros** - Data not loading
6. ✅ **Semantic search only keyword matching (0% shown)** - Embeddings not working
7. ✅ **Buttons allow multiple rapid clicks** - Missing loading states
8. ✅ **Open canvas from search doesn't work** - Navigation handler missing

---

## Priority Order (database → backend → frontend)

### CRITICAL (Database/Security)
- Apply `migrations/fix-security-linter-errors.sql` first
- This fixes RLS on embedding_jobs/embedding_metrics + secures public.users view

### HIGH (Backend API)
1. Canvas version auto-snapshot not triggering
2. Analytics API returning empty/zero data  
3. Semantic search falling back to lexical-only

### MEDIUM (Frontend UX)
4. Duplicate Save button in canvas toolbar
5. Button debouncing/loading states
6. PDF navigation
7. Search result "Open" action
8. Workspace persistence (likely RLS or missing data)

---

## Implementation Plan

Each section below contains:
- Root cause
- Files to edit
- Exact code changes
- Testing steps

---

## 1. CANVAS VERSION HISTORY NOT SHOWING

**Root Cause:** Auto-snapshot logic in `/api/canvases/[id]/route.ts` PATCH handler may not be executing or failing silently.

**Files:**
- `app/api/canvases/[id]/route.ts` (PATCH handler)

**Fix:** Ensure snapshot creation runs AFTER successful canvas update and log errors.

**Code Change:**

In `app/api/canvases/[id]/route.ts`, find the PATCH handler and ensure after updating canvas/nodes/edges, we create a snapshot:

```typescript
// After all updates succeed, create auto snapshot
try {
  const { data: latest } = await supabase
    .from('canvas_versions')
    .select('version_number')
    .eq('canvas_id', canvasId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single();

  const version_number = (latest?.version_number || 0) + 1;

  const snapshot_data = {
    title: title ?? canvas.title,
    description: description ?? canvas.description,
    nodes: updatedNodes || [],
    edges: updatedEdges || [],
  };

  const changedFields = [];
  if (title && title !== canvas.title) changedFields.push('title');
  if (description && description !== canvas.description) changedFields.push('description');
  if (updatedNodes) changedFields.push('nodes');
  if (updatedEdges) changedFields.push('edges');

  await supabase
    .from('canvas_versions')
    .insert({
      canvas_id: canvasId,
      user_id: user.id,
      version_number,
      snapshot_data,
      snapshot_type: 'auto',
      change_description: `Auto save: ${changedFields.join(', ')} updated`,
      changed_fields: changedFields,
      diff_summary: {
        node_count: (updatedNodes || []).length,
        edge_count: (updatedEdges || []).length
      },
    });

  console.log(`✅ Created canvas version ${version_number} for canvas ${canvasId}`);
} catch (versionError) {
  console.error('Failed to create canvas version snapshot:', versionError);
  // Don't fail the whole request if versioning fails
}
```

**Test:**
1. Open a canvas
2. Make changes (add node, move node, rename)
3. Click "Save Canvas"
4. Click "History" - should now show versions

---

## 2. DUPLICATE SAVE BUTTON

**Root Cause:** Two separate save buttons in canvas toolbar (likely "Save" and "Save Canvas").

**File:** `components/CanvasEditor.tsx`

**Fix:** Keep one primary save button, remove duplicate.

**Code Change:**

Around line 1180-1210 in `CanvasEditor.tsx`, locate the toolbar section. You should see TWO save buttons. Remove one:

BEFORE:
```tsx
<Button onClick={handleSave} disabled={saving || !hasChanges}>
  <Save className="h-4 w-4 mr-2" />
  Save
</Button>
{/* ... other buttons ... */}
<Button onClick={handleSave} disabled={saving}>
  {saving ? 'Saving...' : 'Save Canvas'}
</Button>
```

AFTER (keep only one):
```tsx
<Button onClick={handleSave} disabled={saving}>
  <Save className="h-4 w-4 mr-2" />
  {saving ? 'Saving...' : 'Save Canvas'}
</Button>
```

**Test:** Open canvas → verify only ONE save button appears.

---

## 3. ANALYTICS DASHBOARD SHOWS ZEROS

**Root Cause:** Either no data exists OR the analytics API has permission/RLS issues.

**Files:**
- `migrations/fix-security-linter-errors.sql` (apply this first!)
- `app/api/analytics/route.ts` (check logic)

**Primary Fix:** Apply the security migration to enable RLS properly on embedding_jobs/metrics.

**Secondary Check:** Ensure the analytics API uses service role or correct auth context.

In `app/api/analytics/route.ts`, verify it's fetching with proper auth:

```typescript
const supabase = await getServerSupabase();
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Fetch user's notes (with RLS applied)
const { data: notes } = await supabase
  .from('notes')
  .select('id, original_notes, created_at')
  .eq('user_id', user.id);
```

**Test:**
1. Create a few notes with the summarizer
2. Visit `/analytics`
3. Should show note count, summaries, sentiment distribution

---

## 4. SEMANTIC SEARCH ONLY KEYWORD MATCHING

**Root Cause:** Search showing "0% match" means semantic/vector search is failing → falling back to lexical.

**Likely causes:**
- Notes don't have embeddings (embedding column is NULL)
- Embedding dimension mismatch (1536 vs 384) blocking insert
- Search API not properly calling semantic phase

**Files:**
- `app/api/search/route.ts`
- Run backfill: `POST /api/admin/backfill-embeddings`

**Fix:**

1. **Check if embeddings exist:**
   ```sql
   SELECT id, embedding IS NOT NULL as has_embedding
   FROM notes
   WHERE user_id = auth.uid()
   LIMIT 10;
   ```

2. **Backfill missing embeddings:**
   ```bash
   curl -X POST http://localhost:3000/api/admin/backfill-embeddings \
     -H 'Content-Type: application/json' \
     -d '{"limit":100}'
   ```

3. **Verify search API semantic phase:**

In `app/api/search/route.ts`, ensure this logic exists:

```typescript
// Phase 1: Semantic (vector) search
const { data: semanticResults, error: semanticError } = await supabase
  .rpc('match_notes', {
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: 10,
    filter_user_id: user.id,
    filter_folder_id: folderId || null
  });

if (semanticError) {
  console.error('Semantic search failed, falling back to lexical:', semanticError);
  // Fall back to text search...
} else if (semanticResults && semanticResults.length > 0) {
  return NextResponse.json({ results: semanticResults, mode: 'semantic' });
}
```

**Test:**
1. Summarize a note with URL (e.g., Wikipedia article on "Politics")
2. Wait a moment for embedding generation
3. Search "politic overview" → should show > 0% match

---

## 5. PDF NAVIGATION DOWNLOADS HTML

**Root Cause:** PDF links likely point to API endpoint instead of frontend route.

**Files:**
- Components rendering PDF links (likely `History.tsx`, `SearchBar.tsx`)

**Fix:** Ensure PDF links use `/pdf` route, not `/api/pdfs/[id]`.

**Code Pattern:**

WRONG:
```tsx
<a href={`/api/pdfs/${pdfId}`}>View PDF</a>
```

RIGHT:
```tsx
<Link href={`/pdf?id=${pdfId}`}>View PDF</Link>
// or
<Link href={`/pdf/${pdfId}`}>View PDF</Link>
```

Search for all instances:
```bash
grep -r "href.*api/pdfs" components/
```

Replace with proper Next.js routing.

**Test:** Click a PDF link → should navigate to `/pdf` page, not download.

---

## 6. BUTTONS ALLOW MULTIPLE RAPID CLICKS

**Root Cause:** Missing `disabled={isLoading}` states on action buttons.

**Pattern to apply everywhere:**

```tsx
// BAD
<Button onClick={handleAction}>
  Do Thing
</Button>

// GOOD
const [loading, setLoading] = useState(false);

<Button onClick={handleAction} disabled={loading}>
  {loading ? 'Processing...' : 'Do Thing'}
</Button>

const handleAction = async () => {
  setLoading(true);
  try {
    await someAsyncOperation();
  } finally {
    setLoading(false);
  }
};
```

**Critical locations:**
- `components/SummarizerApp.tsx` - Summarize button
- `components/SearchBar.tsx` - Search button  
- `components/CanvasEditor.tsx` - All action buttons (Save, Export, etc.)
- `components/History.tsx` - Delete, Share buttons
- `components/WorkspaceManager.tsx` - Create, Delete buttons

**Test:** Rapidly click any button → should only execute once.

---

## 7. OPEN CANVAS FROM SEARCH DOESN'T WORK

**Root Cause:** Search results likely show an "Open" button for canvas-linked notes, but the click handler is missing or broken.

**File:** `components/SearchBar.tsx`

**Fix:** Add navigation handler for canvas notes.

```tsx
const handleOpenNote = (note: SearchResult) => {
  if (note.canvas_id) {
    // Navigate to canvas
    router.push(`/canvas?id=${note.canvas_id}`);
  } else {
    // Open note detail or copy to clipboard
    // ... existing logic
  }
};

// In the render:
<Button onClick={() => handleOpenNote(result)}>
  <ExternalLink className="h-4 w-4 mr-2" />
  Open
</Button>
```

**Test:**
1. Create a note linked to a canvas
2. Search for it
3. Click "Open" → should navigate to `/canvas?id=...`

---

## 8. WORKSPACE DISAPPEARS AFTER DEV RESTART

**Root Cause:** Likely one of:
- Workspace not persisting to DB (insert failing silently)
- RLS blocking read on restart
- Client-side state not refreshing from server

**Debug Steps:**

1. **Check if workspace exists in DB:**
   ```sql
   SELECT * FROM workspaces WHERE user_id = auth.uid();
   SELECT * FROM workspace_members WHERE user_id = auth.uid();
   ```

2. **Check RLS policies:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename IN ('workspaces', 'workspace_members');
   ```

3. **Check API logs:**
   - After creating workspace, check network tab: `POST /api/workspaces` → 201?
   - After restart, check: `GET /api/workspaces` → returns the workspace?

**Likely Fix:**

In `app/api/workspaces/route.ts` POST handler, ensure proper insert + member record:

```typescript
// Insert workspace
const { data: workspace, error: workspaceError } = await supabase
  .from('workspaces')
  .insert({ name, description, owner_id: user.id })
  .select()
  .single();

if (workspaceError) {
  console.error('Workspace insert failed:', workspaceError);
  return NextResponse.json({ error: workspaceError.message }, { status: 500 });
}

// Insert owner as member
const { error: memberError } = await supabase
  .from('workspace_members')
  .insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: 'owner'
  });

if (memberError) {
  console.error('Member insert failed:', memberError);
  // Rollback workspace?
}

console.log('✅ Created workspace:', workspace.id, workspace.name);
return NextResponse.json({ workspace }, { status: 201 });
```

**Test:**
1. Create workspace "Test WS"
2. Restart dev server (`npm run dev`)
3. Reload page → workspace should still appear

---

## Testing Checklist

After applying all fixes:

- [ ] Run database migration: `fix-security-linter-errors.sql`
- [ ] Restart dev server
- [ ] Create workspace → restart → still appears
- [ ] Canvas: only ONE save button visible
- [ ] Canvas: save → click History → versions appear
- [ ] Create notes → visit Analytics → shows stats
- [ ] Backfill embeddings → search → shows % match > 0
- [ ] Click PDF link → navigates to `/pdf` page
- [ ] Rapid-click any button → executes only once
- [ ] Search result → click Open → navigates to canvas/note

---

## Quick Wins (Priority Order)

1. **Apply security migration** (5 min) - Critical for RLS
2. **Remove duplicate Save button** (2 min) - UX polish
3. **Add canvas auto-snapshot** (10 min) - Fix history
4. **Fix PDF links** (5 min) - Simple href change
5. **Add button loading states** (15 min) - Prevent double-clicks
6. **Backfill embeddings** (2 min) - Enable semantic search
7. **Debug workspace persistence** (10 min) - Check DB + RLS
8. **Fix search Open button** (5 min) - Add navigation handler

Total estimated time: ~1 hour for all fixes.

---

## Files Changed Summary

1. `migrations/fix-security-linter-errors.sql` (already created)
2. `app/api/canvases/[id]/route.ts` (add auto-snapshot)
3. `components/CanvasEditor.tsx` (remove duplicate button)
4. `app/api/search/route.ts` (verify semantic logic)
5. `components/SearchBar.tsx` (add Open handler + loading states)
6. `components/SummarizerApp.tsx` (add loading states)
7. `components/History.tsx` (fix PDF links + loading states)
8. `app/api/workspaces/route.ts` (debug persistence)

Each file should have minimal, surgical changes to avoid breaking existing functionality.
