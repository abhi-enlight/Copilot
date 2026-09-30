/**
 * Scope Limit & Guardrail Engine for Prism Operations Copilot
 *
 * Enforces enterprise operational boundaries: Prism strictly operates as an Executive
 * Workplace Operations Copilot for connected productivity tools:
 * Microsoft Outlook, Microsoft Teams, Slack, Linear, Zoho CRM, GitHub,
 * Gmail, Google Calendar, and Notion.
 *
 * Rejects 11 Out-of-Scope Domains:
 * 1. Pure Math & Science (arithmetic, logarithms, calculus, algebra)
 * 2. Unsupported Third-Party SaaS (e.g. MillionVerifier, Salesforce, HubSpot, Stripe)
 * 3. General Trivia & Non-work Q&A (history, geography, pop culture, weather)
 * 4. Creative Writing & Entertainment (jokes, poems, stories, roleplay)
 * 5. Generic Coding / Leetcode Tutoring
 * 6. Secrets, Credentials & Key Exfiltration (API keys, passwords, .env, tokens)
 * 7. Bulk Mass Deletion & Data Destruction (delete all, wipe, drop table)
 * 8. Financial Execution & Payments (wire transfers, payment movement, payroll)
 * 9. Mass Cold Email Blasting & Channel Spamming (bulk campaigns, spam channels)
 * 10. Workplace Surveillance & HR Actions (spying on Slack DMs, sentiment, firings)
 * 11. Jailbreaks & System Prompt Exfiltration (dump prompt, ignore rules, DAN)
 *
 * Protects legitimate in-scope calculations derived from workplace data
 * (e.g. summing CRM deal amounts, counting sprint tickets).
 */

export type ScopeCategory =
  | "IN_SCOPE"
  | "OUT_OF_SCOPE_MATH"
  | "OUT_OF_SCOPE_UNSUPPORTED_SAAS"
  | "OUT_OF_SCOPE_TRIVIA"
  | "OUT_OF_SCOPE_CREATIVE"
  | "OUT_OF_SCOPE_GENERIC_CODE"
  | "OUT_OF_SCOPE_SECRETS"
  | "OUT_OF_SCOPE_BULK_DESTRUCTIVE"
  | "OUT_OF_SCOPE_FINANCIAL"
  | "OUT_OF_SCOPE_MASS_COMMUNICATION"
  | "OUT_OF_SCOPE_SURVEILLANCE"
  | "OUT_OF_SCOPE_JAILBREAK";

export interface ScopeEvaluation {
  isInScope: boolean;
  category: ScopeCategory;
  reason?: string;
  refusalResponse?: string;
  matchedEntity?: string;
}

interface UnsupportedSaaS {
  name: string;
  patterns: RegExp[];
}

const UNSUPPORTED_SAAS_CATALOG: UnsupportedSaaS[] = [
  // Email verification / scraping services
  { name: "MillionVerifier", patterns: [/\bmillion\s*verifier\b/i] },
  { name: "NeverBounce", patterns: [/\bneverbounce\b/i] },
  { name: "ZeroBounce", patterns: [/\bzerobounce\b/i] },
  { name: "Debounce", patterns: [/\bdebounce\b/i] },
  { name: "Hunter.io", patterns: [/\bhunter(?:\.io)?\b/i] },
  { name: "Apollo.io", patterns: [/\bapollo(?:\.io)?\b/i] },
  { name: "Snov.io", patterns: [/\bsnov(?:\.io)?\b/i] },
  { name: "Lusha", patterns: [/\blusha\b/i] },
  { name: "ZoomInfo", patterns: [/\bzoominfo\b/i] },

  // CRMs not connected
  { name: "Salesforce", patterns: [/\bsalesforce\b/i] },
  { name: "HubSpot", patterns: [/\bhubspot\b/i] },
  { name: "Pipedrive", patterns: [/\bpipedrive\b/i] },
  { name: "Freshsales", patterns: [/\bfreshsales\b/i] },

  // Issue Trackers / PM tools not connected
  { name: "Jira", patterns: [/\bjira\b/i] },
  { name: "Asana", patterns: [/\basana\b/i] },
  { name: "Trello", patterns: [/\btrello\b/i] },
  { name: "Monday.com", patterns: [/\bmonday(?:\.com)?\b/i] },
  { name: "ClickUp", patterns: [/\bclickup\b/i] },
  { name: "Basecamp", patterns: [/\bbasecamp\b/i] },

  // Payments / Commerce
  { name: "Stripe", patterns: [/\bstripe\b/i] },
  { name: "Shopify", patterns: [/\bshopify\b/i] },
  { name: "QuickBooks", patterns: [/\bquickbooks\b/i] },
  { name: "Xero", patterns: [/\bxero\b/i] },

  // Helpdesk
  { name: "Zendesk", patterns: [/\bzendesk\b/i] },
  { name: "Freshdesk", patterns: [/\bfreshdesk\b/i] },
  { name: "Intercom", patterns: [/\bintercom\b/i] },

  // Marketing automation
  { name: "Mailchimp", patterns: [/\bmailchimp\b/i] },
  { name: "SendGrid", patterns: [/\bsendgrid\b/i] },
  { name: "Klaviyo", patterns: [/\bklaviyo\b/i] },
  { name: "ActiveCampaign", patterns: [/\bactivecampaign\b/i] },
  { name: "Brevo", patterns: [/\bbrevo\b/i] },
];

/**
 * Words indicating genuine workplace operations context.
 * If present, calculations or mentions are evaluated as workplace context.
 */
const WORKPLACE_CONTEXT_PATTERNS = [
  /\b(outlook|gmail|email|emails|mail|inbox|unread|draft|drafts|send|sent|thread|reply|forward)\b/i,
  /\b(teams|slack|channel|channels|dm|direct\s*message|mention|mentions)\b/i,
  /\b(linear|github|issue|issues|ticket|tickets|pr|prs|pull\s*request|pull\s*requests|repo|repos|repository|repositories|commit|commits|branch|branches)\b/i,
  /\b(zoho|crm|deal|deals|lead|leads|pipeline|stage|account|accounts|contact|contacts|sales|revenue|customer|client)\b/i,
  /\b(calendar|meeting|meetings|event|events|schedule|agenda|availability|invite|attendee|attendees)\b/i,
  /\b(notion|document|documents|doc|docs|page|pages|spec|specs|wiki|notes)\b/i,
  /\b(sprint|standup|backlog|milestone|blocker|blockers|assignee|assigned)\b/i,
];

function hasWorkplaceContext(text: string): boolean {
  return WORKPLACE_CONTEXT_PATTERNS.some((p) => p.test(text));
}

/**
 * Evaluates whether a prompt is within Prism's operational scope.
 * Returns an evaluation object with isInScope boolean and refusal message if out of scope.
 */
export function evaluateScope(message: string): ScopeEvaluation {
  const trimmed = (message || "").trim();
  if (!trimmed) {
    return { isInScope: true, category: "IN_SCOPE" };
  }

  const isWorkContext = hasWorkplaceContext(trimmed);

  // 1. Secrets, Passwords & Credential Exfiltration
  const isSecretRequest =
    /(?:\b(api[\s_-]?keys?|secret[\s_-]?keys?|access[\s_-]?tokens?|private[\s_-]?keys?|ssh[\s_-]?keys?|database\s+passwords?|db\s+passwords?|db\s+credentials?|connection\s+strings?)|(?:\b|\s)\.env(?:\.[a-z0-9_-]+)?)\b/i.test(trimmed) &&
    /\b(show|get|print|extract|search|find|reveal|dump|read|display|what\s+is)\b/i.test(trimmed);

  if (isSecretRequest) {
    return {
      isInScope: false,
      category: "OUT_OF_SCOPE_SECRETS",
      reason: "Requests to reveal credentials, API keys, passwords, or environment variables are strictly blocked.",
      refusalResponse:
        "Prism is strictly prohibited from searching for, displaying, or extracting credentials, secret keys, passwords, private keys, or environment files.\n\nAll secrets must be managed securely through your dedicated cloud key vault or identity provider.",
    };
  }

  // 2. Jailbreak, Policy Bypass & Prompt Exfiltration
  const isJailbreak =
    /\b(repeat|print|show|output|reveal|dump)\s+(?:your\s+)?(?:complete\s+|full\s+|all\s+)?(?:system\s+prompt|system\s+instructions|developer\s+prompt|hidden\s+rules|developer\s+instructions)\b/i.test(trimmed) ||
    /\b(ignore\s+(?:all\s+)?previous\s+instructions|act\s+as\s+(?:dan|jailbreak|unrestricted|an\s+unfiltered\s+ai))\b/i.test(trimmed);

  if (isJailbreak) {
    return {
      isInScope: false,
      category: "OUT_OF_SCOPE_JAILBREAK",
      reason: "Attempts to exfiltrate system instructions or bypass operational guardrails.",
      refusalResponse:
        "I am Prism, your executive workplace operations copilot. I operate under strict enterprise security boundaries and do not disclose internal prompt architectures or bypass operational constraints.",
    };
  }

  // 3. Bulk Mass Deletion & Data Destruction
  const isBulkDeletion =
    /\b(delete\s+all|wipe\s+all|purge\s+all|remove\s+all|drop\s+table|delete\s+every|wipe\s+out|delete\s+database|delete\s+(?:the\s+)?main\s+branch|delete\s+(?:the\s+)?master\s+branch|delete\s+(?:this\s+|the\s+)?repo(?:sitory)?)\b/i.test(trimmed) ||
    /\b(delete|wipe|purge|remove)\s+(?:all|everything|all\s+the|every)\s+(?:emails?|mails?|messages?|tickets?|issues?|leads?|deals?|contacts?|events?|tasks?)\b/i.test(trimmed);

  if (isBulkDeletion) {
    return {
      isInScope: false,
      category: "OUT_OF_SCOPE_BULK_DESTRUCTIVE",
      reason: "Bulk deletion and mass purging operations are prohibited to prevent irreversible data loss.",
      refusalResponse:
        "Bulk or mass deletion operations are strictly prohibited in Prism to prevent irreversible data loss across your connected tools.\n\nDeletions must be performed individually with specific identifiers, or managed directly within the provider's native administrative console.",
    };
  }

  // 4. Financial Transactions, Payments & Wire Transfers
  const isFinancialExecution =
    /\b(wire\s+transfer|wire\s+\$?\d+|pay\s+(?:this\s+|the\s+)?invoice|pay\s+\$?\d+|transfer\s+\$?\d+|execute\s+payment|send\s+\$?\d+\s+to|approve\s+payroll)\b/i.test(trimmed);

  if (isFinancialExecution) {
    return {
      isInScope: false,
      category: "OUT_OF_SCOPE_FINANCIAL",
      reason: "Direct money transfers, invoice payments, and financial transaction execution are prohibited.",
      refusalResponse:
        "Prism does not execute financial transactions, wire transfers, or direct payment operations.\n\nI can review deal values, pipeline revenue, and invoice metadata in your connected Zoho CRM for executive reporting purposes.",
    };
  }

  // 5. Mass Cold Email Blasting & Multi-Channel Spamming
  const isMassComm =
    /\b(email\s+all|blast\s+an?\s+email|send\s+(?:a\s+)?blast|cold\s+email\s+campaign|mass\s+email|spam\s+(?:all\s+)?channels?|post\s+(?:this\s+)?to\s+(?:every|all)\s+channels?)\b/i.test(trimmed) ||
    /\b(email|mail)\s+(?:all|every)\s+(?:\d+\s+)?(?:contacts?|leads?|users?|customers?|clients?|subscribers?)\b/i.test(trimmed);

  if (isMassComm) {
    return {
      isInScope: false,
      category: "OUT_OF_SCOPE_MASS_COMMUNICATION",
      reason: "Bulk email blasting and multi-channel spamming damage domain deliverability and are prohibited.",
      refusalResponse:
        "Mass cold email campaigns and multi-channel blast operations are prohibited to protect your organization's domain reputation and email deliverability.\n\nFor mass outreach, please use dedicated marketing automation platforms (such as Mailchimp or Klaviyo) configured with opt-out mechanisms and bounce tracking.",
    };
  }

  // 6. Employee Surveillance, Sentiment Scraping & HR Terminations
  const isSurveillance =
    /\b(spy\s+on|monitor\s+(?:what\s+)?(?:employees?|coworkers?|people|staff)\s+(?:are\s+saying|say)|search\s+slack\s+for\s+(?:complaints?|people\s+complaining)|track\s+(?:private\s+)?messages\s+about\s+salaries?)\b/i.test(trimmed) ||
    /\b(terminate\s+(?:employment|employee)|fire\s+(?:employee|coworker)|draft\s+(?:a\s+)?termination\s+(?:letter|email|notice))\b/i.test(trimmed);

  if (isSurveillance) {
    return {
      isInScope: false,
      category: "OUT_OF_SCOPE_SURVEILLANCE",
      reason: "Employee surveillance, message sentiment snooping, and automated firings are strictly prohibited.",
      refusalResponse:
        "Prism is designed for executive workplace operations and does not conduct employee surveillance, sentiment monitoring, or automated employment termination workflows.\n\nSensitive HR matters must be handled through designated personnel and legal procedures.",
    };
  }

  // 7. Unsupported Third-Party SaaS
  for (const saas of UNSUPPORTED_SAAS_CATALOG) {
    if (saas.patterns.some((p) => p.test(trimmed))) {
      // Allow if the user is simply drafting an email/message that mentions the tool name
      const isDrafting =
        /\b(draft|write|compose|send|email|mail)\b/i.test(trimmed) &&
        /\b(to|about|mentioning|subject|regarding)\b/i.test(trimmed);

      if (!isDrafting) {
        return {
          isInScope: false,
          category: "OUT_OF_SCOPE_UNSUPPORTED_SAAS",
          matchedEntity: saas.name,
          reason: `Requested service "${saas.name}" is not connected to Prism.`,
          refusalResponse: `**${saas.name}** is not currently supported or connected to Prism.\n\nI can orchestrate tasks across your active workplace tools:\n- **Email & Messaging**: Microsoft Outlook, Microsoft Teams, Slack, Gmail\n- **Project & Issues**: Linear, GitHub\n- **CRM & Pipeline**: Zoho CRM\n- **Calendar & Docs**: Google Calendar, Notion\n\nLet me know if you would like me to retrieve data or take action in any of those.`,
        };
      }
    }
  }

  // 8. Generic Coding Exercises / LeetCode
  const isGenericCode =
    /\b(?:quicksort|mergesort|bubble\s*sort|dijkstra|two\s*sum|fizzbuzz|reverse\s+linked\s+list|binary\s+search)\b/i.test(trimmed) ||
    /\b(write|solve|implement)\s+(?:a\s+)?(?:leetcode|hackerrank|codeforces)\b/i.test(trimmed);

  if (isGenericCode && !isWorkContext) {
    return {
      isInScope: false,
      category: "OUT_OF_SCOPE_GENERIC_CODE",
      reason: "Generic coding problem unrelated to connected repositories.",
      refusalResponse:
        "I am an operations copilot designed for connected workplace tools rather than standalone coding exercises.\n\nI can inspect connected GitHub repositories, review pull requests, or track issues in Linear and GitHub if you need help with your projects.",
    };
  }

  // 9. Pure Math, Logarithms, Arithmetic & Calculus
  // Out of scope ONLY if NOT connected to workplace metrics (e.g. deals, tickets)
  const isLogExpr = /(?:\bwhat\s+is\s+)?\d*\.?\d*\s*(?:log|ln|log10|log2)\s*\(?\d*\.?\d*\)?/i.test(trimmed);
  const isPureArithmetic = /^(?:what\s+is\s+|calculate\s+|solve\s+)?\(?\d+[\d\s\.\+\-\*\/\^\%\(\)]+[?]?$/i.test(trimmed);
  const isTrigOrCalculus = /\b(sin|cos|tan|arcsin|arccos|arctan|derivative|integral|integrate|differentiate)\s*\(?[0-9x]/i.test(trimmed);
  const isAlgebraEquation = /\b(solve\s+[0-9a-z\+\-\*\/\s\=\<\>]{3,}|quadratic\s+equation|pythagorean\s+theorem|calculus\s+problem)\b/i.test(trimmed);
  const isGenericConversion = /\b(?:calculate\s+tip|convert\s+\d+\s*(?:usd|eur|gbp|miles|km|celsius|fahrenheit))\b/i.test(trimmed);

  if ((isLogExpr || isPureArithmetic || isTrigOrCalculus || isAlgebraEquation || isGenericConversion) && !isWorkContext) {
    return {
      isInScope: false,
      category: "OUT_OF_SCOPE_MATH",
      reason: "Pure math, scientific calculation, or conversion unrelated to connected workplace tools.",
      refusalResponse:
        "I am an executive operations copilot focused on managing your connected workplace tools and do not solve general math or science problems.\n\nI can help you review your emails, manage tickets in Linear, check CRM deals, or organize your calendar if you need assistance with your work.",
    };
  }

  // 10. Creative Writing & Entertainment
  const isCreative =
    /\b(tell\s+me\s+a\s+joke|tell\s+a\s+joke|write\s+a\s+(?:poem|haiku|story|song|script|bedtime\s+story)|tell\s+a\s+story|roleplay\s+as|sing\s+a\s+song|give\s+me\s+a\s+riddle)\b/i.test(trimmed);
  if (isCreative) {
    return {
      isInScope: false,
      category: "OUT_OF_SCOPE_CREATIVE",
      reason: "Creative writing, jokes, or entertainment requests are outside workplace operations.",
      refusalResponse:
        "I am an executive workplace operations copilot focused on managing your connected tools, so I do not generate jokes, stories, or creative entertainment.\n\nLet me know if you need assistance with your emails, calendar, Linear tickets, or CRM pipeline.",
    };
  }

  // 11. General Trivia, Weather & History
  const isTrivia =
    /(?:who\s+(?:was|is)\s+[^?]+[?]?$|what\s+is\s+the\s+capital\s+of|how\s+many\s+planets|who\s+invented|when\s+was\s+the\s+war|who\s+won\s+the\s+world\s+cup|who\s+directed|how\s+deep\s+is\s+the|what\s+is\s+the\s+weather\s+in)/i.test(trimmed);
  if (isTrivia && !isWorkContext) {
    return {
      isInScope: false,
      category: "OUT_OF_SCOPE_TRIVIA",
      reason: "General trivia, weather, or encyclopedia query.",
      refusalResponse:
        "I am an executive operations copilot designed for your connected workplace tools, so I do not answer general trivia, weather, or history questions.\n\nI would be glad to help you manage your emails, calendar, Linear issues, or CRM deals instead.",
    };
  }

  return { isInScope: true, category: "IN_SCOPE" };
}
