import { workflow, trigger, node, newCredential, expr } from '@n8n/workflow-sdk';

const updateWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Update Webhook',
    parameters: {
      httpMethod: 'POST',
      path: 'bcp-update-resources',
      responseMode: 'responseNode',
      options: {}
    }
  }
});

const parseUpdatePayload = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Update Payload',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const item = $input.first()?.json || {};
let body = item.body || item;
if (typeof body === 'string') {
  try { body = JSON.parse(body); } catch (e) {}
}

const dealId = body.dealId ? String(body.dealId).trim() : null;
const projectId = body.projectId ? String(body.projectId).trim() : null;
const invoiceId = body.invoiceId ? String(body.invoiceId).trim() : null;
const customerId = body.customerId ? String(body.customerId).trim() : (body.booksCustomerId ? String(body.booksCustomerId).trim() : null);
const campaignName = body.campaignName ? String(body.campaignName).trim() : '';
const budget = body.budget ? String(body.budget).trim() : '';
const rawAmount = body.amount !== undefined ? body.amount : (body.budget ? String(body.budget).replace(/[^0-9.]/g, '') : '0');
const amount = parseFloat(String(rawAmount)) || 0;
const client = body.client ? String(body.client).trim() : '';

return [{
  json: {
    dealId,
    projectId,
    invoiceId,
    customerId,
    campaignName,
    budget,
    amount,
    client
  }
}];
`
    }
  }
});

const updateCrmDeal = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Update CRM Deal',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'PUT',
      url: expr('{{ $("Parse Update Payload").first().json.dealId ? "https://www.zohoapis.in/crm/v2/Deals" : "https://httpbin.org/status/200" }}'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'zohoOAuth2Api',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr(`={{
  JSON.stringify({
    data: [{
      id: $("Parse Update Payload").first().json.dealId,
      Deal_Name: $("Parse Update Payload").first().json.campaignName || undefined,
      Amount: $("Parse Update Payload").first().json.amount || undefined
    }]
  })
}}`),
      options: { neverError: true }
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const updateZohoProject = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Update Zoho Project',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: expr('{{ $("Parse Update Payload").first().json.projectId ? "https://projectsapi.zoho.in/restapi/portal/60085935707/projects/" + $("Parse Update Payload").first().json.projectId + "/" : "https://httpbin.org/status/200" }}'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'zohoOAuth2Api',
      sendBody: true,
      specifyBody: 'keypair',
      contentType: 'form-urlencoded',
      bodyParameters: {
        parameters: [
          {
            name: 'name',
            value: expr('{{ $("Parse Update Payload").first().json.campaignName || "Campaign Project" }}')
          },
          {
            name: 'description',
            value: expr('{{ "Client: " + ($("Parse Update Payload").first().json.client || "Client") + " | Budget: " + ($("Parse Update Payload").first().json.budget || "₹0") }}')
          }
        ]
      },
      options: { neverError: true }
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const updateBooksInvoice = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Update Books Invoice',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'PUT',
      url: expr('{{ $("Parse Update Payload").first().json.invoiceId ? "https://www.zohoapis.in/books/v3/invoices/" + $("Parse Update Payload").first().json.invoiceId + "?organization_id=60085935698" : "https://httpbin.org/status/200" }}'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'zohoOAuth2Api',
      sendBody: true,
      specifyBody: 'json',
      contentType: 'json',
      jsonBody: expr(`={{
  JSON.stringify({
    ...($("Parse Update Payload").first().json.customerId ? { customer_id: $("Parse Update Payload").first().json.customerId } : {}),
    line_items: [{
      item_id: '4157605000000056047',
      rate: $("Parse Update Payload").first().json.amount || 50000,
      quantity: 1,
      description: ($("Parse Update Payload").first().json.campaignName || 'Campaign') + ': Campaign Services & Reward Operations'
    }],
    notes: 'Auto-updated by BCP Assist for campaign: ' + ($("Parse Update Payload").first().json.campaignName || 'Campaign')
  })
}}`),
      options: { neverError: true }
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const formatUpdateSummary = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format Update Summary',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const original = $('Parse Update Payload').first()?.json || {};
const crmRes = $('Update CRM Deal').first()?.json || {};
const projRes = $('Update Zoho Project').first()?.json || {};
const booksRes = $('Update Books Invoice').first()?.json || {};

return [{
  json: {
    success: true,
    updated: {
      dealId: original.dealId,
      projectId: original.projectId,
      invoiceId: original.invoiceId,
      campaignName: original.campaignName,
      budget: original.budget,
      amount: original.amount
    },
    crm: crmRes,
    project: projRes,
    books: booksRes
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
    name: 'Respond To Webhook',
    parameters: {
      respondWith: 'firstIncomingItem',
      options: {}
    }
  }
});

export default workflow('bcp-update-zoho-resources', 'BCP Update Zoho Resources Webhook')
  .add(updateWebhook)
  .to(parseUpdatePayload)
  .to(updateCrmDeal)
  .to(updateZohoProject)
  .to(updateBooksInvoice)
  .to(formatUpdateSummary)
  .to(respondToWebhook);
