# 📋 Event Schema, Priority Scoring & Action Dispatch

> **Document Status**: LOCKED FOR MVP  
> **Normalization Standard**: Unified JSON Schema for Inbound Stack Events  
> **Priority Engine**: Keyword & Metadata Urgency Classifier

---

## 1. Unified Event Schema

Regardless of whether an event arrives from Microsoft Teams, Outlook, Slack, or Linear, it is normalized into a standard shape before being persisted in `activity_events`:

```typescript
export interface NormalizedTelemetryPayload {
  source: 'teams' | 'outlook' | 'slack' | 'zoho' | 'linear';
  eventType: string;
  externalId: string;
  sender: {
    name: string;
    email?: string;
    avatarUrl?: string;
  };
  title: string;
  summary: string;
  content: string;
  timestamp: string;
  priority: 'low' | 'normal' | 'urgent' | 'critical';
  actionable: boolean;
  suggestedPrompt?: string;
}
```

---

## 2. Priority Scoring Algorithm

Inbound events are classified into four priority tiers to avoid overwhelming the user:

```typescript
// src/lib/telemetry/priority.ts
export function calculateEventPriority(
  title: string, 
  content: string, 
  senderEmail?: string
): 'low' | 'normal' | 'urgent' | 'critical' {
  const text = `${title} ${content}`.toLowerCase();

  // Critical Tier: Explicit escalations or severe system alerts
  if (
    /server down|prod incident|security breach|immediate attention|contract breached/i.test(text)
  ) {
    return 'critical';
  }

  // Urgent Tier: Time-sensitive executive language
  if (
    /urgent|asap|deadline|approval needed|sign-off required|delayed shipment|client escalated/i.test(text)
  ) {
    return 'urgent';
  }

  // Low Tier: Automated newsletters or bot notifications
  if (
    /noreply|newsletter|digest|weekly recap|marketing update/i.test(senderEmail || '')
  ) {
    return 'low';
  }

  return 'normal';
}
```

---

## 3. Supported Event Typology & Prompt Generators

| Platform | Trigger Name | Normalization Rule | Suggested Copilot Prompt |
| :--- | :--- | :--- | :--- |
| **Microsoft Teams** | `TEAMS_NEW_CHANNEL_MESSAGE` | Extracts channel, sender, and text preview. | *"Summarize the Teams discussion in #{channel} and draft the required reply."* |
| **Microsoft Outlook** | `OUTLOOK_NEW_EMAIL` | Extracts subject, sender, and snippet. High priority if flagged or marked important. | *"Read email '{subject}' from {sender} and prepare a draft response."* |
| **Slack** | `SLACK_MENTION` | Triggers when the user or team handle is mentioned. | *"Review the Slack thread where I was mentioned and suggest next steps."* |
| **Zoho CRM** | `ZOHO_CRM_DEAL_UPDATED` | Triggers on deal stage modifications. | *"Show latest details for deal '{dealName}' and review associated tasks."* |
| **Linear** | `LINEAR_ISSUE_ASSIGNED` | Triggers when an engineering ticket is assigned. | *"Review Linear issue '{issueTitle}' and create a breakdown checklist."* |
