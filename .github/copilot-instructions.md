# Copilot instructions for smart-summarizer

This is a Next.js 15 App Router app with Supabase, GROQ for JSON-only summarization, local embeddings via Transformers.js, Tailwind v4, shadcn/ui, optional PWA, real-time collaboration, and visual canvas editing.

## Big picture
- **Text summarize**: `components/SummarizerApp.tsx` → POST `/api/summarize` → `lib/groq.ts` returns strict JSON → save to Supabase (`notes`,`tags`,`note_tags`) → fire-and-forget `/api/generate-embedding`.
- **URL summarize**: POST `/api/summarize-url` to extract and summarize a web page; for signed-in users we persist via `/api/summarize` without re-calling GROQ.
- **Search**: POST `/api/search` → embed with `@xenova/transformers` (`Xenova/all-MiniLM-L6-v2`, cached) → Supabase RPC `match_notes` or `match_notes_by_folder` → ranked results.
- **Guest mode**: no DB writes; usage quota (5 summaries) and history (10 notes max) stored in `localStorage` via `lib/guestMode.ts`. Client blocks encrypted blobs from being sent.
- **Workspaces, folders, sharing**: RLS-protected multi-tenant schema in `migrations/supabase-migration-workspaces.sql` and `supabase-migration-folders.sql`. Public sharing uses `notes.is_public` + `share_id`.
- **Real-time collaboration**: Supabase Realtime channels for presence tracking, live cursors, and collaborative canvas editing via `lib/useRealtime.ts` and `lib/realtime/collaboration.ts`.
- **Canvas editor**: ReactFlow-based visual brainstorming with templates, version history, and node types in `components/CanvasEditor.tsx` and `components/canvas-nodes/*`.
- **Logging**: create a request-scoped logger with `createRequestLogger(req)` and finish each handler with `logger.logResponse(...)`. Prefer this over `console.log`. Integrates with Sentry in production.

## Contracts and patterns
- **LLM contract** (in `lib/groq.ts`): must return JSON with keys `summary`, `takeaways[]`, `actions[{ task, datetime|null }]`, `tags[]`, `sentiment`. Keep `response_format: { type: 'json_object' }` and persona injection. Model: `llama-3.1-8b-instant`. Chunking logic handles large inputs (>5500 tokens) with multi-pass summarization.
- **API route style**: files in `app/api/**/route.ts` always return `NextResponse.json(...)`, validate input, use `getServerSupabase()` (SSR client with cookie binding), and handle errors via `respondError()` from `lib/apiErrors.ts`.
- **Background work**: trigger `/api/generate-embedding` with `fetch(...)` and `catch` errors; do not block the main response. Embedding jobs tracked in `embedding_jobs` table.
- **Embeddings**: use a cached Transformers pipeline (`EMBEDDING_MODEL` in `lib/embeddingsConfig.ts`) with `pooling: 'mean'` and `normalize: true`; embeddings are 384-d float arrays saved to `notes.embedding`. If dimensions mismatch, see `embeddingMismatchGuidance()` for migration steps.
- **Data writes** (see `app/api/summarize/route.ts`): insert `notes` with fields `{ user_id, persona, original_notes, summary, takeaways, actions, sentiment, folder_id?, workspace_id? }`, then upsert tags and insert `note_tags`. Rate-limiting (15 req/min per user/IP) enforced in-memory.
- **Search RPC args**: `{ query_embedding, match_threshold, match_count, filter_user_id, filter_folder_id? }`. Tune `match_threshold`/`match_count` at handler level. Functions defined in `migrations/supabase-migration-semantic-search*.sql`.
- **Client conventions**: components are client-side (`"use client"`) with shadcn/ui under `components/ui/*`; path alias `@/*` maps to repo root (see `tsconfig.json`). State managed via Zustand stores in `lib/state/*`.
- **Encryption**: `lib/encryption.ts` provides AES helpers; the UI prevents posting encrypted content to `/api/summarize`.
- **RLS security**: Supabase Row-Level Security enforced on all tables. Test with `migrations/check-and-fix-rls.sql`. Debug access issues with `migrations/debug-*.sql` scripts.

## Database migrations
- **Migration order matters**: Run `migrations/supabase-migration-*.sql` in numbered order (see `migrations/README.md` table). Fix scripts (`fix-*.sql`) patch specific issues post-migration.
- **Key migrations**: personas → folders → workspaces → sentiment → pinned-notes → semantic-search → semantic-search-by-folder → intelligent-linking → pdf-support → comments-versions → realtime-collaboration → canvas-templates* → advanced-features → webhooks → public-api → subscription-tiers.
- **Vector dimensions**: If changing embedding model, update `EMBEDDING_DIMENSION` in `lib/embeddingsConfig.ts` and re-run semantic search migrations with new `vector(N)` column definition.

## Environment and workflows
- **Env vars** in `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GROQ_API_KEY`; optional `PWA_DEV=true` to enable PWA in `next dev`, `NEXT_PUBLIC_SENTRY_DSN` for error tracking.
- **Scripts**: dev `npm run dev` (or `dev:pwa`), build/start `npm run build` / `npm start`, tests `npm test` / `npm run test:watch` / `npm run test:coverage`, lint `npm run lint` (ESLint 9 flat config `eslint.config.mjs`), e2e `npm run test:e2e`, diagnose `npm run diagnose`.
- **PWA**: configured in `next.config.ts` with `next-pwa`; disabled in dev unless `PWA_DEV=true`; assets in `public/`.
- **Testing**: Jest + RTL with `jest-environment-jsdom`; path alias `@/` is mapped (see `jest.config.js`, `jest.setup.js`, `jest.setup.pre.js`). Coverage thresholds: 20% branches, 30% functions, 35% lines/statements. E2E tests with Playwright in `e2e/`.
- **Monitoring**: Sentry integration via `@sentry/nextjs` in `next.config.ts` and `instrumentation.ts`. Tunnel route `/monitoring` circumvents ad-blockers.

## Pointers to copy from
- **Summarization**: `components/SummarizerApp.tsx`, `app/api/summarize/route.ts`, `lib/groq.ts`.
- **URL summarization**: `app/api/summarize-url/route.ts` and its use in `components/SummarizerApp.tsx`.
- **Search**: `components/SearchBar.tsx`, `app/api/search/route.ts`, `migrations/supabase-migration-semantic-search*.sql`.
- **Embeddings**: `app/api/generate-embedding/route.ts`, `lib/embeddingsConfig.ts`.
- **Logging**: `lib/logger.ts` across API routes; use `createRequestLogger(req)` pattern.
- **Guest mode**: `lib/guestMode.ts` used in `app/page.tsx` and `components/SummarizerApp.tsx`.
- **Real-time collaboration**: `lib/useRealtime.ts`, `lib/realtime/collaboration.ts`, `components/collaboration/*`.
- **Canvas editor**: `components/CanvasEditor.tsx`, `components/canvas-nodes/*`, `lib/canvasLayouts.ts`.
- **Error handling**: `lib/apiErrors.ts` for consistent error responses; `lib/apiMiddleware.ts` for auth checks.
- **PDF processing**: `app/api/pdf/**/route.ts`, `lib/pdfJobs.ts`, `migrations/supabase-migration-pdf-support.sql`.
- **Webhooks**: `app/api/webhooks/**/route.ts`, `lib/webhooks.ts`, `lib/webhookSecurity.ts`.
