-- =====================================================================
-- PRISM v2: connector vault, org-scoped knowledge base, audit log
-- Migration: 09_prism_v2_connector_vault.sql
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

-- Only service-role (Edge Functions / Backend) touches the vault directly.
-- No policies => RLS denies everything except service_role.

-- 1b. Org-scoped knowledge base hardening
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
  embedding vector(768),               -- Gemini text-embedding-004 = 768
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
-- callable only via service_role

-- 1c. Audit log for push + failures
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

do $$
begin
  if not exists (
    select 1 from pg_policies 
    where tablename = 'agent_audit_logs' and policyname = 'org members read own org audit logs'
  ) then
    create policy "org members read own org audit logs"
      on public.agent_audit_logs for select
      using (organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid);
  end if;
end $$;

-- 1d. Campaign push idempotency columns (skip if already present)
alter table public.campaigns
  add column if not exists deal_id text,
  add column if not exists project_id text,
  add column if not exists invoice_id text;
