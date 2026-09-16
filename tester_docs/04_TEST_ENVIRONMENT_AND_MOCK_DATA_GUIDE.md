# 💻 04. Test Environment & Mock Data Guide

> **Target Audience**: QA Engineers, Test Automation Developers, Manual Testers.  
> **Goal**: Rapidly spin up the local Prism test environment, configure test credentials, understand test personas, and utilize the Supabase mock database.

---

## 1. Local Environment Setup

### Prerequisites
- **Node.js**: v18.18+ or v20+
- **npm**: v9+ or v10+
- **Database**: Supabase account (or local Supabase Docker)
- **Web Browser**: Chrome, Edge, or Safari (modern Chromium recommended for DevTools testing)

### Step 1: Clone & Install Dependencies
From the repository root:
```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies cleanly
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

### Essential Environment Variables for Testing

```ini
# --- SUPABASE (Database, Auth & pgvector) ---
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# --- TOKEN VAULT ENCRYPTION (Must be 64 hex characters / 32 bytes) ---
INTEGRATION_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# --- MICROSOFT 365 & AZURE ENTRA ID ---
AZURE_CLIENT_ID=your-azure-app-client-id
NEXT_PUBLIC_AZURE_CLIENT_ID=your-azure-app-client-id
AZURE_CLIENT_SECRET=your-azure-client-secret
AZURE_TENANT_ID=common
AZURE_REDIRECT_URI=http://localhost:3000/api/integrations/microsoft/callback

# --- ZOHO OAUTH ---
ZOHO_CLIENT_ID=your-zoho-client-id
ZOHO_CLIENT_SECRET=your-zoho-client-secret
ZOHO_DATACENTER=in
ZOHO_REDIRECT_URI=http://localhost:3000/api/integrations/zoho/callback
ZOHO_ORG_SHARED=false

# --- N8N UNIFIED COPILOT ---
N8N_WEBHOOK_URL=https://<your-n8n-domain>/webhook/<webhook-id>/chat
NEXT_PUBLIC_N8N_WEBHOOK_URL=https://<your-n8n-domain>/webhook/<webhook-id>/chat
```

> [!TIP]
> **Generating an Encryption Key**:  
> Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` to generate a valid 64-character hex key.

### Step 3: Run the Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 2. Test Personas & Role Matrix

To thoroughly test permission-honesty, multi-tenancy, and RBAC, create and test these 4 personas:

| Persona Name | Role | Microsoft Entitlement | Zoho Entitlement | Expected System Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **1. Sarah Connor (Enterprise Owner)** | `owner` | Full M365 + Dynamics 365 License + Global Admin | Org Superadmin | Can manage all connectors, run admin consent, approve writes, view/edit all campaigns. |
| **2. Alex Chen (Standard Member)** | `member` | Personal Outlook / OneDrive (no Dynamics license) | Member in Zoho | Personal Outlook connects; Dynamics 365 displays "Not Entitled"; can draft campaigns. |
| **3. David Miller (Auditor / Viewer)** | `viewer` | Read-only access | Read-only | Can view Copilot and Campaigns; write buttons and connector toggles are disabled. |
| **4. Maya Patel (External / Guest)** | N/A | None (Personal Hotmail/Live) | None | Non-tenant mode; only personal connectors available; zero access to enterprise org data. |

---

## 3. Supabase Mock Dataset Reference

The project includes a populated mock dataset inside the Supabase `public` schema. These tables enable testing analytical queries, Copilot DB searches, and multi-record aggregations:

### Summary of Demo Tables

| Table Name | Record Count | Description | Useful Test Queries |
| :--- | :---: | :--- | :--- |
| **`demo_customers`** | **150** | Global customer base across US, UK, Germany, India, Japan with plan tiers (`Starter`, `Professional`, `Enterprise`). | *"Who are our top Enterprise customers in India?"* |
| **`demo_products`** | **15** | Product catalog across SaaS tools, Electronics, Cloud Services with unit costs, prices, stock, and ratings. | *"List our highest rated cloud service products."* |
| **`demo_orders`** | **500** | Transaction history across 10 months with payment methods, order statuses (`completed`, `processing`, `refunded`). | *"What was our total order volume last month?"* |
| **`demo_order_items`** | **500** | Line items linking orders to products with quantities and subtotal calculations. | *"Find all orders containing Enterprise SaaS licenses."* |
| **`demo_traffic`** | **4,050** | 90 days of daily website metrics (sessions, pageviews, signups, bounce rates by device and channel). | *"Compare bounce rates between organic search and paid ads."* |

---

## 4. Entity Relationship Diagram for Mock Data

```
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│         demo_customers          │           │          demo_products          │
│─────────────────────────────────│           │─────────────────────────────────│
│ PK id (UUID)                    │           │ PK id (UUID)                    │
│    first_name (TEXT)            │           │    title (TEXT)                 │
│    last_name (TEXT)             │           │    category (TEXT)              │
│    email (TEXT, Unique)         │           │    unit_price (NUMERIC)         │
│    country (TEXT)               │           │    stock_quantity (INTEGER)     │
│    plan_tier (TEXT)             │           │    rating (NUMERIC)             │
└────────────────┬────────────────┘           └────────────────┬────────────────┘
                 │ 1:N                                         │ 1:N
                 ▼                                             ▼
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│           demo_orders           │ 1:N       │        demo_order_items         │
│─────────────────────────────────│──────────►│─────────────────────────────────│
│ PK id (UUID)                    │           │ PK id (UUID)                    │
│ FK customer_id (UUID)           │           │ FK order_id (UUID)              │
│    order_number (TEXT, Unique)  │           │ FK product_id (UUID)            │
│    status (TEXT)                │           │    quantity (INTEGER)           │
│    total_amount (NUMERIC)       │           │    total_price (NUMERIC)        │
└─────────────────────────────────┘           └─────────────────────────────────┘
```

---

## 5. Test Data Reset & Seeding Commands

If mock data is modified or corrupted during destructive testing, re-run the seed script:

1. Open your **Supabase Dashboard** → **SQL Editor**.
2. Run the migration scripts from `database/migrations/` in sequence:
   - `01_multitenant_schema_and_rls.sql`
   - `02_app_roles_and_user_integrations.sql`
   - `03_token_expiry_tracking.sql`
   - `04_connector_pause_preferences.sql`
   - `05_supabase_auth_multiuser.sql`
   - `06_strict_organization_isolation.sql`
   - `07_harden_cross_tenant_and_schema_isolation.sql`
   - `08_sso_domain_registry.sql`
3. Load the demo data file: `docs/DEMO_DATA.md`.
