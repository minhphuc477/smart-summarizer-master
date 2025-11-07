# Database Migrations

This folder contains all SQL migration scripts for the Smart Summarizer database.

## 📁 Organization

Migrations are organized by naming convention:

### Feature Migrations (`supabase-migration-*.sql`)
Main feature implementations and schema changes.

| File | Description | Order |
|------|-------------|-------|
| `supabase-migration-personas.sql` | User personas for summarization | 1 |
| `supabase-migration-folders.sql` | Folder organization | 2 |
| `supabase-migration-workspaces.sql` | Workspace collaboration | 3 |
| `supabase-migration-sentiment.sql` | Sentiment analysis | 4 |
| `supabase-migration-pinned-notes.sql` | Pin notes feature | 5 |
| `supabase-migration-semantic-search.sql` | Vector embeddings | 6 |
| `supabase-migration-semantic-search-by-folder.sql` | Folder-scoped search | 7 |
| `supabase-migration-intelligent-linking.sql` | Note linking system | 8 |
| `supabase-migration-pdf-support.sql` | PDF document handling | 9 |
| `supabase-migration-comments-versions.sql` | Comments & version history | 10 |
| `supabase-migration-realtime-collaboration.sql` | Real-time features | 11 |
| `supabase-migration-canvas-templates.sql` | Canvas templates | 12 |
| `supabase-migration-canvas-templates-alter.sql` | Template schema updates | 13 |
| `supabase-migration-canvas-templates-seed.sql` | Default templates | 14 |
| `supabase-migration-advanced-features.sql` | Advanced features | 15 |
| `supabase-migration-webhooks.sql` | Webhook integration | 16 |
| `supabase-migration-public-api.sql` | Public API access | 17 |
| `add-subscription-tiers.sql` | Subscription tier system | 18 |

### Bug Fixes (`fix-*.sql`)
Patches and corrections for specific issues.

- `fix-all-duplicate-policies.sql` - Remove duplicate RLS policies
- `fix-all-tables-policies.sql` - Fix RLS policies across all tables
- `fix-folder-stats-rls.sql` - Fix folder statistics view permissions
- `fix-folders-duplicate-policies.sql` - Remove duplicate folder policies
- `fix-notes-policies.sql` - Fix notes table RLS policies
- `fix-workspace-recursion.sql` - Fix recursive workspace queries
- `final-cleanup-all-policies.sql` - Final RLS policy cleanup

### Diagnostic Scripts (`check-*.sql`, `debug-*.sql`)
Tools for debugging and verification (not migrations).

- `check-and-fix-rls.sql` - Verify and fix RLS policies
- `check-folder-stats-view.sql` - Check folder statistics view
- `check-folders-columns.sql` - Verify folder table schema
- `debug-folders-access.sql` - Debug folder access issues

### Test Data (`test-*.sql`)
Sample data for testing.

- `test-user-data.sql` - Create test user and sample data

## 🚀 Running Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the migration content
4. Run the query
5. Verify the results in the **Table Editor**

### Option 2: Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push

# Or run individual migration
psql $DATABASE_URL < migrations/supabase-migration-personas.sql
```

### Option 3: Command Line (psql)

```bash
# Set your database URL
export DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"

# Run migrations in order
psql $DATABASE_URL < migrations/supabase-migration-personas.sql
psql $DATABASE_URL < migrations/supabase-migration-folders.sql
# ... continue with other migrations
```

## ⚠️ Important Notes

### Migration Order
**Run migrations in the order listed above!** Many migrations depend on tables/functions created in earlier migrations.

### Latest Migration: Subscription Tiers (add-subscription-tiers.sql)

This migration adds subscription tier tracking to the `user_preferences` table.

**What it does:**
- Adds `subscription_tier` column (free/personal/pro/team)
- Adds `subscription_expires_at` and `subscription_started_at` timestamps
- Creates performance index on `subscription_tier`
- Sets existing users to 'free' tier by default

**To run:**
```sql
-- Via Supabase Dashboard SQL Editor:
-- 1. Copy content from add-subscription-tiers.sql
-- 2. Paste into SQL Editor
-- 3. Click "Run"

-- Via psql:
psql $DATABASE_URL < migrations/add-subscription-tiers.sql
```

**To verify:**
```sql
-- Check columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_preferences'
  AND column_name IN ('subscription_tier', 'subscription_expires_at', 'subscription_started_at');

-- Check index was created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'user_preferences'
  AND indexname = 'idx_user_preferences_subscription_tier';

-- Check existing users have default 'free' tier
SELECT subscription_tier, COUNT(*) as user_count
FROM user_preferences
GROUP BY subscription_tier;
```

**Rollback (if needed):**
```sql
-- Remove subscription columns
ALTER TABLE user_preferences 
  DROP COLUMN IF EXISTS subscription_tier,
  DROP COLUMN IF EXISTS subscription_expires_at,
  DROP COLUMN IF EXISTS subscription_started_at;

-- Remove index
DROP INDEX IF EXISTS idx_user_preferences_subscription_tier;
```

### RLS Policies
After running migrations, verify Row-Level Security (RLS) is working:
```sql
-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Should show 'true' for all tables
```

### Common Issues

**Issue: "relation does not exist"**
- Solution: Run earlier migrations first

**Issue: "permission denied for table"**
- Solution: Run `check-and-fix-rls.sql` to fix RLS policies

**Issue: "duplicate policy"**
- Solution: Run `fix-all-duplicate-policies.sql`

**Issue: "function already exists"**
- Solution: Either skip or use `CREATE OR REPLACE FUNCTION`

## 🔄 Rolling Back

To roll back a migration:

1. Backup your database first!
   ```bash
   pg_dump $DATABASE_URL > backup.sql
   ```

2. Manually drop created objects:
   ```sql
   DROP TABLE IF EXISTS table_name CASCADE;
   DROP FUNCTION IF EXISTS function_name CASCADE;
   ```

3. Restore from backup if needed:
   ```bash
   psql $DATABASE_URL < backup.sql
   ```

## 📋 Verification

After running all migrations, verify your setup:

```bash
# Run diagnostics script
npx tsx diagnose-supabase.ts

# Or run verification query in Supabase SQL Editor
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected tables:
- notes
- tags
- note_tags
- folders
- workspaces
- workspace_members
- personas
- canvas
- canvas_templates
- note_links
- note_versions
- comments
- pdf_documents
- webhooks
- webhook_deliveries
- notifications
- user_preferences
- smart_folders

## 🆕 Creating New Migrations

When adding new features:

1. **Create a new migration file:**
   ```bash
   touch migrations/supabase-migration-your-feature.sql
   ```

2. **Include in the migration:**
   - Table creation with proper types
   - RLS policies for security
   - Indexes for performance
   - Functions/triggers if needed
   - Rollback instructions in comments

3. **Test thoroughly:**
   - Test with different user permissions
   - Verify RLS policies work correctly
   - Check performance with indexes
   - Test rollback procedure

4. **Document:**
   - Update this README
   - Add to the migration table above
   - Update [MIGRATION_INSTRUCTIONS.md](../docs/guides/MIGRATION_INSTRUCTIONS.md)

## 📚 Additional Resources

- [Main Migration Guide](../docs/guides/MIGRATION_INSTRUCTIONS.md)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## 🆘 Need Help?

If you encounter issues:

1. Check [MIGRATION_INSTRUCTIONS.md](../docs/guides/MIGRATION_INSTRUCTIONS.md)
2. Run diagnostic scripts in this folder
3. Review Supabase dashboard logs
4. Check GitHub issues for similar problems
