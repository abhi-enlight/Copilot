-- ==============================================================================
-- 🔐 PRISM Migration 03 — Token Expiry Tracking for the Refresh Job
-- ==============================================================================
-- The background token-refresh job (src/instrumentation.ts + lib/token-refresher)
-- needs to know *when* each vault token expires so it can refresh proactively
-- instead of waiting for a 401 at call time.
--
-- Backfill: existing rows get expires_at = updated_at + 1h, matching the
-- historical Zoho default lifetime. New rows are written by lib/zoho.ts with
-- the real value from the OAuth response.
-- ==============================================================================

ALTER TABLE public.user_integrations
    ADD COLUMN IF NOT EXISTS access_token_expires_at TIMESTAMPTZ;

ALTER TABLE public.user_integrations
    ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ;

-- Historical rows: we never stored expiry, so approximate it.
UPDATE public.user_integrations
SET access_token_expires_at = updated_at + INTERVAL '1 hour'
WHERE access_token_expires_at IS NULL;

-- Small index for the refresher's "due for refresh" query.
CREATE INDEX IF NOT EXISTS idx_user_integrations_expires
    ON public.user_integrations (access_token_expires_at)
    WHERE access_token_expires_at IS NOT NULL;
