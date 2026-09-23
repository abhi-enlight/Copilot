// =============================================================================
// Copilot local storage keys — single source of truth
//
// Every browser-persisted copilot artifact is scoped per authenticated user id
// AND active organization id (or "guest" when signed out). Scoping per
// organization prevents cross-tenant data leaks when switching between clients.
// =============================================================================

export function scopeFor(userId?: string | null, orgId?: string | null): string {
  const u = userId || "guest";
  return orgId ? `${u}_${orgId}` : u;
}

/** Persisted transcript of the current copilot session. */
export function getCopilotSessionKey(userId?: string | null, orgId?: string | null): string {
  return `prism_copilot_session_${scopeFor(userId, orgId)}`;
}

/** Working campaign plan (draft/live) shown in the plan panel. */
export function getCopilotWorkingPlanKey(userId?: string | null, orgId?: string | null): string {
  return `prism_copilot_working_plan_${scopeFor(userId, orgId)}`;
}

/** Whether the plan panel is open. */
export function getCopilotPanelOpenKey(userId?: string | null, orgId?: string | null): string {
  return `prism_copilot_panel_open_${scopeFor(userId, orgId)}`;
}

/** Unsent input draft restored by ChatInput. */
export function getDraftKey(userId?: string | null, orgId?: string | null): string {
  return `prism_copilot_draft_input_${scopeFor(userId, orgId)}`;
}

/**
 * Prompt staged by Home template cards. CopilotView consumes (and clears) it
 * on mount and auto-sends it — a template click runs the prompt, it doesn't
 * just prefill the input.
 */
export function getPendingPromptKey(userId?: string | null, orgId?: string | null): string {
  return `prism_copilot_pending_prompt_${scopeFor(userId, orgId)}`;
}
