# 🔌 05. API Endpoints & Integrations Reference

> **Target Audience**: QA Automation Engineers, Backend Testers, Integration Specialists.  
> **Goal**: Complete dictionary of Next.js API routes, n8n webhook targets, and sample payloads for API-level test verification.

---

## 1. Next.js Internal API Endpoints

### 1.1 Chat & Intelligence Stream
- **Endpoint**: `POST /api/chat`
- **Description**: Streams the multi-agent AI response via Server-Sent Events (SSE). Proxies request directly to n8n.
- **Request Body**:
  ```json
  {
    "message": "List our top 3 deals in Zoho CRM closing this month",
    "sessionId": "sess_89a7f3",
    "connectors": {
      "microsoft.outlook": true,
      "zoho.crm": true,
      "internal.kb": true
    }
  }
  ```
- **Response**: `text/event-stream` with chunk events:
  ```
  data: {"event": "thinking", "step": "Executing tool zohoCrmService..."}
  data: {"event": "token", "delta": "Here are the top deals:"}
  data: {"event": "source", "source": "zoho.crm"}
  data: {"event": "done"}
  ```

---

### 1.2 Connector Preferences & Entitlements
- **Endpoint**: `GET /api/connectors/preferences`
  - **Description**: Fetches user's active/paused connector toggle state.
  - **Response**:
    ```json
    {
      "preferences": {
        "microsoft.outlook": true,
        "microsoft.sharepoint": true,
        "microsoft.dynamics": false,
        "zoho.crm": true,
        "zoho.projects": true,
        "zoho.books": true,
        "internal.kb": true
      }
    }
    ```
- **Endpoint**: `POST /api/connectors/preferences`
  - **Description**: Updates pause/resume toggle for a specific connector.
  - **Request Body**:
    ```json
    { "connectorId": "microsoft.outlook", "enabled": false }
    ```

- **Endpoint**: `GET /api/connectors/entitlements`
  - **Description**: Runs live entitlement probe across all services to determine if user is licensed/entitled.
  - **Response**:
    ```json
    {
      "microsoft.dynamics": {
        "access": "locked",
        "reason": "no_dynamics_license",
        "viaRoleOverride": false
      },
      "zoho.crm": {
        "access": "granted",
        "reason": "active_user_token",
        "viaRoleOverride": false
      }
    }
    ```

---

### 1.3 Campaigns & Multi-Service Push
- **Endpoint**: `GET /api/campaigns`
  - **Description**: Fetches all campaigns for the active organization.
- **Endpoint**: `POST /api/campaigns`
  - **Description**: Creates a new draft campaign.
  - **Request Body**:
    ```json
    {
      "name": "Acme Summer Cashback",
      "client": "Acme Corp",
      "reward_type": "Cashback",
      "budget": 25000,
      "code_volume": 500,
      "brief": "Instant cashback vouchers on purchases over $100."
    }
    ```
- **Endpoint**: `POST /api/campaigns/approve_and_push_zoho`
  - **Description**: Human-approved write endpoint. Creates linked Zoho CRM Deal, Zoho Project, and Zoho Books Invoice.
  - **Request Body**:
    ```json
    {
      "campaignId": "c874-4b51-9310-fa89a32",
      "approvalNotes": "Approved by marketing lead."
    }
    ```
  - **Response**:
    ```json
    {
      "success": true,
      "zoho": {
        "dealId": "4892019000042819",
        "projectId": "72910293010",
        "invoiceId": "INV-2026-0041"
      }
    }
    ```

---

### 1.4 Integrations & Background Token Refresh
- **Endpoint**: `POST /api/integrations/refresh-tokens`
  - **Description**: Background daemon route. Scans tokens expiring within 10 minutes and performs refresh.
  - **Headers**: `x-refresh-secret: <TOKEN_REFRESH_SECRET>`
  - **Response**:
    ```json
    {
      "refreshedCount": 1,
      "failedCount": 0,
      "details": [{ "provider": "zoho", "userEmail": "rohit@example.com", "status": "refreshed" }]
    }
    ```

- **Endpoint**: `POST /api/integrations/microsoft/disconnect`
  - **Description**: Removes Microsoft session cookies and invalidates tenant connection.

- **Endpoint**: `POST /api/integrations/zoho/disconnect`
  - **Description**: Removes encrypted Zoho tokens from `user_integrations` table.

---

## 2. n8n Workflows & Sub-Service Catalog

All automation and vendor logic is maintained in `workflows/` using the `@n8n/workflow-sdk`:

| Workflow File | Database ID / Trigger | Purpose | Input Payload |
| :--- | :--- | :--- | :--- |
| `01_prism_copilot.ts` | `/webhook/.../chat` | Main orchestrator with Gemini agent & sub-workflow tools. | `{ message: string, sessionId: string }` |
| `02_intent_router.ts` | `/webhook/prism-intent` | Fast intent classifier (CHAT vs WRITE vs QUERY). | `{ message: string }` |
| `09_admin_consent_helper.ts` | `/webhook/prism-admin-consent` | Generates 1-click Azure Entra ID consent URL. | `{ clientId: string, tenantId: string }` |
| `10_ms_outlook_service.ts` | `executeWorkflow` | Microsoft Graph Mail retrieval & search. | `{ connectorEnabled: boolean, limit: number }` |
| `11_ms_sharepoint_service.ts`| `executeWorkflow` | SharePoint & OneDrive document inspection. | `{ connectorEnabled: boolean, query: string }` |
| `12_ms_dynamics_crm_service.ts`| `executeWorkflow` | Microsoft Dataverse CRM Accounts & Leads query. | `{ connectorEnabled: boolean, scope: string }` |
| `13_zoho_crm_service.ts` | `executeWorkflow` | Zoho CRM Deals, Accounts, and Contacts fetch. | `{ connectorEnabled: boolean, scope: string }` |
| `14_zoho_projects_service.ts`| `executeWorkflow` | Zoho Projects task lists and milestones fetch. | `{ connectorEnabled: boolean, scope: string }` |
| `15_zoho_books_service.ts` | `executeWorkflow` | Zoho Books invoices, payments, and dunning status. | `{ connectorEnabled: boolean, scope: string }` |
| `16_knowledge_base_service.ts`| `executeWorkflow` | Supabase pgvector cosine similarity search. | `{ query: string, matchCount: number }` |

---

## 3. Sample cURL Test Commands

### 1. Test Connector Health Probe (Status)
```bash
curl -X GET http://localhost:3000/api/connectors/preferences \
  -H "Content-Type: application/json"
```

### 2. Test Triggering Background Token Refresh
```bash
curl -X POST http://localhost:3000/api/integrations/refresh-tokens \
  -H "x-refresh-secret: your_refresh_secret_here"
```

### 3. Test n8n Service Refusal Path (Workflow 13 - Zoho CRM)
To test how an n8n workflow behaves when disabled:
```bash
# Execute sub-workflow with disabled connector flag
# Expected output: { refused: true, reason: "connector_disabled" }
curl -X POST https://<your-n8n-domain>/webhook/test-service-13 \
  -H "Content-Type: application/json" \
  -d '{"connectorEnabled": false, "entitlement": true}'
```
