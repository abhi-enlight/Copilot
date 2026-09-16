# 🏗️ 01. Project Overview & System Architecture

> **Target Audience**: QA Engineers, Automation Developers, System Integrators.  
> **Goal**: Understand how data flows between Next.js, n8n, Supabase, Google Gemini, and external providers (Microsoft Graph & Zoho APIs) to isolate test failures accurately.

---

## 1. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser UI)                               │
│  Next.js 16 App Router · React 19 · Motion · Tailwind CSS · Phosphor Icons   │
│  [Home] [Copilot] [Inbox] [Documents] [Campaigns] [Connections] [Users]    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / Server-Sent Events (SSE)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PRISM NEXT.JS APPLICATION LAYER                        │
│  • Session & Multi-Tenant Context (`src/proxy.ts`, `AuthProvider`)         │
│  • API Route Gateways (`/api/chat`, `/api/connectors`, `/api/campaigns`)    │
│  • Token Vault & AES-256-GCM Crypto (`src/lib/vault-crypto.ts`)            │
│  • Token Auto-Refresher Daemon (`src/instrumentation.ts`)                  │
└───────────────┬──────────────────────┬──────────────────────┬───────────────┘
                │                      │                      │
       Database │                      │ Webhooks / SDK       │ Direct REST
       & Vector │                      │                      │
                ▼                      ▼                      ▼
┌─────────────────────────┐  ┌───────────────────┐  ┌─────────────────────────┐
│   SUPABASE POSTGRESQL   │  │  n8n ORCHESTRATOR │  │    MICROSOFT GRAPH      │
│  • Organizations & RLS  │  │  • Gemini Agent   │  │  • Mail (`/me/messages`) │
│  • User Roles (RBAC)    │  │  • Intent Router  │  │  • Drive (`/me/drive`)  │
│  • Encrypted Vault      │  │  • Zoho Sub-flows │  │  • Calendar (`/events`) │
│  • pgvector KB Docs     │  │  • Human Approvals│  │  • Dynamics 365 OData   │
│  • Campaigns & Audits   │  │  • Risk Nudges    │  └─────────────────────────┘
└─────────────────────────┘  └─────────┬─────────┘
                                       │
                                       ▼
                             ┌───────────────────┐
                             │     ZOHO REST     │
                             │  • CRM (Deals)    │
                             │  • Projects (Task)│
                             │  • Books (Invoice)│
                             └───────────────────┘
```

---

## 2. Core Technology Stack

| Layer | Technology | Primary Purpose in Prism |
| :--- | :--- | :--- |
| **Frontend UI** | Next.js 16 (App Router), React 19, Motion, Phosphor Icons | Renders cockpit HUD, chat streams, campaign studio, connector toggles, and modals. |
| **Orchestration Backend** | n8n (Node-based workflow automation engine) | Executes AI reasoning, sub-workflow calls, tool gating, and external vendor sync. |
| **AI Intelligence** | Google Gemini (via n8n LangChain & Google GenAI) | Natural language understanding, intent classification, multi-system synthesis, and draft generation. |
| **Database & Vector DB** | Supabase (PostgreSQL with `pgvector` & RLS) | Multi-tenant user data, encrypted credentials, campaigns, action items, audit logs, and document embeddings. |
| **Security & Cryptography** | Node.js `crypto` with `AES-256-GCM` | Two-way encryption of sensitive OAuth refresh/access tokens before storing in database. |
| **External Providers** | Microsoft Graph API & Zoho REST API | Source systems for email, files, CRM, project tracking, and financial invoicing. |

---

## 3. End-to-End Data Flow

### Flow A: Copilot User Query (e.g., "Find emails from Acme and show their active deal")
1. **User input**: User types in `CopilotView.tsx` and hits Send.
2. **Gateway**: Request posts to `frontend/src/app/api/chat/route.ts`.
3. **Intent & Token Resolution**:
   - The route retrieves the user's active tenant and user ID from auth.
   - Retrieves active connector preferences (`microsoft.outlook = true`, `zoho.crm = true`).
   - Fetches decrypted OAuth tokens from Supabase `user_integrations`.
4. **n8n Trigger**: Next.js sends a payload to the n8n Chat Webhook (`01_prism_copilot`).
5. **Agent Reasoning**:
   - Gemini agent receives the prompt and decides to invoke the `msOutlookService` tool and the `zohoCrmService` tool.
   - Each sub-workflow validates that the connector is **active** and **entitled**.
   - Sub-workflow 1 calls Microsoft Graph (`/me/messages?$search="Acme"`).
   - Sub-workflow 2 calls Zoho CRM (`/crm/v2/Deals/search?word=Acme`).
6. **Streaming Response**: Results are correlated and streamed back to the Next.js frontend via Server-Sent Events (SSE) with thinking process tags and tool execution badges.

### Flow B: Action Execution & Human-in-the-Loop Approval (Write Flow)
1. **AI Proposes Action**: Copilot generates a proposed campaign plan or CRM deal creation.
2. **Approval Modal Trigger**: Before any mutating HTTP POST/PUT is sent to Zoho or Microsoft, the UI opens `ApprovalModal.tsx`.
3. **User Inspection**: The user reviews the exact payload diff (e.g., Deal Name: "Acme Summer Promo", Value: "$25,000", Pipeline: "Standard").
4. **Execution & Audit**:
   - If **Approved**: The frontend calls `/api/campaigns/approve_and_push_zoho` → n8n executes the write → an immutable entry is logged in `agent_audit_logs`.
   - If **Rejected**: The action is aborted and logged as rejected; no external API call is made.

---

## 4. The 7 Integrated Connectors

Prism organizes integrations into 7 explicit connectors. Testers should understand the scope and access level of each:

| Connector ID | Display Name | Provider | Nature | Key Operations |
| :--- | :--- | :--- | :--- | :--- |
| `microsoft.outlook` | Outlook Mail | Microsoft Graph | Personal | Read inbox messages, search emails, view threads, draft responses. |
| `microsoft.sharepoint` | SharePoint & OneDrive | Microsoft Graph | Personal / Org | Search documents, list drive root, read PDF/docx metadata. |
| `microsoft.dynamics` | Dynamics 365 CRM | Microsoft Dataverse | Org (Entitled) | Read Accounts, Opportunities, Contacts. Requires dedicated Dynamics license. |
| `zoho.crm` | Zoho CRM | Zoho API | Org / Personal | Deals, Leads, Accounts, Contacts. |
| `zoho.projects` | Zoho Projects | Zoho API | Org / Personal | Projects list, task status, milestone tracking, bug reports. |
| `zoho.books` | Zoho Books | Zoho API | Org / Personal | Invoices, overdue dunning notices, customer financial profiles. |
| `internal.kb` | Knowledge Base | Supabase pgvector | System | Vector similarity search across uploaded company SOPs, guidelines, and PDF briefs. |

---

## 5. Multi-Tenant Architecture & Data Isolation

Prism is designed from the ground up for strict multi-tenancy:
1. **Tenant Identification**: Every organization has a unique `organization_id` (UUID) and `slug`.
2. **Row-Level Security (RLS)**: PostgreSQL tables (`campaigns`, `documents`, `agent_audit_logs`, `user_integrations`) enforce:
   ```sql
   CREATE POLICY tenant_isolation_policy ON public.campaigns
     FOR ALL TO authenticated
     USING (organization_id = (SELECT org_id FROM current_user_org()));
   ```
3. **Role-Based Access Control (RBAC)**:
   - **`owner`**: Full administrative rights, billing, organization deletion, connector configuration.
   - **`admin`**: Connector management, member invitation, campaign approval, role assignments.
   - **`member`**: Standard user; can use chat, view campaigns, create drafts, use personal connectors.
   - **`viewer`**: Read-only; cannot trigger write actions, cannot modify campaigns.

---

## 6. Security Architecture & Token Vault

External OAuth tokens (Microsoft Graph and Zoho refresh tokens) are high-value targets. Prism handles them with enterprise security standards:
- **AES-256-GCM Encryption**: Tokens are encrypted using a 256-bit key before insertion into the database (`user_integrations` table).
- **Initialization Vectors**: A unique random 12-byte IV is generated for every encrypted payload.
- **Authentication Tags**: A 16-byte auth tag ensures cipher text integrity.
- **Background Token Refresh**: Zoho access tokens expire every 60 minutes. An automated Next.js instrumentation daemon (`src/instrumentation.ts`) queries tokens expiring within 10 minutes and silently refreshes them using the stored refresh token.

---

## 7. Bug Isolation Cheatsheet for Testers

When an issue occurs during testing, use this table to determine where to inspect:

| Symptom | Likely Component | What to Check |
| :--- | :--- | :--- |
| UI button click does nothing | Frontend Component | Browser Console (`Cmd+Option+J`), React state. |
| Chat says "Connecting..." and hangs | Next.js API or n8n Webhook | Check `/api/chat` network tab; verify `N8N_WEBHOOK_URL` reachable. |
| Connector shows "Reconnection required" | Token Vault / Refresh Daemon | Check token expiration in database `user_integrations.expires_at`; verify refresh token validity. |
| "You don't have access to CRM" modal | Entitlement Engine | Verify user persona: does the test account have a Dynamics license or Admin role? |
| Write action executed without modal | **CRITICAL SECURITY BUG** | Check `ApprovalModal.tsx` triggering condition in `CopilotView.tsx` or `CampaignsView.tsx`. |
| User A sees User B's campaigns | **CRITICAL RLS LEAK** | Inspect Supabase RLS policies and `organization_id` header in API request. |
