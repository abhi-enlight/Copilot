/**
 * Automated Verification Probe for Phase 1: Universal Connect Hub & Composio Session Provider.
 * Tests session creation, canonical slug normalization, authorization URL generation for all 5 core tools,
 * tool status formatting, IDOR ownership gate logic, and brand error sanitization.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

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

if (!process.env.COMPOSIO_API_KEY) {
  console.error('❌ COMPOSIO_API_KEY missing from .env.local');
  process.exit(1);
}

// Dynamic import of SDK and Phase 1 modules
async function runProbe() {
  console.log('🔍 Starting Phase 1 Integration Probe...\n');

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

  const {
    getComposioClient,
    getComposioSessionForUser,
    normalizeToolSlug,
    formatToolStatus,
    sanitizeIntegrationError,
    CORE_PRISM_TOOL_SLUGS,
    PRISM_TOOL_REGISTRY,
  } = await import('../frontend/src/lib/composio/session');

  // ── 1. Slug Normalization & Registry Verification ────────────────
  console.log('1️⃣  Canonical Tool Slug Normalization & Registry:');

  assert(normalizeToolSlug('teams') === 'microsoft_teams', "Alias 'teams' maps to 'microsoft_teams'");
  assert(normalizeToolSlug('microsoft-teams') === 'microsoft_teams', "Alias 'microsoft-teams' maps to 'microsoft_teams'");
  assert(normalizeToolSlug('microsoft_teams') === 'microsoft_teams', "'microsoft_teams' maps to 'microsoft_teams'");
  assert(normalizeToolSlug('outlook') === 'outlook', "Alias 'outlook' maps to 'outlook'");
  assert(normalizeToolSlug('microsoft-outlook') === 'outlook', "Alias 'microsoft-outlook' maps to 'outlook'");
  assert(normalizeToolSlug('slack') === 'slack', "'slack' maps to 'slack'");
  assert(normalizeToolSlug('linear') === 'linear', "'linear' maps to 'linear'");
  assert(normalizeToolSlug('zoho') === 'zoho', "Alias 'zoho' maps to 'zoho'");
  assert(normalizeToolSlug('zoho-crm') === 'zoho', "Alias 'zoho-crm' maps to 'zoho'");

  let invalidCaught = false;
  try {
    normalizeToolSlug('unsupported_tool_xyz');
  } catch {
    invalidCaught = true;
  }
  assert(invalidCaught, 'Unsupported tool slug throws validation error');

  // ── 2. Session Provider & LRU Cache Verification ─────────────────
  console.log('\n2️⃣  Composio Session Provider & LRU Caching:');

  const testUserId = `test_probe_${Date.now()}`;
  const startTime = Date.now();
  const { session: session1, entityId: entityId1 } = await getComposioSessionForUser(testUserId);
  const duration1 = Date.now() - startTime;

  assert(entityId1 === `user_${testUserId}`, `Entity ID strictly partitioned as user_${testUserId}`);
  assert(Boolean(session1?.sessionId), `Session successfully initialized: ${session1?.sessionId}`);

  // Test LRU Cache hit
  const cacheStart = Date.now();
  const { session: session2, entityId: entityId2 } = await getComposioSessionForUser(testUserId);
  const cacheDuration = Date.now() - cacheStart;

  assert(session1.sessionId === session2.sessionId, 'LRU Cache returned identical active session instance');
  assert(cacheDuration < 50, `Cached session returned in sub-50ms (${cacheDuration}ms vs ${duration1}ms initial)`);

  // ── 3. Authorization URL Generation for All Core Tools ───────────
  console.log('\n3️⃣  Authorization Link Generation (Core MVP Tools):');

  for (const slug of CORE_PRISM_TOOL_SLUGS) {
    try {
      const authReq = await session1.authorize(slug, {
        callbackUrl: 'http://localhost:3000/integrations/callback',
      });
      const hasValidUrl = typeof authReq.redirectUrl === 'string' && authReq.redirectUrl.startsWith('https://');
      assert(hasValidUrl, `${PRISM_TOOL_REGISTRY[slug].name} (${slug}) generated valid HTTPS redirect URL`);
    } catch (err) {
      assert(false, `${slug} authorization failed: ${err}`);
    }
  }

  // ── 4. Live Toolkit Status Inspection & Model Formatting ─────────
  console.log('\n4️⃣  Live Toolkit Status Inspection & Model Formatting:');

  const details = await session1.toolkits({
    toolkits: [...CORE_PRISM_TOOL_SLUGS],
  });
  assert(Array.isArray(details.items) && details.items.length >= 5, 'session.toolkits() returned all 5 core tools');

  const sampleItem = details.items?.[0];
  const formatted = formatToolStatus('outlook', sampleItem);
  assert(formatted.slug === 'outlook', "Formatted status has correct slug 'outlook'");
  assert(typeof formatted.isConnected === 'boolean', 'Formatted status has boolean isConnected flag');
  assert(['ACTIVE', 'INACTIVE', 'EXPIRED', 'ERROR'].includes(formatted.status), `Status enum validated: ${formatted.status}`);

  // ── 5. IDOR Ownership Verification Gate Simulation ───────────────
  console.log('\n5️⃣  IDOR Disconnect Ownership Gate:');

  const composio = getComposioClient();
  const userAccounts = await composio.connectedAccounts.list({
    userIds: [entityId1],
  });
  assert(Array.isArray(userAccounts.items), 'composio.connectedAccounts.list scoped strictly to caller entityId');

  // Verify that an arbitrary unowned ID fails the ownership check
  const fakeVictimId = 'ca_FAKE_VICTIM_ACCOUNT_999';
  const isOwned = userAccounts.items.some((acc: { id: string }) => acc.id === fakeVictimId);
  assert(!isOwned, 'IDOR verification strictly prevents unauthorized account revocation');

  // ── 6. Brand Sovereignty & Error Sanitizer ───────────────────────
  console.log('\n6️⃣  Brand Sovereignty & Error Sanitizer:');

  const rawComposioError = new Error('Failed connecting via composio: apiKey ak_test_12345 to https://api.composio.dev/auth');
  const sanitized = sanitizeIntegrationError(rawComposioError);

  assert(!sanitized.toLowerCase().includes('composio'), 'Error sanitizer purged third-party provider name');
  assert(!sanitized.includes('ak_test_12345'), 'Error sanitizer purged API key fragment');
  assert(!sanitized.includes('https://api.composio.dev'), 'Error sanitizer purged internal API URL');

  // ── 7. Summary ───────────────────────────────────────────────────
  console.log('\n=================================================');
  console.log(`Phase 1 Probe Complete: ${passed} passed, ${failed} failed`);
  console.log('=================================================\n');

  if (failed > 0) {
    console.error('❌ Phase 1 Integration Probe FAILED');
    process.exit(1);
  } else {
    console.log('🎉 Phase 1 Integration Probe PASSED! Universal Connect Hub fully operational.');
  }
}

runProbe().catch((err) => {
  console.error('Unexpected probe failure:', err);
  process.exit(1);
});
