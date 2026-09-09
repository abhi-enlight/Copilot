# 🔷 Prism, One Interface, Every System

> **Prism** is the merged product: the former *Operations Cockpit* (Microsoft Outlook / SharePoint / Dynamics 365 CRM) unified with *BCP Assist* (Zoho CRM / Projects / Books) into a single AI productivity copilot, with **n8n as the execution backend**.
>
> Connectors are permission-honest: Outlook, OneDrive, and Calendar connect per user with minimal scopes (no admin rights needed), while CRM and tenant-wide connectors appear only for users the provider's own permission model entitles them to.

---

## 📚 Documentation

- **`docs/PRISM_PRODUCT_AND_MERGE_PLAN.md`**, master product, merge & architecture plan (audit, connector spec + permission matrix, n8n workflow catalog, UI/UX design system, brand kit, feature roadmap, phases, risks, and the ready-to-copy prompt for the n8n-MCP agent).
- **`docs/FUTURE_IMPLEMENTATIONS_AND_PRODUCTIVITY_PLAN.md`**, granular toggles & non-admin enablement design study (feeds Prism's connector architecture).
- **`docs/ARCHITECTURE.md`**, **`docs/MULTI_TENANT_ARCHITECTURE_AND_PLAN.md`**, multi-tenant foundation.

---

## 🚀 Features

- **Multi-Source Telemetry HUD**: Live indicators and status telemetry for connected enterprise data sources.
- **Unified Chat Stream**: Powered by Google Gemini via n8n webhook orchestration.
- **Quick Action Triggers**: Instant one-click triggers for Outlook emails, SharePoint documents, and database records.
- **Dynamic Source Badging**: Auto-categorizes responses with visual source tags.
- **Hardware-Grade UI**: Double-bezel cockpit aesthetics with Framer Motion animations and ⌘K hotkey focus.
- **Connector Hub**: Add, toggle, and health-check Microsoft & Zoho connectors one by one, respecting each platform's real permissions. CRM connections (Dynamics 365 and Zoho CRM) are **entitlement-gated**: users without CRM access see a locked toggle and a "You don't have access to the CRM." popup; Admin/Owner app roles override failed probes, and a post-login re-check unlocks access the moment a license/role is granted.
- **Multi-tenant Zoho**: every user connects their own Zoho account via OAuth (per-product scopes for CRM / Projects / Books). Org IDs and data center are discovered from the user's account at connect time, the legacy hard-coded org is only a fallback when `ZOHO_ORG_SHARED=true`.
- **Read + write with approvals**: Microsoft scopes now include `Mail.Send` / `Mail.ReadWrite` / `Files.ReadWrite` and Zoho scopes are write-capable; every AI write passes a human approval modal and is recorded in `agent_audit_logs`.

---

## 🛠️ Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env.local` file (see `.env.example` for the full set, Supabase, Microsoft, Zoho, token vault encryption, and background token refresh):

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Database Migrations
Apply the SQL files in `database/migrations/` in order (01 → 02 → 03). Migration 03 adds the
expiry columns that power the background token-refresh job, users' Zoho connections stay
valid without re-connecting, and rejected refresh tokens surface as **Reconnection required**
in the Connections view.

### 5. Background Token Refresh
The Next.js server automatically refreshes per-user Zoho vault tokens before they expire
(via `src/instrumentation.ts`; every 15 minutes by default, `TOKEN_REFRESH_INTERVAL_MS`).
For serverless or slept deployments, trigger it from cron instead:
```bash
curl -X POST https://<your-app>/api/integrations/refresh-tokens \
  -H "x-refresh-secret: $TOKEN_REFRESH_SECRET"
```
