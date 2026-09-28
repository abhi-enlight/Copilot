# 🚀 GitOps & Phased Migration Runbook: Legacy to V2 Clean Architecture

> **Document Status**: LOCKED FOR MVP  
> **Execution Strategy**: Clean Replacement within Repository (Zero Regressions, Zero Legacy Baggage)

---

## 1. Clean Migration Principles

To fulfill the requirement that *"nothing from the legacy app should exist and nothing should break"*:
1. **Preserve Repository Root & Git History**: Keep the `.git` tree, root `package.json` + `frontend/package.json` + `tsconfig.json`, and verified Supabase database migrations. **The Next.js app lives under `frontend/` — every `src/...` path below means `frontend/src/...`.**
2. **Clean Retirement of Legacy Endpoints**: Rather than patching on top of the 500-line legacy `/api/chat/route.ts` or the legacy `/cockpit` directory, we cleanly deprecate and replace them with modular V2 handlers under `/api/agent/` and `/components/copilot/`.
3. **Obsolete Dependencies Removed**: Remove manual token refresh crons (`frontend/src/instrumentation.ts` legacy Zoho/Azure refresh loops) because Composio Platform automates this natively.

---

## 2. Phased GitOps Execution Runbook

### Phase 1: Database Migration 10 (`activity_events` & Audit Ledger)
Create and apply `database/migrations/10_prism_v2_live_telemetry_and_composio.sql`.

**⚠️ Migration 09 is already taken** (`09_prism_v2_connector_vault.sql` — connector vault, org-scoped knowledge base, audit log). Migration 10 must include the following conflict-resolution steps in addition to creating `activity_events` with its indexes and RLS:

1. **`agent_audit_logs` already exists** (created by migration 09 with an org-event shape: `action`, `entity_type`, `entity_id`, `details`). Rename it to `agent_audit_logs_legacy`, then create the **canonical HITL ledger** (columns `tool_slug`, `action_type`, `status` ∈ `pending/approved/rejected/executed/failed`, `request_payload`, `execution_result`, `approved_by`, `approved_at`) specified in `docs/01-architecture/DATABASE_AND_TENANCY.md` §2.5.
2. **`chat_messages.role` CHECK** currently allows only `user`/`assistant`/`system` (migration 05). Drop and re-add the constraint to allow `'tool'` so captured tool invocations persist.
3. Do **not** add a `plan` column to `organizations` (billing is deferred post-MVP); the live table uses `type ∈ ('personal','team','enterprise')`.
4. Enable RLS for auth-scoped access. The policy set in `docs/01-architecture/DATABASE_AND_TENANCY.md` §3 is stated once there and is authoritative.

### Phase 2: Environment Configuration Alignment
Ensure `frontend/.env.local` contains the unified V2 configuration:
```bash
# ── Supabase (Authentication & Persistence) ────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ── Composio Platform (Universal Tool Hub) ─────────────
COMPOSIO_API_KEY=ak_...

# ── LLM Frontier Model Provider ───────────────────────
# (Choose your primary model key: Claude / OpenAI / Gemini)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
```
*(Note: Legacy `AZURE_CLIENT_SECRET`, `ZOHO_CLIENT_SECRET`, and `N8N_WEBHOOK_URL` are no longer required for the Copilot chat runtime.)* At cutover, apply the repository's own clean-retirement principle to `.env.example`: remove the legacy blocks (`AZURE_*`, `ZOHO_*`, `INTEGRATION_ENCRYPTION_KEY`, `TOKEN_REFRESH_*`, `N8N_*`) so the template matches the V2 runtime exactly, and verify every V2 key name matches `.env.example` one-for-one.

### Phase 3: Core Backend Implementation
1. **Supabase Auth Exchange Route**: `frontend/src/app/auth/callback/route.ts` (PKCE/OAuth code exchange — required by every OAuth/SSO path; does not exist yet)
2. **Composio Platform Session Helper**: `frontend/src/lib/composio/session.ts` — wraps `composio.sessions.create(userId)` (canonical helper in `docs/01-architecture/INTEGRATIONS_AND_COMPOSIO.md` §2)
3. **Direct Streaming Agent Engine**: `frontend/src/app/api/agent/chat/route.ts`
4. **1-Click Connect Endpoint**: `frontend/src/app/api/integrations/connect/route.ts`
5. **Composio Webhook Receiver**: `frontend/src/app/api/webhooks/composio/route.ts`
6. **Human Sign-Off Approval Handler**: `frontend/src/app/api/agent/actions/approve/route.ts`

### Phase 4: Hardware-Grade UI Assembly
1. Update `frontend/src/app/globals.css` with the Obsidian/Titanium color tokens, double-bezel utilities, and custom cubic-bezier animations.
2. Implement the 3-Panel Cockpit:
   - `frontend/src/components/copilot/CockpitHeader.tsx`
   - `frontend/src/components/copilot/IntelligenceStream.tsx`
   - `frontend/src/components/copilot/LiveStackRadar.tsx`
   - `frontend/src/components/copilot/HardwareInputBar.tsx`
   - `frontend/src/components/copilot/cards/ActionCard.tsx`
   - `frontend/src/components/copilot/drawers/ToolDrawer.tsx`
3. Update `frontend/src/app/page.tsx` to mount the new command cockpit.

### Phase 5: Verification & Acceptance Sign-Off
1. `npm run build` completes with zero type errors (DoD #8 gate — run before any manual verification).
2. Verify tool connection via the Prism-branded connect popup, including the `⏳ Finishing…` → `● Connected to Prism` status polling loop (Flow B).
3. Verify direct token streaming (TTFT < 500ms).
4. Test inbound live webhook dispatch to the Live Stack Radar.
5. Execute an Action Card human sign-off.
