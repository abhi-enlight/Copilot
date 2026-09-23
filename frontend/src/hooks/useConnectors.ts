"use client";

import { useConnectorContext, ConnectorContextValue } from "@/providers/ConnectorProvider";

export type {
  ConnectorId,
  ConnectorAccess,
  ConnectorVerdict,
  ServerTenantStatus,
} from "@/providers/ConnectorProvider";

export { PAUSED_PILL_LABELS } from "@/providers/ConnectorProvider";

/**
 * Custom hook returning the shared ConnectorContext.
 * Guaranteed to return consistent, single-fetched status across all UI views.
 */
export function useConnectors(): ConnectorContextValue {
  return useConnectorContext();
}
