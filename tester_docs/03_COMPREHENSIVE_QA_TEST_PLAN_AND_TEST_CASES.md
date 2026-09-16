# 🧪 03. Comprehensive QA Test Plan & Test Cases

> **Target Audience**: QA Engineers, Automation Testers, Manual Test Leads.  
> **Goal**: Execute comprehensive functional, security, integration, and edge-case verification across all Prism modules.

---

## 📊 Test Suite Summary

| Suite ID | Feature Area | Total Tests | Focus |
| :--- | :--- | :---: | :--- |
| **TS-AUTH** | Authentication, OAuth & Sessions | 8 | Microsoft OAuth, Zoho OAuth, cookie handling, session restore |
| **TS-CONN** | Connector Hub & Permission-Honesty | 8 | Entitlement checks, connect/disconnect, pause toggles, multi-DC |
| **TS-COPILOT** | Copilot Chat & AI Orchestration | 8 | Streaming chat, thinking stepper, tool execution, session history |
| **TS-SAFETY** | Human-in-the-Loop Write Governance | 6 | Write interception, ApprovalModal, diff preview, audit logging |
| **TS-CAMP** | Campaigns Studio & Multi-System Push | 8 | Wizard CRUD, AI generation, push to Zoho Deal/Project/Invoice |
| **TS-TENANT** | Multi-Tenancy & RBAC Isolation | 6 | Cross-tenant data leaks, RLS enforcement, role restrictions |
| **TS-TOKEN** | Token Vault & Background Refresh | 4 | AES-256-GCM encryption, expiry detection, auto-refresh |
| **TS-UI** | Responsive UI & Accessibility | 4 | Navigation shell, mobile drawer, keyboard hotkeys (⌘K) |

---

## 📋 Detailed Test Case Specifications

### Suite 1: Authentication & OAuth (TS-AUTH)

#### `TC-AUTH-01`: Microsoft OAuth Connect Flow (Personal / Non-Admin)
- **Severity**: Critical | **Type**: Functional
- **Preconditions**: User has a valid personal Microsoft account (`@outlook.com` or `@hotmail.com`).
- **Steps**:
  1. Navigate to `http://localhost:3000`.
  2. Click **Connections** in the sidebar.
  3. Click **Connect** on the Microsoft Outlook card.
  4. Authorize requested minimal scopes (`User.Read`, `Mail.Read`, `Files.Read`).
  5. Wait for redirect to `/api/integrations/microsoft/callback`.
- **Expected Result**:
  - Redirect returns user to Prism Connections view.
  - Microsoft Outlook card updates to "Connected" (Green badge).
  - HttpOnly cookies (`ms_access_token`, `ms_user_email`) set securely.
  - No error modal displayed.

#### `TC-AUTH-02`: Zoho Multi-Tenant OAuth Connect Flow
- **Severity**: Critical | **Type**: Functional
- **Preconditions**: User has a free or paid Zoho account in `.in` or `.com` datacenter.
- **Steps**:
  1. Navigate to **Connections** view.
  2. Select the matching datacenter dropdown (e.g., `in` or `com`).
  3. Click **Connect** on the Zoho CRM card.
  4. Log in and accept requested scopes.
  5. Wait for redirect to `/api/integrations/zoho/callback`.
- **Expected Result**:
  - Encrypted tokens saved to `user_integrations` table in Supabase.
  - Zoho CRM, Zoho Projects, and Zoho Books cards reflect connected status.
  - Active Org ID discovered and bound to user context.

#### `TC-AUTH-03`: Invalid / Cancelled OAuth Consent
- **Severity**: Major | **Type**: Negative
- **Steps**:
  1. Click **Connect** on Microsoft or Zoho card.
  2. On external provider consent screen, click **Cancel** or **Deny**.
- **Expected Result**:
  - User redirected back to Prism with `?error=access_denied`.
  - An inline, dismissible error banner appears: "Authorization was cancelled or denied."
  - Application does not crash or display blank page.

#### `TC-AUTH-04`: Logout & Session Invalidation
- **Severity**: Major | **Type**: Security
- **Steps**:
  1. With active session, click User Profile → **Log Out**.
  2. Attempt to navigate back via browser back button.
- **Expected Result**:
  - Session cookies cleared.
  - User redirected to login screen or guest state; protected API calls return `401 Unauthorized`.

---

### Suite 2: Connector Hub & Permission-Honesty (TS-CONN)

#### `TC-CONN-01`: Permission-Honesty: Non-Admin CRM Gating ("No CRM Access" Fix)
- **Severity**: Blocker | **Type**: Regression / UX
- **Preconditions**: User signed in with a standard account that has no Dynamics 365 license.
- **Steps**:
  1. Navigate to **Connections** view.
  2. Locate the **Microsoft Dynamics 365** card.
- **Expected Result**:
  - The card displays a locked indicator or status *"Not Entitled"*.
  - Clicking the card displays `NoAccessModal` with friendly guidance on requesting enterprise access.
  - **CRITICAL**: The application DOES NOT display a fatal red error, broken JSON, or generic 500 error.

#### `TC-CONN-02`: Pause & Resume Connector State
- **Severity**: Major | **Type**: Functional
- **Steps**:
  1. On an active connector (e.g., `Outlook Mail`), toggle the switch to **Pause**.
  2. Refresh the browser.
  3. Open Copilot chat and ask: *"Summarize my last 3 emails"*.
- **Expected Result**:
  - Step 1: Card badge changes to yellow `Paused`. Home status card reflects the paused connector.
  - Step 2: Pause state persists across page reload (loaded from server `connector_preferences`).
  - Step 3: Copilot informs the user: *"The Outlook connector is currently paused. Please resume it in Connections to access your emails."*

#### `TC-CONN-03`: Disconnect Integration
- **Severity**: Major | **Type**: Functional
- **Steps**:
  1. On a connected card, click **Disconnect**.
  2. Confirm disconnect in confirmation dialog.
- **Expected Result**:
  - Stored tokens for that provider are invalidated/removed from database.
  - Card reverts to "Not Connected" (Gray badge).
  - Subsequent Copilot queries do not attempt to call the disconnected service.

#### `TC-CONN-04`: Batch Health Check ("Test All Connections")
- **Severity**: Minor | **Type**: Functional
- **Steps**:
  1. Click **"Test All Connections"** at the top right of Connections view.
- **Expected Result**:
  - Spinning indicator activates.
  - System executes health probe across all 7 connectors.
  - Toast/banner notifies: "Health check complete. 5 of 7 services healthy."

---

### Suite 3: Copilot Chat & AI Orchestration (TS-COPILOT)

#### `TC-COPILOT-01`: Unified Copilot Streaming Response & Thinking Stepper
- **Severity**: Critical | **Type**: Functional
- **Preconditions**: `N8N_WEBHOOK_URL` is configured and n8n workflow `01_prism_copilot` is active.
- **Steps**:
  1. Navigate to **Copilot** view.
  2. Send message: *"What is Prism and how does it help my workflow?"*
- **Expected Result**:
  - Typing indicator appears immediately.
  - Thinking process accordion renders live steps.
  - Tokens stream into the chat window smoothly without layout jumping.
  - Complete response renders markdown correctly (lists, bold text).

#### `TC-COPILOT-02`: Multi-Source Query & Source Badging
- **Severity**: Critical | **Type**: Functional
- **Preconditions**: Outlook and Zoho CRM connected.
- **Steps**:
  1. Prompt Copilot: *"Check if I have any emails from John and if John has an open deal in CRM."*
- **Expected Result**:
  - Copilot executes both `msOutlookService` and `zohoCrmService`.
  - Response integrates both data points.
  - Message footer displays source badges: `[Microsoft Outlook]` and `[Zoho CRM]`.

#### `TC-COPILOT-03`: Vector Knowledge Base Fallback Query
- **Severity**: Major | **Type**: Functional
- **Steps**:
  1. Ask a question regarding internal SOPs (e.g., *"What is our campaign refund policy?"*).
- **Expected Result**:
  - Copilot calls `knowledgeBaseService` tool.
  - Vector similarity search runs in Supabase `public.documents`.
  - Response cites the matching SOP document with citation link.

#### `TC-COPILOT-04`: Chat Session Persistence & Isolation
- **Severity**: Major | **Type**: Functional
- **Steps**:
  1. Ask 2 questions in Session A.
  2. Click **"+ New Chat"** in the chat header.
  3. Send a question in Session B.
  4. Switch back to Session A in the session drawer.
- **Expected Result**:
  - Session A history is fully restored.
  - No cross-contamination of conversation context between Session A and B.

---

### Suite 4: Safety, Write Governance & Approval Modal (TS-SAFETY)

#### `TC-SAFETY-01`: Interception of Mutating Writes (Zero Silent Writes)
- **Severity**: Blocker | **Type**: Security
- **Steps**:
  1. In Copilot chat or Campaigns view, initiate an action that creates a CRM Deal or sends an email.
- **Expected Result**:
  - **MANDATORY**: An external API call MUST NOT be dispatched immediately.
  - The UI triggers `ApprovalModal.tsx`.
  - The modal blocks all other page interactions until user explicitly accepts or cancels.

#### `TC-SAFETY-02`: ApprovalModal Diff Review & Inspection
- **Severity**: Critical | **Type**: Functional
- **Steps**:
  1. When `ApprovalModal` opens, inspect the displayed payload.
- **Expected Result**:
  - Displays target service name (e.g., `Zoho CRM - Create Deal`).
  - Displays key parameters: Deal Name, Amount, Stage, Closing Date.
  - Explains impact clearly.

#### `TC-SAFETY-03`: Action Rejection Flow
- **Severity**: Major | **Type**: Functional
- **Steps**:
  1. Inside `ApprovalModal`, click **"Cancel / Reject"**.
- **Expected Result**:
  - Modal closes immediately.
  - Zero HTTP requests sent to external vendor APIs.
  - Chat stream or campaign notifies: *"Action cancelled by user."*
  - An audit log is written to `agent_audit_logs` with status `rejected`.

#### `TC-SAFETY-04`: Action Approval & Audit Trail Verification
- **Severity**: Critical | **Type**: Security / Functional
- **Steps**:
  1. Inside `ApprovalModal`, click **"Approve & Dispatch"**.
- **Expected Result**:
  - Mutation request executes against Zoho or Microsoft API.
  - Success confirmation displayed to user.
  - Verify database: A new row in `agent_audit_logs` exists containing:
    - `user_id`, `organization_id`
    - `action_type` (e.g., `zoho_crm_deal_create`)
    - `payload_snapshot`
    - `status: "approved"`
    - `executed_at: timestamp`

---

### Suite 5: Campaigns Studio & Multi-System Push (TS-CAMP)

#### `TC-CAMP-01`: Create Campaign Draft via Wizard
- **Severity**: Critical | **Type**: Functional
- **Steps**:
  1. Navigate to **Campaigns** view.
  2. Click **"+ New Campaign"**.
  3. Enter Name: `Q3 Partner Drive`, Client: `Acme Corp`, Budget: `50000`, Brief: `Test brief`.
  4. Click **"Save Draft"**.
- **Expected Result**:
  - New row appears in Campaigns table with status pill `Draft`.
  - Data persisted in Supabase `public.campaigns`.

#### `TC-CAMP-02`: AI Campaign Plan Generation
- **Severity**: Major | **Type**: Functional
- **Steps**:
  1. Click on the draft campaign.
  2. Click **"Generate Plan with Copilot"**.
- **Expected Result**:
  - Working plan drawer opens.
  - Generates recommended timeline, code allocation, reward mechanics, and risks.
  - Allows editing individual plan sections before approval.

#### `TC-CAMP-03`: Multi-System Push (Zoho CRM + Projects + Books)
- **Severity**: Critical | **Type**: Integration
- **Steps**:
  1. On an approved campaign, click **"Push to Zoho Suite"**.
  2. Review approval modal and click **"Approve"**.
- **Expected Result**:
  - System initiates 3 synchronous or sequential calls:
    1. Zoho CRM: Deal created.
    2. Zoho Projects: Project created with initial tasks.
    3. Zoho Books: Draft invoice created for campaign budget.
  - Campaign table updates with live external IDs (`deal_id`, `project_id`, `invoice_id`).

---

### Suite 6: Multi-Tenant Data Isolation & RBAC (TS-TENANT)

#### `TC-TENANT-01`: Cross-Tenant Data Isolation (RLS Verification)
- **Severity**: Blocker | **Type**: Security
- **Preconditions**: Organization A (`Org-Alpha`) and Organization B (`Org-Beta`) exist.
- **Steps**:
  1. User A in `Org-Alpha` creates a campaign named `Secret Alpha Launch`.
  2. Log out and log in as User B in `Org-Beta`.
  3. Navigate to **Campaigns** view.
- **Expected Result**:
  - `Secret Alpha Launch` MUST NOT be visible in User B's campaigns table.
  - Direct API query `/api/campaigns` returns only `Org-Beta` campaigns.
  - Any direct attempt to GET `/api/campaigns/<alpha_id>` returns `404 Not Found` or `403 Forbidden`.

#### `TC-TENANT-02`: Role-Based Access Control (Viewer Role Restrictions)
- **Severity**: Critical | **Type**: Security
- **Preconditions**: User C has role `Viewer` in `Org-Alpha`.
- **Steps**:
  1. Log in as User C.
  2. Attempt to create a campaign (+ New Campaign button).
  3. Attempt to disconnect a connector in Connections view.
- **Expected Result**:
  - Mutating buttons are hidden or disabled with a tooltip: *"Requires Admin or Member role"*.
  - If triggered via direct API POST, server responds with `403 Forbidden: Insufficient permissions`.

---

### Suite 7: Token Vault & Background Refresh (TS-TOKEN)

#### `TC-TOKEN-01`: Token Vault AES-256-GCM Verification
- **Severity**: Critical | **Type**: Security
- **Steps**:
  1. Connect Zoho or Microsoft account.
  2. Query database directly: `SELECT credentials_encrypted FROM user_integrations;`.
- **Expected Result**:
  - The stored value is an encrypted string containing IV, cipher text, and auth tag (e.g., `hex:hex:hex`).
  - **CRITICAL**: Plaintext refresh tokens or client secrets are NEVER stored unencrypted.

#### `TC-TOKEN-02`: Background Refresh Daemon Trigger
- **Severity**: Major | **Type**: Functional
- **Steps**:
  1. Set an active Zoho token's `expires_at` column in the database to 5 minutes from now.
  2. Trigger the refresh endpoint: `POST /api/integrations/refresh-tokens` with header `x-refresh-secret`.
- **Expected Result**:
  - Endpoint returns `{ refreshedCount: 1, errors: [] }`.
  - Database `expires_at` timestamp advances by 3600 seconds (1 hour).
  - User connection remains active in UI without requiring manual re-auth.

---

### Suite 8: UI/UX, Responsiveness & Hotkeys (TS-UI)

#### `TC-UI-01`: Command Palette / Focus Hotkey (`⌘K` / `Ctrl+K`)
- **Severity**: Minor | **Type**: UI/UX
- **Steps**:
  1. On any view, press `⌘K` (macOS) or `Ctrl+K` (Windows/Linux).
- **Expected Result**:
  - Focus smoothly transfers to the Copilot chat input box.
  - Input box highlights with active glow ring.

#### `TC-UI-02`: Mobile Viewport Navigation
- **Severity**: Minor | **Type**: UI/UX
- **Steps**:
  1. Resize browser viewport to 375px width (iPhone dimensions).
- **Expected Result**:
  - Desktop sidebar collapses into a hamburger icon.
  - Tapping hamburger opens slide-over drawer with full 8-view navigation.
  - Modals and drawers fit screen width without horizontal scrollbars.
