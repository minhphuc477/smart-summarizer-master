-- Test script to check for missing tables and columns

-- Check for required tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('notes', 'note_links', 'smart_folders', 'smart_folder_assignments', 'workspaces');

-- Check for required columns in each table
SELECT column_name, table_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name = 'notes' AND column_name IN ('id', 'workspace_id', 'summary', 'original_notes'))
  OR (table_name = 'note_links' AND column_name IN ('id', 'source_note_id', 'target_note_id', 'user_id'))
  OR (table_name = 'smart_folders' AND column_name IN ('id', 'workspace_id', 'name', 'rules'))
  OR (table_name = 'smart_folder_assignments' AND column_name IN ('id', 'smart_folder_id', 'note_id', 'user_id'))
  OR (table_name = 'workspaces' AND column_name IN ('id', 'name'));
