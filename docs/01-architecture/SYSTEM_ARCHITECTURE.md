# 🏛️ System Architecture: Prism Copilot V2 (The AI Employee Platform)

> **Document Status**: LOCKED FOR MVP  
> **Target Aesthetic & Model**: Viktor-grade AI Employee Platform ([viktor.com](https://viktor.com/))  
> **Core Philosophy**: *"Not a chat tool, but an intelligent personal assistant capable of cross-tool orchestration. Connected tools work WITH EACH OTHER as the agent chains multiple actions seamlessly, operating autonomously step-by-step to achieve multi-step goals without requiring constant user prompting."*

---

## 1. Executive Summary & Paradigm Shift

The legacy architecture operated as an n8n webhook proxy with custom-built OAuth connectors for individual vendors (Zoho, Azure Graph). This introduced three fatal bottlenecks:
1. **Connector Scalability Barrier**: Building vendor OAuth, token encryption, and API wrappers manually took 1–3 weeks per integration.
2. **Execution Latency & Fragility**: Next.js proxied prompts to an n8n webhook through ngrok/tunnels, and used brittle regex parsing on n8n logs (`Calling tools:...`) to extract SSE events.
3. **Passive Chatbot UX**: The interface was a standard reactive chat window instead of a proactive operations cockpit that monitors communication across Teams, Outlook, and Slack.

**Prism V2 completely re-architects the system around three modern pillars**:
1. **Cross-Tool Orchestration Intelligence**: The intelligence layer (LLM orchestration) empowers tools to work TOGETHER. By interpreting a single user prompt (e.g., "mail all clients to follow up"), the agent autonomously searches CRM data, drafts messages, and executes emails across multiple integrated tools step-by-step. Visible inline thinking systems guarantee a smooth user experience.
2. **Composio Platform SDK (Connection Infrastructure)**: Universal multi-user integration infrastructure powering the tool connections. Over 3,200+ enterprise tools are instantly accessible, providing the raw capabilities the intelligent orchestration layer needs, with zero custom OAuth boilerplate.
3. **Live Stack Radar & Telemetry**: Composio Webhook Triggers push real-time events into Supabase, which live-streams them to an ambient cockpit HUD, allowing the personal assistant to constantly react and orchestrate based on real-world updates.

---

## 2. High-Level System Blueprint

```mermaid
flowchart TD
    subgraph Client [Prism Cockpit HUD (Next.js)]
        User[User Input] --> ChatUI[Proactive Chat & Ambient Radar]
        ChatUI --> Streaming[SSE Streaming / Inline Thinking]
    end

    subgraph Prism_Core [Cross-Tool Orchestration Engine]
        LLM[Agent Intelligence Layer]
        Planner[Multi-Step Autonomous Planner]
        Memory[Supabase Vector & Conversational Memory]

        ChatUI --> |User Prompt| LLM
        LLM <--> Planner
        Planner <--> Memory
        LLM --> |Thinking & Streaming| Streaming
    end

    subgraph Tooling [Composio Integration Layer]
        CompSDK[Composio SDK]
        GitHub[GitHub Tool]
        Jira[Jira Tool]
        CRM[CRM Tool]
        Email[Email Tool]

        Planner --> |1. Call Tool A| CompSDK
        Planner --> |2. Call Tool B| CompSDK
        Planner --> |3. Synthesize Results| LLM

        CompSDK <--> GitHub
        CompSDK <--> Jira
        CompSDK <--> CRM
        CompSDK <--> Email
    end

    subgraph Examples [Multi-Tool Orchestration Workflows]
        Ex1[Synthesis: Cross-references data across tools for Unified Reports]
        Ex2[Batch Action: Extracts lists & autonomously stages multi-step operations]
    end

    LLM -.-> Examples
```

---

## 3. Technology Stack & Role Matrix

| Component | Technology | Architectural Role (Cross-Tool Orchestration) |
| :--- | :--- | :--- |
| **Agent Intelligence** | Next.js Serverless Edge / LangChain | **Primary Differentiator.** Serves as the brain of the platform. Plans and chains multiple tool calls autonomously across different services from a single user instruction. |
| **Tool Connections** | Composio Platform SDK | The infrastructure layer that provides normalized API connections to 3,200+ tools, enabling the agent to execute actions seamlessly without OAuth boilerplate. |
| **Database & Memory** | Supabase (PostgreSQL + pgvector) | Stores user states, agent memory, and live telemetry to provide context for long-running, multi-step workflows. |
| **Frontend Cockpit** | Next.js, React, Tailwind, Framer Motion | Displays the agent's visible inline thinking systems and multi-step progress, transforming a chat interface into a transparent orchestration monitor. |
| **Live Telemetry** | Webhooks & Realtime Subscriptions | Feeds live events into the agent's context, allowing it to proactively suggest cross-tool actions when external systems change. |

---

## 4. The Decision on n8n (Formal Architectural Verdict)

The decision to migrate away from n8n is final. While n8n excels at rigid, pre-defined automation rules, it fails to support dynamic agentic workflows where the LLM decides the tool execution order on the fly. 

By replacing the brittle proxy and ngrok tunnels with direct serverless execution and Composio’s managed auth, the new architecture significantly reduces execution latency, drastically improves reliability, and enables the true step-by-step autonomy required for an AI employee.

---

## 5. Security & Boundary Guardrails

Prism V2 operates securely by isolating tenant data and strictly enforcing execution boundaries.
- **Managed OAuth & Token Security**: All OAuth flows and token refreshing are securely managed by Composio. Prism never stores raw access tokens in its own database.
- **Human-in-the-Loop (HITL) Execution**: The system implements explicit confirmation boundaries. The agent can read data and propose multi-step actions (e.g., drafting emails), but destructive or externally-facing actions wait for user sign-off before proceeding.
- **Data Isolation**: All conversational memory, vector embeddings, and telemetry logs in Supabase are strictly partitioned by organization and user using Row Level Security (RLS).
