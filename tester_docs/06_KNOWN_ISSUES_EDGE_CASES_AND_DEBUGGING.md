# 🔍 06. Known Issues, Edge Cases & Debugging Guide

> **Target Audience**: All Testers, QA Leads, Support Engineers.  
> **Goal**: Rapidly diagnose known external provider quirks, edge cases, error codes, and submit reproducible bug reports.

---

## 1. Top Edge Cases & Known External Provider Quirks

### 1.1 Microsoft Graph API Quirks

#### A. The `$search` and `$orderby` Incompatibility
- **Symptom**: Microsoft Graph returns error `SearchWithOrderByNotSupported` (HTTP 400).
- **Root Cause**: Microsoft Graph OData parser does not permit combining `$search` with `$orderby`. When searching mail or drive items, Graph automatically ranks results by relevance.
- **Verification Rule**: Verify that query builders in `src/lib/microsoft-graph.ts` and `workflows/10_ms_outlook_service.ts` remove `$orderby` whenever a dynamic search term is supplied.

#### B. Empty Search Binding Crash
- **Symptom**: Error: `An identifier was expected at position 0`.
- **Root Cause**: Passing an empty string in `$search=""` crashes the Graph OData engine.
- **Fix / Rule**: Search endpoints must omit the `$search` parameter entirely when the search query is blank or whitespace, and include the `ConsistencyLevel: eventual` header.

#### C. OData Array Wrapping (`data.value`)
- **Symptom**: Frontend table shows `undefined` or a single row containing `[object Object]`.
- **Root Cause**: Microsoft Graph wraps list responses in an envelope: `{ "@odata.context": "...", "value": [...] }`.
- **Expected Pattern**: Code must always unpack rows using: `return data.value || data;`.

---

### 1.2 Dynamics 365 Dataverse Quirks

#### Error `0x80072560`: *"The user is not a member of the organization"*
- **Symptom**: Azure Entra ID token is successfully issued, but any query to Dynamics 365 Dataverse returns HTTP 403 / Error `0x80072560`.
- **Root Cause**: The Azure App Registration is authenticated by Entra ID, but it has not been registered inside the Power Platform Admin Center environment as an **Application User** with a Security Role (e.g., `System Administrator` or `Dynamics 365 Sales`).
- **Tester Action**: Flag as an environment configuration issue, not a frontend code bug.

---

### 1.3 Zoho Suite Quirks

#### A. Datacenter (Multi-DC) Mismatch
- **Symptom**: Connecting Zoho returns `access_denied`, `invalid_client`, or `token_exchange_failed`.
- **Root Cause**: Zoho accounts are strictly regional. An account registered on `zoho.com` (US) cannot authenticate against `accounts.zoho.in` (India) unless Multi-DC is enabled in the Zoho API Console.
- **Tester Action**: In the **Connections** view, change the datacenter dropdown to match the test account's actual domain (`in`, `com`, `eu`, `com.au`).

#### B. 60-Minute Token Expiration
- **Symptom**: Zoho API calls start returning HTTP 401 after 1 hour of testing.
- **Expected Behavior**: The background token refresh daemon (`src/instrumentation.ts`) should silently refresh the token before it expires.
- **If It Fails**: Verify `INTEGRATION_ENCRYPTION_KEY` has not changed between server restarts. If the key changes, stored refresh tokens cannot be decrypted, triggering a "Reconnection required" badge.

---

### 1.4 The Historic "No CRM Access" Bug: What Was Fixed

| Legacy Behavior (Bug) | Modern Prism Behavior (Fixed) |
| :--- | :--- |
| Personal Microsoft login immediately reported CRM as broken/error. | Personal accounts see CRM as **Not Entitled** with a lock icon. |
| Hardcoded license probe crashed for standard non-admin employees. | App roles (Admin/Owner) provide entitlement overrides. |
| Red error banner displayed with no next steps. | Displays `NoAccessModal` with actionable instructions to request enterprise licensing. |

---

## 2. Common Error Codes & Resolution Table

| Error Message / Code | Where It Occurs | Cause | Tester Action |
| :--- | :--- | :--- | :--- |
| `ERR_CRYPTO_INITIALIZATION` | Server Startup | `INTEGRATION_ENCRYPTION_KEY` is not exactly 64 hex chars. | Update `.env.local` with valid 32-byte hex string. |
| `42501 (insufficient_privilege)` | Supabase Database | Row Level Security (RLS) blocked the query. | Verify user is assigned to an organization and JWT contains valid `org_id`. |
| `refused: true, reason: connector_disabled` | n8n Execution | User paused the connector or lacks entitlement. | Normal expected behavior when connector switch is OFF. |
| `ZOHO_CLIENT_SECRET is missing` | Connections View | Zoho OAuth variables not set in `.env.local`. | Add credentials from Zoho API Console. |
| `Token mismatch / IV length error` | Auth Callback | Stored token encrypted with a different key. | Disconnect and reconnect the account to re-encrypt with the active key. |

---

## 3. Recommended Bug Report Template for Testers

When filing a bug report for Prism, use this template:

```markdown
### 🐛 Bug Title: [Brief 1-line summary]

**Module**: [e.g., Connections / Copilot / Campaigns / OAuth]
**Severity**: [Blocker / Critical / Major / Minor]
**Persona Used**: [e.g., Enterprise Owner / Standard Member / Viewer]

#### Steps to Reproduce:
1. Navigate to ...
2. Click on ...
3. Enter payload: ...
4. Observe reaction ...

#### Expected Result:
[What should have happened according to specs]

#### Actual Result:
[What actually occurred, e.g., UI hung, modal failed to open, 500 status]

#### Screenshots / Video:
[Attach screenshot or console log output]

#### Network / Console Logs:
```json
[Paste network response or console error stack trace here]
```
```
