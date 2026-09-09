# 🔷 Prism, n8n Deployment Runbook
### *Import, credential, map & verify the Phase 2 workflows (01, 02, 09–16)*

Phase 2 authored nine code-first workflows (plus the `_prism_workflow_ids.ts`
registry) in `workflows/`. They are typechecked but **not yet deployed**. This
runbook covers (A) human prerequisites, (B) the copy-paste prompt for the
**n8n-MCP agent**, and (C) the manual verification playbook.

| | |
| :--- | :--- |
| Definitions | `workflows/`, `01_prism_copilot.ts`, `02_intent_router.ts`, `09_admin_consent_helper.ts`, `10–16` service files, `_prism_workflow_ids.ts` |
| Authoring style | `@n8n/workflow-sdk`, pattern = legacy `05–07_zoho_*_service.ts` |
| Phase | 2 of the master plan (see `docs/PRISM_PRODUCT_AND_MERGE_PLAN.md` §7, §14) |

---

## A. Human prerequisites

1. **Credentials to create in n8n** (names must match `newCredential(...)` in the files):

| Credential name | Type | Used by |
| :--- | :--- | :--- |
| `Zoho account` | Zoho OAuth2 | 13, 14, 15 |
| `Supabase account` | Supabase API (Project URL + service role secret) | 16, 01 (KB tool) |
| `Google Gemini(PaLM) Api account` | Google Gemini API | 01 (model + embeddings), 02 |

2. **Webhook paths that must become reachable** after import:
   - `01_prism_copilot` chat webhook (its URL is what the frontend `N8N_WEBHOOK_URL` points to)
   - `/webhook/prism-intent` (02)
   - `/webhook/prism-admin-consent` (09)

3. **After the agent maps IDs:** paste them into `workflows/_prism_workflow_ids.ts`
   and re-import `01_prism_copilot.ts` so its tool references resolve.

---

## B. Copy-paste prompt for the n8n-MCP agent

> You are operating the n8n instance that backs **Prism**, a unified copilot
> over Microsoft 365 (Outlook, SharePoint, Dynamics 365 CRM) and Zoho (CRM,
> Projects, Books). The code-first workflow definitions **already exist and are
> typechecked** in `workflows/` of the Prism repo, do **not** recreate them.
> Your job: import them, ensure credentials, map workflow IDs, and verify they
> run.
>
> Files (one workflow per file): `10_ms_outlook_service.ts`,
> `11_ms_sharepoint_service.ts`, `12_ms_dynamics_crm_service.ts`,
> `13_zoho_crm_service.ts`, `14_zoho_projects_service.ts`,
> `15_zoho_books_service.ts`, `16_knowledge_base_service.ts`,
> `02_intent_router.ts`, `09_admin_consent_helper.ts`, `01_prism_copilot.ts`.
> They follow the SDK pattern in legacy `05–07_zoho_*_service.ts` (executeWorkflow
> trigger → gate code → ifElse → HTTP Request → format code) and import nothing
> beyond `@n8n/workflow-sdk` and, for 01, `./_prism_workflow_ids`.
>
> **Step 1, Credentials.** Create or confirm n8n credentials with these exact
> names and types:
> - `Zoho account` → Zoho OAuth2
> - `Supabase account` → Supabase API (project URL + service role secret)
> - `Google Gemini(PaLM) Api account` → Google Gemini API key
>
> **Step 2, Import in this order:** all services `10` → `16` first, then
> `02_intent_router` and `09_admin_consent_helper`, then `01_prism_copilot`
> **last** (it references the service workflows by database ID).
>
> **Step 3, Map workflow IDs.** After each import, capture the n8n-assigned
> database ID and produce a mapping for: `10 → msOutlookService`,
> `11 → msSharepointService`, `12 → msDynamicsCrmService`,
> `13 → zohoCrmService`, `14 → zohoProjectsService`, `15 → zohoBooksService`,
> `16 → knowledgeBaseService`. If you can write files in the repo, update
> `workflows/_prism_workflow_ids.ts` with these IDs; otherwise return the
> mapping table so the developer can paste it in.
>
> **Step 4, Re-import** `01_prism_copilot.ts` after the IDs are mapped so its
> `toolWorkflow` references resolve. Report the chat webhook URL/path of 01 and
> confirm the `prism-intent` and `prism-admin-consent` webhook paths are active.
>
> **Step 5, Verify execution (never against production data beyond read-only):**
> 1. For EVERY service workflow (10–16): execute with input
>    `{ connectorEnabled: false, entitlement: true }` and assert the single
>    output item is `{ refused: true, reason: "connector_disabled", ... }` with
>    zero external provider calls. This exercises the gate + ifElse + formatter
>    wiring with no tokens and no credentials.
> 2. Zoho services 13–15: execute with `{ connectorEnabled: true, scope:
>    "deals" | "projects" | "invoices", limit: 1 }` using the org `Zoho account`
>    credential; confirm `records[]` returns live data, or a clean `error`
>    object on failure, never a crash.
> 3. Microsoft services 10–12: run the refusal test only (no user token is
>    available). Inspect the HTTP Request node after import and confirm the
>    `Authorization` header parameter rendered correctly (expression
>    `Bearer {{ $json.accessToken }}`); report any rendering issue.
> 4. Service 16: refusal test only; then, if Supabase is reachable from n8n,
>    POST a real embedding array with `matchCount: 5` and report the result, >    otherwise report the exact connectivity error.
> 5. Workflow 02: POST `{"message": "show my last 3 unread emails"}` to the
>    `prism-intent` webhook and confirm it returns JSON with
>    `"intent": "CONNECTOR_microsoft.outlook"`.
> 6. Workflow 09: POST
>    `{"clientId": "<a-test-client-id>", "tenantId": "common",
>    "redirectUri": "https://localhost:3000/api/...", "connectors":
>    ["sharepoint", "dynamics"]}` and confirm an `adminConsentUrl` and
>    `entitlementChecklist` are returned.
> 7. Workflow 01: open its chat and send "hello", confirm streaming works and
>    no tool fires without connector context; then send a Zoho question (e.g.
>    "Show my recent Zoho CRM deals") and confirm the Zoho CRM tool executes and
>    returns live records or an explicit empty/error result.
>
> **Report back:** the ID mapping table, credential status, the three webhook
> URLs/paths, and per-workflow verification results (including exact refusal
> outputs), plus any node config that needed manual adjustment after import.

---

## C. Manual verification playbook (if no MCP agent)

1. Import via the n8n UI/CLI in the same order as Step 2 above.
2. Update `workflows/_prism_workflow_ids.ts` and re-import 01.
3. Execute each service with `{ connectorEnabled: false }` → expect
   `{ refused: true, reason: "connector_disabled" }` and **no** provider call.
4. Live Zoho check: 13 scope `deals`, 14 scope `projects`, 15 scope `invoices`
   with `limit: 1` → expect live records or a clean error object.
5. From the Next.js app: set `N8N_WEBHOOK_URL` to workflow 01's chat webhook,
   then chat and watch tool labels + source-tagged answers stream in.

> ⚠️ Microsoft services need a real user access token for live calls, the
> refusal path is the safe automated check until the Phase 4 connector UI
> supplies tokens. Keep all probes read-only.
