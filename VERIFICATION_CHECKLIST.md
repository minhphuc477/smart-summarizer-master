# PDF Summarization End-to-End Verification Checklist

## Pre-Test Setup
- [ ] Ensure Supabase environment variables are set in `.env.local`
- [ ] Ensure GROQ API key is set
- [ ] Run `npm run dev` to start the development server
- [ ] Open browser DevTools Console and Network tabs

## Test Flow

### 1. Upload PDF
- [ ] Navigate to PDF Manager in the app
- [ ] Select a PDF file to upload
- [ ] Verify upload progress shows correctly
- [ ] Verify upload completes successfully
- [ ] Check console for any upload errors

**Expected**: PDF appears in the list with status "completed"

### 2. Trigger Summarization
- [ ] Click "Summarize" button on the uploaded PDF
- [ ] Wait for summarization to complete

**Expected Server Response** (check Network tab for `/api/pdf/summarize`):
```json
{
  "success": true,
  "note_id": <number>,
  "note": {
    "id": <number>,
    "summary": "...",
    "takeaways": [...],
    ...
  },
  "pdf_id": "...",
  "summary": "...",
  "takeaways": [...],
  "actions": [...],
  "sentiment": "...",
  "tags": [...],
  "page_references": <number>
}
```

**Expected Console Logs**:
```
[PDF Summarize] Created note: <id>
[PDFManager] Navigating to note <id>
```

### 3. Verify Embedding Generation
Wait ~2-10 seconds for background embedding generation.

**Expected Server Logs** (check terminal running `npm run dev`):
```
[PDF Summarize] embedding-trigger attempt=1 status=200 noteId=<id> body={"success":true}
```

**If you see attempt=2 or attempt=3**: Retry logic is working (network/timing issue on first attempt)

**If you see status=500**: Check the error message in the body. The vector casting fix should prevent this.

**If you see status=404**: This means the note wasn't found. Check:
- Cookie forwarding is working
- Note was actually created (check Supabase `notes` table)
- RLS policies allow access

### 4. Verify Auto-Linking
After embedding completes, auto-linking should trigger.

**Expected**: POST to `/api/notes/<id>/links` returns 200 or 201

**Check**:
- [ ] No 404 errors in server logs for `/api/notes/<id>/links`
- [ ] Embedding saved successfully (check `notes.embedding` column in Supabase)
- [ ] Links created in `note_links` table (if similar notes exist)

### 5. Verify Client Navigation
After summarization completes (1.5 seconds delay):

**Expected**:
- [ ] Success message appears: "PDF summarized successfully!"
- [ ] Browser navigates to `/notes/<id>`
- [ ] Console shows: `[PDFManager] Navigating to note <id>`

**If navigation fails with 404**:
- This is a **frontend route** 404, not an API 404
- Check if `app/notes/[id]/page.tsx` exists
- If it doesn't exist, the note was created but there's no page to display it
- You may need to create this page or change navigation target

### 6. Verify Note Access
If `/notes/<id>` page exists:

**Expected**:
- [ ] Note details are displayed
- [ ] Summary, takeaways, actions, tags are visible
- [ ] Can view linked notes (if auto-linking succeeded)

## Common Issues & Solutions

### ❌ "cannot cast type extensions.vector to double precision[]"
**Status**: ✅ FIXED in `app/api/generate-embedding/route.ts`
- Embedding array now converted to pgvector string format

### ❌ POST /api/notes/:id/links returns 404
**Status**: ✅ FIXED 
- Cookie header now forwarded to internal requests
- Retry logic with exponential backoff added
- Should see successful 200/201 responses

### ❌ "page_references": 0
**Status**: ⚠️ EXPECTED for many documents
- Current logic uses simple substring matching
- Will return 0 if takeaways don't appear verbatim in page text
- Enhancement planned but not critical

### ❌ Client navigates but shows 404 page
**Status**: ⚠️ Frontend route may not exist
- Check if `app/notes/[id]/page.tsx` exists
- If not, create the page or adjust navigation target
- API is working correctly; this is a routing issue

## Success Criteria

All must pass:
- ✅ PDF uploads successfully
- ✅ Summarization completes and returns `note_id` + `note` object
- ✅ Embedding saves without vector type errors
- ✅ Server logs show `attempt=1 status=200` (or 201) for embedding trigger
- ✅ No 404 errors for `/api/notes/:id/links`
- ✅ Client navigates to `/notes/:id` (may show 404 page if route doesn't exist)

## Files Modified

1. **app/api/pdf/summarize/route.ts**
   - Returns full `note` object + `note_id`
   - Forwards Cookie header to embedding trigger
   - Retry logic with logging

2. **app/api/generate-embedding/route.ts**
   - Converts embedding array to pgvector string format
   - Fixes vector type casting error

3. **components/PDFManager.tsx**
   - Reads `note_id` from response
   - Navigates to `/notes/:id` after 1.5s delay
   - Console logging added

4. **migrations/20251110_fix_remaining_search_path.sql**
   - Fixes database security warnings
   - Adds `SET search_path = ''` to remaining functions
