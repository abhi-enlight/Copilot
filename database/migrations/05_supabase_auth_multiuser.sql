-- ==============================================================================
-- 🔐 PRISM Migration 05 — Supabase Auth + Multi-User + Multi-Org + Chat Persistence
-- ==============================================================================
-- Adds real authentication via Supabase Auth (auth.users).
-- Every table is now scoped to auth.uid() via RLS.
--
-- Key changes:
--   1. Link app_users to auth.users via auth_user_id
--   2. Public organizations + organization_members tables (app-usable, RLS-protected)
--   3. chat_sessions + chat_messages tables for full persistence
--   4. organization_id on user_integrations for org-scoped connections
--   5. Fix the connector-preferences upsert race (role DEFAULT 'member' hardened)
--   6. All RLS policies switched from service_role-only to auth.uid()-scoped
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Link app_users to Supabase Auth
-- ─────────────────────────────────────────────────────────────────────────────

-- Add auth_user_id column if it doesn't exist
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- Harden the role column: ensure DEFAULT is always applied (fixes the upsert race)
ALTER TABLE public.app_users
  ALTER COLUMN role SET DEFAULT 'member';

-- Ensure role can never be NULL (in case of partial inserts)
UPDATE public.app_users SET role = 'member' WHERE role IS NULL;
ALTER TABLE public.app_users ALTER COLUMN role SET NOT NULL;

-- Ensure display_name column exists
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Index for auth_user_id lookups
CREATE INDEX IF NOT EXISTS idx_app_users_auth_user_id ON public.app_users(auth_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Organizations (public schema, RLS-protected)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'personal' CHECK (type IN ('personal', 'team', 'enterprise')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON public.organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Organization Members
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.organization_members(organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Chat Sessions (persisted, resumable)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_org_id ON public.chat_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON public.chat_sessions(updated_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Chat Messages
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  source_badges TEXT[] NOT NULL DEFAULT '{}',
  tool_calls JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON public.chat_messages(created_at ASC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Add organization_id to user_integrations
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_integrations
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Add auth_user_id to user_integrations for direct auth linkage
ALTER TABLE public.user_integrations
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_user_integrations_auth_user_id ON public.user_integrations(auth_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS: Drop old service_role-only policies, add auth.uid()-scoped policies
-- ─────────────────────────────────────────────────────────────────────────────

-- app_users: users can read/update their own row; service role has full access
DROP POLICY IF EXISTS service_role_only ON public.app_users;
DROP POLICY IF EXISTS app_users_self_read ON public.app_users;
DROP POLICY IF EXISTS app_users_self_update ON public.app_users;
DROP POLICY IF EXISTS app_users_service_role ON public.app_users;

CREATE POLICY app_users_self_read ON public.app_users
  FOR SELECT
  USING (
    auth_user_id = auth.uid()
    OR auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY app_users_self_update ON public.app_users
  FOR UPDATE
  USING (auth_user_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth_user_id = auth.uid() OR auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY app_users_service_insert ON public.app_users
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- user_integrations: users see only their own tokens; service role full access
DROP POLICY IF EXISTS service_role_only ON public.user_integrations;
DROP POLICY IF EXISTS user_integrations_own ON public.user_integrations;

CREATE POLICY user_integrations_own ON public.user_integrations
  FOR ALL
  USING (
    auth_user_id = auth.uid()
    OR auth.jwt() ->> 'role' = 'service_role'
  )
  WITH CHECK (
    auth_user_id = auth.uid()
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- agent_audit_logs: service role only (never read by end users)
DROP POLICY IF EXISTS service_role_only ON public.agent_audit_logs;
CREATE POLICY agent_audit_logs_service_role ON public.agent_audit_logs
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RLS for new tables
-- ─────────────────────────────────────────────────────────────────────────────

-- organizations: visible to members
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY orgs_member_read ON public.organizations
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
    OR auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY orgs_owner_insert ON public.organizations
  FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    OR auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY orgs_owner_update ON public.organizations
  FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR auth.jwt() ->> 'role' = 'service_role'
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY orgs_owner_delete ON public.organizations
  FOR DELETE
  USING (
    owner_id = auth.uid()
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- organization_members: visible to members of the same org
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_members_read ON public.organization_members
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
    OR auth.jwt() ->> 'role' = 'service_role'
  );

CREATE POLICY org_members_write ON public.organization_members
  FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY org_members_delete ON public.organization_members
  FOR DELETE
  USING (
    -- Can remove self
    user_id = auth.uid()
    -- Or admin/owner of the org can remove others
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- chat_sessions: scoped to the owning user
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_sessions_own ON public.chat_sessions
  FOR ALL
  USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'role' = 'service_role'
  )
  WITH CHECK (
    user_id = auth.uid()
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- chat_messages: scoped via session ownership
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_messages_own ON public.chat_messages
  FOR ALL
  USING (
    session_id IN (
      SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()
    )
    OR auth.jwt() ->> 'role' = 'service_role'
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM public.chat_sessions WHERE user_id = auth.uid()
    )
    OR auth.jwt() ->> 'role' = 'service_role'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Trigger: auto-update updated_at on chat_sessions when messages are added
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_chat_session_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.chat_sessions SET updated_at = NOW() WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_message_bumps_session ON public.chat_messages;
CREATE TRIGGER trg_chat_message_bumps_session
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_chat_session_timestamp();

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Updated app_users_view (includes auth_user_id)
-- ─────────────────────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS public.app_users_view CASCADE;
CREATE VIEW public.app_users_view AS
  SELECT email, display_name, role, m365_user_id, auth_user_id, created_at, updated_at
  FROM public.app_users;
