"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AnimatedErrorBanner } from "@/components/ui/ErrorInlineBanner";
import {
  UserPlus,
  Crown,
  Briefcase,
  Scales,
  Megaphone,
  MagnifyingGlass,
  Check,
  X,
  CheckCircle,
  Trash,
  Info,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";

export type RoleType = "Admin" | "Campaign Manager" | "Project Manager" | "Legal";

export interface BigCityUser {
  id: string;
  name: string;
  email: string;
  role: RoleType;
  department: string;
  status: "active" | "invited" | "active_now";
  lastActive: string;
  initials: string;
  avatarColor: string;
}

const INITIAL_USERS: BigCityUser[] = [
  {
    id: "usr-1",
    name: "Rohit Sharma",
    email: "rohit.sharma@bigcity.in",
    role: "Admin",
    department: "",
    status: "active_now",
    lastActive: "Active now",
    initials: "RS",
    avatarColor: "from-stone-700 to-stone-900",
  },
  {
    id: "usr-2",
    name: "Priya Nair",
    email: "priya.nair@bigcity.in",
    role: "Admin",
    department: "Digital Operations & CRM",
    status: "active",
    lastActive: "12m ago",
    initials: "PN",
    avatarColor: "from-violet-600 to-violet-800",
  },
  {
    id: "usr-3",
    name: "Vikram Mehta",
    email: "vikram.mehta@bigcity.in",
    role: "Campaign Manager",
    department: "FMCG Brand Campaigns",
    status: "active_now",
    lastActive: "Active now",
    initials: "VM",
    avatarColor: "from-indigo-600 to-indigo-800",
  },
  {
    id: "usr-4",
    name: "Ananya Deshmukh",
    email: "ananya.deshmukh@bigcity.in",
    role: "Campaign Manager",
    department: "Consumer Electronics",
    status: "active",
    lastActive: "1h ago",
    initials: "AD",
    avatarColor: "from-teal-600 to-teal-800",
  },
  {
    id: "usr-5",
    name: "Arjun Patel",
    email: "arjun.patel@bigcity.in",
    role: "Project Manager",
    department: "Platforms & OTP Gateways",
    status: "active",
    lastActive: "3h ago",
    initials: "AP",
    avatarColor: "from-cyan-600 to-cyan-800",
  },
  {
    id: "usr-6",
    name: "Kavita Rao",
    email: "kavita.rao@bigcity.in",
    role: "Legal",
    department: "Legal & Regulatory Affairs",
    status: "active",
    lastActive: "45m ago",
    initials: "KR",
    avatarColor: "from-amber-600 to-amber-800",
  },
  {
    id: "usr-7",
    name: "Siddharth Verma",
    email: "siddharth.verma@bigcity.in",
    role: "Legal",
    department: "Compliance & Governance",
    status: "active",
    lastActive: "Yesterday",
    initials: "SV",
    avatarColor: "from-orange-600 to-orange-800",
  },
  {
    id: "usr-8",
    name: "Tanvi Joshi",
    email: "tanvi.joshi@bigcity.in",
    role: "Project Manager",
    department: "Vendor & Reward Operations",
    status: "invited",
    lastActive: "Invite sent",
    initials: "TJ",
    avatarColor: "from-stone-500 to-stone-700",
  },
  {
    id: "usr-9",
    name: "Akash Verma",
    email: "akash.verma@bigcity.in",
    role: "Legal",
    department: "Legal & Commercial Contracts",
    status: "active_now",
    lastActive: "Active now",
    initials: "AV",
    avatarColor: "from-amber-600 to-amber-900",
  },
];

const ROLE_META: Record<
  RoleType,
  {
    icon: typeof Crown;
    bg: string;
    text: string;
    border: string;
    dot: string;
  }
> = {
  Admin: {
    icon: Crown,
    bg: "bg-stone-900",
    text: "text-white",
    border: "border-stone-700",
    dot: "bg-stone-400",
  },
  "Campaign Manager": {
    icon: Megaphone,
    bg: "bg-indigo-50",
    text: "text-indigo-800",
    border: "border-indigo-200",
    dot: "bg-indigo-500",
  },
  "Project Manager": {
    icon: Briefcase,
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  Legal: {
    icon: Scales,
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
};

interface UsersAndRolesViewProps {
  onUserCountChange?: (count: number) => void;
}

export default function UsersAndRolesView({ onUserCountChange }: UsersAndRolesViewProps) {
  const [users, setUsers] = useState<BigCityUser[]>(INITIAL_USERS);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<RoleType | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [activeRoleDropdownId, setActiveRoleDropdownId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Server-backed app roles (app_users table): which users hold Admin/Owner
  // privileges that unlock the CRM connection, and whether the current
  // session may mutate them.
  const [appRoles, setAppRoles] = useState<Record<string, "owner" | "admin" | "member">>({});
  const [myRole, setMyRole] = useState<"owner" | "admin" | "member" | null>(null);
  const [usersConfigured, setUsersConfigured] = useState(true);
  // Load-failure state for the app-roles directory, surfaced as a banner
  const [appRolesError, setAppRolesError] = useState<boolean>(false);

  // Invite form
  const [inviteName, setInviteName] = useState("");
  const [inviteEmailPrefix, setInviteEmailPrefix] = useState("");
  const [inviteRole, setInviteRole] = useState<RoleType>("Project Manager");
  const [inviteError, setInviteError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/users");
        if (!res.ok || cancelled) {
          if (!cancelled && res.status >= 500) setAppRolesError(true);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setUsersConfigured(Boolean(data.configured));
        setMyRole(data.me?.role || null);
        if (data.error) {
          setAppRolesError(true);
          return;
        }
        const roles: Record<string, "owner" | "admin" | "member"> = {};
        (data.users || []).forEach((u: { email: string; role: string }) => {
          if (u.role === "owner" || u.role === "admin" || u.role === "member") roles[u.email] = u.role;
        });
        setAppRoles(roles);
        setAppRolesError(false);
      } catch {
        // Network failure, surface it rather than silently showing stale state
        if (!cancelled) setAppRolesError(true);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const isElevated = myRole === "owner" || myRole === "admin";

  const handleAppRoleChange = async (email: string, appRole: "owner" | "admin" | "member") => {
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: appRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.detail || "Role change failed");
        return;
      }
      setAppRoles((prev) => ({ ...prev, [email]: appRole }));
      showToast(
        appRole === "member"
          ? `${email} → Member (CRM access revoked on next re-check)`
          : `${email} → ${appRole === "admin" ? "Admin" : "Owner"}, CRM access unlocks on their next re-check`
      );
    } catch {
      showToast("Role change failed");
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesRole = selectedRoleFilter === "All" || u.role === selectedRoleFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q);
      return matchesRole && matchesQuery;
    });
  }, [users, selectedRoleFilter, searchQuery]);

  const counts = useMemo(() => ({
    all: users.length,
    admin: users.filter((u) => u.role === "Admin").length,
    cm: users.filter((u) => u.role === "Campaign Manager").length,
    pm: users.filter((u) => u.role === "Project Manager").length,
    legal: users.filter((u) => u.role === "Legal").length,
  }), [users]);

  const handleRoleChange = (userId: string, newRole: RoleType) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    setActiveRoleDropdownId(null);
    const target = users.find((u) => u.id === userId);
    showToast(`${target?.name || "User"} → ${newRole}`);
  };

  const handleRevokeUser = (userId: string, userName: string) => {
    if (confirm(`Remove ${userName} from workspace?`)) {
      setUsers((prev) => {
        const next = prev.filter((u) => u.id !== userId);
        onUserCountChange?.(next.length);
        return next;
      });
      showToast(`Removed ${userName}`);
    }
  };

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");

    if (!inviteName.trim()) {
      setInviteError("Name is required");
      return;
    }

    const cleanPrefix = inviteEmailPrefix.trim().toLowerCase().replace(/@bigcity\.in$/i, "");
    if (!cleanPrefix || !/^[a-z0-9._-]+$/i.test(cleanPrefix)) {
      setInviteError("Enter a valid email username");
      return;
    }

    const fullEmail = `${cleanPrefix}@bigcity.in`;
    if (users.some((u) => u.email.toLowerCase() === fullEmail.toLowerCase())) {
      setInviteError(`${fullEmail} already exists`);
      return;
    }

    const parts = inviteName.trim().split(" ");
    const initials =
      parts.length > 1
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : inviteName.slice(0, 2).toUpperCase();

    const colors = [
      "from-violet-600 to-violet-800",
      "from-emerald-600 to-emerald-800",
      "from-amber-600 to-amber-800",
      "from-cyan-600 to-cyan-800",
      "from-teal-600 to-teal-800",
    ];

    // Seeded pseudo-random picks are fine here, this runs inside the submit
    // handler (event), never during render.
    const rand = (n: number) => Math.floor(Math.random() * n);
    const now = new Date();
    const newUser: BigCityUser = {
      id: `usr-${rand(1e12).toString(36)}-${now.getTime().toString(36)}`,
      name: inviteName.trim(),
      email: fullEmail,
      role: inviteRole,
      department: inviteRole === "Legal" ? "Legal & Regulatory" : inviteRole === "Admin" ? "Executive Leadership" : "Campaign Operations",
      status: "invited",
      lastActive: "Just invited",
      initials,
      avatarColor: colors[rand(colors.length)],
    };

    setUsers((prev) => {
      const next = [newUser, ...prev];
      onUserCountChange?.(next.length);
      return next;
    });

    setIsInviteModalOpen(false);
    setInviteName("");
    setInviteEmailPrefix("");
    setInviteRole("Campaign Manager");
    showToast(`Invited ${newUser.name}`);
  };

  const filterTabs = [
    { key: "All" as const, label: "All", count: counts.all },
    { key: "Admin" as const, label: "Admins", count: counts.admin },
    { key: "Campaign Manager" as const, label: "Campaign Managers", count: counts.cm },
    { key: "Project Manager" as const, label: "PMs", count: counts.pm },
    { key: "Legal" as const, label: "Legal", count: counts.legal },
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

      {/* App-roles load failure banner */}
      <AnimatedErrorBanner
        show={appRolesError}
        severity="warning"
        title="Couldn't load app roles"
        description="Admin/Owner privileges shown below may be out of date. Retry to refresh them."
        action={{ label: "Retry", onClick: () => window.location.reload() }}
        onDismiss={() => setAppRolesError(false)}
        className="mx-6 mt-3"
      />

      {/* Header */}
      <header className="h-14 border-b border-stone-200/70 bg-white/90 backdrop-blur-md px-6 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-bold text-stone-900 tracking-tight">Users</h1>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200">
            {counts.all} members
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsInviteModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition-all duration-200 cursor-pointer"
        >
          <UserPlus size={14} weight="bold" />
          <span>Invite User</span>
        </button>
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
                  <span className={`ml-1.5 text-[10px] font-mono ${isActive ? "text-stone-400" : "text-stone-400"}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative flex-1 sm:max-w-xs ml-auto">
            <MagnifyingGlass
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-all text-stone-900 placeholder:text-stone-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* User List */}
        <div className="space-y-2">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm font-semibold text-stone-500">No users found</p>
              <p className="text-xs text-stone-400 mt-1">Try adjusting your search or filter</p>
            </div>
          ) : (
            filteredUsers.map((user, idx) => {
              const role = ROLE_META[user.role];
              const RoleIcon = role.icon;
              const isDropdownOpen = activeRoleDropdownId === user.id;

              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white border border-stone-200/80 hover:border-stone-300 transition-colors group"
                >
                  {/* Avatar */}
                  <div
                    className={`w-9 h-9 rounded-full bg-gradient-to-br ${user.avatarColor} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}
                  >
                    {user.initials}
                  </div>

                  {/* Name + Email */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-stone-900 truncate">
                        {user.name}
                      </span>
                      {user.status === "active_now" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      )}
                      {user.status === "invited" && (
                        <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-px rounded border border-amber-200 flex-shrink-0">
                          Invited
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-stone-400 block truncate">
                      {user.email}
                    </span>
                  </div>

                  {/* Role Badge, clickable dropdown */}
                  <div className="relative flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveRoleDropdownId(isDropdownOpen ? null : user.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${role.bg} ${role.text} ${role.border}`}
                    >
                      <RoleIcon size={12} weight="fill" />
                      <span>{user.role}</span>
                    </button>

                    <AnimatePresence>
                      {isDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 4 }}
                          transition={{ duration: 0.1 }}
                          className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white border border-stone-200 shadow-lg p-1 z-30"
                        >
                          {(["Admin", "Campaign Manager", "Project Manager", "Legal"] as RoleType[]).map((r) => {
                            const meta = ROLE_META[r];
                            const Icon = meta.icon;
                            const isCurrent = user.role === r;
                            return (
                              <button
                                key={r}
                                type="button"
                                onClick={() => handleRoleChange(user.id, r)}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                                  isCurrent
                                    ? "bg-stone-100 text-stone-900"
                                    : "text-stone-600 hover:bg-stone-50"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Icon size={13} weight="duotone" />
                                  <span>{r}</span>
                                </div>
                                {isCurrent && <Check size={12} weight="bold" className="text-emerald-600" />}
                              </button>
                            );
                          })}
                          {isElevated && usersConfigured && (
                            <>
                              <div className="border-t border-stone-100 my-1" />
                              <p className="px-2.5 pb-1 pt-0.5 text-[9.5px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1">
                                <ShieldCheck size={10} weight="fill" /> App privilege (CRM unlock)
                              </p>
                              {(["owner", "admin", "member"] as const).map((appRole) => {
                                const current = appRoles[user.email.toLowerCase()] || "member";
                                const isCurrentApp = current === appRole;
                                return (
                                  <button
                                    key={appRole}
                                    type="button"
                                    onClick={() => handleAppRoleChange(user.email, appRole)}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                                      isCurrentApp
                                        ? "bg-stone-100 text-stone-900"
                                        : "text-stone-600 hover:bg-stone-50"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <ShieldCheck size={13} weight="duotone" className={appRole === "member" ? "text-stone-400" : "text-emerald-600"} />
                                      <span>{appRole === "owner" ? "Owner" : appRole === "admin" ? "Admin" : "Member"}</span>
                                    </div>
                                    {isCurrentApp && <Check size={12} weight="bold" className="text-emerald-600" />}
                                  </button>
                                );
                              })}
                              <p className="px-2.5 py-1.5 text-[10px] text-stone-400 leading-snug flex items-start gap-1">
                                <WarningCircle size={11} className="mt-0.5 flex-shrink-0" />
                                Admin/Owner unlocks the CRM connection without a provider license.
                              </p>
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* App privilege (CRM unlock), server-backed role */}
                  <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
                    {appRoles[user.email.toLowerCase()] ? (
                      <span
                        title={
                          appRoles[user.email.toLowerCase()] === "member"
                            ? "Member, CRM connection locked"
                            : "Elevated, unlocks the CRM connection on next re-check"
                        }
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          appRoles[user.email.toLowerCase()] === "member"
                            ? "bg-stone-100 text-stone-500 border-stone-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        <ShieldCheck size={10} weight="fill" />
                        {appRoles[user.email.toLowerCase()] === "member" ? "Member" : appRoles[user.email.toLowerCase()] === "admin" ? "Admin" : "Owner"}
                      </span>
                    ) : null}
                  </div>

                  {/* Last active */}
                  <span className="hidden md:block text-[10px] text-stone-400 font-mono w-20 text-right flex-shrink-0">
                    {user.status === "active_now" ? "now" : user.lastActive}
                  </span>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleRevokeUser(user.id, user.name)}
                    className="p-1.5 rounded-lg text-stone-300 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 flex-shrink-0"
                    title="Remove user"
                  >
                    <Trash size={14} />
                  </button>
                </motion.div>
              );
            })
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
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 p-5 z-10"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-stone-900">Invite Team Member</h3>
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleInviteSubmit} className="space-y-3.5">
                {inviteError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                    <Info size={14} weight="bold" className="flex-shrink-0" />
                    {inviteError}
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Deepika Sengupta"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-stone-50 border border-stone-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 text-stone-900"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">Email</label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      placeholder="deepika.sengupta"
                      value={inviteEmailPrefix}
                      onChange={(e) => setInviteEmailPrefix(e.target.value)}
                      className="w-full pl-3 pr-24 py-2 text-xs rounded-lg bg-stone-50 border border-stone-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 font-mono text-stone-900"
                    />
                    <span className="absolute right-2 text-[10px] font-mono font-semibold text-stone-400">
                      @bigcity.in
                    </span>
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1.5">Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["Admin", "Campaign Manager", "Project Manager", "Legal"] as RoleType[]).map((r) => {
                      const meta = ROLE_META[r];
                      const Icon = meta.icon;
                      const isChecked = inviteRole === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setInviteRole(r)}
                          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                            isChecked
                              ? "bg-stone-900 text-white border-stone-700"
                              : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                          }`}
                        >
                          <Icon size={13} weight={isChecked ? "fill" : "bold"} />
                          <span>{r === "Campaign Manager" ? "Campaign Mgr" : r === "Project Manager" ? "PM" : r}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="px-3.5 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-stone-900 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                  >
                    Send Invite
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
