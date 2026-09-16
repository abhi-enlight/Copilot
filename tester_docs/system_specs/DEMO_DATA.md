# 📊 Metabase Demo Dataset Reference

This document lists all the test tables and mock data created in your Supabase `public` schema for Metabase testing.

---

## 🗂️ Summary of Added Tables

| Table Name | Total Rows | Description & Key Dimensions |
| :--- | :---: | :--- |
| **`demo_customers`** | **150** | Customer profiles with acquisition channels, countries, cities, and subscription tiers. |
| **`demo_products`** | **15** | Product catalog across 5 categories with prices, costs, stock levels, and ratings. |
| **`demo_orders`** | **500** | Order transactions over the past 10 months with payment methods, statuses, and totals. |
| **`demo_order_items`** | **500** | Line items linking orders to specific products with quantities and calculated subtotals. |
| **`demo_traffic`** | **4,050** | 90 days of daily web traffic metrics split by channel, device category, country, and signups. |

---

## 🔗 Entity Relationship Diagram

```
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│         demo_customers          │           │          demo_products          │
│─────────────────────────────────│           │─────────────────────────────────│
│ PK id (UUID)                    │           │ PK id (UUID)                    │
│    first_name (TEXT)            │           │    title (TEXT)                 │
│    last_name (TEXT)             │           │    category (TEXT)              │
│    email (TEXT, Unique)         │           │    unit_price (NUMERIC)         │
│    country (TEXT)               │           │    unit_cost (NUMERIC)          │
│    city (TEXT)                  │           │    stock_quantity (INTEGER)     │
│    plan_tier (TEXT)             │           │    rating (NUMERIC)             │
│    acquisition_channel (TEXT)   │           │    created_at (TIMESTAMPTZ)     │
│    created_at (TIMESTAMPTZ)     │           └────────────────┬────────────────┘
└────────────────┬────────────────┘                            │
                 │ 1:N                                         │ 1:N
                 ▼                                             ▼
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│           demo_orders           │ 1:N       │        demo_order_items         │
│─────────────────────────────────│──────────►│─────────────────────────────────│
│ PK id (UUID)                    │           │ PK id (UUID)                    │
│ FK customer_id (UUID)           │           │ FK order_id (UUID)              │
│    order_number (TEXT, Unique)  │           │ FK product_id (UUID)            │
│    status (TEXT)                │           │    quantity (INTEGER)           │
│    payment_method (TEXT)        │           │    unit_price (NUMERIC)         │
│    subtotal (NUMERIC)           │           │    total_price (NUMERIC)        │
│    discount_amount (NUMERIC)    │           └─────────────────────────────────┘
│    tax_amount (NUMERIC)         │
│    total_amount (NUMERIC)       │
│    created_at (TIMESTAMPTZ)     │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│          demo_traffic           │
│─────────────────────────────────│
│ PK id (UUID)                    │
│    report_date (DATE)           │
│    channel (TEXT)               │
│    device_category (TEXT)       │
│    country (TEXT)               │
│    pageviews (INTEGER)          │
│    sessions (INTEGER)           │
│    unique_visitors (INTEGER)    │
│    signups (INTEGER)            │
│    bounce_rate (NUMERIC)        │
└─────────────────────────────────┘
```

---

## 📋 Table Details & Schema

### 1. `demo_customers` (150 rows)
* **`id`** *(UUID, Primary Key)*
* **`first_name`** *(TEXT)*
* **`last_name`** *(TEXT)*
* **`email`** *(TEXT, Unique)*
* **`country`** *(TEXT)*: `United States`, `United Kingdom`, `Germany`, `Canada`, `India`, `France`, `Japan`, `Australia`, `Singapore`, `Netherlands`
* **`city`** *(TEXT)*: `San Francisco`, `London`, `Berlin`, `Toronto`, `Bengaluru`, `Paris`, `Tokyo`, `Sydney`, `New York`, `Austin`, etc.
* **`plan_tier`** *(TEXT)*: `Starter`, `Professional`, `Enterprise`
* **`acquisition_channel`** *(TEXT)*: `Organic Search`, `Google Ads`, `LinkedIn`, `Referral`, `Direct`, `Twitter/X`
* **`lifetime_value`** *(NUMERIC)*
* **`created_at`** *(TIMESTAMPTZ)*: Spread across the past 365 days

---

### 2. `demo_products` (15 rows)
* **`id`** *(UUID, Primary Key)*
* **`title`** *(TEXT)*: e.g., *Pro Noise-Cancelling Headphones*, *Team Collaboration Suite*, *Cloud Security Shield Pro*
* **`category`** *(TEXT)*: `Electronics`, `SaaS Tools`, `Apparel`, `Accessories`, `Cloud Services`
* **`unit_price`** *(NUMERIC)*: Price range `$34.99` to `$1,200.00`
* **`unit_cost`** *(NUMERIC)*: Cost of goods sold (COGS)
* **`stock_quantity`** *(INTEGER)*
* **`rating`** *(NUMERIC)*: `4.3` to `4.9`
* **`created_at`** *(TIMESTAMPTZ)*

---

### 3. `demo_orders` (500 rows)
* **`id`** *(UUID, Primary Key)*
* **`customer_id`** *(UUID, Foreign Key $\rightarrow$ `demo_customers.id`)*
* **`order_number`** *(TEXT, Unique)*: Format `ORD-2026-XXXXX`
* **`status`** *(TEXT)*: `completed`, `processing`, `refunded`, `cancelled`
* **`payment_method`** *(TEXT)*: `Credit Card`, `Stripe`, `PayPal`, `Apple Pay`, `Bank Wire`
* **`subtotal`** *(NUMERIC)*
* **`discount_amount`** *(NUMERIC)*
* **`tax_amount`** *(NUMERIC)*
* **`total_amount`** *(NUMERIC)*
* **`created_at`** *(TIMESTAMPTZ)*: Spread across the past 300 days

---

### 4. `demo_order_items` (500 rows)
* **`id`** *(UUID, Primary Key)*
* **`order_id`** *(UUID, Foreign Key $\rightarrow$ `demo_orders.id`)*
* **`product_id`** *(UUID, Foreign Key $\rightarrow$ `demo_products.id`)*
* **`quantity`** *(INTEGER)*: 1 to 3 units per item
* **`unit_price`** *(NUMERIC)*: Matches product pricing
* **`total_price`** *(NUMERIC)*: `quantity * unit_price`

---

### 5. `demo_traffic` (4,050 rows)
* **`id`** *(UUID, Primary Key)*
* **`report_date`** *(DATE)*: Daily data for the past 90 days
* **`channel`** *(TEXT)*: `Organic Search`, `Paid Ads`, `Direct`, `Social Media`, `Email`
* **`device_category`** *(TEXT)*: `Desktop`, `Mobile`, `Tablet`
* **`country`** *(TEXT)*: `United States`, `United Kingdom`, `Germany`, `India`, `Japan`
* **`pageviews`** *(INTEGER)*: 500 to 5,000 per entry
* **`sessions`** *(INTEGER)*: 300 to 2,800 per entry
* **`unique_visitors`** *(INTEGER)*: 250 to 2,250 per entry
* **`signups`** *(INTEGER)*: 10 to 100 per entry
* **`bounce_rate`** *(NUMERIC)*: `28.5%` to `58.5%`
