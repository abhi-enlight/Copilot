"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

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
  zoho?: Record<
    string,
    {
      connected: boolean;
      access: ConnectorAccess;
      reason: string;
      accountEmail?: string | null;
      accountName?: string | null;
    }
  >;
  zohoAccountEmail?: string | null;
  zohoAccountName?: string | null;
}

const DEFAULT_CONNECTORS: Record<ConnectorId, boolean> = {
  "microsoft.outlook": true,
  "microsoft.sharepoint": true,
  "microsoft.dynamics": false,
  "zoho.crm": true,
  "zoho.projects": true,
  "zoho.books": true,
  "internal.kb": true,
};

export const PAUSED_PILL_LABELS: Record<ConnectorId, string> = {
  "microsoft.outlook": "Outlook Mail",
  "microsoft.sharepoint": "SharePoint & OneDrive",
  "microsoft.dynamics": "Dynamics 365",
  "zoho.crm": "Zoho CRM",
  "zoho.projects": "Zoho Projects",
  "zoho.books": "Zoho Books",
  "internal.kb": "Knowledge Base",
};

export interface ConnectorContextValue {
  activeConnectors: Record<ConnectorId, boolean> | null;
  connectorIdsLoading: Set<ConnectorId>;
  prefSaveError: ConnectorId | null;
  serverStatus: ServerTenantStatus | null;
  entitlements: Record<ConnectorId, ConnectorVerdict> | null;
  isSyncing: boolean;
  statusError: boolean;
  lastCheckedAt: Date | null;
  hasPausedAny: boolean;
  pausedConnectorIds: ConnectorId[];
  syncStatus: (opts?: { keepToggles?: boolean }) => Promise<void>;
  toggleConnector: (id: ConnectorId, overrideValue?: boolean) => Promise<void>;
  access: (id: ConnectorId) => ConnectorAccess | null;
  entitlementFor: (id: ConnectorId) => ConnectorVerdict | null;
  recheckEntitlements: () => Promise<Record<ConnectorId, ConnectorVerdict> | null>;
  clearPrefSaveError: () => void;
}

const ConnectorContext = createContext<ConnectorContextValue | null>(null);

export function ConnectorProvider({ children }: { children: ReactNode }) {
  const [activeConnectors, setActiveConnectors] = useState<Record<ConnectorId, boolean> | null>(null);
  const [connectorIdsLoading, setConnectorIdsLoading] = useState<Set<ConnectorId>>(new Set());
  const [prefSaveError, setPrefSaveError] = useState<ConnectorId | null>(null);

  const [serverStatus, setServerStatus] = useState<ServerTenantStatus | null>(null);
  const [entitlements, setEntitlements] = useState<Record<ConnectorId, ConnectorVerdict> | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);
  const [statusError, setStatusError] = useState<boolean>(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const hasSyncedOnceRef = useRef(false);
  const prefSaveInFlightRef = useRef(false);

  const syncStatus = useCallback(async (opts: { keepToggles?: boolean } = {}) => {
    await Promise.resolve();
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
        if (data.connectors) setEntitlements(data.connectors as Record<ConnectorId, ConnectorVerdict>);
        anyOk = true;
      }

      if (prefRes.ok) {
        const data = await prefRes.json();
        const prefs = (data.preferences || {}) as Record<string, boolean>;
        setActiveConnectors((prev) => {
          if (!prev || !opts.keepToggles) {
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
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initialFetch() {
      try {
        const [statusRes, entRes, prefRes] = await Promise.all([
          fetch("/api/tenant/status"),
          fetch("/api/tenant/entitlements"),
          fetch("/api/connectors/preferences"),
        ]);
        if (!isMounted) return;

        let anyOk = false;
        if (statusRes.ok) {
          setServerStatus(await statusRes.json());
          setStatusError(false);
          anyOk = true;
        }

        if (entRes.ok) {
          const data = await entRes.json();
          if (data.connectors) setEntitlements(data.connectors as Record<ConnectorId, ConnectorVerdict>);
          anyOk = true;
        }

        if (prefRes.ok) {
          const data = await prefRes.json();
          const prefs = (data.preferences || {}) as Record<string, boolean>;
          setActiveConnectors(() => {
            const merged = { ...DEFAULT_CONNECTORS } as Record<ConnectorId, boolean>;
            for (const key of Object.keys(merged) as ConnectorId[]) {
              if (key in prefs) merged[key] = prefs[key] !== false;
            }
            return merged;
          });
          anyOk = true;
        }

        if (!anyOk) setStatusError(true);
        setLastCheckedAt(new Date());
      } catch (err) {
        if (isMounted) {
          console.warn("Failed to sync tenant status:", err);
          setStatusError(true);
        }
      } finally {
        if (isMounted) {
          setIsSyncing(false);
          hasSyncedOnceRef.current = true;
        }
      }
    }

    void initialFetch();
    return () => {
      isMounted = false;
    };
  }, []);

  const toggleConnector = useCallback(
    async (id: ConnectorId, overrideValue?: boolean) => {
      setPrefSaveError(null);
      let targetValue = false;

      setActiveConnectors((prev) => {
        if (!prev) return prev;
        targetValue = overrideValue !== undefined ? overrideValue : !prev[id];
        return { ...prev, [id]: targetValue };
      });

      setConnectorIdsLoading((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      try {
        prefSaveInFlightRef.current = true;
        const res = await fetch("/api/connectors/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectorId: id, enabled: targetValue }),
        });

        if (!res.ok) {
          setActiveConnectors((prev) => (prev ? { ...prev, [id]: !targetValue } : prev));
          setPrefSaveError(id);
        }
      } catch {
        setActiveConnectors((prev) => (prev ? { ...prev, [id]: !targetValue } : prev));
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
    []
  );

  const entitlementFor = useCallback(
    (id: ConnectorId): ConnectorVerdict | null => {
      return entitlements?.[id] ?? null;
    },
    [entitlements]
  );

  const access = useCallback(
    (id: ConnectorId): ConnectorAccess | null => {
      const v = entitlementFor(id);
      if (!v) return null;
      return v.access;
    },
    [entitlementFor]
  );

  const recheckEntitlements = useCallback(async (): Promise<Record<ConnectorId, ConnectorVerdict> | null> => {
    try {
      const res = await fetch("/api/tenant/entitlements?forceProbe=1");
      if (res.ok) {
        const data = await res.json();
        if (data.connectors) {
          setEntitlements(data.connectors as Record<ConnectorId, ConnectorVerdict>);
          void syncStatus({ keepToggles: true });
          return data.connectors;
        }
      }
    } catch {}
    return entitlements;
  }, [entitlements, syncStatus]);

  const clearPrefSaveError = useCallback(() => setPrefSaveError(null), []);

  const pausedConnectorIds = useMemo(() => {
    if (!activeConnectors) return [];
    return (Object.keys(activeConnectors) as ConnectorId[]).filter((key) => activeConnectors[key] === false);
  }, [activeConnectors]);

  const hasPausedAny = pausedConnectorIds.length > 0;

  const value = useMemo(
    () => ({
      activeConnectors,
      connectorIdsLoading,
      prefSaveError,
      serverStatus,
      entitlements,
      isSyncing,
      statusError,
      lastCheckedAt,
      hasPausedAny,
      pausedConnectorIds,
      syncStatus,
      toggleConnector,
      access,
      entitlementFor,
      recheckEntitlements,
      clearPrefSaveError,
    }),
    [
      activeConnectors,
      connectorIdsLoading,
      prefSaveError,
      serverStatus,
      entitlements,
      isSyncing,
      statusError,
      lastCheckedAt,
      hasPausedAny,
      pausedConnectorIds,
      syncStatus,
      toggleConnector,
      access,
      entitlementFor,
      recheckEntitlements,
      clearPrefSaveError,
    ]
  );

  return <ConnectorContext.Provider value={value}>{children}</ConnectorContext.Provider>;
}

export function useConnectorContext(): ConnectorContextValue {
  const ctx = useContext(ConnectorContext);
  if (!ctx) {
    throw new Error("useConnectorContext must be used within a <ConnectorProvider>");
  }
  return ctx;
}
