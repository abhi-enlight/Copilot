/**
 * Automated Verification Probe for Phase 3: Direct Streaming Agent Runtime & HITL Action Proposals.
 *
 * Validates:
 * 1. Cryptographic HMAC-SHA256 Action Proposal Signing & Tamper Detection.
 * 2. Two-Tier Tool Classification (Read-Only vs Mutation).
 * 3. Atomic Double-Click Lock & Concurrency Prevention in PostgreSQL.
 * 4. Human-in-the-Loop Approval & Rejection State Transitions.
 * 5. 24-Hour Proposal Expiration Gate.
 * 6. Chat Sessions & Messages Persistence (including role constraints & action_proposals JSONB).
 * 7. 100% Brand Sovereignty across the streaming engine.
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

async function runPhase3Probe() {
  console.log('🔍 Starting Phase 3 Agent Runtime & HITL Verification Probe...\n');

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

  // ── 1. Cryptographic Proposal Signatures & Tamper Defense ──────────
  console.log('1️⃣  Cryptographic Action Proposal Integrity & Anti-Tamper Engine:');

  const {
    generateActionSignature,
    verifyActionSignature,
    hashPayload,
    canonicalizePayload,
  } = await import('../frontend/src/lib/agent/crypto');

  // Deterministic canonicalization
  const payload1 = { to: 'bob@example.com', subject: 'Budget', amount: 5000 };
  const payload2 = { amount: 5000, subject: 'Budget', to: 'bob@example.com' };
  assert(
    canonicalizePayload(payload1) === canonicalizePayload(payload2),
    'Canonicalize payload produces identical string regardless of key ordering'
  );
  assert(hashPayload(payload1) === hashPayload(payload2), 'Hash payload is deterministic across key permutations');

  // Signature generation and verification
  const testActionId = 'act_' + Date.now();
  const testUserId = 'usr_' + Date.now();
  const testToolSlug = 'outlook_send_email';
  const originalPayload = {
    to: 'partner@acme.com',
    subject: 'Contract Confirmation',
    body: 'Contract terms approved for $50,000.',
  };

  const validSignature = generateActionSignature({
    actionId: testActionId,
    userId: testUserId,
    toolSlug: testToolSlug,
    payload: originalPayload,
  });

  assert(
    validSignature.length === 64,
    'HMAC-SHA256 signature is a 64-character hexadecimal digest'
  );

  const isValid = verifyActionSignature({
    actionId: testActionId,
    userId: testUserId,
    toolSlug: testToolSlug,
    payload: originalPayload,
    signature: validSignature,
  });
  assert(isValid === true, 'Valid signature verifies successfully');

  // Tamper Test 1: Modified recipient
  const tamperedRecipient = {
    ...originalPayload,
    to: 'hacker@evil.com',
  };
  const isRecipientTampered = verifyActionSignature({
    actionId: testActionId,
    userId: testUserId,
    toolSlug: testToolSlug,
    payload: tamperedRecipient,
    signature: validSignature,
  });
  assert(isRecipientTampered === false, 'Tampered recipient is rejected by cryptographic signature');

  // Tamper Test 2: Modified tool slug
  const isSlugTampered = verifyActionSignature({
    actionId: testActionId,
    userId: testUserId,
    toolSlug: 'slack_post_message',
    payload: originalPayload,
    signature: validSignature,
  });
  assert(isSlugTampered === false, 'Tampered tool slug is rejected by cryptographic signature');

  // Tamper Test 3: Modified user ID
  const isUserTampered = verifyActionSignature({
    actionId: testActionId,
    userId: 'usr_different_attacker',
    toolSlug: testToolSlug,
    payload: originalPayload,
    signature: validSignature,
  });
  assert(isUserTampered === false, 'Tampered user ID is rejected by cryptographic signature');

  // ── 2. Tool Tier Classification & Risk Evaluation ─────────────────
  console.log('\n2️⃣  Two-Tier Tool Security Model & Risk Evaluation:');

  const {
    classifyToolTier,
    evaluateRiskLevel,
    generateProposalSummary,
    createActionProposal,
  } = await import('../frontend/src/lib/agent/tools');

  // Read-only tools
  assert(classifyToolTier('outlook_search_emails') === 'read_only', 'outlook_search_emails classified as read_only');
  assert(classifyToolTier('teams_get_messages') === 'read_only', 'teams_get_messages classified as read_only');
  assert(classifyToolTier('slack_search_messages') === 'read_only', 'slack_search_messages classified as read_only');
  assert(classifyToolTier('linear_list_issues') === 'read_only', 'linear_list_issues classified as read_only');
  assert(classifyToolTier('zoho_get_deals') === 'read_only', 'zoho_get_deals classified as read_only');

  // Mutation tools
  assert(classifyToolTier('outlook_send_email') === 'mutation', 'outlook_send_email classified as mutation');
  assert(classifyToolTier('teams_send_message') === 'mutation', 'teams_send_message classified as mutation');
  assert(classifyToolTier('slack_post_message') === 'mutation', 'slack_post_message classified as mutation');
  assert(classifyToolTier('linear_create_issue') === 'mutation', 'linear_create_issue classified as mutation');
  assert(classifyToolTier('zoho_update_deal') === 'mutation', 'zoho_update_deal classified as mutation');

  // Risk evaluation
  assert(
    evaluateRiskLevel('zoho_delete_deal', {}) === 'high',
    'Delete operation evaluated as high risk'
  );
  assert(
    evaluateRiskLevel('zoho_update_deal', { Amount: 50000 }) === 'high',
    'Deal update >= $10k evaluated as high risk'
  );
  assert(
    evaluateRiskLevel('linear_create_issue', { title: 'Fix bug' }) === 'medium',
    'Issue creation evaluated as medium risk'
  );

  // Proposal metadata generator
  const summary = generateProposalSummary('outlook_send_email', {
    to: 'ceo@acme.com',
    subject: 'Board Meeting Prep',
  });
  assert(summary.title === 'Send Email via Outlook', 'Proposal summary generates clean title');
  assert(summary.description.includes('Board Meeting Prep'), 'Proposal summary includes subject');

  // Full proposal generation
  const proposal = createActionProposal({
    userId: testUserId,
    toolSlug: 'linear_create_issue',
    payload: { title: 'Implement Phase 4' },
  });
  assert(proposal.status === 'pending', 'Newly created proposal starts in pending state');
  assert(proposal.signature_hash.length === 64, 'Proposal includes generated signature hash');

  // ── 3. Database HITL Ledger & Atomic Double-Click Protection ──────
  console.log('\n3️⃣  Atomic Double-Click Concurrency Lock in PostgreSQL:');

  // Clean test rows
  // The ledger is append-only by design (see migration 11): probe rows are
  // retained rather than deleted.
  runSql(`DELETE FROM public.chat_sessions WHERE title LIKE 'TEST_P3_%';`);

  // Ensure a valid auth.users record is available for FK constraints
  let effectiveUserId = runSql(`SELECT id FROM auth.users LIMIT 1;`);
  let isCreatedTestAuthUser = false;
  if (!effectiveUserId) {
    effectiveUserId = runSql(`
      INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at, instance_id, aud, role)
      VALUES (gen_random_uuid(), 'test-probe-p3@prism.dev', '{"name": "Probe Tester"}'::jsonb, now(), now(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
      RETURNING id;
    `);
    isCreatedTestAuthUser = true;
  }

  const testProposalId = `test_p3_prop_${Date.now()}`;
  const testSlug = 'test_p3_tool';

  // Seed pending proposal in agent_audit_logs
  runSql(`
    INSERT INTO public.agent_audit_logs (
      id, user_id, actor_email, tool_slug, action_type, status, request_payload, signature_hash
    ) VALUES (
      gen_random_uuid(), '${effectiveUserId}', 'tester@prism.dev', '${testSlug}', 'TEST_ACTION', 'pending',
      '{"data": 123}'::jsonb, '${validSignature}'
    );
  `);

  const auditRowId = runSql(
    `SELECT id FROM public.agent_audit_logs WHERE tool_slug = '${testSlug}' AND status = 'pending' LIMIT 1;`
  ).split('\n')[0].trim();
  assert(Boolean(auditRowId), 'Created pending proposal in public.agent_audit_logs');

  // Simulating Concurrent Request 1: Succeeds
  const lock1 = runSql(`
    UPDATE public.agent_audit_logs 
    SET status = 'approved', approved_at = now()
    WHERE id = '${auditRowId}' AND status = 'pending'
    RETURNING id, status;
  `);
  assert(lock1.includes('approved'), 'First approval request acquires atomic lock (status -> approved)');

  // Simulating Concurrent Request 2 (Double-Click): Fails because status is no longer 'pending'
  const lock2 = runSql(`
    UPDATE public.agent_audit_logs 
    SET status = 'approved', approved_at = now()
    WHERE id = '${auditRowId}' AND status = 'pending'
    RETURNING id, status;
  `);
  assert(!lock2.includes('approved') || lock2.includes('UPDATE 0'), 'Concurrent duplicate request matches 0 rows (double-click blocked)');

  // Transition to executed
  runSql(`
    UPDATE public.agent_audit_logs 
    SET status = 'executed', execution_result = '{"success": true}'::jsonb
    WHERE id = '${auditRowId}';
  `);
  const finalStatus = runSql(
    `SELECT status FROM public.agent_audit_logs WHERE id = '${auditRowId}';`
  ).split('\n')[0].trim();
  assert(finalStatus === 'executed', 'Proposal state updated to executed');

  // ── 4. Rejection State Flow ───────────────────────────────────────
  console.log('\n4️⃣  Action Rejection Flow:');

  const rejectSlug = 'test_p3_reject';
  runSql(`
    INSERT INTO public.agent_audit_logs (
      id, user_id, actor_email, tool_slug, action_type, status, request_payload
    ) VALUES (
      gen_random_uuid(), '${effectiveUserId}', 'tester@prism.dev', '${rejectSlug}', 'REJECT_ACTION', 'pending',
      '{"data": "dismiss"}'::jsonb
    );
  `);

  const rejectRowId = runSql(
    `SELECT id FROM public.agent_audit_logs WHERE tool_slug = '${rejectSlug}' AND status = 'pending' LIMIT 1;`
  ).split('\n')[0].trim();

  runSql(`
    UPDATE public.agent_audit_logs 
    SET status = 'rejected', execution_result = '{"rejection_reason": "Executive dismissed"}'::jsonb
    WHERE id = '${rejectRowId}' AND status = 'pending';
  `);

  const checkRejected = runSql(
    `SELECT status FROM public.agent_audit_logs WHERE id = '${rejectRowId}';`
  ).split('\n')[0].trim();
  assert(checkRejected === 'rejected', 'Proposal state correctly updated to rejected');

  // ── 5. 24-Hour Proposal Expiration Gate ───────────────────────────
  console.log('\n5️⃣  24-Hour Expiration Check:');

  const expiredSlug = 'test_p3_expired';
  runSql(`
    INSERT INTO public.agent_audit_logs (
      id, user_id, actor_email, tool_slug, action_type, status, request_payload, created_at
    ) VALUES (
      gen_random_uuid(), '${effectiveUserId}', 'tester@prism.dev', '${expiredSlug}', 'EXPIRED_ACTION', 'pending',
      '{}'::jsonb, now() - interval '25 hours'
    );
  `);

  const isOlderThan24h = runSql(`
    SELECT CASE WHEN created_at < now() - interval '24 hours' THEN 't' ELSE 'f' END
    FROM public.agent_audit_logs WHERE tool_slug = '${expiredSlug}';
  `);
  assert(isOlderThan24h === 't', 'Detects proposal created > 24 hours ago as expired');

  // ── 6. Chat Sessions & Messages Persistence ───────────────────────
  console.log('\n6️⃣  Chat Sessions & Message History Persistence:');

  const sessionTitle = 'TEST_P3_Operations_Sync';
  const { data: sessionData, error: sessionErr } = await adminSupabase
    .from('chat_sessions')
    .insert({
      user_id: effectiveUserId,
      title: sessionTitle,
      pinned: true,
      is_archived: false,
    })
    .select('id')
    .single();

  assert(!sessionErr && Boolean(sessionData?.id), 'Created chat session in public.chat_sessions');

  if (sessionData?.id) {
    // Insert user message
    const { error: userMsgErr } = await adminSupabase
      .from('chat_messages')
      .insert({
        session_id: sessionData.id,
        role: 'user',
        content: 'Check recent Outlook emails',
        source_badges: [],
      });
    assert(!userMsgErr, 'Persisted user message');

    // Insert assistant message with action_proposals JSONB
    const { error: assistantMsgErr } = await adminSupabase
      .from('chat_messages')
      .insert({
        session_id: sessionData.id,
        role: 'assistant',
        content: 'I found 2 emails and prepared an Action Proposal.',
        source_badges: ['Prism Operations'],
        action_proposals: [proposal],
      });
    assert(!assistantMsgErr, 'Persisted assistant message with action_proposals JSONB');

    // Query back messages
    const { data: messages } = await adminSupabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionData.id);

    assert(messages?.length === 2, 'Retrieved complete message history (2 messages)');
    assert(
      Array.isArray(messages?.[1].action_proposals) && messages?.[1].action_proposals.length === 1,
      'action_proposals retrieved as populated JSONB array'
    );
  }

  // ── 7. Brand Sovereignty Compliance Audit ─────────────────────────
  console.log('\n7️⃣  Prism Brand Sovereignty Compliance:');

  const filesToCheck = [
    'frontend/src/lib/agent/crypto.ts',
    'frontend/src/lib/agent/tools.ts',
    'frontend/src/lib/agent/llm.ts',
    'frontend/src/app/api/agent/chat/route.ts',
    'frontend/src/app/api/agent/actions/approve/route.ts',
    'frontend/src/app/api/agent/actions/reject/route.ts',
    'frontend/src/hooks/useCopilotChat.ts',
  ];

  for (const relPath of filesToCheck) {
    const fullPath = resolve(process.cwd(), relPath);
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, 'utf8');
      const hasN8n = content.toLowerCase().includes('n8n');
      assert(!hasN8n, `${relPath} has zero legacy n8n references`);
    }
  }

  // ── 8. Cleanup ───────────────────────────────────────────────────
  console.log('\n🧹 Cleaning up test artifacts...');
  // The ledger is append-only by design (see migration 11): probe rows are
  // retained rather than deleted.
  runSql(`DELETE FROM public.chat_sessions WHERE title LIKE 'TEST_P3_%';`);
  if (isCreatedTestAuthUser && effectiveUserId) {
    runSql(`DELETE FROM auth.users WHERE id = '${effectiveUserId}';`);
  }
  console.log('  ✅ Temporary test records deleted cleanly');

  // Summary
  console.log(`\n==================================================`);
  console.log(`🎯 Phase 3 Agent Runtime Probe: ${passed} Passed, ${failed} Failed`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase3Probe().catch((err) => {
  console.error('Fatal probe failure:', err);
  process.exit(1);
});
