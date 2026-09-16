import { workflow, trigger, node, newCredential, expr } from '@n8n/workflow-sdk';

const executeTrigger = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'Execute Workflow Trigger',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'campaignContext', type: 'string' },
          { name: 'invoiceId', type: 'string' },
          { name: 'customerId', type: 'string' }
        ]
      }
    }
  }
});

const parseScope = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Invoice Scope',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const item = $input.first()?.json || {};
const explicitInvoiceId = String(item.invoiceId || '').trim();
const explicitCustomerId = String(item.customerId || '').trim();
const context = String(item.campaignContext || '');

let targetInvoiceId = explicitInvoiceId;
let targetCustomerId = explicitCustomerId;

if (!targetInvoiceId && context) {
  const matchInv = context.match(/(?:Books Invoice ID|invoiceId|invoice_id)[:=\\s]+(\\d+)/i);
  if (matchInv && matchInv[1]) targetInvoiceId = matchInv[1];
}
if (!targetCustomerId && context) {
  const matchCust = context.match(/(?:Books Customer ID|customerId|customer_id)[:=\\s]+(\\d+)/i);
  if (matchCust && matchCust[1]) targetCustomerId = matchCust[1];
}

let requestUrl = 'https://www.zohoapis.in/books/v3/invoices?organization_id=60085935698';
let scopeType = 'all';

if (targetInvoiceId) {
  requestUrl = 'https://www.zohoapis.in/books/v3/invoices/' + targetInvoiceId + '?organization_id=60085935698';
  scopeType = 'single_invoice';
} else if (targetCustomerId) {
  requestUrl = 'https://www.zohoapis.in/books/v3/invoices?organization_id=60085935698&customer_id=' + targetCustomerId;
  scopeType = 'customer_invoices';
}

return [{
  json: {
    requestUrl,
    scopeType,
    invoiceId: targetInvoiceId,
    customerId: targetCustomerId,
    campaignContext: context
  }
}];
`
    }
  }
});

const getInvoices = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Get Zoho Books Invoices',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.requestUrl }}'),
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'zohoOAuth2Api',
      options: { neverError: true }
    },
    credentials: {
      zohoOAuth2Api: newCredential('Zoho account')
    }
  }
});

const formatInvoices = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format Invoices',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const res = $input.first()?.json || {};
const scopeInfo = $('Parse Invoice Scope').first()?.json || {};
const scopeType = scopeInfo.scopeType;

if (res.code === 1002 || res.code === 1000 || (typeof res.message === 'string' && res.message.includes('does not exist')) || res.status_code === 404) {
  return [{
    json: {
      scoped: true,
      exists: false,
      total_invoices: 0,
      invoices: [],
      message: 'The invoice or customer records requested (' + (scopeInfo.invoiceId || scopeInfo.customerId || 'ID') + ') do not exist or were deleted from Zoho Books.'
    }
  }];
}

let invoicesList = [];
if (scopeType === 'single_invoice' && res.invoice) {
  invoicesList = [res.invoice];
} else if (Array.isArray(res.invoices)) {
  invoicesList = res.invoices;
}

return [{
  json: {
    scoped: scopeType !== 'all',
    scope_type: scopeType,
    total_invoices: invoicesList.length,
    invoices: invoicesList.map(i => ({
      invoice_id: String(i.invoice_id || ''),
      invoice_number: i.invoice_number || '',
      customer_name: i.customer_name || '',
      amount: i.total !== undefined ? i.total : (i.amount || 0),
      balance: i.balance !== undefined ? i.balance : 0,
      status: i.status || 'draft',
      date: i.date || '',
      due_date: i.due_date || ''
    }))
  }
}];
`
    }
  }
});

export default workflow('zoho-books-invoices-service', 'Zoho Books Invoices Service')
  .add(executeTrigger)
  .to(parseScope)
  .to(getInvoices)
  .to(formatInvoices);
