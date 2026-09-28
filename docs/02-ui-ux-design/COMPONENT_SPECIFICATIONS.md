# 🧩 Component Specifications & Props Contracts

> **Document Status**: LOCKED FOR MVP  
> **Component Library**: Modular Next.js 16 Client Components  
> **Styling**: Tailwind CSS v4 + Framer Motion  
> **Icons**: Phosphor Icons React (Thin / Light weights)  
> **Accessibility**: WCAG AA Compliant with ARIA Live Announcements & Focus Management

---

## 1. Component Hierarchy

```text
frontend/src/components/copilot/
├── CockpitHeader.tsx            # Top telemetry bar, org switcher, live radar status
├── IntelligenceStream.tsx       # Core conversation stream with soft-edge CSS mask
├── HardwareInputBar.tsx         # Double-bezel prompt dock with tool chips & send island
├── LiveStackRadar.tsx           # Real-time event stream (Teams, Outlook, Slack pills)
├── ThinkingProcess.tsx          # Inline orchestration indicator showing agent's multi-step reasoning
├── OrchestrationStep.tsx        # Individual step badge ("Querying Jira...", "Cross-referencing GitHub PRs...")
├── BatchActionPanel.tsx         # Container for multiple Action Cards when agent proposes batch operations
├── cards/
│   ├── ActionCard.tsx           # Base container for interactive execution artifacts
│   ├── EmailDraftCard.tsx       # Email preview with 1-click "Approve & Send"
│   ├── CrmUpdateCard.tsx        # CRM deal/contact mutation preview card
│   └── TaskAssignmentCard.tsx   # Project management ticket creation card
└── drawers/
    ├── ToolDrawer.tsx           # Top-layer animated 1-Click Composio connection grid
    ├── RadarDrawer.tsx          # Expanded Live Stack Radar as a top-layer drawer (/radar route shares the same view)
    └── SessionHistoryDrawer.tsx # Archived briefing sessions & bookmarks
```

---

## 2. Core Component Interfaces

### 2.1 `ActionCard` (Approval & Execution Artifact)
The signature component delivering Viktor's *"autonomous, not unsupervised"* capability:

```typescript
export interface ActionCardProps {
  id: string;
  type: 'EMAIL_SEND' | 'CRM_MUTATION' | 'TASK_CREATE' | 'SHAREPOINT_PROVISION';
  title: string;
  summary: string;
  status: 'PENDING_APPROVAL' | 'EXECUTING' | 'COMPLETED' | 'REJECTED';
  sourceTools?: string[]; // Array of tools that contributed to this action (e.g. ['jira', 'github'])
  metadata: {
    targetApp: 'teams' | 'outlook' | 'slack' | 'zoho' | 'salesforce' | 'linear';
    actionPayload: Record<string, unknown>;
    previewData: {
      recipient?: string;
      subject?: string;
      bodyPreview?: string;
      dealAmount?: string;
      ticketPriority?: string;
    };
  };
  onApprove: (actionId: string) => Promise<void>;
  onReject: (actionId: string) => void;
  onEdit?: (actionId: string, updatedPayload: Record<string, unknown>) => void;
}
```

#### DOM & Container Query Implementation:
- **Container Directive**: Declared with `@container` (`container-type: inline-size`).
- **Stacked Mode (`< 480px`)**: Preview details and buttons stack vertically.
- **Expanded Mode (`>= 480px`)**: Preview details sit on the left, with action buttons right-aligned.
- **Accessible Attributes**: `role="region"`, `aria-label="Pending Action Approval: {title}"`.

---

### 2.2 `LiveStackRadar` (Inbound Telemetry Stream)
Displays live events pushed from Composio Webhook triggers:

```typescript
export interface TelemetryEvent {
  id: string;
  source: 'teams' | 'outlook' | 'slack' | 'zoho' | 'linear';
  eventType: string;
  title: string;
  senderName?: string;
  senderAvatar?: string;
  snippet: string;
  timestamp: string;
  priority: 'low' | 'normal' | 'urgent' | 'critical';
  actionable: boolean;
  suggestedPrompt?: string; // Quick prompt to feed into the Copilot
}

export interface LiveStackRadarProps {
  events: TelemetryEvent[];
  unreadCount: number;
  onSelectEvent: (event: TelemetryEvent) => void;
  onTriggerAction: (prompt: string) => void;
}
```

#### Accessibility & Scroll Masking:
- **Soft-Edge Mask**: `-webkit-mask-image: linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)`.
- **Live Announcements**: Inbound urgent events trigger an off-screen announcement:
  `<div aria-live="polite" class="sr-only">New urgent notification from {event.source}: {event.title}</div>`.

---

### 2.3 `ToolDrawer` (Composio Universal Integrations)
```typescript
export interface ConnectedApp {
  slug: string;
  name: string;
  category: 'communication' | 'mail' | 'crm' | 'dev' | 'storage';
  icon: string;
  isConnected: boolean;
  lastSyncAt?: string;
  scopes: string[];
}

export interface ToolDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  apps: ConnectedApp[];
  onConnectApp: (slug: string) => Promise<string>; // Returns connectUrl
  onDisconnectApp: (slug: string) => Promise<void>;
}
```

#### Top-Layer Modern Web Animation:
- Implemented as a native `<dialog>` element with `@starting-style` and `transition-behavior: allow-discrete` to achieve smooth 60fps sliding without JavaScript coordinate calculations.
- Closes gracefully on Escape key press or backdrop click.

---

### 2.4 `HardwareInputBar` (Prompt & Context Dock)
- **Double-Bezel Architecture**: Outer milled aluminum chassis (`p-1.5 rounded-[2rem] bg-white/[0.04] border border-white/[0.08]`) enclosing an inner tactile core (`bg-[#0B0D13]`).
- **Context Attachment Chips**: Filter buttons (`@Teams`, `@Outlook`, `@CRM`, `@All`) that toggle visual glow pills to narrow tool focus.
- **Haptic Island Send Button**: Trailing circular icon button nested flush with the prompt input.

---

### 2.5 `ThinkingProcess` & `OrchestrationStep` (Multi-Tool Orchestration)
Visual indicators displaying the agent's step-by-step reasoning and tool chaining.

```typescript
export interface OrchestrationStepProps {
  id: string;
  label: string; // e.g. "Querying Jira...", "Cross-referencing GitHub PRs..."
  tool: string; // e.g. 'jira', 'github', 'notion'
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FAILED';
  resultSummary?: string;
}

export interface ThinkingProcessProps {
  steps: OrchestrationStepProps[];
  isComplete: boolean;
  onExpandDetails?: () => void;
}
```

#### Animation & Visual States:
- **Active Step**: Bouncing or pulsing loading dot, highlighted tool badge.
- **Completed Step**: Smooth checkmark transition, muted tool badge.
- **Transitions**: Framer Motion `AnimatePresence` for steps appearing sequentially.

---

### 2.6 `BatchActionPanel` (Bulk Proposal Container)
Used when the agent proposes multiple actions at once (e.g., 7 follow-up emails, or updating Jira then sending Slack).

```typescript
export interface BatchActionPanelProps {
  batchId: string;
  title: string; // e.g. "Drafted 7 Follow-up Emails"
  summary?: string;
  actions: ActionCardProps[];
  status: 'PENDING_APPROVAL' | 'PARTIAL_APPROVAL' | 'ALL_APPROVED' | 'REJECTED';
  onApproveAll: (batchId: string) => Promise<void>;
  onRejectAll: (batchId: string) => void;
  onReviewEach: (batchId: string) => void;
}
```

#### Layout & Interactions:
- **Header**: Summarizes the batch intent with global "Approve All" / "Review Each" actions.
- **Body**: Scrollable container housing multiple smaller-scale `ActionCard` components.
- **Progress**: Visual progress bar indicating how many actions in the batch have been approved or processed.
