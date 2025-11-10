// No direct supabase client usage in this helper; the caller supplies URL/keys

// Lightweight resumable upload helper using TUS protocol endpoints (Supabase supports tus on /storage/v1/upload/resumable)
// Strategy:
// 1. Create an upload by POSTing to the tus endpoint with required headers.
// 2. Store returned upload URL (Location header) in localStorage keyed by file fingerprint.
// 3. Resume by PATCHing to that URL with offset headers.
// Minimal subset: start, pause, resume, abort, progress & ETA.

export interface ResumableUploadOptions {
  file: File;
  chunkSize?: number; // default 10MB (increased from 5MB for better performance)
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
  onEta?: (etaSeconds: number) => void;
  onComplete?: (storagePath: string) => void;
  onError?: (err: Error) => void;
  supabaseUrl: string;
  // Either provide the anon/service key or the user's access token. Prefer access token for RLS-authorized uploads.
  supabaseAnonKey?: string;
  supabaseAccessToken?: string;
  // If provided, use this upload URL instead of creating a new resumable resource
  initialUploadUrl?: string;
  bucket: string;
  userId: string; // used for path prefix
}

export class ResumableUpload {
  private opts: ResumableUploadOptions;
  private uploadUrl: string | null = null;
  private aborted = false;
  private paused = false;
  private uploadedBytes = 0;
  private controller: AbortController | null = null;
  private startTime = 0;

  constructor(opts: ResumableUploadOptions) {
    // Default chunk size: 10MB for better upload performance (reduced round trips)
    this.opts = { ...opts, chunkSize: opts.chunkSize || 10 * 1024 * 1024 };
  }

  private fingerprint(): string {
    const f = this.opts.file;
    return `pdf:${f.name}:${f.size}:${f.lastModified}`;
  }

  pause() {
    this.paused = true;
    if (this.controller) this.controller.abort();
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    void this.startOrResume();
  }

  abort() {
    this.aborted = true;
    if (this.controller) this.controller.abort();
  }

  async startOrResume() {
    try {
      this.startTime = Date.now();
      const fp = this.fingerprint();
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(`tus-url:${fp}`) : null;
      if (stored) {
        this.uploadUrl = stored;
        const headResp = await fetch(this.uploadUrl, { method: 'HEAD' });
        if (headResp.ok) {
          const offset = parseInt(headResp.headers.get('Upload-Offset') || '0', 10);
          this.uploadedBytes = offset;
        }
      }

      // If caller supplied an initial upload URL (server-created), prefer that
      if (!this.uploadUrl && this.opts.initialUploadUrl) {
        this.uploadUrl = this.opts.initialUploadUrl;
        if (typeof localStorage !== 'undefined') localStorage.setItem(`tus-url:${fp}`, this.uploadUrl);
        const headResp = await fetch(this.uploadUrl, { method: 'HEAD' });
        if (headResp.ok) {
          const offset = parseInt(headResp.headers.get('Upload-Offset') || '0', 10);
          this.uploadedBytes = offset;
        }
      }

      if (!this.uploadUrl) {
        // Build proper TUS endpoint for Supabase Storage
        const tusEndpoint = `${this.opts.supabaseUrl}/storage/v1/upload/resumable`;
        const path = `${this.opts.bucket}/${this.opts.userId}/${Date.now()}-${this.opts.file.name}`;
        
        try {
          const authHeader = this.opts.supabaseAccessToken
            ? `Bearer ${this.opts.supabaseAccessToken}`
            : (this.opts.supabaseAnonKey ? `Bearer ${this.opts.supabaseAnonKey}` : undefined);

          const headers: Record<string, string> = {
            'Upload-Length': String(this.opts.file.size),
            'Tus-Resumable': '1.0.0',
            'Upload-Metadata': `bucketName ${btoa(this.opts.bucket)},objectName ${btoa(path)},contentType ${btoa(this.opts.file.type || 'application/pdf')},cacheControl ${btoa('3600')}`,
            'x-upsert': 'false'
          };

          if (authHeader) headers['Authorization'] = authHeader;

          const createResp = await fetch(tusEndpoint, {
            method: 'POST',
            headers
          });
          
          if (!createResp.ok) {
            const errorText = await createResp.text().catch(() => 'Unknown error');
            console.error('TUS create upload failed:', {
              status: createResp.status,
              statusText: createResp.statusText,
              error: errorText,
              endpoint: tusEndpoint,
              bucket: this.opts.bucket
            });
            throw new Error(`Failed to create resumable upload: ${createResp.status} - ${errorText}`);
          }
          
          this.uploadUrl = createResp.headers.get('Location');
          if (!this.uploadUrl) throw new Error('Missing upload URL in Location header');
          if (typeof localStorage !== 'undefined') localStorage.setItem(`tus-url:${fp}`, this.uploadUrl);
        } catch (createError) {
          console.error('Error creating resumable upload:', createError);
          throw createError;
        }
      }
      await this.sendChunks();
    } catch (e) {
      if (this.opts.onError && e instanceof Error) this.opts.onError(e);
    }
  }

  private async sendChunks() {
    const file = this.opts.file;
    const chunkSize = this.opts.chunkSize || 10 * 1024 * 1024;
    let chunkIndex = 0;
    const totalChunks = Math.ceil((file.size - this.uploadedBytes) / chunkSize);
    
    console.log(`[ResumableUpload] Starting upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`[ResumableUpload] Chunk size: ${(chunkSize / 1024 / 1024).toFixed(2)} MB, Total chunks: ${totalChunks}`);
    
    while (!this.aborted && !this.paused && this.uploadedBytes < file.size) {
      const chunkStartTime = Date.now();
      const nextChunkEnd = Math.min(this.uploadedBytes + chunkSize, file.size);
      const chunk = file.slice(this.uploadedBytes, nextChunkEnd);
      const currentChunkSize = nextChunkEnd - this.uploadedBytes;
      
      chunkIndex++;
      console.log(`[ResumableUpload] Uploading chunk ${chunkIndex}/${totalChunks} (${(currentChunkSize / 1024).toFixed(2)} KB)`);
      
      this.controller = new AbortController();
      const patchResp = await fetch(this.uploadUrl!, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/offset+octet-stream',
          'Upload-Offset': String(this.uploadedBytes),
          'Tus-Resumable': '1.0.0'
        },
        body: chunk,
        signal: this.controller.signal,
      });
      
      const chunkDuration = Date.now() - chunkStartTime;
      const chunkSpeed = (currentChunkSize / 1024 / 1024) / (chunkDuration / 1000); // MB/s
      console.log(`[ResumableUpload] Chunk ${chunkIndex} completed in ${(chunkDuration / 1000).toFixed(2)}s (${chunkSpeed.toFixed(2)} MB/s)`);
      
      if (!patchResp.ok) {
        console.error(`[ResumableUpload] Chunk upload failed:`, {
          status: patchResp.status,
          statusText: patchResp.statusText,
          chunkIndex,
          uploadedBytes: this.uploadedBytes
        });
        throw new Error(`Chunk upload failed (${patchResp.status})`);
      }
      
      const newOffset = parseInt(patchResp.headers.get('Upload-Offset') || '0', 10);
      this.uploadedBytes = newOffset;
      if (this.opts.onProgress) this.opts.onProgress(this.uploadedBytes, file.size);
      const elapsed = (Date.now() - this.startTime) / 1000;
      const speed = this.uploadedBytes / (elapsed || 1);
      const remaining = file.size - this.uploadedBytes;
      const eta = remaining / (speed || 1);
      if (this.opts.onEta) this.opts.onEta(eta);
      
      console.log(`[ResumableUpload] Progress: ${((this.uploadedBytes / file.size) * 100).toFixed(1)}%, ETA: ${eta.toFixed(1)}s`);
    }
    if (!this.aborted && this.uploadedBytes >= file.size) {
      const totalDuration = (Date.now() - this.startTime) / 1000;
      const avgSpeed = (file.size / 1024 / 1024) / totalDuration;
      console.log(`[ResumableUpload] Upload completed: ${file.name} in ${totalDuration.toFixed(2)}s (avg ${avgSpeed.toFixed(2)} MB/s)`);
      
      const storagePath = `${this.opts.userId}/${Date.now()}-${this.opts.file.name}`;
      if (this.opts.onComplete) this.opts.onComplete(storagePath);
      if (typeof localStorage !== 'undefined') localStorage.removeItem(`tus-url:${this.fingerprint()}`);
    }
  }
}

export function createResumableUpload(opts: ResumableUploadOptions) {
  return new ResumableUpload(opts);
}
