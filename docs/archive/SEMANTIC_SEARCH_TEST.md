# Semantic Search Test Instructions

## Test this to verify semantic search is working:

### Step 1: Create a test note with this content:
```
Meeting notes about project timeline and budget constraints.
We discussed the quarterly revenue targets and marketing strategy.
```

### Step 2: Use these search phrases (semantic should find the note even though exact words don't match):

**Test Phrase 1:** "financial planning discussion"
- Should find the note because it's semantically related to "budget" and "revenue"

**Test Phrase 2:** "business goals meeting"  
- Should find the note because it relates to "targets" and "strategy"

**Test Phrase 3:** "schedule and costs"
- Should find the note because it's semantically similar to "timeline" and "budget"

## What to look for:
- ✅ **SUCCESS**: Note appears in results WITHOUT the yellow warning
- ❌ **FAILURE**: Yellow warning says "Using keyword matches" OR no results

## If it fails:
The search API might be returning an error. Check browser console (F12) for errors.
