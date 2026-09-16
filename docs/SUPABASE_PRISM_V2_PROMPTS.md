# Prism n8n v2 — Supabase Change Prompts

The n8n v2 rebuild is **live and verified**. Everything below is optional hardening — the
hybrid trust model means all 14 workflows already run green without any of it (server-side
context resolution is attempted first; on any failure they fall back to request-supplied
context, which is exactly what the frontend sends today).

Apply these three prompts to Supabase (in order). After step 1 deploys, set
`SUPABASE_URL` on the n8n side (see §5) and refusals like `missing_token` will start
resolving from the encrypted vault instead of relying on frontend-provided tokens.

---

## 1) SQL migration — connector vault + org-scoped KB + audit log

Paste this into the Supabase SQL editor (or a new migration file):

```sql
-- =====================================================================
-- PRISM v2: connector vault, org-scoped knowledge base, audit log
-- =====================================================================

-- 1a. Connector vault (per-org, per-connector credentials + entitlement)
create table if not exists public.prism_connector_vault (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connector_id text not null check (connector_id in (
    'microsoft.outlook', 'microsoft.sharepoint', 'microsoft.dynamics',
    'zoho.crm', 'zoho.projects', 'zoho.books', 'internal.kb'
  )),
  enabled boolean not null default true,
  entitlement boolean not null default false,
  access_token_enc bytea,              -- AES-256-GCM ciphertext
  refresh_token_enc bytea,             -- AES-256-GCM ciphertext
  expires_at timestamptz,
  org_config jsonb not null default '{}'::jsonb,
  -- zoho: { "dataCenter": "in", "crmOrgUrl": "https://crm.zoho.in", "orgId": "..." }
  -- ms:   { "tenantId": "...", "dynamicsInstanceUrl": "https://org.crm.dynamics.com" }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, connector_id)
);
create index if not exists prism_connector_vault_org_idx
  on public.prism_connector_vault (organization_id, connector_id);

alter table public.prism_connector_vault enable row level security;

-- Only service-role (Edge Functions) touches the vault directly.
-- No policies => RLS denies everything except service_role.

-- 1b. Org-scoped knowledge base hardening
-- (If kb_documents / kb_document_chunks already exist, this only ADDS what's missing.)
create table if not exists public.kb_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  source_type text not null default 'upload',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kb_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.kb_documents(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content text not null,
  embedding vector(768),               -- match your embedding model (Gemini text-embedding-004 = 768)
  created_at timestamptz not null default now()
);
create index if not exists kb_chunks_embedding_idx
  on public.kb_document_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists kb_chunks_org_idx on public.kb_document_chunks (organization_id);

-- Org-scoped match function (replaces any unscoped match_documents)
create or replace function public.match_kb_chunks_org(
  p_organization_id uuid,
  p_query_embedding vector(768),
  p_match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language sql stable security invoker as $$
  select c.id, c.document_id, c.content,
         1 - (c.embedding <=> p_query_embedding) as similarity
  from public.kb_document_chunks c
  where c.organization_id = p_organization_id
  order by c.embedding <=> p_query_embedding
  limit greatest(p_match_count, 1)
$$;

revoke all on function public.match_kb_chunks_org from public;
-- callable only via service_role (n8n uses the service key through the Edge Function)

-- 1c. Audit log for push + failures (already partially used by frontend; additive)
create table if not exists public.agent_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  user_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);
create index if not exists agent_audit_logs_org_time_idx
  on public.agent_audit_logs (organization_id, created_at desc);

alter table public.agent_audit_logs enable row level security;
create policy "org members read own org audit logs"
  on public.agent_audit_logs for select
  using (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);

-- 1d. Campaign push idempotency columns (skip if already present)
alter table public.campaigns
  add column if not exists deal_id text,
  add column if not exists project_id text,
  add column if not exists invoice_id text;
```

---

## 2) Edge Function `prism-connector-context` — token/entitlement resolver

Create via `supabase functions new prism-connector-context`, paste, then
`supabase functions deploy prism-connector-context`.

Prompt for your AI assistant / own implementation:

> Create a Deno Edge Function `prism-connector-context` (POST only). It receives
> `{ organizationId, userId, connectorId }` and returns the decrypted connector
> context for that org. Behavior:
>
> 1. **Auth**: require the n8n shared secret — compare the incoming
>    `x-prism-secret` header against the env var `PRISM_N8N_SECRET` (fail closed, 401).
> 2. **Vault lookup**: `select * from prism_connector_vault
>    where organization_id = $1 and connector_id = $2` using the service-role key.
> 3. **Decrypt** `access_token_enc` / `refresh_token_enc` with AES-256-GCM using key
>    `PRISM_VAULT_KEY` (base64, 32 bytes; ciphertext layout `[12-byte iv][ciphertext][16-byte tag]`).
> 4. **Response shape (200)** — this is the exact contract the n8n Resolver (Prism 00) expects:
>    ```json
>    {
>      "accessToken": "…",
>      "enabled": true,
>      "entitlement": true,
>      "orgConfig": { "dataCenter": "in", "crmOrgUrl": "https://crm.zoho.in" },
>      "expiresAt": "2026-09-15T18:00:00Z"
>    }
>    ```
> 5. **404** if no vault row; **410** with `{ "error": "reauth_required" }` if
>    `expires_at` is past (n8n relays this as the `reauth_required` refusal).
> 6. No logging of tokens. Never echo the refresh token.

---

## 3) Edge Function `prism-token-refresh` — background refresher (called by cron)

> Create a Deno Edge Function `prism-token-refresh` (POST). Called every 15 minutes by
> n8n workflow “Prism 18 - Token Refresh & Health” with header `x-prism-secret`.
>
> 1. Verify `x-prism-secret` === env `PRISM_N8N_SECRET` (401 otherwise).
> 2. Query all vault rows where `expires_at < now() + interval '1 hour'`.
> 3. For each, refresh the provider token using the decrypted refresh token:
>    - Microsoft: `POST https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token`
>    - Zoho: `POST https://accounts.zoho.{dataCenter}/oauth/v2/token` (`refresh_token` + `client_id` + `client_secret` + `grant_type=refresh_token`)
> 4. Re-encrypt and update `access_token_enc`, `expires_at`.
> 5. Write one row to `agent_audit_logs` per attempt (`action: 'token_refresh'`,
>    `details: { connectorId, ok }`).
> 6. Return `{ "refreshed": n, "failed": m, "failures": [ {connectorId, orgId, reason} ] }`
>    — n8n logs this verbatim into `agent_audit_logs` and its own execution log.

---

## 4) What changed in n8n (reference)

14 new workflows replaced the 10 old ones. Old workflows are archived (not deleted).

| Workflow | Role | Trigger |
|---|---|---|
| Prism 00 – Tenant Context Resolver | Decrypts vault / resolves entitlements (Supabase) | Sub-workflow (Execute Workflow) |
| Prism 01 – Unified Copilot | Gemini agent, 7 org-scoped tools | Chat (streaming) |
| Prism 02 – Intent Router | Classifies requests into tool routes | Webhook `/prism-intent` |
| Prism 09 – Admin Consent Helper | Microsoft admin-consent callback | Webhook `/prism-admin-consent` |
| Prism 10/11/12 – Outlook / SharePoint / Dynamics | Microsoft read services | Sub-workflow |
| Prism 13/14/15 – Zoho CRM / Projects / Books | Zoho read services | Sub-workflow |
| Prism 16 – Knowledge Base | Org-scoped pgvector semantic search | Sub-workflow |
| Prism 17 – Zoho Push | Approval-gated Deal→Project→Invoice writes | Webhook `/prism-zoho-push` |
| Prism 18 – Token Refresh & Health | Cron (15 min) → `prism-token-refresh` | Schedule |
| Prism 19 – Error Logger & Health | errorWorkflow for all 13 others | Error trigger |

**New frontend env var** (one-line change — the old Copilot webhook ID was reused by
name, not ID, so the URL changed):

```bash
N8N_COPILOT_WEBHOOK_URL=https://indigo-pelican-266513.hostingersite.com/webhook/7c41498d-23d7-482a-9adb-4a3604ec1efb/chat
```

**One-click manual check (optional):** open n8n → Prism folder → confirm the 14
workflows appear there; drag any strays into the folder (the MCP API surface doesn't
report/populate folder membership, so this is cosmetic — execution is unaffected).

---

## 5) Optional env vars to set in n8n (Settings → Variables)

| Variable | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL` | 00, 17, 18, 19 | Base URL for Edge Function calls (value `https://ejawdvxnddgkcgkasove.supabase.co`) |
| `PRISM_N8N_SECRET` | 18 (header), Edge Functions | Shared secret between n8n and Supabase |
| `PRISM_ERROR_WEBHOOK_URL` | 19 | Optional external alerting (Slack/Teams) |

The Supabase **URL is not secret** (it's public), so it's safe as a workflow variable or
literal; the **service key stays in the n8n Supabase credential** (already attached to
00, 16, 17, 19).
