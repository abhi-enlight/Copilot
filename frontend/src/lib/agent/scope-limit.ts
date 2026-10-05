/**
 * Scope Limit & Guardrail Engine for Prism Operations Copilot
 *
 * This module is a deterministic, pre-flight safety gate. It intentionally
 * handles ONLY categories where a regex decision is safe and the consequence of
 * a miss is severe and irreversible:
 *
 * 1. Secrets, Credentials & Key Exfiltration (API keys, passwords, .env, tokens)
 * 2. Jailbreaks & System Prompt Exfiltration (dump prompt, ignore rules, DAN)
 * 3. Bulk Mass Deletion & Data Destruction (delete all, wipe, drop table)
 * 4. Financial Execution & Payments (wire transfers, payment movement, payroll)
 * 5. Mass Cold Email Blasting & Channel Spamming (bulk campaigns, spam channels)
 * 6. Workplace Surveillance & HR Actions (spying on DMs, sentiment, terminations)
 *
 * Everything else (general trivia, math, creative writing, unsupported SaaS
 * mentions, generic coding questions) is intentionally NOT regex-blocked. Word
 * matching cannot tell "a meeting on Monday" from the SaaS product "Monday.com",
 * a colleague named "Hunter" from "Hunter.io", or "Stripe" mentioned inside a
 * connected inbox thread — so those judgments belong to the model, which is
 * instructed to decline out-of-scope requests in the system prompt.
 *
 * Values returned by this module are not user-facing decisions of last resort:
 * a blocked category always yields a refusal message, and anything else flows to
 * the agent with its own system-prompt policy.
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

/**
 * Evaluates whether a prompt is within Prism's operational scope.
 * Returns an evaluation object with isInScope boolean and refusal message if out of scope.
 */
export function evaluateScope(message: string): ScopeEvaluation {
  const trimmed = (message || "").trim();
  if (!trimmed) {
    return { isInScope: true, category: "IN_SCOPE" };
  }

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
        "Prism does not execute financial transactions, wire transfers, or direct payment operations.\n\nI can review deal values, pipeline revenue, and invoice metadata in your connected tools for executive reporting purposes.",
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
        "Mass cold email campaigns and multi-channel blast operations are prohibited to protect your organization's domain reputation and email deliverability.\n\nFor mass outreach, please use dedicated marketing automation platforms configured with opt-out mechanisms and bounce tracking.",
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

  return { isInScope: true, category: "IN_SCOPE" };
}
