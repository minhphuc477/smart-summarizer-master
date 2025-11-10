# TESTING GUIDE - All Fixes Applied

## What Was Fixed

### ✅ 1. Delete Workspace Feature - IMPLEMENTED
- **Backend**: DELETE `/api/workspaces/{id}` with owner check
- **Frontend**: Delete button in Workspace Settings
- **Location**: Settings icon → Settings tab → Delete Workspace button

### ✅ 2. Workspace Property Mapping - FIXED
- **Problem**: API returns `workspace_id`, component expected `id`
- **Fix**: Added property mapping in `fetchWorkspaces()`
- **Result**: Workspaces should now show names in dropdown

### ✅ 3. Search Results Display - ENHANCED
- **Fix 1**: Removed double-filtering (was filtering results twice)
- **Fix 2**: Lowered default threshold (0.75 → 0.5)
- **Fix 3**: Disabled restrictToFolder by default
- **Fix 4**: Added comprehensive debug logging
- **Result**: Search should now show results when server returns them

### ✅ 4. Webhook Loading Timeout - FIXED
- **Problem**: Infinite loading if API slow/fails
- **Fix**: Added 10-second timeout with abort controller
- **Result**: Shows error message instead of infinite loading

### ✅ 5. PDF & Canvas - NO CHANGES NEEDED
- **PDF**: Table name already correct (`pdf_documents`)
- **Canvas**: Templates work as designed (load and save)

---

## How to Test

### Test 1: Workspace Names Show Up
**Expected**: Dropdown shows workspace names (not just crowns)

1. Reload page (Ctrl+Shift+R)
2. Click workspace dropdown
3. **PASS**: You see "Team Work", "Personal Learning", etc. with names
4. **FAIL**: Still seeing only crown icons without names

**If fails**: Check browser console for `[WorkspaceManager] Mapped workspaces:` log

---

### Test 2: Semantic Search Returns Results
**Expected**: Searching "politic" shows matching notes

1. Open browser console (F12)
2. Type "politic" in search box
3. Check console logs:
   - `[SearchBar] handleSearch called with query: politic`
   - `[SearchBar] Starting search...`
   - `[SearchBar] Server returned results: 8`
   - `[SearchBar] State updated - hasSearched: true, resultsCount: 8`

4. **PASS**: UI shows "Found 8 relevant notes" with result cards
5. **FAIL**: Shows "No results" even though console says 8 results

**If fails**: 
- Check if `searchResults.length` in console
- Check if `hasSearched` is true
- Look for React rendering errors

---

### Test 3: Delete Workspace
**Expected**: Can delete workspace as owner

1. Create a test workspace: "Test Delete"
2. Select it from dropdown
3. Click Settings icon (⚙️) next to workspace selector
4. Go to "Settings" tab
5. Click "Delete Workspace" (red button)
6. Confirm deletion
7. **PASS**: Workspace disappears, you're back to "Personal"
8. **FAIL**: Error or workspace still exists

**If fails**: Check Network tab for DELETE request status

---

### Test 4: Webhooks Load (Not Stuck)
**Expected**: Webhook page loads within 10 seconds

1. Navigate to webhooks section
2. Wait up to 10 seconds
3. **PASS**: Either shows webhook list OR shows error message
4. **FAIL**: Infinite loading spinner

**If fails**: 
- Check console for errors
- Check Network tab for `/api/webhooks` request
- Verify webhooks table exists in database

---

### Test 5: PDF Upload and Summarize
**Expected**: Can upload PDF and see summarize button

1. Go to PDF section
2. Upload a small PDF (< 5MB)
3. Wait for status to change: uploading → pending → processing → completed
4. **PASS**: "Summarize" button appears when status = completed
5. **FAIL**: Stuck in "processing" or no button appears

**If fails**:
- Check if `pdf_documents` table exists
- Check RLS policies on `pdf_documents`
- Verify Supabase Storage bucket `pdf-documents` exists

---

### Test 6: Canvas Templates
**Expected**: Can load and save templates

1. Open canvas editor
2. Click "Templates" button
3. **PASS**: Template list appears
4. Select a template
5. **PASS**: Canvas loads with template nodes
6. Make changes
7. Click "Save as Template"
8. **PASS**: Can save with new name

**If fails**:
- Check if `canvas_templates` table exists
- Run migration `supabase-migration-canvas-templates.sql`

---

## Debug Information to Collect

If any test fails, provide:

### For Workspace Issue:
```
Console log output:
[WorkspaceManager] Fetching workspaces...
[WorkspaceManager] Response status: ???
[WorkspaceManager] Received data: ???
[WorkspaceManager] Mapped workspaces: ???
```

### For Search Issue:
```
Console log output:
[SearchBar] handleSearch called with query: ???
[SearchBar] Server returned results: ???
[SearchBar] Results: [array of objects]
[SearchBar] State updated - hasSearched: ???, resultsCount: ???

Also check:
- Does UI show loading skeleton?
- Does UI show "No results" message?
- Any errors in console?
```

### For API Issues:
```
Network tab (F12 → Network):
- Request URL: ???
- Status Code: ???
- Response body: ???
- Request took: ??? ms
```

---

## Expected Console Logs (Success Case)

### Workspace Loading:
```
[WorkspaceManager] Fetching workspaces...
[WorkspaceManager] Response status: 200
[WorkspaceManager] Received data: {workspaces: Array(7)}
[WorkspaceManager] Workspaces count: 7
[WorkspaceManager] Mapped workspaces: Array(7) [
  {id: '...', name: 'Team Work', ...},
  {id: '...', name: 'Personal Learning', ...},
  ...
]
[WorkspaceManager] Rendering workspaces, count: 7
[WorkspaceManager] Rendering workspace: abc123 Team Work
[WorkspaceManager] Rendering workspace: def456 Personal Learning
...
```

### Search Execution:
```
[SearchBar] handleSearch called with query: politic
[SearchBar] Starting search...
[SearchBar] Server returned results: 8
[SearchBar] Results: (8) [{id: 5, summary: 'Politics', ...}, ...]
[SearchBar] Setting search results...
[SearchBar] State updated - hasSearched: true, resultsCount: 8
```

---

## Quick Fix Commands

### If browser cache is the issue:
```
Windows: Ctrl + Shift + R (hard refresh)
Mac: Cmd + Shift + R
```

### If database is missing tables:
```sql
-- Run in Supabase SQL Editor
-- 1. PDF Support
\i migrations/supabase-migration-pdf-support.sql

-- 2. Canvas Templates
\i migrations/supabase-migration-canvas-templates.sql

-- 3. Webhooks
\i migrations/supabase-migration-webhooks.sql
```

### If Supabase Storage bucket missing:
```
Go to Supabase Dashboard → Storage
Create bucket: pdf-documents
Settings:
- Public: false
- File size limit: 100MB
- Allowed MIME types: application/pdf
```

---

## Success Criteria

All fixes successful if:
- ✅ Workspace dropdown shows names
- ✅ Search for "politic" returns and displays results
- ✅ Can delete workspaces as owner
- ✅ Webhooks page loads (not stuck)
- ✅ PDF upload shows status and summarize button
- ✅ Canvas templates load and save

---

## If Still Having Issues

Provide screenshot of:
1. Browser console (F12 → Console tab)
2. Network requests (F12 → Network tab)
3. The actual UI showing the problem

Also specify:
- Which test failed?
- What error message appears?
- What does the console log show?
