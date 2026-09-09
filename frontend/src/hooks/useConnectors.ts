"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";

export type ConnectorId =
  | "microsoft.outlook"
  | "microsoft.sharepoint"
  | "microsoft.dynamics"
  | "zoho.crm"
  | "zoho.projects"
  | "zoho.books"
  | "internal.kb";

export type ConnectorAccess = "granted" | "locked" | "not_connected";

export interface ConnectorVerdict {
  access: ConnectorAccess;
  reason: string;
  viaRoleOverride: boolean;
  probeOk: boolean;
  probedNow: boolean;
}

export interface ServerTenantStatus {
  authenticated: boolean;
  m365Connected: boolean;
  outlookConnected: boolean;
  onedriveConnected: boolean;
  sharepointConnected: boolean;
  crmConnected: boolean;
  zohoConnected: boolean;
  userEmail: string | null;
  userName: string | null;
  sharepointDrive: string | null;
  dynamicsOrg: string | null;
  grantedScopes: string[];
  role?: string;
  crmAccess?: ConnectorAccess;
  crmReason?: string;
  zoho?: Record<string, { connected: boolean; access: ConnectorAccess; reason: string }>;
}

// -----------------------------------------------------------------------------
// LIVE DATA ONLY, no localStorage caching of connector state. Every value the
// UI renders comes from a live server fetch; until that fetch lands the UI
// shows loaders/skeletons instead of stale or fabricated state.
// -----------------------------------------------------------------------------

const DEFAULT_CONNECTORS: Record<ConnectorId, boolean> = {
  "microsoft.outlook": true,
  "microsoft.sharepoint": true,
  "microsoft.dynamics": false,
  "zoho.crm": true,
  "zoho.projects": true,
  "zoho.books": true,
  "internal.kb": true,
};

/** Short display names for connector pause pills (Home status card etc.). */
export const PAUSED_PILL_LABELS: Record<ConnectorId, string> = {
  "microsoft.outlook": "Outlook Mail",
  "microsoft.sharepoint": "SharePoint & OneDrive",
  "microsoft.dynamics": "Dynamics 365",
  "zoho.crm": "Zoho CRM",
  "zoho.projects": "Zoho Projects",
  "zoho.books": "Zoho Books",
  "internal.kb": "Knowledge Base",
};

export function useConnectors() {
  // Server-side pause preferences (app_users.connector_preferences). Null
  // until the first live fetch returns, consumers must render a loader, not
  // their own default.
  const [activeConnectors, setActiveConnectors] = useState<Record<ConnectorId, boolean> | null>(null);
  const [connectorIdsLoading, setConnectorIdsLoading] = useState<Set<ConnectorId>>(new Set());
  const [prefSaveError, setPrefSaveError] = useState<ConnectorId | null>(null);

  const [serverStatus, setServerStatus] = useState<ServerTenantStatus | null>(null);
  const [entitlements, setEntitlements] = useState<Record<ConnectorId, ConnectorVerdict> | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const [statusError, setStatusError] = useState<boolean>(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  // Guards against setState-after-unmount in the fire-and-forget initial load.
  const cancelledRef = useRef(false);
  const prefSaveInFlightRef = useRef(false);
  // Suppresses the synchronous spinner on the initial mount load (isSyncing
  // already starts true) so the mount effect stays free of sync setState.
  const hasSyncedOnceRef = useRef(false);

  const applyEntitlements = useCallback((data: Record<ConnectorId, ConnectorVerdict>) => {
    setEntitlements(data);
  }, []);

  // One shared live sync used by initial load, manual retry and re-check.
  // Note: no synchronous setState on the first invocation, isSyncing already
  // starts true, so the mount effect triggers zero cascading renders.
  const syncStatus = useCallback(
    async (opts: { keepToggles?: boolean } = {}) => {
      if (hasSyncedOnceRef.current) setIsSyncing(true);
      try {
        const [statusRes, entRes, prefRes] = await Promise.all([
          fetch("/api/tenant/status"),
          fetch("/api/tenant/entitlements"),
          fetch("/api/connectors/preferences"),
        ]);
        let anyOk = false;
        if (statusRes.ok) {
          setServerStatus(await statusRes.json());
          setStatusError(false);
          anyOk = true;
        }
        if (entRes.ok) {
          const data = await entRes.json();
          if (data.connectors) applyEntitlements(data.connectors as Record<ConnectorId, ConnectorVerdict>);
          anyOk = true;
        }
        if (prefRes.ok) {
          const data = await prefRes.json();
          const prefs = (data.preferences || {}) as Record<string, boolean>;
          setActiveConnectors((prev) => {
            if (!prev || !opts.keepToggles) {
              // Server map wins; absent keys fall back to enabled defaults
              const merged = { ...DEFAULT_CONNECTORS } as Record<ConnectorId, boolean>;
              for (const key of Object.keys(merged) as ConnectorId[]) {
                if (key in prefs) merged[key] = prefs[key] !== false;
              }
              return merged;
            }
            return prev;
          });
          anyOk = true;
        }
        if (!anyOk) setStatusError(true);
        setLastCheckedAt(new Date());
      } catch (err) {
        console.warn("Failed to sync tenant status:", err);
        setStatusError(true);
      } finally {
        setIsSyncing(false);
        hasSyncedOnceRef.current = true;
      }
    },
    [applyEntitlements]
  );

  // Subscribe to the live status/entitlements/preference APIs on mount.
  // The async runner is defined inside the effect so all setState calls happen
  // in async continuations, no synchronous setState in the effect body.
  useEffect(() => {
    cancelledRef.current = false;
    const run = async () => {
      try {
        const [statusRes, entRes, prefRes] = await Promise.all([
          fetch("/api/tenant/status"),
          fetch("/api/tenant/entitlements"),
          fetch("/api/connectors/preferences"),
        ]);
        let anyOk = false;
        if (!cancelledRef.current && statusRes.ok) {
          setServerStatus(await statusRes.json());
          setStatusError(false);
          anyOk = true;
        }
        if (!cancelledRef.current && entRes.ok) {
          const data = await entRes.json();
          if (data.connectors) applyEntitlements(data.connectors as Record<ConnectorId, ConnectorVerdict>);
          anyOk = true;
        }
        if (!cancelledRef.current && prefRes.ok) {
          const data = await prefRes.json();
          const prefs = (data.preferences || {}) as Record<string, boolean>;
          const merged = { ...DEFAULT_CONNECTORS } as Record<ConnectorId, boolean>;
          for (const key of Object.keys(merged) as ConnectorId[]) {
            if (key in prefs) merged[key] = prefs[key] !== false;
          }
          setActiveConnectors(merged);
          anyOk = true;
        }
        if (!cancelledRef.current) {
          if (!anyOk) setStatusError(true);
          setLastCheckedAt(new Date());
        }
      } catch (err) {
        console.warn("Failed to sync tenant status:", err);
        if (!cancelledRef.current) setStatusError(true);
      } finally {
        if (!cancelledRef.current) setIsSyncing(false);
        hasSyncedOnceRef.current = true;
      }
    };
    void run();
    return () => {
      cancelledRef.current = true;
    };
  }, [applyEntitlements]);

  // Server-authoritative clamping: a locked or disconnected connector can
  // never read as enabled. Derived at render, no setState-in-effect loops.
  const effectiveConnectors = useMemo<Record<ConnectorId, boolean> | null>(() => {
    if (!activeConnectors) return null; // still loading, UI must show a loader
    if (!entitlements) return activeConnectors;
    const next = { ...activeConnectors };
    let changed = false;
    (Object.keys(entitlements) as ConnectorId[]).forEach((id) => {
      if (entitlements[id]?.access !== "granted" && next[id]) {
        next[id] = false;
        changed = true;
      }
    });
    return changed ? next : activeConnectors;
  }, [activeConnectors, entitlements]);

  /**
   * Optimistic toggle that persists to the SERVER (the pause source of truth).
   * Flips immediately, rolls back with an error banner if the save fails, and
   * tracks per-connector saving state so the switch shows a spinner.
   */
  const toggleConnector = useCallback(
    async (id: ConnectorId, enabled?: boolean) => {
      // Hard gate: locked connectors are not toggleable at all
      if (entitlements && entitlements[id]?.access !== "granted") return;

      const currentValue = activeConnectors ? activeConnectors[id] : DEFAULT_CONNECTORS[id];
      const nextValue = enabled !== undefined ? enabled : !currentValue;

      // Optimistic flip
      setActiveConnectors((prev) => {
        const base = prev || { ...DEFAULT_CONNECTORS };
        return { ...base, [id]: nextValue };
      });
      setConnectorIdsLoading((prev) => new Set(prev).add(id));
      setPrefSaveError(null);
      prefSaveInFlightRef.current = true;

      try {
        const res = await fetch("/api/connectors/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectorId: id, enabled: nextValue }),
        });
        if (!res.ok) throw new Error(`preference save failed (${res.status})`);
        setPrefSaveError(null);
      } catch (err) {
        console.warn("[useConnectors] preference save failed:", err);
        // Roll back the optimistic flip and surface a banner
        setActiveConnectors((prev) => {
          const base = prev || { ...DEFAULT_CONNECTORS };
          return { ...base, [id]: currentValue };
        });
        setPrefSaveError(id);
      } finally {
        prefSaveInFlightRef.current = false;
        setConnectorIdsLoading((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [entitlements, activeConnectors]
  );

  const isConnectorEnabled = useCallback(
    (id: ConnectorId) => Boolean(effectiveConnectors ? effectiveConnectors[id] : DEFAULT_CONNECTORS[id]),
    [effectiveConnectors]
  );

  /** Access verdict for a connector: "granted" | "locked" | "not_connected" (null while the first sync is in flight). */
  const access = useCallback(
    (id: ConnectorId): ConnectorAccess | null => (entitlements ? entitlements[id]?.access ?? "granted" : null),
    [entitlements]
  );

  const entitlementFor = useCallback(
    (id: ConnectorId): ConnectorVerdict | null => entitlements?.[id] ?? null,
    [entitlements]
  );

  /** True when ANY Zoho connector is paused right now (used for chat banners). */
  const hasPausedZoho = useMemo(() => {
    if (!effectiveConnectors) return false;
    return (["zoho.crm", "zoho.projects", "zoho.books"] as ConnectorId[]).some((id) => effectiveConnectors[id] === false);
  }, [effectiveConnectors]);

  /** True when any connector is paused (used for chat banners). */
  const hasPausedAny = useMemo(() => {
    if (!effectiveConnectors) return false;
    return (Object.keys(effectiveConnectors) as ConnectorId[]).some((id) => effectiveConnectors[id] === false);
  }, [effectiveConnectors]);

  /** Ids of currently-paused connectors (for pause pills on status cards). */
  const pausedConnectorIds = useMemo<ConnectorId[]>(() => {
    if (!effectiveConnectors) return [];
    return (Object.keys(effectiveConnectors) as ConnectorId[]).filter((id) => effectiveConnectors[id] === false);
  }, [effectiveConnectors]);

  /** Forces a live provider re-probe (post-login health check / "Re-check access"). */
  const recheckEntitlements = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/tenant/entitlements?recheck=1");
      if (res.ok) {
        const data = await res.json();
        if (data.connectors) applyEntitlements(data.connectors as Record<ConnectorId, ConnectorVerdict>);
      }
      const statusRes = await fetch("/api/tenant/status");
      if (statusRes.ok) {
        setServerStatus(await statusRes.json());
        setStatusError(false);
      }
      setLastCheckedAt(new Date());
    } catch (err) {
      console.warn("Failed to re-check entitlements:", err);
      setStatusError(true);
    } finally {
      setIsSyncing(false);
    }
  }, [applyEntitlements]);

  return {
    /** Null until the first live fetch lands, render skeletons, not defaults. */
    activeConnectors: effectiveConnectors,
    /** True while the very first live sync is in flight (skeleton state). */
    isSyncing,
    serverStatus,
    entitlements,
    statusError,
    lastCheckedAt,
    /** Ids with an in-flight preference save (toggle spinner state). */
    connectorIdsLoading,
    /** The connector whose last preference save failed (error banner). */
    prefSaveError,
    clearPrefSaveError: useCallback(() => setPrefSaveError(null), []),
    syncStatus,
    toggleConnector,
    isConnectorEnabled,
    access,
    entitlementFor,
    recheckEntitlements,
    hasPausedAny,
    hasPausedZoho,
    pausedConnectorIds,
  };
}
