/**
 * 🔷 PRISM, Subworkflow Reference Registry
 * ============================================================================
 * n8n executes subworkflows by their database-assigned workflow ID. These IDs
 * are minted when a workflow is imported into a given n8n instance, so they
 * CANNOT be known at authoring time.
 *
 * IDs below synced from the live instance on 2026-09-16 (verified via MCP
 * search_workflows). If you re-import workflows into a NEW n8n instance,
 * every ID changes — re-pull and update this registry, then re-publish 01.
 */
export const PRISM_WORKFLOW_IDS = {
  /** Prism 00 — Tenant Context Resolver (shared sub-workflow) */
  tenantContextResolver: 'cP2OqCDVeXsV59j4',
  /** Prism 01 — Unified Copilot (chat webhook 7c41498d-23d7-482a-9adb-4a3604ec1efb) */
  unifiedCopilot: 'W3E1wzfXHbhfkNzm',
  /** Prism 02 — Intent Router (webhook /webhook/prism-intent) */
  intentRouter: 'LF0dyLVf4Jm2HY0L',
  /** Prism 09 — Admin Consent & Entitlement Helper */
  adminConsentHelper: 'rLZLH9kEubjtOFcB',
  /** Prism 10 — Microsoft Outlook Mail Service */
  msOutlookService: 'UEH38SliBb1uEXpr',
  /** Prism 11 — Microsoft SharePoint & OneDrive Service (incl. 'sites' scope) */
  msSharepointService: 'aO1bUnQFEtcgmlQb',
  /** Prism 12 — Microsoft Dynamics 365 CRM Service */
  msDynamicsCrmService: 'd4qv1LSQVF4ZSqLd',
  /** Prism 13 — Zoho CRM Service */
  zohoCrmService: '1vIvRHfDKCBhZlwy',
  /** Prism 14 — Zoho Projects Service */
  zohoProjectsService: 'q22X3dIXTxLERmW8',
  /** Prism 15 — Zoho Books Service */
  zohoBooksService: 'TVh46VCb1izL8hiw',
  /** Prism 16 — Knowledge Base Service */
  knowledgeBaseService: '0WjH1NPNsN0bN7Xm',
  /** Prism 17 — Zoho Push (Campaign Write) */
  zohoPushCampaignWrite: 'RzVkjdSDuRVA9wk5',
  /** Prism 18 — Token Refresh & Health */
  tokenRefreshHealth: 'niIyrBbjOeoycK4l',
  /** Prism 19 — Error Logger & Health (errorWorkflow target) */
  errorLoggerHealth: '519qvp5pRGIQEYEQ',
} as const;

/** True only when every referenced service has been mapped to a live DB id. */
export const arePrismWorkflowIdsResolved = (): boolean =>
  Object.values(PRISM_WORKFLOW_IDS).every((id) => !String(id).startsWith('REPLACE_AFTER_IMPORT'));
