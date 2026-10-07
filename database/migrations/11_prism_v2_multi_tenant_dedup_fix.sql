-- ==============================================================================
-- PRISM V2 — MIGRATION 11: MULTI-TENANT DEDUPLICATION INDEX FIX
-- ==============================================================================
-- Scopes idx_activity_events_dedup by user_id so two users receiving events
-- with the same external ID (e.g. shared repository, group email thread)
-- do not collide or drop events for one another.

DROP INDEX IF EXISTS public.idx_activity_events_dedup;

CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_events_dedup 
  ON public.activity_events(user_id, source, external_id) 
  WHERE external_id IS NOT NULL;
