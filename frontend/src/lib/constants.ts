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
  const email = tenant.userEmail;
  const org = tenant.crmConnected && tenant.dynamicsOrg ? `\`${tenant.dynamicsOrg}\`` : '*Not Connected*';
  const drive = tenant.sharepointDrive || (tenant.m365Connected ? '`/me/drive/root`' : '*Not Connected*');
  const name = tenant.name || 'Your Workspace';

  return `### Operations Copilot Active

Connected endpoints under **${name}**:

* **Microsoft SharePoint & OneDrive**: ${drive.startsWith('`') || drive.startsWith('*') ? drive : `\`${drive}\``}
* **Dynamics 365 CRM**: ${org}
* **Outlook & Calendar**: ${email ? `Connected to \`${email}\`` : '*Not Connected*'}

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
