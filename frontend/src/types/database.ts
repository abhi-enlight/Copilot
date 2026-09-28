/**
 * Database schema and row contracts for Prism V2.
 * Mirrors PostgreSQL tables managed in database/migrations/10_prism_v2_live_telemetry_and_audit.sql
 */

export type PriorityLevel = 'low' | 'normal' | 'urgent' | 'critical';

export interface ActivityEventRow {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  external_id: string | null;
  source: string;
  event_type: string;
  title: string;
  summary: string | null;
  priority: PriorityLevel;
  raw_payload: Record<string, unknown>;
  is_read: boolean;
  actionable: boolean;
  created_at: string;
}

export type ActionProposalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'failed';

export interface AgentAuditLogRow {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  actor_email: string;
  tool_slug: string;
  action_type: string;
  status: ActionProposalStatus;
  request_payload: Record<string, unknown>;
  execution_result: Record<string, unknown> | null;
  approved_by: string | null;
  approved_at: string | null;
  signature_hash: string | null;
  created_at: string;
}

export interface ActionProposal {
  id: string;
  tool_slug: string;
  action_type: string;
  title: string;
  description: string;
  payload: Record<string, unknown>;
  status: ActionProposalStatus;
  risk_level: 'low' | 'medium' | 'high';
  signature_hash: string;
  created_at?: string;
}

export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessageRow {
  id: string;
  session_id: string;
  role: ChatMessageRole;
  content: string;
  source_badges: string[];
  tool_calls: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
  }> | null;
  action_proposals: ActionProposal[] | null;
  created_at: string;
}

export interface ChatSessionRow {
  id: string;
  organization_id: string | null;
  user_id: string;
  title: string | null;
  is_archived: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppUserRow {
  id: string;
  auth_user_id: string | null;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: 'owner' | 'admin' | 'member';
  composio_entity_id: string | null;
  connector_preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  owner_id: string | null;
  type: 'personal' | 'team' | 'enterprise';
  created_at: string;
  updated_at: string;
}

export interface OrganizationMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}
