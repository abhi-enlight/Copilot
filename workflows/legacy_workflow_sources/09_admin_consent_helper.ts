import { workflow, trigger, node } from '@n8n/workflow-sdk';

/**
 * 🔷 PRISM 09, Admin Consent & Entitlement Helper
 * ----------------------------------------------------------------------------
 * Generates the Microsoft Entra ID tenant admin-consent URL for an
 * organization-scoped connector (SharePoint tenant-wide / Dynamics 365) plus a
 * machine-readable entitlement checklist. Pure configuration output, no LLM,
 * no external calls, fully deterministic.
 *
 * Webhook: POST /webhook/prism-admin-consent
 *   body { tenantId, clientId, redirectUri, connectors: ["sharepoint","dynamics"] }
 *
 * Response:
 *   {
 *     adminConsentUrl,      // https://login.microsoftonline.com/{tenantId}/adminconsent?...
 *     requiredScopes: [...],   // rendered per requested connector
 *     entitlementChecklist: [...],  // what the admin/license must satisfy
 *     clientId, tenantId
 *   }
 */
const consentWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Admin Consent Request Webhook',
    parameters: {
      httpMethod: 'POST',
      path: 'prism-admin-consent',
      responseMode: 'responseNode',
      options: {}
    }
  }
});

const buildConsentPayload = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Consent URL & Checklist',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const body = $input.first()?.json?.body || {};
const tenantId = String(body.tenantId || 'common').trim();
const clientId = String(body.clientId || '').trim();
const redirectUri = String(body.redirectUri || '').trim();
const requested = Array.isArray(body.connectors) ? body.connectors : ['sharepoint', 'dynamics'];

if (!clientId) {
  return [{ json: { error: 'clientId is required', success: false } }];
}

const SCOPE_MAP = {
  sharepoint: {
    scope: 'https://graph.microsoft.com/Sites.Read.All',
    note: 'Tenant-wide SharePoint read. Grants access to all site libraries the requesting users can already reach.'
  },
  dynamics: {
    scope: 'SCOPE_DYNAMICS_ORG_USER_IMPERSONATION',
    note: 'Dynamics 365 Dataverse user_impersonation for <org>.crm*.dynamics.com. Replace SCOPE with the real org resource in the consent URL.'
  },
  mail: {
    scope: 'https://graph.microsoft.com/Mail.Read',
    note: 'Usually NOT required: personal Mail.Read needs no admin consent. Included only if your tenant policy blocks user consent.'
  },
  files: {
    scope: 'https://graph.microsoft.com/Files.Read',
    note: 'User-level file read. Admin consent only needed when tenant policy blocks user consent.'
  }
};

const wanted = requested.filter(function (c) { return SCOPE_MAP[c]; });
const scopeParams = [];
const requiredScopes = [];
const entitlementChecklist = [];
const notes = [];

wanted.forEach(function (c) {
  const info = SCOPE_MAP[c];
  requiredScopes.push(info.scope);
  notes.push(c + ': ' + info.note);
});

if (wanted.indexOf('sharepoint') >= 0) {
  scopeParams.push('Sites.Read.All');
  entitlementChecklist.push('Admin: grant tenant-wide consent once for Sites.Read.All.');
  entitlementChecklist.push('User: must already have access to the target SharePoint sites in Entra ID.');
}
if (wanted.indexOf('dynamics') >= 0) {
  entitlementChecklist.push('User: must hold a Dynamics 365 license (SKU check via /me/licenseDetails).');
  entitlementChecklist.push('User: must have a Dataverse security role (WhoAmI probe).');
  entitlementChecklist.push('Admin: optional app user / environment approval in Power Platform Admin Center.');
  entitlementChecklist.push('Scope: https://<org>.crm<region>.dynamics.com/user_impersonation must be appended to the consent URL.');
}
if (wanted.indexOf('mail') >= 0 || wanted.indexOf('files') >= 0) {
  entitlementChecklist.push('Personal-tier connectors (Mail.Read / Files.Read) normally need NO admin consent.');
}

const encodedScopes = encodeURIComponent(requiredScopes.join(' '));
const encodedRedirect = encodeURIComponent(redirectUri || 'https://app.prism.example/auth/callback');
const adminConsentUrl =
  'https://login.microsoftonline.com/' + encodeURIComponent(tenantId) +
  '/adminconsent?client_id=' + encodeURIComponent(clientId) +
  '&redirect_uri=' + encodedRedirect +
  (scopeParams.length ? '&scope=' + encodedScopes : '');

return [{
  json: {
    success: true,
    adminConsentUrl: adminConsentUrl,
    requiredScopes: requiredScopes,
    entitlementChecklist: entitlementChecklist,
    notes: notes,
    clientId: clientId,
    tenantId: tenantId
  }
}];
`
    }
  }
});

const respondConsent = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Consent JSON',
    parameters: {
      respondWith: 'json',
      responseBody: '={{ JSON.stringify($json) }}',
      options: {}
    }
  }
});

export default workflow('prism-admin-consent-helper', 'Prism - Admin Consent & Entitlement Helper')
  .add(consentWebhook)
  .to(buildConsentPayload)
  .to(respondConsent);
