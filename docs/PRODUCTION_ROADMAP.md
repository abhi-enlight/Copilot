# Prism Copilot V2: Production Upgrade Roadmap

This document outlines the architectural enhancements and future capability milestones for **Prism Copilot V2** across reliability, autonomous intelligence, and user experience.

---

## Completed: Tier 1 Security & Production Hardening

The foundational security perimeter has been applied and verified:

1. **Agent Chat Rate Limiting**: `/api/agent/chat` now authenticates through `requireAuth()` and enforces dedicated `agent-chat` token-bucket rate limits per tenant.
2. **Session IDOR Elimination**: Fixed `verifySessionOwner()` in `/api/chat/sessions/[sessionId]` and `/api/chat/sessions/[sessionId]/messages` to strictly enforce `user_id === session.user_id`.
3. **Host Header Poisoning Elimination**: `/api/auth/logout` derives redirect URLs strictly from configured origins (`NEXT_PUBLIC_APP_URL` / server origin).
4. **Production Security Headers**: Added strict `Content-Security-Policy`, `Strict-Transport-Security` (HSTS), and `X-Permitted-Cross-Domain-Policies` in `next.config.ts`.
5. **Multi-Tenant Telemetry Deduplication**: Scoped `idx_activity_events_dedup` to `(user_id, source, external_id)` in Migration 11, preventing cross-tenant event drop collisions.
6. **Supply Chain Hardening**: Removed unused `rehype-raw` dependency.

---

## Tier 2: Enterprise Reliability & Infrastructure Resilience

### 1. Distributed Rate Limiter & Concurrency Manager (Upstash Redis)
* **Objective**: Replace in-memory `tenantRateLimiter` with distributed Redis storage to support horizontal autoscaling across serverless lambdas or multi-container clusters.
* **Concurrency Lock**: Implement a distributed mutex on active sessions (`prism:lock:session:<id>`) with a 60-second TTL to prevent concurrent prompt execution within the same conversation thread.
* **Files**:
  * `frontend/src/lib/resilience.ts`
  * `frontend/src/lib/redis.ts` (new)

### 2. Action Approval Idempotency Keys
* **Objective**: Prevent duplicate tool execution (e.g., sending double emails or duplicate Linear tickets) when operators click "Approve" multiple times or during network reconnections.
* **Mechanism**:
  * Client generates a cryptographic UUID `x-idempotency-key` on proposal creation.
  * `POST /api/agent/actions/approve` records the key in `action_audit_ledger` with unique constraint.
  * Duplicate attempts return the cached execution result with HTTP 200 without re-invoking external APIs.
* **Files**:
  * `frontend/src/components/copilot/ActionApprovalCard.tsx`
  * `frontend/src/app/api/agent/actions/approve/route.ts`

### 3. Persistent Webhook Dead-Letter Queue (DLQ)
* **Objective**: Guarantee zero data loss when incoming webhooks from Composio, GitHub, Linear, or Google fail due to downstream timeouts or payload parsing anomalies.
* **Mechanism**:
  * Create `public.webhook_dlq` table storing failed events with error trace and retry counter.
  * Scheduled Supabase Edge Function or cron worker retries events with exponential backoff (1m, 5m, 30m, 2h).
  * Exposes DLQ health metrics in the developer administration console.
* **Files**:
  * `database/migrations/12_webhook_dlq.sql`
  * `frontend/src/app/api/webhooks/composio/route.ts`

### 4. Multi-Model Provider Fallback
* **Objective**: Seamless business continuity during upstream LLM outages or rate limits.
* **Mechanism**:
  * Cascade: `Gemini 2.5 Pro` -> `Gemini 2.5 Flash` -> `Claude 3.5 Sonnet` / `GPT-4o`.
  * Preserves SSE streaming protocol without breaking the frontend client connection.
* **Files**:
  * `frontend/src/lib/agent/llm.ts`

---

## Tier 3: Autonomous Executive Capabilities

### 1. Scheduled Morning Executive Briefing (08:00 AM Cron)
* **Objective**: Deliver an automated morning intelligence briefing summarizing high-priority activity.
* **Behavior**:
  * Runs daily at 08:00 AM user local time.
  * Ingests unread VIP emails, pending P0/P1 Linear tickets, and upcoming calendar meetings.
  * Dispatches an executive synthesis card to Live Radar with pre-staged quick action approvals.
* **Files**:
  * `frontend/src/app/api/cron/briefing/route.ts` (new)
  * `frontend/src/components/copilot/LiveRadarPanel.tsx`

### 2. Compound Multi-Tool Chains (Atomic Batch Approvals)
* **Objective**: Allow the copilot to orchestrate complex operations spanning multiple services in a single step.
* **Example**: *"Client bug reported in Gmail -> create Linear issue -> stage drafted reply email with issue tracker link."*
* **UX Specification**: A unified multi-stage approval card detailing each write operation with individual or atomic "Approve All" execution.
* **Files**:
  * `frontend/src/lib/agent/llm.ts`
  * `frontend/src/components/copilot/ActionApprovalCard.tsx`

### 3. Exportable Audit Ledger for Compliance (SOC2 / ISO 27001)
* **Objective**: Enable enterprise security teams to export cryptographic proof of all agent mutations.
* **Features**:
  * One-click CSV and signed JSON export from `/cockpit/actions`.
  * Includes timestamp, operator ID, tool name, arguments payload, execution status, client IP, and HMAC signature.
* **Files**:
  * `frontend/src/app/cockpit/actions/page.tsx`
  * `frontend/src/app/api/actions/export/route.ts` (new)

### 4. Context-Aware Action Suggestions in Live Radar
* **Objective**: Convert passive telemetry into one-click actionable workflows.
* **Behavior**:
  * When a telemetry card appears in Live Radar (e.g. "PR #42 opened"), lightweight intent classification displays suggested quick actions (e.g. `[Review Diff]`, `[Assign Reviewer]`).
  * Clicking pre-populates the input bar without operator typing.
* **Files**:
  * `frontend/src/components/copilot/LiveRadarPanel.tsx`

---

## Tier 4: Linear / Bloomberg Terminal Operational Polish

### 1. Global Command Palette (`Cmd + K` / `Ctrl + K`)
* **Objective**: Instant, keyboard-first navigation and workflow execution.
* **Features**:
  * Quick session search and instant switching.
  * Tool launcher (Gmail, Linear, GitHub, Slack status).
  * Slash command runner (`/briefing`, `/status`, `/audit`).
  * Crisp monospace search with keyboard navigation (`Up`, `Down`, `Enter`, `Esc`).
* **Design Standards**: Flat borders (`border-white/10`), monospace badges, no rounded pill containers.

### 2. Keyboard Shortcuts on Action Approval Cards
* **Objective**: Operators can review and approve staged actions without leaving the keyboard.
* **Hotkeys**:
  * `Cmd + Enter` / `Y`: Approve action.
  * `Esc` / `N`: Reject and cancel action.
  * `Tab` / `Shift + Tab`: Cycle through action parameters.

### 3. Realtime Reconnection Sentinel
* **Objective**: Provide subtle feedback if network disruption drops the Supabase Realtime channel.
* **Design**:
  * Monospace operational indicator (`SYNC [OFFLINE - RECONNECTING (3s)]`).
  * Automatic exponential backoff with zero UI layout shift.
