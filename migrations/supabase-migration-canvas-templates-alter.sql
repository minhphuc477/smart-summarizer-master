-- =====================================================
-- ALTER EXISTING CANVAS TEMPLATES TABLE
-- Run this to fix the creator_id constraint
-- =====================================================

-- Remove NOT NULL constraint from creator_id to support system templates
ALTER TABLE canvas_templates 
  ALTER COLUMN creator_id DROP NOT NULL;

-- Verify the change
SELECT 
  column_name, 
  is_nullable, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'canvas_templates' 
  AND column_name = 'creator_id';
