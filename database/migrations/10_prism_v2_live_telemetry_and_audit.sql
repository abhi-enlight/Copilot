-- =====================================================================
-- PRISM V2: Live Stack Telemetry, Audit Ledger & Chat Runtime Extensions
-- Migration: 10_prism_v2_live_telemetry_and_audit.sql
-- Status: LOCKED FOR MVP (Hardened with Deduplication & Anti-Leak RLS)
-- =====================================================================

-- ── 1. Canonical Human-in-the-Loop Audit Ledger ─────────────────────
-- Preserve existing audit logs table if it exists by archiving to agent_audit_logs_legacy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'agent_audit_logs'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'agent_audit_logs_legacy'
  ) THEN
    ALTER TABLE public.agent_audit_logs RENAME TO agent_audit_logs_legacy;
  END IF;
END $$;

-- Create canonical HITL action proposal & execution ledger
CREATE TABLE IF NOT EXISTS public.agent_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT NOT NULL DEFAULT '',
  tool_slug TEXT NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'executed' CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'failed')),
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  execution_result JSONB,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  signature_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure columns exist if table was partially created
ALTER TABLE public.agent_audit_logs ADD COLUMN IF NOT EXISTS actor_email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.agent_audit_logs ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.agent_audit_logs REPLICA IDENTITY FULL;

CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_user 
  ON public.agent_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_org 
  ON public.agent_audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_pending 
  ON public.agent_audit_logs(user_id, status) WHERE status = 'pending';

ALTER TABLE public.agent_audit_logs ENABLE ROW LEVEL SECURITY;

-- Hardened RLS: Pending personal drafts are strictly private to the creator.
-- Org owners/admins can review executed compliance logs for their org.
DROP POLICY IF EXISTS "agent_audit_logs_select" ON public.agent_audit_logs;
CREATE POLICY "agent_audit_logs_select"
  ON public.agent_audit_logs
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    (auth.jwt() ->> 'role') = 'service_role' OR
    (
      status NOT IN ('pending', 'rejected') AND
      organization_id IN (
        SELECT organization_id FROM public.organization_members 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "agent_audit_logs_update_approval" ON public.agent_audit_logs;
CREATE POLICY "agent_audit_logs_update_approval"
  ON public.agent_audit_logs
  FOR UPDATE
  USING (
    auth.uid() = user_id OR
    (auth.jwt() ->> 'role') = 'service_role'
  )
  WITH CHECK (
    auth.uid() = user_id OR
    (auth.jwt() ->> 'role') = 'service_role'
  );

DROP POLICY IF EXISTS "agent_audit_logs_insert" ON public.agent_audit_logs;
CREATE POLICY "agent_audit_logs_insert"
  ON public.agent_audit_logs
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR
    (auth.jwt() ->> 'role') = 'service_role'
  );


-- ── 2. Live Stack Telemetry Feed (activity_events) ─────────────────
CREATE TABLE IF NOT EXISTS public.activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  external_id TEXT,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'urgent', 'critical')),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  actionable BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure columns and settings exist
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE public.activity_events REPLICA IDENTITY FULL;

-- Webhook deduplication unique index (scoped per user, source, external_id)
DROP INDEX IF EXISTS public.idx_activity_events_dedup;
CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_events_dedup 
  ON public.activity_events(user_id, source, external_id) WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_events_user 
  ON public.activity_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_org 
  ON public.activity_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_unread 
  ON public.activity_events(user_id, is_read, created_at DESC);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

-- Hardened RLS: Personal events (user_id set) visible only to owner.
-- Org broadcast events (user_id null) visible to all members of that org.
DROP POLICY IF EXISTS "activity_events_select" ON public.activity_events;
CREATE POLICY "activity_events_select"
  ON public.activity_events
  FOR SELECT
  USING (
    auth.uid() = user_id OR
    (
      user_id IS NULL AND
      organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      )
    ) OR
    (auth.jwt() ->> 'role') = 'service_role'
  );

DROP POLICY IF EXISTS "activity_events_update" ON public.activity_events;
CREATE POLICY "activity_events_update"
  ON public.activity_events
  FOR UPDATE
  USING (
    auth.uid() = user_id OR
    (auth.jwt() ->> 'role') = 'service_role'
  )
  WITH CHECK (
    auth.uid() = user_id OR
    (auth.jwt() ->> 'role') = 'service_role'
  );

DROP POLICY IF EXISTS "activity_events_insert" ON public.activity_events;
CREATE POLICY "activity_events_insert"
  ON public.activity_events
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR
    (auth.jwt() ->> 'role') = 'service_role'
  );

-- Enable Realtime for activity_events
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'activity_events'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_events;
    END IF;
  END IF;
END $$;


-- ── 3. Chat Messages Role Constraint & Action Proposals ─────────────
ALTER TABLE public.chat_messages 
  DROP CONSTRAINT IF EXISTS chat_messages_role_check;

ALTER TABLE public.chat_messages 
  ADD CONSTRAINT chat_messages_role_check 
  CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text, 'tool'::text]));

ALTER TABLE public.chat_messages 
  ADD COLUMN IF NOT EXISTS action_proposals JSONB DEFAULT '[]'::jsonb;


-- ── 4. Chat Sessions Pinned State ──────────────────────────────────
ALTER TABLE public.chat_sessions 
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;


-- ── 5. User Profile Extensions (Avatar & Composio Entity Identity) ──
ALTER TABLE public.app_users 
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.app_users 
  ADD COLUMN IF NOT EXISTS composio_entity_id TEXT;
