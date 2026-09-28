# ⚡ Prism: The Autonomous Enterprise AI Employee

> **Not a chat tool. A digital employee that lives across your stack, fetches live communication, proposes actions, and waits for your sign-off before touching what matters.**  
> Inspired by the executive intelligence model of [viktor.com](https://viktor.com/). Built on **Next.js 16**, **Supabase Multi-Tenant Auth/RLS**, and the **Composio Platform SDK** for 3,200+ enterprise integrations.

---

## 🌟 Core Pillars

- **Universal Multi-User Connectivity (Composio Platform)**: Users connect their own accounts across Microsoft Teams, Outlook, Slack, Linear, GitHub, Zoho, and Salesforce via 1-click managed connect links. Zero custom OAuth maintenance.
- **Live Stack Telemetry Radar**: Real-time webhook ingestion for Teams, Outlook, and Slack. Surfaces proactive executive briefings and unread urgency pills into an ambient cockpit HUD.
- **Sub-Second Streaming Engine**: Direct serverless streaming agent runtime (`/api/agent/chat`). Direct LLM function calling with sub-500ms TTFT (Time-To-First-Token), completely replacing legacy n8n proxying.
- **Autonomous, Not Unsupervised (Action Cards)**: Safe read-tools execute automatically; state-modifying actions (sending emails, updating CRM deals, creating tasks) render interactive **Action Proposal Cards** and require explicit human sign-off before execution.
- **Bespoke Hardware-Grade Cockpit**: Obsidian/Titanium dark palette, double-bezel concentric chassis cards, Geist typography, and micro-physics animations. Zero generic SaaS templates.

---

## 📚 Master Documentation Suite (Categorized & Locked for MVP)

All system architecture, design specifications, and migration guides are organized in [`docs/`](./docs):

- 🏛️ **[01. Architecture](./docs/01-architecture/)**
  - [`SYSTEM_ARCHITECTURE.md`](./docs/01-architecture/SYSTEM_ARCHITECTURE.md) — Complete V2 blueprint, Next.js + Supabase + Composio, and n8n retirement verdict.
  - [`DATABASE_AND_TENANCY.md`](./docs/01-architecture/DATABASE_AND_TENANCY.md) — Multi-tenant schema, RLS policies, session models, and audit logs.
  - [`INTEGRATIONS_AND_COMPOSIO.md`](./docs/01-architecture/INTEGRATIONS_AND_COMPOSIO.md) — Composio Platform SDK, multi-user sessions, and 1-click connect flow.

- 🎨 **[02. UI/UX Design System](./docs/02-ui-ux-design/)**
  - [`DESIGN_SYSTEM_AND_TOKENS.md`](./docs/02-ui-ux-design/DESIGN_SYSTEM_AND_TOKENS.md) — "Anti-AI-Slop" agency design system, double-bezel concentric curves, and motion tokens.
  - [`CLIENT_EXPERIENCE_AND_FLOWS.md`](./docs/02-ui-ux-design/CLIENT_EXPERIENCE_AND_FLOWS.md) — Client-side user journey, 3-panel command cockpit, and proactive briefings.
  - [`COMPONENT_SPECIFICATIONS.md`](./docs/02-ui-ux-design/COMPONENT_SPECIFICATIONS.md) — TypeScript props contracts and structural breakdowns for all UI components.

- 📡 **[03. Live Stack Telemetry](./docs/03-live-stack-telemetry/)**
  - [`PROACTIVE_FEED_AND_WEBHOOKS.md`](./docs/03-live-stack-telemetry/PROACTIVE_FEED_AND_WEBHOOKS.md) — Ingesting live updates from Teams, Outlook, and Slack via webhooks.
  - [`EVENT_SCHEMA_AND_DISPATCH.md`](./docs/03-live-stack-telemetry/EVENT_SCHEMA_AND_DISPATCH.md) — Unified event schema and priority scoring engine.

- ⚡ **[04. Agent Intelligence Engine](./docs/04-agent-engine/)**
  - [`AGENT_EXECUTION_AND_STREAMING.md`](./docs/04-agent-engine/AGENT_EXECUTION_AND_STREAMING.md) — Native streaming runtime, token-by-token SSE, and tool calling lifecycle.
  - [`HUMAN_IN_THE_LOOP_APPROVALS.md`](./docs/04-agent-engine/HUMAN_IN_THE_LOOP_APPROVALS.md) — Two-tier tool security model, action proposal cards, and audit logging.

- 🔒 **[05. MVP Roadmap & GitOps](./docs/05-mvp-roadmap-and-gitops/)**
  - [`MVP_SPECIFICATION_LOCKED.md`](./docs/05-mvp-roadmap-and-gitops/MVP_SPECIFICATION_LOCKED.md) — Firm, locked-in scope, acceptance criteria, and deferred features.
  - [`GITOPS_AND_MIGRATION_PLAN.md`](./docs/05-mvp-roadmap-and-gitops/GITOPS_AND_MIGRATION_PLAN.md) — Phased migration runbook for retiring legacy endpoints cleanly.

---

## 🛠️ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create a `.env.local` file with your credentials:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Composio Platform
COMPOSIO_API_KEY=ak_...

# LLM Provider (Choose one or more)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the Prism Command Cockpit.
