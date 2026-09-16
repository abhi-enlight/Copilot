# 🏢 Multi-Tenant Architecture, User Flows & Edge-Case Plan
### *Unified Microsoft 365 + Database Analytics & AI Operations Hub*

---

## 🎯 Executive Overview
This document outlines the complete architectural strategy, authentication flows, user tier models, and edge-case resolutions to scale the **Operations Cockpit** into a multi-tenant SaaS platform. 

It natively supports both **individual / non-enterprise users** (personal workspaces) and **enterprise organizations** (multi-seat workspaces with SSO, RBAC, and Microsoft 365/Dynamics CRM integrations).

---

## 🏗️ 1. Multi-Tenant Architecture & Isolation

```
                                  [ Incoming Request ]
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
             Central: app.yourdomain.com         Subdomain: acme.yourdomain.com
                        │                                     │
                        └──────────────────┬──────────────────┘
                                           │
                          [ Next.js Middleware / Rewrite ]
                          Extracts Tenant Context & Validates JWT
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
          [ PostgreSQL / Supabase with RLS ]       [ External Integrations (M365/CRM) ]
           Policy: tenant_id = auth.jwt()           OAuth tokens stored per tenant_id
```

### 1.1 Database Isolation: Row-Level Security (RLS)
The database uses a **Shared-Database, Shared-Schema** model isolated strictly via PostgreSQL Row Level Security (RLS) policies bound to user JWTs.

* Every business table (`orders`, `documents`, `audit_logs`, `prompts`, `tenant_integrations`) has an `organization_id UUID NOT NULL` column.
* Supabase **Row Level Security (RLS)** is enabled and forced on every table. PostgreSQL automatically intercepts queries and enforces isolation at the engine level.

```sql
-- 1. Organizations (Tenants)
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL DEFAULT 'enterprise' CHECK (type IN ('personal', 'enterprise')),
    domain TEXT, -- e.g. "acme.com" for enterprise auto-discovery
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Organization Memberships (RBAC)
CREATE TABLE public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- 3. Tenant Integration Vault (Encrypted external credentials)
CREATE TABLE public.tenant_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('microsoft_365', 'dynamics_365', 'salesforce', 'postgres')),
    credentials_encrypted JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'consent_required', 'reauth_required')),
    last_error_message TEXT,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, provider)
);

-- 4. RLS Policy on Business Data Tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Data Isolation" ON public.orders
    FOR ALL
    TO authenticated
    USING (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);
```

### 1.2 Multi-Tenant Routing in Next.js
* **Central Portal**: `app.yourdomain.com` serves the default cockpit and workspace selector.
* **Tenant Subdomains**: `acme.yourdomain.com` is rewritten dynamically in `src/middleware.ts` to `/[tenant]/dashboard`.

---

## 👥 2. Can Normal (Non-Enterprise) Users Use the Product?

**Yes.** The system uses a **Dual-Audience Unified Workspace Model**:

| Feature Dimension | Normal / Individual Users | Enterprise Users |
| :--- | :--- | :--- |
| **Workspace Creation** | Automatic on sign-up (`type: 'personal'`, 1 member). | Created via Admin setup or Enterprise Domain onboarding. |
| **Login Methods** | Email/Password, Magic Link, Google, Personal Microsoft. | SAML 2.0, Okta, Azure Entra ID SSO. |
| **Integration Scopes** | Personal OneDrive, personal Outlook, CSV/Excel uploads, personal Supabase. | Tenant-wide SharePoint Root, Dynamics 365 CRM, Company PostgreSQL. |
| **Routing** | `app.domain.com/dashboard` (Universal workspace). | Subdomain `acme.domain.com` or custom domain `ops.acme.com`. |

---

## 🔐 3. End-to-End Login & Tenant Resolution Flow

```
[ User Lands on /login ]
          │
          ▼
[ Step 1: Identifier-First Input (Email) ]
          │
          ├───► Enterprise Domain Match (e.g., @acme.com with SSO enabled)?
          │         │
          │         ├───► YES: Redirect to Azure Entra ID / SAML 2.0 SSO Endpoint
          │         └───► NO: Display Password / Magic Link / Social Login
          │
          ▼
[ Step 2: Auth Verification & JWT Minting ]
(JWT Claims: user_id, active_organization_id, role, permissions)
          │
          ▼
[ Step 3: Workspace Resolver ]
          │
          ├───► User has 1 Organization: Direct forward to /dashboard
          └───► User has Multiple Organizations: Present Workspace Switcher modal
```

### Step Details:
1. **Identifier-First Login**: User enters `alex@company.com`. If `company.com` has SSO configured, the user is forwarded to Azure Entra ID / Okta SAML. Otherwise, standard password/Google login is shown.
2. **JWT Claims Injection**: Upon successful authentication, Supabase Auth stamps the user's active `organization_id` and `role` into the JWT `app_metadata`.
3. **Workspace Switching**: Multi-org users (e.g., consultants or agency managers) can switch active tenants via a top navigation dropdown without logging out.

---

## 🛡️ 4. Enterprise Non-Admin Edge Case & Resolution

### 4.1 The Challenge
When non-admin enterprise employees sign in using corporate Microsoft 365 credentials:
* **Missing Tenant Admin Consent (`AADSTS65001`)**: The app requires scopes like `Sites.Read.All` or `Mail.Read` that IT departments restrict to Global Admins.
* **Missing Dynamics 365 Security Role**: The user can log into Microsoft 365, but their account has not been assigned a CRM role (e.g. *Sales Enterprise* or *System Customizer*) in Microsoft Dataverse (`PrincipalUserHasNoPrivileges` / `403 Forbidden`).

### 4.2 Detection Mechanism (Pre-Flight Health Probes)
Upon session initialization or API interaction:
1. **Probe Microsoft Graph Profile**: Call `/v1.0/me` to verify user authentication.
2. **Probe Dataverse Privilege**: Call `/api/data/v9.2/WhoAmI` or `RetrieveUserPrivileges`.
3. **Probe SharePoint Access**: Call `/v1.0/sites/{site-id}`.

### 4.3 In-App UX & 1-Click IT Admin Consent Link
When permissions are missing, the system **gracefully degrades**:
1. **Keep App Functional**: The user can still chat with the AI for database analysis, CSV data, and personal queries.
2. **Warning Banner & Status**: CRM widgets display:
   > ⚠️ **CRM Access Requires Enterprise IT Approval**  
   > *Your corporate account has not been granted access to Dynamics 365.*
3. **1-Click IT Admin Consent URL Generator**:
   The app generates a pre-formatted Entra ID Admin Consent Link:
   ```http
   GET https://login.microsoftonline.com/{tenant_id}/adminconsent?client_id={client_id}&state={state}&redirect_uri={redirect_url}
   ```
4. **Automated Helpdesk Ticket**: A button opens a pre-drafted email for the user to forward to their IT department containing exact required scopes and justifications.

---

## ⚡ 5. Comprehensive Multi-Tenant Edge Cases & Solutions

| # | Edge Case | Failure Mode | Mitigation Solution |
| :--- | :--- | :--- | :--- |
| **1** | **Conditional Access / Silent Token Expiry** | IT enforces MFA every 8 hours or password rotation; background refresh token exchange throws `AADSTS50076`. | **Proactive Token Interceptor**: API intercepts `reauth_required` response, saves in-progress prompt/draft in client state, and triggers an inline re-auth popup without full session termination. |
| **2** | **Enterprise Domain Collisions** | An employee `@company.com` signs up, but another team already created a tenant with that name. | **DNS Domain Verification**: Enterprise domain auto-join requires DNS TXT record verification (`_ops-cockpit-verification=...`). Unverified domains use explicit invite links only. |
| **3** | **AI SQL Injection & Cross-Tenant Data Leaks** | AI generates a custom SQL query or summarization joining tables without `organization_id` filters. | **Dual-Layer Database Isolation**: (1) RLS is forced at the PostgreSQL engine level (`FORCE ROW LEVEL SECURITY`). (2) AI queries execute against a restricted read-only role with `SET LOCAL app.current_organization_id = ...` per transaction. |
| **4** | **Noisy Neighbor & LLM / API Rate Throttling** | Tenant A runs 1,000 bulk queries, causing global Graph API or LLM 429 rate limit errors for Tenant B. | **Per-Tenant Token Bucket Limiter**: Implement Redis-backed sliding window rate limits per tenant. Provide Enterprise BYOK (Bring Your Own Azure/OpenAI API Keys) to bypass shared limits. |
| **5** | **Partial Integration Outage** | SharePoint is experiencing high latency / 503, but PostgreSQL and CRM are operational. | **Circuit Breakers & Graceful Degradation**: AI agent handles tool errors asynchronously. If SharePoint fails, the agent reports CRM and DB data with a clear disclaimer: *"SharePoint connection timed out; results reflect CRM and Database records."* |
| **6** | **Employee Offboarding / Instant Revocation** | Employee is deactivated in Okta/Entra ID, but their local app session remains cached. | **SCIM 2.0 & Webhook De-provisioning**: Listen to Entra ID User Deleted webhooks and maintain a fast Redis session-revocation blacklist. |
| **7** | **Multi-Tenant Webhook Routing (n8n)** | Incoming webhooks from Microsoft Graph or CRM must route to the correct tenant workflow. | **Tenant-Encoded Webhook Endpoints**: Unique webhook URLs per tenant (`/webhook/m365/:org_id`) with HMAC signature verification. |
| **8** | **GDPR Right to Be Forgotten & Tenant Offboarding** | Enterprise customer cancels subscription and requests complete data purging. | **Cascade Purging & Automated Export**: Single-transaction tenant hard-delete script that purges all associated member rows, encrypted credentials, logs, and RLS tables in compliance with GDPR. |

---

## 🗺️ 6. Implementation Roadmap

### Phase 1: Database & RLS Foundation
* [ ] Create `organizations`, `organization_members`, and `tenant_integrations` tables.
* [ ] Add `organization_id` foreign keys to all business entities.
* [ ] Apply `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` across all application tables.

### Phase 2: Multi-Tenant Next.js Routing & Auth
* [ ] Implement identifier-first authentication UI in Next.js App Router.
* [ ] Configure `src/middleware.ts` for host/subdomain detection and session tenant injection.
* [ ] Implement Workspace Switcher component in header navigation.

### Phase 3: Enterprise Integration Vault & Admin Consent
* [ ] Upgrade Microsoft Azure App Registration to Multi-Tenant (`/common` endpoint).
* [ ] Build encrypted integration credential manager with AES-256-GCM.
* [ ] Implement `/adminconsent` redirection and IT admin helper screen.

### Phase 4: Edge-Case Handling & Reliability
* [ ] Add Pre-flight permission probe on session start (Dataverse + Graph).
* [ ] Implement circuit breaker handling for external API rate limits (429/503).
* [ ] Add Redis-based token bucket rate limiting per tenant.
