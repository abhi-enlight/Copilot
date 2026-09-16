import { workflow, trigger, node, ifElse, expr } from '@n8n/workflow-sdk';

/**
 * 🔷 PRISM 12, Microsoft Dynamics 365 CRM Service (Dataverse)
 * ----------------------------------------------------------------------------
 * Read-only CRM access against a specific Dataverse environment. Strictly
 * gated: this connector must never run unless the provider permission probe
 * (Dynamics license + Dataverse security role + admin consent where required)
 * returned entitlement = true, non-admin employees therefore never reach it.
 *
 * workflowInputs:
 *   accessToken       string   bearer for the Dataverse resource scope
 *   crmOrgUrl         string   e.g. https://org<id>.crm8.dynamics.com
 *   connectorEnabled  boolean
 *   entitlement       boolean   ← MUST be true for CRM
 *   scope             'deals' | 'deal' | 'accounts' | 'contacts'
 *   recordId?         string   id for scope 'deal'
 *   limit?            number
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
          { name: 'accessToken', type: 'string' },
          { name: 'crmOrgUrl', type: 'string' },
          { name: 'connectorEnabled', type: 'boolean' },
          { name: 'connectorPaused', type: 'boolean' },
          { name: 'entitlement', type: 'boolean' },
          { name: 'scope', type: 'string' },
          { name: 'recordId', type: 'string' },
          { name: 'limit', type: 'number' }
        ]
      }
    }
  }
});

const gateAndBuildRequest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Gate CRM & Build Request',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const item = $input.first()?.json || {};
const accessToken = String(item.accessToken || '');
let crmOrgUrl = String(item.crmOrgUrl || '').trim().replace(/\\/$/, '');
const connectorEnabled = item.connectorEnabled !== false;
const connectorPaused = item.connectorPaused === true;
const entitlement = item.entitlement !== false;
const scope = String(item.scope || 'deals');
const recordId = String(item.recordId || '').trim();
const limit = Math.min(parseInt(item.limit, 10) || 10, 50);

if (connectorPaused) {
  return [{ json: { refused: true, reason: 'connector_paused', connectorId: 'microsoft.dynamics', records: [] } }];
}
if (connectorEnabled === false) {
  return [{ json: { refused: true, reason: 'connector_disabled', connectorId: 'microsoft.dynamics', records: [] } }];
}
if (entitlement === false) {
  return [{ json: { refused: true, reason: 'not_entitled', connectorId: 'microsoft.dynamics', records: [] } }];
}
if (!accessToken) {
  return [{ json: { refused: true, reason: 'missing_token', connectorId: 'microsoft.dynamics', records: [] } }];
}
if (!crmOrgUrl) {
  return [{ json: { refused: true, reason: 'missing_org_config', connectorId: 'microsoft.dynamics', records: [] } }];
}

const API = crmOrgUrl + '/api/data/v9.2';
const OPP_SELECT = 'name,stepname,statuscode,statecode,estimatedvalue,estimatedclosedate,createdon,customerid,ownerid';
const EXPAND = '$expand=customerid($select=name),ownerid($select=fullname)';
let requestUrl = '';

if (scope === 'deal' && recordId) {
  requestUrl = API + '/opportunities(' + recordId + ')?$select=' + OPP_SELECT + '&' + EXPAND;
} else if (scope === 'deals') {
  requestUrl = API + '/opportunities?$filter=statecode%20eq%200&$top=' + limit + '&$orderby=estimatedclosedate%20asc&$select=' + OPP_SELECT + '&' + EXPAND;
} else if (scope === 'accounts') {
  requestUrl = API + '/accounts?$top=' + limit + '&$orderby=name%20asc&$select=name,websiteurl,telephone1,address1_city,revenue,createdon,primarycontactid&$expand=primarycontactid($select=fullname)';
} else if (scope === 'contacts') {
  requestUrl = API + '/contacts?$top=' + limit + '&$orderby=fullname%20asc&$select=fullname,emailaddress1,telephone1,companyname,jobtitle,parentcustomerid&$expand=parentcustomerid($select=name)';
} else {
  requestUrl = API + '/opportunities?$top=' + limit + '&$select=' + OPP_SELECT + '&' + EXPAND;
}

return [{
  json: {
    refused: false,
    connectorId: 'microsoft.dynamics',
    scope: scope,
    accessToken: accessToken,
    requestUrl: requestUrl
  }
}];
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
return [{ json: { refused: true, reason: item.reason || 'connector_unavailable', connectorId: 'microsoft.dynamics', total: 0, records: [] } }];
`
    }
  }
});

const callDataverse = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'GET Dataverse API',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.requestUrl }}'),
      authentication: 'none',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: '=Bearer {{ $json.accessToken }}' },
          { name: 'Accept', value: 'application/json' },
          { name: 'OData-MaxVersion', value: '4.0' },
          { name: 'OData-Version', value: '4.0' }
        ]
      },
      options: { neverError: true }
    }
  }
});

const formatCrmRecords = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format CRM Records',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const res = $input.first()?.json || {};
const gate = $('Gate CRM & Build Request').first()?.json || {};
const rawList = Array.isArray(res.value) ? res.value : (res && res.opportunityid ? [res] : []);

if (res.error || (typeof res.status === 'number' && res.status >= 400)) {
  const code = res.error?.message || res.error?.code || String(res.status || 'dataverse_error');
  return [{ json: { refused: false, error: String(code), connectorId: 'microsoft.dynamics', scope: gate.scope || 'deals', total: 0, records: [] } }];
}

const stageLabel = function (r) {
  const state = Number(r.statecode);
  const status = Number(r.statuscode);
  if (state === 1) return 'Won';
  if (state === 2) return 'Lost';
  if (r.stepname) return String(r.stepname);
  if (status === 1) return 'Open';
  if (status === 2) return 'On Hold';
  return 'Open';
};

const records = rawList.map(function (r) {
  const isOpp = Boolean(r.opportunityid);
  if (isOpp) {
    return {
      id: String(r.opportunityid || ''),
      name: r.name || '',
      stage: stageLabel(r),
      statecode: r.statecode,
      statuscode: r.statuscode,
      estimatedValue: r.estimatedvalue || 0,
      actualValue: r.actualvalue || 0,
      estimatedCloseDate: r.estimatedclosedate || '',
      createdOn: r.createdon || '',
      customer: r.customerid?.name || '',
      owner: r.ownerid?.fullname || ''
    };
  }
  if (r.accountid) {
    return {
      id: String(r.accountid || ''),
      name: r.name || '',
      website: r.websiteurl || '',
      phone: r.telephone1 || '',
      city: r.address1_city || '',
      revenue: r.revenue || 0,
      primaryContact: r.primarycontactid?.fullname || ''
    };
  }
  return {
    id: String(r.contactid || ''),
    fullName: r.fullname || '',
    email: r.emailaddress1 || '',
    phone: r.telephone1 || '',
    company: r.companyname || '',
    jobTitle: r.jobtitle || '',
    parentAccount: r.parentcustomerid?.name || ''
  };
});

return [{
  json: {
    refused: false,
    connectorId: 'microsoft.dynamics',
    scope: gate.scope || 'deals',
    total: records.length,
    summary: 'Live records retrieved from Dataverse (' + (gate.scope || 'deals') + ').',
    records: records
  }
}];
`
    }
  }
});

export default workflow('prism-ms-dynamics-crm-service', 'Prism - Microsoft Dynamics 365 CRM Service')
  .add(executeTrigger)
  .to(gateAndBuildRequest)
  .to(
    checkRefused
      .onTrue(formatRefusal)
      .onFalse(callDataverse.to(formatCrmRecords))
  );
