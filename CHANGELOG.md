# Changelog

All notable changes to Smart Summarizer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- YouTube URL summarization improvements:
	- API now returns `x-content-source` header: `webpage | youtube-transcript | youtube-metadata`
	- UI hint in URL preview for YouTube links (transcript vs fallback)
	- Post-summary banner when metadata-only fallback was used
- Unit tests for summarize-url header behavior
	- Test-only hooks to force transcript success or failure via URL markers in test environment
- Test stability improvements for `SummarizerApp` and `SearchBar` filters
- Comprehensive documentation organization with docs/ folder structure
- Database migrations organized in migrations/ folder
- Sentry instrumentation for better error tracking
- Progress component for upload UI
- PDF Management UI with upload, extract, and summarize features
- Notifications Center with real-time updates
- Webhooks Management UI with full CRUD operations
- Embedding Metrics dashboard refresh and backfill controls (optional user id, limit, dry-run)
- `.env.example` file for environment variable documentation
- LICENSE file (MIT)
- CONTRIBUTING.md with contribution guidelines
- This CHANGELOG.md

### Changed
- Reorganized 44 markdown files into docs/ folder (features, guides, implementation, archive)
- Moved 29 SQL files to migrations/ folder
- Updated README.md with new documentation structure
- Backfill API: default `user_id` to the authenticated user when omitted (self-service)
- Updated docs/INDEX.md with comprehensive navigation
- Improved Next.js 15 and Sentry configuration

### Fixed
- Missing Progress component for PDFManager
- Race condition in SearchBar advanced filters Apply→Search (now uses latest-applied filters)
- Flaky selectors in `SummarizerApp` results display test (stabilized with data-testid)
- Route conflicts between dynamic route folders
- Sentry deprecation warnings
- TypeScript errors in PDF components

## [0.1.0] - 2025-11-03

### Added - Core Features
- AI-powered summarization with GROQ (Llama 3.1)
- PDF upload, extraction, and summarization
- Semantic search with Transformers.js embeddings
- Voice input with Web Speech API
- Text-to-speech with voice selection
- Canvas editor with ReactFlow
- Canvas templates (5 built-in templates)
- Rich node types (text, checklists, images, links)
- Intelligent note linking with AI
- Real-time collaboration with Supabase Realtime
- Live cursor tracking and presence indicators
- Comments system with @mentions
- Version history for notes
- Workspaces and folders for organization
- Guest mode with localStorage
- Client-side AES encryption for sensitive notes
- Calendar link generation (Google, Outlook, Apple)
- Webhooks for external integrations
- Dark mode with system preference detection
- Multi-language support (i18n)
- Responsive design for mobile
- PWA support

### Added - Technical Infrastructure
- Next.js 15 App Router
- Supabase for database and authentication
- Row-level security (RLS) for multi-tenant isolation
- Comprehensive API with 58+ endpoints
- RESTful API design
- Request logging and error tracking
- Jest and React Testing Library for testing
- Playwright for E2E testing
- ESLint 9 flat config
- Tailwind CSS v4
- shadcn/ui components
- Sentry for error monitoring

### Added - Developer Experience
- Comprehensive API documentation
- Testing infrastructure
- Request-scoped logging
- Error boundaries
- Loading states and skeletons
- Empty states with CTAs
- Optimistic UI updates
- Undo/redo functionality

## Future Releases

See [docs/archive/FUTURE_IDEAS.md](./docs/archive/FUTURE_IDEAS.md) for planned features.

---

## Release Notes Format

### Added
New features or functionality

### Changed
Changes to existing functionality

### Deprecated
Soon-to-be removed features

### Removed
Removed features

### Fixed
Bug fixes

### Security
Security-related changes
