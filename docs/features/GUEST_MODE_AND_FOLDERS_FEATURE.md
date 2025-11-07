# Chức năng 7 & 8: Guest Mode + Folders/Notebooks

## Tổng quan
Smart Summarizer đã được mở rộng với 2 tính năng quan trọng:
1. **Guest Mode**: Cho phép người dùng trải nghiệm app mà không cần đăng ký
2. **Folders/Notebooks**: Tổ chức notes thành các thư mục để quản lý dễ dàng

## 🎭 Guest Mode

### Tính năng
- ✅ Truy cập app không cần đăng nhập
- ✅ Giới hạn 5 summaries miễn phí
- ✅ Lưu lịch sử tạm thời trong browser (localStorage)
- ✅ Giới hạn 10 notes trong history
- ✅ Tất cả AI features (summarization, tags, sentiment)
- ✅ Dark/Light theme
- ⚠️ Không có cloud sync
- ⚠️ Không có folders
- ⚠️ Không có semantic search

### Công nghệ
**localStorage-based persistence**
- Storage key: `smart-summarizer-guest`
- Data structure:
```typescript
{
  usageCount: number,      // Số lần đã dùng (max 5)
  history: GuestNote[],    // Array các notes (max 10)
  lastUsed: string         // Timestamp lần dùng cuối
}
```

### Files
**`/lib/guestMode.ts`**
```typescript
// Helper functions
- initGuestData(): Khởi tạo guest data
- getGuestData(): Lấy data từ localStorage
- saveGuestData(): Lưu data vào localStorage
- canGuestUse(): Check còn quota không
- getRemainingUsage(): Số lần còn lại
- incrementGuestUsage(): Tăng usage count
- addGuestNote(): Thêm note vào history
- deleteGuestNote(): Xóa note
- clearGuestData(): Reset all data
- getGuestHistory(): Lấy history
- isGuestMode(): Check if user is guest
```

### UI Flow
1. **Landing Page** (`/app/page.tsx`):
   - 2 columns: "Sign In" | "Try as Guest"
   - Display remaining uses
   - Disable "Continue as Guest" khi hết quota
   - Theme toggle ở góc phải trên

2. **Guest Usage**:
   - Header hiển thị: "Guest Mode (X uses left)"
   - Warning banner: "Sign in for unlimited access"
   - Không có folders sidebar
   - Không có search bar
   - History chỉ hiển thị guest notes từ localStorage

3. **Limit Reached**:
   - Error message: "You've reached the guest limit"
   - Prompt to sign in

### API Integration
**`/app/api/summarize/route.ts`**
```typescript
POST /api/summarize
Body: {
  notes: string,
  customPersona: string,
  isGuest: boolean,        // ← NEW
  userId?: string,
  folderId?: number
}

// Logic:
if (isGuest) {
  // Chỉ return kết quả, không lưu DB
  return NextResponse.json(jsonResponse);
} else {
  // Lưu vào Supabase với folder_id
  ...
}
```

### LocalStorage Data
```json
{
  "usageCount": 3,
  "history": [
    {
      "id": "guest-1730000000000-abc123",
      "original_notes": "Meeting notes...",
      "persona": "Professional assistant",
      "summary": "Key points from meeting",
      "takeaways": ["Point 1", "Point 2"],
      "actions": ["Action 1"],
      "tags": ["meeting", "work"],
      "sentiment": "neutral",
      "created_at": "2025-10-27T10:30:00.000Z"
    }
  ],
  "lastUsed": "2025-10-27T10:30:00.000Z"
}
```

---

## 📁 Folders/Notebooks

### Tính năng
- ✅ Tạo folders với tên, mô tả, màu sắc
- ✅ Edit/Delete folders
- ✅ Move notes vào folders
- ✅ Filter history theo folder
- ✅ Folder stats (số notes, last update)
- ✅ Sidebar navigation
- ✅ Auto-save notes vào selected folder
- ✅ Visual folder indicators

### Database Schema

**Table: `folders`**
```sql
CREATE TABLE folders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (LENGTH(TRIM(name)) > 0 AND LENGTH(name) <= 100),
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_folders_user_id ON folders(user_id);
CREATE INDEX idx_folders_created_at ON folders(created_at DESC);

-- RLS Policies
-- Users can only view/create/update/delete their own folders
```

**Table: `notes` (updated)**
```sql
ALTER TABLE notes 
ADD COLUMN folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL;

CREATE INDEX idx_notes_folder_id ON notes(folder_id);
```

**View: `folder_stats`**
```sql
CREATE VIEW folder_stats AS
SELECT 
  f.*,
  COUNT(n.id) AS note_count,
  MAX(n.created_at) AS last_note_at
FROM folders f
LEFT JOIN notes n ON f.id = n.folder_id
GROUP BY f.id;
```

### API Routes

**GET `/api/folders`**
```typescript
// List all folders for current user
Response: {
  folders: [{
    id: number,
    name: string,
    description: string | null,
    color: string,
    note_count: number,
    last_note_at: string | null
  }]
}
```

**POST `/api/folders`**
```typescript
// Create new folder
Body: {
  name: string,          // Required, max 100 chars
  description?: string,
  color?: string         // Hex color, default: #3B82F6
}

Response: { folder: {...} }
```

**GET `/api/folders/[id]`**
```typescript
// Get single folder with stats
Response: { folder: {...} }
```

**PATCH `/api/folders/[id]`**
```typescript
// Update folder
Body: {
  name?: string,
  description?: string,
  color?: string
}

Response: { folder: {...} }
```

**DELETE `/api/folders/[id]`**
```typescript
// Delete folder (notes will have folder_id set to NULL)
Response: { success: true }
```

**PATCH `/api/notes/[id]/folder`**
```typescript
// Move note to folder
Body: {
  folder_id: number | null  // null = remove from folder
}

Response: { note: {...} }
```

### UI Components

**`/components/FolderSidebar.tsx`**
```typescript
Features:
- Display "All Notes" + list of folders
- Folder stats (note count)
- Create folder button (opens dialog)
- Edit/Delete buttons on hover
- Color picker (6 preset colors)
- Selected folder highlight
- Click to filter notes

Props:
- userId: string
- onFolderSelect: (folderId: number | null) => void
- selectedFolderId: number | null
```

**Folder Colors**
- Blue: #3B82F6 (default)
- Green: #10B981
- Yellow: #F59E0B
- Red: #EF4444
- Purple: #8B5CF6
- Pink: #EC4899

### Layout Integration

**Desktop (lg+)**
```
┌─────────────────────────────────────┐
│  Sidebar (256px)  │  Main Content   │
│                   │                 │
│  📁 All Notes     │  Header         │
│  📁 Work          │  Input Form     │
│  📁 Personal      │  Results        │
│  📁 Ideas         │  History        │
│  [+ New]          │  Search         │
│                   │                 │
└─────────────────────────────────────┘
```

**Mobile (< lg)**
```
┌─────────────────────┐
│   Main Content      │
│   (No sidebar)      │
│   Header            │
│   Input Form        │
│   Results           │
│   History (all)     │
└─────────────────────┘
```

### History Component Updates

**Filter by Folder**
```typescript
// /components/History.tsx
Props:
- isGuest?: boolean
- selectedFolderId?: number | null

// Query logic:
if (selectedFolderId !== null) {
  query = query.eq('folder_id', selectedFolderId);
}
```

**Move to Folder Dialog**
- Button với FolderInput icon
- Select dropdown với folders
- Option "No Folder" để remove
- Visual folder colors

**Display**
- Folder badge next to note title
- Color-coded với folder color
- Format: 📁 {folder.name}

### Workflow

**Creating a Note**
1. User selects folder in sidebar (optional)
2. User creates summary
3. Note auto-saved với `folder_id = selectedFolderId`

**Moving a Note**
1. Click FolderInput icon on note
2. Dialog opens với current folder selected
3. Choose new folder hoặc "No Folder"
4. Click "Move Note"
5. History refreshes

**Filtering**
1. Click folder in sidebar
2. History shows only notes in that folder
3. Title shows "(Filtered)"
4. Click "All Notes" để clear filter

### RLS (Row Level Security)

Tất cả policies đảm bảo:
- Users chỉ thấy folders của họ
- Users chỉ move notes của họ vào folders của họ
- Cascade delete: Xóa folder → notes.folder_id = NULL

---

## 🎨 Theme Support

Both Guest Mode và Folders đều support dark/light theme:
- Guest landing page: Theme toggle ở góc trên
- Folder sidebar: Theme-aware colors
- Folder badges: Transparent với border matching folder color

---

## 📊 Usage Stats

### Guest Mode Limits
| Feature | Guest | Logged In |
|---------|-------|-----------|
| Summaries | 5 | Unlimited |
| History | 10 notes | Unlimited |
| Storage | localStorage | Supabase Cloud |
| Folders | ❌ | ✅ |
| Search | ❌ | ✅ |
| TTS | ✅ | ✅ |
| Tags | ✅ | ✅ |
| Sentiment | ✅ | ✅ |

### Folder Limits
- Max folder name: 100 characters
- No limit on number of folders
- No limit on notes per folder
- Notes can exist without folder ("All Notes")

---

## 🚀 Migration Instructions

### Step 1: Run SQL Migration
```bash
# Copy contents of supabase-migration-folders.sql
# Paste into Supabase SQL Editor
# Run migration
```

### Step 2: Verify Tables
```sql
-- Check folders table
SELECT * FROM folders LIMIT 5;

-- Check notes has folder_id
SELECT id, summary, folder_id FROM notes LIMIT 5;

-- Check folder_stats view
SELECT * FROM folder_stats;
```

### Step 3: Test RLS
```sql
-- Should only see your folders
SELECT * FROM folders;

-- Should be able to insert
INSERT INTO folders (user_id, name, color) 
VALUES (auth.uid(), 'Test Folder', '#3B82F6');
```

---

## 🧪 Testing Checklist

### Guest Mode
- [ ] Can access app without login
- [ ] Landing page shows remaining uses
- [ ] Can create summaries
- [ ] Usage count increments
- [ ] Notes saved to localStorage
- [ ] History displays guest notes
- [ ] Can delete guest notes
- [ ] Limit enforced at 5 uses
- [ ] Error shown when limit reached
- [ ] Theme toggle works
- [ ] No folders sidebar shown
- [ ] No search bar shown

### Folders
- [ ] Can create folder with name
- [ ] Can set folder color
- [ ] Can add description
- [ ] Folder appears in sidebar
- [ ] Can select folder
- [ ] Note count displays correctly
- [ ] Can edit folder name/color
- [ ] Can delete folder
- [ ] Notes moved to "No Folder" after delete
- [ ] Can move note to folder
- [ ] Can remove note from folder
- [ ] History filters by folder
- [ ] Folder badge shows on notes
- [ ] Auto-save to selected folder works

### Integration
- [ ] Switching between guest/logged in works
- [ ] Theme persists across modes
- [ ] No errors in console
- [ ] Mobile responsive
- [ ] RLS prevents unauthorized access

---

## 🎯 Future Enhancements

### Guest Mode
- Increase limit to 10 with email verification
- Export guest notes to JSON
- Import guest notes after signup
- Social sharing of summaries

### Folders
- Nested folders (sub-folders)
- Folder templates
- Bulk move notes
- Folder export/import
- Shared folders (collaboration)
- Folder search
- Drag & drop to move notes

---

## 🐛 Troubleshooting

### Guest Mode Issues

**"Guest Limit Reached" immediately**
- Check localStorage: `localStorage.getItem('smart-summarizer-guest')`
- Clear if needed: `localStorage.removeItem('smart-summarizer-guest')`

**Notes not persisting**
- Check browser privacy settings
- Ensure localStorage is enabled
- Try different browser

### Folder Issues

**Can't see folders**
- Check if logged in (not guest)
- Run RLS test queries
- Verify migration ran successfully

**Can't create folder**
- Check name length (max 100 chars)
- Check RLS policies
- Check browser console for errors

**Notes not filtering**
- Check selectedFolderId state
- Verify folder_id in database
- Check History component props

---

## 📝 Code Examples

### Check Guest Status
```typescript
import { isGuestMode, canGuestUse } from '@/lib/guestMode';

if (isGuestMode(session)) {
  if (!canGuestUse()) {
    setError("Guest limit reached!");
  }
}
```

### Add Guest Note
```typescript
import { addGuestNote, incrementGuestUsage } from '@/lib/guestMode';

// After getting AI response
incrementGuestUsage();
addGuestNote({
  original_notes: notes,
  persona: customPersona,
  summary: data.summary,
  takeaways: data.takeaways,
  actions: data.actions,
  tags: data.tags,
  sentiment: data.sentiment
});
```

### Create Folder
```typescript
const createFolder = async (name: string, color: string) => {
  const response = await fetch('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color })
  });
  const { folder } = await response.json();
  return folder;
};
```

### Move Note to Folder
```typescript
const moveNote = async (noteId: number, folderId: number | null) => {
  await fetch(`/api/notes/${noteId}/folder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_id: folderId })
  });
};
```

---

## ✅ Kết luận

Guest Mode và Folders đã được implement hoàn chỉnh với:
- ✅ Guest mode với localStorage persistence
- ✅ Usage limits và warnings
- ✅ Folders CRUD với RLS
- ✅ Move notes to folders
- ✅ Filter history by folder
- ✅ Beautiful UI với color-coding
- ✅ Mobile responsive
- ✅ Dark mode support
- ✅ Type-safe với TypeScript

**Next Steps:**
1. Run migration: `supabase-migration-folders.sql`
2. Test guest flow: Tạo 5 summaries
3. Test folders: Tạo folder, move notes
4. Deploy to production!
