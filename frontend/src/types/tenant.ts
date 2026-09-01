export type TenantRole = 'Owner' | 'Admin' | 'Member';

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  role: TenantRole;
  userEmail?: string;
  userName?: string;
  sharepointDrive?: string;
  dynamicsOrg?: string;
  m365Connected: boolean;
  crmConnected: boolean;
};

export type ServiceHealth = {
  status: 'connected' | 'error' | 'pending';
  endpoint?: string;
  org?: string;
  mailbox?: string;
  scopeConsent?: boolean;
  userRole?: string;
  policy?: string;
};

export type TenantHealthResponse = {
  tenant: string;
  status: string;
  timestamp: string;
  services: {
    sharepoint: ServiceHealth;
    dynamics_crm: ServiceHealth;
    outlook: ServiceHealth;
    database_rls: ServiceHealth;
  };
  adminConsentUrl: string;
  requiredScopes: string[];
};
