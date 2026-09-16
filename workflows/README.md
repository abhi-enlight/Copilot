# n8n Workflows — Prism v2 (canonical)

This folder is the **source of truth** for the Prism v2 n8n deployment on `indigo-pelican-266513.hostingersite.com`.

## Layout

| Path | What it is |
|---|---|
| `01_prism_copilot.ts`, `10_…`–`16_…` | Authoring sources (n8n Workflow SDK `.ts`) for the **active Prism v2 workflows**. These compile to the workflows live on the instance. |
| `_prism_workflow_ids.ts` | Registry of **live instance workflow IDs** (synced 2026-09-16 via MCP). Re-import into a new instance ⇒ every ID changes; update this registry, then re-publish Prism 01. |
| `n8n_instance_snapshot/` | Byte-faithful **pulls of all 23 workflows currently on the instance** (JSON), taken 2026-09-16. Includes `_snapshot_meta` notes per file. Re-importable for disaster recovery. |
| `n8n_instance_snapshot/legacy_archive/` | (reserved) archived legacy workflows that were **deleted from the instance** — kept for audit. The 4 deleted BCP webhook workflows (Passive Task Extractor V2 `ZP0FeeqUw0aTIVfl`, Delete `efut4sCR6d21TptJ`, Update `tDWlAOauH9kgJOsl`, Task Status Sync `KFlcCSLGG2KCggC0`) were archived on the instance itself. |
| `legacy_workflow_sources/` | Old BCP v1 authoring sources (demo-org writers, mock tools, stale drafts) — **not deployed**, kept for history only. |
| `tsconfig.json`, `n8n-workflow-sdk.d.ts` | Compile support for the SDK sources. |

## Live Prism v2 topology (instance IDs as of 2026-09-16)

| # | Workflow | Instance ID | Trigger |
|---|---|---|---|
| 00 | Tenant Context Resolver | `cP2OqCDVeXsV59j4` | executeWorkflow (shared) |
| 01 | Unified Copilot | `W3E1wzfXHbhfkNzm` | chat `7c41498d-23d7-482a-9adb-4a3604ec1efb` |
| 02 | Intent Router | `LF0dyLVf4Jm2HY0L` | webhook `/webhook/prism-intent` |
| 09 | Admin Consent & Entitlement Helper | `rLZLH9kEubjtOFcB` | webhook |
| 10 | Outlook Mail Service | `UEH38SliBb1uEXpr` | executeWorkflow |
| 11 | SharePoint & OneDrive Service (incl. `sites` scope) | `aO1bUnQFEtcgmlQb` | executeWorkflow |
| 12 | Dynamics 365 CRM Service | `d4qv1LSQVF4ZSqLd` | executeWorkflow |
| 13 | Zoho CRM Service | `1vIvRHfDKCBhZlwy` | executeWorkflow |
| 14 | Zoho Projects Service | `q22X3dIXTxLERmW8` | executeWorkflow |
| 15 | Zoho Books Service | `TVh46VCb1izL8hiw` | executeWorkflow |
| 16 | Knowledge Base Service | `0WjH1NPNsN0bN7Xm` | executeWorkflow |
| 17 | Zoho Push (Campaign Write) | `RzVkjdSDuRVA9wk5` | webhook |
| 18 | Token Refresh & Health | `niIyrBbjOeoycK4l` | schedule |
| 19 | Error Logger & Health | `519qvp5pRGIQEYEQ` | executeWorkflow (errorWorkflow of 01) |

## Still active legacy workflows on the instance (candidates to archive)

- **BCP Assist - Campaign Brain & Copilot** `Ltbh1TmvK7R4MA1W` (chat trigger `20bf7228…`) — superseded by Prism 01
- **BCP Assist - Smart Client Email Drafter** `DsEn5VzZy71Cp9YG` (webhook `bcp-email-draft`) — superseded by frontend mail draft/send
- **BCP Assist - Proactive Daily Risk & Deadline Nudge** `I1MupTfDAaVMY0dt` — referenced by `N8N_RISK_WORKFLOW_WEBHOOK`; keep until the risk digest is re-pointed
- **Zoho CRM Deals / Projects / Books Services** `jAFjtinGr4tCoI4h` / `XngVaIJILTO6B2Bv` / `iXeJxuXe1buHC7Vt` — tools of the legacy Campaign Brain
- **Test Deal Get HTTP** `eGz9QGE5fgIXpgeQ` (inactive) — demo delete webhook
- **Operations Copilot ×2** `I5sEuK25iV63AghV` / `GC7Czgxq3lIvx2hR` (inactive) — mock tools

All are snapshotted under `n8n_instance_snapshot/` with `*_legacy*` filenames.
