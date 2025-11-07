# Phase 6 Implementation Plan: Platform & Ecosystem

**Date:** November 1, 2025  
**Focus:** Public API, Browser Extension, Enhanced Document Processing  
**Timeline:** 2-3 weeks  
**Status:** 🚀 In Progress

---

## 🎯 Overview

Phase 6 transforms Smart Summarizer from a standalone app into a platform with:
- **Public REST API** for third-party integrations
- **Browser Extension** for seamless web capture
- **Enhanced Document Processing** (PDF support, improved extraction)

This enables:
- Developers to build on top of Smart Summarizer
- Users to capture content from anywhere on the web
- Processing of various document formats beyond plain text

---

## 📋 Features

### 1. Public REST API ✨

#### 1.1 API Endpoints

**Notes API**
```
GET    /api/v1/notes              - List notes (paginated, filtered)
GET    /api/v1/notes/:id          - Get single note
POST   /api/v1/notes              - Create note
PUT    /api/v1/notes/:id          - Update note
DELETE /api/v1/notes/:id          - Delete note
POST   /api/v1/notes/search       - Semantic search
```

**Folders API**
```
GET    /api/v1/folders            - List folders
GET    /api/v1/folders/:id        - Get folder with notes
POST   /api/v1/folders            - Create folder
PUT    /api/v1/folders/:id        - Update folder
DELETE /api/v1/folders/:id        - Delete folder
```

**Tags API**
```
GET    /api/v1/tags               - List all tags
GET    /api/v1/tags/:id/notes     - Get notes with tag
POST   /api/v1/notes/:id/tags     - Add tag to note
DELETE /api/v1/notes/:id/tags/:tagId - Remove tag
```

**Workspaces API**
```
GET    /api/v1/workspaces         - List workspaces
GET    /api/v1/workspaces/:id     - Get workspace
POST   /api/v1/workspaces         - Create workspace
PUT    /api/v1/workspaces/:id     - Update workspace
```

**Summarization API**
```
POST   /api/v1/summarize          - Summarize text
POST   /api/v1/summarize/url      - Summarize URL
POST   /api/v1/summarize/pdf      - Summarize PDF (new)
```

#### 1.2 Authentication

**API Key Management**
- User generates API keys from Settings
- Multiple keys per user (for different apps)
- Key rotation and revocation
- Scoped permissions (read-only, full access)

**Authentication Flow**
```typescript
// Request header
Authorization: Bearer sk_live_1234567890abcdef

// Rate limits
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1635724800
```

#### 1.3 Rate Limiting

**Tiers**
- Free: 100 requests/hour
- Personal: 1,000 requests/hour
- Pro: 10,000 requests/hour
- Team: 50,000 requests/hour

**Implementation**
- Redis-based rate limiting
- Per-API-key tracking
- 429 Too Many Requests response
- Retry-After header

#### 1.4 API Versioning

- Version in URL: `/api/v1/`, `/api/v2/`
- Maintain v1 for backward compatibility
- Deprecation warnings in response headers
- Migration guide for version upgrades

---

### 2. API Documentation 📚

#### 2.1 OpenAPI/Swagger Spec

**Interactive Docs at `/api-docs`**
- Auto-generated from route definitions
- Try-it-out functionality
- Request/response examples
- Authentication testing

**Tools**
- `swagger-ui-express` for UI
- `swagger-jsdoc` for JSDoc comments
- OpenAPI 3.0 specification

#### 2.2 Developer Portal

**Documentation Site**
- Getting started guide
- Authentication tutorial
- Code examples (JavaScript, Python, curl)
- Common use cases
- Error handling guide
- Best practices

**Example:**
```javascript
// JavaScript SDK example
import SmartSummarizer from '@smart-summarizer/sdk';

const client = new SmartSummarizer('your-api-key');

// Create a note
const note = await client.notes.create({
  text: 'Your notes here...',
  persona: 'professional'
});

// Search notes
const results = await client.notes.search({
  query: 'project planning',
  limit: 10
});
```

---

### 3. Browser Extension 🌐

#### 3.1 Features

**Context Menu Integration**
- Right-click → "Summarize this page"
- Selected text → "Summarize selection"
- Image → "Extract and summarize text (OCR)"

**Popup UI**
- Quick summarize current page
- View recent summaries
- Search notes
- Settings (API key, persona selection)

**Keyboard Shortcuts**
- `Alt+Shift+S` - Summarize page
- `Alt+Shift+C` - Open clip manager

**Content Extraction**
- Article detection (Readability.js)
- Clean HTML removal
- Metadata extraction (title, author, date)
- Image descriptions (alt text)

#### 3.2 Technical Stack

**Manifest V3**
```json
{
  "manifest_version": 3,
  "name": "Smart Summarizer",
  "version": "1.0.0",
  "permissions": [
    "activeTab",
    "contextMenus",
    "storage",
    "clipboardWrite"
  ],
  "host_permissions": [
    "https://your-app-domain.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon.png"
  }
}
```

**Architecture**
- **Background Service Worker**: API communication, storage
- **Content Script**: Page content extraction
- **Popup**: User interface
- **Options Page**: Settings configuration

#### 3.3 Sync & Authentication

- OAuth flow for user login
- Sync with web app via API
- Offline queue for failed submissions
- Conflict resolution

---

### 4. Enhanced Document Processing 📄

#### 4.1 PDF Summarization

**Client-Side Processing**
- PDF.js for in-browser parsing
- Text extraction with page references
- Table/image detection
- Multi-page support

**API Endpoint**
```typescript
POST /api/v1/summarize/pdf
Content-Type: multipart/form-data

{
  file: <PDF file>,
  options: {
    includeImages: boolean,
    maxPages: number,
    persona: string
  }
}

Response:
{
  summary: string,
  pages: [{
    number: number,
    summary: string,
    keyPoints: string[]
  }],
  metadata: {
    totalPages: number,
    author: string,
    title: string
  }
}
```

**Processing Flow**
1. Upload PDF (max 50MB)
2. Extract text per page
3. Summarize each page independently
4. Generate overall summary
5. Link key points to page numbers

#### 4.2 Improved URL Extraction

**Better Article Detection**
- Fallback to multiple parsers (Readability, Mercury, Diffbot)
- Handle JavaScript-heavy sites (Puppeteer for rendering)
- Extract structured data (JSON-LD, Open Graph)
- Archive full page HTML

**Enhanced Metadata**
```typescript
{
  url: string,
  title: string,
  author?: string,
  publishDate?: Date,
  siteName?: string,
  excerpt?: string,
  image?: string,
  wordCount: number,
  readingTime: number, // minutes
  language?: string
}
```

#### 4.3 Additional Formats (Future)

- **Microsoft Word** (.docx) - via mammoth.js
- **Markdown** files - native support
- **Google Docs** - via Google Docs API
- **Notion pages** - via Notion API

---

## 🏗️ Technical Architecture

### API Layer

```
┌─────────────────────────────────────────┐
│           Next.js API Routes            │
├─────────────────────────────────────────┤
│  /api/v1/*  (Public API)               │
│  - Authentication middleware            │
│  - Rate limiting middleware             │
│  - Request validation (Zod)            │
│  - Response formatting                  │
├─────────────────────────────────────────┤
│         Business Logic Layer            │
│  - NoteService                         │
│  - FolderService                       │
│  - SearchService                       │
│  - SummarizationService                │
├─────────────────────────────────────────┤
│          Data Access Layer              │
│  - Supabase Client                     │
│  - Query builders                      │
│  - Transaction support                 │
└─────────────────────────────────────────┘
```

### Browser Extension

```
┌─────────────────────────────────────────┐
│            Browser Extension            │
├──────────────┬──────────────────────────┤
│ Content      │  Background Service      │
│ Script       │  Worker                  │
│              │  - API calls             │
│ - Extract    │  - Storage               │
│   content    │  - Sync                  │
│ - Inject UI  │                          │
├──────────────┴──────────────────────────┤
│              Popup UI                   │
│  - React components                     │
│  - Local state management               │
└─────────────────────────────────────────┘
```

---

## 📊 Database Changes

### New Tables

#### `api_keys`
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL, -- First 8 chars for display
  scopes TEXT[] DEFAULT '{"read", "write"}',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
```

#### `api_usage_logs`
```sql
CREATE TABLE api_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_usage_logs_api_key_id ON api_usage_logs(api_key_id);
CREATE INDEX idx_api_usage_logs_created_at ON api_usage_logs(created_at);
```

#### `pdf_uploads`
```sql
CREATE TABLE pdf_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_path TEXT NOT NULL, -- Supabase Storage path
  total_pages INTEGER,
  extracted_text TEXT,
  note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pdf_uploads_user_id ON pdf_uploads(user_id);
```

---

## 🧪 Testing Strategy

### API Tests

```typescript
describe('Public API v1', () => {
  describe('Authentication', () => {
    it('should reject requests without API key');
    it('should reject requests with invalid API key');
    it('should accept requests with valid API key');
    it('should track API usage');
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits');
    it('should return 429 when limit exceeded');
    it('should reset limits after time window');
  });

  describe('Notes API', () => {
    it('GET /api/v1/notes should list notes');
    it('POST /api/v1/notes should create note');
    it('PUT /api/v1/notes/:id should update note');
    it('DELETE /api/v1/notes/:id should delete note');
  });
});
```

### Browser Extension Tests

```typescript
describe('Browser Extension', () => {
  describe('Content Extraction', () => {
    it('should extract article from blog post');
    it('should handle Wikipedia pages');
    it('should extract selected text');
  });

  describe('Context Menu', () => {
    it('should show "Summarize page" option');
    it('should send content to API');
    it('should show success notification');
  });
});
```

### PDF Processing Tests

```typescript
describe('PDF Summarization', () => {
  it('should extract text from simple PDF');
  it('should handle multi-page PDFs');
  it('should extract metadata');
  it('should reject files over size limit');
});
```

---

## 📈 Success Metrics

### API Adoption
- Number of API keys generated
- API requests per day/week/month
- Most popular endpoints
- Average response time

### Browser Extension
- Chrome Web Store installs
- Firefox Add-ons installs
- Daily active users
- Pages summarized per user

### PDF Processing
- PDFs uploaded per day
- Average PDF size
- Processing success rate
- Average processing time

---

## 🚀 Implementation Timeline

### Week 1: API Foundation
- [ ] Day 1-2: Design API routes and authentication
- [ ] Day 3-4: Implement core API endpoints (notes, folders)
- [ ] Day 5: Add rate limiting and API key management
- [ ] Day 6-7: Write API tests and documentation

### Week 2: Browser Extension
- [ ] Day 1-2: Set up extension project (Manifest V3)
- [ ] Day 3-4: Implement content extraction and UI
- [ ] Day 5: Add authentication and sync
- [ ] Day 6-7: Test and package for Chrome/Firefox

### Week 3: Document Processing & Polish
- [ ] Day 1-3: Implement PDF upload and processing
- [ ] Day 4: Improve URL extraction with better parsers
- [ ] Day 5: OpenAPI documentation and developer portal
- [ ] Day 6-7: Final testing, bug fixes, documentation

---

## 💡 Future Enhancements (Phase 7+)

### API Ecosystem
- GraphQL API option
- Webhook system for real-time events
- SDK libraries (JavaScript, Python, Ruby, Go)
- Zapier official integration
- Rate limit tiers based on subscription

### Browser Extension
- Clip manager (save snippets to review later)
- Batch summarization (multiple tabs)
- Sidebar UI (persistent across pages)
- Annotation tools (highlight, comment)
- OCR for images

### Document Processing
- YouTube video transcription
- Audio file transcription
- Email thread summarization
- Slack conversation summarization
- Code repository analysis

---

## 📚 References

- [REST API Best Practices](https://restfulapi.net/)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [PDF.js Documentation](https://mozilla.github.io/pdf.js/)
- [Readability.js](https://github.com/mozilla/readability)

---

**Status:** Ready to implement 🚀  
**Next:** Start with API foundation (Week 1)
