// =============================================================================
// Copilot local storage keys — single source of truth
//
// Every browser-persisted copilot artifact is scoped per authenticated user id
// (or "guest" when signed out). Centralizing the key builders prevents the
// class of bugs where one writer uses a different suffix than the reader
// (e.g. HomeView once wrote "prism_copilot_draft_input" while ChatInput read
// "prism_copilot_draft_input_<userId>" — template clicks silently no-op'd).
// =============================================================================

export function scopeFor(userId?: string | null): string {
  return userId || "guest";
}

/** Persisted transcript of the current copilot session. */
export function getCopilotSessionKey(userId?: string | null): string {
  return `prism_copilot_session_${scopeFor(userId)}`;
}

/** Working campaign plan (draft/live) shown in the plan panel. */
export function getCopilotWorkingPlanKey(userId?: string | null): string {
  return `prism_copilot_working_plan_${scopeFor(userId)}`;
}

/** Whether the plan panel is open. */
export function getCopilotPanelOpenKey(userId?: string | null): string {
  return `prism_copilot_panel_open_${scopeFor(userId)}`;
}

/** Unsent input draft restored by ChatInput. */
export function getDraftKey(userId?: string | null): string {
  return `prism_copilot_draft_input_${scopeFor(userId)}`;
}

/**
 * Prompt staged by Home template cards. CopilotView consumes (and clears) it
 * on mount and auto-sends it — a template click runs the prompt, it doesn't
 * just prefill the input.
 */
export function getPendingPromptKey(userId?: string | null): string {
  return `prism_copilot_pending_prompt_${scopeFor(userId)}`;
}
