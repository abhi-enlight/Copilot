# Prism Client Demo Playbook & Testing Credentials

## 1. Demo Login Credentials

Use these credentials to access the live test environment:

- **Login URL:** `/auth/login` (or `http://localhost:3000/auth/login`)
- **Email:** `testing123@xyz.com`
- **Password:** `Testing123`
- **Redirects to:** `/cockpit` (Prism Command Cockpit)

---

## 2. Tool Connectivity & Environment Status

Prism is architected to orchestrate across **16 core enterprise tools**. In this demo account, here is the exact breakdown:

### Connected & Ready for Live Prompts (11 Tools)
1. **Google Gmail** — Corporate inbox search, thread context retrieval, and email drafting.
2. **Google Calendar** — Executive schedule, meeting conflicts, and team availability.
3. **Slack** — Internal channel monitoring, broadcast announcements, and message drafting.
4. **Linear** — Engineering backlog, active sprint cycles, blockers, and ticket creation.
5. **Atlassian Jira** — Issue and bug tracking, sprint project backlogs, component triage, and ticket resolution.
6. **Monday.com** — Visual work execution, board pulses, cross-team roadmap columns, and status updates.
7. **Zoho CRM** — Pipeline deals, account stages, revenue figures, and contact records.
8. **Zoho Books** — Invoices, billing status, overdue receivables, and expense records.
9. **Zoho Projects** — Portals, project roadmaps, task hierarchies, milestones, and bug tracking. (Native direct REST integration via Zoho OAuth 2.0 with AES-256-GCM vault security).
10. **GitHub** — Repositories, open pull requests, stale branches, and code review status.
11. **Notion** — Workspace knowledge base, operating runbooks, and meeting notes.

### Native Work Management (Ready for 1-Click Connection)
- **ClickUp** — Hierarchical task structures, space/list management, and coordinated deliverables. Fully wired into Prism's engine; can be authorized with 1 click directly in the **Connect Hub** (`/integrations`).

### Microsoft Stack Status (4 Tools)
- **Microsoft Outlook**
- **Microsoft Teams**
- **Microsoft Dynamics 365**
- **Microsoft SharePoint**

> **Note for the Client:** The Microsoft suite has not been connected on this test seat because connecting to an enterprise Microsoft 365 tenant requires Azure AD admin consent, which I do not have access to on my development account. During an onboarding or pilot evaluation, their IT admin can connect their own Microsoft 365 account with 1 click directly in the **Connect Hub** (`/integrations`).

---

## 3. High-Impact Demo Prompts

Here are 9 tested prompts tailored for clients. Each highlights a different capability: cross-tool data merging, proactive morning briefings, and human-in-the-loop action proposals.

---

### Prompt 1: The Executive Morning Briefing
**Goal:** Show how Prism eliminates tab switching by pulling across calendar, inbox, and sprint tracking in one shot.

```text
Give me a full operational briefing for today. Check my upcoming calendar meetings, summarize urgent unread emails, and highlight any blocking tickets in Linear.
```

**What to point out on screen:**
- **Inline Tool Thinking:** Watch the tool indicators pulse as Prism queries Google Calendar, Gmail, and Linear sequentially.
- **Synthesized Executive Output:** Prism doesn't just dump raw text; it formats the morning schedule, flags high-priority threads, and surfaces sprint blockers in a unified view.
- **Client Talking Point:** *"Instead of opening four browser tabs first thing in the morning, operations leaders get a clear picture of their day in five seconds."*

---

### Prompt 2: Issue Triage & Blocker Escalation (Jira + Slack)
**Goal:** Show how engineering leadership and product operations triage high-severity Jira tickets without context switching, with human-in-the-loop sign-off before posting alerts.

```text
Inspect our active Jira project for unresolved high-priority bugs or blockers. Extract the ticket keys, summaries, and assigned engineers, and draft an urgent triage alert for our #eng-lead Slack channel requesting an ETA.
```

**What to point out on screen:**
- **Autonomous Reading:** Prism queries Jira issues, extracts keys (e.g. `PROJ-102`), priority levels, and assignees.
- **Action Proposal Card:** Prism does **not** spam Slack silently. Instead, an interactive **Action Card** renders directly in the stream showing the target channel (`#eng-lead`), the exact message draft, and two buttons: `[Approve & Execute]` and `[Reject]`.
- **Sign-off Execution:** Click **Approve**. Prism executes the action and logs it into an auditable ledger.
- **Client Talking Point:** *"Prism connects issue trackers to team chat instantly. It prepares the message with all necessary ticket details, but guarantees you maintain final control before anything gets posted."*

---

### Prompt 3: Visual Roadmap & Operations Pulse Sync (Monday.com + Gmail / Slack)
**Goal:** Demonstrate cross-team roadmap pulse tracking and executive follow-up using Monday.com.

```text
Inspect our project boards in monday.com to find any items currently flagged as 'Stuck' or with upcoming deadlines this week. Summarize the affected boards and prepare an action card proposing a status update message.
```

**What to point out on screen:**
- **Board Pulse Inspection:** Prism reads columns, status values, and board items from Monday.com.
- **Risk Identification:** Automatically flags stalled items or overdue milestones.
- **Action Card Gate:** Stages a suggested update or notification for team review before publishing.
- **Client Talking Point:** *"Marketing and project teams live in Monday.com while engineering lives in Jira or Linear. Prism acts as the connective tissue across both."*

---

### Prompt 4: Multi-Platform Project & Sprint Cross-Check (Jira + Monday.com + Linear)
**Goal:** Demonstrate cross-silo project orchestration across fragmented departments (e.g., engineering on Jira/Linear, product/operations on Monday).

```text
Compare our active sprint priorities across Jira, Linear, and Monday.com. Identify any unassigned high-priority work items or cross-team misalignments that need executive attention today.
```

**What to point out on screen:**
- **Multi-Platform Synthesis:** Simultaneously queries multiple project management engines and reconciles priorities.
- **Single Source of Truth:** Surfaces disconnects without requiring manual cross-checking between multiple SaaS tools.
- **Client Talking Point:** *"No enterprise uses just one project tool. Prism bridges Jira, Linear, and Monday.com into a single unified operating picture."*

---

### Prompt 5: Cross-Tool Query & Action Proposal (Linear + Slack)
**Goal:** Demonstrate cross-tool chaining and prove that Prism **never** modifies or posts anything without human sign-off.

```text
Check Linear for high-priority blocking bugs in our active sprint. Find out who is assigned, and draft a Slack alert for #eng-lead to request an ETA on the fix.
```

**What to point out on screen:**
- **Autonomous Reading:** Prism reads Linear issues and extracts the assignees automatically.
- **Action Proposal Card:** Prism renders the proposed message directly in the stream.
- **Client Talking Point:** *"Prism is autonomous, but never unsupervised. Read actions are instant, but state-modifying actions always require your explicit approval."*

---

### Prompt 6: Revenue & Finance Cross-Check (Zoho CRM + Zoho Books)
**Goal:** Show how Prism connects sales pipeline data with accounting to catch operational disconnects.

```text
Review high-value pipeline deals closing this month in Zoho CRM, and check Zoho Books to see if those accounts have any outstanding or overdue invoices. Flag any accounts at risk.
```

**What to point out on screen:**
- **Cross-Platform Synthesis:** Prism matches account names between the CRM deal pipeline and accounting records.
- **Business Insight:** It flags if a prospect buying an expansion has an unpaid invoice from last quarter before the sales team signs them.
- **Client Talking Point:** *"Your CRM and your accounting software rarely speak to each other. Prism bridges that gap without needing complex Zapier or custom integration work."*

---

### Prompt 7: Engineering & Product Status Report (GitHub + Notion)
**Goal:** Demonstrate technical workflow orchestration for engineering and operations managers.

```text
Find any open GitHub pull requests that have been waiting for review for more than 48 hours, cross-reference our release guidelines in Notion, and suggest what needs to be unblocked before the next release.
```

**What to point out on screen:**
- **Code & Knowledge Synthesis:** Pulls open PR metadata from GitHub and compares it with release runbook steps stored in Notion.
- **Client Talking Point:** *"Prism isn't just a communication assistant. It has deep visibility into dev tools and project knowledge bases."*

---

### Prompt 8: Client Communication & Follow-up (Gmail + Zoho CRM)
**Goal:** Show context-aware customer communication.

```text
Check Zoho CRM for our latest interactions with our top active deal, look for recent email correspondence in Gmail, and draft a personalized follow-up email confirming our next steps.
```

**What to point out on screen:**
- Prism reads the contact history from Zoho CRM and the last email exchange in Gmail.
- An **Action Proposal Card** appears containing the recipient's email, subject line, and proposed body.
- You can review or edit the text directly before approving.

---

### Prompt 9: Project Milestones & Task Creation (Zoho Projects + Slack)
**Goal:** Showcase native Zoho Projects roadmap tracking and task creation with human sign-off.

```text
Inspect our active projects in Zoho Projects for any overdue milestones or high-priority tasks. Summarize the deliverable status and propose creating a follow-up task titled 'Executive Roadmap Review' assigned to the team.
```

**What to point out on screen:**
- **Native REST Query:** Prism accesses Zoho Projects via OAuth 2.0 with AES-256-GCM token encryption, retrieving portals, projects, and task lists without third-party vendor middleware.
- **Action Proposal Card:** When proposing to create the task, Prism generates a structured **Action Card** specifying the project, task name, and priority, waiting for your one-click approval before saving to Zoho Projects.
- **Client Talking Point:** *"Prism orchestrates deep project hierarchies directly in Zoho Projects, ensuring your roadmap and task backlog are always up to date without manual data entry."*

---

## 4. Suggested Demo Flow (10-15 Minutes)

### Step 1: Sign In & The Command Cockpit (2 mins)
1. Navigate to `/auth/login` and sign in with `testing123@xyz.com` / `Testing123`.
2. Introduce the **Prism Cockpit**:
   - Clean, hardware-grade interface designed specifically for executive and operations triage.
   - Show the 3-panel layout: Left navigation rail, Center intelligence stream, Right live telemetry radar.
   - Point out the **Tools Connected** indicator in the top header (reflecting connected tools out of 16).

### Step 2: Show the Connect Hub (2 mins)
1. Click the tool counter badge in the header or go to `/integrations`.
2. Show the **16 Enterprise Toolkits**:
   - Highlight the **11 connected tools** (Gmail, Google Calendar, Slack, Linear, Jira, Monday.com, Zoho CRM, Zoho Books, Zoho Projects, GitHub, Notion).
   - Point out **ClickUp** as native and ready to connect with 1 click.
   - Address the Microsoft stack (Outlook, Teams, Dynamics 365, SharePoint):
     *"These four are fully integrated into Prism's engine. On this shared demo seat, we don't have global admin rights to our enterprise Microsoft tenant, so we haven't connected them here. In your own deployment, an IT administrator can connect your Microsoft 365 tenant in one click without any custom API or OAuth configuration."*

### Step 3: Run the Morning Briefing (3 mins)
1. Return to `/cockpit`.
2. Paste or click **Prompt 1** (Morning Briefing).
3. Let the client watch the real-time streaming response and inline tool thinking indicators.
4. Point out how Prism structures the summary with clear sections, source attributions, and urgency tags.

### Step 4: Show the Action Proposal Card & Approval Gate (4 mins)
1. Run **Prompt 2** (Jira blocker + Slack alert) or **Prompt 5** (Linear + Slack).
2. When the **Action Card** renders, pause the demo:
   - Point out that Prism staged the action rather than firing it blindly.
   - Show the exact details: target channel, draft message, risk level, and timestamp.
   - Click **Approve & Execute** to demonstrate the completion state.
   - Explain that every approved action is saved to an immutable audit ledger.

### Step 5: Live Stack Telemetry Radar (2 mins)
1. Expand the right-hand **Live Stack Radar** panel.
2. Show the incoming telemetry feed (webhooks and alerts from connected systems).
3. Click **Investigate** on any radar event:
   - Show how Prism automatically populates a contextual prompt into the input bar to triage the incident.
