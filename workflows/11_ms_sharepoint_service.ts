import { workflow, trigger, node, ifElse, expr } from '@n8n/workflow-sdk';

/**
 * 🔷 PRISM 11, Microsoft SharePoint / OneDrive Service
 * ----------------------------------------------------------------------------
 * Scoped, read-only document access. Two tiers:
 *   scope 'onedrive'  → the user's own OneDrive (/me/drive), personal tier.
 *   scope 'site'      → an org SharePoint drive (requires Sites.Read.All and
 *                       admin consent, entitlement is verified upstream).
 *
 * workflowInputs:
 *   accessToken       string   user (or org-delegated) Graph bearer token
 *   connectorEnabled  boolean  user toggle
 *   entitlement       boolean  provider permission probe result
 *   scope             'onedrive' | 'site'
 *   siteId?           string   org drive id or 'root' (ignored for onedrive)
 *   itemId?           string   driveItem to descend into
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
          { name: 'connectorEnabled', type: 'boolean' },
          { name: 'connectorPaused', type: 'boolean' },
          { name: 'entitlement', type: 'boolean' },
          { name: 'scope', type: 'string' },
          { name: 'siteId', type: 'string' },
          { name: 'itemId', type: 'string' },
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
    name: 'Gate Connector & Build Request',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const item = $input.first()?.json || {};
const accessToken = String(item.accessToken || '');
const connectorEnabled = item.connectorEnabled !== false;
const connectorPaused = item.connectorPaused === true;
const entitlement = item.entitlement !== false;
const scope = String(item.scope || 'onedrive');
const siteId = String(item.siteId || 'root').trim();
const itemId = String(item.itemId || '').trim();
const limit = Math.min(parseInt(item.limit, 10) || 15, 100);

if (connectorPaused) {
  return [{ json: { refused: true, reason: 'connector_paused', connectorId: 'microsoft.sharepoint', records: [] } }];
}
if (connectorEnabled === false) {
  return [{ json: { refused: true, reason: 'connector_disabled', connectorId: 'microsoft.sharepoint', records: [] } }];
}
if (entitlement === false) {
  return [{ json: { refused: true, reason: 'not_entitled', connectorId: 'microsoft.sharepoint', records: [] } }];
}
if (!accessToken) {
  return [{ json: { refused: true, reason: 'missing_token', connectorId: 'microsoft.sharepoint', records: [] } }];
}

const GRAPH = 'https://graph.microsoft.com/v1.0';
let driveBase = '';
if (scope === 'site') {
  driveBase = siteId === 'root' ? '/sites/root/drive' : '/sites/' + encodeURIComponent(siteId) + '/drive';
} else {
  driveBase = '/me/drive';
}

let requestUrl = '';
if (itemId) {
  requestUrl = GRAPH + driveBase + '/items/' + encodeURIComponent(itemId) + '/children';
} else {
  requestUrl = GRAPH + driveBase + '/root/children';
}
requestUrl += '?$top=' + limit + '&$select=id,name,size,webUrl,lastModifiedDateTime,file,folder,parentReference';

return [{
  json: {
    refused: false,
    connectorId: 'microsoft.sharepoint',
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
return [{ json: { refused: true, reason: item.reason || 'connector_unavailable', connectorId: 'microsoft.sharepoint', total: 0, records: [] } }];
`
    }
  }
});

const callGraph = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'GET Microsoft Graph Drive Children',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.requestUrl }}'),
      authentication: 'none',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: '=Bearer {{ $json.accessToken }}' },
          { name: 'Accept', value: 'application/json' }
        ]
      },
      options: { neverError: true }
    }
  }
});

const formatDriveItems = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format Drive Records',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const res = $input.first()?.json || {};
const gate = $('Gate Connector & Build Request').first()?.json || {};
const rawList = Array.isArray(res.value) ? res.value : [];

if (res.error || (res.status && res.status >= 400)) {
  const code = res.error?.code || res.status || 'graph_error';
  return [{ json: { refused: false, error: String(code), connectorId: 'microsoft.sharepoint', scope: gate.scope || 'onedrive', total: 0, records: [] } }];
}

const records = rawList.map(function (d) {
  const isFolder = Boolean(d.folder);
  const parent = d.parentReference || {};
  return {
    id: String(d.id || ''),
    name: d.name || '',
    size: d.size || 0,
    webUrl: d.webUrl || '',
    lastModifiedDateTime: d.lastModifiedDateTime || '',
    isFolder: isFolder,
    mimeType: d.file?.mimeType || (isFolder ? 'folder' : ''),
    childCount: isFolder ? (d.folder?.childCount || 0) : undefined,
    parentDriveId: parent.driveId || '',
    parentPath: parent.path || ''
  };
});

return [{
  json: {
    refused: false,
    connectorId: 'microsoft.sharepoint',
    scope: gate.scope || 'onedrive',
    total: records.length,
    summary: 'Live drive items retrieved from Microsoft Graph for the authenticated context.',
    records: records
  }
}];
`
    }
  }
});

export default workflow('prism-ms-sharepoint-service', 'Prism - Microsoft SharePoint / OneDrive Service')
  .add(executeTrigger)
  .to(gateAndBuildRequest)
  .to(
    checkRefused
      .onTrue(formatRefusal)
      .onFalse(callGraph.to(formatDriveItems))
  );
