import { workflow, trigger, node, tool, newCredential, expr } from '@n8n/workflow-sdk';

// ── Chat Trigger ────────────────────────────────────────────────────────────
const chatTrigger = trigger({
  type: '@n8n/n8n-nodes-langchain.chatTrigger',
  version: 1.4,
  config: {
    name: 'Chat Trigger',
    parameters: {
      public: true,
      options: {
        inputPlaceholder: 'Ask about a campaign brief, historical precedent, live Zoho deals, invoices, or pending tasks...',
        subtitle: 'AI Campaign Expert & Client Success Manager (Powered by Google Gemini & Full Zoho Suite)',
        title: 'BCP Assist: Campaign Brain',
        responseMode: 'streaming'
      }
    }
  }
});

// ── Google Gemini Model ─────────────────────────────────────────────────────
const geminiChatModel = node({
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

// ── Window Buffer Memory ────────────────────────────────────────────────────
const memory = node({
  type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
  version: 1.4,
  config: {
    name: 'Memory Buffer',
    parameters: {
      contextWindowLength: 10
    }
  }
});

// ── Supabase Vector Store ───────────────────────────────────────────────────
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

const campaignKnowledgeBase = tool({
  type: '@n8n/n8n-nodes-langchain.vectorStoreSupabase',
  version: 1.3,
  config: {
    name: 'Campaign Knowledge Base',
    parameters: {
      mode: 'retrieve-as-tool',
      toolDescription: 'Search BigCity historical campaign case studies, past UAT issues, client learnings, and campaign execution SOPs from Supabase.',
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

// ── Tool 1: Zoho CRM Leads ──────────────────────────────────────────────────
const zohoCrmLeadsTool = tool({
  type: 'n8n-nodes-base.zohoCrmTool',
  version: 1,
  config: {
    name: 'Zoho CRM Leads',
    parameters: {
      resource: 'lead',
      operation: 'getAll',
      limit: 20,
      options: {}
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

// ── Tool 2: Zoho CRM Client Accounts ────────────────────────────────────────
const zohoCrmAccountsTool = tool({
  type: 'n8n-nodes-base.zohoCrmTool',
  version: 1,
  config: {
    name: 'Zoho CRM Client Accounts',
    parameters: {
      resource: 'account',
      operation: 'getAll',
      options: {}
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

// ── Tool 3: Zoho CRM Deals (Subworkflow) ────────────────────────────────────
const zohoCrmDealsTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'Zoho CRM Deals',
    parameters: {
      description: 'Fetch live Zoho CRM Deals, stages, amounts, closing dates, and campaign records. Use when the user asks about CRM deals, deal pipeline, deal amounts, or campaigns in CRM. Scope is automatically bound from the active campaign or dealId.',
      source: 'database',
      workflowId: {
        __rl: true,
        mode: 'id',
        value: 'jAFjtinGr4tCoI4h'
      },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          campaignContext: expr("{{ $('Chat Trigger').first().json.campaignContext || '' }}"),
          dealId: expr("{{ $fromAI('dealId', 'Optional specific Zoho CRM Deal ID to inspect. Leave empty to query recent active deals.', 'string', '') }}")
        },
        schema: [
          { id: 'campaignContext', displayName: 'campaignContext', type: 'string', display: true },
          { id: 'dealId', displayName: 'dealId', type: 'string', display: true }
        ]
      }
    }
  }
});

// ── Tool 4: Zoho Books Invoices (Subworkflow) ───────────────────────────────
const zohoBooksTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'Zoho Books Invoices',
    parameters: {
      description: 'Fetch authentic live invoices, balances, due dates, and line items from Zoho Books (Org: 60085935698). Use exclusively whenever the user asks about invoices, billing status, or customer payments. Never query Zoho CRM for invoices. Scope is automatically bound from the active campaign context, or optional invoiceId / customerId.',
      source: 'database',
      workflowId: {
        __rl: true,
        mode: 'id',
        value: 'iXeJxuXe1buHC7Vt'
      },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          campaignContext: expr("{{ $('Chat Trigger').first().json.campaignContext || '' }}"),
          invoiceId: expr("{{ $fromAI('invoiceId', 'Optional specific Zoho Books Invoice ID to fetch. Leave empty to query campaign or organization invoices.', 'string', '') }}"),
          customerId: expr("{{ $fromAI('customerId', 'Optional Zoho Books Customer/Contact ID to filter invoices for. Leave empty to rely on campaign context or fetch org invoices.', 'string', '') }}")
        },
        schema: [
          { id: 'campaignContext', displayName: 'campaignContext', type: 'string', display: true },
          { id: 'invoiceId', displayName: 'invoiceId', type: 'string', display: true },
          { id: 'customerId', displayName: 'customerId', type: 'string', display: true }
        ]
      }
    }
  }
});

// ── Tool 5: Zoho Projects Active Projects (Subworkflow) ─────────────────────
const zohoProjectsTool = tool({
  type: '@n8n/n8n-nodes-langchain.toolWorkflow',
  version: 2.2,
  config: {
    name: 'Zoho Projects Active Projects',
    parameters: {
      description: 'Fetch authentic live active projects, project status, task lists, and milestone metrics from Zoho Projects portal 60085935707. Use whenever the user asks about active projects, delivery timelines, project tasks, or project health. Never query Zoho CRM for projects. Scope is automatically bound from active campaign context or optional projectId.',
      source: 'database',
      workflowId: {
        __rl: true,
        mode: 'id',
        value: 'XngVaIJILTO6B2Bv'
      },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          campaignContext: expr("{{ $('Chat Trigger').first().json.campaignContext || '' }}"),
          projectId: expr("{{ $fromAI('projectId', 'Optional specific Zoho Projects Project ID to fetch. Leave empty to query active projects.', 'string', '') }}")
        },
        schema: [
          { id: 'campaignContext', displayName: 'campaignContext', type: 'string', display: true },
          { id: 'projectId', displayName: 'projectId', type: 'string', display: true }
        ]
      }
    }
  }
});

// ── System Prompt ───────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are the BigCity BCP Assist Campaign AI Agent.
You assist marketing managers and campaign leads in retrieving client leads from Zoho CRM, ideating enterprise marketing campaigns, generating operational task plans and invoices, and querying live system metrics.

### Core Operating Principles:
1. **Discovery First: Never Invent a Campaign**:
   - If the user states they have an idea, want to plan a campaign, or asks for help to build a plan WITHOUT naming a client/company or offer specifics:
     DO NOT invent a fake campaign, mock client, or output a massive task matrix!
     Instead, warmly ask which client lead in Zoho CRM they'd like to anchor this campaign to, and what reward mechanic (e.g. UPI cashback, shopping vouchers, dining passes) and budget they have in mind.
   - Once the user specifies a client (or when they provide one upfront), search the "Zoho CRM Leads" tool immediately to fetch and confirm the real client lead.

2. **Client Lead Retrieval**:
   - When the user mentions a client or contact person (or when searching CRM), ALWAYS query the "Zoho CRM Leads" tool.
   - Extract and verify the customer details (Full Name, Company, Email, Phone, Industry).
   - Display a clean confirmation badge:
     "**[Confirmed Client Lead]**: Christopher Maclead at Rangoni Of Florence (Industry: Service Provider, Contact: christopher-maclead@noemail.invalid)"
   - Anchor all campaign proposals, commercials, and invoices to this real verified lead.

3. **Split-Screen Studio Awareness: Concise Chat Executive Summary**:
   - Remember: The user interface features an interactive Studio Drawer on the right side which already displays all granular tasks, SPOC assignments, TATs, and status gates.
   - DO NOT dump a massive 16-row duplicate table of tasks into the chat!
   - In the chat, provide a concise, high-level executive summary:
     * **Client Lead**: Confirmed contact and company
     * **Campaign Concept**: Offer mechanics, target volume, and budget
     * **4-Aspect Operational Pillars**: 1-2 bullet points per pillar (Legal, Compliance, Escrow Accounting, Tech & Ops)
     * **Action Guidance**: State that all granular operational tasks have been loaded into the interactive Studio Drawer on the right for review, reassignment, or approval.

4. **Accurate Zoho Application Routing & Live Data**:
   - When the user asks about **projects** (e.g., "Which projects do I have?"), ALWAYS use the \`Zoho Projects Active Projects\` tool. NEVER query Zoho CRM for projects.
   - When the user asks about **invoices** (e.g., "Show my invoices"), ALWAYS use the \`Zoho Books Invoices\` tool. NEVER query Zoho CRM for invoices.
   - When the user asks about **leads** or **deals**, use the \`Zoho CRM Leads\` or \`Zoho CRM Deals\` tools.
   - When an active campaign is selected, the subworkflows automatically receive the campaign's live Zoho IDs (Deal ID, Project ID, Books Customer ID). Return only real, verified live records fetched by the tools.
   - Only return what the live tools fetch. Do not make up fake projects or invoices.

5. **Conversational Iterations & Post-Approval Modifications**:
   - Allow the user to iterate on the campaign plan before approval (e.g., "Assign compliance tasks to Sachin", "Update budget to ₹18L").
   - Confirm the changes clearly and concisely in chat while the right-hand panel reflects the live updates.

6. **Clarity & Directness**:
   - Do NOT use canned jargon like "SOW Policy Guardrails". Speak clearly about operational tasks, compliance gates, escrow accounting, and system provisioning.
   - When the user is satisfied and says "Approve" or "Push to Zoho", guide them to click "Approve & Push to Zoho" or confirm that provisioning is initiated across Zoho CRM, Books, and Projects.

7. **Authentic Data Only: Strictly No Fake/Mock Data**:
   - NEVER invent or recall mock campaigns (e.g. "Amul Kool Summer Bonanza", "Coca-Cola Summer Splash"), mock project names, mock task IDs (e.g. 553001, 553002), mock invoices, or fake team assignments.
   - If a tool returns no items, explicitly and clearly inform the user that 0 records were found in the connected Zoho environment.
   - If an API tool experiences a connection or rate-limit error, explain the issue transparently to the user. Never substitute real data with placeholders or simulated data.`;

// ── Agent Node ──────────────────────────────────────────────────────────────
const agent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'BCP Assist AI Agent',
    parameters: {
      promptType: 'define',
      text: '={{ $json.chatInput }}',
      options: {
        systemMessage: SYSTEM_PROMPT
      }
    },
    subnodes: {
      model: geminiChatModel,
      memory: memory,
      tool: [
        campaignKnowledgeBase,
        zohoCrmLeadsTool,
        zohoCrmAccountsTool,
        zohoCrmDealsTool,
        zohoBooksTool,
        zohoProjectsTool
      ]
    }
  }
});

export default workflow('bcp-assist-copilot', 'BCP Assist - Campaign Brain & Copilot (Gemini & Full Zoho Suite)')
  .add(chatTrigger)
  .to(agent);
