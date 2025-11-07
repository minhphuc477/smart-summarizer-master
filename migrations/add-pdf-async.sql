-- Async PDF processing augmentation
-- Adds async-friendly fields and summary storage
ALTER TABLE pdf_documents
  ADD COLUMN IF NOT EXISTS processing_status TEXT GENERATED ALWAYS AS (status) STORED, -- alias for clarity
  ADD COLUMN IF NOT EXISTS summary_text TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Ensure queue table has summary flag
ALTER TABLE pdf_processing_queue
  ADD COLUMN IF NOT EXISTS wants_summary BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_pdf_documents_processing ON pdf_documents(status, created_at DESC);
