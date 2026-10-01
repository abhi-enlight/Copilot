/**
 * Integration and tool connection contracts for Prism V2.
 * Strictly maintains 100% Prism Brand Sovereignty (zero 3rd-party vendor names).
 */

export type SupportedToolSlug =
  | 'outlook'
  | 'microsoft_teams'
  | 'slack'
  | 'linear'
  | 'zoho'
  | 'github'
  | 'gmail'
  | 'googlecalendar'
  | 'notion'
  | 'dynamics365';

export type ToolConnectionState = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'ERROR';

export interface ToolConnectionStatus {
  slug: SupportedToolSlug;
  name: string;
  category: string;
  logo?: string;
  isConnected: boolean;
  status: ToolConnectionState;
  connectedAccountId?: string;
  connectedAccountName?: string;
  lastSyncAt?: string;
}

export interface ConnectResponse {
  success: boolean;
  app: SupportedToolSlug;
  connectionId: string;
  redirectUrl: string;
}

export interface DisconnectResponse {
  success: boolean;
  disconnected: boolean;
  app?: string;
}
