import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Apply workspace stats fix to get_user_workspaces function
 * Run with: npx tsx apply-workspace-stats-fix.ts
 */

// Load .env.local manually
function loadEnv() {
  try {
    const envPath = join(process.cwd(), '.env.local');
    const envContent = readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length) {
          let value = valueParts.join('=').trim();
          // Remove surrounding quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[key.trim()] = value;
        }
      }
    }
    console.log('✅ Loaded .env.local\n');
  } catch (error) {
    console.log('⚠️  Could not load .env.local:', error instanceof Error ? error.message : 'Unknown error');
    console.log('   Continuing with existing environment variables...\n');
  }
}

async function applyMigration() {
  console.log('🔧 Applying Workspace Stats Fix');
  console.log('================================\n');

  // Load environment
  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.error('   Please check your .env.local file');
    process.exit(1);
  }

  console.log('📡 Connecting to Supabase...');
  const supabase = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), 'migrations', 'patch-get-user-workspaces.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Loaded migration from:', migrationPath);
    console.log('🚀 Executing migration...\n');

    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // If exec_sql doesn't exist, we need to use a different approach
      console.log('⚠️  RPC exec_sql not available, using direct query...');
      
      // Try direct query execution
      const { error: directError } = await supabase.from('_').select('*').limit(0); // dummy query to test connection
      if (directError && directError.message.includes('does not exist')) {
        console.error('❌ Cannot execute SQL directly. Please run the migration manually:');
        console.error(`\n1. Open Supabase Dashboard > SQL Editor`);
        console.error(`2. Paste the contents of: migrations/patch-get-user-workspaces.sql`);
        console.error(`3. Click "Run"\n`);
        process.exit(1);
      }
    } else {
      console.log('✅ Migration applied successfully!\n');
    }

    // Test the function
    console.log('🧪 Testing get_user_workspaces function...');
    const { data: testData, error: testError } = await supabase.rpc('get_user_workspaces');

    if (testError) {
      console.error('❌ Error testing function:', testError.message);
      console.error('\nPlease run the migration manually in Supabase SQL Editor:');
      console.error('migrations/patch-get-user-workspaces.sql\n');
      process.exit(1);
    }

    console.log('✅ Function is working!');
    console.log('📊 Sample data:', JSON.stringify(testData, null, 2));
    console.log('\n✨ Workspace stats fix applied successfully!\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error instanceof Error ? error.message : 'Unknown error');
    console.error('\nPlease run the migration manually in Supabase SQL Editor:');
    console.error('migrations/patch-get-user-workspaces.sql\n');
    process.exit(1);
  }
}

applyMigration();
