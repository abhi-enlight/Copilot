"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { SupportedToolSlug, ToolConnectionStatus } from "@/types/integrations";
import { TOTAL_COCKPIT_TOOLS } from "@/lib/constants";

// The 5 core cockpit tools configured in ToolDrawer
export const COCKPIT_TOOL_SLUGS: SupportedToolSlug[] = [
  "outlook",
  "microsoft_teams",
  "slack",
  "linear",
  "zoho",
];

export interface UseToolsStatusResult {
  tools: ToolConnectionStatus[];
  toolsMap: Record<string, ToolConnectionStatus>;
  connectedCount: number;
  totalCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

// Global cache / listeners so all components and headers update simultaneously
let globalTools: ToolConnectionStatus[] = [];
const listeners = new Set<(tools: ToolConnectionStatus[]) => void>();

export function notifyToolsUpdated(tools?: ToolConnectionStatus[]) {
  if (typeof window === "undefined") return;
  if (tools) {
    globalTools = tools;
    listeners.forEach((fn) => fn(tools));
  }
  window.dispatchEvent(new CustomEvent("prism:tools-updated"));
}

export function useToolsStatus(filterToCockpit = true): UseToolsStatusResult {
  const [tools, setTools] = useState<ToolConnectionStatus[]>(globalTools);
  const [isLoading, setIsLoading] = useState<boolean>(globalTools.length === 0);
  const isFetchingRef = useRef<boolean>(false);

  const fetchStatus = useCallback(async (force = false) => {
    if (isFetchingRef.current && !force) return;
    isFetchingRef.current = true;
    try {
      const url = force ? "/api/integrations/status?refresh=true" : "/api/integrations/status";
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.tools && Array.isArray(data.tools)) {
          globalTools = data.tools;
          setTools(data.tools);
          listeners.forEach((fn) => fn(data.tools));
        }
      }
    } catch (err) {
      console.warn("[useToolsStatus] Fetch failed:", err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const listener = (newTools: ToolConnectionStatus[]) => {
      setTools(newTools);
      setIsLoading(false);
    };
    listeners.add(listener);

    // Initial fetch if global cache is empty
    if (globalTools.length === 0) {
      fetch("/api/integrations/status")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!ignore && data?.tools && Array.isArray(data.tools)) {
            globalTools = data.tools;
            setTools(data.tools);
            listeners.forEach((fn) => fn(data.tools));
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!ignore) setIsLoading(false);
        });
    }

    // Real-time synchronization listeners
    const handleEvent = () => fetchStatus(true);
    window.addEventListener("prism:tools-updated", handleEvent);
    window.addEventListener("focus", handleEvent);

    return () => {
      ignore = true;
      listeners.delete(listener);
      window.removeEventListener("prism:tools-updated", handleEvent);
      window.removeEventListener("focus", handleEvent);
    };
  }, [fetchStatus]);

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

  return {
    tools: activeTools,
    toolsMap,
    connectedCount,
    totalCount,
    isLoading,
    refresh: () => fetchStatus(true),
  };
}
