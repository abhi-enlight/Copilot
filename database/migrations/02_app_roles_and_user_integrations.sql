-- ==============================================================================
-- 🔐 PRISM Migration 02 — App Role Registry & Per-User Integration Vault
-- ==============================================================================
-- Backs two product requirements:
--   1. CRM access gating: a user holds an app role (Owner/Admin/Member). Admin
--      and Owner override a failed provider entitlement probe (e.g. an admin
--      who was granted the privilege after login unlocks CRM on re-check).
--   2. Zoho multi-tenancy: every user connects their own Zoho account via
--      OAuth. Access/refresh tokens live per user + product in this vault,
--      encrypted at rest with INTEGRATION_ENCRYPTION_KEY (AES-256-GCM).
-- ==============================================================================

-- 1. App users (email-keyed; the app authenticates via Microsoft session cookies)
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    display_name TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    m365_user_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Per-user integration token vault (Zoho today; extensible to any provider)
CREATE TABLE IF NOT EXISTS public.user_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL REFERENCES public.app_users(email) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('zoho', 'microsoft')),
    product VARCHAR(50) NOT NULL CHECK (product IN ('crm', 'projects', 'books', 'mail', 'sharepoint')),
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    -- Discovered from the user's own Zoho account at connect time; replaces
    -- the legacy hard-coded org IDs / data center for this user.
    zoho_user_id TEXT,
    zoho_data_center TEXT,
    zoho_crm_org_id TEXT,
    zoho_portal_id TEXT,
    zoho_books_org_id TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'reauth_required')),
    last_error_message TEXT,
    last_probed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_email, provider, product)
);

CREATE INDEX IF NOT EXISTS idx_user_integrations_email ON public.user_integrations(user_email);

-- 3. Audit trail for every AI / user-initiated write action
CREATE TABLE IF NOT EXISTS public.agent_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_email TEXT,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    payload_summary JSONB,
    outcome VARCHAR(20) NOT NULL DEFAULT 'success' CHECK (outcome IN ('success', 'failure', 'refused')),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Row-Level Security
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_audit_logs ENABLE ROW LEVEL SECURITY;

-- The Next.js server reads/writes these tables with the service-role key only
-- (no Supabase Auth sessions exist in this app — auth is Microsoft cookies).
-- Lock everything down: only the service role may pass; browsers get nothing.
DROP POLICY IF EXISTS service_role_only ON public.app_users;
CREATE POLICY service_role_only ON public.app_users
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS service_role_only ON public.user_integrations;
CREATE POLICY service_role_only ON public.user_integrations
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS service_role_only ON public.agent_audit_logs;
CREATE POLICY service_role_only ON public.agent_audit_logs
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role')
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- 5. Read-only convenience view for the Users & Roles admin UI
CREATE OR REPLACE VIEW public.app_users_view AS
    SELECT email, display_name, role, m365_user_id, created_at, updated_at
    FROM public.app_users;
