# 🧭 Client Experience & Interaction Flows: The Prism AI Employee Interface

> **Document Status**: LOCKED FOR MVP
> **Brand Sovereignty**: **100% PRISM TO CLIENTS**. Zero third-party names (Composio) are visible anywhere. The brand is strictly **Prism**, **Prism Copilot**, and **Prism Connect**.
> **Target UX**: Fluid, zero-friction, executive command center.
> **Key Principle**: Think from the client side. No technical jargon. No raw JSON. Everything is actionable, visual, and reassuring.

---

## 1. The 3-Panel Asymmetric Command Center

Instead of a generic centered chat bubble layout, Prism V2 features a purpose-built **3-Panel Executive Command Center**:

```
+----------------------------------------------------------------------------------------------------+
| ⚡ PRISM COCKPIT HUD   [Org: Acme Corp ▾]    [● Radar: LIVE]    [⚡ 6 Tools Active]    [User Avatar] |
+-----------------------+-----------------------------------------------+----------------------------+
| 📁 PERSISTENT RADAR   | 🧠 PRISM INTELLIGENCE STREAM                  | 📡 LIVE STACK RADAR         |
|                       |                                               |                            |
| • Today's Briefing    | [Executive Morning Briefing]                  | [Teams] #ops-channel       |
| • Q3 Marketing Deck   | "Good morning Abhinav. Here are 3 things       | "Shipment delayed for #482"|
| • Client Risk Triage  | that require your attention today..."         | 10m ago • [Investigate]    |
|                       |                                               |                            |
| ───────────────────── | [Action Card: Draft Reply to VP Sales]        | [Outlook] urgent unread    |
| PRISM CONNECT (6)     | To: sarah@client.com                          | "Contract approval needed" |
| 🟢 Teams    🟢 Outlook| Subject: Re: Q3 Deployment Milestone          | 22m ago • [Draft Reply]    |
| 🟢 Slack    🟢 GitHub | [Preview Body ▾]                              |                            |
| 🟢 Zoho     ⚪ Notion |                                               | [CRM] Lead Re-engagement   |
| [+ Connect More Tools]| [ ✕ Reject ]         [ ✔ Approve & Send ↗ ]   | "Nordica Corp moved to Q4" |
|                       |                                               | 1h ago • [Review]          |
|                       | ───────────────────────────────────────────── |                            |
|                       | [⌨️ Ask Prism to triage inbox or draft work...       ] [⚡] [Send]          |
+-----------------------+-----------------------------------------------+----------------------------+
```

---

## 2. Core User Journeys

### Flow A: The Morning Executive Briefing (Proactive)

1. **Login**: User signs in via Supabase Magic Link or SSO into the **Prism Cockpit**.
2. **Context Awakening**: Prism doesn't wait for a prompt. It evaluates the latest events from the user's connected tools (Teams, Outlook, Slack, CRM) via the **Live Stack Radar**.
3. **Executive Summary Card**: Renders a crisp briefing card:
   - 🔴 **2 Urgent Blockers** (e.g., an escalation email from a VIP client).
   - 🟡 **3 Approvals Pending** (e.g., a drafted reply ready for sign-off).
   - 🟢 **Daily Operational Snapshot** (e.g., 4 closed CRM deals, 1 open PR).
4. **Instant Action**: The user can click any action button on the card (e.g., `Review & Send Reply`) without typing a single prompt.

---

### Flow B: 1-Click "Prism Connect" Experience (Zero Third-Party Leaks)

1. User clicks **`+ Connect Tools`** in the left sidebar or receives an inline prompt from Prism.
2. The **Prism Connector Drawer** slides out from the right with a smooth spring transition.
3. User sees categorized cards with clear status pills (Teams, Outlook, Slack, Linear, CRM).
4. Clicking **`Connect Teams`**:
   - Calls `POST /api/integrations/connect { app: "microsoft-teams" }`.
   - Opens a secure authorization window displaying the **Prism Logo** and styled in the Obsidian dark theme.
   - Provider consent screen explicitly states: *"Authorize Prism to access Microsoft Teams"*.
   - The **user** closes the window after consenting (no forced auto-close).
5. The Teams card transitions to a **`⏳ Finishing…`** pending pill. Every 3 s, the drawer polls `GET /api/integrations/status?app=microsoft-teams` (capped at 60 s):
   - **Confirmed** → card flips to a radiant emerald badge: `● Connected to Prism`.
   - **Timeout** → card settles into `⚪ Not Connected` with a **Retry** affordance.
   - **Failure / revoked consent** → amber `⚠ Action Needed` pill opening the reconnect banner: *"Prism lost connection to Teams. Re-authorize Prism."*
6. Once confirmed, live telemetry starts streaming into the **Live Stack Radar** within seconds.

> **Why no instant flip**: the integration engine exposes no push broadcast on consent completion — connection confirmation is verified by polling `/api/integrations/status`. The 3 s cadence keeps perceived latency near-instant without a false promise.

---

### Flow C: Action Cards & Human-in-the-Loop Sign-Off

1. User types or clicks: *"Draft an email to client Sarah updating her on the delay"*.
2. Prism inspects context from Teams, drafts the email, and generates an **Interactive Action Card**:
   - Card displays: Recipient, Subject, Thread reference, and rich HTML body preview.
   - Status: `AWAITING CLIENT SIGN-OFF`.
   - Two buttons: `Edit Draft` and `Approve & Deliver via Prism ↗`.
3. If the user clicks **`Approve & Deliver via Prism ↗`**:
   - The button transitions into a haptic spinner.
   - Prism dispatches the message via the connected provider.
   - The card transitions to a locked state: `✔ Delivered to sarah@client.com at 16:32 PM via Prism`.
   - An immutable record is written to `agent_audit_logs`.

---

## 3. Micro-Interaction Polish

1. **⌘K Quick Palette**: Pressing `⌘K` anywhere opens a floating glass palette for jumping between briefs, toggling tools, or triggering instant triage commands.
2. **Ambient Pulse**: Connected tools in the HUD exhibit an ambient, slow breathing glow (`2.5s ease-in-out infinite`) indicating live telemetry connectivity.
3. **Sound & Haptics (Optional Subtle Tone)**: Action approvals trigger an ultra-subtle mechanical tick sound (configurable in user preferences).
