# 📚 Prism Copilot V2: Master Documentation Index

> **Project Target**: An executive AI employee platform inspired by [viktor.com](https://viktor.com/), connecting 3,200+ enterprise tools with live stack telemetry, human sign-off, and an agency-grade hardware aesthetic.  
> **Brand Directive**: 100% Prism Brand Sovereignty to all users and clients.  
> **Status**: **100% LOCKED FOR MVP IMPLEMENTATION**

---

## 📂 Documentation Sitemaps by Category

### [01. Architecture](./01-architecture/)
- [SYSTEM_ARCHITECTURE.md](./01-architecture/SYSTEM_ARCHITECTURE.md) — High-level system architecture, Next.js 16 App Router + Supabase + Integration Engine, n8n evaluation verdict.
- [SITEMAP_AND_INFORMATION_ARCHITECTURE.md](./01-architecture/SITEMAP_AND_INFORMATION_ARCHITECTURE.md) — Complete user routes, layouts, top-layer drawers, and edge API endpoint topology.
- [DATABASE_AND_TENANCY.md](./01-architecture/DATABASE_AND_TENANCY.md) — Multi-tenant database model, Supabase Auth scoping, organization RLS policies, activity events table, and audit ledger.
- [INTEGRATIONS_AND_COMPOSIO.md](./01-architecture/INTEGRATIONS_AND_COMPOSIO.md) — White-labeled Prism Connect Hub, session architecture, 1-click Connect Link generation, zero-custom-auth paradigm.

### [02. UI/UX Design System](./02-ui-ux-design/)
- [DESIGN_SYSTEM_AND_TOKENS.md](./02-ui-ux-design/DESIGN_SYSTEM_AND_TOKENS.md) — "Anti-AI-Slop" agency design system, Obsidian/Titanium palette, Geist typography, double-bezel concentric chassis cards, custom cubic-bezier spring physics.
- [CLIENT_EXPERIENCE_AND_FLOWS.md](./02-ui-ux-design/CLIENT_EXPERIENCE_AND_FLOWS.md) — End-to-end client-side user journeys, 3-panel command cockpit, morning executive brief, and proactive interaction patterns.
- [COMPONENT_SPECIFICATIONS.md](./02-ui-ux-design/COMPONENT_SPECIFICATIONS.md) — TypeScript props contracts and DOM structures for CockpitHeader, IntelligenceStream, ActionCard, LiveStackRadar, and HardwareInputBar.

### [03. Live Stack Telemetry](./03-live-stack-telemetry/)
- [PROACTIVE_FEED_AND_WEBHOOKS.md](./03-live-stack-telemetry/PROACTIVE_FEED_AND_WEBHOOKS.md) — Real-time event ingestion for Teams, Outlook, and Slack via Webhook Triggers and Supabase Realtime WebSockets.
- [EVENT_SCHEMA_AND_DISPATCH.md](./03-live-stack-telemetry/EVENT_SCHEMA_AND_DISPATCH.md) — Normalized event payload format, priority scoring algorithm (Critical / Urgent / Normal / Low), and suggested prompt generators.

### [04. Agent Intelligence Engine](./04-agent-engine/)
- [AGENT_EXECUTION_AND_STREAMING.md](./04-agent-engine/AGENT_EXECUTION_AND_STREAMING.md) — Direct serverless streaming agent runtime (`/api/agent/chat`), token-by-token SSE, eliminating n8n latency, and sub-500ms TTFT.
- [HUMAN_IN_THE_LOOP_APPROVALS.md](./04-agent-engine/HUMAN_IN_THE_LOOP_APPROVALS.md) — Two-tier tool security model (autonomous read vs. gated mutation), action proposal cards, and immutable audit logging.

### [05. MVP Roadmap & GitOps](./05-mvp-roadmap-and-gitops/)
- [MVP_SPECIFICATION_LOCKED.md](./05-mvp-roadmap-and-gitops/MVP_SPECIFICATION_LOCKED.md) — Firm, locked MVP scope definition, in-scope features, deferred capabilities, and acceptance criteria.
- [GITOPS_AND_MIGRATION_PLAN.md](./05-mvp-roadmap-and-gitops/GITOPS_AND_MIGRATION_PLAN.md) — Phased migration runbook for retiring legacy endpoints cleanly without breaking configuration or Git history.
