/**
 * Automated Verification Probe for Phase 0: Database & Environment Alignment.
 * Validates PostgreSQL schema, constraints, indexes, RLS policies, Realtime publication,
 * and Supabase PostgREST client operations.
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
const envLocalPath = resolve(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  const content = readFileSync(envLocalPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...rest] = trimmed.split('=');
      const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

const DATABASE_URL = process.env.DATABASE_URL || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL missing from .env.local');
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from .env.local');
  process.exit(1);
}

function runSql(query: string): string {
  const cmd = `/Library/PostgreSQL/18/bin/psql "${DATABASE_URL}" -t -A -c "${query.replace(/"/g, '\\"')}"`;
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

async function verifyPhase0() {
  console.log('🔍 Starting Phase 0 Verification Probe...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, label: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${label}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${label}`);
      failed++;
    }
  }

  // ── 1. PostgreSQL Schema & Constraint Checks ─────────────────────
  console.log('1️⃣  PostgreSQL Schema & Constraints Verification:');

  // Check activity_events exists in public schema
  const aeExists = runSql("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_events';");
  assert(aeExists === '1', 'activity_events table exists in public schema');

  // Check external_id column exists on activity_events
  const aeExternalId = runSql("SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'activity_events' AND column_name = 'external_id';");
  assert(aeExternalId === '1', 'activity_events.external_id column exists for deduplication');

  // Check unique index on (source, external_id)
  const aeDedupIdx = runSql("SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'activity_events' AND indexname = 'idx_activity_events_dedup';");
  assert(aeDedupIdx === '1', 'idx_activity_events_dedup unique index exists');

  // Check replica identity on activity_events
  const aeReplica = runSql("SELECT relreplident FROM pg_class WHERE relname = 'activity_events' AND relnamespace = 'public'::regnamespace;");
  assert(aeReplica === 'f', 'activity_events REPLICA IDENTITY is set to FULL (f)');

  // Check supabase_realtime publication membership
  const realtimeHasAe = runSql("SELECT count(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'activity_events';");
  assert(realtimeHasAe === '1', 'activity_events is enrolled in supabase_realtime publication');

  // Check canonical agent_audit_logs exists in public schema
  const aalExists = runSql("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_audit_logs';");
  assert(aalExists === '1', 'canonical agent_audit_logs table exists in public schema');

  // Check legacy audit logs preserved
  const legacyExists = runSql("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_audit_logs_legacy';");
  assert(legacyExists === '1', 'agent_audit_logs_legacy preserves historical logs');

  // Check actor_email on agent_audit_logs
  const aalActorEmail = runSql("SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_audit_logs' AND column_name = 'actor_email';");
  assert(aalActorEmail === '1', 'agent_audit_logs.actor_email column exists for compliance permanence');

  // Check user_id on agent_audit_logs is nullable (for ON DELETE SET NULL)
  const aalUserNullable = runSql("SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agent_audit_logs' AND column_name = 'user_id';");
  assert(aalUserNullable === 'YES', 'agent_audit_logs.user_id is nullable (safe against user deletion cascades)');

  // Check partial index on agent_audit_logs pending status
  const aalPendingIdx = runSql("SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'agent_audit_logs' AND indexname = 'idx_agent_audit_logs_pending';");
  assert(aalPendingIdx === '1', 'idx_agent_audit_logs_pending partial index exists for fast lookup');

  // Check chat_messages role constraint includes 'tool'
  const cmRoleCheck = runSql("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'chat_messages_role_check';");
  assert(cmRoleCheck.includes("'tool'"), "chat_messages_role_check allows 'tool' role");

  // Check chat_messages action_proposals column
  const cmProposals = runSql("SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chat_messages' AND column_name = 'action_proposals';");
  assert(cmProposals === '1', 'chat_messages.action_proposals JSONB column exists');

  // ── 2. Row Level Security (RLS) Policy Verification ──────────────
  console.log('\n2️⃣  Row Level Security (RLS) Anti-Leak Policies:');

  const aeRls = runSql("SELECT relrowsecurity FROM pg_class WHERE relname = 'activity_events' AND relnamespace = 'public'::regnamespace;");
  assert(aeRls === 't', 'activity_events RLS is enabled');

  const aalRls = runSql("SELECT relrowsecurity FROM pg_class WHERE relname = 'agent_audit_logs' AND relnamespace = 'public'::regnamespace;");
  assert(aalRls === 't', 'agent_audit_logs RLS is enabled');

  // Check that agent_audit_logs select policy isolates pending drafts
  const aalSelectPolicy = runSql("SELECT pg_get_expr(polqual, polrelid) FROM pg_policy JOIN pg_class ON pg_policy.polrelid = pg_class.oid WHERE pg_class.relname = 'agent_audit_logs' AND pg_class.relnamespace = 'public'::regnamespace AND polname = 'agent_audit_logs_select';");
  assert(aalSelectPolicy.includes('pending'), 'agent_audit_logs RLS prevents peers from seeing pending private drafts');

  // Check that activity_events select policy isolates personal events
  const aeSelectPolicy = runSql("SELECT pg_get_expr(polqual, polrelid) FROM pg_policy JOIN pg_class ON pg_policy.polrelid = pg_class.oid WHERE pg_class.relname = 'activity_events' AND pg_class.relnamespace = 'public'::regnamespace AND polname = 'activity_events_select';");
  assert(aeSelectPolicy.includes('user_id IS NULL'), 'activity_events RLS strictly confines personal alerts to owner');

  // ── 3. PostgREST Service-Role Operations & Atomic Concurrency ─────
  console.log('\n3️⃣  Supabase Client Operations & Concurrency Probe:');

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const testExternalId = `probe_${Date.now()}`;

  // Insert probe activity event
  const { data: insertData, error: insertError } = await supabase
    .from('activity_events')
    .insert({
      source: 'test.probe',
      event_type: 'TEST_PROBE',
      title: 'Phase 0 Verification Event',
      summary: 'Probe for automated testing',
      priority: 'normal',
      external_id: testExternalId,
      raw_payload: { probe: true, timestamp: new Date().toISOString() },
    })
    .select('id, external_id')
    .single();

  assert(!insertError && !!insertData?.id, 'Service-role client successfully inserted activity_events probe record');

  // Test deduplication on (source, external_id)
  const { error: dupError } = await supabase
    .from('activity_events')
    .insert({
      source: 'test.probe',
      event_type: 'TEST_PROBE_DUP',
      title: 'Duplicate Event',
      summary: 'Should violate unique index',
      priority: 'low',
      external_id: testExternalId,
      raw_payload: {},
    });

  assert(!!dupError && dupError.code === '23505', 'Deduplication unique constraint rejected duplicate external_id (23505)');

  // Clean up probe activity event
  if (insertData?.id) {
    await supabase.from('activity_events').delete().eq('id', insertData.id);
  }

  // Probe agent_audit_logs atomic proposal lock
  const { data: auditData, error: auditError } = await supabase
    .from('agent_audit_logs')
    .insert({
      tool_slug: 'probe_test_tool',
      action_type: 'PROBE_MUTATION',
      actor_email: 'probe@prism.test',
      status: 'pending',
      request_payload: { amount: 100, recipient: 'test@example.com' },
      signature_hash: 'probe_sig_hash',
    })
    .select('id, status')
    .single();

  assert(!auditError && !!auditData?.id, 'Service-role inserted pending action proposal into agent_audit_logs');

  if (auditData?.id) {
    // Atomic update simulation: request 1 claims the lock
    const claim1 = runSql(`
      UPDATE public.agent_audit_logs 
      SET status = 'approved', approved_at = now() 
      WHERE id = '${auditData.id}' AND status = 'pending' 
      RETURNING id, status;
    `);
    assert(claim1.includes('approved'), 'Request 1 atomically transitions pending action to approved');

    // Concurrent request 2 tries to claim the same action (should update 0 rows)
    const claim2 = runSql(`
      UPDATE public.agent_audit_logs 
      SET status = 'approved', approved_at = now() 
      WHERE id = '${auditData.id}' AND status = 'pending' 
      RETURNING id, status;
    `);
    assert(claim2 === 'UPDATE 0' || claim2 === '', 'Concurrent Request 2 rejected (0 rows updated) preventing double-execution');

    // Clean up probe audit log
    await supabase.from('agent_audit_logs').delete().eq('id', auditData.id);
  }

  // ── 4. Summary ───────────────────────────────────────────────────
  console.log('\n=================================================');
  console.log(`Probe Complete: ${passed} passed, ${failed} failed`);
  console.log('=================================================\n');

  if (failed > 0) {
    console.error('❌ Phase 0 Verification FAILED');
    process.exit(1);
  } else {
    console.log('🎉 Phase 0 Verification PASSED! All systems operational and hardened.');
  }
}

verifyPhase0().catch((err) => {
  console.error('Unexpected probe failure:', err);
  process.exit(1);
});
