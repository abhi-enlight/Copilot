import { Tenant } from '@/types';

export const DEFAULT_WORKSPACE: Tenant = {
  id: 'org_enlight_01',
  name: 'EnlightLab Workspace',
  slug: 'enlightlab',
  role: 'Admin',
  userEmail: 'dj@enlightlab.com',
  userName: 'Abhi',
  sharepointDrive: '/sites/root/drive',
  dynamicsOrg: 'org98ee0c24.crm8',
  m365Connected: true,
  crmConnected: true
};

export const AVAILABLE_WORKSPACES: Tenant[] = [
  {
    id: 'org_enlight_01',
    name: 'EnlightLab Workspace',
    slug: 'enlightlab',
    role: 'Admin',
    userEmail: 'dj@enlightlab.com',
    userName: 'Abhi',
    sharepointDrive: '/sites/root/drive',
    dynamicsOrg: 'org98ee0c24.crm8',
    m365Connected: true,
    crmConnected: true
  },
  {
    id: 'org_personal_02',
    name: 'Personal Workspace',
    slug: 'personal',
    role: 'Owner',
    userEmail: 'user@outlook.com',
    userName: 'User',
    sharepointDrive: '/me/drive/root',
    dynamicsOrg: 'org-personal.crm',
    m365Connected: true,
    crmConnected: false
  }
];

export const getWelcomeMessage = (tenant: Tenant): string => {
  const email = tenant.userEmail || 'Connected Account';
  const org = tenant.dynamicsOrg || 'Dataverse CRM v9.2';
  const drive = tenant.sharepointDrive || '/sites/root/drive';
  const name = tenant.name || 'Your Workspace';

  return `### Operations Copilot Active

Connected to enterprise endpoints under **${name}**:

* **Microsoft SharePoint**: Root drive active (\`${drive}\`)
* **Dynamics 365 CRM**: Dataverse API (\`${org}\`)
* **Outlook & Calendar**: Connected to \`${email}\`

*Type an executive query below to retrieve data across these services.*`;
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
