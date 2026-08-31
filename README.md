# ⚡ Operations Cockpit Copilot UI

Unified Enterprise Copilot Interface for real-time querying across **Microsoft Outlook**, **SharePoint / OneDrive**, **Dynamics 365 CRM**, and **PostgreSQL (Supabase)**.

---

## 🚀 Features

- **Multi-Source Telemetry HUD**: Live indicators and status telemetry for connected enterprise data sources.
- **Unified Chat Stream**: Powered by Google Gemini via n8n webhook orchestration.
- **Quick Action Triggers**: Instant one-click triggers for Outlook emails, SharePoint documents, and database records.
- **Dynamic Source Badging**: Auto-categorizes responses with visual source tags.
- **Hardware-Grade UI**: Double-bezel cockpit aesthetics with Framer Motion animations and ⌘K hotkey focus.

---

## 🛠️ Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env.local` file:
```env
NEXT_PUBLIC_N8N_WEBHOOK_URL=https://<YOUR_N8N_INSTANCE>/webhook/<WEBHOOK_ID>/chat
```

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
