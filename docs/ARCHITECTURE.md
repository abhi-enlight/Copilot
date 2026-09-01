# Enterprise Multi-Tenant Architecture & System Blueprint

## Overview
Operations Copilot is an enterprise-grade AI Operations Cockpit built with Next.js 16 (App Router & Proxy Architecture), Supabase Multi-Schema Isolation, Microsoft Entra ID (Azure AD), and n8n LangChain Orchestration.

---

## 1. Project Directory Structure
```
Meta Base/
├── database/                                # Centralized Database & SQL Migrations
│   └── migrations/
│       └── 01_multitenant_schema_and_rls.sql
│
├── docs/                                    # System Architecture & Documentation
│   ├── ARCHITECTURE.md
│   └── DEMO_DATA.md
│
└── frontend/                                # Next.js 16 Web Application
    ├── src/
    │   ├── app/                             # Next.js 16 App Router
    │   │   ├── api/                         # API Routes (Auth, Integrations, Health)
    │   │   │   ├── auth/logout/route.ts
    │   │   │   ├── integrations/microsoft/
    │   │   │   │   ├── connect/route.ts
    │   │   │   │   └── callback/route.ts
    │   │   │   └── tenant/health/route.ts
    │   │   ├── globals.css
    │   │   ├── layout.tsx
    │   │   └── page.tsx                     # Top-level coordinator
    │   │
    │   ├── components/                      # Modular Components
    │   │   ├── cockpit/
    │   │   │   ├── CockpitHeader.tsx
    │   │   │   ├── TelemetrySidebar.tsx
    │   │   │   ├── IntelligenceStream.tsx
    │   │   │   ├── HardwareInputBar.tsx
    │   │   │   └── LoginView.tsx
    │   │   ├── modals/
    │   │   │   ├── AdminConsentModal.tsx
    │   │   │   └── IntegrationsModal.tsx
    │   │   └── ui/
    │   │       ├── AmbientBackground.tsx
    │   │       └── SourceBadge.tsx
    │   │
    │   ├── hooks/                           # Custom React Hooks
    │   │   ├── useCopilotChat.ts
    │   │   └── useTenantContext.ts
    │   │
    │   ├── lib/                             # Shared Utilities & API Client
    │   │   ├── api-client.ts
    │   │   ├── constants.ts
    │   │   └── utils.ts
    │   │
    │   ├── types/                           # TypeScript Definitions
    │   │   ├── chat.ts
    │   │   ├── tenant.ts
    │   │   └── index.ts
    │   │
    │   └── proxy.ts                         # Next.js 16 Host & Subdomain Proxy
```

---

## 2. Multi-Tenant Layers
1. **Routing Layer**: `src/proxy.ts` dynamically intercepts host subdomains (`<tenant>.yourapp.com`) and passes `x-tenant-slug` headers.
2. **Data Layer**: Supabase `operations_copilot` schema with Row Level Security (RLS) and zero cross-schema access to `"BCP"`.
3. **AI Agent Layer**: n8n LangChain Memory Buffer isolates conversation memory using scoped `sessionId: "session-${tenantSlug}-1"`.
4. **Identity & OAuth**: Microsoft Entra ID universal `/common` multi-tenant endpoint with 1-click `/adminconsent` scope resolution.
