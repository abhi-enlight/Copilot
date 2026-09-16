import { workflow, trigger, node, ifElse, expr } from '@n8n/workflow-sdk';

/**
 * 🔷 PRISM 10, Microsoft Outlook Mail Service
 * ----------------------------------------------------------------------------
 * Scoped, read-only mail access for the authenticated user. The user's own
 * access token is injected at runtime by the Next.js connector layer, it is
 * NEVER stored in this workflow. The connector gate refuses execution when the
 * user disabled the connector or the entitlement probe failed.
 *
 * workflowInputs:
 *   accessToken       string   user-managed Microsoft Graph bearer token
 *   connectorEnabled  boolean  user toggle (UI → backend)
 *   entitlement       boolean  provider permission probe result
 *   scope             'list' | 'search' | 'thread'
 *   query?            string   search term / thread (conversation) id
 *   limit?            number   max records (default 10)
 *
 * Output (single JSON item):
 *   { refused?, reason?, connectorId, scope, total, records[] }
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
          { name: 'query', type: 'string' },
          { name: 'limit', type: 'number' },
          { name: 'to', type: 'string' },
          { name: 'cc', type: 'string' },
          { name: 'subject', type: 'string' },
          { name: 'body', type: 'string' }
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
const scope = String(item.scope || 'list');
const query = String(item.query || '').trim();
const limit = Math.min(parseInt(item.limit, 10) || 10, 50);

if (connectorPaused) {
  return [{ json: { refused: true, reason: 'connector_paused', connectorId: 'microsoft.outlook', records: [] } }];
}
if (connectorEnabled === false) {
  return [{ json: { refused: true, reason: 'connector_disabled', connectorId: 'microsoft.outlook', records: [] } }];
}
if (entitlement === false) {
  return [{ json: { refused: true, reason: 'not_entitled', connectorId: 'microsoft.outlook', records: [] } }];
}
if (!accessToken) {
  return [{ json: { refused: true, reason: 'missing_token', connectorId: 'microsoft.outlook', records: [] } }];
}

const GRAPH = 'https://graph.microsoft.com/v1.0';
let requestUrl = '';
let httpMethod = 'GET';
let requestBody = null;

if (scope === 'search') {
  const safeQuery = query.replace(/"/g, '');
  requestUrl = GRAPH + '/me/messages?$search="' + encodeURIComponent(safeQuery) + '"&$top=' + limit +
    '&$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,hasAttachments,isRead,webLink,conversationId';
} else if (scope === 'thread') {
  const threadId = encodeURIComponent(query);
  requestUrl = GRAPH + '/me/messages?$filter=conversationId%20eq%20%27' + threadId +
    '%27&$top=50&$orderby=receivedDateTime%20asc' +
    '&$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,hasAttachments,isRead,webLink,conversationId';
} else if (scope === 'send') {
  requestUrl = GRAPH + '/me/sendMail';
  httpMethod = 'POST';
  const toList = (String(item.to || '')).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  const ccList = (String(item.cc || '')).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  requestBody = {
    message: {
      subject: item.subject || '(No Subject)',
      body: { contentType: 'HTML', content: item.body || '' },
      toRecipients: toList.map(function(a) { return { emailAddress: { address: a } }; }),
      ccRecipients: ccList.map(function(a) { return { emailAddress: { address: a } }; })
    },
    saveToSentItems: 'true'
  };
} else if (scope === 'draft') {
  requestUrl = GRAPH + '/me/messages';
  httpMethod = 'POST';
  const toList = (String(item.to || '')).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  const ccList = (String(item.cc || '')).split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  requestBody = {
    subject: item.subject || '(Draft Subject)',
    body: { contentType: 'HTML', content: item.body || '' },
    toRecipients: toList.map(function(a) { return { emailAddress: { address: a } }; }),
    ccRecipients: ccList.map(function(a) { return { emailAddress: { address: a } }; })
  };
} else {
  requestUrl = GRAPH + '/me/messages?$top=' + limit + '&$orderby=receivedDateTime%20desc' +
    '&$select=id,subject,from,toRecipients,receivedDateTime,bodyPreview,hasAttachments,isRead,webLink,conversationId';
}

return [{
  json: {
    refused: false,
    connectorId: 'microsoft.outlook',
    scope: scope,
    accessToken: accessToken,
    requestUrl: requestUrl,
    httpMethod: httpMethod,
    requestBody: requestBody
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
return [{ json: { refused: true, reason: item.reason || 'connector_unavailable', connectorId: 'microsoft.outlook', scope: item.scope || 'list', total: 0, records: [] } }];
`
    }
  }
});

const callGraph = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Call Microsoft Graph API',
    parameters: {
      method: expr('={{ $json.httpMethod || "GET" }}'),
      url: expr('{{ $json.requestUrl }}'),
      authentication: 'none',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: '=Bearer {{ $json.accessToken }}' },
          { name: 'Accept', value: 'application/json' },
          { name: 'Content-Type', value: 'application/json' }
        ]
      },
      sendBody: expr("={{ ['POST', 'PUT', 'PATCH'].includes($json.httpMethod) }}"),
      specifyBody: 'json',
      jsonBody: expr('={{ JSON.stringify($json.requestBody || {}) }}'),
      options: { neverError: true }
    }
  }
});

const formatMessages = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Format Mail Records',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const res = $input.first()?.json || {};
const gate = $('Gate Connector & Build Request').first()?.json || {};

if (gate.scope === 'send') {
  if (res.error || (res.status && res.status >= 400)) {
    return [{ json: { refused: false, error: String(res.error?.code || res.status || 'send_failed'), connectorId: 'microsoft.outlook', scope: 'send', success: false } }];
  }
  return [{ json: { refused: false, connectorId: 'microsoft.outlook', scope: 'send', success: true, summary: 'Email sent successfully via Microsoft Outlook.' } }];
}

if (gate.scope === 'draft') {
  if (res.error || (res.status && res.status >= 400)) {
    return [{ json: { refused: false, error: String(res.error?.code || res.status || 'draft_failed'), connectorId: 'microsoft.outlook', scope: 'draft', success: false } }];
  }
  return [{ json: { refused: false, connectorId: 'microsoft.outlook', scope: 'draft', success: true, draftId: res.id, webLink: res.webLink, summary: 'Draft created successfully in Microsoft Outlook.' } }];
}

const rawList = Array.isArray(res.value) ? res.value : [];

if (res.error || (res.status && res.status >= 400)) {
  const code = res.error?.code || res.status || 'graph_error';
  return [{ json: { refused: false, error: String(code), connectorId: 'microsoft.outlook', scope: gate.scope || 'list', total: 0, records: [] } }];
}

const records = rawList.map(function (m) {
  const from = m.from?.emailAddress || {};
  const to = (m.toRecipients || []).map(function (t) { return t.emailAddress?.address || ''; }).filter(Boolean);
  return {
    id: String(m.id || ''),
    subject: m.subject || '(No Subject)',
    fromName: from.name || '',
    fromAddress: from.address || '',
    toAddresses: to,
    preview: m.bodyPreview || '',
    receivedDateTime: m.receivedDateTime || '',
    hasAttachments: Boolean(m.hasAttachments),
    isRead: Boolean(m.isRead),
    webLink: m.webLink || '',
    conversationId: m.conversationId || ''
  };
});

return [{
  json: {
    refused: false,
    connectorId: 'microsoft.outlook',
    scope: gate.scope || 'list',
    total: records.length,
    summary: 'Live mail messages retrieved from Microsoft Graph for the authenticated user.',
    records: records
  }
}];
`
    }
  }
});

export default workflow('prism-ms-outlook-service', 'Prism - Microsoft Outlook Mail Service')
  .add(executeTrigger)
  .to(gateAndBuildRequest)
  .to(
    checkRefused
      .onTrue(formatRefusal)
      .onFalse(callGraph.to(formatMessages))
  );
