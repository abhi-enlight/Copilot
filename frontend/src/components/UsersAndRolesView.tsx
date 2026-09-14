"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AnimatedErrorBanner } from "@/components/ui/ErrorInlineBanner";
import { useAuth } from "@/components/providers/AuthProvider";
import { useOrganization, type OrgMember } from "@/hooks/useOrganization";
import {
  UserPlus,
  Crown,
  ShieldCheck,
  User,
  MagnifyingGlass,
  Check,
  X,
  CheckCircle,
  Trash,
  Info,
  CaretDown,
} from "@phosphor-icons/react";

export type RoleType = "owner" | "admin" | "member";

export interface BigCityUser {
  id: string;
  name: string;
  email: string;
  role: RoleType;
  department?: string;
  status: "active" | "invited" | "active_now";
  lastActive: string;
  initials: string;
  avatarColor: string;
}

const AVATAR_COLORS = [
  "from-violet-600 to-violet-800",
  "from-emerald-600 to-emerald-800",
  "from-amber-600 to-amber-800",
  "from-cyan-600 to-cyan-800",
  "from-teal-600 to-teal-800",
  "from-blue-600 to-blue-800",
  "from-stone-700 to-stone-900",
];

function getAvatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = (hash << 5) - hash + email.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getInitials(nameOrEmail: string): string {
  const clean = nameOrEmail.replace(/@.*/, "").trim();
  const parts = clean.split(/[ ._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase() || "U";
}

export default function UsersAndRolesView() {
  const { user: authUser } = useAuth();
  const {
    activeOrg,
    members,
    callerRole,
    isLoadingMembers,
    error: membersError,
    inviteMember,
    removeMember,
    refreshMembers,
  } = useOrganization();

  const [selectedRoleFilter, setSelectedRoleFilter] = useState<RoleType | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [activeRoleDropdownId, setActiveRoleDropdownId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Invite modal form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const isElevated = callerRole === "owner" || callerRole === "admin";

  const handleRoleChange = async (userId: string, newRole: RoleType) => {
    setActiveRoleDropdownId(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(activeOrg?.id ? { "x-active-org-id": activeOrg.id } : {}),
        },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.detail || data.error || "Role update failed");
        return;
      }

      await refreshMembers();
      showToast(`Role updated to ${newRole}`);
    } catch {
      showToast("Role update failed");
    }
  };

  const handleRevokeUser = async (userId: string, userEmail: string) => {
    if (userId === authUser?.id) {
      alert("You cannot remove yourself from the organization.");
      return;
    }

    if (confirm(`Remove ${userEmail} from ${activeOrg?.name || "this workspace"}?`)) {
      const res = await removeMember(userId);
      if (res.ok) {
        showToast(`Removed ${userEmail}`);
      } else {
        showToast(res.error || "Failed to remove member");
      }
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");

    const email = inviteEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError("Please enter a valid email address");
      return;
    }

    if (members.some((m) => m.email.toLowerCase() === email)) {
      setInviteError(`${email} is already a member of this workspace`);
      return;
    }

    setIsInviting(true);
    try {
      const res = await inviteMember(email, inviteRole);
      if (!res.ok) {
        setInviteError(res.error || "Failed to send invitation");
        return;
      }

      setIsInviteModalOpen(false);
      setInviteEmail("");
      setInviteRole("member");
      showToast(`Added ${email} as ${inviteRole}`);
    } catch (err: unknown) {
      setInviteError((err as Error)?.message || "Failed to invite member");
    } finally {
      setIsInviting(false);
    }
  };

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesRole = selectedRoleFilter === "All" || m.orgRole === selectedRoleFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        (m.displayName || "").toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q);
      return matchesRole && matchesQuery;
    });
  }, [members, selectedRoleFilter, searchQuery]);

  const counts = useMemo(
    () => ({
      all: members.length,
      owner: members.filter((m) => m.orgRole === "owner").length,
      admin: members.filter((m) => m.orgRole === "admin").length,
      member: members.filter((m) => m.orgRole === "member").length,
    }),
    [members]
  );

  const filterTabs = [
    { key: "All" as const, label: "All", count: counts.all },
    { key: "owner" as const, label: "Owners", count: counts.owner },
    { key: "admin" as const, label: "Admins", count: counts.admin },
    { key: "member" as const, label: "Members", count: counts.member },
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAFAF9]">
      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-semibold shadow-lg"
          >
            <CheckCircle size={14} weight="fill" className="text-emerald-400" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error banner */}
      <AnimatedErrorBanner
        show={Boolean(membersError || actionError)}
        severity="warning"
        title="Organization Member Notice"
        description={membersError || actionError || "Could not load complete member list."}
        action={{ label: "Retry", onClick: () => refreshMembers() }}
        onDismiss={() => setActionError(null)}
        className="mx-6 mt-3"
      />

      {/* Header */}
      <header className="h-14 border-b border-stone-200/70 bg-white/90 backdrop-blur-md px-6 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-bold text-stone-900 tracking-tight">
            Users & Roles
          </h1>
          {activeOrg?.name && (
            <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-2.5 py-0.5 rounded-md border border-stone-200">
              {activeOrg.name}
            </span>
          )}
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200">
            {counts.all} {counts.all === 1 ? "member" : "members"}
          </span>
        </div>

        {isElevated && (
          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-sm transition-all duration-200 cursor-pointer"
          >
            <UserPlus size={14} weight="bold" />
            <span>Invite Member</span>
          </button>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Filter pills */}
          <div className="flex items-center gap-1">
            {filterTabs.map((tab) => {
              const isActive = selectedRoleFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedRoleFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-1.5 text-[10px] font-mono ${
                      isActive ? "text-stone-300" : "text-stone-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search input */}
          <div className="relative flex-1 max-w-sm ml-auto">
            <MagnifyingGlass
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 text-stone-900 placeholder:text-stone-400"
            />
          </div>
        </div>

        {/* Member Table / List */}
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
          {/* Table Header */}
          <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
            <div className="w-64">Member</div>
            <div className="w-36">Role</div>
            <div className="w-32 hidden sm:block">Joined</div>
            <div className="w-16 text-right">Actions</div>
          </div>

          {isLoadingMembers ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-stone-200" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-36 bg-stone-200 rounded" />
                    <div className="h-2.5 w-48 bg-stone-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-3">
                <User size={24} />
              </div>
              <h3 className="text-sm font-bold text-stone-800">No members found</h3>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `No members match "${searchQuery}". Try a different search term.`
                  : "Invite team members to collaborate in this workspace."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {filteredMembers.map((member) => {
                const isMe = member.userId === authUser?.id;
                const initials = getInitials(member.displayName || member.email);
                const avatarColor = getAvatarColor(member.email);
                const isOwner = member.orgRole === "owner";
                const isAdmin = member.orgRole === "admin";
                const isDropdownOpen = activeRoleDropdownId === member.userId;

                return (
                  <div
                    key={member.userId}
                    className="px-5 py-3.5 flex items-center justify-between hover:bg-stone-50/70 transition-colors"
                  >
                    {/* User Info */}
                    <div className="w-64 flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarColor} text-white flex items-center justify-center text-xs font-bold shadow-xs flex-shrink-0`}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-stone-900 truncate">
                            {member.displayName || member.email.split("@")[0]}
                          </span>
                          {isMe && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500 truncate font-mono">
                          {member.email}
                        </div>
                      </div>
                    </div>

                    {/* Role selector / badge */}
                    <div className="w-36 relative">
                      {isElevated && !isOwner && !isMe ? (
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveRoleDropdownId(isDropdownOpen ? null : member.userId)
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 shadow-2xs transition-colors cursor-pointer"
                          >
                            {isAdmin ? (
                              <ShieldCheck size={13} weight="fill" className="text-violet-600" />
                            ) : (
                              <User size={13} className="text-stone-500" />
                            )}
                            <span className="capitalize">{member.orgRole}</span>
                            <CaretDown size={11} className="text-stone-400 ml-0.5" />
                          </button>

                          <AnimatePresence>
                            {isDropdownOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: 4, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 4, scale: 0.95 }}
                                className="absolute left-0 top-full mt-1 w-32 bg-white rounded-xl shadow-lg border border-stone-200 py-1 z-30"
                              >
                                {(["admin", "member"] as const).map((r) => (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() => handleRoleChange(member.userId, r)}
                                    className="w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-stone-50 text-stone-700 capitalize cursor-pointer"
                                  >
                                    <span>{r}</span>
                                    {member.orgRole === r && (
                                      <Check size={12} className="text-amber-600" />
                                    )}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md border ${
                            isOwner
                              ? "bg-stone-900 text-white border-stone-900"
                              : isAdmin
                              ? "bg-violet-50 text-violet-700 border-violet-200"
                              : "bg-stone-100 text-stone-600 border-stone-200"
                          }`}
                        >
                          {isOwner && <Crown size={12} weight="fill" className="text-amber-400" />}
                          {isAdmin && <ShieldCheck size={12} weight="fill" />}
                          <span className="capitalize">{member.orgRole}</span>
                        </span>
                      )}
                    </div>

                    {/* Joined Date */}
                    <div className="w-32 hidden sm:block text-[11px] text-stone-400 font-mono">
                      {member.joinedAt
                        ? new Date(member.joinedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Active"}
                    </div>

                    {/* Actions */}
                    <div className="w-16 text-right">
                      {isElevated && !isOwner && !isMe ? (
                        <button
                          type="button"
                          onClick={() => handleRevokeUser(member.userId, member.email)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title={`Remove ${member.email}`}
                        >
                          <Trash size={15} />
                        </button>
                      ) : (
                        <span className="text-xs text-stone-300">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsInviteModalOpen(false)}
              className="fixed inset-0 bg-stone-900/30 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 p-6 z-10"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Invite Team Member</h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Add a colleague to {activeOrg?.name || "your workspace"}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleInviteSubmit} className="space-y-4">
                {inviteError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                    <Info size={15} weight="bold" className="flex-shrink-0" />
                    <span>{inviteError}</span>
                  </div>
                )}

                {/* Email Address */}
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-stone-50 border border-stone-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 font-mono text-stone-900"
                  />
                  <p className="text-[11px] text-stone-400 mt-1">
                    Any valid email address can be invited to this organization.
                  </p>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-[11px] font-semibold text-stone-700 mb-1.5">
                    Workspace Role
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setInviteRole("member")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        inviteRole === "member"
                          ? "bg-stone-900 text-white border-stone-900"
                          : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
                      }`}
                    >
                      <div className="text-xs font-bold">Member</div>
                      <div
                        className={`text-[11px] mt-0.5 ${
                          inviteRole === "member" ? "text-stone-300" : "text-stone-500"
                        }`}
                      >
                        Standard access to chat, files, and mail.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInviteRole("admin")}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        inviteRole === "admin"
                          ? "bg-stone-900 text-white border-stone-900"
                          : "bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100"
                      }`}
                    >
                      <div className="text-xs font-bold flex items-center gap-1">
                        <ShieldCheck size={13} weight="fill" className="text-amber-400" />
                        <span>Admin</span>
                      </div>
                      <div
                        className={`text-[11px] mt-0.5 ${
                          inviteRole === "admin" ? "text-stone-300" : "text-stone-500"
                        }`}
                      >
                        Can manage members, connections, and CRM access.
                      </div>
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isInviting}
                    className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                  >
                    {isInviting ? "Sending..." : "Send Invite"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
