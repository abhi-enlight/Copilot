# 🔒 Locked MVP Specification: Prism Copilot V2

> **Document Status**: 100% LOCKED FOR MVP IMPLEMENTATION  
> **Brand Directive**: **100% PRISM BRAND SOVEREIGNTY**. To end-users and clients, the product is 100% **Prism**. Third-party provider names (Composio) are strictly internal backend implementation details and MUST NEVER appear anywhere in the client-facing UI, URLs, modals, badges, or error messages.  
> **Rule**: No further architectural or specification revisions are permitted until the MVP is built and verified.

---

## 1. Locked Feature Scope for MVP

The MVP delivers a complete, cohesive, end-to-end "AI Employee" product inspired by Viktor.com:

### Pillar 1: High-End Hardware-Grade Cockpit UI
- **Zero AI-Slop Guarantee**: Obsidian/Titanium dark palette, Geist + Plus Jakarta Sans typography, Phosphor Light monoline icons, double-bezel concentric chassis cards.
- **3-Panel Asymmetric Layout**:
  - Left: Persistent Briefing & Connection HUD.
  - Center: Prism Intelligence Stream with fluid streaming markdown and Action Cards.
  - Right: Live Stack Radar displaying incoming events from Teams, Outlook, and Slack.
- **Interactive Input Bar**: Double-bezel prompt dock with `@Tool` context chips and magnetic send button.

### Pillar 2: Universal Tool Integration (Prism Connect Hub)
- **1-Click Tool Drawer**: Connect drawer listing Microsoft Teams, Outlook, Slack, Linear, and Zoho CRM.
- **100% White-Labeled Flow**: The user clicks "Connect with Prism", sees a Prism-branded authorization window with the Prism logo and dark Obsidian theme, and grants access to **Prism Operations Cockpit**. Zero third-party branding leaks.
- **Per-User Isolation**: Every Supabase user has a distinct isolated session (`auth.uid()`).

### Pillar 3: Real-Time Live Stack Radar (Telemetry)
- **Webhook Ingestion**: `/api/webhooks/composio` receives signed event triggers from Teams, Outlook, Slack.
- **Live Stream Delivery**: Events written to `public.activity_events` and pushed to the browser via Supabase Realtime WebSockets.
- **Ambient Alert Pills**: Unread badges and instant "Draft Reply / Investigate" action triggers.

### Pillar 4: Direct Agent Streaming (Zero n8n)
- **Native LLM Engine**: Next.js API route (`/api/agent/chat`) directly streams tokens and function calls.
- **Sub-Second TTFT**: Time-to-first-token under 500ms (70% faster than legacy n8n proxy).
- **Tool Calling**: Autonomous read tools (search emails, get messages, fetch deals).

### Pillar 5: Human-in-the-Loop Sign-Off
- **Action Proposal Cards**: Mutations (e.g. sending an email or updating a CRM deal) render interactive draft cards with "Approve & Deliver via Prism" and "Reject" buttons.
- **Audit Ledger**: All executed actions recorded permanently in `public.agent_audit_logs`.

---

## 2. Explicitly Deferred (Post-MVP)
To guarantee rapid, high-quality execution of the MVP, the following are intentionally deferred:
- ❌ Virtual computer / browser automation sandboxes.
- ❌ Native Teams/Slack bot packaging (MVP delivers the web command cockpit with full Teams/Slack tool connectivity).
- ❌ Real-time bidirectional voice agent.
- ❌ Organization settings (`/settings/organization`): member management, role assignment, invites, and billing. MVP delivers `/settings` (profile, notifications, haptics, theme) only.

---

## 3. Definition of Done (Acceptance Criteria)

1. A new user can sign up via Supabase Auth and arrive in their private **Prism** workspace.
2. Clicking "Connect Outlook" or "Connect Teams" opens a Prism-branded authorization popup; after the user consents and closes it, the cockpit shows `⏳ Finishing…` then a green `● Connected to Prism` indicator (verified via `/api/integrations/status` polling, per Flow B).
3. **Brand Audit Passed**: Nowhere in the client-facing UI (modals, drawers, badges, toast messages, buttons, error messages, headers, dialogs, footers) does any third-party infrastructure name (Composio) appear.
4. Sending a prompt like *"Summarize my last 3 unread emails in Outlook and draft a reply to the urgent one"* executes read tools automatically and renders an interactive **Email Draft Card**.
5. Clicking **"Approve & Deliver via Prism"** executes the delivery and marks the action completed in `agent_audit_logs`.
6. Sending a simulated or live webhook to `/api/webhooks/composio` instantly updates the **Live Stack Radar** in the browser with zero page refreshes.
7. The UI visually matches the agency-grade Obsidian/Titanium specification with no generic Tailwind templates.
8. `npm run build` (frontend) completes with zero type errors before acceptance sign-off.
