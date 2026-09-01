-- ==============================================================================
-- 🚀 ENTERPRISE MULTI-TENANT ARCHITECTURE & MUTUAL ROLE ISOLATION
-- ==============================================================================

-- 1. Create Isolated Schemas
CREATE SCHEMA IF NOT EXISTS operations_copilot;
CREATE SCHEMA IF NOT EXISTS "BCP";

-- 2. Create Multi-Tenant Tables in operations_copilot
CREATE TABLE IF NOT EXISTS operations_copilot.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operations_copilot.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES operations_copilot.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Member' CHECK (role IN ('Owner', 'Admin', 'Member', 'Customizer')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS operations_copilot.tenant_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES operations_copilot.organizations(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('microsoft_365', 'dynamics_365', 'outlook', 'custom_db')),
    endpoint_url TEXT,
    credentials_encrypted TEXT,
    scopes TEXT[],
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'error', 'pending_consent')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operations_copilot.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES operations_copilot.organizations(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    user_id UUID,
    title VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row-Level Security (RLS)
ALTER TABLE operations_copilot.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_copilot.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_copilot.tenant_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_copilot.chat_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
CREATE POLICY copilot_org_isolation_policy ON operations_copilot.organizations
    FOR ALL
    USING (
        id IN (
            SELECT organization_id FROM operations_copilot.organization_members
            WHERE user_id = auth.uid()
        )
        OR auth.jwt() ->> 'role' = 'service_role'
    );

CREATE POLICY copilot_member_isolation_policy ON operations_copilot.organization_members
    FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM operations_copilot.organization_members
            WHERE user_id = auth.uid()
        )
        OR auth.jwt() ->> 'role' = 'service_role'
    );

CREATE POLICY copilot_integrations_isolation_policy ON operations_copilot.tenant_integrations
    FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM operations_copilot.organization_members
            WHERE user_id = auth.uid()
        )
        OR auth.jwt() ->> 'role' = 'service_role'
    );

CREATE POLICY copilot_sessions_isolation_policy ON operations_copilot.chat_sessions
    FOR ALL
    USING (
        organization_id IN (
            SELECT organization_id FROM operations_copilot.organization_members
            WHERE user_id = auth.uid()
        )
        OR auth.jwt() ->> 'role' = 'service_role'
    );

-- 5. Dedicated Mutual Zero-Access Roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'copilot_agent_role') THEN
        CREATE ROLE copilot_agent_role;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bcp_agent_role') THEN
        CREATE ROLE bcp_agent_role;
    END IF;
END $$;

-- Enforce Strict Isolation
GRANT USAGE ON SCHEMA operations_copilot TO copilot_agent_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA operations_copilot TO copilot_agent_role;
REVOKE ALL PRIVILEGES ON SCHEMA "BCP" FROM copilot_agent_role;

GRANT USAGE ON SCHEMA "BCP" TO bcp_agent_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "BCP" TO bcp_agent_role;
REVOKE ALL PRIVILEGES ON SCHEMA operations_copilot FROM bcp_agent_role;
