# 🧪 Browser Console Tests

## Run these in Browser DevTools Console (F12 → Console tab)

### Test 1: Check if workspaces are loading
```javascript
// Fetch workspaces
fetch('/api/workspaces')
  .then(r => r.json())
  .then(data => {
    console.log('Workspaces loaded:', data.workspaces?.length || 0);
    console.table(data.workspaces);
  });
```

**Expected:** Should show 7 workspaces

### Test 2: Test search API
```javascript
// Test search for "politic"
fetch('/api/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'politic',
    userId: 'af5616ae-d19b-47fb-93c2-790f9cc40fd0',
    matchCount: 10,
    matchThreshold: 0.5
  })
})
.then(r => r.json())
.then(data => {
  console.log('Search results:', data.count);
  console.table(data.results);
});
```

**Expected:** Should show 6-8 results

### Test 3: Check localStorage state
```javascript
// Check if workspace/folder are persisted
console.log('Stored workspace:', localStorage.getItem('selectedWorkspaceId'));
console.log('Stored folder:', localStorage.getItem('selectedFolderId'));
```

### Test 4: Force reload workspace data
```javascript
// Clear localStorage and reload
localStorage.removeItem('selectedWorkspaceId');
localStorage.removeItem('selectedFolderId');
location.reload();
```

### Test 5: Check if search filter state
```javascript
// This will show if the old SearchBar is still cached
document.querySelector('[data-testid="search-input"]')?.getAttribute('min-similarity');
```

## 🔧 Quick Fixes

### If workspaces API returns empty array:
```javascript
// Check auth status
fetch('/api/workspaces')
  .then(r => {
    console.log('Status:', r.status);
    if (r.status === 401) console.error('Not authenticated!');
    return r.json();
  })
  .then(data => console.log(data));
```

### If search returns 0 results but API shows results:
```javascript
// Check if old SearchBar is filtering results
const searchBar = document.querySelector('input[placeholder*="Search"]');
console.log('Search bar element:', searchBar);
// Check React DevTools → Components → SearchBar → minSimilarity (should be 0.5)
```

### Force clear all cache:
```javascript
// Nuclear option - clears everything
localStorage.clear();
sessionStorage.clear();
location.reload(true);
```

## ✅ Expected Results After Fix

1. **Workspaces API:** Returns 7 workspaces
2. **Search API:** Returns 6-8 results for "politic"
3. **localStorage:** Should persist workspace/folder IDs
4. **SearchBar minSimilarity:** Should be 0.5 (not 0.75)
5. **Workspace dropdown:** Shows all 7 workspace names (not just crowns)
