# 🔷 Prism, Granular Connector Toggles, Non-Admin Enablement & Future Productivity Blueprint
### *Enterprise Scaling, Independent Service Gating, and Client Productivity Roadmap*

---

## 📑 Table of Contents

1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [Deep Technical Audit: The "No Access to CRM" & Admin Consent Roadblocks](#2-deep-technical-audit-the-no-access-to-crm--admin-consent-roadblocks)
3. [End-to-End Modular Architecture: Real, Non-Fake UI & Backend Toggles](#3-end-to-end-modular-architecture-real-non-fake-ui--backend-toggles)
4. [Non-Admin Enterprise & Normal Outlook User Solution](#4-non-admin-enterprise--normal-outlook-user-solution)
5. [High-Impact Client Productivity Features Catalog](#5-high-impact-client-productivity-features-catalog)
6. [Enterprise Scalability, Multi-Tenancy & Security Architecture](#6-enterprise-scalability-multi-tenancy--security-architecture)
7. [Gap Analysis: What Is Left to Achieve This](#7-gap-analysis-what-is-left-to-achieve-this)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Operational Pain Point
Currently, when a user signs in with their Microsoft account (e.g., standard Outlook work email or personal account):
- The system immediately displays warnings that **CRM is not connected** (`"Dynamics 365 CRM: Not Connected"`).
- Any general greeting or query prompts the user with IT Administrator consent warnings regarding Dataverse and Dynamics 365.
- Normal corporate employees who do not have Dynamics 365 CRM licenses or IT Admin privileges are treated as having a broken or degraded installation.
- In many corporate tenants, attempting to sign in causes Microsoft Entra ID to block the user outright with error `AADSTS65001` or `AADSTS90094` (*"Need admin approval"*), because the application requests tenant-wide SharePoint scopes (`Sites.Read.All`) in a single bundled OAuth prompt.

### 1.2 The Core Objectives
1. **Independent Granular Service Toggles**:
   Users must be able to independently toggle access to **Outlook Mail**, **SharePoint/OneDrive**, **Dynamics 365 CRM**, and **Zoho Suite (CRM, Projects, Books)** entirely from the UI.
   - *Zero Backend Complexity for the User*: Users never need to touch n8n or understand the backend.
   - *Zero Fake Functionality*: When a service is toggled off, the backend genuinely enforces the restriction, refusing execution at the gate, suppressing external API calls, and returning clean, helpful assistant responses without warnings.
2. **Empowerment for Non-Admin & Normal Outlook Users**:
   Standard corporate employees (without IT admin accounts) and personal Microsoft users must be able to connect their mailbox (`Mail.Read`) and personal OneDrive (`Files.Read`) with zero admin consent friction, allowing them to use the agent for daily productivity.
3. **Comprehensive Client Productivity Feature Suite**:
   Deliver actionable, high-ROI capabilities: Unified Daily Briefings, Smart Email Ghostwriters, Cross-System Deal Radars (linking Microsoft emails with Zoho/Dynamics deals), Meeting Copilots, and Document Diffing.
4. **Enterprise Scalability & Compliance**:
   Ensure multi-tenant isolation, encrypted credential vaults, rate-limiting, and audit logging to scale across organizations and individual users alike.

---

## 2. Deep Technical Audit: The "No Access to CRM" & Admin Consent Roadblocks

A forensic audit of the existing codebase reveals five precise root causes across the frontend, auth layer, and orchestration pipelines:

### 2.1 Root Cause 1: Monolithic OAuth Scope Bundling
In [`frontend/src/app/api/integrations/microsoft/connect/route.ts`](file:///Users/abhi/Desktop/Copilot/frontend/src/app/api/integrations/microsoft/connect/route.ts) (lines 19–27):
```typescript
const scopes = [
  'offline_access',
  'openid',
  'profile',
  'User.Read',
  'Mail.Read',
  'Sites.Read.All', // ⚠️ Requires tenant admin consent in 90%+ of enterprises
  'Files.Read.All'
].join(' ');
```
- **The Issue**: By requesting `Sites.Read.All` unconditionally during login, standard enterprise employees are blocked by corporate Entra ID policies.
- **The CRM Disconnect**: The Dataverse CRM scope (`https://<org>.crm.dynamics.com/user_impersonation`) is **never** requested in this flow. Therefore, even if a user is a licensed Dynamics CRM admin, Microsoft never issues a CRM token.

### 2.2 Root Cause 2: Flawed CRM License Heuristics in OAuth Callback
In [`frontend/src/app/api/integrations/microsoft/callback/route.ts`](file:///Users/abhi/Desktop/Copilot/frontend/src/app/api/integrations/microsoft/callback/route.ts) (lines 96–136):
- The callback queries Microsoft Graph `/v1.0/me/licenseDetails` looking for SKU keywords (`DYN365`, `CRM`, `POWERAPPS`).
- For standard corporate staff and 100% of personal accounts (`outlook.com`, `hotmail.com`), this query returns empty (`hasCrm = false`).
- Instead of treating CRM as an optional, unbundled module, the frontend marks the system as degraded and attempts to route queries to missing Dataverse endpoints.

### 2.3 Root Cause 3: Hardcoded Disconnection in Tenant Status API
In [`frontend/src/app/api/tenant/status/route.ts`](file:///Users/abhi/Desktop/Copilot/frontend/src/app/api/tenant/status/route.ts) (line 52):
```typescript
crmConnected: false, // CRM requires separate Dataverse connection
```
- Every periodic poll or tab focus triggers `/api/tenant/status`, which forces `crmConnected: false`.
- The UI status indicator reset unconditionally to "Not Connected".

### 2.4 Root Cause 4: Rigid Intent Router & Chat Default Responses
In [`frontend/src/app/api/chat/route.ts`](file:///Users/abhi/Desktop/Copilot/frontend/src/app/api/chat/route.ts) (lines 379–394):
- Whenever a query contains words like `deal`, `pipeline`, `revenue`, or `account`, the backend immediately prints:
  `### Dynamics 365 CRM Not Connected ... An IT Administrator can provide Azure Entra ID consent for the Dataverse API (user_impersonation).`
- General queries output a fixed bullet list stating:
  `* Dynamics 365 CRM: Not Connected`
- This confuses users who only wanted an assistant for their Outlook inbox or personal documents.

### 2.5 Root Cause 5: Context Disconnect Between Frontend and n8n Agent
- The master n8n agent [`workflows/01_prism_copilot.ts`](file:///Users/abhi/Desktop/Copilot/workflows/01_prism_copilot.ts) is already authored with subworkflow gates expecting `connectorContext`:
  ```typescript
  connectorEnabled: expr("{{ ($('Chat Trigger').first().json.connectorContext?.['microsoft.outlook']?.enabled) === true }}")
  ```
- However, the frontend chat proxy [`frontend/src/app/api/chat/route.ts`](file:///Users/abhi/Desktop/Copilot/frontend/src/app/api/chat/route.ts) (`streamN8nChat`) currently sends only `{ action, chatInput, sessionId, campaignContext }`. It **does not yet forward** the user's active connector toggles, tokens, or entitlements to n8n.

---

## 3. End-to-End Modular Architecture: Real, Non-Fake UI & Backend Toggles

To provide a seamless experience where users can turn services on or off independently without fake UI states, we establish an integrated four-layer stack:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. User Interface (ConnectionsView & Sidebar Toggles)                        │
│    • Outlook Mail [ON/OFF]       • SharePoint / OneDrive [ON/OFF]           │
│    • Dynamics 365 CRM [ON/OFF]   • Zoho CRM / Projects / Books [ON/OFF]     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Active Toggle State (Local/Supabase)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. Next.js API & Chat Proxy (/api/chat)                                     │
│    • Extracts session tokens (ms_access_token) from secure cookies           │
│    • Merges user toggle preferences into connectorContext payload           │
│    • Proxies payload via SSE to n8n Master Agent                             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ POST with connectorContext
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. n8n Master Copilot Agent (01_prism_copilot)                               │
│    • Passes { connectorEnabled, entitlement, accessToken } to tools          │
│    • Tools: 10_ms_outlook, 11_ms_sharepoint, 12_ms_dynamics, 13-15_zoho     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Subworkflow Trigger
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. Service Workflows Gate Nodes (10–16)                                     │
│    • IF connectorEnabled === false:                                         │
│        → Return { refused: true, reason: "connector_disabled" }             │
│        → ZERO HTTP requests made to Microsoft Graph, Dataverse, or Zoho     │
│    • IF connectorEnabled === true:                                          │
│        → Execute live HTTP provider request & format records                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Client-Side State & Toggle Management
1. **Unified Connector Store (`useConnectors` / `useTenantContext`)**:
   - Manages state for each connector:
     ```typescript
     export interface ConnectorToggleState {
       'microsoft.outlook': boolean;
       'microsoft.sharepoint': boolean;
       'microsoft.dynamics': boolean;
       'zoho.crm': boolean;
       'zoho.projects': boolean;
       'zoho.books': boolean;
       'internal.kb': boolean;
     }
     ```
   - **Persistence**: Persisted immediately in `localStorage` for instant responsiveness and synchronized to Supabase table `user_preferences` (keyed by authenticated user ID) when logged in.
2. **Interactive UI in `ConnectionsView.tsx`**:
   - Each connector card features an accessible animated toggle switch.
   - Toggling **OFF**:
     - Card transitions from glowing emerald/violet to soft, muted porcelain with a `"Paused"` or `"Disabled"` badge.
     - The AI Copilot is immediately instructed not to query this service.
   - Toggling **ON**:
     - If authenticated: Immediately activates and shows `"Active"`.
     - If unauthenticated: Triggers the dedicated, single-scope OAuth popup for that specific service.

### 3.2 Backend Enforcement in Next.js Chat Proxy
When the user sends a message in `CopilotView`, [`frontend/src/app/api/chat/route.ts`](file:///Users/abhi/Desktop/Copilot/frontend/src/app/api/chat/route.ts) extracts the session cookie (`ms_access_token`) and the user's active toggles, constructing the `connectorContext`:

```typescript
const connectorContext = {
  'microsoft.outlook': {
    enabled: activeToggles['microsoft.outlook'] ?? true,
    entitlement: Boolean(msAccessToken),
    accessToken: msAccessToken || ''
  },
  'microsoft.sharepoint': {
    enabled: activeToggles['microsoft.sharepoint'] ?? false,
    entitlement: Boolean(msAccessToken),
    accessToken: msAccessToken || ''
  },
  'microsoft.dynamics': {
    enabled: activeToggles['microsoft.dynamics'] ?? false,
    entitlement: Boolean(hasDynamicsLicense && dynamicsAccessToken),
    accessToken: dynamicsAccessToken || ''
  },
  'zoho.crm': {
    enabled: activeToggles['zoho.crm'] ?? true,
    entitlement: true // Org credential backed in n8n
  },
  'zoho.projects': {
    enabled: activeToggles['zoho.projects'] ?? true,
    entitlement: true
  },
  'zoho.books': {
    enabled: activeToggles['zoho.books'] ?? true,
    entitlement: true
  }
};
```

### 3.3 Zero-Call Gate Enforcement in n8n Service Workflows
Every service workflow (`10` through `16`) already contains a `Gate by Connector & Entitlement` node:
- **Condition**: `connectorEnabled === true AND entitlement !== false`
- **When Disabled**: Diverts execution directly to the `Refusal Output` node.
- **Output Returned to Agent**:
  ```json
  {
    "refused": true,
    "reason": "connector_disabled",
    "connectorId": "microsoft.outlook",
    "total": 0,
    "records": []
  }
  ```
- **Zero External Calls**: Not a single byte is transmitted to Microsoft Graph or Zoho APIs.
- **Agent Synthesis**: The master agent receives the refusal and informs the user cleanly:
  > *"Your Outlook connection is currently paused in your workspace toggles. You can re-enable it in Connections anytime."*

---

## 4. Non-Admin Enterprise & Normal Outlook User Solution

One of the largest hurdles in enterprise SaaS adoption is that standard employees cannot grant administrator consent for corporate Azure tenants.

### 4.1 The Corporate Entra ID Reality
In typical enterprise setups:
- **Permitted for Standard Users**: `User.Read`, `Mail.Read`, `Mail.Send`, `Calendars.Read`, `Files.Read` (personal OneDrive and files shared directly with the user).
- **Prohibited for Standard Users (Requires Global / Cloud App Admin)**:
  - `Sites.Read.All`: Accesses every SharePoint site in the entire corporation.
  - `Directory.Read.All`: Accesses all company directories.
  - `user_impersonation` (Dataverse): Grants access to corporate Dynamics CRM records.

### 4.2 The Solution: Tiered, Incremental OAuth Scopes
Instead of bundling all scopes into one authorization request, Prism splits authentication into four distinct tiers:

| Tier | Target User | Scopes Requested | Admin Consent Needed? | Endpoints Accessed |
|:---|:---|:---|:---:|:---|
| **Tier 1: Personal Mail** | All employees & personal Outlook users | `openid profile email offline_access User.Read Mail.Read` | ❌ **NO** (Allowed in 95%+ of orgs) | `/me/messages` |
| **Tier 2: Personal Files** | Knowledge workers & non-admins | `Files.Read` | ❌ **NO** (Allowed for personal OneDrive) | `/me/drive/root/children` |
| **Tier 3: Org SharePoint** | Team leads & admins | `Sites.Read.All` | ⚠️ **YES** (Tenant Admin Consent) | `/sites/{id}/drive` |
| **Tier 4: Enterprise CRM** | Licensed Sales/CRM reps | `https://<org>.crm.dynamics.com/user_impersonation` | ⚠️ **YES** (Requires CRM License + Role) | Dataverse Web API v9.2 |

### 4.3 Implementation: Parameterized Auth Endpoint
The authorization initiator [`frontend/src/app/api/integrations/microsoft/connect/route.ts`](file:///Users/abhi/Desktop/Copilot/frontend/src/app/api/integrations/microsoft/connect/route.ts) is modified to accept a `scope_preset` or `connectors` query parameter:

1. **`connect?preset=mail`**:
   Requests only `User.Read Mail.Read`. Non-admin corporate users sign in with 1 click. Zero admin consent prompts.
2. **`connect?preset=personal_files`**:
   Requests `User.Read Mail.Read Files.Read`. Gives full access to Outlook inbox and personal OneDrive files.
3. **`connect?preset=sharepoint_admin`**:
   Invoked only when the user explicitly clicks *"Connect Org SharePoint"*.
4. **`connect?preset=dynamics_crm`**:
   Invoked only when connecting Dynamics CRM, requesting the specific Dataverse resource scope.

### 4.4 Alternative Productivity Paths for Users Without CRM
For users who do not have Dynamics 365 CRM licenses:
1. **Zero-CRM Productivity Mode**:
   - The UI suppresses all CRM indicators and warnings.
   - Quick action prompts dynamically reconfigure to focus on inbox management, calendar prep, and document analysis.
2. **Zoho CRM Personal / Org Integration**:
   - Normal users can leverage the organization's shared Zoho CRM credentials (hosted securely in n8n) or connect their own Zoho account. This provides CRM functionality without touching Microsoft admin settings.
3. **Ad-Hoc File Intelligence (CSV, Excel, PDF RAG)**:
   - Users can drag-and-drop spreadsheets, client proposals, or contracts directly into the chat bar. The system parses and indexes them on the fly for instant Q&A.

---

## 5. High-Impact Client Productivity Features Catalog

To maximize value for executives, operations teams, and standard employees, Prism introduces six high-impact productivity capabilities:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Prism Client Productivity Suite                         │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│  1. Executive Inbox  │  2. Cross-Deal Radar │  3. Meeting Copilot           │
│  • Smart Ghostwriter │  • Mail ↔ Deal Match │  • Pre-meeting Briefing       │
│  • VIP Triage        │  • Invoice Overlap   │  • Action Item Extractor      │
│  • 3-Bullet Digest   │  • Task Timeline     │  • Follow-up Email Draft      │
├──────────────────────┼──────────────────────┼───────────────────────────────┤
│  4. Document RAG     │  5. Morning Briefing │  6. Governed Writes           │
│  • Contract Diffing  │  • Calendar + Mail   │  • Approval Drawers           │
│  • Citation Search   │  • At-Risk Milestones│  • Audit Trail Logging        │
│  • SOP Knowledge Base│  • Cashflow & Escrow │  • Human-in-the-Loop          │
└──────────────────────┴──────────────────────┴───────────────────────────────┘
```

### 5.1 Feature 1: Intelligent Executive Inbox & Smart Ghostwriter
- **3-Bullet Thread Distiller**: Distills 20+ message corporate email threads into key decisions, open questions, and required actions.
- **Context-Aware Ghostwriter**: Generates drafted responses citing live context:
  *Example*: If a client asks *"What is the status of our voucher code generation?"*, the ghostwriter automatically pulls the current task completion state from Zoho Projects or Dynamics CRM and includes it in the draft.
- **VIP Triage**: Categorizes inbox emails by sender seniority, urgency, and revenue impact.

### 5.2 Feature 2: Cross-System Deal & Account Radar (The Merged Superpower)
- **The Magic of Merged Data**:
  When an email arrives from `client@brand.com`, Prism cross-references:
  - **Microsoft**: Email conversation history and attached proposals.
  - **Zoho / Dynamics CRM**: Active deal stage, commercial contract size, and assigned account manager.
  - **Zoho Projects**: Operational milestones and delivery deadlines.
  - **Zoho Books**: Pending GST invoices and advance escrow receipt status.
- **One-Click Account 360**: Displays a unified dossier combining communications, pipeline value, project health, and outstanding payments.

### 5.3 Feature 3: Executive Daily Briefing (Morning Digest)
- Delivered via n8n workflow `03_daily_briefing`:
  - **Calendar**: Today's scheduled meetings and attendees.
  - **Urgent Communications**: High-priority unread emails requiring replies.
  - **Operational Alerts**: Tasks with upcoming deadlines or overdue UAT lead times.
  - **Financial Summary**: Invoices due this week and pending advance sign-offs.

### 5.4 Feature 4: Meeting Copilot & Automated Action-Item Tracking
- **Pre-Meeting Brief**: Assembles recent emails, shared slide decks, and past meeting notes for upcoming calendar invites.
- **Post-Meeting Action Extractor**: Analyzes meeting transcripts or follow-up notes, extracts commitments, and formats them into assigned tasks with deadlines.
- **Follow-up Dispatch**: Prepares ready-to-send recap emails for all participants.

### 5.5 Feature 5: Multi-Document RAG & Contract Diffing
- **Contract & Agreement Diffing**: Compares two versions of an agreement (e.g., Master Services Agreement vs. SOW Addendum) in OneDrive/SharePoint and highlights modified liability, indemnity, or payment terms.
- **Knowledge Base Citations**: Semantic search over company SOPs, brand guidelines, and legal precedent memos with page-level citations.

### 5.6 Feature 6: Human-in-the-Loop Governed Writes
- The copilot never executes write operations (sending an email, creating a CRM deal, updating milestone dates, or generating invoices) silently.
- Every write presents an interactive **Approval Modal / Drawer** displaying the exact payload, allowing the user to review, edit, or reject before submission.

---

## 6. Enterprise Scalability, Multi-Tenancy & Security Architecture

To support deployment across multinational organizations while safeguarding individual data privacy:

### 6.1 Multi-Tenant Isolation & Row-Level Security (RLS)
- **Postgres Isolation**: All tenant data in Supabase is segmented by `organization_id` and `user_id`.
- **Strict RLS Policies**:
  ```sql
  CREATE POLICY "Users access only their own connector preferences"
    ON public.user_preferences
    FOR ALL
    USING (auth.uid() = user_id);
  ```
- **Personal vs. Enterprise Workspaces**:
  - Personal users operate within private scopes (`workspace_personal_<id>`).
  - Corporate users operate within tenant-governed boundaries (`org_<tenant_slug>`).

### 6.2 Token Encryption & Secret Vault
- **At-Rest Encryption**: OAuth refresh tokens, client secrets, and integration credentials are encrypted using AES-256-GCM before storage in `tenant_integrations`.
- **Short-Lived Memory Access**: Access tokens exist only in memory or encrypted HTTP-only session cookies with strict `SameSite=Lax` and `Secure` flags.

### 6.3 Performance, Caching & Rate-Limit Shielding
- **Sliding-Window Rate Limiter**: Redis token-bucket rate limiting prevents high-frequency client queries from exhausting Microsoft Graph or Zoho API quotas.
- **Semantic Caching**: Frequently requested entity metadata (e.g., project milestones, deal stages) is cached with 5-minute TTLs, reducing upstream latency by up to 80%.
- **Graceful Degradation**: If an external provider experiences downtime or rate limits (HTTP 429/503), circuit breakers isolate that specific service without disrupting the rest of the workspace.

---

## 7. Gap Analysis: What Is Left to Achieve This

Below is the definitive, itemized checklist of what is already completed versus what remains to be implemented to bring this architecture to life:

| Area | Component / File | Current Status | What Is Left to Implement | Priority |
|:---|:---|:---:|:---|:---:|
| **n8n Services** | `workflows/10–16` | ✅ Deployed & Verified | None. All 7 service subworkflows gate properly on `connectorEnabled` and `entitlement`. | Done |
| **n8n Agent** | `workflows/01_prism_copilot` | ✅ Deployed & Verified | None. Agent expects `connectorContext` and handles refusals gracefully. | Done |
| **OAuth Connect** | [`microsoft/connect/route.ts`](file:///Users/abhi/Desktop/Copilot/frontend/src/app/api/integrations/microsoft/connect/route.ts) | ⚠️ Monolithic Bundled Scopes | Add `scopes` query parameter handling (`mail_only`, `personal_files`, `org_sharepoint`, `dynamics_crm`) so normal users avoid admin consent blocks. | High |
| **OAuth Callback** | [`microsoft/callback/route.ts`](file:///Users/abhi/Desktop/Copilot/frontend/src/app/api/integrations/microsoft/callback/route.ts) | ⚠️ Overly Strict CRM Check | Update to treat CRM absence as normal for personal/standard accounts rather than failing; store granted scopes in session. | High |
| **Chat Proxy** | [`api/chat/route.ts`](file:///Users/abhi/Desktop/Copilot/frontend/src/app/api/chat/route.ts) | ⚠️ Missing Connector Context | 1) Point `N8N_WEBHOOK_URL` to live `01_prism_copilot` webhook (`7a7d.../chat`).<br/>2) Read user cookies and active toggle states; construct and forward `connectorContext` into the n8n payload. | High |
| **Tenant Status** | [`api/tenant/status/route.ts`](file:///Users/abhi/Desktop/Copilot/frontend/src/app/api/tenant/status/route.ts) | ⚠️ Hardcoded Disconnected CRM | Replace `crmConnected: false` with live evaluation of active connectors and granted token scopes. | High |
| **Connector UI** | [`ConnectionsView.tsx`](file:///Users/abhi/Desktop/Copilot/frontend/src/components/ConnectionsView.tsx) | ⚠️ Static Zoho Cards Only | 1) Add Microsoft cards (Outlook Mail, SharePoint/OneDrive, Dynamics CRM).<br/>2) Add animated toggle switches per card.<br/>3) Implement 1-click connect/disconnect actions for each tier. | High |
| **Client State** | [`useTenantContext.ts`](file:///Users/abhi/Desktop/Copilot/frontend/src/hooks/useTenantContext.ts) | ⚠️ Lacks Granular Toggles | Add `activeConnectors` state with `localStorage` persistence and a setter function exposed across the app. | High |
| **Chat Interface** | [`CopilotView.tsx`](file:///Users/abhi/Desktop/Copilot/frontend/src/components/CopilotView.tsx) | ⚠️ Generic Welcome State | Pass active connector toggles in the fetch body to `/api/chat`; adjust welcome prompts to reflect enabled services only. | Medium |
| **Productivity** | `workflows/03, 04, 06` | 📋 Authored in Catalog | Author and deploy feature workflows for Daily Briefing (`03`), Deal Radar (`04`), and Meeting Copilot (`06`). | Medium |
