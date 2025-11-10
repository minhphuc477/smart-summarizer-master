-- =====================================================
-- COMPLETE PDF SETUP + SEARCH DEBUG
-- =====================================================

-- PART 1: CREATE PDF TABLES
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PDF Documents table (renamed from pdf_documents to pdfs for consistency)
CREATE TABLE IF NOT EXISTS pdfs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- File information
  filename TEXT NOT NULL,
  file_size BIGINT,
  storage_path TEXT NOT NULL,
  mime_type TEXT DEFAULT 'application/pdf',
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  
  -- Extracted content
  extracted_text TEXT,
  page_count INT,
  
  -- Associated note (if summarized)
  note_id BIGINT REFERENCES notes(id) ON DELETE SET NULL,
  
  -- Workspace/folder organization
  workspace_id BIGINT REFERENCES workspaces(id) ON DELETE CASCADE,
  folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes for PDFs
CREATE INDEX IF NOT EXISTS idx_pdfs_user ON pdfs(user_id);
CREATE INDEX IF NOT EXISTS idx_pdfs_status ON pdfs(status);
CREATE INDEX IF NOT EXISTS idx_pdfs_created ON pdfs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdfs_workspace ON pdfs(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pdfs_folder ON pdfs(folder_id) WHERE folder_id IS NOT NULL;

-- PDF processing jobs table
CREATE TABLE IF NOT EXISTS pdf_jobs (
  id BIGSERIAL PRIMARY KEY,
  pdf_id BIGINT NOT NULL REFERENCES pdfs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INT DEFAULT 0,
  error_message TEXT,
  
  -- Processing options
  options JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  UNIQUE(pdf_id)
);

CREATE INDEX IF NOT EXISTS idx_pdf_jobs_status ON pdf_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_pdf_jobs_user ON pdf_jobs(user_id);

-- =====================================================
-- RLS POLICIES FOR PDFS
-- =====================================================

ALTER TABLE pdfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_jobs ENABLE ROW LEVEL SECURITY;

-- PDFs policies
DROP POLICY IF EXISTS "Users can view their own PDFs" ON pdfs;
CREATE POLICY "Users can view their own PDFs"
  ON pdfs FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can upload PDFs" ON pdfs;
CREATE POLICY "Users can upload PDFs"
  ON pdfs FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own PDFs" ON pdfs;
CREATE POLICY "Users can update their own PDFs"
  ON pdfs FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own PDFs" ON pdfs;
CREATE POLICY "Users can delete their own PDFs"
  ON pdfs FOR DELETE
  USING (user_id = auth.uid());

-- PDF jobs policies
DROP POLICY IF EXISTS "Users can view their own PDF jobs" ON pdf_jobs;
CREATE POLICY "Users can view their own PDF jobs"
  ON pdf_jobs FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "System can manage PDF jobs" ON pdf_jobs;
CREATE POLICY "System can manage PDF jobs"
  ON pdf_jobs FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- PART 2: CHECK WHY SEARCH RETURNS NO RESULTS
-- =====================================================

-- Check what similarity scores your notes actually have
SELECT 
  '🔍 SEARCH DEBUG: Actual Similarity Scores' as section,
  id,
  user_id,
  LEFT(summary, 60) as summary_preview,
  CASE 
    WHEN embedding IS NOT NULL THEN 'Yes'
    ELSE 'No'
  END as has_embedding
FROM notes
WHERE user_id = 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid
ORDER BY created_at DESC
LIMIT 10;

-- Test with LOW threshold to see if results appear
WITH sample AS (
  SELECT embedding::vector as emb
  FROM notes 
  WHERE embedding IS NOT NULL 
  LIMIT 1
)
SELECT 
  '🔍 Test with 0.3 threshold (LOW)' as section,
  id,
  LEFT(summary, 60) as summary_preview,
  ROUND(similarity::numeric, 3) as score
FROM sample, match_notes(sample.emb, 0.3, 10, 'af5616ae-d19b-47fb-93c2-790f9cc40fd0'::uuid)
ORDER BY similarity DESC;

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT '✅ PDF Tables Created' as status
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pdfs')
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pdf_jobs');

SELECT '✅ PDF RLS Policies Active' as status
WHERE EXISTS (
  SELECT 1 FROM pg_policies 
  WHERE tablename = 'pdfs' 
    AND policyname = 'Users can view their own PDFs'
);
