-- Migration 06: Strict Multi-Tenant Isolation and RLS Hardening

-- 1. Hardening campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_organization_id ON public.campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON public.campaigns(created_by);

-- Delete orphaned / unassigned legacy seed campaigns so new workspaces start clean
DELETE FROM public.campaigns WHERE organization_id IS NULL;

-- Drop open RLS policies on campaigns
DROP POLICY IF EXISTS "Allow anon all on campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Allow authenticated all on campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Allow service_role all on campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_org_select" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_org_insert" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_org_update" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_org_delete" ON public.campaigns;

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Campaigns RLS: Organization members only
CREATE POLICY "campaigns_org_select" ON public.campaigns
  FOR SELECT
  TO authenticated, service_role
  USING (
    (organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ))
    OR ((auth.jwt() ->> 'role') = 'service_role')
  );

CREATE POLICY "campaigns_org_insert" ON public.campaigns
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (
    (organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ))
    OR ((auth.jwt() ->> 'role') = 'service_role')
  );

CREATE POLICY "campaigns_org_update" ON public.campaigns
  FOR UPDATE
  TO authenticated, service_role
  USING (
    (organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ))
    OR ((auth.jwt() ->> 'role') = 'service_role')
  );

CREATE POLICY "campaigns_org_delete" ON public.campaigns
  FOR DELETE
  TO authenticated, service_role
  USING (
    (organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ))
    OR ((auth.jwt() ->> 'role') = 'service_role')
  );

-- 2. Drop rogue open policies across user_integrations, app_users, and agent_audit_logs
DROP POLICY IF EXISTS "allow_service_and_anon" ON public.user_integrations;
DROP POLICY IF EXISTS "allow_service_and_anon" ON public.app_users;
DROP POLICY IF EXISTS "allow_service_and_anon" ON public.agent_audit_logs;

-- Ensure user_integrations is strictly per-user and per-org
DROP POLICY IF EXISTS "user_integrations_own" ON public.user_integrations;
CREATE POLICY "user_integrations_own" ON public.user_integrations
  FOR ALL
  TO authenticated, service_role
  USING (
    (auth_user_id = auth.uid()) 
    OR ((auth.jwt() ->> 'role') = 'service_role')
  )
  WITH CHECK (
    (auth_user_id = auth.uid()) 
    OR ((auth.jwt() ->> 'role') = 'service_role')
  );

-- Allow organization colleagues to view each other's app_users profile (display name / email)
DROP POLICY IF EXISTS "app_users_org_colleagues_read" ON public.app_users;
CREATE POLICY "app_users_org_colleagues_read" ON public.app_users
  FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid()
    OR auth_user_id IN (
      SELECT om.user_id 
      FROM public.organization_members om 
      WHERE om.organization_id IN (
        SELECT my_om.organization_id 
        FROM public.organization_members my_om 
        WHERE my_om.user_id = auth.uid()
      )
    )
  );

-- 3. Hardening agent_audit_logs
ALTER TABLE public.agent_audit_logs
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_org_id ON public.agent_audit_logs(organization_id);

DROP POLICY IF EXISTS "agent_audit_logs_org_select" ON public.agent_audit_logs;
CREATE POLICY "agent_audit_logs_org_select" ON public.agent_audit_logs
  FOR SELECT
  TO authenticated, service_role
  USING (
    (organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ))
    OR ((auth.jwt() ->> 'role') = 'service_role')
  );

-- 4. Hardening tenant_integrations
DROP POLICY IF EXISTS "tenant_integrations_org_select" ON public.tenant_integrations;
DROP POLICY IF EXISTS "tenant_integrations_org_write" ON public.tenant_integrations;

CREATE POLICY "tenant_integrations_org_select" ON public.tenant_integrations
  FOR SELECT
  TO authenticated, service_role
  USING (
    (organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    ))
    OR ((auth.jwt() ->> 'role') = 'service_role')
  );

CREATE POLICY "tenant_integrations_org_write" ON public.tenant_integrations
  FOR ALL
  TO authenticated, service_role
  USING (
    (organization_id IN (
      SELECT organization_id FROM public.organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ))
    OR ((auth.jwt() ->> 'role') = 'service_role')
  );
