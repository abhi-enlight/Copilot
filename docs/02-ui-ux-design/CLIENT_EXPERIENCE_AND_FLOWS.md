# 🧭 Client Experience & Interaction Flows: The Prism AI Employee Interface

> **Document Status**: LOCKED FOR MVP
> **Brand Sovereignty**: **100% PRISM TO CLIENTS**. Zero third-party names (Composio) are visible anywhere.
> **Target UX**: Fluid, zero-friction, executive command center.
> **Key Principle**: Think from the client side. No technical jargon. No raw JSON. Everything is actionable, visual, and reassuring.

---

## 1. The 3-Panel Asymmetric Command Center

```text
+-------------------+---------------------------------------+-------------------+
|                   |                                       |                   |
|  [Logo] Prism     |  Active Orchestration (Center)        |  Context &        |
|                   |                                       |  Action Panel     |
|  Connections      |  [Thinking Indicator...]              |                   |
|  - Active (5)     |  [Slack] • [Jira] • [GitHub] (pulsing)|  - Suggested      |
|                   |                                       |    Actions        |
|  Recents          |  User: "Status of Q3 Launch"          |  - Deep Links     |
|  - Morning Brief  |                                       |  - Metadata       |
|  - Weekly Report  |  Prism: (Synthesizing context...)     |                   |
|                   |  > 3 Stalled Tickets Found            |                   |
|  Settings         |  > 2 PRs Pending Review               |                   |
|                   |                                       |                   |
+-------------------+---------------------------------------+-------------------+
```

## 2. Inline Thinking & Orchestration UX

When Prism operates across multiple tools, the UI must provide clear, reassuring visibility into the agent's reasoning without overwhelming the user with raw data.

- **Animated Tool Badges**: As Prism queries tools (e.g., Salesforce, Gmail, Jira), the respective tool icons pulse softly in the header or inline with the chat, indicating active data retrieval.
- **Progressive Disclosure of Thought**: Display inline thinking states like "Checking Jira for open tickets...", followed by "Cross-referencing with GitHub PRs...", and concluding with "Found 3 stalled tickets with no linked PR."
- **Multi-Step Flow Visualization**: Users see a clear visual flow, reassuring them that complex, multi-step work is being handled in the background, transforming a single prompt into a comprehensive workflow.
- **Polished State Transitions**: Smooth animations and proper loading states between agent actions ensure the experience feels like a premium, cohesive assistant rather than a stitched-together toolchain.

## 3. Core User Journeys

### Flow A: Morning Executive Briefing
**The Trigger:** User logs in at 9:00 AM or says, "Give me my morning briefing."
**The Orchestration:** Prism pulls from MULTIPLE tools simultaneously (Teams, Outlook, CRM, GitHub) and synthesizes the data.
**The UX:** 
- Instead of a bulleted list of isolated tool outputs, Prism presents a unified narrative that connects the dots across platforms.
- **Example Output:** "Your morning looks clear until 11 AM. However, regarding the **Q3 Launch**, there are 3 stalled Jira tickets AND 2 related GitHub PRs awaiting review from your team. In your CRM, the Acme Corp renewal needs an email follow-up today."
- Tool badges used in the synthesis glow subtly next to the insights to reinforce where the data originated.

### Flow B: 1-Click Connect
**The Goal:** Frictionless onboarding of new tools.
**The UX:**
- User clicks "Connect Google Workspace."
- A sleek Prism-branded OAuth modal appears (zero mention of backend orchestration platforms).
- Upon success, a subtle confetti animation or green pulse confirms the connection, and the tool immediately appears in the "Active Connections" list.

### Flow C: Action Cards (Multi-Tool Chained)
**The Trigger:** User says, "Follow up with all clients who haven't responded to the Q3 pricing update."
**The Orchestration:**
- Prism queries the CRM for clients tagged with "Q3 pricing update" and "no response."
- Prism drafts customized emails based on recent CRM notes and past Gmail threads.
**The UX:**
- Prism shows its thinking: *"Querying CRM for unresponded clients..."* → *"Drafting 14 personalized emails..."*
- **Action Card Batch:** Prism presents a neat stack of 14 Action Cards. Each card previews the email draft with unified action buttons: `[Approve All]` `[Review Individually]` `[Edit Draft]`.

### Flow D: Cross-Tool Orchestration Workflow
**The Trigger:** User requests, "Give me a progress update on the new authentication module."
**The Orchestration & UX Flow:**
1. **Initiation**: User prompt appears. Prism displays a pulsing thinking bubble indicating the start of a multi-step workflow.
2. **Tool Activation (Jira)**: The Jira icon lights up. Inline text: *"Checking Jira for epics related to authentication..."*
3. **Tool Activation (GitHub)**: The GitHub icon lights up simultaneously. Inline text: *"Cross-referencing active PRs and commits..."*
4. **Synthesis**: Icons return to resting state. Prism displays a cohesive summary:
   - "The Auth Module is 80% complete. There is one critical blocker: **Ticket AUTH-102** is waiting on a PR review in GitHub."
5. **Proactive Action Generation**: An Action Card appears below the summary: `[Ping PR Reviewer on Slack]` `[View PR]`.
**The Result**: The user did not have to prompt the agent to check Jira, then check GitHub, then ask to message the reviewer. One request triggered a full, logical workflow with complete transparency and premium polish.

## 4. Micro-Interaction Polish
- **Haptic Feedback (Mobile/Trackpad)**: Subtle bumps on task completion.
- **Typography Transitions**: Numbers counting up or text fading in elegantly during data loading.
- **Context Preservation**: Scrolling back through the feed maintains the state of completed Action Cards (e.g., showing a green checkmark on approved emails).
- **Error Grace**: If a tool connection fails, Prism doesn't crash or throw a raw error. It gracefully says, "I couldn't reach Jira right now. Would you like me to proceed with just the GitHub updates?"
