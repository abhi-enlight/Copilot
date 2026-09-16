# 🔷 Prism Copilot — QA Tester Onboarding & Documentation Index

> **Welcome to the Prism QA & Testing Kit.** This documentation package is specifically prepared for QA engineers, software testers, and technical evaluators to rapidly understand, navigate, and test the **Prism Operations Copilot** platform.

---

## 🧭 Document Navigation Map

| Document | Purpose & Content | Recommended Audience |
| :--- | :--- | :--- |
| **[00_TESTER_QUICK_START_AND_INDEX.md](./00_TESTER_QUICK_START_AND_INDEX.md)** *(This file)* | Quick start, 5-minute smoke test checklist, high-level map. | All Testers |
| **[01_PROJECT_OVERVIEW_AND_ARCHITECTURE.md](./01_PROJECT_OVERVIEW_AND_ARCHITECTURE.md)** | System architecture, tech stack, data flow, security model, and connector design. | Manual & Automation QA, Tech Leads |
| **[02_FEATURE_CATALOG_AND_USER_JOURNEYS.md](./02_FEATURE_CATALOG_AND_USER_JOURNEYS.md)** | Visual breakdown of all 8 views, UI controls, modaled approval gates, and user journeys. | Functional & UI/UX Testers |
| **[03_COMPREHENSIVE_QA_TEST_PLAN_AND_TEST_CASES.md](./03_COMPREHENSIVE_QA_TEST_PLAN_AND_TEST_CASES.md)** | 50+ structured test cases with Preconditions, Steps, Expected Results, and Pass/Fail criteria. | QA Engineers, Test Leads |
| **[04_TEST_ENVIRONMENT_AND_MOCK_DATA_GUIDE.md](./04_TEST_ENVIRONMENT_AND_MOCK_DATA_GUIDE.md)** | Local environment setup, environment variables, test personas, and Supabase mock data catalog. | QA Engineers, Devs |
| **[05_API_ENDPOINTS_AND_INTEGRATIONS_REFERENCE.md](./05_API_ENDPOINTS_AND_INTEGRATIONS_REFERENCE.md)** | API endpoint dictionary, n8n webhook catalog, sample cURL requests, and payload examples. | API & Integration Testers |
| **[06_KNOWN_ISSUES_EDGE_CASES_AND_DEBUGGING.md](./06_KNOWN_ISSUES_EDGE_CASES_AND_DEBUGGING.md)** | Known quirks, provider error codes (Dataverse, Microsoft Graph, Zoho), and troubleshooting steps. | All Testers, Support |

### 📚 Deep System & Architecture References (`system_specs/`)

For advanced technical verification, deep dive specifications are preserved in the `system_specs/` directory:
- **`system_specs/PRISM_PRODUCT_AND_MERGE_PLAN.md`**: The master blueprint uniting Operations Cockpit and BCP Assist.
- **`system_specs/PRODUCTION_ENV_AND_DEPLOYMENT_GUIDE.md`**: Complete production variables, Azure App Registration, and Zoho Console setup.
- **`system_specs/N8N_DEPLOYMENT_RUNBOOK.md`**: n8n workflow deployment, credential mapping, and verification commands.
- **`system_specs/MULTI_TENANT_ARCHITECTURE_AND_PLAN.md`**: Multi-tenant database schema, JWT headers, and RLS policies.
- **`system_specs/DEMO_DATA.md`**: Complete schema definitions for all 5 Supabase demo tables.
- **`system_specs/ARCHITECTURE.md`**: Core high-level system layers.

---

## ⚡ What is Prism in 60 Seconds?

**Prism** is an enterprise AI productivity copilot that unifies two major corporate ecosystems into a single conversation and command center:
1. **Microsoft 365**: Outlook Email & Calendar, SharePoint & OneDrive Files, and Dynamics 365 CRM.
2. **Zoho Suite**: Zoho CRM, Zoho Projects, and Zoho Books.

### The Problem Prism Solves
- **Fragmented Context**: Teams switch between 5+ browser tabs (email, files, CRM, project management, accounting) to complete a single task.
- **Permission Honesty**: Previous integrations assumed every user was an Azure/Dynamics admin, causing ugly "No CRM Access" crashes. Prism uses a **permission-honest connector model**: non-admin users get instant personal Outlook/OneDrive utility, while CRM/Tenant connectors are unlocked only when provider permissions genuinely permit it.
- **Safe AI Actions**: Rather than allowing an AI agent to write directly to external CRMs or send emails autonomously, Prism enforces **Human-in-the-Loop Write Governance** via an explicit approval modal with live diffs recorded in audit logs.

---

## ⏱️ 5-Minute Smoke Test Checklist

If you have just launched the development environment, execute these 5 smoke tests to verify the build is healthy:

```
[ ] 1. App Shell Load:
       Navigate to http://localhost:3000.
       Verify the 8-view sidebar renders (Home, Copilot, Inbox, Documents, Campaigns, Connections, Users & Roles, Settings).
       Verify no unhandled JavaScript errors in the browser console.

[ ] 2. Connections View Health:
       Click "Connections" in the sidebar.
       Verify the 7 connector cards render:
       - Microsoft Outlook Mail
       - SharePoint & OneDrive
       - Dynamics 365 CRM
       - Zoho CRM
       - Zoho Projects
       - Zoho Books
       - Internal Knowledge Base
       Verify status badges ("Connected", "Not Connected", or "Needs Reconnection").

[ ] 3. Copilot Chat Initialization:
       Click "Copilot" in the sidebar.
       Type "Hello, what systems are connected?" and send.
       Verify the streaming response displays thinking states and source tags.

[ ] 4. Campaign Studio Wizard:
       Click "Campaigns" in the sidebar.
       Click "+ New Campaign" to open the creation drawer.
       Verify fields (Campaign Name, Client, Reward Type, Budget, Brief) accept input without error.

[ ] 5. Multi-Tenant Role Inspection:
       Click "Users & Roles".
       Verify the active organization name and current user role badge (Owner / Admin / Member / Viewer) appear.
```

---

## 🛠️ Quick System Reference

- **Frontend Port**: `http://localhost:3000`
- **Secondary Telemetry Cockpit**: `http://localhost:3000/cockpit`
- **Database**: Supabase PostgreSQL with pgvector extension & Row-Level Security (RLS)
- **Execution Engine**: n8n workflow automation backend
- **AI Model**: Google Gemini (orchestrated via n8n & LangChain tools)
- **Token Vault Encryption**: AES-256-GCM

Proceed to **[01_PROJECT_OVERVIEW_AND_ARCHITECTURE.md](./01_PROJECT_OVERVIEW_AND_ARCHITECTURE.md)** for deep architectural understanding.
