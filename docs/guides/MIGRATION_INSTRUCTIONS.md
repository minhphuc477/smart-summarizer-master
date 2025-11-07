# 🚀 Migration Instructions - Folders Feature

## Chạy Migration SQL vào Supabase

### Bước 1: Truy cập Supabase Dashboard
1. Mở https://supabase.com/dashboard
2. Chọn project `smart-summarizer`
3. Click vào tab **SQL Editor** ở sidebar trái

### Bước 2: Run Migration
1. Click **New Query**
2. Copy toàn bộ nội dung file `/supabase-migration-folders.sql`
3. Paste vào SQL Editor
4. Click **Run** (hoặc Ctrl+Enter)

### Bước 3: Verify Migration
Chạy các query sau để verify:

```sql
-- 1. Check folders table
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'folders';

-- 2. Check notes has folder_id column
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'notes' AND column_name = 'folder_id';

-- 3. Check folder_stats view
SELECT * FROM folder_stats LIMIT 5;

-- 4. Test RLS - should return empty (no folders yet)
SELECT * FROM folders;
```

### Bước 4: Test Insert (Optional)
Tạo một folder test:

```sql
INSERT INTO folders (user_id, name, description, color)
VALUES (
  auth.uid(), 
  'My First Folder', 
  'Test folder for organizing notes',
  '#3B82F6'
);

-- Verify
SELECT * FROM folders;
```

### Bước 5: Test Update
```sql
UPDATE folders 
SET color = '#10B981'
WHERE name = 'My First Folder';
```

### Bước 6: Test Delete
```sql
DELETE FROM folders WHERE name = 'My First Folder';
```

---

## Troubleshooting

### Error: "permission denied for table folders"
**Solution**: RLS policies chưa được tạo. Re-run migration script.

### Error: "column folder_id does not exist"
**Solution**: Migration chưa chạy thành công. Check migration script line by line.

### Error: "function auth.uid() does not exist"
**Solution**: Đảm bảo đang logged in vào Supabase Dashboard khi test.

### Folders không hiển thị trong app
1. Check browser console for errors
2. Verify API route `/api/folders` hoạt động
3. Test trực tiếp: `curl http://localhost:3000/api/folders`
4. Check RLS policies trong Supabase

---

## Rollback (Nếu cần)

Nếu muốn rollback migration:

```sql
-- Drop view
DROP VIEW IF EXISTS folder_stats;

-- Remove RLS policies
DROP POLICY IF EXISTS "Users can view their own folders" ON folders;
DROP POLICY IF EXISTS "Users can create their own folders" ON folders;
DROP POLICY IF EXISTS "Users can update their own folders" ON folders;
DROP POLICY IF EXISTS "Users can delete their own folders" ON folders;

-- Drop indexes
DROP INDEX IF EXISTS idx_folders_user_id;
DROP INDEX IF EXISTS idx_folders_created_at;
DROP INDEX IF EXISTS idx_notes_folder_id;

-- Remove column from notes
ALTER TABLE notes DROP COLUMN IF EXISTS folder_id;

-- Drop table
DROP TABLE IF EXISTS folders;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();
```

---

## Next Steps

After successful migration:

1. ✅ Restart Next.js dev server: `npm run dev`
2. ✅ Test folder creation in app
3. ✅ Test moving notes to folders
4. ✅ Test filtering history by folder
5. ✅ Test guest mode (no folders visible)

Xong! 🎉
