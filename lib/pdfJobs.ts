// pdfJobs.ts
// Abstraction layer for scheduling and processing long-running PDF tasks.
// In production you would move the heavy parse logic to a Supabase Edge Function
// or a separate worker service. These helpers encapsulate job lifecycle so the
// API routes can remain fast (return 202 Accepted quickly).

import { createClient } from '@supabase/supabase-js';
import type { PostgrestSingleResponse } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export type PdfJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface PdfJobRecord {
  pdf_document_id: string;
  status: PdfJobStatus;
  attempts: number;
  max_attempts: number;
  error_message?: string | null;
  wants_summary: boolean;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export async function enqueuePdfJob(pdfId: string, userId: string, wantsSummary = true) {
  // Insert into queue if not exists (unique constraint on pdf_document_id)
  const { error } = await supabaseAdmin.from('pdf_processing_queue').upsert({
    pdf_document_id: pdfId,
    user_id: userId,
    status: 'pending',
    attempts: 0,
    wants_summary: wantsSummary,
  });
  if (error) throw error;
  return { pdf_document_id: pdfId };
}

export async function getPdfJob(pdfId: string) {
  const { data, error }: PostgrestSingleResponse<PdfJobRecord> = await supabaseAdmin
    .from('pdf_processing_queue')
    .select('*')
    .eq('pdf_document_id', pdfId)
    .single();
  if (error) return null;
  return data;
}

// Placeholder heavy work executor.
// In a real worker environment you'd: download file from storage, parse, summarize and update tables.
export async function processPdfJob(pdfId: string) {
  // Mark processing
  const start = Date.now();
  await supabaseAdmin
    .from('pdf_processing_queue')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('pdf_document_id', pdfId);

  try {
    // Fetch document metadata
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('pdf_documents')
      .select('id, storage_path, original_filename, user_id')
      .eq('id', pdfId)
      .single();
    if (docErr || !doc) throw docErr || new Error('PDF not found');

    // Simulate long processing (replace with actual parse)
    await new Promise(r => setTimeout(r, 1000));

    // Update as completed (no extraction here, worker would add full_text/pages)
    await supabaseAdmin
      .from('pdf_documents')
      .update({ status: 'completed', processing_duration_ms: Date.now() - start })
      .eq('id', pdfId);

    await supabaseAdmin
      .from('pdf_processing_queue')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('pdf_document_id', pdfId);
    } catch (err: unknown) {
      const error = err as Error;
    await supabaseAdmin
      .from('pdf_documents')
        .update({ status: 'failed', processing_error: error?.message })
      .eq('id', pdfId);

    // Increment attempts
    const job = await getPdfJob(pdfId);
    const attempts = (job?.attempts || 0) + 1;
    await supabaseAdmin
      .from('pdf_processing_queue')
      .update({
        status: attempts >= (job?.max_attempts || 3) ? 'failed' : 'pending',
        attempts,
        error_message: error?.message || 'Unknown error',
      })
      .eq('pdf_document_id', pdfId);
  }
}
