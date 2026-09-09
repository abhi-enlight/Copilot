# Production Environment Variables & Deployment Configuration Guide

This guide documents the complete environment variable specification for deploying **Prism Operations Copilot** (Microsoft 365 + Zoho Suite + Supabase pgvector) to production.

---

## 1. What Changed from the Legacy Setup

| Component | Legacy Setup | Production Requirement | Why It Changed |
| :--- | :--- | :--- | :--- |
| **n8n Chat Webhook** | `.../webhook/20bf7228.../chat` | `.../webhook/7a7d4575.../chat` | **CRITICAL**: The old webhook pointed to the legacy BCP Assist workflow which only had Zoho tools. The new webhook points to **Prism Unified Copilot** (`4F1v1svJPlnMHN8m`), which orchestrates Outlook Mail, SharePoint / OneDrive, Dynamics 365, Zoho CRM, Projects, Books, and Knowledge Base. |
| **Microsoft OAuth Callback** | `http://localhost:3000/...` | `https://<DOMAIN>/api/integrations/microsoft/callback` | Required for live production authentication. Must match Azure App Registration redirect URIs. |
| **Zoho OAuth Callback** | `http://localhost:3000/...` | `https://<DOMAIN>/api/integrations/zoho/callback` | Required for per-user Zoho authentication. Must match Zoho API Console authorized redirect URIs. |
| **Token Vault Encryption** | Not present / Plaintext | `INTEGRATION_ENCRYPTION_KEY` | Encrypts user refresh and access tokens with **AES-256-GCM** before saving to Supabase (`user_integrations` table). |
| **Multi-Tenant Zoho Credentials** | Org-shared | `ZOHO_CLIENT_ID` + `ZOHO_CLIENT_SECRET` | Enables users to authenticate their own Zoho organizations dynamically. |
| **Supabase Service Key** | Anon key only | `SUPABASE_SERVICE_ROLE_KEY` | Allows server background workers (`token-refresher`, role lookups) to bypass RLS securely on the backend. |

---

## 2. Complete Environment Variables Specification

### A. Microsoft 365 & Entra ID OAuth
| Variable | Required? | Description | Example / Production Value |
| :--- | :--- | :--- | :--- |
| `AZURE_CLIENT_ID` | **Yes** | Azure App Registration Application (client) ID | `9b9717eb-8dbf-41b1-b788-d7a3ae6f4269` |
| `NEXT_PUBLIC_AZURE_CLIENT_ID` | **Yes** | Client ID exposed to frontend for modal consent generation | `9b9717eb-8dbf-41b1-b788-d7a3ae6f4269` |
| `AZURE_CLIENT_SECRET` | **Yes** | Azure App Registration client secret value | `<AZURE_CLIENT_SECRET>` |
| `AZURE_TENANT_ID` | **Yes** | Directory (tenant) ID or `common` for multi-tenant apps | `<AZURE_TENANT_ID>` (or `common`) |
| `AZURE_REDIRECT_URI` | **Yes** | OAuth redirect URL callback for Microsoft login | `https://<YOUR_PRODUCTION_DOMAIN>/api/integrations/microsoft/callback` |
| `DYNAMICS_CRM_ORG_URL` | Optional | Microsoft Dataverse / Dynamics 365 instance URL | `https://<ORG_NAME>.crm8.dynamics.com` |

### B. Zoho Multi-Tenant OAuth
| Variable | Required? | Description | Example / Production Value |
| :--- | :--- | :--- | :--- |
| `ZOHO_CLIENT_ID` | **Yes** | Server-based Client ID from [Zoho API Console](https://api-console.zoho.in) | `<ZOHO_CLIENT_ID>` |
| `ZOHO_CLIENT_SECRET` | **Yes** | Client Secret from Zoho API Console | `<ZOHO_CLIENT_SECRET>` |
| `ZOHO_DATACENTER` | **Yes** | Regional datacenter domain suffix (`in`, `com`, `eu`, `com.au`) | `in` |
| `ZOHO_REDIRECT_URI` | **Yes** | OAuth redirect URL callback for Zoho login | `https://<YOUR_PRODUCTION_DOMAIN>/api/integrations/zoho/callback` |
| `ZOHO_ORG_SHARED` | **Yes** | Fallback to org-level account when user has no account (`false` recommended) | `false` |

### C. Security & Token Vault Encryption
| Variable | Required? | Description | Example / Production Value |
| :--- | :--- | :--- | :--- |
| `INTEGRATION_ENCRYPTION_KEY` | **Yes** | 64-character (32-byte) hex string for AES-256-GCM encryption | `<64_HEX_CHARACTERS>` |

> [!TIP]
> To generate a fresh encryption key from the terminal, run:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### D. Supabase (Database, Auth, pgvector Knowledge Base)
| Variable | Required? | Description | Example / Production Value |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project URL | `https://<PROJECT_ID>.supabase.co` |
| `SUPABASE_URL` | **Yes** | Server-side Supabase project URL (same as above) | `https://<PROJECT_ID>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| **Yes** | Supabase anon public API key | `eyJhbGciOi...` |
| `SUPABASE_ANON_KEY` | **Yes** | Server-side Supabase anon key | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Recommended**| Supabase service role secret (admin key to bypass RLS) | Found in Supabase Settings → API |
| `DATABASE_URL` | **Yes** | Postgres connection pooling string for database migrations | `postgresql://postgres.<ID>:<PWD>@aws-0-...pooler.supabase.com:6543/postgres?sslmode=require` |

### E. n8n Unified Copilot Webhook
| Variable | Required? | Description | Production Value |
| :--- | :--- | :--- | :--- |
| `N8N_WEBHOOK_URL` | **Yes** | Server-side webhook target for the Prism Copilot Agent | `https://indigo-pelican-266513.hostingersite.com/webhook/7a7d4575-950e-4090-84b4-f5bc3a5c6017/chat` |
| `NEXT_PUBLIC_N8N_WEBHOOK_URL` | **Yes** | Client-side accessible webhook target | `https://indigo-pelican-266513.hostingersite.com/webhook/7a7d4575-950e-4090-84b4-f5bc3a5c6017/chat` |

### F. Optional Scheduler & Operations
| Variable | Required? | Description | Default / Example |
| :--- | :--- | :--- | :--- |
| `TOKEN_REFRESH_INTERVAL_MS` | No | Frequency of the background token refresh daemon | `900000` (15 minutes) |
| `TOKEN_REFRESH_SECRET` | No | Secret for external cron triggers on `POST /api/integrations/refresh-tokens` | Custom alphanumeric secret |

---

## 3. External Provider Portal Configuration

Before deploying, make sure the production redirect URIs are registered in both developer consoles:

### 1. Microsoft Azure Portal (Entra ID)
1. Navigate to **Azure Portal** → **Microsoft Entra ID** → **App registrations**.
2. Select your application (`Budibase-Dynamics-Agent` / `9b9717eb-8dbf-41b1-b788-d7a3ae6f4269`).
3. Under **Manage** → **Authentication** → **Web**, add:
   ```
   https://<YOUR_PRODUCTION_DOMAIN>/api/integrations/microsoft/callback
   ```
4. Check both **Access tokens** and **ID tokens** checkboxes.
5. Click **Save**.

### 2. Zoho API Console
1. Navigate to [Zoho API Console](https://api-console.zoho.in).
2. Select your client (`1000.QGDY8ZROICOLZXB8M0QK3Q41KZ562H`).
3. Under **Client Details** → **Authorized Redirect URIs**, add:
   ```
   https://<YOUR_PRODUCTION_DOMAIN>/api/integrations/zoho/callback
   ```
4. Click **Update**.

---

## 4. Production `.env` Template (Copy & Paste)

```env
# =============================================================================
# Prism, Unified Operations Copilot Production Configuration
# =============================================================================

# ── Microsoft 365 / Azure Entra ID ────────────────────────────────────────────
AZURE_CLIENT_ID=your_azure_client_id_here
NEXT_PUBLIC_AZURE_CLIENT_ID=your_azure_client_id_here
AZURE_CLIENT_SECRET=your_azure_client_secret_here
AZURE_TENANT_ID=common
AZURE_REDIRECT_URI=https://<YOUR_PRODUCTION_DOMAIN>/api/integrations/microsoft/callback
DYNAMICS_CRM_ORG_URL=https://<ORG_NAME>.crm8.dynamics.com

# ── Zoho Multi-Tenant OAuth ───────────────────────────────────────────────────
ZOHO_CLIENT_ID=your_zoho_client_id_here
ZOHO_CLIENT_SECRET=your_zoho_client_secret_here
ZOHO_DATACENTER=in
ZOHO_REDIRECT_URI=https://<YOUR_PRODUCTION_DOMAIN>/api/integrations/zoho/callback
ZOHO_ORG_SHARED=false

# ── Token Vault Encryption (AES-256-GCM) ──────────────────────────────────────
INTEGRATION_ENCRYPTION_KEY=your_64_char_hex_encryption_key_here

# ── Supabase Backend & Database ───────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
DATABASE_URL=postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require

# ── n8n Unified Copilot Webhook (Prism: M365 + Zoho Orchestrator) ─────────────
N8N_WEBHOOK_URL=https://indigo-pelican-266513.hostingersite.com/webhook/7a7d4575-950e-4090-84b4-f5bc3a5c6017/chat
NEXT_PUBLIC_N8N_WEBHOOK_URL=https://indigo-pelican-266513.hostingersite.com/webhook/7a7d4575-950e-4090-84b4-f5bc3a5c6017/chat
```

---

## 5. Post-Deployment Verification Checklist

Once deployed to your hosting platform (Vercel, Render, Railway, etc.), verify with these commands:

1. **Test n8n Webhook Liveness**:
   ```bash
   curl -s -X POST "https://<YOUR_PRODUCTION_DOMAIN>/api/chat" \
     -H "Content-Type: application/json" \
     -d '{"message":"hello"}'
   ```
   *Expected result: SSE stream starting with `Prism Copilot Agent` and introducing its connected capabilities (Microsoft 365, Zoho Suite, Knowledge Base).*

2. **Test Microsoft OAuth Redirect**:
   ```bash
   curl -s -I "https://<YOUR_PRODUCTION_DOMAIN>/api/integrations/microsoft/connect?preset=readonly"
   ```
   *Expected result: HTTP 307 Redirect to `login.microsoftonline.com` with `redirect_uri=https://<YOUR_PRODUCTION_DOMAIN>/api/integrations/microsoft/callback`.*

3. **Test Zoho OAuth Redirect**:
   ```bash
   curl -s -I "https://<YOUR_PRODUCTION_DOMAIN>/api/integrations/zoho/connect?product=crm"
   ```
   *Expected result: HTTP 307 Redirect to `accounts.zoho.in` with `redirect_uri=https://<YOUR_PRODUCTION_DOMAIN>/api/integrations/zoho/callback`.*
