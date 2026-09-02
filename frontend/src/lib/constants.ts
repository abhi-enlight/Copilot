import { Tenant } from '@/types';

export const DEFAULT_WORKSPACE: Tenant = {
  id: 'org_personal_01',
  name: 'Personal Workspace',
  slug: 'personal',
  role: 'Owner',
  userEmail: undefined,
  userName: undefined,
  sharepointDrive: undefined,
  dynamicsOrg: undefined,
  m365Connected: false,
  crmConnected: false
};

export const AVAILABLE_WORKSPACES: Tenant[] = [
  {
    id: 'org_personal_01',
    name: 'Personal Workspace',
    slug: 'personal',
    role: 'Owner',
    userEmail: undefined,
    userName: undefined,
    sharepointDrive: undefined,
    dynamicsOrg: undefined,
    m365Connected: false,
    crmConnected: false
  },
  {
    id: 'org_enterprise_02',
    name: 'Enterprise Organization',
    slug: 'enterprise',
    role: 'Admin',
    userEmail: undefined,
    userName: undefined,
    sharepointDrive: '/sites/root/drive',
    dynamicsOrg: undefined,
    m365Connected: false,
    crmConnected: false
  }
];

export const getWelcomeMessage = (tenant: Tenant): string => {
  const isOutlookConnected = Boolean(tenant.m365Connected && tenant.userEmail);
  const isSharepointConnected = Boolean(tenant.m365Connected);
  const isCrmConnected = Boolean(tenant.crmConnected && tenant.dynamicsOrg);

  const emailText = isOutlookConnected ? `Connected to \`${tenant.userEmail}\`` : '*Not Connected*';
  const orgText = isCrmConnected ? `\`${tenant.dynamicsOrg}\`` : '*Not Connected*';
  const driveText = isSharepointConnected 
    ? (tenant.sharepointDrive ? `\`${tenant.sharepointDrive}\`` : '`OneDrive (/me/drive)`')
    : '*Not Connected*';

  let displayName = tenant.name || 'Personal Workspace';
  if (!displayName.trim() || displayName.startsWith("'s Workspace") || displayName === "'s Workspace") {
    displayName = tenant.userEmail ? `${tenant.userEmail.split('@')[0]}'s Workspace` : 'Personal Workspace';
  }

  return `### Operations Copilot Active

Connected endpoints under **${displayName}**:

* **Microsoft SharePoint & OneDrive**: ${driveText}
* **Dynamics 365 CRM**: ${orgText}
* **Outlook & Calendar**: ${emailText}

*Type an executive query below to retrieve data across your connected services.*`;
};

export const INITIAL_WELCOME_MESSAGE = getWelcomeMessage(DEFAULT_WORKSPACE);

export const QUICK_ACTIONS = [
  {
    title: 'Search Contracts & SOPs',
    prompt: 'Search SharePoint root drive for active client MSA contracts and SOP documentation',
    icon: 'Zap',
    color: 'indigo'
  },
  {
    title: 'CRM Pipeline + Inbox',
    prompt: 'Summarize open CRM deals above $50,000 and correlate with recent Outlook emails',
    icon: 'Inbox',
    color: 'sky'
  },
  {
    title: 'Executive Revenue Summary',
    prompt: 'Generate an executive dashboard breakdown of orders by payment status with revenue totals',
    icon: 'Sparkles',
    color: 'purple'
  }
];

export const REQUIRED_ENTRA_SCOPES = [
  'Sites.Read.All (SharePoint)',
  'Mail.Read (Outlook)',
  'user_impersonation (Dynamics 365 Dataverse)'
];
