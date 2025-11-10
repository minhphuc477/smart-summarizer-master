-- =====================================================
-- CHECK VECTOR EXTENSION AND EMBEDDING SETUP
-- =====================================================

-- 1. Check if vector extension is installed
SELECT 
  'Vector Extension' as check_name,
  extname,
  extversion
FROM pg_extension
WHERE extname = 'vector';

-- If not installed, install it:
-- CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Check if embedding column exists on notes table
SELECT 
  'Notes Embedding Column' as check_name,
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'notes'
  AND column_name = 'embedding';

-- 3. Check sample embeddings
SELECT 
  'Sample Embeddings' as check_name,
  id,
  LEFT(summary, 30) as summary_preview,
  CASE 
    WHEN embedding IS NULL THEN 'NULL'
    ELSE 'Vector(' || array_length(embedding::float[], 1)::text || ')'
  END as embedding_info
FROM notes
ORDER BY created_at DESC
LIMIT 5;

-- 4. Check if notes table has the embedding column with correct type
SELECT 
  'Embedding Column Details' as check_name,
  attname as column_name,
  atttypid::regtype as data_type,
  attndims as dimensions
FROM pg_attribute
WHERE attrelid = 'notes'::regclass
  AND attname = 'embedding';
