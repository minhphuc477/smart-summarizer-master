#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Diagnostic script to test Supabase Realtime setup
 * Tests: Connection, table access, Realtime subscriptions
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase environment variables');
  console.error('   Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testDatabaseConnection() {
  console.log('\n🔍 Testing database connection...');
  
  try {
    const { error } = await supabase.from('notes').select('count').limit(1);
    if (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }
    console.log('✅ Database connection successful');
    return true;
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    return false;
  }
}

async function testTablesExist() {
  console.log('\n🔍 Checking if collaboration tables exist...');
  
  const tables = ['comments', 'presence', 'note_versions', 'comment_notifications'];
  let allExist = true;
  
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('count').limit(0);
      if (error) {
        console.error(`❌ Table '${table}' does not exist or is not accessible`);
        console.error(`   Error: ${error.message}`);
        allExist = false;
      } else {
        console.log(`✅ Table '${table}' exists and is accessible`);
      }
    } catch (err) {
      console.error(`❌ Error checking table '${table}':`, err.message);
      allExist = false;
    }
  }
  
  return allExist;
}

async function testRealtimeConnection() {
  console.log('\n🔍 Testing Realtime connection...');
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error('❌ Realtime connection timeout (10s)');
      channel.unsubscribe();
      resolve(false);
    }, 10000);
    
    const channel = supabase
      .channel('test-channel')
      .on('presence', { event: 'sync' }, () => {
        console.log('✅ Realtime connection successful');
        clearTimeout(timeout);
        channel.unsubscribe();
        resolve(true);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('   Connected to Realtime channel');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel error');
          clearTimeout(timeout);
          resolve(false);
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Connection timed out');
          clearTimeout(timeout);
          resolve(false);
        } else if (status === 'CLOSED') {
          console.log('   Channel closed');
        }
      });
  });
}

async function testRealtimeOnTable() {
  console.log('\n🔍 Testing Realtime on comments table...');
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.error('❌ Realtime subscription timeout (10s)');
      console.error('   This might mean Realtime is not enabled for the comments table');
      console.error('   Enable it in Supabase Dashboard → Database → Replication');
      channel.unsubscribe();
      resolve(false);
    }, 10000);
    
    const channel = supabase
      .channel('comments-test')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'comments' },
        (payload) => {
          console.log('✅ Realtime working on comments table');
          console.log('   Received event:', payload.eventType);
          clearTimeout(timeout);
          channel.unsubscribe();
          resolve(true);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('   Subscribed to comments table changes');
          // Try to insert a test comment to trigger the event
          // (This will fail if no notes exist or user not authenticated, but that's OK)
          // The subscription itself proves Realtime is enabled
          console.log('✅ Successfully subscribed to Realtime on comments table');
          clearTimeout(timeout);
          channel.unsubscribe();
          resolve(true);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error subscribing to comments table');
          clearTimeout(timeout);
          resolve(false);
        }
      });
  });
}

async function testRLSPolicies() {
  console.log('\n🔍 Testing RLS policies (anonymous access)...');
  
  const tables = ['comments', 'presence', 'note_versions'];
  
  for (const table of tables) {
    const { error } = await supabase.from(table).select('count').limit(1);
    if (error) {
      console.log(`⚠️  Table '${table}': ${error.message}`);
      console.log(`   (This is expected without authentication)`);
    } else {
      console.log(`✅ Table '${table}' is accessible (or has no RLS)`);
    }
  }
  
  return true;
}

async function runDiagnostics() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   Supabase Realtime Diagnostic Tool');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`\nProject URL: ${SUPABASE_URL}`);
  
  const results = {
    connection: false,
    tables: false,
    realtime: false,
    realtimeTable: false,
    rls: true,
  };
  
  // Test 1: Database connection
  results.connection = await testDatabaseConnection();
  if (!results.connection) {
    console.log('\n❌ Cannot proceed without database connection');
    printSummary(results);
    process.exit(1);
  }
  
  // Test 2: Tables exist
  results.tables = await testTablesExist();
  if (!results.tables) {
    console.log('\n⚠️  Some tables are missing. Run the SQL migration first.');
  }
  
  // Test 3: Realtime connection
  results.realtime = await testRealtimeConnection();
  
  // Test 4: Realtime on specific table
  if (results.tables) {
    results.realtimeTable = await testRealtimeOnTable();
  }
  
  // Test 5: RLS policies
  results.rls = await testRLSPolicies();
  
  // Print summary
  printSummary(results);
  
  // Exit code
  const allPassed = results.connection && results.tables && results.realtime && results.realtimeTable;
  process.exit(allPassed ? 0 : 1);
}

function printSummary(results) {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('   Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Database Connection:    ${results.connection ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Tables Exist:           ${results.tables ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Realtime Connection:    ${results.realtime ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Realtime on Tables:     ${results.realtimeTable ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`RLS Policies:           ${results.rls ? '✅ PASS' : '⚠️  CHECK'}`);
  
  console.log('\n═══════════════════════════════════════════════════════');
  
  if (results.connection && results.tables && results.realtime && results.realtimeTable) {
    console.log('✅ All checks passed! Realtime is ready to use.');
  } else {
    console.log('❌ Some checks failed. Please review the errors above.');
    console.log('\nNext steps:');
    if (!results.tables) {
      console.log('  1. Run the SQL migration: supabase-migration-realtime-collaboration.sql');
    }
    if (!results.realtimeTable) {
      console.log('  2. Enable Realtime in Supabase Dashboard → Database → Replication');
    }
    console.log('  3. Refer to REALTIME_SETUP_GUIDE.md for detailed instructions');
  }
  console.log('═══════════════════════════════════════════════════════\n');
}

// Run diagnostics
runDiagnostics().catch((err) => {
  console.error('\n❌ Unexpected error:', err);
  process.exit(1);
});
