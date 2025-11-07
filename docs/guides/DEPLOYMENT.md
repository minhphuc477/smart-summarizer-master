# Production Deployment Guide

**Smart Summarizer v1.0**  
**Last Updated:** November 1, 2025

---

## Prerequisites

### Required Accounts
- **Supabase Project** (Free tier works for development)
- **GROQ API Key** (Free tier: 30 requests/min)
- **Vercel Account** (Recommended) or any Node.js hosting

### Local Development Tools
- Node.js 18+ and npm
- Git
- PostgreSQL client (optional, for local Supabase)

---

## Environment Setup

### 1. Create `.env.local`

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# AI Service
GROQ_API_KEY=gsk_your-groq-api-key

# Optional: Enable PWA in development
PWA_DEV=true
```

### 2. Database Migrations

Run migrations in order via Supabase SQL Editor:

```bash
# 1. Base structure
supabase-migration-folders.sql
supabase-migration-workspaces.sql
supabase-migration-personas.sql

# 2. Search & Analytics
supabase-migration-semantic-search.sql
supabase-migration-semantic-search-by-folder.sql
supabase-migration-sentiment.sql

# 3. Advanced features
supabase-migration-pinned-notes.sql
supabase-migration-advanced-features.sql
```

### 3. Enable Required Extensions

In Supabase SQL Editor:

```sql
-- Vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## Vercel Deployment

### Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Manual Steps

1. **Connect Repository**
   ```bash
   vercel login
   vercel link
   ```

2. **Configure Environment Variables**
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Add all variables from `.env.local`
   - Apply to Production, Preview, and Development

3. **Deploy**
   ```bash
   vercel --prod
   ```

### Build Configuration

Vercel auto-detects Next.js. Override if needed:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs"
}
```

---

## Alternative Hosting

### Netlify

1. **netlify.toml**
   ```toml
   [build]
     command = "npm run build"
     publish = ".next"

   [[plugins]]
     package = "@netlify/plugin-nextjs"
   ```

2. **Deploy**
   ```bash
   netlify deploy --prod
   ```

### Docker

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t smart-summarizer .
docker run -p 3000:3000 --env-file .env.local smart-summarizer
```

---

## Supabase Configuration

### Authentication Providers

Enable in Supabase Dashboard → Authentication → Providers:

- **Google OAuth**
  - Client ID from Google Cloud Console
  - Client Secret
  - Redirect URL: `https://your-project.supabase.co/auth/v1/callback`

- **GitHub OAuth**
  - Client ID from GitHub Developer Settings
  - Client Secret
  - Authorization callback URL (same as above)

### Row Level Security (RLS)

All tables have RLS enabled. Key policies:

```sql
-- Users can only access their own notes
CREATE POLICY "Users can view own notes"
ON notes FOR SELECT
USING (auth.uid() = user_id);

-- Workspace members can view shared notes
CREATE POLICY "Workspace members can view notes"
ON notes FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
  )
);
```

### Storage Buckets (Optional)

For canvas exports and future file attachments:

```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('exports', 'exports', false);

-- RLS policy
CREATE POLICY "Users can upload own exports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'exports' AND auth.uid()::text = owner);
```

---

## Performance Optimization

### 1. Edge Functions (Optional)

For search endpoints, use Supabase Edge Functions:

```typescript
// supabase/functions/search/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from '@supabase/supabase-js'

serve(async (req) => {
  // Your search logic with embeddings
})
```

### 2. Caching Strategy

Configure in `next.config.ts`:

```typescript
export default {
  // Static pages
  async headers() {
    return [
      {
        source: '/share/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=3600',
          },
        ],
      },
    ]
  },
}
```

### 3. Image Optimization

Enable Next.js Image Optimization:

```typescript
// next.config.ts
images: {
  domains: ['your-supabase-project.supabase.co'],
  formats: ['image/avif', 'image/webp'],
}
```

---

## Monitoring & Analytics

### 1. Vercel Analytics

```bash
npm install @vercel/analytics
```

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### 2. Error Tracking (Sentry)

```bash
npm install @sentry/nextjs
```

```bash
npx @sentry/wizard@latest -i nextjs
```

### 3. Custom Analytics

The app includes built-in analytics:

```sql
SELECT 
  event_type,
  COUNT(*) as count,
  DATE_TRUNC('day', created_at) as day
FROM analytics_events
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY event_type, day
ORDER BY day DESC;
```

---

## Security Checklist

- [ ] **Environment Variables Secured**
  - Not committed to repository
  - Stored in deployment platform secrets

- [ ] **Supabase RLS Enabled**
  - All tables have appropriate policies
  - Test with different user roles

- [ ] **API Rate Limiting** (Optional)
  - Use Vercel Edge Config for rate limits
  - Or implement middleware

- [ ] **CSP Headers** (Content Security Policy)
  ```typescript
  // next.config.ts
  async headers() {
    return [{
      source: '/:path*',
      headers: [{
        key: 'Content-Security-Policy',
        value: "default-src 'self'; ..."
      }]
    }]
  }
  ```

- [ ] **HTTPS Enforced**
  - Automatic on Vercel
  - Configure redirects for custom domains

---

## Post-Deployment

### 1. Verify Features

- [ ] User authentication (Google, GitHub)
- [ ] Note creation and summarization
- [ ] Semantic search
- [ ] Canvas editor
- [ ] Folder organization
- [ ] Public sharing
- [ ] PWA installation

### 2. Performance Testing

```bash
# Lighthouse CI
npm install -g @lhci/cli
lhci autorun --collect.url=https://your-app.vercel.app
```

Target scores:
- Performance: > 90
- Accessibility: > 95
- Best Practices: > 95
- SEO: > 90

### 3. Load Testing (Optional)

```bash
# Using Artillery
npm install -g artillery
artillery quick --count 100 --num 10 https://your-app.vercel.app
```

---

## Maintenance

### Daily
- Monitor error rates in Vercel/Sentry
- Check Supabase database size (free tier: 500MB)

### Weekly
- Review API usage (GROQ: 30 req/min free tier)
- Check Supabase auth logs for suspicious activity

### Monthly
- Update dependencies: `npm update`
- Review and optimize database indexes
- Archive old analytics events

---

## Rollback Procedure

### Vercel

```bash
# List deployments
vercel ls

# Rollback to specific deployment
vercel rollback <deployment-url>
```

### Database

```sql
-- Backup before major changes
pg_dump -h db.your-project.supabase.co \
  -U postgres \
  -d postgres \
  > backup_$(date +%Y%m%d).sql
```

---

## Troubleshooting

### Build Fails

1. **TypeScript Errors**
   ```bash
   npm run lint
   npm run build
   ```

2. **Missing Environment Variables**
   - Check Vercel environment variables
   - Verify `.env.local` locally

### Runtime Issues

1. **Supabase Connection**
   - Verify URL and anon key
   - Check RLS policies
   - Review Supabase logs

2. **GROQ API Errors**
   - Check API key validity
   - Monitor rate limits
   - Review GROQ dashboard

3. **Search Not Working**
   - Verify pgvector extension installed
   - Check embeddings are being generated
   - Review match_notes RPC function

---

## Support & Resources

- **Documentation:** `/README.md`, `/PHASE_4_COMPLETE.md`
- **Supabase Docs:** https://supabase.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **GROQ API:** https://console.groq.com/docs

---

## Production URLs

- **App:** https://your-app.vercel.app
- **Supabase Dashboard:** https://app.supabase.com/project/your-project
- **Vercel Dashboard:** https://vercel.com/your-team/smart-summarizer

---

**Deployment Status:** ✅ Ready for Production  
**Last Tested:** November 1, 2025  
**Test Coverage:** 270/270 tests passing
