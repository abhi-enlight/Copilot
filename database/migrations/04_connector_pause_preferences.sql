-- ==============================================================================
-- ⏸️ PRISM Migration 04 — Server-Side Connector Pause Preferences
-- ==============================================================================
-- The pause toggle previously lived only in localStorage, so anything that
-- didn't read the browser (the n8n agent, campaign writes, the risk digest)
-- could still touch a paused connector. This migration moves the source of
-- truth into the database so pause is enforced server-side, everywhere.
--
-- Preferences live on the app_users row (one JSONB column) instead of a new
-- table: 7 booleans per user, always read/written as a whole map.
--   { "zoho.crm": false, "microsoft.outlook": true }   absent/true = active
-- ==============================================================================

ALTER TABLE public.app_users
    ADD COLUMN IF NOT EXISTS connector_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.app_users.connector_preferences IS
  'Per-user connector pause map keyed by connector id; absent/true = active, false = paused.';
