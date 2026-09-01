import { Tenant } from '@/types';

export const DEFAULT_WORKSPACE: Tenant = {
  id: 'org_enlight_01',
  name: 'EnlightLab Workspace',
  slug: 'enlightlab',
  role: 'Admin',
  m365Connected: true,
  crmConnected: true
};

export const INITIAL_WELCOME_MESSAGE = `### Operations Copilot Active

Connected to enterprise endpoints under **EnlightLab Workspace**:

* **Microsoft SharePoint**: Root drive active (\`/sites/root/drive\`)
* **Dynamics 365 CRM**: Dataverse v9.2 (\`org98ee0c24.crm8.dynamics.com\`)
* **Outlook & Calendar**: Connected to \`dj@enlightlab.com\`

*Type an executive query below to retrieve data across these services.*`;

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
