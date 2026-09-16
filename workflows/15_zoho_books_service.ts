import { workflow, trigger, node, ifElse, expr } from '@n8n/workflow-sdk';

/**
 * 🔷 PRISM 15, Zoho Books Service (port of legacy 07 with connector gate)
 * ----------------------------------------------------------------------------
 * Reads invoices & customers with the CALLING USER's own Zoho token
 * (multi-tenant). The user's organizationId + dataCenter are discovered at
 * connect time by the Next.js integration layer and passed via orgConfig.
 *
 * workflowInputs:
 *   connectorEnabled  boolean
 *   entitlement       boolean
 *   accessToken       string   per-user Zoho OAuth access token
 *   scope             'invoices' | 'invoice' | 'customer' | 'customers'
 *   recordId?         string   invoice id / customer id
 *   limit?            number
 *   orgConfig?        { dataCenter?: string; organizationId?: string }
 */
const executeTrigger = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.1,
  config: {
    name: 'Execute Workflow Trigger',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'connectorEnabled', type: 'boolean' },
          { name: 'connectorPaused', type: 'boolean' },
          { name: 'entitlement', type: 'boolean' },
          { name: 'accessToken', type: 'string' },
          { name: 'scope', type: 'string' },
          { name: 'recordId', type: 'string' },
          { name: 'limit', type: 'number' },
          { name: 'orgConfig', type: 'object' }
        ]
      }
    }
  }
});

const parseScope = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Gate & Parse Books Scope',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const item = $input.first()?.json || {};
const connectorEnabled = item.connectorEnabled !== false;
const connectorPaused = item.connectorPaused === true;
const entitlement = item.entitlement !== false;
const userToken = String(item.accessToken || '').trim();
const scope = String(item.scope || 'invoices');
const explicitId = String(item.recordId || '').trim();
const limit = Math.min(parseInt(item.limit, 10) || 10, 100);
const cfg = item.orgConfig && typeof item.orgConfig === 'object' ? item.orgConfig : {};
const dc = String(cfg.dataCenter || 'in').replace(/^zoho\\./, '');
const orgId = String(cfg.organizationId || '60085935698').trim();
const apiBase = 'https://www.zohoapis.' + dc + '/books/v3';

if (connectorPaused) {
  return [{ json: { refused: true, reason: 'connector_paused', connectorId: 'zoho.books', records: [] } }];
}
if (connectorEnabled === false) {
  return [{ json: { refused: true, reason: 'connector_disabled', connectorId: 'zoho.books', records: [] } }];
}
if (entitlement === false) {
  return [{ json: { refused: true, reason: 'not_entitled', connectorId: 'zoho.books', records: [] } }];
}
if (!userToken) {
  return [{ json: { refused: true, reason: 'no_zoho_connection', connectorId: 'zoho.books', records: [] } }];
}

let requestUrl = apiBase;
let scopeType = scope;

if (scope === 'invoice' && explicitId) {
  requestUrl = apiBase + '/invoices/' + explicitId + '?organization_id=' + orgId;
  scopeType = 'invoice';
} else if (scope === 'customer' && explicitId) {
  requestUrl = apiBase + '/invoices?organization_id=' + orgId + '&customer_id=' + explicitId + '&page=1&per_page=' + limit;
  scopeType = 'customer_invoices';
} else if (scope === 'customers') {
  requestUrl = apiBase + '/contacts?organization_id=' + orgId + '&contact_type=customer&page=1&per_page=' + limit;
  scopeType = 'customers';
} else {
  requestUrl = apiBase + '/invoices?organization_id=' + orgId + '&page=1&per_page=' + limit;
  scopeType = 'invoices';
}

return [{ json: { refused: false, requestUrl: requestUrl, scopeType: scopeType, organizationId: orgId, userToken: userToken } }];
`
    }
  }
});

const checkRefused = ifElse({
  version: 2.2,
  config: {
    name: 'Check Connector Gate',
    parameters: {
      conditions: {
        options: { caseSensitive: true, typeValidation: 'loose' },
        conditions: [
          {
            leftValue: expr('{{ $json.refused }}'),
            operator: { type: 'boolean', operation: 'true' }
          }
        ],
        combinator: 'and'
      }
    }
  }
});

const formatRefusal = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Return Clean Refusal',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const item = $input.first()?.json || {};
return [{ json: { refused: true, reason: item.reason || 'connector_unavailable', connectorId: 'zoho.books', total: 0, records: [] } }];
`
    }
  }
});

// Per-user token path: Bearer header against the connected user's own Books org.
const getZohoBooks = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'GET Zoho Books',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.requestUrl }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          {
            name: 'Authorization',
            value: '=Zoho-oauthtoken {{ $json.userToken }}'
          }
        ]
      },
      options: { neverError: true }
    }
  }
});

const formatBooks = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format Books Records',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const res = $input.first()?.json || {};
const meta = $('Gate & Parse Books Scope').first()?.json || {};
const scopeType = meta.scopeType || 'invoices';
let records = [];

if (res.code === 1002 || res.code === 1000 || res.status_code === 404 || (typeof res.message === 'string' && res.message.includes('does not exist'))) {
  return [{ json: { refused: false, error: String(res.message || 'zoho_books_error'), connectorId: 'zoho.books', total: 0, records: [] } }];
}

if (scopeType === 'customers') {
  records = (res.contacts || []).map(function (c) {
    return {
      id: String(c.contact_id || ''),
      name: c.contact_name || '',
      email: c.email || '',
      phone: c.phone || '',
      companyName: c.company_name || '',
      customerType: c.contact_type || 'customer'
    };
  });
} else {
  let invoicesList = [];
  if (scopeType === 'invoice' && res.invoice) invoicesList = [res.invoice];
  else if (Array.isArray(res.invoices)) invoicesList = res.invoices;
  records = invoicesList.map(function (i) {
    return {
      id: String(i.invoice_id || ''),
      invoiceNumber: i.invoice_number || '',
      customerName: i.customer_name || '',
      amount: i.total !== undefined ? i.total : (i.amount || 0),
      balance: i.balance !== undefined ? i.balance : 0,
      status: i.status || 'draft',
      date: i.date || '',
      dueDate: i.due_date || '',
      currency: i.currency_code || ''
    };
  });
}

return [{
  json: {
    refused: false,
    scoped: scopeType === 'invoice',
    connectorId: 'zoho.books',
    organizationId: meta.organizationId || '60085935698',
    total: records.length,
    records: records
  }
}];
`
    }
  }
});

export default workflow('prism-zoho-books-service', 'Prism - Zoho Books Service')
  .add(executeTrigger)
  .to(parseScope)
  .to(
    checkRefused
      .onTrue(formatRefusal)
      .onFalse(getZohoBooks.to(formatBooks))
  );
