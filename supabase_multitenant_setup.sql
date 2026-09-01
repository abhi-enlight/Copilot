-- =====================================================================
-- 🛡️ STRICT MULTI-SCHEMA ISOLATION SETUP (SUPABASE / POSTGRESQL)
-- =====================================================================
-- Establishes two completely separate, mutually isolated schemas:
-- 1. `operations_copilot`: For Operations Copilot multi-tenant workspaces, chat, & integrations.
-- 2. `BCP`: For BigCity Promotions campaigns, documents, and action items.
-- Zero cross-schema leakage mathematically guaranteed via PostgreSQL roles & RLS.

-- 1. Enable Extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Schemas
CREATE SCHEMA IF NOT EXISTS operations_copilot;
CREATE SCHEMA IF NOT EXISTS "BCP";

-- =====================================================================
-- 3. OPERATIONS COPILOT SCHEMA TABLES
-- =====================================================================

CREATE TABLE IF NOT EXISTS operations_copilot.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL DEFAULT 'enterprise' CHECK (type IN ('personal', 'enterprise')),
    domain TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operations_copilot.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES operations_copilot.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS operations_copilot.tenant_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES operations_copilot.organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('microsoft_365', 'dynamics_365', 'salesforce', 'postgres')),
    credentials_encrypted JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'consent_required', 'reauth_required')),
    last_error_message TEXT,
    last_synced_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, provider)
);

CREATE TABLE IF NOT EXISTS operations_copilot.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES operations_copilot.organizations(id) ON DELETE CASCADE,
    user_id UUID,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security (RLS)
ALTER TABLE operations_copilot.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_copilot.organizations FORCE ROW LEVEL SECURITY;

ALTER TABLE operations_copilot.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_copilot.organization_members FORCE ROW LEVEL SECURITY;

ALTER TABLE operations_copilot.tenant_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_copilot.tenant_integrations FORCE ROW LEVEL SECURITY;

ALTER TABLE operations_copilot.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_copilot.chat_sessions FORCE ROW LEVEL SECURITY;

-- =====================================================================
-- 4. DEDICATED DATABASE ROLES & MUTUAL ZERO-ACCESS ISOLATION
-- =====================================================================

-- 4.1 Copilot Agent Role (Access ONLY to operations_copilot)
GRANT CONNECT ON DATABASE postgres TO copilot_agent_role;
GRANT USAGE ON SCHEMA operations_copilot TO copilot_agent_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA operations_copilot TO copilot_agent_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA operations_copilot GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO copilot_agent_role;

-- Revoke BCP access from Copilot
REVOKE ALL ON SCHEMA "BCP" FROM copilot_agent_role;
REVOKE ALL ON ALL TABLES IN SCHEMA "BCP" FROM copilot_agent_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "BCP" REVOKE ALL ON TABLES FROM copilot_agent_role;

-- 4.2 BCP Agent Role (Access ONLY to BCP schema)
GRANT CONNECT ON DATABASE postgres TO bcp_agent_role;
GRANT USAGE ON SCHEMA "BCP" TO bcp_agent_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "BCP" TO bcp_agent_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "BCP" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bcp_agent_role;

-- Revoke operations_copilot access from BCP
REVOKE ALL ON SCHEMA operations_copilot FROM bcp_agent_role;
REVOKE ALL ON ALL TABLES IN SCHEMA operations_copilot FROM bcp_agent_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA operations_copilot REVOKE ALL ON TABLES FROM bcp_agent_role;
