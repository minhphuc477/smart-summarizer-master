-- =====================================================
-- PDF DOCUMENT PROCESSING SUPPORT
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create storage bucket for PDF files (run via Supabase dashboard or API)
-- This is a reference - actual bucket creation done via Supabase Storage API
-- Bucket name: pdf-documents
-- Public: false (authenticated access only)

-- PDF Documents table
CREATE TABLE IF NOT EXISTS pdf_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- File information
  original_filename TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL, -- Path in Supabase Storage
  content_type TEXT DEFAULT 'application/pdf',
  
  -- Processing status
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'processing', 'completed', 'failed')),
  processing_error TEXT,
  
  -- Document metadata
  title TEXT,
  author TEXT,
  page_count INT,
  
  -- Extracted content
  full_text TEXT, -- All extracted text
  pages JSONB, -- Array of {page_number, text, word_count}
  
  -- Processing metadata
  extraction_method TEXT, -- 'pdf-parse', 'ocr', etc.
  processing_duration_ms INT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  
  -- Workspace/folder organization
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL
);

-- Indexes for PDF documents
CREATE INDEX IF NOT EXISTS idx_pdf_documents_user ON pdf_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_documents_status ON pdf_documents(status);
CREATE INDEX IF NOT EXISTS idx_pdf_documents_created ON pdf_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdf_documents_workspace ON pdf_documents(workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pdf_documents_folder ON pdf_documents(folder_id) WHERE folder_id IS NOT NULL;

-- Full-text search index on PDF content
CREATE INDEX IF NOT EXISTS idx_pdf_documents_fulltext ON pdf_documents USING gin(to_tsvector('english', full_text)) WHERE full_text IS NOT NULL;

-- Add PDF document reference to notes table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='notes' AND column_name='pdf_document_id') THEN
    ALTER TABLE notes ADD COLUMN pdf_document_id UUID REFERENCES pdf_documents(id) ON DELETE SET NULL;
    CREATE INDEX idx_notes_pdf_document ON notes(pdf_document_id) WHERE pdf_document_id IS NOT NULL;
  END IF;
END $$;

-- PDF page references in notes (for linking specific pages)
CREATE TABLE IF NOT EXISTS pdf_page_references (
  id BIGSERIAL PRIMARY KEY,
  note_id BIGINT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  pdf_document_id UUID NOT NULL REFERENCES pdf_documents(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  
  -- Context from the page
  snippet TEXT, -- The relevant text snippet
  quote TEXT, -- Optional direct quote
  
  -- Position in note (for ordering)
  position_in_note INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(note_id, pdf_document_id, page_number, position_in_note)
);

CREATE INDEX IF NOT EXISTS idx_pdf_page_refs_note ON pdf_page_references(note_id);
CREATE INDEX IF NOT EXISTS idx_pdf_page_refs_pdf ON pdf_page_references(pdf_document_id);

-- PDF processing queue (for async processing)
CREATE TABLE IF NOT EXISTS pdf_processing_queue (
  id BIGSERIAL PRIMARY KEY,
  pdf_document_id UUID NOT NULL REFERENCES pdf_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Processing options (stored as JSONB for flexibility)
  processing_options JSONB DEFAULT '{
    "extract_text": true,
    "extract_images": false,
    "perform_ocr": false,
    "generate_summary": true
  }'::jsonb,
  
  -- Queue status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  UNIQUE(pdf_document_id)
);

CREATE INDEX IF NOT EXISTS idx_pdf_queue_status ON pdf_processing_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_pdf_queue_user ON pdf_processing_queue(user_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE pdf_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_page_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_processing_queue ENABLE ROW LEVEL SECURITY;

-- PDF Documents policies
CREATE POLICY "Users can view their own PDF documents"
  ON pdf_documents FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can upload PDF documents"
  ON pdf_documents FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own PDF documents"
  ON pdf_documents FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own PDF documents"
  ON pdf_documents FOR DELETE
  USING (user_id = auth.uid());

-- PDF page references policies
CREATE POLICY "Users can view page references for their notes"
  ON pdf_page_references FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = pdf_page_references.note_id
      AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create page references for their notes"
  ON pdf_page_references FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = pdf_page_references.note_id
      AND notes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete page references for their notes"
  ON pdf_page_references FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = pdf_page_references.note_id
      AND notes.user_id = auth.uid()
    )
  );

-- Processing queue policies
CREATE POLICY "Users can view their own processing queue"
  ON pdf_processing_queue FOR SELECT
  USING (user_id = auth.uid());

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to update PDF document status
CREATE OR REPLACE FUNCTION update_pdf_status(
  p_pdf_id UUID,
  p_status TEXT,
  p_error TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE pdf_documents
  SET 
    status = p_status,
    processing_error = p_error,
    processed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_pdf_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get PDF statistics for a user
CREATE OR REPLACE FUNCTION get_pdf_stats(p_user_id UUID)
RETURNS TABLE(
  total_pdfs BIGINT,
  total_pages BIGINT,
  total_size_mb NUMERIC,
  processing_count BIGINT,
  failed_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_pdfs,
    COALESCE(SUM(page_count), 0)::BIGINT as total_pages,
    ROUND((COALESCE(SUM(file_size_bytes), 0) / 1024.0 / 1024.0)::NUMERIC, 2) as total_size_mb,
    COUNT(*) FILTER (WHERE status = 'processing')::BIGINT as processing_count,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT as failed_count
  FROM pdf_documents
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search PDFs by content
CREATE OR REPLACE FUNCTION search_pdfs(
  p_user_id UUID,
  p_query TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  original_filename TEXT,
  page_count INT,
  rank REAL,
  headline TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pd.id,
    pd.title,
    pd.original_filename,
    pd.page_count,
    ts_rank(to_tsvector('english', pd.full_text), plainto_tsquery('english', p_query)) as rank,
    ts_headline('english', pd.full_text, plainto_tsquery('english', p_query), 
                'MaxWords=50, MinWords=25, MaxFragments=1') as headline
  FROM pdf_documents pd
  WHERE pd.user_id = p_user_id
    AND pd.full_text IS NOT NULL
    AND to_tsvector('english', pd.full_text) @@ plainto_tsquery('english', p_query)
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_pdf_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pdf_timestamp ON pdf_documents;
CREATE TRIGGER trigger_update_pdf_timestamp
  BEFORE UPDATE ON pdf_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_pdf_updated_at();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE pdf_documents IS 'Stores uploaded PDF documents with extracted content';
COMMENT ON TABLE pdf_page_references IS 'Links specific PDF pages to note summaries';
COMMENT ON TABLE pdf_processing_queue IS 'Queue for asynchronous PDF processing tasks';

COMMENT ON COLUMN pdf_documents.pages IS 'JSON array of page data: [{page_number, text, word_count}]';
COMMENT ON COLUMN pdf_documents.status IS 'Processing status: uploading, processing, completed, failed';
COMMENT ON COLUMN pdf_documents.storage_path IS 'Path to PDF file in Supabase Storage bucket';
