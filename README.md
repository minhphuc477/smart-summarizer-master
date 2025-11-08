# Smart Summarizer

> AI-powered note-taking and summarization platform with real-time collaboration, semantic search, and visual canvas tools.

## 🚀 Features

### ✨ Core Capabilities
- **AI Summarization** - GROQ-powered text summarization with sentiment analysis and auto-tagging
- **PDF Processing** - Upload, extract, and summarize PDFs with page-level references
- **Semantic Search** - Vector-based search using Transformers.js embeddings
- **Voice Input** - Speech-to-text with Web Speech API
- **Text-to-Speech** - Read summaries aloud with voice selection

### 🎨 Visual Tools
- **Canvas Editor** - Visual brainstorming with ReactFlow
- **Canvas Templates** - 5 built-in templates (Brainstorming, Mind Maps, Project Planning, etc.)
- **Rich Nodes** - Formatted text, checklists, images, and links
- **Intelligent Linking** - AI-powered note connections with graph view

### 👥 Collaboration
- **Real-time Collaboration** - Live cursor tracking and presence indicators
- **Comments & @Mentions** - Threaded discussions with notifications
- **Version History** - Track changes and restore previous versions
- **Workspaces & Folders** - Organize notes with team sharing

### 🔐 Access & Security
- **Guest Mode** - Use without sign-up (localStorage-based)
- **Encryption** - Client-side AES encryption for sensitive notes
- **Row-level Security** - Supabase RLS for multi-tenant data isolation

### 📊 Integrations
- **Calendar Links** - Generate Google/Outlook/Apple calendar events from actions
- **Webhooks** - Trigger external services on note events
- **Sentry Monitoring** - Error tracking and performance monitoring

## 🛠️ Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Database:** Supabase (PostgreSQL + Realtime)
- **AI:** GROQ (Llama 3.1), Transformers.js (embeddings)
- **UI:** Tailwind v4, shadcn/ui, ReactFlow
- **Auth:** Supabase Auth
- **Testing:** Jest, React Testing Library
- **Monitoring:** Sentry

## 📚 Documentation

**👉 [Complete Documentation Index](./docs/INDEX.md)**

### Quick Links
- [Migration Instructions](./docs/guides/MIGRATION_INSTRUCTIONS.md) - Database setup
- [API Developer Guide](./docs/guides/API_DEVELOPER_GUIDE.md) - API reference
- [Deployment Guide](./docs/guides/DEPLOYMENT.md) - Production deployment
- [Webhooks Guide](./docs/guides/WEBHOOKS_GUIDE.md) - Webhook integration

### Feature Documentation
- [PDF Summarization](./docs/implementation/PDF_SUMMARIZATION_COMPLETE.md)
- [Semantic Search](./docs/features/SEMANTIC_SEARCH_FEATURE.md)
- [Real-time Collaboration](./docs/implementation/COLLABORATION_FEATURES_READY.md)
- [Intelligent Linking](./docs/features/INTELLIGENT_LINKING_FEATURE.md)
- [All Features →](./docs/INDEX.md)

### Documentation Structure
```
docs/
├── INDEX.md                    # Complete documentation index
├── features/                   # Feature documentation
├── guides/                     # Setup and usage guides
├── implementation/             # Implementation reports
└── archive/                    # Historical documentation

migrations/                     # Database migrations
├── supabase-migration-*.sql   # Feature migrations
├── fix-*.sql                  # Bug fixes and patches
└── check-*.sql                # Diagnostic scripts
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account (or local Supabase instance)
- GROQ API key

### Installation

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GROQ_API_KEY=your_groq_api_key
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn (optional)
```

3. **Run database migrations:**
Follow [Migration Instructions](./docs/guides/MIGRATION_INSTRUCTIONS.md) to set up your Supabase database.

4. **Start the development server:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Development Commands

```bash
npm run dev          # Start dev server
npm run dev:pwa      # Start dev server with PWA enabled
npm run build        # Production build
npm start            # Start production server
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report
npm run lint         # Run ESLint
```

## 🧪 Testing

```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
```

See [Testing and Logging Guide](./docs/implementation/TESTING_AND_LOGGING_IMPLEMENTATION.md) for testing guidelines.

### YouTube summaries: transcript-first with metadata fallback

When summarizing YouTube URLs, the app tries, in order:

1) Captions transcript (best results)
2) oEmbed metadata (title/author)
3) Public video page description (og:description)

If transcripts aren’t available, we still produce a best-effort summary from metadata+description and annotate the response with a header so the UI can inform users:

- `x-content-source: youtube-transcript | youtube-metadata | webpage`

Tips for better results:
- Prefer videos with captions enabled
- Provide your own transcript if possible

The summarize-url API sets the header above; the UI displays a small banner when the metadata-only fallback is used.

### Embeddings & Diagnostics

All semantic search embeddings use a **centrally configured** local Transformers.js model (`Xenova/all-MiniLM-L6-v2`) with dimension **384**. Configuration is in `lib/embeddingsConfig.ts` to ensure consistency across:
- `/api/generate-embedding` (async embedding generation)
- `/api/search` (semantic search with fallback phases)
- `/api/admin/backfill-embeddings` (bulk re-index)

To avoid mismatches against legacy 1536-d vectors, we added:

- **Central config** (`lib/embeddingsConfig.ts`) exporting `EMBEDDING_MODEL` and `EMBEDDING_DIMENSION`
- **Diagnostic endpoint**: `GET /api/embedding/diagnose` returns database vector length and guidance if mismatched
- **Metrics endpoint**: `GET /api/embedding/metrics` aggregates per-model latency (avg, min/max, p50/p95/p99) and job status counts
- **Backfill endpoint**: `POST /api/admin/backfill-embeddings` (self-service; omit `user_id` to default to current user)

**Backfill missing embeddings** for your account:
```bash
curl -X POST http://localhost:3000/api/admin/backfill-embeddings \
  -H 'Content-Type: application/json' \
  -d '{"limit":100}'
```
Add `"dryRun": true` first to preview which notes would be processed.

**Embedding Metrics Dashboard** (`/analytics` or embedded component):
- Real-time stats: total embeddings, avg/P95/P99 latency
- Job status breakdown (pending, processing, completed, failed)
- Manual refresh button and auto-refresh every 30s
- Integrated backfill controls with dry-run preview

### Analyze Feature (Planned)

> **Status:** Planned (not yet implemented)

An upcoming "Analyze" workflow will enable **multi-document thematic synthesis**:
- Select multiple notes for cross-note analysis
- AI-powered clustering and theme extraction
- Consolidated takeaways across documents
- Visual theme graph with note relationships

**Tracking stub** in codebase:
```typescript
// TODO(analyze): Implement multi-note synthesis pipeline
// Proposed steps:
//   1. Fetch selected note IDs
//   2. Batch embed (if missing embeddings)
//   3. Cluster via k-means or hierarchical clustering
//   4. LLM summarization per cluster
//   5. Global synthesis across clusters
//   6. Render theme graph + takeaways panel
```

Until implemented, references to an "Analyze" button or route are **placeholders** for this planned feature.

## 📦 Deployment

See [Deployment Guide](./docs/guides/DEPLOYMENT.md) for detailed deployment instructions.

**Quick deploy to Vercel:**
```bash
vercel --prod
```

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed contribution guidelines.

**Quick Start:**
1. Follow existing code patterns (see [API Developer Guide](./docs/guides/API_DEVELOPER_GUIDE.md))
2. Write tests for new features
3. Update documentation
4. Check [Archive](./docs/archive/) for historical context

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🔒 Security

See [SECURITY.md](./SECURITY.md) for security policies and reporting vulnerabilities.

## 📝 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and release notes.

## 🔗 Links

- [Documentation Index](./docs/INDEX.md)
- [API Reference](./docs/guides/API_DEVELOPER_GUIDE.md)
- [Production Checklist](./docs/implementation/PRODUCTION_READY.md)
- [Contributing Guidelines](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)
