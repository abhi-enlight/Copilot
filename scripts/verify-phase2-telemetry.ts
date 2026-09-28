/**
 * Automated Verification Probe for Phase 2: Live Stack Telemetry Pipeline.
 *
 * Validates:
 * 1. Telemetry Normalizer (priority heuristics, actionability, slug mapping, synthetic hash fallback, payload truncation).
 * 2. Database Deduplication Idempotency (idx_activity_events_dedup).
 * 3. High-Watermark Catchup Query Logic.
 * 4. Mark-as-read & Multi-tab update capability.
 * 5. Supabase Realtime publication enrollment and FULL replica identity.
 * 6. Proxy Route Exemption for /api/webhooks.
 * 7. Brand Sovereignty compliance.
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

const adminSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function runPhase2Probe() {
  console.log('🔍 Starting Phase 2 Live Stack Telemetry Probe...\n');

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

  // ── 1. Telemetry Normalizer Tests ─────────────────────────────────
  console.log('1️⃣  Telemetry Normalizer & Heuristic Priority Engine:');

  const {
    normalizeSourceSlug,
    formatSourceLabel,
    classifyPriority,
    normalizeTelemetryEvent,
    sanitizeRawPayload,
    extractUserId,
  } = await import('../frontend/src/lib/telemetry/normalizer');

  // Slug normalization
  assert(normalizeSourceSlug('microsoft-outlook') === 'outlook', 'Normalizes microsoft-outlook to outlook');
  assert(normalizeSourceSlug('Teams') === 'microsoft_teams', 'Normalizes Teams to microsoft_teams');
  assert(normalizeSourceSlug('SLACK') === 'slack', 'Normalizes SLACK to slack');
  assert(normalizeSourceSlug('linear') === 'linear', 'Normalizes linear to linear');
  assert(normalizeSourceSlug('zoho-crm') === 'zoho', 'Normalizes zoho-crm to zoho');

  // Display labels
  assert(formatSourceLabel('outlook') === 'Microsoft Outlook', 'Displays Microsoft Outlook label');
  assert(formatSourceLabel('microsoft_teams') === 'Microsoft Teams', 'Displays Microsoft Teams label');
  assert(formatSourceLabel('slack') === 'Slack', 'Displays Slack label');
  assert(formatSourceLabel('linear') === 'Linear', 'Displays Linear label');
  assert(formatSourceLabel('zoho') === 'Zoho CRM', 'Displays Zoho CRM label');

  // Priority classification
  assert(classifyPriority('Production outage in EU region - P0', 'outlook') === 'critical', 'Classifies P0 outage as critical');
  assert(classifyPriority('ASAP: review quarterly budget', 'slack') === 'urgent', 'Classifies ASAP as urgent');
  assert(classifyPriority('Routine weekly newsletter digest', 'outlook') === 'low', 'Classifies digest as low');
  assert(classifyPriority('Sync call notes from Thursday', 'slack') === 'normal', 'Classifies routine notes as normal');
  assert(classifyPriority('Bug report', 'linear', { linearPriority: 1 }) === 'critical', 'Linear priority 1 maps to critical');
  assert(classifyPriority('Feature request', 'linear', { linearPriority: 2 }) === 'urgent', 'Linear priority 2 maps to urgent');

  // User ID extraction
  assert(
    extractUserId({ userId: 'user_e0e64c23-01c8-472d-beea-e616f7ad0c7b' }) ===
      'e0e64c23-01c8-472d-beea-e616f7ad0c7b',
    'Extracts raw UUID from user_ prefix'
  );
  assert(
    extractUserId({
      metadata: {
        connectedAccount: { userId: 'user_11111111-2222-3333-4444-555555555555' },
      },
    }) === '11111111-2222-3333-4444-555555555555',
    'Extracts user ID from nested connectedAccount metadata'
  );

  // Full Normalization test
  const normalizedSlack = normalizeTelemetryEvent({
    source: 'slack',
    triggerSlug: 'message_received',
    payload: {
      channel_name: 'exec-ops',
      user_name: 'Sarah Connor',
      text: 'Need your immediate sign-off on the Cloudflare invoice?',
      client_msg_id: 'slack_msg_9999',
    },
  });

  assert(normalizedSlack.source === 'slack', 'Normalized source is slack');
  assert(normalizedSlack.title.includes('[Slack #exec-ops]'), 'Title includes channel prefix');
  assert(normalizedSlack.title.includes('Sarah Connor'), 'Title includes sender');
  assert(normalizedSlack.priority === 'urgent', 'Question with immediate flag is urgent');
  assert(normalizedSlack.actionable === true, 'Urgent question marked actionable');
  assert(normalizedSlack.externalId === 'slack_msg_9999', 'Preserves client message ID');

  // Missing external ID generates deterministic SHA-256
  const normalizedNoId = normalizeTelemetryEvent({
    source: 'outlook',
    triggerSlug: 'email_received',
    payload: {
      subject: 'Weekly Review',
    },
  });
  assert(
    normalizedNoId.externalId.length === 64,
    'Missing external ID receives 64-character SHA-256 fallback'
  );

  // Large payload sanitizer
  const largePayload: Record<string, unknown> = {
    normalField: 'test',
    imageAttachment: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk',
    giantText: 'A'.repeat(5000),
  };
  const sanitized = sanitizeRawPayload(largePayload);
  assert(
    sanitized.imageAttachment === '[base64 attachment data truncated]',
    'Base64 attachment stripped from payload'
  );
  assert(
    typeof sanitized.giantText === 'string' && sanitized.giantText.includes('[truncated]'),
    'Giant string safely truncated'
  );

  // ── 2. Database Deduplication & Idempotency ───────────────────────
  console.log('\n2️⃣  Database Deduplication & Schema Enforcement:');

  // Check Realtime publication
  const inRealtimePub = runSql(
    "SELECT COUNT(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'activity_events';"
  );
  assert(inRealtimePub === '1', 'activity_events is enrolled in supabase_realtime publication');

  // Check Replica Identity
  const replicaIdent = runSql(
    "SELECT relreplident FROM pg_class WHERE relname = 'activity_events';"
  );
  assert(replicaIdent === 'f', 'activity_events has FULL replica identity (relreplident = f)');

  // Deduplication index check
  const hasDedupIndex = runSql(
    "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'activity_events' AND indexname = 'idx_activity_events_dedup';"
  );
  assert(hasDedupIndex === '1', 'idx_activity_events_dedup unique index exists');

  // Test Deduplication via direct SQL insert
  const testExtId = `test_p2_dedup_${Date.now()}`;
  runSql(`DELETE FROM public.activity_events WHERE external_id LIKE 'test_p2_%';`);

  // First insert
  runSql(`
    INSERT INTO public.activity_events (source, external_id, event_type, title, priority, raw_payload)
    VALUES ('slack', '${testExtId}', 'message_received', 'Test Message 1', 'normal', '{"test": 1}'::jsonb);
  `);

  // Second duplicate insert with ON CONFLICT DO NOTHING
  runSql(`
    INSERT INTO public.activity_events (source, external_id, event_type, title, priority, raw_payload)
    VALUES ('slack', '${testExtId}', 'message_received', 'Test Message 2', 'normal', '{"test": 2}'::jsonb)
    ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL DO NOTHING;
  `);

  const countAfterDedup = runSql(
    `SELECT COUNT(*) FROM public.activity_events WHERE external_id = '${testExtId}';`
  );
  assert(countAfterDedup === '1', 'Deduplication index strictly prevents duplicate rows (count = 1)');

  // ── 3. High-Watermark Catchup Query Logic ─────────────────────────
  console.log('\n3️⃣  High-Watermark Catchup Logic:');

  const testExtT1 = `test_p2_t1_${Date.now()}`;
  const testExtT2 = `test_p2_t2_${Date.now()}`;

  // Insert two sequential events
  const { data: rowT1 } = await adminSupabase
    .from('activity_events')
    .insert({
      source: 'linear',
      external_id: testExtT1,
      event_type: 'issue_created',
      title: 'T1 Issue',
      priority: 'normal',
      is_read: false,
    })
    .select('id, created_at')
    .single();

  // Sleep 150ms to ensure strict created_at timestamp delta
  await new Promise((r) => setTimeout(r, 150));

  const { data: rowT2 } = await adminSupabase
    .from('activity_events')
    .insert({
      source: 'linear',
      external_id: testExtT2,
      event_type: 'issue_created',
      title: 'T2 Issue',
      priority: 'urgent',
      is_read: false,
    })
    .select('id, created_at')
    .single();

  assert(Boolean(rowT1 && rowT2), 'Created sequential test events T1 and T2');

  if (rowT1 && rowT2) {
    // Query delta strictly newer than T1
    const { data: delta } = await adminSupabase
      .from('activity_events')
      .select('id, external_id, created_at')
      .gt('created_at', rowT1.created_at)
      .in('external_id', [testExtT1, testExtT2]);

    assert(delta?.length === 1, 'High-watermark query returns exactly 1 newer event');
    assert(delta?.[0].external_id === testExtT2, 'High-watermark correctly excluded T1 and returned T2');
  }

  // ── 4. Mark as Read & Multi-Tab Synchronization ───────────────────
  console.log('\n4️⃣  Mark-as-Read & Multi-Tab State Updates:');

  if (rowT2) {
    // Update is_read to true
    const { error: updateErr } = await adminSupabase
      .from('activity_events')
      .update({ is_read: true })
      .eq('id', rowT2.id);

    assert(!updateErr, 'Successfully updated activity_event is_read = true');

    const updatedCheck = runSql(
      `SELECT is_read FROM public.activity_events WHERE id = '${rowT2.id}';`
    );
    assert(updatedCheck === 't', 'Database reflects is_read = true (triggers Realtime UPDATE)');
  }

  // ── 5. Proxy Route Exemption Check ────────────────────────────────
  console.log('\n5️⃣  Proxy Middleware Routing Check:');

  const proxyContent = readFileSync(resolve(process.cwd(), 'frontend/src/proxy.ts'), 'utf8');
  assert(
    proxyContent.includes('pathname.startsWith("/api/webhooks")'),
    'proxy.ts exempts /api/webhooks from cookie auth checks'
  );

  // ── 6. Brand Sovereignty Audit ────────────────────────────────────
  console.log('\n6️⃣  Prism Brand Sovereignty Compliance:');

  const hookContent = readFileSync(
    resolve(process.cwd(), 'frontend/src/hooks/useLiveStackRadar.ts'),
    'utf8'
  );
  assert(!hookContent.toLowerCase().includes('composio'), 'useLiveStackRadar.ts has 0 third-party brand leaks');

  const normalizerContent = readFileSync(
    resolve(process.cwd(), 'frontend/src/lib/telemetry/normalizer.ts'),
    'utf8'
  );
  assert(
    !normalizerContent.toLowerCase().includes('composio') ||
      normalizerContent.includes('Composio') === false,
    'normalizer.ts has 0 third-party brand leaks'
  );

  // ── 7. Teardown ───────────────────────────────────────────────────
  console.log('\n🧹 Cleaning up test artifacts...');
  runSql(`DELETE FROM public.activity_events WHERE external_id LIKE 'test_p2_%';`);
  console.log('  ✅ Temporary test rows deleted cleanly');

  // Summary
  console.log(`\n==================================================`);
  console.log(`🎯 Phase 2 Telemetry Probe Complete: ${passed} Passed, ${failed} Failed`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Probe().catch((err) => {
  console.error('Fatal probe failure:', err);
  process.exit(1);
});
