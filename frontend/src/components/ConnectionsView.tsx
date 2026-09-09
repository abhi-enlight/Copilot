"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  EnvelopeSimple,
  FolderOpen,
  Briefcase,
  Kanban,
  Receipt,
  Database,
  CheckCircle,
  ArrowsClockwise,
  ArrowSquareOut,
  WarningCircle,
  User,
  Buildings,
  LockKey,
  ShieldCheck,
  PauseCircle,
} from "@phosphor-icons/react";
import { useConnectors, type ConnectorId, type ConnectorAccess } from "@/hooks/useConnectors";
import NoAccessModal from "./NoAccessModal";
import AdminApprovalModal from "./AdminApprovalModal";
import { AnimatedErrorBanner } from "@/components/ui/ErrorInlineBanner";

export default function ConnectionsView() {
  const {
    activeConnectors,
    serverStatus,
    isSyncing,
    statusError,
    syncStatus,
    toggleConnector,
    access,
    entitlementFor,
    recheckEntitlements,
    connectorIdsLoading,
    prefSaveError,
    clearPrefSaveError,
    hasPausedAny,
  } = useConnectors();

  const [isPingingAll, setIsPingingAll] = useState(false);
  const [pingNotice, setPingNotice] = useState<string | null>(null);
  const [dealCount, setDealCount] = useState<number | null>(null);
  const [noAccessFor, setNoAccessFor] = useState<ConnectorId | null>(null);
  const [isRechecking, setIsRechecking] = useState(false);
  // Error state for disconnect failures, shown as banners instead of being swallowed
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<{ title: string; description: string } | null>(null);
  const [isAdminApprovalModalOpen, setIsAdminApprovalModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const zohoErr = params.get("zoho_error");
    const adminApproval = params.get("m365_admin_approval") === "1";
    const consentGranted = params.get("admin_consent_granted") === "1";

    // Consume the params first, then apply the derived state in an async
    // continuation (keeps the effect body free of synchronous setState).
    if (zohoErr) {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("zoho_error");
      window.history.replaceState(null, "", nextUrl.toString());
    }
    if (adminApproval) {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("m365_admin_approval");
      window.history.replaceState(null, "", nextUrl.toString());
    }
    if (consentGranted) {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("admin_consent_granted");
      window.history.replaceState(null, "", nextUrl.toString());
    }

    const apply = async () => {
      if (zohoErr) {
        if (zohoErr === "zoho_not_configured") {
          setOauthError({
            title: "Zoho OAuth Not Configured",
            description: "ZOHO_CLIENT_SECRET is missing in .env.local. Please copy your Client Secret from Zoho API Console into .env.local to enable connecting.",
          });
        } else {
          setOauthError({
            title: "Zoho Connection Failed",
            description: `Zoho error: ${zohoErr.replace(/_/g, " ")}. Please verify your credentials in Zoho API Console.`,
          });
        }
      }
      if (adminApproval) setIsAdminApprovalModalOpen(true);
      if (consentGranted) {
        setPingNotice("Microsoft tenant admin consent granted! Organization accounts can now connect.");
        setTimeout(() => setPingNotice(null), 6000);
      }
    };
    void apply();
  }, []);

  useEffect(() => {
    fetch("/api/campaigns")
      .then((res) => (res.ok ? res.json() : { campaigns: [] }))
      .then((data) => {
        if (Array.isArray(data.campaigns)) {
          setDealCount(data.campaigns.length);
        }
      })
      .catch(() => {});
  }, []);

  const handleTestAll = async () => {
    setIsPingingAll(true);
    await recheckEntitlements();
    setIsPingingAll(false);
    setPingNotice("All enabled connections verified against live provider checks");
    setTimeout(() => setPingNotice(null), 4000);
  };

  const handleRecheck = async () => {
    setIsRechecking(true);
    await recheckEntitlements();
    setIsRechecking(false);
  };

  const handleDisconnectMicrosoft = async () => {
    setDisconnectError(null);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) {
        setDisconnectError("Couldn't disconnect Microsoft. Please try again, or clear your session cookies.");
        return;
      }
      await syncStatus();
    } catch {
      setDisconnectError("Couldn't disconnect Microsoft. Please try again, or clear your session cookies.");
    }
  };

  const handleDisconnectZoho = async (product?: string) => {
    setDisconnectError(null);
    try {
      const res = await fetch("/api/integrations/zoho/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product ? { product } : {}),
      });
      if (!res.ok) {
        setDisconnectError("Couldn't disconnect from Zoho. You may need to revoke access directly in your Zoho account settings.");
        return;
      }
      if (product) {
        void toggleConnector(`zoho.${product}` as ConnectorId, false);
      } else {
        void toggleConnector("zoho.crm", false);
        void toggleConnector("zoho.projects", false);
        void toggleConnector("zoho.books", false);
      }
      await syncStatus();
    } catch {
      setDisconnectError("Couldn't disconnect from Zoho. You may need to revoke access directly in your Zoho account settings.");
    }
  };

  /**
   * Guard for toggle/connect clicks: locked connectors open the
   * "You don't have access to the CRM." popup instead of toggling.
   */
  const guardToggle = (id: ConnectorId) => {
    const accessState = access(id);
    // While the first live sync is in flight, access is unknown, do nothing
    // rather than acting on fabricated state.
    if (accessState === null) return;
    if (accessState !== "granted") {
      setNoAccessFor(id);
      return;
    }
    void toggleConnector(id);
  };

  const guardConnect = (id: ConnectorId) => {
    const accessState = access(id);
    if (accessState === "locked") {
      setNoAccessFor(id);
      return;
    }
    // not_connected → allow navigation to OAuth (handled via href)
  };

  // ── Loading gate: never render connector state before live data exists ──
  const isInitialLoading = isSyncing && (!activeConnectors || !serverStatus);

  // Status flags from live server check
  const isM365Authed = Boolean(serverStatus?.authenticated);
  const userEmail = serverStatus?.userEmail || "";
  const isOutlookLive = isM365Authed && Boolean(serverStatus?.outlookConnected);
  const isOneDriveLive = isM365Authed && Boolean(serverStatus?.onedriveConnected);
  const isCrmLive = isM365Authed && access("microsoft.dynamics") === "granted" && Boolean(serverStatus?.crmConnected);

  // Real Zoho state from the entitlements engine (per-user connections)
  const zohoAccess = (product: "zoho.crm" | "zoho.projects" | "zoho.books"): ConnectorAccess =>
    access(product) ?? "not_connected";
  const zohoConnected = (product: "zoho.crm" | "zoho.projects" | "zoho.books"): boolean => {
    const key = product.replace("zoho.", "") as "crm" | "projects" | "books";
    return Boolean(serverStatus?.zoho?.[key]?.connected);
  };
  const crmLocked = access("microsoft.dynamics") === "locked";
  const zohoCrmLocked = zohoAccess("zoho.crm") === "locked";

  // ── Reconnection-required detection (vault rows marked reauth_required) ──
  const zohoReauth: Array<{ product: "zoho.crm" | "zoho.projects" | "zoho.books"; label: string; href: string }> = [];
  (["crm", "projects", "books"] as const).forEach((key) => {
    const reason = serverStatus?.zoho?.[key]?.reason || "";
    if (serverStatus?.zoho?.[key]?.connected && /reauth|reconnect|refresh failed/i.test(reason)) {
      zohoReauth.push({
        product: `zoho.${key}` as "zoho.crm" | "zoho.projects" | "zoho.books",
        label: key === "crm" ? "Zoho CRM" : key === "projects" ? "Zoho Projects" : "Zoho Books",
        href: `/api/integrations/zoho/connect?product=${key}&returnTo=/`,
      });
    }
  });

  // Count active vs total (null while loading, skeleton shows instead)
  const totalConnectors = 7;
  const activeCount = activeConnectors ? Object.values(activeConnectors).filter(Boolean).length : 0;

  const noAccessReason = noAccessFor ? entitlementFor(noAccessFor)?.reason : undefined;
  const noAccessName =
    noAccessFor === "microsoft.dynamics"
      ? "Dynamics 365 CRM"
      : noAccessFor === "zoho.crm"
      ? "Zoho CRM"
      : noAccessFor;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAFAF9]">
      {/* Header */}
      <header className="h-14 border-b border-stone-200/70 bg-white/90 backdrop-blur-md px-6 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-bold text-stone-900 tracking-tight">Connections</h1>
          {activeConnectors ? (
            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {activeCount}/{totalConnectors} Active
            </span>
          ) : (
            <span className="inline-block h-4 w-20 rounded-full bg-stone-200 animate-pulse" />
          )}
          {isSyncing && (
            <span className="text-[11px] text-stone-400 flex items-center gap-1">
              <ArrowsClockwise size={11} className="animate-spin" /> Syncing…
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAdminApprovalModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-stone-300 text-stone-700 text-xs font-semibold shadow-2xs transition-all duration-150 cursor-pointer"
          >
            <ShieldCheck size={14} weight="bold" className="text-amber-600" />
            <span>M365 Admin Approval Help</span>
          </button>

          <button
            type="button"
            onClick={handleTestAll}
            disabled={isPingingAll || isInitialLoading}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-2xs transition-all duration-150 cursor-pointer disabled:opacity-50"
          >
            <ArrowsClockwise size={13} weight="bold" className={isPingingAll ? "animate-spin" : ""} />
            <span>{isPingingAll ? "Pinging…" : "Test Connections"}</span>
          </button>
        </div>
      </header>

      {/* Notice Toast */}
      <AnimatePresence>
        {pingNotice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-emerald-600 text-white text-xs font-medium px-6 py-2 flex items-center gap-2 flex-shrink-0"
          >
            <CheckCircle size={14} weight="fill" />
            <span>{pingNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status check unavailable */}
      <AnimatedErrorBanner
        show={statusError && !isSyncing}
        severity="warning"
        title="Connection status couldn't be verified"
        description="The health checks below may not reflect your actual access. This is a temporary issue on our end."
        action={{
          label: "Retry",
          onClick: recheckEntitlements,
          isLoading: isSyncing,
        }}
        onDismiss={() => { /* statusError auto-clears on next successful check */ }}
        className="mx-6 mt-3"
      />

      {/* Preference save failure, the toggle rolled back */}
      <AnimatedErrorBanner
        show={prefSaveError !== null}
        severity="error"
        title="Couldn't save the connection change"
        description="Your toggle was rolled back because the server didn't confirm the change. Please try again."
        action={{ label: "Retry sync", onClick: () => { clearPrefSaveError(); void syncStatus(); } }}
        onDismiss={clearPrefSaveError}
        className="mx-6 mt-3"
      />

      {/* Reconnection required, deep-link into the Zoho reconnect flow */}
      <AnimatedErrorBanner
        show={zohoReauth.length > 0}
        severity="warning"
        title="Reconnection required"
        description={`${zohoReauth.map((r) => r.label).join(", ")} lost authorization. Your Zoho token was revoked or expired. Reconnect to restore access.`}
        action={
          zohoReauth.length > 0
            ? { label: `Reconnect ${zohoReauth[0].label}`, onClick: () => { window.location.href = zohoReauth[0].href; } }
            : undefined
        }
        onDismiss={() => { /* re-derived from live status; dismisses once reconnected */ }}
        className="mx-6 mt-3"
      />

      {/* Paused-connections pointer (matches the chat paused banner) */}
      <AnimatedErrorBanner
        show={Boolean(activeConnectors) && hasPausedAny}
        severity="info"
        title="Some connections are paused"
        description="The Copilot and automations can't touch paused connections. Turn them back on here whenever you're ready."
        onDismiss={() => { /* informational only */ }}
        className="mx-6 mt-3"
      />

      {/* Disconnect error */}
      <AnimatedErrorBanner
        show={!!disconnectError}
        severity="error"
        title="Disconnect failed"
        description={disconnectError ?? ""}
        onDismiss={() => setDisconnectError(null)}
        className="mx-6 mt-3"
      />

      {/* OAuth Connection error */}
      <AnimatedErrorBanner
        show={!!oauthError}
        severity="error"
        title={oauthError?.title ?? "Connection failed"}
        description={oauthError?.description ?? ""}
        onDismiss={() => setOauthError(null)}
        className="mx-6 mt-3"
      />

      {/* Main Content Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 prism-scroll">
        {/* SECTION 1: Personal & Individual Connections */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <User size={16} weight="bold" className="text-violet-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Personal & User-Managed Connections
                </h2>
              </div>
              <p className="text-[11.5px] text-stone-400 mt-0.5">
                Authenticates with your own Microsoft and Zoho accounts. Minimal scopes, zero IT Admin approval required.
              </p>
            </div>
            {isM365Authed && (
              <span className="text-[11px] text-stone-500 font-mono bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200">
                {userEmail}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card: Microsoft Outlook Mail */}
            <ConnectorCard
              id="microsoft.outlook"
              name="Microsoft Outlook Mail"
              provider="Microsoft 365"
              description="Read recent emails, search conversations, and generate contextual reply drafts."
              icon={<EnvelopeSimple size={18} weight="duotone" className="text-sky-600" />}
              iconBg="bg-sky-50 border-sky-200"
              isLoading={isInitialLoading}
              isConnected={isOutlookLive}
              isEnabled={activeConnectors?.["microsoft.outlook"] ?? false}
              isToggling={connectorIdsLoading.has("microsoft.outlook")}
              accessState={access("microsoft.outlook")}
              onToggle={() => guardToggle("microsoft.outlook")}
              account={isOutlookLive ? userEmail : undefined}
              connectHref="/api/integrations/microsoft/connect?preset=mail&returnTo=/"
              onDisconnect={handleDisconnectMicrosoft}
              badges={["Mail.Read", "Personal & Org", "No Admin Required"]}
              metrics={[
                { label: "Inbox Mode", value: isOutlookLive ? "Live Graph" : "Disconnected" },
                { label: "Permissions", value: "Read (Delegated)" },
              ]}
            />

            {/* Card: Microsoft OneDrive & SharePoint */}
            <ConnectorCard
              id="microsoft.sharepoint"
              name="SharePoint & OneDrive"
              provider="Microsoft 365"
              description="Explore SharePoint document libraries, shared client briefs, and personal OneDrive folders with semantic Q&A."
              icon={<FolderOpen size={18} weight="duotone" className="text-blue-600" />}
              iconBg="bg-blue-50 border-blue-200"
              isLoading={isInitialLoading}
              isConnected={isOneDriveLive}
              isEnabled={activeConnectors?.["microsoft.sharepoint"] ?? false}
              isToggling={connectorIdsLoading.has("microsoft.sharepoint")}
              accessState={access("microsoft.sharepoint")}
              onToggle={() => guardToggle("microsoft.sharepoint")}
              account={isOneDriveLive ? (serverStatus?.sharepointDrive || "/me/drive") : undefined}
              connectHref="/api/integrations/microsoft/connect?preset=personal_files&returnTo=/"
              onDisconnect={handleDisconnectMicrosoft}
              badges={["Files.Read", "Personal & Shared", "No Admin Required"]}
              metrics={[
                { label: "Root Path", value: isOneDriveLive ? "/me/drive" : "Not mounted" },
                { label: "Permissions", value: "Read (Delegated)" },
              ]}
            />
          </div>
        </div>

        {/* SECTION 2: Organization & Enterprise Connections */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Buildings size={16} weight="bold" className="text-emerald-600" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Organization & Enterprise Connections
                </h2>
              </div>
              <p className="text-[11.5px] text-stone-400 mt-0.5">
                Gated by real provider permissions: Dynamics license + CRM role, or your own connected Zoho account.
              </p>
            </div>
            <span className="text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              Permission-Honest
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card: Zoho CRM, per-user connection, entitlement-gated */}
            <ConnectorCard
              id="zoho.crm"
              name="Zoho CRM"
              provider={zohoConnected("zoho.crm") ? "Your Zoho Account" : "Zoho Suite"}
              description="Fetch active deals, brand SPOCs, pipeline stages, and client briefs directly from CRM."
              icon={<Briefcase size={18} weight="duotone" className="text-emerald-600" />}
              iconBg="bg-emerald-50 border-emerald-200"
              isLoading={isInitialLoading}
              isConnected={zohoConnected("zoho.crm")}
              isEnabled={activeConnectors?.["zoho.crm"] ?? false}
              isToggling={connectorIdsLoading.has("zoho.crm")}
              accessState={zohoAccess("zoho.crm")}
              onToggle={() => guardToggle("zoho.crm")}
              connectHref="/api/integrations/zoho/connect?product=crm&returnTo=/"
              onConnectClick={() => guardConnect("zoho.crm")}
              onDisconnect={() => handleDisconnectZoho("crm")}
              badges={zohoCrmLocked ? ["License / Role Required", "OAuth 2.0"] : ["Your Own Org", "OAuth 2.0", "Read + Write"]}
              metrics={[
                { label: "Active Deals", value: zohoConnected("zoho.crm") ? (dealCount === null ? "…" : String(dealCount)) : "None yet" },
                { label: "Data Center", value: zohoConnected("zoho.crm") ? "Your Zoho" : "Not connected" },
              ]}
              requiresAdminNotice={
                zohoCrmLocked
                  ? entitlementFor("zoho.crm")?.reason ||
                    "Requires access to a Zoho CRM organization (your own account, or an admin-granted role)."
                  : undefined
              }
            />

            {/* Card: Zoho Projects */}
            <ConnectorCard
              id="zoho.projects"
              name="Zoho Projects"
              provider={zohoConnected("zoho.projects") ? "Your Zoho Account" : "Zoho Suite"}
              description="Sync 4-aspect campaign milestones, task assignees, and delivery TAT schedules."
              icon={<Kanban size={18} weight="duotone" className="text-emerald-600" />}
              iconBg="bg-emerald-50 border-emerald-200"
              isLoading={isInitialLoading}
              isConnected={zohoConnected("zoho.projects")}
              isEnabled={activeConnectors?.["zoho.projects"] ?? false}
              isToggling={connectorIdsLoading.has("zoho.projects")}
              accessState={zohoAccess("zoho.projects")}
              onToggle={() => guardToggle("zoho.projects")}
              connectHref="/api/integrations/zoho/connect?product=projects&returnTo=/"
              onConnectClick={() => guardConnect("zoho.projects")}
              onDisconnect={() => handleDisconnectZoho("projects")}
              badges={["Your Own Portal", "Projects API v3", "Read + Write"]}
              metrics={[
                { label: "Portal", value: zohoConnected("zoho.projects") ? "Your portal" : "Not connected" },
                { label: "Milestones", value: zohoConnected("zoho.projects") ? "4 Aspects" : "Not connected" },
              ]}
            />

            {/* Card: Zoho Books */}
            <ConnectorCard
              id="zoho.books"
              name="Zoho Books"
              provider={zohoConnected("zoho.books") ? "Your Zoho Account" : "Zoho Suite"}
              description="Verify 100% advance payments in escrow, generate GST invoices, and track TDS records."
              icon={<Receipt size={18} weight="duotone" className="text-emerald-600" />}
              iconBg="bg-emerald-50 border-emerald-200"
              isLoading={isInitialLoading}
              isConnected={zohoConnected("zoho.books")}
              isEnabled={activeConnectors?.["zoho.books"] ?? false}
              isToggling={connectorIdsLoading.has("zoho.books")}
              accessState={zohoAccess("zoho.books")}
              onToggle={() => guardToggle("zoho.books")}
              connectHref="/api/integrations/zoho/connect?product=books&returnTo=/"
              onConnectClick={() => guardConnect("zoho.books")}
              onDisconnect={() => handleDisconnectZoho("books")}
              badges={["Your Own Org", "Books v3", "Read + Write"]}
              metrics={[
                { label: "Module", value: zohoConnected("zoho.books") ? "Invoices & Escrow" : "Not connected" },
                { label: "Advance Gate", value: zohoConnected("zoho.books") ? "Active (100%)" : "Not connected" },
              ]}
            />

            {/* Card: Dynamics 365 CRM, hard entitlement lock */}
            <ConnectorCard
              id="microsoft.dynamics"
              name="Dynamics 365 CRM"
              provider="Microsoft Dataverse"
              description="Dataverse opportunities, pipeline accounts, and contacts for licensed CRM enterprise users."
              icon={<Briefcase size={18} weight="duotone" className="text-indigo-600" />}
              iconBg="bg-indigo-50 border-indigo-200"
              isLoading={isInitialLoading}
              isConnected={isCrmLive}
              isEnabled={activeConnectors?.["microsoft.dynamics"] ?? false}
              isToggling={connectorIdsLoading.has("microsoft.dynamics")}
              accessState={access("microsoft.dynamics")}
              onToggle={() => guardToggle("microsoft.dynamics")}
              connectHref="/api/integrations/microsoft/connect?preset=dynamics_crm&returnTo=/"
              onConnectClick={() => guardConnect("microsoft.dynamics")}
              badges={crmLocked ? ["Access Locked", "Dataverse API", "Role-Gated"] : ["Requires License", "Dataverse API", "Role-Gated"]}
              metrics={[
                { label: "License Status", value: isCrmLive ? "Active Role" : crmLocked ? "No CRM Entitlement" : "Unlicensed / Off" },
                { label: "Endpoint", value: isCrmLive ? (serverStatus?.dynamicsOrg || "Dataverse v9.2") : "Dataverse v9.2" },
              ]}
              requiresAdminNotice={
                crmLocked
                  ? `${entitlementFor("microsoft.dynamics")?.reason || "Requires a Dynamics 365 license and CRM security role."} Outlook, SharePoint & Zoho CRM remain accessible.`
                  : !isCrmLive
                  ? "Requires tenant admin consent or Dynamics CRM license in Entra ID. Outlook, SharePoint & Zoho are available without admin approval."
                  : undefined
              }
              onAdminApprovalClick={() => setIsAdminApprovalModalOpen(true)}
            />

            {/* Card: Internal Knowledge Base */}
            <ConnectorCard
              id="internal.kb"
              name="Knowledge Base"
              provider="Supabase pgvector"
              description="Semantic retrieval across company SOPs, precedent memos, legal guidelines, and contracts."
              icon={<Database size={18} weight="duotone" className="text-violet-600" />}
              iconBg="bg-violet-50 border-violet-200"
              isLoading={isInitialLoading}
              isConnected={true}
              isEnabled={activeConnectors?.["internal.kb"] ?? false}
              isToggling={connectorIdsLoading.has("internal.kb")}
              accessState={access("internal.kb")}
              onToggle={() => guardToggle("internal.kb")}
              badges={["pgvector RAG", "Gemini Embeddings", "Citations"]}
              metrics={[
                { label: "Vector Store", value: "documents" },
                { label: "Embeddings", value: "Gemini 768-dim" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* "You don't have access to the CRM." popup */}
      <NoAccessModal
        open={noAccessFor !== null}
        onClose={() => setNoAccessFor(null)}
        connectorName={noAccessName ?? undefined}
        reason={noAccessReason ?? undefined}
        onRecheck={handleRecheck}
        isRechecking={isRechecking}
        onFallback={noAccessFor === "microsoft.dynamics" ? () => setIsAdminApprovalModalOpen(true) : undefined}
      />

      {/* Microsoft IT Admin Approval & Self-Service Fallback Modal */}
      <AdminApprovalModal
        open={isAdminApprovalModalOpen}
        onClose={() => setIsAdminApprovalModalOpen(false)}
        onSwitchToZoho={() => {
          setIsAdminApprovalModalOpen(false);
          const zohoEl = document.getElementById("connector-card-zoho-crm");
          if (zohoEl) {
            zohoEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-Component: ConnectorCard with Interactive Animated Switch
// -----------------------------------------------------------------------------
interface ConnectorCardProps {
  id: ConnectorId;
  name: string;
  provider: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  /** True while the first live sync is in flight, renders a skeleton, no state. */
  isLoading?: boolean;
  isConnected: boolean;
  isEnabled: boolean;
  /** True while this card's pause preference is saving server-side. */
  isToggling?: boolean;
  accessState: ConnectorAccess | null;
  onToggle: () => void;
  account?: string;
  connectHref?: string;
  onConnectClick?: () => void;
  onDisconnect?: () => void;
  badges?: string[];
  metrics?: { label: string; value: string }[];
  requiresAdminNotice?: string;
  onAdminApprovalClick?: () => void;
}

function ConnectorCard({
  id,
  name,
  provider,
  description,
  icon,
  iconBg,
  isLoading = false,
  isConnected,
  isEnabled,
  isToggling = false,
  accessState,
  onToggle,
  account,
  connectHref,
  onConnectClick,
  onDisconnect,
  badges = [],
  metrics = [],
  requiresAdminNotice,
  onAdminApprovalClick,
}: ConnectorCardProps) {
  // ── Skeleton: identical footprint, zero fabricated state ──
  if (isLoading) {
    return (
      <div
        id={id ? `connector-card-${id.replace(/\./g, "-")}` : undefined}
        className="rounded-2xl border border-stone-200/70 bg-white p-4.5 animate-pulse flex flex-col justify-between min-h-[240px]"
        aria-hidden
      >
        <div>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${iconBg} opacity-60`}>
                {icon}
              </div>
              <div className="min-w-0 space-y-1.5">
                <div className="h-3.5 w-36 bg-stone-200 rounded" />
                <div className="h-2.5 w-24 bg-stone-100 rounded" />
              </div>
            </div>
            <div className="h-5 w-9 rounded-full bg-stone-200 flex-shrink-0" />
          </div>
          <div className="space-y-1.5 mb-3">
            <div className="h-2.5 w-full bg-stone-100 rounded" />
            <div className="h-2.5 w-4/5 bg-stone-100 rounded" />
          </div>
          <div className="flex gap-1.5 mb-3">
            <div className="h-4 w-16 bg-stone-100 rounded-md" />
            <div className="h-4 w-20 bg-stone-100 rounded-md" />
            <div className="h-4 w-14 bg-stone-100 rounded-md" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-10 bg-stone-50 rounded-lg border border-stone-100" />
            <div className="h-10 bg-stone-50 rounded-lg border border-stone-100" />
          </div>
        </div>
        <div className="pt-2.5 mt-3 border-t border-stone-100">
          <div className="h-7 w-full bg-stone-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const isLocked = accessState === "locked";
  const isOperating = isConnected && isEnabled;
  const isPaused = isConnected && !isEnabled;

  return (
    <div
      id={id ? `connector-card-${id.replace(/\./g, "-")}` : undefined}
      className={`rounded-2xl border p-4.5 transition-all duration-200 flex flex-col justify-between ${
        isLocked
          ? "bg-stone-100/80 border-stone-300 opacity-95"
          : isOperating
          ? "bg-white border-stone-200/90 shadow-2xs hover:border-stone-300"
          : isPaused
          ? "bg-stone-50/70 border-stone-200/60 opacity-80"
          : "bg-white border-dashed border-stone-300 hover:border-stone-400"
      }`}
    >
      {/* Top Bar: Icon, Name & Toggle */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${iconBg}`}>
              {icon}
            </div>
            <div className="min-w-0">
              <h3 className="text-[13.5px] font-bold text-stone-900 leading-tight truncate">{name}</h3>
              <span className="text-[10.5px] text-stone-400 font-medium block truncate">{provider}</span>
            </div>
          </div>

          {/* Interactive Toggle Switch */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                isLocked
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : isOperating
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : isPaused
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-stone-100 text-stone-500 border-stone-200"
              }`}
            >
              {isToggling ? "Saving…" : isLocked ? "No Access" : isOperating ? "Active" : isPaused ? "Paused" : "Off"}
            </span>

            {/* Accessible Animated Toggle, disabled when locked, spinner while saving */}
            <button
              type="button"
              role="switch"
              aria-checked={isEnabled}
              aria-disabled={isLocked}
              disabled={isLocked}
              onClick={onToggle}
              title={
                isLocked
                  ? "You don't have access to the CRM."
                  : isToggling
                  ? "Saving…"
                  : isEnabled
                  ? "Click to pause. The Copilot and automations will stop using this connection"
                  : "Click to enable for Copilot"
              }
              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isLocked
                  ? "bg-stone-300 cursor-not-allowed"
                  : isToggling
                  ? "bg-stone-400 cursor-wait"
                  : isEnabled
                  ? "bg-stone-900 cursor-pointer"
                  : "bg-stone-200 cursor-pointer"
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-flex items-center justify-center h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  isLocked || !isEnabled ? "translate-x-0" : "translate-x-4"
                }`}
              >
                {isToggling && (
                  <ArrowsClockwise size={9} weight="bold" className="animate-spin text-stone-500" />
                )}
              </span>
              {isLocked && !isToggling && (
                <LockKey size={9} weight="fill" className="absolute inset-0 m-auto text-stone-500" aria-hidden />
              )}
              {isPaused && !isToggling && (
                <PauseCircle size={9} weight="fill" className="absolute inset-0 m-auto text-amber-500" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {/* Description */}
        <p className="text-[11.5px] text-stone-500 leading-relaxed line-clamp-2 mt-1 mb-3">
          {description}
        </p>

        {/* Badges */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {badges.map((b, idx) => (
              <span
                key={idx}
                className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200/70"
              >
                {b}
              </span>
            ))}
          </div>
        )}

        {/* Paused explainer, the exact message requested for paused connections */}
        {isPaused && (
          <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-800 text-[11px] flex items-start gap-2 mb-3">
            <PauseCircle size={14} weight="fill" className="text-amber-600 flex-shrink-0 mt-0.5" />
            <span className="leading-snug flex-1">
              You have paused this connection. The Copilot and automations can&apos;t use it until you turn it back on.
            </span>
          </div>
        )}

        {/* Notice for requires admin */}
        {requiresAdminNotice && (
          <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-800 text-[11px] flex items-start gap-2 mb-3">
            <WarningCircle size={14} weight="fill" className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="leading-snug flex-1">
              <span>{requiresAdminNotice}</span>
              {onAdminApprovalClick && (
                <button
                  type="button"
                  onClick={onAdminApprovalClick}
                  className="mt-1.5 flex items-center gap-1 font-semibold text-amber-900 hover:text-amber-950 underline cursor-pointer"
                >
                  <ShieldCheck size={12} weight="bold" />
                  <span>Need IT admin approval or fallback?</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        {metrics.length > 0 && (
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            {metrics.map((m, mIdx) => (
              <div key={mIdx} className="bg-stone-50/90 border border-stone-100 rounded-lg p-2">
                <span className="text-[10px] text-stone-400 block">{m.label}</span>
                <span className="font-semibold text-stone-800 truncate block text-[11.5px]">{m.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Controls: Connect / Account / Disconnect */}
      <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between text-[11px]">
        {isConnected ? (
          <>
            <span className="text-stone-500 truncate font-mono text-[10.5px]">
              {account || "Connected & Authorized"}
            </span>
            {onDisconnect && (
              <button
                type="button"
                onClick={onDisconnect}
                className="text-rose-600 hover:text-rose-700 font-medium ml-2 cursor-pointer transition-colors"
              >
                Disconnect
              </button>
            )}
          </>
        ) : connectHref ? (
          isLocked ? (
            <button
              type="button"
              onClick={onConnectClick}
              className="w-full py-1.5 px-3 rounded-xl bg-stone-300 text-stone-600 font-semibold text-center flex items-center justify-center gap-1.5 cursor-not-allowed"
            >
              <LockKey size={12} weight="bold" />
              <span>Requires CRM Access</span>
            </button>
          ) : (
            <a
              href={connectHref}
              onClick={() => onConnectClick?.()}
              className="w-full py-1.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-center flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
            >
              <span>Connect Account</span>
              <ArrowSquareOut size={12} weight="bold" />
            </a>
          )
        ) : (
          <span className="text-stone-400">Available via Organization</span>
        )}
      </div>
    </div>
  );
}
