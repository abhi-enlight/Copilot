-- Migration 07: Harden Cross-Tenant and Cross-Schema Isolation

-- 1. Helper functions with SECURITY DEFINER to eliminate RLS recursion and maximize performance
CREATE OR REPLACE FUNCTION public.get_my_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_admin_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin');
$$;

GRANT EXECUTE ON FUNCTION public.get_my_org_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_admin_org_ids() TO authenticated, service_role;

-- 2. Scope campaigns unique constraints to organization_id
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_name_key;
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_org_name_unique;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_org_name_unique UNIQUE (organization_id, name);

ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_zoho_project_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_org_zoho_project_id ON public.campaigns (organization_id, zoho_project_id) WHERE zoho_project_id IS NOT NULL;

-- 3. Update organization_members policies
DROP POLICY IF EXISTS org_members_read ON public.organization_members;
CREATE POLICY org_members_read ON public.organization_members
  FOR SELECT
  TO authenticated, service_role
  USING (
    user_id = auth.uid()
    OR organization_id IN (SELECT public.get_my_org_ids())
    OR (auth.jwt()->>'role') = 'service_role'
  );

-- 4. Update organizations policies
DROP POLICY IF EXISTS orgs_member_read ON public.organizations;
CREATE POLICY orgs_member_read ON public.organizations
  FOR SELECT
  TO authenticated, service_role
  USING (
    id IN (SELECT public.get_my_org_ids())
    OR (auth.jwt()->>'role') = 'service_role'
  );

-- 5. Update campaigns policies
DROP POLICY IF EXISTS campaigns_org_select ON public.campaigns;
CREATE POLICY campaigns_org_select ON public.campaigns
  FOR SELECT
  TO authenticated, service_role
  USING (
    organization_id IN (SELECT public.get_my_org_ids())
    OR (auth.jwt()->>'role') = 'service_role'
  );

DROP POLICY IF EXISTS campaigns_org_insert ON public.campaigns;
CREATE POLICY campaigns_org_insert ON public.campaigns
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (
    organization_id IN (SELECT public.get_my_org_ids())
    OR (auth.jwt()->>'role') = 'service_role'
  );

DROP POLICY IF EXISTS campaigns_org_update ON public.campaigns;
CREATE POLICY campaigns_org_update ON public.campaigns
  FOR UPDATE
  TO authenticated, service_role
  USING (
    organization_id IN (SELECT public.get_my_org_ids())
    OR (auth.jwt()->>'role') = 'service_role'
  )
  WITH CHECK (
    organization_id IN (SELECT public.get_my_org_ids())
    OR (auth.jwt()->>'role') = 'service_role'
  );

DROP POLICY IF EXISTS campaigns_org_delete ON public.campaigns;
CREATE POLICY campaigns_org_delete ON public.campaigns
  FOR DELETE
  TO authenticated, service_role
  USING (
    organization_id IN (SELECT public.get_my_admin_org_ids())
    OR (auth.jwt()->>'role') = 'service_role'
  );

-- 6. Update chat_sessions policies
DROP POLICY IF EXISTS chat_sessions_own ON public.chat_sessions;
CREATE POLICY chat_sessions_own ON public.chat_sessions
  FOR ALL
  TO authenticated, service_role
  USING (
    (
      user_id = auth.uid()
      AND (
        organization_id IS NULL
        OR organization_id IN (SELECT public.get_my_org_ids())
      )
    )
    OR (auth.jwt()->>'role') = 'service_role'
  )
  WITH CHECK (
    (
      user_id = auth.uid()
      AND (
        organization_id IS NULL
        OR organization_id IN (SELECT public.get_my_org_ids())
      )
    )
    OR (auth.jwt()->>'role') = 'service_role'
  );

-- 7. Update tenant_integrations policies
DROP POLICY IF EXISTS tenant_integrations_org_select ON public.tenant_integrations;
CREATE POLICY tenant_integrations_org_select ON public.tenant_integrations
  FOR SELECT
  TO authenticated, service_role
  USING (
    organization_id IN (SELECT public.get_my_org_ids())
    OR (auth.jwt()->>'role') = 'service_role'
  );

DROP POLICY IF EXISTS tenant_integrations_org_write ON public.tenant_integrations;
CREATE POLICY tenant_integrations_org_write ON public.tenant_integrations
  FOR ALL
  TO authenticated, service_role
  USING (
    organization_id IN (SELECT public.get_my_admin_org_ids())
    OR (auth.jwt()->>'role') = 'service_role'
  )
  WITH CHECK (
    organization_id IN (SELECT public.get_my_admin_org_ids())
    OR (auth.jwt()->>'role') = 'service_role'
  );

-- 8. Update user_integrations policies
DROP POLICY IF EXISTS user_integrations_own ON public.user_integrations;
CREATE POLICY user_integrations_own ON public.user_integrations
  FOR ALL
  TO authenticated, service_role
  USING (
    (
      auth_user_id = auth.uid()
      AND (
        organization_id IS NULL
        OR organization_id IN (SELECT public.get_my_org_ids())
      )
    )
    OR (auth.jwt()->>'role') = 'service_role'
  )
  WITH CHECK (
    (
      auth_user_id = auth.uid()
      AND (
        organization_id IS NULL
        OR organization_id IN (SELECT public.get_my_org_ids())
      )
    )
    OR (auth.jwt()->>'role') = 'service_role'
  );

-- 9. Update agent_audit_logs policies
DROP POLICY IF EXISTS agent_audit_logs_org_select ON public.agent_audit_logs;
CREATE POLICY agent_audit_logs_org_select ON public.agent_audit_logs
  FOR SELECT
  TO authenticated, service_role
  USING (
    organization_id IN (SELECT public.get_my_org_ids())
    OR (auth.jwt()->>'role') = 'service_role'
  );

-- 10. Secure app_users_view with security_invoker = true and revoke anon access
ALTER VIEW public.app_users_view SET (security_invoker = true);
REVOKE ALL ON public.app_users_view FROM anon;

-- 11. Strictly revoke access from anon and authenticated on other schemas (BCP, operations_copilot)
REVOKE ALL ON SCHEMA "BCP" FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA "BCP" FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "BCP" FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA "BCP" FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "BCP" REVOKE ALL ON TABLES FROM anon, authenticated;

REVOKE ALL ON SCHEMA "operations_copilot" FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA "operations_copilot" FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "operations_copilot" FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA "operations_copilot" FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "operations_copilot" REVOKE ALL ON TABLES FROM anon, authenticated;
