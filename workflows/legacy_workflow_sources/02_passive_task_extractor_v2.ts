import { workflow, trigger, node, switchCase, newCredential, expr } from '@n8n/workflow-sdk';

// ── Webhook Trigger ─────────────────────────────────────────────────────────
const incomingWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Incoming Campaign & Task Webhook V2',
    parameters: {
      httpMethod: 'POST',
      path: 'bcp-task-ingest-v2',
      responseMode: 'responseNode',
      options: {}
    }
  }
});

// ── Normalize Incoming Webhook Payload ──────────────────────────────────────
const normalizePayload = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Normalize Incoming Webhook Payload',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const item = $input.first()?.json || {};
let body = item.body;
if (typeof body === 'string') {
  try {
    body = JSON.parse(body);
  } catch (e) {
    // leave as string
  }
}

const rawAction = 
  item.action ||
  (typeof body === 'object' && body !== null ? body.action : undefined) ||
  item.query?.action ||
  item.params?.action ||
  '';

const action = String(rawAction || '').trim().toLowerCase();
const campaigns = (typeof body === 'object' && body !== null ? body.campaigns : undefined) || item.campaigns || [];
const normalizedBody = (typeof body === 'object' && body !== null) ? { ...body, action } : { action };

return [{
  json: {
    ...item,
    body: normalizedBody,
    action: action,
    campaigns: campaigns,
    is_list_deals: action === 'list_deals',
    is_validate_deals: action === 'validate_deals',
    is_update_tasks: action === 'update_campaign_tasks' || action === 'update_tasks'
  }
}];
      `
    }
  }
});

// ── Route by Action ─────────────────────────────────────────────────────────
const routeByAction = switchCase({
  version: 3.2,
  config: {
    name: 'Route by Action',
    parameters: {
      rules: {
        values: [
          {
            outputKey: 'list_deals',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
              conditions: [
                {
                  leftValue: expr('{{ $json.action }}'),
                  operator: { type: 'string', operation: 'equals' },
                  rightValue: 'list_deals'
                }
              ],
              combinator: 'and'
            }
          },
          {
            outputKey: 'validate_deals',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
              conditions: [
                {
                  leftValue: expr('{{ $json.action }}'),
                  operator: { type: 'string', operation: 'equals' },
                  rightValue: 'validate_deals'
                }
              ],
              combinator: 'and'
            }
          },
          {
            outputKey: 'update_campaign_tasks',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
              conditions: [
                {
                  leftValue: expr('{{ $json.is_update_tasks }}'),
                  operator: { type: 'boolean', operation: 'true' }
                }
              ],
              combinator: 'and'
            }
          },
          {
            outputKey: 'sync_missing_products',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
              conditions: [
                {
                  leftValue: expr('{{ $json.action }}'),
                  operator: { type: 'string', operation: 'equals' },
                  rightValue: 'sync_missing_products'
                }
              ],
              combinator: 'and'
            }
          }
        ]
      },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'default_sync' }
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. list_deals Branch: Fetch all active deal IDs from Zoho CRM
// ═══════════════════════════════════════════════════════════════════════════
const fetchAllZohoDealsForList = node({
  type: 'n8n-nodes-base.zohoCrm',
  version: 1,
  config: {
    name: 'Fetch Zoho Deals for List',
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'deal',
      operation: 'getAll',
      returnAll: true,
      options: {}
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const formatListDealsResponse = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format List Deals Response',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const allItems = $input.all();
const dealIds = [];
const deals = [];

for (const item of allItems) {
  const d = item.json;
  if (d && d.id && !d.error && d.status !== 'error') {
    dealIds.push(String(d.id));
    deals.push({
      id: String(d.id),
      name: d.Deal_Name || d.dealName || '',
      stage: d.Stage || d.stage || 'Qualification',
      amount: d.Amount || d.amount || 0
    });
  }
}

return [{
  json: {
    dealIds,
    deals,
    total: dealIds.length
  }
}];
      `
    }
  }
});

const respondListDeals = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond List Deals Results',
    parameters: {
      respondWith: 'firstIncomingItem',
      options: {}
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. validate_deals Branch: Validate a list of deal IDs against Zoho CRM
// ═══════════════════════════════════════════════════════════════════════════
const fetchAllZohoDealsForValidate = node({
  type: 'n8n-nodes-base.zohoCrm',
  version: 1,
  config: {
    name: 'Fetch Zoho Deals for Validate',
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'deal',
      operation: 'getAll',
      returnAll: true,
      options: {}
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const aggregateValidation = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Aggregate Valid & Invalid Deals',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const allZohoDeals = $input.all().map(item => item.json);
const normalizerNode = $('Normalize Incoming Webhook Payload').first();
const originalCampaigns = normalizerNode?.json?.campaigns || normalizerNode?.json?.body?.campaigns || [];

const zohoDealMap = new Map();
for (const deal of allZohoDeals) {
  if (deal && deal.id && !deal.error && deal.status !== 'error') {
    zohoDealMap.set(String(deal.id), deal);
  }
}

const valid = [];
const invalid = [];

for (const camp of originalCampaigns) {
  const dealIdStr = String(camp.dealId || '');
  if (dealIdStr && zohoDealMap.has(dealIdStr)) {
    const liveDeal = zohoDealMap.get(dealIdStr);
    valid.push({
      id: camp.id,
      dealId: dealIdStr,
      name: camp.name || liveDeal.Deal_Name || liveDeal.dealName,
      stage: liveDeal.Stage || liveDeal.stage || 'Qualification'
    });
  } else {
    invalid.push({
      id: camp.id,
      dealId: camp.dealId,
      name: camp.name,
      reason: 'Deal not found in Zoho CRM'
    });
  }
}

return [{
  json: {
    valid,
    invalid
  }
}];
      `
    }
  }
});

const respondValidation = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Validation Results',
    parameters: {
      respondWith: 'firstIncomingItem',
      options: {}
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. update_campaign_tasks Branch: Post-approval task modifications
// ═══════════════════════════════════════════════════════════════════════════
const prepareTaskUpdates = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Task Updates Payload',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const item = $input.first()?.json || {};
const body = item.body || item;
const projectId = String(body.projectId || body.project_id || '').trim();
const campaignId = String(body.campaignId || body.campaign_id || '').trim();
const campaignName = String(body.campaignName || body.name || '').trim();
const tasks = Array.isArray(body.tasks) ? body.tasks : [];

return [{
  json: {
    projectId,
    campaignId,
    campaignName,
    tasks,
    totalTasks: tasks.length,
    updatedAt: new Date().toISOString()
  }
}];
      `
    }
  }
});

const writeBackTaskUpdatesToSupabase = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Write Back Task Updates to Supabase',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'PATCH',
      url: expr('{{ "https://ejawdvxnddgkcgkasove.supabase.co/rest/v1/campaigns?id=eq." + ($json.campaignId || "") }}'),
      authentication: 'none',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: {
        parameters: [
          { name: 'apikey', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqYXdkdnhuZGRna2Nna2Fzb3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMDk5NDAsImV4cCI6MjEwMjY4NTk0MH0.BGjXCxnsuxhvtRg34bW0IJNpAsm1xVPz81TZMX9Yq4E' },
          { name: 'Authorization', value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqYXdkdnhuZGRna2Nna2Fzb3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMDk5NDAsImV4cCI6MjEwMjY4NTk0MH0.BGjXCxnsuxhvtRg34bW0IJNpAsm1xVPz81TZMX9Yq4E' },
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Prefer', value: 'return=minimal' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('={{\n  JSON.stringify({\n    tasks: $json.tasks,\n    last_zoho_sync: $json.updatedAt\n  })\n}}'),
      options: { neverError: true }
    }
  }
});

const respondTaskUpdates = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Task Updates Results',
    parameters: {
      respondWith: 'json',
      responseBody: expr('={{\n  JSON.stringify({\n    success: true,\n    status: "tasks_updated",\n    campaignId: $(\'Prepare Task Updates Payload\').first().json.campaignId,\n    projectId: $(\'Prepare Task Updates Payload\').first().json.projectId,\n    totalTasks: $(\'Prepare Task Updates Payload\').first().json.totalTasks,\n    updatedAt: $(\'Prepare Task Updates Payload\').first().json.updatedAt\n  })\n}}'),
      options: {}
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Default Sync Branch: Atomic 3-App Provisioning + Zoho Projects Task Creation
// ═══════════════════════════════════════════════════════════════════════════
const prepareZohoSync = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Prepare Zoho Multi-App Payload',
    parameters: {
      assignments: {
        assignments: [
          { id: 'status', name: 'status', type: 'string', value: 'ACTION_QUEUED_FOR_ZOHO' },
          { id: 'campaignId', name: 'campaignId', type: 'string', value: expr('{{ $json.body?.campaignId || $json.campaignId || "" }}') },
          { id: 'dealName', name: 'dealName', type: 'string', value: expr('{{ $json.body?.campaignName || $json.campaignName || "Campaign Deal" }}') },
          { id: 'campaignName', name: 'campaignName', type: 'string', value: expr('{{ $json.body?.campaignName || $json.campaignName || "Campaign Deal" }}') },
          { id: 'client', name: 'client', type: 'string', value: expr('{{ $json.body?.client || $json.client || "Enterprise Client" }}') },
          { id: 'amount', name: 'amount', type: 'number', value: expr('{{ parseInt(String($json.body?.budget || $json.budget || "0").replace(/[^0-9]/g, "")) || 2500000 }}') },
          { id: 'budget', name: 'budget', type: 'string', value: expr('{{ $json.body?.budget || $json.budget || "₹25,00,000" }}') },
          { id: 'codeVolume', name: 'codeVolume', type: 'string', value: expr('{{ $json.body?.codeVolume || $json.codeVolume || $json.body?.code_volume || "200,000" }}') },
          { id: 'tasks', name: 'tasks', type: 'array', value: expr('{{ $json.body?.tasks || $json.tasks || [] }}') },
          // ─── FIXED: Prefer booksCustomerId sent from the frontend (resolved dynamically by the API).
          // Falls back to a brand-keyword map only if the frontend did NOT supply an ID.
          // The fallback now includes Puma (4157605000000109006) to prevent incorrect defaulting.
          { id: 'booksCustomerId', name: 'booksCustomerId', type: 'string', value: expr("{{ $json.body?.booksCustomerId || $json.booksCustomerId || (String($json.body?.client || $json.client || '').toLowerCase().includes('zara') ? '4157605000000107001' : String($json.body?.client || $json.client || '').toLowerCase().includes('puma') ? '4157605000000109006' : String($json.body?.client || $json.client || '').toLowerCase().includes('zudio') ? '4157605000000096001' : (String($json.body?.client || $json.client || '').toLowerCase().includes('h&m') || String($json.body?.client || $json.client || '').toLowerCase().includes('hm') || String($json.body?.client || $json.client || '').toLowerCase().includes('hennes')) ? '4157605000000097001' : String($json.body?.client || $json.client || '').toLowerCase().includes('nestle') ? '4157605000000047113' : String($json.body?.client || $json.client || '').toLowerCase().includes('pepsi') ? '4157605000000066001' : String($json.body?.client || $json.client || '').toLowerCase().includes('britannia') ? '4157605000000067001' : String($json.body?.client || $json.client || '').toLowerCase().includes('tata') ? '4157605000000068001' : String($json.body?.client || $json.client || '').toLowerCase().includes('amul') ? '4157605000000049063' : (String($json.body?.client || $json.client || '').toLowerCase().includes('coca') || String($json.body?.client || $json.client || '').toLowerCase().includes('coke')) ? '4157605000000047157' : String($json.body?.client || $json.client || '').toLowerCase().includes('samsung') ? '4157605000000047135' : (String($json.body?.client || $json.client || '').toLowerCase().includes('mondelez') || String($json.body?.client || $json.client || '').toLowerCase().includes('cadbury')) ? '4157605000000065001' : '') }}") }
        ]
      },
      includeOtherFields: true
    }
  }
});

const syncToZohoCrmDeal = node({
  type: 'n8n-nodes-base.zohoCrm',
  version: 1,
  config: {
    name: 'Sync to Zoho CRM (Deals)',
    parameters: {
      resource: 'deal',
      dealName: expr('{{ $json.dealName }}'),
      stage: 'Qualification',
      amount: expr('{{ $json.amount }}'),
      additionalFields: {
        Description: expr('{{ $json.body?.message || $json.message || ("Client: " + $json.client + " | Multi-app synchronized campaign in Zoho CRM, Zoho Books & Zoho Projects.") }}'),
        Closing_Date: expr('{{ new Date(Date.now() + 30*86400000).toISOString().split("T")[0] }}')
      }
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const createZohoBooksInvoice = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Create Zoho Books Invoice',
    onError: 'continueRegularOutput',
    parameters: {
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'zohoOAuth2Api',
      method: 'POST',
      url: 'https://www.zohoapis.in/books/v3/invoices?organization_id=60085935698',
      sendBody: true,
      specifyBody: 'json',
      contentType: 'json',
      jsonBody: expr(`={\\n  JSON.stringify({\\n    customer_id: $('Prepare Zoho Multi-App Payload').first().json.booksCustomerId || '',\\n    date: new Date().toISOString().split('T')[0],\\n    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],\\n    line_items: [{\\n      item_id: '4157605000000056047',\\n      rate: $('Prepare Zoho Multi-App Payload').first().json.amount || 50000,\\n      quantity: 1,\\n      description: ($('Prepare Zoho Multi-App Payload').first().json.campaignName || 'Campaign') + ': Campaign Services & Reward Operations'\\n    }],\\n    notes: 'Auto-generated by Prism for client: ' + ($('Prepare Zoho Multi-App Payload').first().json.client || 'Client')\\n  })\\n}`),
      options: { neverError: true }
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const createZohoProjectsProject = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Create Zoho Projects Project',
    onError: 'continueRegularOutput',
    parameters: {
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'zohoOAuth2Api',
      method: 'POST',
      url: 'https://projectsapi.zoho.in/restapi/portal/60085935707/projects/',
      contentType: 'form-urlencoded',
      sendBody: true,
      specifyBody: 'keypair',
      bodyParameters: {
        parameters: [
          { name: 'name', value: expr('{{ $(\'Prepare Zoho Multi-App Payload\').first().json.campaignName || "Campaign Project" }}') },
          { name: 'description', value: expr('{{ "Client: " + ($(\'Prepare Zoho Multi-App Payload\').first().json.client || "Client") + " | Budget: " + ($(\'Prepare Zoho Multi-App Payload\').first().json.budget || "₹0") + " | Volume: " + ($(\'Prepare Zoho Multi-App Payload\').first().json.codeVolume || "N/A") + " | Campaign ID: " + ($(\'Prepare Zoho Multi-App Payload\').first().json.campaignId || "") }}') },
          { name: 'status', value: 'active' }
        ]
      },
      options: { neverError: true }
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const prepareProjectTasksForCreation = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Project Tasks for Creation',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const prepNode = $('Prepare Zoho Multi-App Payload').first()?.json || {};
const projNode = $('Create Zoho Projects Project').first()?.json || {};
const projectId = String(
  projNode?.projects?.[0]?.id_string ||
  projNode?.projects?.[0]?.id ||
  projNode?.project?.id_string ||
  projNode?.project?.id ||
  projNode?.id_string ||
  projNode?.id ||
  ''
);
const rawTasks = Array.isArray(prepNode.tasks) ? prepNode.tasks : [];

if (!projectId || rawTasks.length === 0) {
  return [{ json: { noTasks: true, projectId } }];
}

return rawTasks.map((t) => ({
  json: {
    projectId,
    name: t.title || t.name || 'Campaign Task',
    person_responsible: '60084828901'
  }
}));
`
    }
  }
});

const pushTasksToZohoProjects = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Push Tasks to Zoho Projects',
    onError: 'continueRegularOutput',
    parameters: {
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'zohoOAuth2Api',
      method: 'POST',
      url: expr('{{ "https://projectsapi.zoho.in/restapi/portal/60085935707/projects/" + $json.projectId + "/tasks/" }}'),
      contentType: 'form-urlencoded',
      sendBody: true,
      specifyBody: 'keypair',
      bodyParameters: {
        parameters: [
          { name: 'name', value: expr('{{ $json.name }}') },
          { name: 'person_responsible', value: '60084828901' }
        ]
      },
      options: { neverError: true }
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

// ── Code Node: Format Tasks and Sync Receipt ─────────────────────────────────
const prepareTasksAndReceipt = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Tasks and Sync Receipt',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const prepNode = $('Prepare Zoho Multi-App Payload').first()?.json || {};
const crmNode = $('Sync to Zoho CRM (Deals)').first()?.json || {};
const booksNode = $('Create Zoho Books Invoice').first()?.json || {};
const projNode = $('Create Zoho Projects Project').first()?.json || {};

const dealId = String(crmNode.id || '');
const invoiceId = String(booksNode?.invoice?.invoice_id || booksNode?.invoice_id || '');
const projectId = String(projNode?.projects?.[0]?.id_string || projNode?.project?.id_string || projNode?.id || '');

const rawTasks = Array.isArray(prepNode.tasks) ? prepNode.tasks : [];
const formattedTasks = rawTasks.map((t, idx) => {
  const taskId = t.id || 'task-' + idx;
  const aspect = String(t.aspect || 'general').toUpperCase();
  return {
    ...t,
    id: taskId,
    zoho_project_id: projectId || null,
    zoho_project_url: projectId ? \`https://projects.zoho.in/portal/enlightlabdotcom#project/\${projectId}\` : null,
    zoho_crm_deal_id: dealId || null,
    synced: true
  };
});

return [{
  json: {
    campaignId: prepNode.campaignId,
    dealId,
    dealUrl: dealId ? \`https://crm.zoho.in/crm/org/tab/Potentials/\${dealId}\` : null,
    invoiceId,
    invoiceUrl: invoiceId ? \`https://books.zoho.in/app#/invoices/\${invoiceId}\` : null,
    projectId,
    projectUrl: projectId ? \`https://projects.zoho.in/portal/enlightlabdotcom#project/\${projectId}\` : null,
    status: 'created',
    taskCount: formattedTasks.length,
    tasks: formattedTasks
  }
}];
      `
    }
  }
});

const respondToWebhook = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond to Webhook with Sync Receipt',
    parameters: {
      enableResponseOutput: true,
      respondWith: 'json',
      responseBody: expr('={{\n  JSON.stringify({\n    id: $json.dealId,\n    deal_id: $json.dealId,\n    invoice_id: $json.invoiceId,\n    project_id: $json.projectId,\n    status: $json.status,\n    task_count: $json.taskCount,\n    tasks: $json.tasks\n  })\n}}'),
      options: {}
    }
  }
});

const writeBackToSupabase = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Write Back Deal ID to Supabase',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'PATCH',
      url: expr('{{ "https://ejawdvxnddgkcgkasove.supabase.co/rest/v1/campaigns?id=eq." + ($json.campaignId || "") }}'),
      authentication: 'none',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: {
        parameters: [
          { name: 'apikey', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqYXdkdnhuZGRna2Nna2Fzb3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMDk5NDAsImV4cCI6MjEwMjY4NTk0MH0.BGjXCxnsuxhvtRg34bW0IJNpAsm1xVPz81TZMX9Yq4E' },
          { name: 'Authorization', value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqYXdkdnhuZGRna2Nna2Fzb3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMDk5NDAsImV4cCI6MjEwMjY4NTk0MH0.BGjXCxnsuxhvtRg34bW0IJNpAsm1xVPz81TZMX9Yq4E' },
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Prefer', value: 'return=minimal' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('={{\n  JSON.stringify({\n    zoho_crm_deal_id: $json.dealId || null,\n    zoho_crm_deal_url: $json.dealUrl || null,\n    zoho_crm_deal_stage: "Qualification",\n    zoho_books_invoice_id: $json.invoiceId || null,\n    zoho_books_invoice_url: $json.invoiceUrl || null,\n    zoho_project_id: $json.projectId || null,\n    zoho_project_url: $json.projectUrl || null,\n    tasks: $json.tasks || [],\n    zoho_sync_status: "synced",\n    last_zoho_sync: new Date().toISOString()\n  })\n}}'),
      options: { neverError: true }
    }
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// 5. sync_missing_products Branch: Heal a partial sync. The Zoho CRM deal
//    already exists, but the Books invoice / Projects project were never
//    confirmed (earlier provisioning failed or timed out). Provision ONLY the
//    missing products (a second CRM deal is never created).
// ═══════════════════════════════════════════════════════════════════════════
const prepareMissingProductsSync = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Prepare Missing Products Payload',
    parameters: {
      assignments: {
        assignments: [
          { id: 'status', name: 'status', type: 'string', value: 'HEAL_MISSING_PRODUCTS' },
          { id: 'dealId', name: 'dealId', type: 'string', value: expr('{{ $json.body?.dealId || $json.dealId || "" }}') },
          { id: 'campaignId', name: 'campaignId', type: 'string', value: expr('{{ $json.body?.campaignId || $json.campaignId || "" }}') },
          { id: 'dealName', name: 'dealName', type: 'string', value: expr('{{ $json.body?.campaignName || $json.campaignName || "Campaign Deal" }}') },
          { id: 'campaignName', name: 'campaignName', type: 'string', value: expr('{{ $json.body?.campaignName || $json.campaignName || "Campaign Deal" }}') },
          { id: 'client', name: 'client', type: 'string', value: expr('{{ $json.body?.client || $json.client || "Enterprise Client" }}') },
          { id: 'amount', name: 'amount', type: 'number', value: expr('{{ parseInt(String($json.body?.budget || $json.budget || "0").replace(/[^0-9]/g, "")) || 2500000 }}') },
          { id: 'budget', name: 'budget', type: 'string', value: expr('{{ $json.body?.budget || $json.budget || "₹25,00,000" }}') },
          { id: 'codeVolume', name: 'codeVolume', type: 'string', value: expr('{{ $json.body?.codeVolume || $json.codeVolume || $json.body?.code_volume || "200,000" }}') },
          { id: 'tasks', name: 'tasks', type: 'array', value: expr('{{ $json.body?.tasks || $json.tasks || [] }}') },
          // ─── FIXED: Prefer booksCustomerId sent from the frontend (resolved dynamically by the API).
          // Falls back to a brand-keyword map only if the frontend did NOT supply an ID.
          // The fallback now includes Puma (4157605000000109006) to prevent incorrect defaulting.
          { id: 'booksCustomerId', name: 'booksCustomerId', type: 'string', value: expr("{{ $json.body?.booksCustomerId || $json.booksCustomerId || (String($json.body?.client || $json.client || '').toLowerCase().includes('zara') ? '4157605000000107001' : String($json.body?.client || $json.client || '').toLowerCase().includes('puma') ? '4157605000000109006' : String($json.body?.client || $json.client || '').toLowerCase().includes('zudio') ? '4157605000000096001' : (String($json.body?.client || $json.client || '').toLowerCase().includes('h&m') || String($json.body?.client || $json.client || '').toLowerCase().includes('hm') || String($json.body?.client || $json.client || '').toLowerCase().includes('hennes')) ? '4157605000000097001' : String($json.body?.client || $json.client || '').toLowerCase().includes('nestle') ? '4157605000000047113' : String($json.body?.client || $json.client || '').toLowerCase().includes('pepsi') ? '4157605000000066001' : String($json.body?.client || $json.client || '').toLowerCase().includes('britannia') ? '4157605000000067001' : String($json.body?.client || $json.client || '').toLowerCase().includes('tata') ? '4157605000000068001' : String($json.body?.client || $json.client || '').toLowerCase().includes('amul') ? '4157605000000049063' : (String($json.body?.client || $json.client || '').toLowerCase().includes('coca') || String($json.body?.client || $json.client || '').toLowerCase().includes('coke')) ? '4157605000000047157' : String($json.body?.client || $json.client || '').toLowerCase().includes('samsung') ? '4157605000000047135' : (String($json.body?.client || $json.client || '').toLowerCase().includes('mondelez') || String($json.body?.client || $json.client || '').toLowerCase().includes('cadbury')) ? '4157605000000065001' : '') }}") }
        ]
      },
      includeOtherFields: true
    }
  }
});

const createMissingZohoBooksInvoice = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Create Missing Zoho Books Invoice',
    onError: 'continueRegularOutput',
    parameters: {
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'zohoOAuth2Api',
      method: 'POST',
      url: 'https://www.zohoapis.in/books/v3/invoices?organization_id=60085935698',
      sendBody: true,
      specifyBody: 'json',
      contentType: 'json',
      jsonBody: expr(`={\\n  JSON.stringify({\\n    customer_id: $('Prepare Missing Products Payload').first().json.booksCustomerId || '',\\n    date: new Date().toISOString().split('T')[0],\\n    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],\\n    line_items: [{\\n      item_id: '4157605000000056047',\\n      rate: $('Prepare Missing Products Payload').first().json.amount || 50000,\\n      quantity: 1,\\n      description: ($('Prepare Missing Products Payload').first().json.campaignName || 'Campaign') + ': Campaign Services & Reward Operations'\\n    }],\\n    notes: 'Auto-generated by Prism for client: ' + ($('Prepare Missing Products Payload').first().json.client || 'Client')\\n  })\\n}`),
      options: { neverError: true }
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const createMissingZohoProjectsProject = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Create Missing Zoho Projects Project',
    onError: 'continueRegularOutput',
    parameters: {
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'zohoOAuth2Api',
      method: 'POST',
      url: 'https://projectsapi.zoho.in/restapi/portal/60085935707/projects/',
      contentType: 'form-urlencoded',
      sendBody: true,
      specifyBody: 'keypair',
      bodyParameters: {
        parameters: [
          { name: 'name', value: expr('{{ $(\'Prepare Missing Products Payload\').first().json.campaignName || "Campaign Project" }}') },
          { name: 'description', value: expr('{{ "Client: " + ($(\'Prepare Missing Products Payload\').first().json.client || "Client") + " | Budget: " + ($(\'Prepare Missing Products Payload\').first().json.budget || "₹0") + " | Volume: " + ($(\'Prepare Missing Products Payload\').first().json.codeVolume || "N/A") + " | Campaign ID: " + ($(\'Prepare Missing Products Payload\').first().json.campaignId || "") }}') },
          { name: 'status', value: 'active' }
        ]
      },
      options: { neverError: true }
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const prepareMissingProjectTasksForCreation = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Missing Project Tasks for Creation',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const prepNode = $('Prepare Missing Products Payload').first()?.json || {};
const projNode = $('Create Missing Zoho Projects Project').first()?.json || {};
const projectId = String(
  projNode?.projects?.[0]?.id_string ||
  projNode?.projects?.[0]?.id ||
  projNode?.project?.id_string ||
  projNode?.project?.id ||
  projNode?.id_string ||
  projNode?.id ||
  ''
);
const rawTasks = Array.isArray(prepNode.tasks) ? prepNode.tasks : [];

if (!projectId || rawTasks.length === 0) {
  return [{ json: { noTasks: true, projectId } }];
}

return rawTasks.map((t) => ({
  json: {
    projectId,
    name: t.title || t.name || 'Campaign Task',
    person_responsible: '60084828901'
  }
}));
`
    }
  }
});

const pushMissingTasksToZohoProjects = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Push Missing Tasks to Zoho Projects',
    onError: 'continueRegularOutput',
    parameters: {
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'zohoOAuth2Api',
      method: 'POST',
      url: expr('{{ "https://projectsapi.zoho.in/restapi/portal/60085935707/projects/" + $json.projectId + "/tasks/" }}'),
      contentType: 'form-urlencoded',
      sendBody: true,
      specifyBody: 'keypair',
      bodyParameters: {
        parameters: [
          { name: 'name', value: expr('{{ $json.name }}') },
          { name: 'person_responsible', value: '60084828901' }
        ]
      },
      options: { neverError: true }
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

// ── Code Node: Format Tasks and Sync Receipt ─────────────────────────────────
const prepareMissingProductsReceipt = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare Missing Products Receipt',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const prepNode = $('Prepare Missing Products Payload').first()?.json || {};
const booksNode = $('Create Missing Zoho Books Invoice').first()?.json || {};
const projNode = $('Create Missing Zoho Projects Project').first()?.json || {};

const dealId = String(prepNode.dealId || '');
const invoiceId = String(booksNode?.invoice?.invoice_id || booksNode?.invoice_id || '');
const projectId = String(projNode?.projects?.[0]?.id_string || projNode?.project?.id_string || projNode?.id || '');

const rawTasks = Array.isArray(prepNode.tasks) ? prepNode.tasks : [];
const formattedTasks = rawTasks.map((t, idx) => {
  const taskId = t.id || 'task-' + idx;
  const aspect = String(t.aspect || 'general').toUpperCase();
  return {
    ...t,
    id: taskId,
    zoho_project_id: projectId || null,
    zoho_project_url: projectId ? \`https://projects.zoho.in/portal/enlightlabdotcom#project/\${projectId}\` : null,
    zoho_crm_deal_id: dealId || null,
    synced: true
  };
});

return [{
  json: {
    campaignId: prepNode.campaignId,
    dealId,
    dealUrl: dealId ? \`https://crm.zoho.in/crm/org/tab/Potentials/\${dealId}\` : null,
    invoiceId,
    invoiceUrl: invoiceId ? \`https://books.zoho.in/app#/invoices/\${invoiceId}\` : null,
    projectId,
    projectUrl: projectId ? \`https://projects.zoho.in/portal/enlightlabdotcom#project/\${projectId}\` : null,
    status: 'products_created',
    taskCount: formattedTasks.length,
    tasks: formattedTasks
  }
}];
      `
    }
  }
});

const respondMissingProducts = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Missing Products Sync',
    parameters: {
      enableResponseOutput: true,
      respondWith: 'json',
      responseBody: expr('={{\n  JSON.stringify({\n    id: $json.dealId,\n    deal_id: $json.dealId,\n    invoice_id: $json.invoiceId,\n    project_id: $json.projectId,\n    status: $json.status,\n    task_count: $json.taskCount,\n    tasks: $json.tasks\n  })\n}}'),
      options: {}
    }
  }
});

const writeBackMissingProductsToSupabase = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Write Back Missing Products to Supabase',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'PATCH',
      url: expr('{{ "https://ejawdvxnddgkcgkasove.supabase.co/rest/v1/campaigns?id=eq." + ($json.campaignId || "") }}'),
      authentication: 'none',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: {
        parameters: [
          { name: 'apikey', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqYXdkdnhuZGRna2Nna2Fzb3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMDk5NDAsImV4cCI6MjEwMjY4NTk0MH0.BGjXCxnsuxhvtRg34bW0IJNpAsm1xVPz81TZMX9Yq4E' },
          { name: 'Authorization', value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqYXdkdnhuZGRna2Nna2Fzb3ZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMDk5NDAsImV4cCI6MjEwMjY4NTk0MH0.BGjXCxnsuxhvtRg34bW0IJNpAsm1xVPz81TZMX9Yq4E' },
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Prefer', value: 'return=minimal' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('={{\n  JSON.stringify({\n    zoho_crm_deal_id: $json.dealId || null,\n    zoho_crm_deal_url: $json.dealUrl || null,\n    zoho_crm_deal_stage: "Qualification",\n    zoho_books_invoice_id: $json.invoiceId || null,\n    zoho_books_invoice_url: $json.invoiceUrl || null,\n    zoho_project_id: $json.projectId || null,\n    zoho_project_url: $json.projectUrl || null,\n    tasks: $json.tasks || [],\n    zoho_sync_status: "synced",\n    last_zoho_sync: new Date().toISOString()\n  })\n}}'),
      options: { neverError: true }
    }
  }
});

export default workflow('bcp-task-ingest-v2', 'BCP Assist - Passive Task Extractor & Zoho Multi-App Sync V2')
  .add(incomingWebhook)
  .to(normalizePayload)
  .to(
    routeByAction
      .onCase(
        0,
        fetchAllZohoDealsForList
          .to(formatListDealsResponse)
          .to(respondListDeals)
      )
      .onCase(
        1,
        fetchAllZohoDealsForValidate
          .to(aggregateValidation)
          .to(respondValidation)
      )
      .onCase(
        2,
        prepareTaskUpdates
          .to(writeBackTaskUpdatesToSupabase)
          .to(respondTaskUpdates)
      )
      .onCase(
        3,
        prepareMissingProductsSync
          .to(createMissingZohoBooksInvoice)
          .to(createMissingZohoProjectsProject)
          .to(prepareMissingProjectTasksForCreation)
          .to(pushMissingTasksToZohoProjects)
          .to(prepareMissingProductsReceipt)
          .to(respondMissingProducts)
          .to(writeBackMissingProductsToSupabase)
      )
      .onCase(
        4,
        prepareZohoSync
          .to(syncToZohoCrmDeal)
          .to(createZohoBooksInvoice)
          .to(createZohoProjectsProject)
          .to(prepareProjectTasksForCreation)
          .to(pushTasksToZohoProjects)
          .to(prepareTasksAndReceipt)
          .to(respondToWebhook)
          .to(writeBackToSupabase)
      )
  );
