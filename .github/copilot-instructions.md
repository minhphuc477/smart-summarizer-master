# Copilot instructions for smart-summarizer

This is a Next.js 15 App Router app with Supabase, GROQ for JSON-only summarization, local embeddings via Transformers.js, Tailwind v4, shadcn/ui, and optional PWA.

## Big picture
- Text summarize: `components/SummarizerApp.tsx` → POST `/api/summarize` → `lib/groq.ts` returns strict JSON → save to Supabase (`notes`,`tags`,`note_tags`) → fire-and-forget `/api/generate-embedding`.
- URL summarize: POST `/api/summarize-url` to extract and summarize a web page; for signed-in users we persist via `/api/summarize` without re-calling GROQ.
- Search: POST `/api/search` → embed with `@xenova/transformers` (`Xenova/all-MiniLM-L6-v2`, cached) → Supabase RPC `match_notes` or `match_notes_by_folder` → ranked results.
- Guest mode: no DB writes; usage quota and history stored in `localStorage` via `lib/guestMode.ts`. Client blocks encrypted blobs from being sent.
- Workspaces, folders, sharing: RLS and schema in `supabase-migration-workspaces.sql` and `supabase-migration-folders.sql`. Public sharing uses `notes.is_public` + `share_id`.
- Logging: create a request-scoped logger with `createRequestLogger(req)` and finish each handler with `logger.logResponse(...)`. Prefer this over `console.log`.

## Contracts and patterns
- LLM contract (in `lib/groq.ts`): must return JSON with keys `summary`, `takeaways[]`, `actions[{ task, datetime|null }]`, `tags[]`, `sentiment`. Keep `response_format: { type: 'json_object' }` and persona injection. Model: `llama-3.1-8b-instant`.
- API route style: files in `app/api/**/route.ts` always return `NextResponse.json(...)`, validate input, and use `getServerSupabase()` (auth-helpers when present, else anon client).
- Background work: trigger `/api/generate-embedding` with `fetch(...)` and `catch` errors; do not block the main response.
- Embeddings: use a cached Transformers pipeline with `pooling: 'mean'` and `normalize: true`; embeddings are 384-d float arrays saved to `notes.embedding`.
- Data writes (see `app/api/summarize/route.ts`): insert `notes` with fields `{ user_id, persona, original_notes, summary, takeaways, actions, sentiment, folder_id?, workspace_id? }`, then upsert tags and insert `note_tags`.
- Search RPC args: `{ query_embedding, match_threshold, match_count, filter_user_id, filter_folder_id? }`. Tune `match_threshold`/`match_count` at handler level.
- Client conventions: components are client-side with shadcn/ui under `components/ui/*`; path alias `@/*` maps to repo root (see `tsconfig.json`).
- Encryption: `lib/encryption.ts` provides AES helpers; the UI prevents posting encrypted content to `/api/summarize`.

## Environment and workflows
- Env vars in `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GROQ_API_KEY`; optional `PWA_DEV=true` to enable PWA in `next dev`.
- Scripts: dev `npm run dev` (or `dev:pwa`), build/start `npm run build` / `npm start`, tests `npm test` / `npm run test:watch` / `npm run test:coverage`, lint `npm run lint` (ESLint 9 flat config `eslint.config.mjs`).
- PWA: configured in `next.config.ts` with `next-pwa`; assets in `public/`.
- Testing: Jest + RTL with `jest-environment-jsdom`; path alias `@/` is mapped (see `jest.config.js`, `jest.setup.js`).

## Pointers to copy from
- Summarization: `components/SummarizerApp.tsx`, `app/api/summarize/route.ts`, `lib/groq.ts`.
- URL summarization: `app/api/summarize-url/route.ts` and its use in `components/SummarizerApp.tsx`.
- Search: `components/SearchBar.tsx`, `app/api/search/route.ts`, `supabase-migration-*.sql`.
- Embeddings: `app/api/generate-embedding/route.ts`.
- Logging: `lib/logger.ts` across API routes.
- Guest mode: `lib/guestMode.ts` used in `app/page.tsx` and `components/SummarizerApp.tsx`.
