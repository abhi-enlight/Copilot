import { workflow, trigger, node, languageModel, tool, newCredential, expr } from '@n8n/workflow-sdk';
import { PRISM_WORKFLOW_IDS } from './_prism_workflow_ids';

/**
 * 🔷 PRISM 01, Unified Copilot Agent
 * ----------------------------------------------------------------------------
 * The product's main Gemini agent. Tools = the Prism service workflows
 * (10–15). Each tool receives the caller's connector context (enabled /
 * entitlement / tokens) from the Chat Trigger payload that the Next.js proxy
 * forwards; the services themselves refuse execution when a connector is
 * disabled or not entitled, the agent can never bypass the gate.
 *
 * NOTE: before activating, import 10–16 and fill PRISM_WORKFLOW_IDS in
 * ./_prism_workflow_ids.ts with the database IDs assigned by n8n.
 *
 * Chat payload (Next.js proxy → n8n):
 *   chatInput, sessionId, campaignContext?,
 *   connectorContext: {
 *     'microsoft.outlook':    { enabled, entitlement, accessToken },
 *     'microsoft.sharepoint': { enabled, entitlement, accessToken },
 *     'microsoft.dynamics':   { enabled, entitlement, accessToken },
 *     'zoho.crm':             { enabled, entitlement },
 *     'zoho.projects':        { enabled, entitlement },
 *     'zoho.books':           { enabled, entitlement }
 *   },
 *   orgConfig: { dataCenter?, portalId?, organizationId?, crmOrgUrl? }
 */

const chatTrigger = trigger({
  type: '@n8n/n8n-nodes-langchain.chatTrigger',
  version: 1.4,
  config: {
    name: 'Chat Trigger',
    parameters: {
      public: true,
      options: {
        inputPlaceholder: 'Ask across your mail, files, CRM deals, projects, invoices, and knowledge base…',
        subtitle: 'Prism. One interface for every system. Microsoft 365 + Zoho, gated by real permissions.',
        title: 'Prism Copilot',
        responseMode: 'streaming'
      }
    }
  }
});

const geminiChatModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
  version: 1.1,
  config: {
    name: 'Google Gemini Model',
    parameters: {
      modelName: 'models/gemini-3.7-flash',
      options: {
        temperature: 0.2
      }
    },
    credentials: {
      googlePalmApi: newCredential('Google Gemini(PaLM) Api account')
    }
  }
});

const memoryWindow = node({
  type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
  version: 1.4,
  config: {
    name: 'Memory Buffer',
    parameters: {
      contextWindowLength: 10
    }
  }
});

const geminiEmbeddings = node({
  type: '@n8n/n8n-nodes-langchain.embeddingsGoogleGemini',
  version: 1,
  config: {
    name: 'Gemini Embeddings',
    parameters: {},
    credentials: {
      googlePalmApi: newCredential('Google Gemini(PaLM) Api account')
    }
  }
});

const knowledgeBaseTool = tool({
  type: '@n8n/n8n-nodes-langchain.vectorStoreSupabase',
  version: 1.3,
  config: {
    name: 'Knowledge Base',
    parameters: {
      mode: 'retrieve-as-tool',
      toolDescription: 'Search the organization knowledge base: campaign case studies, SOPs, learnings, contracts summaries. Semantic retrieval with citations.',
      tableName: {
        __rl: true,
        mode: 'id',
        value: 'documents'
      },
      topK: 5,
      options: {
        queryName: 'match_documents'
      }
    },
    credentials: {
      supabaseApi: newCredential('Supabase account')
    },
    subnodes: {
      embedding: geminiEmbeddings
    }
  }
});

// Tool: Microsoft Outlook Mail (10)
const outlookTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'Microsoft Outlook Mail',
    parameters: {
      description: 'Read the authenticated user\'s live Outlook mailbox (recent messages, search, conversation threads), save drafts, or send emails. Refused when the connector is off or unentitled.',
      source: 'database',
      workflowId: {
        __rl: true,
        mode: 'id',
        value: PRISM_WORKFLOW_IDS.msOutlookService
      },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          accessToken: expr("{{ $('Chat Trigger').first().json.connectorContext?.['microsoft.outlook']?.accessToken || '' }}"),
          connectorEnabled: expr("{{ ($('Chat Trigger').first().json.connectorContext?.['microsoft.outlook']?.enabled) === true }}"),
          entitlement: expr("{{ ($('Chat Trigger').first().json.connectorContext?.['microsoft.outlook']?.entitlement) !== false }}"),
          connectorPaused: expr("{{ ($('Chat Trigger').first().json.connectorContext?.['microsoft.outlook']?.paused) === true }}"),
          scope: expr("{{ $fromAI('scope', 'One of: list (recent mail), search (by term), thread (by conversation id), draft (save draft), send (send mail)', 'string', 'list') }}"),
          query: expr("{{ $fromAI('query', 'Search term or conversation/thread id when scope is search or thread', 'string', '') }}"),
          limit: expr("{{ $fromAI('limit', 'Maximum messages to return', 'number', 10) }}"),
          to: expr("{{ $fromAI('to', 'Recipient email address(es) for draft or send', 'string', '') }}"),
          cc: expr("{{ $fromAI('cc', 'Optional CC recipient email address(es)', 'string', '') }}"),
          subject: expr("{{ $fromAI('subject', 'Email subject line', 'string', '') }}"),
          body: expr("{{ $fromAI('body', 'Email body content (text or HTML)', 'string', '') }}")
        },
        schema: [
          { id: 'accessToken', displayName: 'accessToken', type: 'string', display: false },
          { id: 'connectorEnabled', displayName: 'connectorEnabled', type: 'boolean', display: false },
          { id: 'entitlement', displayName: 'entitlement', type: 'boolean', display: false },
          { id: 'connectorPaused', displayName: 'connectorPaused', type: 'boolean', display: false },
          { id: 'scope', displayName: 'scope', type: 'string', display: true },
          { id: 'query', displayName: 'query', type: 'string', display: true },
          { id: 'limit', displayName: 'limit', type: 'number', display: true },
          { id: 'to', displayName: 'to', type: 'string', display: true },
          { id: 'cc', displayName: 'cc', type: 'string', display: true },
          { id: 'subject', displayName: 'subject', type: 'string', display: true },
          { id: 'body', displayName: 'body', type: 'string', display: true }
        ]
      }
    }
  }
});

// Tool: Microsoft SharePoint / OneDrive (11)
const sharepointTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'SharePoint & OneDrive',
    parameters: {
      description: 'List documents/folders in the user\'s OneDrive or an org SharePoint drive. NEVER fabricate files. Refused when off/unentitled.',
      source: 'database',
      workflowId: {
        __rl: true,
        mode: 'id',
        value: PRISM_WORKFLOW_IDS.msSharepointService
      },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          accessToken: expr("{{ $('Chat Trigger').first().json.connectorContext?.['microsoft.sharepoint']?.accessToken || '' }}"),
          connectorEnabled: expr("{{ ($('Chat Trigger').first().json.connectorContext?.['microsoft.sharepoint']?.enabled) === true }}"),
          entitlement: expr("{{ ($('Chat Trigger').first().json.connectorContext?.['microsoft.sharepoint']?.entitlement) !== false }}"),
          connectorPaused: expr("{{ ($('Chat Trigger').first().json.connectorContext?.['microsoft.sharepoint']?.paused) === true }}"),
          scope: expr("{{ $fromAI('scope', 'One of: onedrive (personal) or site (org SharePoint)', 'string', 'onedrive') }}"),
          siteId: expr("{{ $fromAI('siteId', 'SharePoint drive site id, or root', 'string', 'root') }}"),
          itemId: expr("{{ $fromAI('itemId', 'Optional driveItem id to list inside a folder', 'string', '') }}"),
          limit: expr("{{ $fromAI('limit', 'Maximum items to return', 'number', 15) }}")
        },
        schema: [
          { id: 'accessToken', displayName: 'accessToken', type: 'string', display: false },
          { id: 'connectorEnabled', displayName: 'connectorEnabled', type: 'boolean', display: false },
          { id: 'entitlement', displayName: 'entitlement', type: 'boolean', display: false },
          { id: 'connectorPaused', displayName: 'connectorPaused', type: 'boolean', display: false },
          { id: 'scope', displayName: 'scope', type: 'string', display: true },
          { id: 'siteId', displayName: 'siteId', type: 'string', display: true },
          { id: 'itemId', displayName: 'itemId', type: 'string', display: true },
          { id: 'limit', displayName: 'limit', type: 'number', display: true }
        ]
      }
    }
  }
});

// Tool: Microsoft Dynamics 365 CRM (12)
const dynamicsTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'Dynamics 365 CRM',
    parameters: {
      description: 'Read live Dynamics 365 (Dataverse) opportunities/deals, accounts, or contacts. Strictly entitlement-gated: only users with a Dynamics license + CRM role can use it. NEVER fabricate records.',
      source: 'database',
      workflowId: {
        __rl: true,
        mode: 'id',
        value: PRISM_WORKFLOW_IDS.msDynamicsCrmService
      },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          accessToken: expr("{{ $('Chat Trigger').first().json.connectorContext?.['microsoft.dynamics']?.accessToken || '' }}"),
          crmOrgUrl: expr("{{ $('Chat Trigger').first().json.orgConfig?.crmOrgUrl || '' }}"),
          connectorEnabled: expr("{{ ($('Chat Trigger').first().json.connectorContext?.['microsoft.dynamics']?.enabled) === true }}"),
          entitlement: expr("{{ ($('Chat Trigger').first().json.connectorContext?.['microsoft.dynamics']?.entitlement) === true }}"),
          connectorPaused: expr("{{ ($('Chat Trigger').first().json.connectorContext?.['microsoft.dynamics']?.paused) === true }}"),
          scope: expr("{{ $fromAI('scope', 'One of: deals, deal, accounts, contacts', 'string', 'deals') }}"),
          recordId: expr("{{ $fromAI('recordId', 'Opportunity/record id when scope is deal', 'string', '') }}"),
          limit: expr("{{ $fromAI('limit', 'Maximum records to return', 'number', 10) }}")
        },
        schema: [
          { id: 'accessToken', displayName: 'accessToken', type: 'string', display: false },
          { id: 'crmOrgUrl', displayName: 'crmOrgUrl', type: 'string', display: false },
          { id: 'connectorEnabled', displayName: 'connectorEnabled', type: 'boolean', display: false },
          { id: 'entitlement', displayName: 'entitlement', type: 'boolean', display: false },
          { id: 'connectorPaused', displayName: 'connectorPaused', type: 'boolean', display: false },
          { id: 'scope', displayName: 'scope', type: 'string', display: true },
          { id: 'recordId', displayName: 'recordId', type: 'string', display: true },
          { id: 'limit', displayName: 'limit', type: 'number', display: true }
        ]
      }
    }
  }
});

// Tool: Zoho CRM (13)
const zohoCrmTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'Zoho CRM',
    parameters: {
      description: 'Read live Zoho CRM deals, accounts, contacts, leads, or marketing campaigns through the CALLING USER\'s own connected Zoho account (multi-tenant). NEVER fabricate records. Refused when the user has no Zoho connection or lacks CRM access.',
      source: 'database',
      workflowId: {
        __rl: true,
        mode: 'id',
        value: PRISM_WORKFLOW_IDS.zohoCrmService
      },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          connectorEnabled: expr("{{ ($('Chat Trigger').first().json.connectorContext?.['zoho.crm']?.enabled) !== false }}"),
          entitlement: expr("{{ ($('Chat Trigger').first().json.connectorContext?.['zoho.crm']?.entitlement) !== false }}"),
          connectorPaused: expr("{{ ($('Chat Trigger').first().json.connectorContext?.['zoho.crm']?.paused) === true }}"),
          accessToken: expr("{{ $('Chat Trigger').first().json.connectorContext?.['zoho.crm']?.accessToken || '' }}"),
          scope: expr("{{ $fromAI('scope', 'One of: deals, deal, accounts, contacts, leads, campaigns', 'string', 'deals') }}"),
          recordId: expr("{{ $fromAI('recordId', 'Record id when scope is deal or single record', 'string', '') }}"),
          limit: expr("{{ $fromAI('limit', 'Maximum records to return', 'number', 10) }}"),
          orgConfig: expr("{{ $('Chat Trigger').first().json.orgConfig || {} }}")
        },
        schema: [
          { id: 'connectorEnabled', displayName: 'connectorEnabled', type: 'boolean', display: false },
          { id: 'entitlement', displayName: 'entitlement', type: 'boolean', display: false },
          { id: 'connectorPaused', displayName: 'connectorPaused', type: 'boolean', display: false },
          { id: 'accessToken', displayName: 'accessToken', type: 'string', display: false },
          { id: 'scope', displayName: 'scope', type: 'string', display: true },
          { id: 'recordId', displayName: 'recordId', type: 'string', display: true },
          { id: 'limit', displayName: 'limit', type: 'number', display: true },
          { id: 'orgConfig', displayName: 'orgConfig', type: 'object', display: false }
        ]
      }
    }
  }
});

// Tool: Zoho Projects (14)
const zohoProjectsTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'Zoho Projects',
    parameters: {
      description: 'Read live Zoho Projects projects/tasks through the CALLING USER\'s own connected Zoho portal (multi-tenant). NEVER fabricate projects. Refused when the user has no Zoho connection.',
      source: 'database',
      workflowId: {
        __rl: true,
        mode: 'id',
        value: PRISM_WORKFLOW_IDS.zohoProjectsService
      },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          connectorEnabled: expr("{{ ($('Chat Trigger').first().json.connectorContext?.['zoho.projects']?.enabled) !== false }}"),
          entitlement: expr("{{ ($('Chat Trigger').first().json.connectorContext?.['zoho.projects']?.entitlement) !== false }}"),
          connectorPaused: expr("{{ ($('Chat Trigger').first().json.connectorContext?.['zoho.projects']?.paused) === true }}"),
          accessToken: expr("{{ $('Chat Trigger').first().json.connectorContext?.['zoho.projects']?.accessToken || '' }}"),
          scope: expr("{{ $fromAI('scope', 'One of: projects, project', 'string', 'projects') }}"),
          recordId: expr("{{ $fromAI('recordId', 'Project id when scope is project', 'string', '') }}"),
          limit: expr("{{ $fromAI('limit', 'Maximum projects to return', 'number', 10) }}"),
          orgConfig: expr("{{ $('Chat Trigger').first().json.orgConfig || {} }}")
        },
        schema: [
          { id: 'connectorEnabled', displayName: 'connectorEnabled', type: 'boolean', display: false },
          { id: 'entitlement', displayName: 'entitlement', type: 'boolean', display: false },
          { id: 'connectorPaused', displayName: 'connectorPaused', type: 'boolean', display: false },
          { id: 'accessToken', displayName: 'accessToken', type: 'string', display: false },
          { id: 'scope', displayName: 'scope', type: 'string', display: true },
          { id: 'recordId', displayName: 'recordId', type: 'string', display: true },
          { id: 'limit', displayName: 'limit', type: 'number', display: true },
          { id: 'orgConfig', displayName: 'orgConfig', type: 'object', display: false }
        ]
      }
    }
  }
});

// Tool: Zoho Books (15)
const zohoBooksTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'Zoho Books',
    parameters: {
      description: 'Read live Zoho Books invoices and customers through the CALLING USER\'s own connected Zoho Books org (multi-tenant). NEVER fabricate invoices. Refused when the user has no Zoho connection.',
      source: 'database',
      workflowId: {
        __rl: true,
        mode: 'id',
        value: PRISM_WORKFLOW_IDS.zohoBooksService
      },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          connectorEnabled: expr("{{ ($('Chat Trigger').first().json.connectorContext?.['zoho.books']?.enabled) !== false }}"),
          entitlement: expr("{{ ($('Chat Trigger').first().json.connectorContext?.['zoho.books']?.entitlement) !== false }}"),
          connectorPaused: expr("{{ ($('Chat Trigger').first().json.connectorContext?.['zoho.books']?.paused) === true }}"),
          accessToken: expr("{{ $('Chat Trigger').first().json.connectorContext?.['zoho.books']?.accessToken || '' }}"),
          scope: expr("{{ $fromAI('scope', 'One of: invoices, invoice, customer, customers', 'string', 'invoices') }}"),
          recordId: expr("{{ $fromAI('recordId', 'Invoice id or customer id', 'string', '') }}"),
          limit: expr("{{ $fromAI('limit', 'Maximum invoices to return', 'number', 10) }}"),
          orgConfig: expr("{{ $('Chat Trigger').first().json.orgConfig || {} }}")
        },
        schema: [
          { id: 'connectorEnabled', displayName: 'connectorEnabled', type: 'boolean', display: false },
          { id: 'entitlement', displayName: 'entitlement', type: 'boolean', display: false },
          { id: 'connectorPaused', displayName: 'connectorPaused', type: 'boolean', display: false },
          { id: 'accessToken', displayName: 'accessToken', type: 'string', display: false },
          { id: 'scope', displayName: 'scope', type: 'string', display: true },
          { id: 'recordId', displayName: 'recordId', type: 'string', display: true },
          { id: 'limit', displayName: 'limit', type: 'number', display: true },
          { id: 'orgConfig', displayName: 'orgConfig', type: 'object', display: false }
        ]
      }
    }
  }
});

// System prompt
const SYSTEM_PROMPT = `You are Prism, a unified productivity copilot. You connect the systems a user already works in (Microsoft with Outlook mail, SharePoint/OneDrive, and Dynamics 365 CRM; Zoho with CRM, Projects, and Books) plus the organization knowledge base.

### Core Operating Principles
1. **Live data only, never invent.** Only report what the tools actually return. If a tool returns zero records, say so plainly: "No records found in <source>." Never fabricate emails, files, deals, invoices, or tasks.
2. **Connector gates are real.** Every service workflow enforces the user's connector state. A tool can answer:
   - refused / connector_paused → "You have paused the connection. Please go to the Connections page and turn it on."
   - refused / connector_disabled → "Outlook is turned off for you. Enable it in Connections."
   - refused / not_entitled → "Dynamics 365 requires a license and CRM role your account doesn't have. Ask your admin to unlock it." Do NOT describe IT consent workarounds as if the user could do them.
   - refused / no_zoho_connection → "Connect your own Zoho account in Connections to use this source."
   - refused / missing_token → "Your Microsoft connection needs re-authentication. Reconnect it in Connections."
   - refused / missing_embedding → KB query needs an embedding; rely on the Knowledge Base tool instead.
3. **Route to the right source.** Mail questions → Microsoft Outlook Mail. Documents → SharePoint & OneDrive. Dynamics pipeline/deals/accounts/contacts → Dynamics 365 CRM. Zoho deals/leads/accounts/contacts/campaigns → Zoho CRM. Projects/tasks/milestones → Zoho Projects. Invoices/payments/customers → Zoho Books. Never query one CRM for the other's data. Prefer the tool whose connector is enabled.
4. **Cross-reference when useful.** When the user names a client or contact, you may combine sources (e.g., recent mail + matching deal + invoices) into a client snapshot, clearly labeling each section with its source.
5. **Be concise and structured.** Use short markdown: bold labels, bullet lists, and small tables. A few records is fine; for long lists give the top items and offer to go deeper.
6. **No secrets in output.** Never echo access tokens, refresh tokens, or raw Authorization headers.
7. **Email Drafting and Sending (Human-in-the-Loop).** When the user asks to compose, draft, or send an email, always generate a structured draft block formatted exactly like:
[EMAIL_DRAFT]
{
  "to": "recipient@example.com",
  "cc": "",
  "subject": "Clear, professional subject",
  "body": "Email body content here..."
}
[/EMAIL_DRAFT]
Follow the block with a short summary. The Prism UI automatically renders this block as an interactive Email Draft Card with 'Send via Outlook', 'Save to Drafts', and inline edit controls. Never claim an email is already sent unless the tool explicitly executed the send.

Connected sources available to you are decided by the platform's real permissions. An individual user typically has Outlook + OneDrive only, while org users additionally share Zoho and CRM connectors the org configured. Work happily with whatever is enabled.`;

const agent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Prism Copilot Agent',
    parameters: {
      promptType: 'define',
      text: '={{ $json.chatInput }}',
      options: {
        systemMessage: SYSTEM_PROMPT
      }
    },
    subnodes: {
      model: geminiChatModel,
      memory: memoryWindow,
      tools: [
        knowledgeBaseTool,
        outlookTool,
        sharepointTool,
        dynamicsTool,
        zohoCrmTool,
        zohoProjectsTool,
        zohoBooksTool
      ]
    }
  }
});

export default workflow('prism-copilot', 'Prism - Unified Copilot (Microsoft + Zoho)')
  .add(chatTrigger)
  .to(agent);
