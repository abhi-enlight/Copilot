import { workflow, trigger, node, languageModel, newCredential } from '@n8n/workflow-sdk';

/**
 * 🔷 PRISM 02, Intent Router
 * ----------------------------------------------------------------------------
 * Classifies an incoming user message into a Prism intent so the chat proxy
 * and agent can route it. Returns strict JSON, no prose.
 *
 * Intents:
 *   CHAT                  general assistant conversation
 *   CONNECTOR_<connector> explicit request to query a connector
 *   BRIEFING              daily briefing
 *   SEARCH                cross-source search
 *   PLAN_CREATE / PLAN_MODIFY / PLAN_APPROVE   campaign-style plan lifecycle
 *
 * Webhook: POST /webhook/prism-intent  →  { intent, reasoning, connectorId?,
 *                                             topics[], requestedAction? }
 */
const intentWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Prism Intent Request Webhook',
    parameters: {
      httpMethod: 'POST',
      path: 'prism-intent',
      responseMode: 'responseNode',
      options: {}
    }
  }
});

const geminiIntentModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
  version: 1.1,
  config: {
    name: 'Gemini Intent Model',
    parameters: {
      modelName: 'models/gemini-3.7-flash',
      options: {
        temperature: 0.1
      }
    },
    credentials: {
      googlePalmApi: newCredential('Google Gemini(PaLM) Api account')
    }
  }
});

const classifyIntent = node({
  type: '@n8n/n8n-nodes-langchain.chainLlm',
  version: 1.5,
  config: {
    name: 'Classify Prism Intent',
    parameters: {
      promptType: 'define',
      text: `=You are the Prism intent classifier. Prism connects Microsoft (Outlook mail, Outlook Calendar, OneDrive, SharePoint, Dynamics 365 CRM) and Zoho (CRM, Projects, Books) plus an organization knowledge base.

User message:
"{{ $json.body?.message || "" }}"

Enabled context: {{ $json.body?.connectorContext || "none provided" }}

Classify the intent as exactly one of:
- "CHAT": general question, planning help, knowledge query, or conversation not asking to fetch live connector data.
- "CONNECTOR_<id>": an explicit request to query a live data source, where <id> is one of: microsoft.outlook, microsoft.sharepoint, microsoft.dynamics, zoho.crm, zoho.projects, zoho.books, internal.kb. Example: "show my unread mail" → CONNECTOR_microsoft.outlook.
- "BRIEFING": user asks for a daily/executive briefing combining several sources.
- "SEARCH": user asks to search across multiple sources.
- "PLAN_CREATE": user gives concrete details to build a campaign/initiative plan naming a real client.
- "PLAN_MODIFY": user asks to change an existing plan.
- "PLAN_APPROVE": user confirms approval / push to execute a plan.

Return ONLY valid JSON, no markdown fences:
{
  "intent": "CHAT",
  "reasoning": "one sentence",
  "connectorId": "microsoft.outlook or null",
  "topics": ["array of key topics"],
  "requestedAction": "summarize, list, draft, create, update, or null"
}`
    },
    subnodes: {
      model: geminiIntentModel
    }
  }
});

const parseIntentJson = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Intent JSON',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `
const item = $input.first()?.json || {};
const raw = String(item.output || item.text || '');
let parsed = {
  intent: 'CHAT',
  reasoning: 'Fallback: unparseable model output.',
  connectorId: null,
  topics: [],
  requestedAction: null
};

const cleaned = raw.replace(/\\\`\\\`\\\`(?:json)?/gi, '').replace(/\\\`\\\`\\\`/g, '').trim();
try {
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const candidate = JSON.parse(cleaned.slice(start, end + 1));
    if (candidate && typeof candidate === 'object') {
      parsed = Object.assign(parsed, candidate);
    }
  }
} catch (e) {
  // keep fallback intent
}

return [{ json: parsed }];
`
    }
  }
});

const respondIntent = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Intent JSON',
    parameters: {
      respondWith: 'json',
      responseBody: '={{ JSON.stringify($json) }}',
      options: {}
    }
  }
});

export default workflow('prism-intent-router', 'Prism - Intent Router')
  .add(intentWebhook)
  .to(classifyIntent)
  .to(parseIntentJson)
  .to(respondIntent);
