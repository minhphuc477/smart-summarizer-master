# CRITICAL BUGFIXES - Apply Immediately

## File 1: Remove Duplicate Save Button

**File:** `components/CanvasEditor.tsx`

**Issue:** Two "Save" buttons appear in the canvas toolbar (lines 1187 and 1364).

**Fix:** Remove the second one (line 1364 in the secondary toolbar).

**Action:** Delete these lines (around line 1364):

```tsx
<Button onClick={saveCanvas} disabled={saving} size="sm">
  <Save className="h-4 w-4 mr-2" />
  {saving ? 'Saving...' : 'Save'}
</Button>
```

Keep only the one at line 1187 (the one that says "Save Canvas").

---

## File 2: Canvas Auto-Snapshot Already Implemented ✅

**Status:** The auto-snapshot logic IS already in `/app/api/canvases/[id]/route.ts` PATCH handler.

**Possible issue:** Migration may not have been applied yet.

**Verify:** 
1. Run the SQL migration: `migrations/supabase-migration-canvas-versions.sql` 
2. Check if table exists:
   ```sql
   SELECT * FROM canvas_versions LIMIT 1;
   ```

If table doesn't exist → apply migration first!

---

## File 3: Add Button Loading States (Prevent Double-Click)

### 3A: SummarizerApp - Summarize Button

**File:** `components/SummarizerApp.tsx`

Find the summarize button and ensure it has `disabled={loading}`:

```tsx
const [loading, setLoading] = useState(false);

<Button 
  onClick={handleSummarize} 
  disabled={loading || !notes.trim()}
>
  {loading ? 'Summarizing...' : 'Summarize'}
</Button>

const handleSummarize = async () => {
  setLoading(true);
  try {
    // ... existing logic
  } finally {
    setLoading(false);
  }
};
```

### 3B: SearchBar - Search Button

**File:** `components/SearchBar.tsx`

Add loading state to search button:

```tsx
const [searching, setSearching] = useState(false);

<Button 
  onClick={handleSearch} 
  disabled={searching || !query.trim()}
>
  {searching ? 'Searching...' : 'Search'}
</Button>

const handleSearch = async () => {
  setSearching(true);
  try {
    // ... existing logic
  } finally {
    setSearching(false);
  }
};
```

### 3C: History Component - Delete/Share Buttons

**File:** `components/History.tsx`

Wrap all async button handlers with loading states:

```tsx
const [deletingId, setDeletingId] = useState<number | null>(null);

<Button 
  onClick={() => handleDelete(note.id)} 
  disabled={deletingId === note.id}
>
  {deletingId === note.id ? 'Deleting...' : 'Delete'}
</Button>

const handleDelete = async (id: number) => {
  setDeletingId(id);
  try {
    // ... existing logic
  } finally {
    setDeletingId(null);
  }
};
```

---

## File 4: Fix PDF Link Navigation

**Issue:** PDF links download HTML instead of navigating to `/pdf` page.

**Files to Check:**
- `components/History.tsx`
- `components/SearchBar.tsx`  
- Any component rendering PDF links

**Find:**
```tsx
<a href={`/api/pdfs/${pdfId}`}>View PDF</a>
```

**Replace with:**
```tsx
import Link from 'next/link';

<Link href={`/pdf?id=${pdfId}`}>View PDF</Link>
```

OR use router:
```tsx
import { useRouter } from 'next/navigation';

const router = useRouter();

<Button onClick={() => router.push(`/pdf?id=${pdfId}`)}>
  View PDF
</Button>
```

---

## File 5: Fix Semantic Search (Enable Embeddings)

**Root Cause:** Notes don't have embeddings yet.

**Steps:**

1. **Check if embeddings exist:**
   ```sql
   SELECT id, embedding IS NOT NULL as has_embedding 
   FROM notes 
   WHERE user_id = auth.uid() 
   LIMIT 10;
   ```

2. **Backfill embeddings:**
   ```powershell
   curl -X POST http://localhost:3000/api/admin/backfill-embeddings `
     -H 'Content-Type: application/json' `
     -d '{\"limit\":100}'
   ```

3. **Verify search API:**

In `app/api/search/route.ts`, ensure semantic search runs FIRST before lexical fallback:

```typescript
// Generate embedding for query
const embedding = await generateEmbedding(query);

// Phase 1: Semantic/vector search
const { data: semanticResults, error: semanticError } = await supabase
  .rpc('match_notes', {
    query_embedding: embedding,
    match_threshold: 0.5,
    match_count: 10,
    filter_user_id: user.id
  });

if (!semanticError && semanticResults && semanticResults.length > 0) {
  console.log(`✅ Semantic search found ${semanticResults.length} results`);
  return NextResponse.json({ 
    results: semanticResults, 
    mode: 'semantic' 
  });
}

// Fallback to lexical search
console.log('⚠️ Semantic search failed, using lexical fallback');
// ... lexical search logic
```

---

## File 6: Fix Canvas Open from Search Results

**File:** `components/SearchBar.tsx`

Find the "Open" button in search results and add navigation:

```tsx
import { useRouter } from 'next/navigation';

const router = useRouter();

const handleOpenResult = (result: SearchResult) => {
  if (result.canvas_id) {
    router.push(`/canvas?id=${result.canvas_id}`);
  } else if (result.note_id) {
    // Copy summary or show detail
    navigator.clipboard.writeText(result.summary || '');
    toast.success('Summary copied to clipboard');
  }
};

// In render:
<Button onClick={() => handleOpenResult(result)}>
  <ExternalLink className="h-4 w-4 mr-2" />
  Open
</Button>
```

---

## File 7: Analytics Dashboard Missing Stats

**Root Cause:** Either no data OR RLS blocking reads.

**Fix:**

1. **Apply security migration first:**
   Run `migrations/fix-security-linter-errors.sql` to fix RLS on `embedding_jobs` and `embedding_metrics`.

2. **Check analytics API:**

In `app/api/analytics/route.ts`, ensure proper auth and data fetching:

```typescript
const supabase = await getServerSupabase();
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Fetch user's notes
const { data: notes, error: notesError } = await supabase
  .from('notes')
  .select('id, original_notes, summary, created_at, sentiment')
  .eq('user_id', user.id);

if (notesError) {
  console.error('Analytics: failed to fetch notes:', notesError);
}

const totalNotes = notes?.length || 0;
const summaries = notes?.filter(n => n.summary).length || 0;
const wordsProcessed = notes?.reduce((sum, n) => 
  sum + (n.original_notes?.split(/\s+/).length || 0), 0) || 0;

return NextResponse.json({
  totalNotes,
  summaries,
  wordsProcessed,
  sentimentDistribution: {
    positive: notes?.filter(n => n.sentiment === 'positive').length || 0,
    neutral: notes?.filter(n => n.sentiment === 'neutral').length || 0,
    negative: notes?.filter(n => n.sentiment === 'negative').length || 0,
  }
});
```

---

## File 8: Workspace Persistence Issue

**Debug Steps:**

1. **Check if workspace persists in DB:**
   ```sql
   SELECT * FROM workspaces WHERE user_id = auth.uid();
   SELECT * FROM workspace_members WHERE user_id = auth.uid();
   ```

2. **Check POST /api/workspaces logs:**

In `app/api/workspaces/route.ts` POST handler, add logging:

```typescript
const { data: workspace, error: workspaceError } = await supabase
  .from('workspaces')
  .insert({ name, description, owner_id: user.id })
  .select()
  .single();

if (workspaceError) {
  console.error('❌ Workspace insert failed:', workspaceError);
  return NextResponse.json({ error: workspaceError.message }, { status: 500 });
}

console.log('✅ Workspace created:', workspace.id, workspace.name);

// Insert owner as member
const { error: memberError } = await supabase
  .from('workspace_members')
  .insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: 'owner'
  });

if (memberError) {
  console.error('❌ Member insert failed:', memberError);
}

return NextResponse.json({ workspace }, { status: 201 });
```

3. **Check GET /api/workspaces:**

Verify it returns workspaces after server restart.

---

## Priority Execution Order

1. ✅ **Apply `migrations/fix-security-linter-errors.sql`** (5 min)
2. ✅ **Remove duplicate Save button** in CanvasEditor.tsx (2 min)
3. ✅ **Add button loading states** (15 min - 3 files)
4. ✅ **Fix PDF navigation** (5 min - change href to Link)
5. ✅ **Backfill embeddings** (2 min - run curl command)
6. ✅ **Fix search Open handler** (5 min - add router.push)
7. ✅ **Debug workspace persistence** (10 min - add logging)
8. ✅ **Verify analytics API** (5 min - check RLS + data fetch)

---

## Testing Checklist

After all fixes:

- [ ] Only ONE save button visible in canvas
- [ ] Canvas History shows versions after saving
- [ ] Rapid button clicks don't execute multiple times
- [ ] PDF links navigate to `/pdf` page (not download)
- [ ] Semantic search shows % match > 0
- [ ] Search "Open" button navigates to canvas
- [ ] Analytics shows actual stats (not zeros)
- [ ] Workspaces persist after server restart

---

## Quick Win Scripts

### Backfill Embeddings
```powershell
curl -X POST http://localhost:3000/api/admin/backfill-embeddings `
  -H 'Content-Type: application/json' `
  -d '{\"limit\":100}'
```

### Check Embeddings Exist
```sql
SELECT 
  COUNT(*) as total,
  COUNT(embedding) as with_embedding,
  COUNT(*) - COUNT(embedding) as missing
FROM notes
WHERE user_id = auth.uid();
```

### Verify Canvas Versions Table
```sql
SELECT * FROM canvas_versions LIMIT 5;
```

### Check Workspace Persistence
```sql
SELECT w.*, wm.role
FROM workspaces w
JOIN workspace_members wm ON w.id = wm.workspace_id
WHERE wm.user_id = auth.uid();
```

---

## Files Modified Summary

1. `migrations/fix-security-linter-errors.sql` (already created ✅)
2. `components/CanvasEditor.tsx` - remove duplicate button
3. `components/SummarizerApp.tsx` - add loading state
4. `components/SearchBar.tsx` - add loading state + Open handler
5. `components/History.tsx` - add loading states + fix PDF links
6. `app/api/workspaces/route.ts` - add logging
7. `app/api/analytics/route.ts` - verify data fetch
8. `app/api/search/route.ts` - verify semantic search

All changes are surgical and low-risk. Each can be tested independently.
