import { workflow, trigger, node, ifElse, expr } from '@n8n/workflow-sdk';

/**
 * 🔷 PRISM 13, Zoho CRM Service (port of legacy 05 with connector gate)
 * ----------------------------------------------------------------------------
 * Scoped Zoho CRM reads + writes. Auth resolves per user first: when the Next.js
 * proxy supplies a user accessToken (per-user Zoho OAuth, multi-tenant), the
 * call runs with a Bearer header against that user's own org. Only when no user
 * token exists (and ZOHO_ORG_SHARED=true) does it fall back to the org-managed
 * n8n 'Zoho account' credential. The user's data center + org IDs come from
 * orgConfig (discovered at connect time) and fall back to the legacy values.
 *
 * workflowInputs:
 *   connectorEnabled  boolean
 *   entitlement       boolean
 *   accessToken       string   per-user Zoho OAuth access token (empty → org credential)
 *   scope             'deals' | 'deal' | 'accounts' | 'leads'
 *   recordId?         string   deal id for scope 'deal'
 *   limit?            number
 *   orgConfig?        { dataCenter?: string; crmOrgId?: string }
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
    name: 'Gate & Parse CRM Scope',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const item = $input.first()?.json || {};
const connectorEnabled = item.connectorEnabled !== false;
const connectorPaused = item.connectorPaused === true;
const entitlement = item.entitlement !== false;
const userToken = String(item.accessToken || '').trim();
const scope = String(item.scope || 'deals').toLowerCase();
const explicitId = String(item.recordId || '').trim();
const limit = Math.min(parseInt(item.limit, 10) || 10, 100);
const cfg = item.orgConfig && typeof item.orgConfig === 'object' ? item.orgConfig : {};
const dc = String(cfg.dataCenter || 'in').replace(/^zoho\\./, '');
const apiBase = 'https://www.zohoapis.' + dc + '/crm/v2';

if (connectorPaused) {
  return [{ json: { refused: true, reason: 'connector_paused', connectorId: 'zoho.crm', records: [] } }];
}
if (connectorEnabled === false) {
  return [{ json: { refused: true, reason: 'connector_disabled', connectorId: 'zoho.crm', records: [] } }];
}
if (entitlement === false) {
  return [{ json: { refused: true, reason: 'not_entitled', connectorId: 'zoho.crm', records: [] } }];
}
if (!userToken && !cfg.allowOrgShared) {
  // No per-user token and the org-shared fallback is not enabled for this call
  return [{ json: { refused: true, reason: 'no_zoho_connection', connectorId: 'zoho.crm', records: [] } }];
}

let requestUrl = apiBase;
let scopeType = scope;
let targetId = explicitId;

if (scope === 'deal') {
  if (!targetId) {
    return [{ json: { refused: false, scoped: false, total: 0, records: [], message: 'recordId is required for scope deal.' } }];
  }
  requestUrl = apiBase + '/Deals/' + targetId;
  scopeType = 'deal';
} else if (scope === 'campaigns' || scope === 'campaign') {
  requestUrl = apiBase + '/Campaigns?sort_by=Created_Time&sort_order=desc&per_page=' + limit;
  scopeType = 'campaigns';
} else if (scope === 'accounts') {
  requestUrl = apiBase + '/Accounts?sort_by=Created_Time&sort_order=desc&per_page=' + limit;
} else if (scope === 'leads') {
  requestUrl = apiBase + '/Leads?sort_by=Created_Time&sort_order=desc&per_page=' + limit;
} else if (scope === 'contacts') {
  requestUrl = apiBase + '/Contacts?sort_by=Created_Time&sort_order=desc&per_page=' + limit;
} else {
  requestUrl = apiBase + '/Deals?sort_by=Modified_Time&sort_order=desc&per_page=' + limit;
  scopeType = 'deals';
}

return [{ json: { refused: false, requestUrl: requestUrl, scopeType: scopeType, targetId: targetId, userToken: userToken } }];
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
return [{ json: { refused: true, reason: item.reason || 'connector_unavailable', connectorId: 'zoho.crm', total: 0, records: [] } }];
`
    }
  }
});

// Per-user token path: Bearer header against the connected user's own Zoho.
// The org credential is NOT used here, multi-tenant means every user talks to
// their own Zoho account with the token the proxy resolved for them.
const getZohoData = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'GET Zoho CRM',
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

const formatCrm = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format Zoho CRM Records',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const res = $input.first()?.json || {};
const meta = $('Gate & Parse CRM Scope').first()?.json || {};
const scopeType = meta.scopeType || 'deals';
const raw = Array.isArray(res.data) ? res.data : (res.data && Array.isArray(res.data[0]) ? res.data[0] : []);

if (res.status === 'error' || res.code === 'RECORD_NOT_FOUND' || res.code === 'INVALID_DATA' || res.code === 'AUTHENTICATION_FAILURE') {
  return [{ json: { refused: false, error: String(res.message || res.code || 'zoho_error'), connectorId: 'zoho.crm', total: 0, records: [] } }];
}

const records = raw.map(function (d) {
  const deal = {
    id: String(d.id || ''),
    name: d.Deal_Name || d.dealName || '',
    stage: d.Stage || d.stage || 'Qualification',
    amount: d.Amount != null ? Number(d.Amount) : 0,
    closingDate: d.Closing_Date || '',
    account: d.Account_Name?.name || '',
    contact: d.Contact_Name?.name || '',
    modifiedTime: d.Modified_Time || ''
  };
  const account = {
    id: String(d.id || ''),
    name: d.Account_Name || d.accountName || d.name || '',
    website: d.Website || '',
    phone: d.Phone || '',
    billingCountry: d.Billing_Country || ''
  };
  const lead = {
    id: String(d.id || ''),
    fullName: (d.First_Name || '') + ' ' + (d.Last_Name || ''),
    company: d.Company || '',
    email: d.Email || '',
    phone: d.Phone || '',
    leadStatus: d.Lead_Status || ''
  };
  const contact = {
    id: String(d.id || ''),
    fullName: d.Full_Name || ((d.First_Name || '') + ' ' + (d.Last_Name || '')).trim() || '',
    email: d.Email || '',
    phone: d.Phone || '',
    title: d.Title || '',
    account: d.Account_Name?.name || ''
  };
  const campaign = {
    id: String(d.id || ''),
    name: d.Campaign_Name || d.name || '',
    type: d.Type || 'Promotional Scheme',
    status: d.Status || '',
    startDate: d.Start_Date || '',
    endDate: d.End_Date || '',
    budget: d.Budgeted_Cost != null ? Number(d.Budgeted_Cost) : 0,
    actualCost: d.Actual_Cost != null ? Number(d.Actual_Cost) : 0,
    expectedRevenue: d.Expected_Revenue != null ? Number(d.Expected_Revenue) : 0,
    description: d.Description || '',
    owner: d.Owner?.name || ''
  };
  if (scopeType === 'campaigns' || scopeType === 'campaign') return campaign;
  if (scopeType === 'accounts') return account;
  if (scopeType === 'leads') return lead;
  if (scopeType === 'contacts' || scopeType === 'contact') return contact;
  return deal;
});

return [{
  json: {
    refused: false,
    scoped: scopeType === 'deal',
    connectorId: 'zoho.crm',
    total: records.length,
    records: records
  }
}];
`
    }
  }
});

export default workflow('prism-zoho-crm-service', 'Prism - Zoho CRM Service')
  .add(executeTrigger)
  .to(parseScope)
  .to(
    checkRefused
      .onTrue(formatRefusal)
      .onFalse(getZohoData.to(formatCrm))
  );
