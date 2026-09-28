# 🗺️ Prism V2: Master Sitemap & Information Architecture

> **Document Status**: LOCKED FOR MVP  
> **Brand Directive**: 100% Prism Brand Sovereignty across all routes and sub-paths  
> **Architecture Pattern**: Next.js 16 App Router (Modular layouts, top-layer drawers, and edge API routes)

---

## 1. High-Level Navigation Topology

```
Prism Operations Platform
│
├── 🌐 Public & Auth Routes
│   ├── /auth/login                       ── Sign in (Magic Link / Enterprise SSO)
│   ├── /auth/signup                      ── Workspace onboarding & account creation
│   └── /auth/callback                    ── Supabase Auth OAuth/PKCE exchange handler
│
├── 🔒 Authenticated App Surfaces (The Command Center)
│   │
│   ├── /                                 ── ⚡ THE PRISM COMMAND COCKPIT
│   │   ├── [Left Panel]                  ── Briefing history, quick tool toggles & status
│   │   ├── [Center Panel]                ── Intelligence Stream with Action Proposal Cards
│   │   └── [Right Panel]                 ── Live Stack Radar (Real-time Teams/Outlook/Slack pills)
│   │
│   ├── /sessions/[sessionId]             ── Deep-linkable persistent briefing session
│   │
│   ├── /radar                            ── 📡 Expanded Live Stack Radar & Activity Feed
│   │   └── Full-page chronological, filtered stream of cross-stack communication
│   │
│   ├── /actions                          ── 🛡️ Human-in-the-Loop Action Ledger (Audit Logs)
│   │   └── Complete history of approved, executed, and rejected AI actions
│   │
│   ├── /integrations                     ── 🔌 Prism Connector Hub (Also available as slide-out drawer)
│   │   └── Catalog of 3,200+ tools with 1-click "Connect with Prism"
│   │
│   └── /settings                         ── ⚙️ Workspace & Preferences (MVP: profile only)
│       └── /settings/profile             ── Personal notifications, haptics, display modes
│
└── ⚡ Edge & Serverless API Routes (/api/...)
    ├── /api/agent/chat                   ── SSE Streaming LLM + Tool Execution Engine
    ├── /api/agent/actions/approve        ── Cryptographic human sign-off handler
    ├── /api/agent/actions/reject         ── Action proposal dismissal
    ├── /api/agent/sessions               ── Session CRUD & history
    ├── /api/integrations/connect         ── White-labeled Prism Connect Link generator
    ├── /api/integrations/disconnect      ── Integration revocation
    ├── /api/integrations/status          ── Live health check of user tools
    ├── /api/webhooks/composio            ── Secure webhook receiver for live stack triggers
    └── /api/telemetry/events             ── Paginated events feed & read status
```

---

## 2. Route Specification Table

### 2.1 User-Facing Pages

| URL Route | Page Title | Access Level | Layout / Shell | Primary Client Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **`/`** | **Prism Cockpit** | Authenticated | 3-Panel Asymmetric Cockpit | Daily executive briefing, conversational AI stream, interactive Action Cards, live stack radar sidebar, hardware input bar. |
| **`/sessions/[id]`** | **Briefing Session** | Authenticated | 3-Panel Cockpit | Resumes a specific conversation thread with full tool-calling history and previous action cards. |
| **`/radar`** | **Stack Radar** | Authenticated | Standard Cockpit Shell | Full-screen activity stream from Teams, Outlook, Slack, Linear, CRM. Filter by priority (Urgent/Critical) or tool. 1-click "Investigate" action triggers. |
| **`/actions`** | **Action Ledger** | Authenticated | Standard Cockpit Shell | Immutable audit trail of every state-modifying action (Email sent, CRM record updated). Displays execution timestamp, user approval signature, and result payload. |
| **`/integrations`** | **Connector Hub** | Authenticated | Standard Cockpit Shell *(or Drawer)* | Grid of 3,200+ tools. Connect status, scopes, 1-click authorization via Prism Connect popup. |
| **`/settings`** | **Settings** | Authenticated | Tabbed Settings Shell | Personal notification toggles, haptics, theme settings. *(Organization members, roles, invites, and billing are deferred post-MVP — see the MVP spec.)* |
| **`/auth/login`** | **Sign In** | Public | Minimal Obsidian Shell | Supabase Magic Link, Google SSO, Microsoft Entra SSO. Clean agency typography. |
| **`/auth/signup`** | **Get Started** | Public | Minimal Obsidian Shell | Account creation, organization naming, workspace slug initialization. |

---

### 2.2 Backend API Routes

| API Endpoint | HTTP Method | Auth Required | Purpose / Contract |
| :--- | :--- | :--- | :--- |
| **`/api/agent/chat`** | `POST` | Yes (`auth.uid`) | Streams tokens, tool call indicators, and Action Proposal cards via SSE. Heartbeat keep-alive every 15s. |
| **`/api/agent/actions/approve`** | `POST` | Yes (`auth.uid`) | Verifies user authorization and executes pending state-modifying action via the integration engine. |
| **`/api/agent/actions/reject`** | `POST` | Yes (`auth.uid`) | Rejects action proposal and records dismissal in audit ledger. |
| **`/api/agent/sessions`** | `GET`, `POST` | Yes (`auth.uid`) | Lists active briefing sessions; creates new session threads. |
| **`/api/integrations/connect`** | `POST` | Yes (`auth.uid`) | Returns a white-labeled Prism Connect URL (`session.authorize(app)`). |
| **`/api/integrations/disconnect`** | `POST` | Yes (`auth.uid`) | Disconnects an app from the user's workspace. |
| **`/api/integrations/status`** | `GET` | Yes (`auth.uid`) | Returns connection health, last sync time, and active scopes for all tools. |
| **`/api/webhooks/composio`** | `POST` | Webhook Signature | Ingests live triggers from Teams, Outlook, Slack, normalizes them, and inserts into `activity_events`. |
| **`/api/telemetry/events`** | `GET`, `PATCH` | Yes (`auth.uid`) | Returns paginated stack events; marks events as read. |

---

## 3. UI State Transitions & Top-Layer Drawers

To maintain a fluid, distraction-free cockpit experience, secondary surfaces are available both as **standalone routes** and as **top-layer sliding drawers**:

```
+-------------------------------------------------------------------------------------------------+
| COCKPIT HUD  ──▶ Click "Connect Tools" ──▶ Slides out <ToolDrawer /> (overlaying right side)    |
|              ──▶ Click "View All Radar" ──▶ Expands <RadarDrawer /> or navigates to /radar       |
|              ──▶ Click "Action Pending" ──▶ Focuses <ApprovalModal /> in Top Layer               |
+-------------------------------------------------------------------------------------------------+
```

- When on desktop, pressing `⌘K` or clicking a HUD button slides the **Prism Connector Hub** out as a top-layer `<dialog>` with zero page reloads.
- Direct links like `/integrations` or `/radar` allow bookmarking or opening in separate browser tabs.

---

## 4. Mobile & Tablet Responsive Layout Fallbacks

| Breakpoint | Layout Transformation |
| :--- | :--- |
| **Desktop (`≥ 1280px`)** | **Full 3-Panel Asymmetric Cockpit**: Left sidebar (260px) + Center Stream (Flex) + Right Live Stack Radar (340px). |
| **Laptop (`1024px - 1279px`)** | **2-Panel Collapsible Cockpit**: Left sidebar collapses into an icon rail; Live Radar collapses into an expandable slide-over drawer; Center stream expands. |
| **Tablet (`768px - 1023px`)** | **Single Stream with Drawers**: Center Intelligence Stream takes 100% width; Navigation and Live Radar accessible via floating top buttons. |
| **Mobile (`< 768px`)** | **Vertical Stack**: Header with active status pills → Full-width Intelligence stream → Floating bottom input bar. Radar accessible via swipe or top pill. |
