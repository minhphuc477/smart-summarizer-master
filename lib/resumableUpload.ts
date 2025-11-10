// No direct supabase client usage in this helper; the caller supplies URL/keys

// Lightweight resumable upload helper using TUS protocol endpoints (Supabase supports tus on /storage/v1/upload/resumable)
// Strategy:
// 1. Create an upload by POSTing to the tus endpoint with required headers.
// 2. Store returned upload URL (Location header) in localStorage keyed by file fingerprint.
// 3. Resume by PATCHing to that URL with offset headers.
// Minimal subset: start, pause, resume, abort, progress & ETA.

export interface ResumableUploadOptions {
  file: File;
  chunkSize?: number; // default 5MB
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
  onEta?: (etaSeconds: number) => void;
  onComplete?: (storagePath: string) => void;
  onError?: (err: Error) => void;
  supabaseUrl: string;
  supabaseAnonKey: string;
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
    this.opts = { ...opts, chunkSize: opts.chunkSize || 5 * 1024 * 1024 };
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
      if (!this.uploadUrl) {
        // Build proper TUS endpoint for Supabase Storage
        const tusEndpoint = `${this.opts.supabaseUrl}/storage/v1/upload/resumable`;
        const path = `${this.opts.bucket}/${this.opts.userId}/${Date.now()}-${this.opts.file.name}`;
        
        try {
          const createResp = await fetch(tusEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.opts.supabaseAnonKey}`,
              'Upload-Length': String(this.opts.file.size),
              'Tus-Resumable': '1.0.0',
              'Upload-Metadata': `bucketName ${btoa(this.opts.bucket)},objectName ${btoa(path)},contentType ${btoa(this.opts.file.type || 'application/pdf')},cacheControl ${btoa('3600')}`,
              'x-upsert': 'false'
            }
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
    while (!this.aborted && !this.paused && this.uploadedBytes < file.size) {
      const nextChunkEnd = Math.min(this.uploadedBytes + (this.opts.chunkSize || 0), file.size);
      const chunk = file.slice(this.uploadedBytes, nextChunkEnd);
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
      if (!patchResp.ok) throw new Error(`Chunk upload failed (${patchResp.status})`);
      const newOffset = parseInt(patchResp.headers.get('Upload-Offset') || '0', 10);
      this.uploadedBytes = newOffset;
      if (this.opts.onProgress) this.opts.onProgress(this.uploadedBytes, file.size);
      const elapsed = (Date.now() - this.startTime) / 1000;
      const speed = this.uploadedBytes / (elapsed || 1);
      const remaining = file.size - this.uploadedBytes;
      if (this.opts.onEta) this.opts.onEta(remaining / (speed || 1));
    }
    if (!this.aborted && this.uploadedBytes >= file.size) {
      const storagePath = `${this.opts.userId}/${Date.now()}-${this.opts.file.name}`;
      if (this.opts.onComplete) this.opts.onComplete(storagePath);
      if (typeof localStorage !== 'undefined') localStorage.removeItem(`tus-url:${this.fingerprint()}`);
    }
  }
}

export function createResumableUpload(opts: ResumableUploadOptions) {
  return new ResumableUpload(opts);
}
