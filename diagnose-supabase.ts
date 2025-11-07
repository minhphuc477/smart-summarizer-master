import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Diagnostic script to test Supabase connection
 * Run with: npx tsx diagnose-supabase.ts
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

async function diagnoseSupabase() {
  console.log('🔍 Supabase Connection Diagnostics');
  console.log('================================\n');

  // Load environment
  loadEnv();

  // Get optional test user ID from command line
  const testUserId = process.argv[2];
  if (testUserId) {
    console.log(`📝 Testing with User ID: ${testUserId}\n`);
  }

  // Check environment variables
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('1. Environment Variables:');
  console.log(`   SUPABASE_URL: ${url ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_ANON_KEY: ${anonKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`   URL value: ${url || 'NOT SET'}`);
  console.log('');

  if (!url || !anonKey) {
    console.error('❌ Missing required environment variables!');
    console.log('\nAdd to .env.local:');
    console.log('NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key');
    process.exit(1);
  }

  // Test URL format
  console.log('2. URL Format:');
  try {
    const urlObj = new URL(url);
    console.log(`   ✅ Valid URL format`);
    console.log(`   Protocol: ${urlObj.protocol}`);
    console.log(`   Hostname: ${urlObj.hostname}`);
  } catch (error) {
    console.log(`   ❌ Invalid URL format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
  console.log('');

  // Test network connectivity
  console.log('3. Network Connectivity:');
  try {
    const response = await fetch(url);
    console.log(`   ✅ Can reach Supabase server`);
    console.log(`   Status: ${response.status}`);
  } catch (error) {
    console.log(`   ❌ Cannot reach server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.log('   Check firewall/network settings');
    process.exit(1);
  }
  console.log('');

  // Test Supabase client creation
  console.log('4. Supabase Client:');
  let supabase;
  try {
    supabase = createClient(url, anonKey);
    console.log('   ✅ Client created successfully');
  } catch (error) {
    console.log(`   ❌ Failed to create client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
  console.log('');

  // Test database query
  console.log('5. Database Connection:');
  try {
    const { error } = await supabase
      .from('notes')
      .select('id', { head: true, count: 'exact' })
      .limit(1);

    if (error) {
      console.log(`   ❌ Database error: ${error.message}`);
      console.log(`   Code: ${error.code || 'N/A'}`);
      console.log(`   Details: ${error.details || 'N/A'}`);
      console.log(`   Hint: ${error.hint || 'N/A'}`);
      
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('\n   💡 Table "notes" does not exist!');
        console.log('   Run database migrations to create tables.');
      } else if (error.message.includes('schema cache')) {
        console.log('\n   💡 Schema cache issue - table might not exist.');
        console.log('   Check Supabase dashboard and run migrations.');
      }
    } else {
      console.log('   ✅ Database query successful');
      console.log(`   Notes table accessible`);
    }
  } catch (error) {
    console.log(`   ❌ Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log('');

  // Test auth session
  console.log('6. Auth Session:');
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.log(`   ⚠️  Auth error: ${error.message}`);
    } else if (session) {
      console.log('   ✅ Active session found');
      console.log(`   User ID: ${session.user.id}`);
    } else {
      console.log('   ℹ️  No active session (expected without login)');
    }
  } catch (error) {
    console.log(`   ❌ Auth check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  console.log('');

  // List available tables
  console.log('7. Available Tables (with RLS check):');
  const tablesToCheck = ['notes', 'folders', 'personas', 'workspaces', 'saved_searches', 'tags', 'templates'];
  
  for (const table of tablesToCheck) {
    try {
      const { error, count } = await supabase
        .from(table)
        .select('*', { head: true, count: 'exact' })
        .limit(1);
      
      if (error) {
        // Check if it's an RLS policy issue vs table missing
        if (error.message.includes('row-level security')) {
          console.log(`   ⚠️  ${table}: RLS blocking access (policies may need auth)`);
        } else if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
          console.log(`   ❌ ${table}: Table does not exist`);
        } else {
          console.log(`   ❌ ${table}: ${error.message}`);
        }
      } else {
        console.log(`   ✅ ${table}: accessible (${count ?? 0} rows)`);
      }
    } catch (error) {
      console.log(`   ❌ ${table}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  console.log('');

  // Test authenticated API endpoints
  if (testUserId) {
    console.log('8. Testing Authenticated API Endpoints:');
    console.log('   (Simulating authenticated requests with userId parameter)');
    const baseUrl = 'http://localhost:3000';
    
    const endpoints = [
      { path: `/api/search/saved?userId=${testUserId}`, name: 'Saved Searches' },
      { path: '/api/templates', name: 'Templates' },
      { path: '/api/folders', name: 'Folders' },
      { path: '/api/personas', name: 'Personas' },
      { path: '/api/workspaces', name: 'Workspaces' },
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint.path}`);
        const _data = await response.text();
        
        if (response.ok) {
          const json = JSON.parse(_data);
          const itemCount = json.items?.length ?? json.folders?.length ?? json.personas?.length ?? json.workspaces?.length ?? json.templates?.length ?? 'N/A';
          console.log(`   ✅ ${endpoint.name}: ${response.status} (items: ${itemCount})`);
        } else if (response.status === 401) {
          console.log(`   🔒 ${endpoint.name}: 401 Unauthorized (needs browser session)`);
        } else {
          console.log(`   ❌ ${endpoint.name}: ${response.status} ${response.statusText}`);
        }
      } catch (_error) {
        console.log(`   ⚠️  ${endpoint.name}: Server not running or network error`);
      }
    }
    console.log('');
  } else {
    console.log('8. Skipping API Endpoint Tests');
    console.log('   (Re-run with user ID to test: npx tsx diagnose-supabase.ts <user-id>)');
    console.log('');
  }

  console.log('================================');
  console.log('Diagnosis Complete!');
  console.log('');
  console.log('Next Steps:');
  console.log('1. If tables have RLS blocking, run: check-and-fix-rls.sql in Supabase SQL Editor');
  console.log('2. If API endpoints return 401, test in browser with Google login');
  console.log('3. Check Supabase dashboard for project status and logs');
  console.log('4. Verify API keys are correct and project is not paused');
  console.log('');
  console.log('Usage:');
  console.log('  npx tsx diagnose-supabase.ts                    # Basic diagnostics');
  console.log('  npx tsx diagnose-supabase.ts <user-id>          # Test with user ID');
  console.log('  npx tsx diagnose-supabase.ts af5616ae-d19b...   # Example with real user');
}

// Run diagnostics
diagnoseSupabase().catch((_error) => {
  console.error('\n❌ Fatal error:', _error);
  process.exit(1);
});
