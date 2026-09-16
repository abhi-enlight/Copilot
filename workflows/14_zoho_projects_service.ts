import { workflow, trigger, node, ifElse, expr } from '@n8n/workflow-sdk';

/**
 * 🔷 PRISM 14, Zoho Projects Service (port of legacy 06 with connector gate)
 * ----------------------------------------------------------------------------
 * Reads Zoho Projects portals/projects with the CALLING USER's own Zoho token
 * (multi-tenant). The user's portalId + dataCenter are discovered at connect
 * time by the Next.js integration layer and passed via orgConfig; legacy
 * values remain only as documented fallbacks.
 *
 * workflowInputs:
 *   connectorEnabled  boolean
 *   entitlement       boolean
 *   accessToken       string   per-user Zoho OAuth access token
 *   scope             'projects' | 'project'
 *   recordId?         string   project id for scope 'project'
 *   limit?            number
 *   orgConfig?        { dataCenter?: string; portalId?: string }
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
    name: 'Gate & Parse Projects Scope',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const item = $input.first()?.json || {};
const connectorEnabled = item.connectorEnabled !== false;
const connectorPaused = item.connectorPaused === true;
const entitlement = item.entitlement !== false;
const userToken = String(item.accessToken || '').trim();
const scope = String(item.scope || 'projects');
const explicitId = String(item.recordId || '').trim();
const cfg = item.orgConfig && typeof item.orgConfig === 'object' ? item.orgConfig : {};
const dc = String(cfg.dataCenter || 'in').replace(/^zoho\\./, '');
const portalId = String(cfg.portalId || '60085935707').trim();
const apiBase = 'https://projectsapi.zoho.' + dc + '/api/v3/portal/' + portalId;

if (connectorPaused) {
  return [{ json: { refused: true, reason: 'connector_paused', connectorId: 'zoho.projects', records: [] } }];
}
if (connectorEnabled === false) {
  return [{ json: { refused: true, reason: 'connector_disabled', connectorId: 'zoho.projects', records: [] } }];
}
if (entitlement === false) {
  return [{ json: { refused: true, reason: 'not_entitled', connectorId: 'zoho.projects', records: [] } }];
}
if (!userToken) {
  return [{ json: { refused: true, reason: 'no_zoho_connection', connectorId: 'zoho.projects', records: [] } }];
}

let requestUrl = apiBase;
let scopeType = scope;

if (scope === 'project' && explicitId) {
  requestUrl = apiBase + '/projects/' + explicitId;
  scopeType = 'project';
} else {
  requestUrl = apiBase + '/projects';
  scopeType = 'projects';
}

return [{ json: { refused: false, requestUrl: requestUrl, scopeType: scopeType, portalId: portalId, userToken: userToken } }];
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
return [{ json: { refused: true, reason: item.reason || 'connector_unavailable', connectorId: 'zoho.projects', total: 0, records: [] } }];
`
    }
  }
});

// Per-user token path: Bearer header against the connected user's own Zoho portal.
const getZohoProjects = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'GET Zoho Projects',
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

const formatProjects = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format Projects Records',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const items = $input.all().map(function (i) { return i.json; });
const res = items[0] || {};
const meta = $('Gate & Parse Projects Scope').first()?.json || {};
const scopeType = meta.scopeType || 'projects';
let rawList = [];

if (scopeType === 'project' && res.id) rawList = [res];
else if (Array.isArray(res.projects)) rawList = res.projects;
else if (Array.isArray(res.data)) rawList = res.data;
else if (items.length > 0 && items[0].id) rawList = items;

if (!rawList.length && (res.error || res.status_code === 404 || (typeof res.message === 'string' && res.message.includes('not exist')))) {
  return [{ json: { refused: false, error: String(res.message || res.error || 'zoho_projects_error'), connectorId: 'zoho.projects', total: 0, records: [] } }];
}

const records = rawList.map(function (p) {
  return {
    id: String(p.id_string || p.id || ''),
    key: p.key || '',
    name: p.name || p.project_name || 'Untitled',
    status: p.status?.name || (typeof p.status === 'string' ? p.status : 'active'),
    description: p.description || '',
    openTasks: p.tasks?.open_count !== undefined ? p.tasks.open_count : (p.open_task_count || 0),
    closedTasks: p.tasks?.closed_count !== undefined ? p.tasks.closed_count : (p.closed_task_count || 0),
    owner: p.owner?.name || p.owner_name || 'Owner',
    createdTime: p.created_time || ''
  };
});

return [{
  json: {
    refused: false,
    scoped: scopeType === 'project',
    connectorId: 'zoho.projects',
    portalId: meta.portalId || '60085935707',
    total: records.length,
    records: records
  }
}];
`
    }
  }
});

export default workflow('prism-zoho-projects-service', 'Prism - Zoho Projects Service')
  .add(executeTrigger)
  .to(parseScope)
  .to(
    checkRefused
      .onTrue(formatRefusal)
      .onFalse(getZohoProjects.to(formatProjects))
  );
