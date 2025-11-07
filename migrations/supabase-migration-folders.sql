-- Migration: Thêm chức năng Folders/Notebooks
-- Cho phép người dùng tổ chức notes vào các thư mục

-- 1. Tạo bảng folders
CREATE TABLE IF NOT EXISTS folders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6', -- Màu sắc để dễ phân biệt
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT folder_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
  CONSTRAINT folder_name_max_length CHECK (LENGTH(name) <= 100)
);

-- 2. Thêm index cho performance
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_created_at ON folders(created_at DESC);

-- 3. Thêm cột folder_id vào bảng notes
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL;

-- 4. Thêm index cho folder_id
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);

-- 5. Tạo function để tự động update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Tạo trigger cho folders
DROP TRIGGER IF EXISTS update_folders_updated_at ON folders;
CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. Enable Row Level Security (RLS)
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies cho folders
-- Cho phép user xem folders của chính họ
CREATE POLICY "Users can view their own folders"
  ON folders FOR SELECT
  USING (auth.uid() = user_id);

-- Cho phép user tạo folders cho chính họ
CREATE POLICY "Users can create their own folders"
  ON folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Cho phép user update folders của chính họ
CREATE POLICY "Users can update their own folders"
  ON folders FOR UPDATE
  USING (auth.uid() = user_id);

-- Cho phép user xóa folders của chính họ
CREATE POLICY "Users can delete their own folders"
  ON folders FOR DELETE
  USING (auth.uid() = user_id);

-- 9. Tạo view để count số notes trong mỗi folder
CREATE OR REPLACE VIEW folder_stats AS
SELECT 
  f.id,
  f.user_id,
  f.name,
  f.description,
  f.color,
  f.created_at,
  f.updated_at,
  COUNT(n.id) AS note_count,
  MAX(n.created_at) AS last_note_at
FROM folders f
LEFT JOIN notes n ON f.id = n.folder_id
GROUP BY f.id, f.user_id, f.name, f.description, f.color, f.created_at, f.updated_at;

-- 10. Grant permissions cho authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON folders TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE folders_id_seq TO authenticated;
GRANT SELECT ON folder_stats TO authenticated;

-- 11. Tạo một số folders mặc định cho demo (optional)
-- Uncomment nếu muốn tạo folders mẫu:
-- INSERT INTO folders (user_id, name, description, color) VALUES
-- (auth.uid(), 'Work', 'Work-related notes', '#3B82F6'),
-- (auth.uid(), 'Personal', 'Personal notes', '#10B981'),
-- (auth.uid(), 'Ideas', 'Random ideas and thoughts', '#F59E0B');

COMMENT ON TABLE folders IS 'Folders/notebooks để tổ chức notes';
COMMENT ON COLUMN folders.color IS 'Hex color code cho folder';
COMMENT ON VIEW folder_stats IS 'Statistics về mỗi folder (số notes, last update)';
