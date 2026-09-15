-- ==============================================================================
-- 🔐 PRISM Migration 08 — Enterprise SSO Domain Registry (Identifier-First Login)
-- ==============================================================================
-- The identifier-first login flow (docs/MULTI_TENANT_ARCHITECTURE_AND_PLAN.md §3)
-- needs a server-side mapping from a corporate email domain (e.g. "acme.com")
-- to an organization + SSO provider, so the login screen can redirect employees
-- straight to their Entra ID / SAML endpoint instead of showing a password box.
--
-- Plan edge case #2 (domain collisions): a domain row is only trusted for
-- auto-SSO after DNS TXT verification. Unverified domains are ignored by the
-- resolver and explicit invites remain the only join path.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.organization_sso_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'azure_entra' CHECK (provider IN ('azure_entra', 'saml')),
    -- Entra tenant the employee is redirected to (directory ID or "common").
    sso_tenant_id TEXT,
    -- DNS TXT verification: value the customer must publish at
    -- _prism-verification.<domain>; NULL while pending.
    verification_token TEXT,
    dns_verified_at TIMESTAMPTZ,
    -- Only verified domains are offered for auto-SSO redirect.
    is_verified BOOLEAN NOT NULL GENERATED ALWAYS AS (dns_verified_at IS NOT NULL) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(domain)
);

CREATE INDEX IF NOT EXISTS idx_sso_domains_domain ON public.organization_sso_domains(domain);
CREATE INDEX IF NOT EXISTS idx_sso_domains_org ON public.organization_sso_domains(organization_id);

ALTER TABLE public.organization_sso_domains ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user may resolve a domain (the login screen needs it
-- before authentication happens, so the anon resolver API uses the service
-- role; this policy covers signed-in users checking their own org config).
DROP POLICY IF EXISTS sso_domains_read ON public.organization_sso_domains;
CREATE POLICY sso_domains_read ON public.organization_sso_domains
    FOR SELECT
    TO authenticated, service_role
    USING (
        organization_id IN (SELECT public.get_my_org_ids())
        OR (auth.jwt() ->> 'role') = 'service_role'
    );

-- Write: org admins/owners only (service role manages verification flow).
DROP POLICY IF EXISTS sso_domains_write ON public.organization_sso_domains;
CREATE POLICY sso_domains_write ON public.organization_sso_domains
    FOR ALL
    TO authenticated, service_role
    USING (
        organization_id IN (SELECT public.get_my_admin_org_ids())
        OR (auth.jwt() ->> 'role') = 'service_role'
    )
    WITH CHECK (
        organization_id IN (SELECT public.get_my_admin_org_ids())
        OR (auth.jwt() ->> 'role') = 'service_role'
    );
