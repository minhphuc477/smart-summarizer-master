"use client";

import { useState, useEffect, useCallback } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
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
  page_count?: number;
  created_at: string;
  error_message?: string;
  processing_error?: string;
}

interface PDFManagerProps {
  session: Session | null;
  selectedFolderId?: number | null;
  selectedWorkspaceId?: string | null;
}

export default function PDFManager({ session, selectedFolderId, selectedWorkspaceId }: PDFManagerProps) {
  const [pdfs, setPdfs] = useState<PDFDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPdf, setSelectedPdf] = useState<PDFDocument | null>(null);
  const [summarizing, setSummarizing] = useState<string | null>(null);

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
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (selectedWorkspaceId) {
        formData.append('workspace_id', selectedWorkspaceId);
      }
      if (selectedFolderId) {
        formData.append('folder_id', selectedFolderId.toString());
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/pdf/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      const respData = await response.json().catch(() => ({})) as { error?: string; pdf?: { id: string } };
      if (!response.ok) {
        throw new Error(respData.error || 'Upload failed');
      }

      setUploadProgress(100);
      setSuccess('PDF uploaded. Queued for processing...');
      setSelectedFile(null);
      // Request async processing and start polling
      const uploadedId = respData?.pdf?.id;
      if (uploadedId) {
        await requestProcessing(uploadedId);
      }
      // Refresh list (initial status)
      await fetchPDFs();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
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
  

  // Removed synchronous extraction path in favor of async queue + background worker

  const handleSummarize = async (pdf: PDFDocument) => {
    if (!pdf.full_text) {
      setError('PDF text not extracted yet (still processing)');
      return;
    }

    setSummarizing(pdf.id);
    setError(null);

    try {
      const response = await fetch('/api/pdf/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pdf_id: pdf.id,
          workspace_id: selectedWorkspaceId,
          folder_id: selectedFolderId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Summarization failed');
      }

      const data = await response.json();
      setSuccess('PDF summarized successfully!');
      
      // Update the PDF in the list
      setPdfs(prev => prev.map(p => p.id === pdf.id ? { ...p, summary: data.summary } : p));
  setPdfs(prev => prev.map(p => p.id === pdf.id ? { ...p, summary: data.summary, summary_text: data.summary } : p));
      setSelectedPdf({ ...pdf, summary: data.summary });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Summarization failed');
    } finally {
      setSummarizing(null);
    }
  };

  const handleDelete = async (pdfId: string) => {
    if (!confirm('Are you sure you want to delete this PDF?')) return;

    try {
      const response = await fetch(`/api/pdf/${pdfId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      setSuccess('PDF deleted successfully');
      await fetchPDFs();
      if (selectedPdf?.id === pdfId) {
        setSelectedPdf(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload PDF
          </CardTitle>
          <CardDescription>
            Upload a PDF file to extract text and generate AI summaries
          </CardDescription>
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
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Your PDFs ({pdfs.length})
          </CardTitle>
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
                          <h3 className="font-semibold">{pdf.filename}</h3>
                          <Badge variant={pdf.status === 'completed' ? 'default' : 'secondary'}>
                            {pdf.status}
                          </Badge>
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span>{formatFileSize(pdf.file_size)}</span>
                          <span>{formatFileSize(pdf.file_size_bytes || pdf.file_size || 0)}</span>
                          {pdf.page_count && <span>{pdf.page_count} pages</span>}
                          <span>{new Date(pdf.created_at).toLocaleDateString()}</span>
                        </div>
                        {pdf.error_message && (
                          <p className="text-sm text-destructive">{pdf.error_message}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {pdf.status === 'completed' && !pdf.summary && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSummarize(pdf)}
                            disabled={summarizing === pdf.id}
                          >
                            {summarizing === pdf.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Summarize'
                            )}
                          </Button>
                        )}
                        {pdf.summary && (
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
      {selectedPdf?.summary && (
        <Card>
          <CardHeader>
            <CardTitle>Summary: {selectedPdf.filename}</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedPdf(null)}
              className="absolute top-4 right-4"
            >
              Close
            </Button>
          </CardHeader>
          <CardContent>
            <div className="prose dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap">{selectedPdf.summary}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
