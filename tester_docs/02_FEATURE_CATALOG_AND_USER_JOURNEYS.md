# 📱 02. Feature Catalog & User Journeys

> **Target Audience**: Functional QA, Manual Testers, Product Managers, UI/UX Evaluators.  
> **Goal**: Complete catalog of all views, interactive elements, modal behaviors, and user workflows.

---

## 1. Application Layout & Navigation Shell

Prism features a persistent navigation shell with an 8-view sidebar:

```
┌──────────────┬──────────────────────────────────────────────────────────────┐
│  PRISM LOGO  │ Top Navigation / Status Header                               │
│              │ Active Org: [BigCity Retail ▼]   User: [Rohit Sharma (Admin)]│
├──────────────┼──────────────────────────────────────────────────────────────┤
│ WORKSPACE    │                                                              │
│  🏠 Home     │                                                              │
│  💬 Copilot  │                                                              │
│  📥 Inbox    │                      PRIMARY VIEWPORT                        │
│  📁 Documents│                                                              │
│              │                                                              │
│ OPERATIONS   │                                                              │
│  🎯 Campaigns│                                                              │
│  🔌 Connect  │                                                              │
│              │                                                              │
│ ADMIN        │                                                              │
│  👥 Users    │                                                              │
│  ⚙️ Settings │                                                              │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 2. Comprehensive View Catalog

### 1. 🏠 Home View (`view=home`)
- **Purpose**: Operational dashboard and daily starting point.
- **Key Elements**:
  - **Welcome Banner**: Displays personalized greeting, current date, and active organization badge.
  - **Telemetry & Connection Status Card**: Summarizes count of active connectors (e.g., "5 of 7 systems active") and shows pause badges if any connectors are paused.
  - **Quick Action Triggers**: Instant launcher buttons:
    - *"Triage unread emails"* → navigates to Inbox.
    - *"Create new campaign"* → navigates to Campaigns wizard.
    - *"Ask Copilot about deals"* → navigates to Copilot with prefilled prompt.
  - **Daily Risk Digest & Action Items**: Displays active risk nudges (e.g., overdue tasks, stagnant CRM deals, pending invoices).

### 2. 💬 Copilot View (`view=copilot`)
- **Purpose**: Unified AI chat copilot with multi-system intelligence stream.
- **Key Elements**:
  - **Chat Message Stream**: Renders formatted markdown, code snippets, tables, and source badges.
  - **Thinking Process Stepper**: Real-time accordion showing Gemini's reasoning steps ("Analyzing intent...", "Querying Outlook...", "Synthesizing response...").
  - **Source Badges**: Color-coded badges indicating which service supplied data (e.g., `[Outlook]`, `[SharePoint]`, `[Zoho CRM]`, `[Vector KB]`).
  - **Working Plan Studio Drawer**: Slide-out drawer on the right displaying structured campaign plans, code volume, timelines, and action items.
  - **Hardware Input Bar**: Fixed bottom input with hotkey support (`⌘K` / `Ctrl+K`), quick prompt suggestions, and send button.
  - **Chat Session Sidebar**: Historical chat sessions list with ability to start a new chat or delete sessions.

### 3. 📥 Inbox View (`view=inbox`)
- **Purpose**: Outlook email intelligence and triage interface.
- **Key Elements**:
  - Unread/Recent email list fetched via Microsoft Graph `/me/messages`.
  - Email preview pane with sender, timestamp, subject, and body snippet.
  - **AI Actions**: "Summarize Thread", "Draft Reply with Copilot", "Extract Action Items".

### 4. 📁 Documents View (`view=documents`)
- **Purpose**: SharePoint & OneDrive document browser and vector knowledge base.
- **Key Elements**:
  - File tree and list view displaying recent documents.
  - File metadata (Type, Size, Last Modified, Author).
  - Search input with semantic search capabilities.
  - Document summarization action buttons.

### 5. 🎯 Campaigns View (`view=campaigns`)
- **Purpose**: End-to-end campaign planning and execution studio.
- **Key Elements**:
  - **Campaigns Table**: Lists all campaigns with status pills (`Draft`, `In Review`, `Approved`, `Active`, `Completed`), client names, budgets, and creation dates.
  - **Campaign Wizard (+ New Campaign)**:
    - Campaign Name (Text input)
    - Client Name (Text input)
    - Reward Type (Dropdown: e.g., Cashback, Voucher, Physical Gift)
    - Total Budget (Currency numeric)
    - Target Code Volume (Numeric)
    - Campaign Brief (Multi-line textarea)
    - Brand Color Picker
  - **Zoho Sync Badges**: Displays linked Zoho Deal ID, Zoho Project ID, and Zoho Invoice ID.
  - **Action Controls**: "Generate Plan with AI", "Push to Zoho Suite", "Edit Details", "Delete".

### 6. 🔌 Connections View (`view=connections`)
- **Purpose**: Centralized integration hub managing OAuth connections, pause states, and health checks.
- **Key Elements**:
  - **7 Connector Cards**:
    1. Microsoft Outlook Mail
    2. Microsoft SharePoint & OneDrive
    3. Microsoft Dynamics 365 CRM
    4. Zoho CRM
    5. Zoho Projects
    6. Zoho Books
    7. Internal Knowledge Base
  - **Status Badges**:
    - `Active / Connected` (Green)
    - `Paused` (Yellow)
    - `Not Connected` (Gray)
    - `Reconnection Required` (Red)
    - `Permission Locked` (Lock icon)
  - **Card Controls**:
    - Connect / Disconnect button
    - Pause / Resume toggle
    - Health ping indicator
    - Zoho Data Center selector dropdown (`.in`, `.com`, `.eu`, `.com.au`)
  - **Top Action**: "Test All Connections" button to run batch health checks.

### 7. 👥 Users & Roles View (`view=users`)
- **Purpose**: Enterprise multi-user management and RBAC console.
- **Key Elements**:
  - **Active Organization Info**: Name, slug, domain, tenant type (`Personal` vs `Enterprise`).
  - **Members Table**: List of registered users, email addresses, and assigned roles.
  - **Role Dropdowns**: Change user role (`Owner`, `Admin`, `Member`, `Viewer`).
  - **Invite Member Button**: Modal to enter email and initial role.
  - **Role Matrix Reference Table**: Explains exact permissions for each role.

### 8. ⚙️ Settings View (`view=settings`)
- **Purpose**: Tenant and user profile configuration.
- **Key Elements**:
  - Profile details (Display Name, Email, Avatar).
  - Organization settings (Name, Timezone, Currency).
  - Notification and AI temperature preferences.

### 9. 🎛️ Operations Cockpit (`/cockpit`)
- **Purpose**: Dedicated dual-bezel high-density hardware telemetry UI for operations leads.
- **Key Elements**:
  - Endpoint telemetry cards with live ping latency.
  - Raw JSON inspection drawer.
  - Command palette launcher.

---

## 3. Key Modals & Human-in-the-Loop Dialogs

### A. ApprovalModal (`ApprovalModal.tsx`)
- **Trigger**: Fired whenever Copilot or Campaign Studio attempts a mutating write action (e.g., creating a Zoho CRM Deal, creating a Zoho Project, generating an invoice).
- **Contents**:
  - Warning banner: "Action requires human approval before dispatching to external systems."
  - Target system badge (e.g., `[Zoho CRM]`).
  - Proposed payload inspection table (Key-Value attributes).
  - Buttons: **"Approve & Dispatch"** (Primary) and **"Reject / Cancel"** (Secondary).

### B. NoAccessModal (`NoAccessModal.tsx`)
- **Trigger**: Fired when a user without CRM entitlement clicks on Dynamics 365 or Zoho CRM.
- **Contents**:
  - Clear explanation: "Your account is not entitled to access this CRM environment."
  - Actionable guidance: Instead of an unhandled crash, provides a button to request access from the tenant administrator or switch accounts.

### C. AdminApprovalModal (`AdminApprovalModal.tsx`)
- **Trigger**: Fired when tenant-wide Microsoft consent is required.
- **Contents**:
  - Generates the Azure Entra ID 1-click admin consent URL (`/adminconsent`).
  - Allows an Azure Global Admin to grant organization-wide permissions for Mail, Files, and CRM.

---

## 4. End-to-End User Journeys for Testing

### Journey 1: Personal User Onboarding & Email Intelligence
1. Tester navigates to `/` as a new user.
2. Goes to **Connections** view.
3. Clicks **"Connect"** on Microsoft Outlook card.
4. Completes standard Microsoft OAuth login with minimal scopes (`User.Read`, `Mail.Read`).
5. Returns to Prism; Outlook card changes to **Connected** (Green).
6. Navigates to **Copilot** view.
7. Prompts: *"What are the top 3 unread emails in my inbox?"*
8. **Verify**: Copilot displays thinking states, executes `msOutlookService`, and prints emails with the `[Outlook]` source badge.

### Journey 2: Campaign Generation to Multi-System Push
1. Tester navigates to **Campaigns** view.
2. Clicks **"+ New Campaign"**.
3. Inputs:
   - Name: `Winter Holiday Kickoff`
   - Client: `Global Retail Inc`
   - Reward: `Voucher $50`
   - Budget: `100000`
   - Volume: `2000`
   - Brief: `Provide instant cashback vouchers for holiday shoppers.`
4. Clicks **"Generate Plan with Copilot"**.
5. Working Plan Drawer slides out with AI-generated timeline and task breakdown.
6. Tester clicks **"Approve & Push to Zoho"**.
7. **ApprovalModal** opens showing the proposed Deal, Project, and Invoice payloads.
8. Tester clicks **"Approve & Dispatch"**.
9. **Verify**:
   - Status changes to `Approved / Active`.
   - Linked IDs appear (Deal ID, Project ID, Invoice ID).
   - Audit log entry created in database.

### Journey 3: Permission-Honesty Verification ("No CRM Access" Scenario)
1. Tester signs in with a personal account (e.g., `@outlook.com` or non-admin user).
2. Navigates to **Connections** view.
3. Observes Dynamics 365 card:
   - Card displays lock icon and status *"Not Entitled"*.
   - Toggle is disabled or clicking it opens `NoAccessModal`.
4. **Verify**: System DOES NOT crash, DOES NOT display a generic 500 error, and presents clear guidance on how to request an enterprise license.
