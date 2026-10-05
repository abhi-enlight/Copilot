# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** mid-market operations leaders — the COO, head of operations, or chief of staff at a 50-500 person company. They sit above the work rather than inside it: they run the weekly operating rhythm, chase commitments across teams, and own the reporting that goes upward.

**Their situation:** the company's work is spread across suites that do not talk to each other — Microsoft 365 (Outlook, Teams, SharePoint, Dynamics 365) alongside Zoho (CRM, Books), Google (Gmail, Calendar) and dev/ops tools (Slack, Linear, GitHub). No single vendor's copilot can see all of it.

**Their job:** start the day knowing what actually needs them, get a straight answer about where things stand, and have routine follow-ups drafted or executed without spending the morning switching between nine applications.

## Product Purpose

Prism is an operations copilot with two halves that reinforce each other: a proactive **morning briefing** that assembles what matters from every connected system, and an **agent** that can read across those systems, draft responses, and execute changes once a human approves them.

Success looks like an operations leader opening Prism instead of opening nine tabs, and finishing the daily triage in minutes rather than the first hour of the day.

## Positioning

**Lead with the morning briefing.** The confirmed public positioning is a briefing-first product surface: Prism proactively assembles the day (priorities, meetings, at-risk work, pending approvals) and chat is the action layer beneath it, not the front door.

**The mechanism nobody else can copy cheaply:** Prism spans Microsoft, Zoho, Google and dev tools in one runtime, and it is **approval-first** — the agent stages every state-changing action as a reviewable proposal, and nothing executes without explicit sign-off. Single-suite copilots (Microsoft 365 Copilot, Gemini for Workspace) cannot match the breadth; search-first tools (Glean) and builder tools (Zapier, Lindy) do not offer an executive cockpit with this approval model.

## Operating Context

- The daily ritual is a **morning briefing**: what happened overnight, what needs a decision, what is at risk, and which staged actions are waiting.
- Connected systems are authenticated per user through OAuth; each user's tool access is isolated from every other user's.
- Work is cross-suite by default: pulling a CRM record, reading the email thread about it, and drafting the follow-up are one request, not three.
- Approvals are a real workflow, not a modal: proposals carry an owner, a risk level, a 24-hour expiry, and an auditable outcome.
- Reports and commitments are the currency: figures pulled from connected systems must be traceable to their source record.
- The product runs as a web application (Next.js + Supabase + Composio).

## Capabilities and Constraints

**Confirmed capabilities**

- Streaming agent over Server-Sent Events with multi-turn tool calling across 12 toolkits: Outlook, Teams, Slack, Linear, Zoho CRM, GitHub, Gmail, Google Calendar, Notion, Dynamics 365, SharePoint, Zoho Books.
- Two-tier action model: read-only calls run inline; every state-changing call becomes a signed, reviewable proposal. The classifier is fail-closed — an unrecognized tool requires approval.
- Action ledger recording what was proposed, who approved it, and what executed.
- Live telemetry radar fed by provider webhooks, with "Ask Prism" investigation of an event.
- Multi-tenant data model with row-level security per organization; per-user tool isolation.

**Constraints**

- Tool access is limited to the connected toolkits; Prism does not invent access to systems the user has not connected.
- Bulk destructive operations, credential exfiltration, money movement, mass outreach and employee surveillance are refused deterministically.
- The agent must never claim a result it did not observe. When a lookup returns no data, it says so.

**Undecided (do not invent)**

- Pricing, packaging and plan tiers.
- Public launch date and release channel.
- Whether an organization admin console (policies, seat management, audit export) ships at launch.
- Whether the in-product surface is reorganized so the briefing becomes the home screen (the product direction above is confirmed; the implementation is not).
- Which surfaces beyond web ship first (Slack/Teams bot, mobile push).

## Brand Commitments

- Product name: **Prism**. Owner/builder: **Enlight Lab**.
- Existing identity asset: the Prism triangular prism logo mark, and the "Operations Platform" descriptor.
- Terminology direction: plain operational language in user-facing copy ("Inbox", "Approvals", "Activity"). Internal jargon currently in the interface ("Intelligence Stream", "Telemetry Radar", "Hardware Input") is scheduled to be retired.
- No visual, typographic or color commitments were made binding by the user; the incumbent visual system is recorded separately in DESIGN.md.

## Evidence on Hand

- Locked MVP scope and acceptance criteria: [docs/05-mvp-roadmap-and-gitops/MVP_SPECIFICATION_LOCKED.md](docs/05-mvp-roadmap-and-gitops/MVP_SPECIFICATION_LOCKED.md).
- System, data and integration specifications: [docs/01-architecture/](docs/01-architecture/), [docs/03-live-stack-telemetry/](docs/03-live-stack-telemetry/), [docs/04-agent-engine/](docs/04-agent-engine/).
- The product code itself is the primary demonstration: the cockpit, approval cards and radar in `frontend/src`.

**Explicit absences — do not fabricate:** there are no customers, testimonials, case studies, press mentions, benchmark numbers or customer logos available for public use. A public surface must earn trust through the product and its mechanism, not through social proof.

## Product Principles

1. **Nothing changes without sign-off.** The approval boundary is the product's core promise; breadth is worthless if a user cannot trust what runs unattended.
2. **Brief before you ask.** Prism should arrive with the day already assembled rather than waiting to be interrogated.
3. **Every claim traces to a source.** Figures and status come from a connected record, and the user can see which one.
4. **Plain language over internal vocabulary.** The interface speaks the way an operations leader already thinks.
5. **Honest over reassuring.** A missing answer is reported as missing; fabricated status destroys the entire value proposition.
