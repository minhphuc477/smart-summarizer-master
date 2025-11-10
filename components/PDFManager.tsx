"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Trash2,
  Eye,
  AlertCircle,
  Clock,
  Zap,
  ListChecks,
  Target,
  Hash,
  Smile,
  Meh,
  Frown,
  Calendar,
  X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { createResumableUpload, ResumableUpload } from '@/lib/resumableUpload';
import type { Session } from '@supabase/supabase-js';

interface PDFDocument {
  id: string;
  original_filename?: string; // new schema field
  filename?: string; // kept for backward compatibility in UI mapping
  file_size_bytes?: number;
  file_size?: number; // legacy mapping convenience
  status: 'uploading' | 'pending' | 'processing' | 'completed' | 'failed';
  full_text?: string;
  summary?: string;
  summary_text?: string; // async summary storage
  summaryData?: PDFSummary; // full structured summary data
  page_count?: number;
  created_at: string;
  error_message?: string;
  processing_error?: string;
}

interface PDFSummary {
  summary: string;
  takeaways: string[];
  actions: Array<{ task: string; datetime?: string }>;
  sentiment: string;
  tags: string[];
  page_references: number;
  note_id?: number;
}

interface PDFManagerProps {
  session: Session | null;
  selectedFolderId?: number | null;
  selectedWorkspaceId?: string | null;
}

export default function PDFManager({ session, selectedFolderId, selectedWorkspaceId }: PDFManagerProps) {
  const router = useRouter();
  const [pdfs, setPdfs] = useState<PDFDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadEta, setUploadEta] = useState<string | null>(null);
  const uploadXhrRef = useRef<XMLHttpRequest | null>(null);
  const resumableRef = useRef<ResumableUpload | null>(null);
  const [resumable, setResumable] = useState(false);
  const [paused, setPaused] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPdf, setSelectedPdf] = useState<PDFDocument | null>(null);
  const [summarizing, setSummarizing] = useState<string | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const [nowTs, setNowTs] = useState<number>(Date.now());

  // Helper to compute a human-friendly elapsed time string (used for pending/processing durations)
  const formatElapsed = (sinceIso: string) => {
    const since = new Date(sinceIso).getTime();
    const secs = Math.max(0, Math.floor((nowTs - since) / 1000));
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m > 0 ? m + 'm ' : ''}${s}s`;
  };

  const fetchPDFs = useCallback(async () => {
    if (!session) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pdf_documents')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPdfs(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load PDFs');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchPDFs();
  }, [fetchPDFs]);

  // Global polling: refresh status for any pending/processing PDFs every 10s
  useEffect(() => {
    // Clear previous interval (if any)
    if (pollIntervalRef.current) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    // Only start if user has any non-terminal PDFs
    const hasActive = pdfs.some(p => p.status === 'pending' || p.status === 'processing' || p.status === 'uploading');
    if (!hasActive) return;

    const id = window.setInterval(async () => {
      const active = pdfs.filter(p => p.status === 'pending' || p.status === 'processing');
      for (const p of active) {
        await refreshPdfStatus(p.id);
      }
    }, 10000);
    pollIntervalRef.current = id;
    return () => {
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [pdfs]);

  // Heartbeat to update elapsed time labels once per second when active
  useEffect(() => {
    const hasActive = pdfs.some(p => p.status === 'pending' || p.status === 'processing');
    if (!hasActive) return;
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [pdfs]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setError('File size must be less than 100MB');
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile || !session) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadEta(null);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (selectedWorkspaceId) formData.append('workspace_id', selectedWorkspaceId);
      if (selectedFolderId) formData.append('folder_id', selectedFolderId.toString());

      // If large file (> 8MB) try resumable tus upload directly to storage
      if (selectedFile.size > 8 * 1024 * 1024) {
        try {
          setResumable(true);
          // Ask the server to create the resumable upload resource and return the upload URL.
          let initialUploadUrl: string | undefined = undefined;
          try {
            // Prefer service-role creation if available (server will only allow when SUPABASE_SERVICE_ROLE_KEY is configured)
            let createResp = await fetch('/api/pdf/create-resumable-service', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filename: selectedFile.name, size: selectedFile.size, bucket: 'pdf-documents' })
            });
            if (!createResp.ok) {
              // Fallback to non-service creation path
              createResp = await fetch('/api/pdf/create-resumable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: selectedFile.name, size: selectedFile.size, bucket: 'pdf-documents' })
              });
            }
            if (createResp.ok) {
              const body = await createResp.json().catch(() => ({}));
              initialUploadUrl = body?.uploadUrl;
            } else {
              const text = await createResp.text().catch(() => '');
              console.warn('Server create-resumable failed:', createResp.status, text);
            }
          } catch (e) {
            console.warn('Failed to call server create-resumable:', e);
          }

          const ru = createResumableUpload({
            file: selectedFile,
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
            supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            // Prefer using the user's access token when available so RLS/storage policies see the authenticated user
            supabaseAccessToken: session?.access_token,
            // If the server returned an upload URL, use it so the browser only PATCHes the created resource
            initialUploadUrl,
            bucket: 'pdf-documents',
            userId: session.user.id,
            onProgress: (uploaded, total) => {
              const pct = Math.round((uploaded / total) * 100);
              setUploadProgress(pct);
            },
            onEta: (secs) => {
              if (!isFinite(secs)) return;
              const m = Math.floor(secs / 60);
              const s = Math.round(secs % 60);
              setUploadEta(`${m > 0 ? m + 'm ' : ''}${s}s remaining`);
            },
            onComplete: async () => {
              setUploadProgress(100);
              setUploadEta('Finalizing...');
              // After tus completes, still create DB record via existing API (lightweight zero-byte insert path)
              const response = await fetch('/api/pdf/upload', { method: 'POST', body: formData });
              const data = await response.json().catch(() => ({}));
              if (!response.ok) throw new Error(data.error || 'Upload record creation failed');
              const uploadedId = data?.pdf?.id;
              if (uploadedId) await requestProcessing(uploadedId);
              await fetchPDFs();
              setSuccess('PDF uploaded via resumable upload. Queued for processing...');
              setSelectedFile(null);
              setResumable(false);
            },
            onError: (err) => {
              console.error('Resumable upload error:', err);
              // Check for common Supabase Storage errors
              const errorMsg = err.message || '';
              let fallbackMsg = `Resumable upload failed: ${err.message}`;
              
              if (errorMsg.includes('404') || errorMsg.includes('bucket')) {
                fallbackMsg = 'Storage bucket not configured. Using standard upload instead.';
              } else if (errorMsg.includes('401') || errorMsg.includes('403')) {
                fallbackMsg = 'Storage permissions issue. Using standard upload instead.';
              }
              
              setError(fallbackMsg);
              setResumable(false);
              // Fall through to standard upload below - will be handled by continuing the function
            }
          });
          resumableRef.current = ru;
          await ru.startOrResume();
          return; // exit if resumable succeeds
        } catch (resumableError) {
          console.error('Failed to start resumable upload:', resumableError);
          const errMsg = resumableError instanceof Error ? resumableError.message : 'Unknown error';
          setError(`Resumable upload unavailable (${errMsg}). Using standard upload...`);
          setResumable(false);
          // Fall through to standard upload
        }
      }

      const startTime = Date.now();
      const xhr = new XMLHttpRequest();
      uploadXhrRef.current = xhr;

      type UploadResponse = { status: number; ok: boolean; body: { error?: string; pdf?: { id: string } } };
      const progressPromise: Promise<UploadResponse> = new Promise((resolve, reject) => {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent);
            // ETA calc
            const elapsed = (Date.now() - startTime) / 1000; // seconds
            const speed = event.loaded / elapsed; // bytes/sec
            const remainingBytes = event.total - event.loaded;
            const remainingSec = remainingBytes / (speed || 1);
            if (percent < 100) {
              const mins = Math.floor(remainingSec / 60);
              const secs = Math.round(remainingSec % 60);
              setUploadEta(`${mins > 0 ? mins + 'm ' : ''}${secs}s remaining`);
            } else {
              setUploadEta('Processing...');
            }
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.onabort = () => reject(new Error('Upload aborted'));
        xhr.onload = async () => {
          try {
            const bodyText = xhr.responseText || '{}';
            const json = JSON.parse(bodyText) as { error?: string; pdf?: { id: string } };
            resolve({ status: xhr.status, ok: xhr.status >= 200 && xhr.status < 300, body: json });
          } catch (e) {
            reject(e);
          }
        };
        xhr.open('POST', '/api/pdf/upload');
        xhr.send(formData);
      });

  const response = await progressPromise;
  const respData = response.body;
  if (!response.ok) throw new Error(respData?.error || 'Upload failed');

      setUploadProgress(100);
      setUploadEta('Finalizing...');
      setSuccess('PDF uploaded. Queued for processing...');
      setSelectedFile(null);
      const uploadedId = respData?.pdf?.id;
      if (uploadedId) await requestProcessing(uploadedId);
      await fetchPDFs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadEta(null);
      uploadXhrRef.current = null;
      // leave progress bar at 100 briefly then reset
      setTimeout(() => setUploadProgress(0), 800);
    }
  };

  const cancelUpload = () => {
    if (uploadXhrRef.current && uploading) {
      uploadXhrRef.current.abort();
      setUploading(false);
      setUploadEta(null);
      setUploadProgress(0);
      setError('Upload canceled');
    }
    if (resumableRef.current && resumable) {
      resumableRef.current.abort();
      setUploading(false);
      setPaused(false);
      setResumable(false);
      setUploadEta(null);
      setUploadProgress(0);
      setError('Upload canceled');
    }
  };

  const togglePause = () => {
    if (!resumableRef.current) return;
    if (paused) {
      setPaused(false);
      resumableRef.current.resume();
    } else {
      resumableRef.current.pause();
      setPaused(true);
    }
  };
  
  // Request asynchronous processing (enqueue + immediate 202)
  const requestProcessing = async (pdfId: string) => {
    try {
      const response = await fetch('/api/pdf/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_id: pdfId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to enqueue processing');
      }
      const responseData = await response.json();
      // Immediately update local state to reflect pending status
      if (responseData.status) {
        setPdfs(prev => prev.map(p => p.id === pdfId ? { ...p, status: responseData.status } : p));
      }
      // Begin polling status until processing or completed
      pollStatus(pdfId);
    } catch (err) {
      console.error('Processing request error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start processing');
    }
  };

  const pollStatus = (pdfId: string, attempt = 0) => {
    const maxAttempts = 60; // ~5 minutes at 5s interval
    setTimeout(async () => {
      try {
        const res = await fetch(`/api/pdf/status/${pdfId}`);
        if (!res.ok) return; // silent
        const data = await res.json();
        const updated: PDFDocument | undefined = data.pdf;
        if (updated) {
          setPdfs(prev => prev.map(p => p.id === pdfId ? { ...p, ...updated } : p));
          if (updated.status === 'completed' || updated.status === 'failed') {
            return; // stop polling
          }
        }
        if (attempt < maxAttempts) pollStatus(pdfId, attempt + 1);
      } catch {
        if (attempt < maxAttempts) pollStatus(pdfId, attempt + 1);
      }
    }, 5000);
  };

  // Manual single-status refresh
  const refreshPdfStatus = async (pdfId: string) => {
    try {
      const res = await fetch(`/api/pdf/status/${pdfId}`);
      if (!res.ok) return;
      const data = await res.json();
      const updated: PDFDocument | undefined = data.pdf;
      if (updated) {
        setPdfs(prev => prev.map(p => p.id === pdfId ? { ...p, ...updated } : p));
      }
    } catch {
      // noop
    }
  };

  // Manual processing trigger (doesn't require background worker)
  const handleProcessNow = async (pdfId: string) => {
    setError(null);
    setSuccess(null);
    
    // Optimistically update status
    setPdfs(prev => prev.map(p => p.id === pdfId ? { ...p, status: 'processing' } : p));

    try {
      const response = await fetch('/api/pdf/process-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_id: pdfId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Processing failed');
      }

      setSuccess(data.message || 'PDF processed successfully!');
      
      // Update PDF with latest data
      if (data.pdf) {
        setPdfs(prev => prev.map(p => p.id === pdfId ? { ...p, ...data.pdf } : p));
      }
      
      // Refresh to get latest status
      await fetchPDFs();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Processing failed';
      setError(errorMsg);
      // Revert status on error
      await refreshPdfStatus(pdfId);
    }
  };
  

  // Removed synchronous extraction path in favor of async queue + background worker

  const handleSummarize = async (pdf: PDFDocument) => {
    if (!pdf.full_text) {
      setError('PDF text not extracted yet (still processing)');
      return;
    }

    setSummarizing(pdf.id);
    setError(null);

    try {
      const response = await fetch(`/api/pdf/summarize?id=${pdf.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          workspace_id: selectedWorkspaceId,
          folder_id: selectedFolderId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Summarization failed');
      }

      const data = await response.json();

      // The server returns `note_id` (and not a full `note` object) for PDF summarization.
      // Read both `note_id` and legacy `note?.id` to be robust.
      const returnedNoteId = data.note_id ?? data.note?.id;

      // Store the complete summary data
      const summaryData: PDFSummary = {
        summary: data.summary || data.note?.summary || '',
        takeaways: data.takeaways || data.note?.takeaways || [],
        actions: data.actions || data.note?.actions || [],
        sentiment: data.sentiment || data.note?.sentiment || 'neutral',
        tags: data.tags || data.note?.tags || [],
        page_references: data.page_references || 0,
        note_id: typeof returnedNoteId === 'number' ? returnedNoteId : (returnedNoteId ? Number(returnedNoteId) : undefined),
      };
      
      setSuccess('PDF summarized successfully!');
      
      // Update the PDF in the list with full summary data
      setPdfs(prev => prev.map(p => p.id === pdf.id ? { 
        ...p, 
        summary_text: summaryData.summary,
        summary: summaryData.summary,
        summaryData: summaryData // Store complete data
      } : p));
      
      // Set selected PDF with full summary data
      setSelectedPdf({ 
        ...pdf, 
        summary_text: summaryData.summary,
        summary: summaryData.summary,
        summaryData: summaryData 
      });

      // If the server returned a created note id, navigate to the note view so
      // subsequent actions (links, tags, etc.) use the correct note id.
      if (summaryData.note_id) {
        // Small delay to let user see the success message before navigation
        setTimeout(() => {
          try {
            console.log(`[PDFManager] Navigating to note ${summaryData.note_id}`);
            router.push(`/notes/${summaryData.note_id}`);
          } catch (e) {
            // If navigation fails, ignore silently; the UI still shows the summary.
            console.warn('Navigation to created note failed', e);
          }
        }, 1500); // 1.5s delay to show success message
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Summarization failed');
    } finally {
      setSummarizing(null);
    }
  };

  const handleDelete = async (pdfId: string) => {
    if (!confirm('Are you sure you want to delete this PDF?')) return;

    // Optimistic UI: remove immediately, restore on failure
    const prev = pdfs;
    setPdfs(pdfs.filter(p => p.id !== pdfId));

    try {
      const response = await fetch(`/api/pdf/${pdfId}`, {
        method: 'DELETE',
      });

      if (!response.ok && response.status !== 204) {
        throw new Error('Delete failed');
      }

      setSuccess('PDF deleted successfully');
      if (selectedPdf?.id === pdfId) {
        setSelectedPdf(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      // rollback
      setPdfs(prev);
    } finally {
      // Refresh to be safe
      await fetchPDFs();
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (bytes === undefined || bytes === null) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getStatusIcon = (status: PDFDocument['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">PDF Manager</h1>
          <p className="text-muted-foreground">Upload and summarize PDF documents</p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Upload Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload PDF
          </CardTitle>
          <CardDescription>
            Upload a PDF file to extract text and generate AI summaries
          </CardDescription>
          <div className="ml-auto">
            <Button size="sm" variant="outline" onClick={fetchPDFs}>
              Refresh list
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pdf-file">Select PDF File (max 100MB)</Label>
            <Input
              id="pdf-file"
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              disabled={uploading}
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            )}
          </div>

          {uploadProgress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{resumable ? 'Uploading (resumable)...' : 'Uploading...'}</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
              {uploadEta && (
                <div className="text-xs text-muted-foreground flex justify-between">
                  <span>{uploadEta}</span>
                  {uploading && !resumable && (
                    <button
                      type="button"
                      onClick={cancelUpload}
                      className="text-destructive hover:underline"
                    >Cancel</button>
                  )}
                  {uploading && resumable && (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={togglePause}
                        className="text-muted-foreground hover:underline"
                      >{paused ? 'Resume' : 'Pause'}</button>
                      <button
                        type="button"
                        onClick={cancelUpload}
                        className="text-destructive hover:underline"
                      >Cancel</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload PDF
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* PDF List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Your PDFs ({pdfs.length})
          </CardTitle>
          <div className="ml-auto">
            <Button size="sm" variant="outline" onClick={fetchPDFs}>
              Refresh all
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pdfs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No PDFs uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pdfs.map((pdf) => (
                <Card key={pdf.id} className="hover:bg-accent/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(pdf.status)}
                          <h3 className="font-semibold">{pdf.original_filename || pdf.filename || 'Untitled'}</h3>
                          <Badge variant={pdf.status === 'completed' ? 'default' : 'secondary'}>
                            {pdf.status}
                          </Badge>
                          {(pdf.status === 'pending' || pdf.status === 'processing') && (
                            <span className="text-xs text-muted-foreground">
                              {formatElapsed(pdf.created_at)} elapsed
                            </span>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span>{formatFileSize(pdf.file_size_bytes || pdf.file_size || 0)}</span>
                          {pdf.page_count && <span>{pdf.page_count} pages</span>}
                          <span>{new Date(pdf.created_at).toLocaleDateString()}</span>
                        </div>
                        {(pdf.error_message || pdf.processing_error) && (
                          <p className="text-sm text-destructive">{pdf.error_message || pdf.processing_error}</p>
                        )}
                        {(pdf.status === 'pending' || pdf.status === 'processing') && (
                          <p className="text-xs text-muted-foreground">
                            We’re processing this PDF in the background. This can take up to a few minutes for large files.
                            {(() => { const since = new Date(pdf.created_at).getTime(); return (nowTs - since) / 1000 > 30 ? ' Still working—hang tight.' : '' })()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {(pdf.status === 'uploading' || pdf.status === 'pending' || pdf.status === 'processing') && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => refreshPdfStatus(pdf.id)}
                              title="Check current processing status"
                            >
                              <Clock className="h-4 w-4 mr-1" />
                              Refresh
                            </Button>
                            {pdf.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleProcessNow(pdf.id)}
                                title="Process PDF immediately (doesn't require background worker)"
                              >
                                <Zap className="h-4 w-4 mr-1" />
                                Process Now
                              </Button>
                            )}
                          </>
                        )}
                        {pdf.status === 'completed' && pdf.full_text && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSummarize(pdf)}
                            disabled={summarizing === pdf.id}
                            title={pdf.summary_text || pdf.summary ? 'Re-summarize PDF' : 'Summarize PDF'}
                          >
                            {summarizing === pdf.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>{(pdf.summary_text || pdf.summary) ? 'Re-' : ''}Summarize</>
                            )}
                          </Button>
                        )}
                        {(pdf.summary_text || pdf.summary) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedPdf(pdf)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(pdf.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary View */}
      {selectedPdf && (selectedPdf.summary_text || selectedPdf.summary) && (
        <Card>
          <CardHeader className="relative">
            <CardTitle className="pr-24">Summary: {selectedPdf.original_filename || selectedPdf.filename || 'PDF'}</CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedPdf(null)}
              className="absolute top-4 right-4"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Summary */}
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Summary
              </h3>
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedPdf.summaryData?.summary || selectedPdf.summary_text || selectedPdf.summary}
                </p>
              </div>
            </div>

            {/* Sentiment Badge */}
            {selectedPdf.summaryData?.sentiment && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Sentiment:</span>
                <Badge 
                  variant={
                    selectedPdf.summaryData.sentiment === 'positive' ? 'default' :
                    selectedPdf.summaryData.sentiment === 'negative' ? 'destructive' :
                    'secondary'
                  }
                  className="flex items-center gap-1"
                >
                  {selectedPdf.summaryData.sentiment === 'positive' && <Smile className="h-3 w-3" />}
                  {selectedPdf.summaryData.sentiment === 'negative' && <Frown className="h-3 w-3" />}
                  {selectedPdf.summaryData.sentiment === 'neutral' && <Meh className="h-3 w-3" />}
                  {selectedPdf.summaryData.sentiment.charAt(0).toUpperCase() + selectedPdf.summaryData.sentiment.slice(1)}
                </Badge>
              </div>
            )}

            {/* Key Takeaways */}
            {selectedPdf.summaryData?.takeaways && selectedPdf.summaryData.takeaways.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Key Takeaways
                </h3>
                <ul className="space-y-2">
                  {selectedPdf.summaryData.takeaways.map((takeaway, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Items */}
            {selectedPdf.summaryData?.actions && selectedPdf.summaryData.actions.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-primary" />
                  Action Items
                </h3>
                <ul className="space-y-3">
                  {selectedPdf.summaryData.actions.map((action, idx) => (
                    <li key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-accent/50 hover:bg-accent transition-colors">
                      <div className="flex-1">
                        <p className="font-medium">{action.task}</p>
                        {action.datetime && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Calendar className="h-3 w-3" />
                            {action.datetime}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tags */}
            {selectedPdf.summaryData?.tags && selectedPdf.summaryData.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedPdf.summaryData.tags.map((tag, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Page References */}
            {selectedPdf.summaryData?.page_references && selectedPdf.summaryData.page_references > 0 && (
              <div className="text-sm text-muted-foreground">
                Referenced {selectedPdf.summaryData.page_references} page{selectedPdf.summaryData.page_references !== 1 ? 's' : ''} from the document
              </div>
            )}

            {/* Note ID Link */}
            {selectedPdf.summaryData?.note_id && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  This summary has been saved to your notes (ID: {selectedPdf.summaryData.note_id})
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
