"use client";

import { useState, useEffect, useRef, type ComponentType } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  House,
  Robot,
  Megaphone,
  PlugsConnected,
  Users,
  SidebarSimple,
  Buildings,
  X,
  Plus,
  SignOut,
  CaretUpDown,
  Check,
  ChatCircle,
  Trash,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import PrismLogo from "@/components/brand/PrismLogo";
import { useAuth, type Organization } from "@/components/providers/AuthProvider";

export type NavView =
  | "home"
  | "copilot"
  | "campaigns"
  | "connections"
  | "users"
  | "settings"
  | "inbox"
  | "documents";

interface NavItem {
  id: NavView;
  label: string;
  icon: ComponentType<any>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { id: "home", label: "Home", icon: House },
      { id: "copilot", label: "Copilot", icon: Robot },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "campaigns", label: "Campaigns", icon: Megaphone },
      { id: "connections", label: "Connections", icon: PlugsConnected },
    ],
  },
  {
    label: "Administration",
    items: [
      { id: "users", label: "Users & Roles", icon: Users },
    ],
  },
];

export const NAV_LABELS: Record<NavView, string> = {
  home: "Home",
  copilot: "Copilot",
  campaigns: "Campaigns",
  connections: "Connections",
  users: "Users & Roles",
  settings: "Settings",
  inbox: "Inbox",
  documents: "Documents",
};

interface ChatSessionItem {
  id: string;
  title: string | null;
  updated_at: string;
}

interface PrismSidebarProps {
  currentView: NavView;
  onViewChange: (view: NavView) => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  campaignCount?: number;
  activeSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
  onNewChat?: () => void;
  onDeleteSession?: (sessionId: string) => void;
}

export default function PrismSidebar({
  currentView,
  onViewChange,
  isMobileOpen,
  onMobileClose,
  campaignCount = 0,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
}: PrismSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const collapsed = isCollapsed;

  const { user, profile, activeOrg, userOrgs, switchOrg, signOut, refreshOrgs } = useAuth();

  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [showNewOrgModal, setShowNewOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [orgCreateError, setOrgCreateError] = useState("");

  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sessionRefreshKey, setSessionRefreshKey] = useState(0);

  const orgDropdownRef = useRef<HTMLDivElement>(null);

  // Close org dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(e.target as Node)) {
        setIsOrgDropdownOpen(false);
      }
    };
    if (isOrgDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOrgDropdownOpen]);

  // Fetch recent chat sessions for the current user and active org
  useEffect(() => {
    if (!user) {
      setSessions([]);
      return;
    }
    let cancelled = false;
    const fetchSessions = async () => {
      setLoadingSessions(true);
      try {
        const headers: Record<string, string> = {};
        if (activeOrg?.id) headers["x-active-org-id"] = activeOrg.id;
        const res = await fetch("/api/chat/sessions", { headers });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setSessions(data.sessions ?? []);
        }
      } catch {
        // silent fallback
      } finally {
        if (!cancelled) setLoadingSessions(false);
      }
    };
    fetchSessions();
    return () => {
      cancelled = true;
    };
  }, [user?.id, activeOrg?.id, activeSessionId, sessionRefreshKey]);

  // Listen for global session update/delete events across views
  useEffect(() => {
    const handleUpdate = () => setSessionRefreshKey((k) => k + 1);
    const handleDeleted = (e: Event) => {
      const custom = e as CustomEvent<{ sessionId: string }>;
      if (custom.detail?.sessionId) {
        setSessions((prev) => prev.filter((s) => s.id !== custom.detail.sessionId));
      } else {
        setSessionRefreshKey((k) => k + 1);
      }
    };
    window.addEventListener("prism:session-updated", handleUpdate);
    window.addEventListener("prism:session-deleted", handleDeleted);
    return () => {
      window.removeEventListener("prism:session-updated", handleUpdate);
      window.removeEventListener("prism:session-deleted", handleDeleted);
    };
  }, []);

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setDeletingId(id);
    try {
      // Optimistically remove from list
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setConfirmDeleteId(null);

      const headers: Record<string, string> = {};
      if (activeOrg?.id) headers["x-active-org-id"] = activeOrg.id;

      const res = await fetch(`/api/chat/sessions/${id}`, {
        method: "DELETE",
        headers,
      });

      if (!res.ok) {
        // Fallback to messages route DELETE
        await fetch(`/api/chat/sessions/${id}/messages`, {
          method: "DELETE",
          headers,
        });
      }

      onDeleteSession?.(id);
      window.dispatchEvent(new CustomEvent("prism:session-deleted", { detail: { sessionId: id } }));

      // If active session was deleted, start new chat
      if (activeSessionId === id) {
        onNewChat?.();
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
      setSessionRefreshKey((k) => k + 1);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setIsCreatingOrg(true);
    setOrgCreateError("");
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || "Failed to create organization");
      }
      await refreshOrgs();
      if (data.org?.id) {
        switchOrg(data.org.id);
      }
      setNewOrgName("");
      setShowNewOrgModal(false);
      setIsOrgDropdownOpen(false);
    } catch (err: unknown) {
      setOrgCreateError((err as Error)?.message || "Failed to create organization");
    } finally {
      setIsCreatingOrg(false);
    }
  };

  const getUserInitials = () => {
    if (profile?.displayName) {
      const parts = profile.displayName.trim().split(" ");
      if (parts.length > 1) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return profile.displayName.slice(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onMobileClose}
            className="fixed inset-0 bg-stone-900/35 backdrop-blur-xs z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Create Org Modal */}
      <AnimatePresence>
        {showNewOrgModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-xs p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-stone-200"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-stone-900">Create New Organization</h3>
                <button
                  type="button"
                  onClick={() => setShowNewOrgModal(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>
              <form onSubmit={handleCreateOrg} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="e.g. Acme Corp or Marketing"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                </div>
                {orgCreateError && (
                  <div className="text-xs text-rose-600 font-medium">{orgCreateError}</div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewOrgModal(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingOrg || !newOrgName.trim()}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-amber-700 rounded-lg disabled:opacity-50"
                  >
                    {isCreatingOrg ? "Creating…" : "Create"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 bg-white border-r border-stone-200/80 flex flex-col transition-[width,transform] duration-200 ease-out select-none ${
          collapsed ? "w-[62px]" : "w-[220px]"
        } ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Brand header */}
        <div
          className={`h-[60px] flex items-center flex-shrink-0 ${
            collapsed ? "justify-center px-0" : "justify-between px-4"
          }`}
        >
          {collapsed ? (
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="p-1.5 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
              title="Expand sidebar — Prism by Enlight Lab"
            >
              <PrismLogo size={30} variant="tile" />
            </button>
          ) : (
            <div className="flex items-center justify-between w-full min-w-0">
              <button
                type="button"
                onClick={() => onViewChange("home")}
                className="flex items-center gap-2.5 min-w-0 flex-1 group text-left cursor-pointer"
                title="Prism — by Enlight Lab"
              >
                <PrismLogo
                  size={32}
                  variant="tile"
                  className="shrink-0"
                />

                <div className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold tracking-tight text-stone-900 leading-tight truncate">
                    Prism
                  </span>
                  <div className="flex items-center gap-1 leading-tight mt-0.5">
                    <span className="text-[10px] text-stone-400 font-medium">by</span>
                    <span className="text-[10px] font-semibold text-violet-600 tracking-tight">
                      Enlight Lab
                    </span>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                className="hidden lg:flex p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors flex-shrink-0 cursor-pointer"
                title="Collapse sidebar"
              >
                <SidebarSimple size={14} weight="bold" />
              </button>
            </div>
          )}
        </div>

        {/* Mobile close */}
        {isMobileOpen && (
          <div className="lg:hidden absolute top-3.5 right-3 z-10">
            <button
              type="button"
              onClick={onMobileClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer"
              aria-label="Close navigation"
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        )}

        {/* Navigation items */}
        <nav className="flex-1 px-2 py-2 space-y-5 overflow-y-auto prism-scroll">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <div className="px-2.5 pb-1.5 text-[9.5px] font-bold uppercase tracking-[0.15em] text-stone-400">
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  const showBadge = item.id === "campaigns";
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onViewChange(item.id);
                        onMobileClose();
                      }}
                      title={item.label}
                      aria-current={isActive ? "page" : undefined}
                      className={`prism-sidebar-link relative w-full flex items-center gap-2.5 rounded-xl text-left group cursor-pointer ${
                        collapsed ? "justify-center px-0 py-2.5" : "px-2.5 py-2"
                      } ${
                        isActive
                          ? "bg-stone-100 text-stone-900 font-semibold shadow-2xs"
                          : "text-stone-600 hover:text-stone-900 hover:bg-stone-100/70 font-medium"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="prism-active-bar"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-full bg-violet-600"
                        />
                      )}
                      <Icon
                        size={16}
                        weight={isActive ? "fill" : "bold"}
                        className={`flex-shrink-0 ${
                          isActive
                            ? "text-violet-600"
                            : "text-stone-400 group-hover:text-stone-600"
                        }`}
                      />
                      {!collapsed && (
                        <span className="min-w-0 flex-1 flex items-center justify-between gap-2">
                          <span className="text-[12.5px] truncate">{item.label}</span>
                          {showBadge && campaignCount > 0 && (
                            <span
                              className={`text-[9.5px] font-mono font-bold px-1.5 py-px rounded-full flex-shrink-0 ${
                                isActive
                                  ? "bg-violet-100 text-violet-700"
                                  : "bg-stone-200/60 text-stone-600"
                              }`}
                            >
                              {campaignCount}
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Recent Chat Sessions */}
          {!collapsed && sessions.length > 0 && (
            <div className="pt-2 border-t border-stone-200/70">
              <div className="flex items-center justify-between px-2.5 pb-1.5">
                <span className="text-[9.5px] font-bold uppercase tracking-[0.15em] text-stone-400">
                  Recent Chats
                </span>
                {onNewChat && (
                  <button
                    type="button"
                    onClick={() => {
                      onViewChange("copilot");
                      onNewChat();
                    }}
                    className="text-[10px] text-stone-400 hover:text-stone-700 flex items-center gap-0.5 font-medium cursor-pointer transition-colors"
                    title="Start fresh conversation"
                  >
                    <Plus size={10} weight="bold" />
                    <span>New</span>
                  </button>
                )}
              </div>
              <div className="space-y-0.5">
                {sessions.slice(0, 8).map((s) => {
                  const isSessionActive = activeSessionId === s.id && currentView === "copilot";
                  const isConfirming = confirmDeleteId === s.id;
                  const isDeleting = deletingId === s.id;

                  return (
                    <div
                      key={s.id}
                      className={`group relative flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition ${
                        isSessionActive
                          ? "bg-stone-100 text-stone-900 font-medium"
                          : "text-stone-500 hover:text-stone-900 hover:bg-stone-100/70"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (isConfirming) {
                            setConfirmDeleteId(null);
                            return;
                          }
                          onViewChange("copilot");
                          onSelectSession?.(s.id);
                          onMobileClose();
                        }}
                        className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer"
                        title={s.title || "Conversation"}
                      >
                        <ChatCircle size={12} className="shrink-0 text-stone-400" />
                        <span className="truncate text-[12px]">{s.title || "Untitled Chat"}</span>
                      </button>

                      {/* Delete Action / Inline Confirmation */}
                      {isConfirming ? (
                        <div
                          className="flex items-center gap-0.5 shrink-0 ml-1.5 z-10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[10px] text-rose-600 font-medium select-none mr-0.5">Delete?</span>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSession(e, s.id)}
                            disabled={isDeleting}
                            className="p-1 rounded text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition cursor-pointer"
                            title="Confirm delete"
                            aria-label="Confirm delete"
                          >
                            {isDeleting ? (
                              <ArrowsClockwise size={11} className="animate-spin" />
                            ) : (
                              <Check size={11} weight="bold" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(null);
                            }}
                            className="p-1 rounded text-stone-400 hover:bg-stone-200 hover:text-stone-700 transition cursor-pointer"
                            title="Cancel"
                            aria-label="Cancel"
                          >
                            <X size={11} weight="bold" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(s.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded hover:bg-stone-200/80 text-stone-400 hover:text-rose-600 transition cursor-pointer shrink-0 ml-1"
                          title="Delete chat"
                          aria-label={`Delete ${s.title || "chat"}`}
                        >
                          <Trash size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        {/* Footer: User profile & Org Switcher */}
        <div className="p-2.5 border-t border-stone-200/70 relative" ref={orgDropdownRef}>
          {/* Org & User Dropdown */}
          <AnimatePresence>
            {isOrgDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.14 }}
                className={`absolute bottom-[calc(100%+6px)] bg-white rounded-xl border border-stone-200/90 shadow-xl z-50 overflow-hidden ${
                  collapsed ? "left-2 w-56" : "left-2 right-2"
                }`}
              >
                <div className="p-2 border-b border-stone-100">
                  <div className="text-[9.5px] font-bold uppercase tracking-wider text-stone-400 px-2 pb-1">
                    Organizations
                  </div>
                  <div className="space-y-0.5 max-h-44 overflow-y-auto prism-scroll">
                    {userOrgs.map((org) => {
                      const isCurrent = activeOrg?.id === org.id;
                      return (
                        <button
                          key={org.id}
                          type="button"
                          onClick={() => {
                            switchOrg(org.id);
                            setIsOrgDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left cursor-pointer ${
                            isCurrent
                              ? "bg-stone-100 font-semibold text-stone-900"
                              : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                          }`}
                        >
                          <div className="truncate">
                            <span className="block truncate">{org.name}</span>
                            <span className="text-[9.5px] text-stone-400 capitalize">
                              {org.ownerRole || org.type}
                            </span>
                          </div>
                          {isCurrent && <Check size={12} weight="bold" className="text-violet-600 shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsOrgDropdownOpen(false);
                      setShowNewOrgModal(true);
                    }}
                    className="w-full mt-1.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-violet-600 hover:bg-violet-50 transition cursor-pointer"
                  >
                    <Plus size={12} weight="bold" />
                    <span>Create Organization</span>
                  </button>
                </div>

                {/* User details & Sign out */}
                <div className="p-2">
                  <div className="px-2 py-1 mb-1">
                    <div className="text-xs font-semibold text-stone-900 truncate">
                      {profile?.displayName || user?.email?.split("@")[0] || "User"}
                    </div>
                    <div className="text-[10.5px] text-stone-400 truncate">{user?.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      signOut().then(() => {
                        window.location.href = "/auth/login";
                      });
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  >
                    <SignOut size={13} weight="bold" />
                    <span>Sign out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Trigger button */}
          <button
            type="button"
            onClick={() => setIsOrgDropdownOpen((prev) => !prev)}
            className={`w-full flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-stone-100/80 transition text-left cursor-pointer ${
              collapsed ? "justify-center" : ""
            }`}
            title={`${activeOrg?.name || "Workspace"} (${user?.email || ""})`}
          >
            {/* User avatar */}
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0 shadow-2xs">
              {getUserInitials()}
            </div>

            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <span className="block text-[12px] font-semibold text-stone-800 truncate">
                    {activeOrg?.name || "Personal Workspace"}
                  </span>
                  <div className="text-[10px] text-stone-400 truncate mt-px">
                    {user?.email || "Signed in"}
                  </div>
                </div>
                <CaretUpDown size={13} className="text-stone-400 shrink-0" />
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
