"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";
import type { SupportedToolSlug, ToolConnectionStatus } from "@/types/integrations";
import { TOTAL_COCKPIT_TOOLS } from "@/lib/constants";
import { useOptionalAuth } from "@/components/providers/AuthProvider";

// All 16 core enterprise tools configured in Prism V2
export const COCKPIT_TOOL_SLUGS: SupportedToolSlug[] = [
  "outlook",
  "microsoft_teams",
  "slack",
  "linear",
  "zoho",
  "github",
  "gmail",
  "googlecalendar",
  "notion",
  "dynamics365",
  "share_point",
  "zoho_books",
  "jira",
  "monday",
  "clickup",
  "zoho_projects",
];

export interface UseToolsStatusResult {
  tools: ToolConnectionStatus[];
  toolsMap: Record<string, ToolConnectionStatus>;
  connectedCount: number;
  totalCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

// ── External Reactive Store with Strict User Partitioning ────────────
interface ToolsStoreState {
  userId: string | null;
  tools: ToolConnectionStatus[];
  isLoading: boolean;
}

const EMPTY_STORE_STATE: ToolsStoreState = {
  userId: null,
  tools: [],
  isLoading: false,
};

let currentStoreState: ToolsStoreState = EMPTY_STORE_STATE;
const storeListeners = new Set<() => void>();

function emitStoreChange() {
  storeListeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  storeListeners.add(listener);
  return () => {
    storeListeners.delete(listener);
  };
}

function getSnapshot(): ToolsStoreState {
  return currentStoreState;
}

function getServerSnapshot(): ToolsStoreState {
  return EMPTY_STORE_STATE;
}

let inFlightUserId: string | null = null;

async function fetchStatusForUser(targetUserId: string, force = false) {
  if (inFlightUserId === targetUserId && !force) return;
  inFlightUserId = targetUserId;

  try {
    const url = force ? "/api/integrations/status?refresh=true" : "/api/integrations/status";
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      // Guard against race condition: ensure response belongs to the target user
      if (currentStoreState.userId === targetUserId && Array.isArray(data.tools)) {
        currentStoreState = {
          userId: targetUserId,
          tools: data.tools,
          isLoading: false,
        };
        emitStoreChange();
      }
    } else if (res.status === 401) {
      if (currentStoreState.userId === targetUserId) {
        currentStoreState = EMPTY_STORE_STATE;
        emitStoreChange();
      }
    }
  } catch (err) {
    console.warn("[useToolsStatus] Fetch failed:", err);
    if (currentStoreState.userId === targetUserId) {
      currentStoreState = {
        ...currentStoreState,
        isLoading: false,
      };
      emitStoreChange();
    }
  } finally {
    if (inFlightUserId === targetUserId) {
      inFlightUserId = null;
    }
  }
}

/**
 * Purges the tools store and notifies subscribers immediately.
 */
export function clearToolsCache() {
  currentStoreState = EMPTY_STORE_STATE;
  inFlightUserId = null;
  emitStoreChange();
}

/**
 * Notifies all active subscribers that tools have updated.
 * Updates store for current user if tools array provided.
 */
export function notifyToolsUpdated(tools?: ToolConnectionStatus[]) {
  if (typeof window === "undefined") return;
  if (tools && currentStoreState.userId) {
    currentStoreState = {
      ...currentStoreState,
      tools,
      isLoading: false,
    };
    emitStoreChange();
  }
  window.dispatchEvent(new CustomEvent("prism:tools-updated"));
}

// Global browser listeners registered once
if (typeof window !== "undefined") {
  window.addEventListener("prism:auth-signout", () => {
    clearToolsCache();
  });

  window.addEventListener("prism:tools-updated", () => {
    if (currentStoreState.userId) {
      void fetchStatusForUser(currentStoreState.userId, true);
    }
  });

  window.addEventListener("focus", () => {
    if (currentStoreState.userId) {
      void fetchStatusForUser(currentStoreState.userId, false);
    }
  });
}

export function useToolsStatus(filterToCockpit = true): UseToolsStatusResult {
  const auth = useOptionalAuth();
  const userId = auth?.user?.id ?? null;
  const isAuthLoading = auth?.isLoading ?? false;

  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!userId) {
      if (currentStoreState.userId !== null) {
        clearToolsCache();
      }
      return;
    }

    if (currentStoreState.userId !== userId) {
      currentStoreState = { userId, tools: [], isLoading: true };
      emitStoreChange();
      void fetchStatusForUser(userId, false);
    }
  }, [userId]);

  // Strictly isolate data: only return tools if the store's userId matches the authenticated user
  const isCurrent = store.userId === userId && userId !== null;
  const tools = isCurrent ? store.tools : [];
  const isLoading = isAuthLoading || (userId !== null && (!isCurrent || store.isLoading));

  const activeTools = filterToCockpit
    ? tools.filter((t) => COCKPIT_TOOL_SLUGS.includes(t.slug))
    : tools;

  const toolsMap: Record<string, ToolConnectionStatus> = {};
  activeTools.forEach((t) => {
    toolsMap[t.slug] = t;
  });

  const connectedCount = activeTools.filter((t) => t.isConnected).length;
  const totalCount = filterToCockpit
    ? TOTAL_COCKPIT_TOOLS
    : (tools.length || TOTAL_COCKPIT_TOOLS);

  const refresh = useCallback(async () => {
    if (userId) {
      await fetchStatusForUser(userId, true);
    }
  }, [userId]);

  return {
    tools: activeTools,
    toolsMap,
    connectedCount,
    totalCount,
    isLoading,
    refresh,
  };
}
