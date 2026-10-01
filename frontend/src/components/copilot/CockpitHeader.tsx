"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  List,
  CaretDown,
  Building,
  Check,
  PlugsConnected,
  Pulse,
  SignOut,
} from "@phosphor-icons/react";
import PrismLogo from "@/components/brand/PrismLogo";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToolsStatus } from "@/hooks/useToolsStatus";

interface CockpitHeaderProps {
  connectedToolsCount?: number;
  totalToolsCount?: number;
  onOpenToolDrawer?: () => void;
  unreadRadarCount?: number;
  onToggleRadar: () => void;
  isRadarOpen?: boolean;
  onOpenMobileNav?: () => void;
}

export default function CockpitHeader({
  connectedToolsCount: propConnectedCount,
  totalToolsCount: propTotalCount,
  onOpenToolDrawer,
  unreadRadarCount = 0,
  onToggleRadar,
  isRadarOpen = false,
  onOpenMobileNav,
}: CockpitHeaderProps) {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const { userOrgs, activeOrg, switchOrg } = useAuth();
  const { connectedCount: hookConnectedCount, totalCount: hookTotalCount } = useToolsStatus();

  const connectedToolsCount = propConnectedCount ?? hookConnectedCount;
  const totalToolsCount = propTotalCount ?? hookTotalCount;

  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  const orgDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(e.target as Node)) {
        setIsOrgDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header
      className="h-14 w-full bg-white/85 backdrop-blur-xl border-b border-black/[0.06] px-5 sm:px-6 flex items-center justify-between z-20 select-none"
      style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)" }}
    >
      {/* Left: Brand & Mobile Nav Toggle */}
      <div className="flex items-center gap-3">
        {onOpenMobileNav && (
          <button
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Open mobile navigation"
            className="md:hidden p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition cursor-pointer"
          >
            <List size={20} weight="bold" />
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <PrismLogo size={26} variant="tile" />
          <div className="hidden sm:flex flex-col leading-none">
            <span className="text-[14px] font-bold text-stone-900 tracking-tight">Prism</span>
            <span className="text-[10px] font-medium text-stone-400 tracking-[0.08em] uppercase mt-0.5">Operations</span>
          </div>
        </div>
      </div>

      {/* Center: Multi-Tenant Workspace Selector */}
      <div className="relative" ref={orgDropdownRef}>
        <button
          type="button"
          onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
          aria-expanded={isOrgDropdownOpen}
          aria-haspopup="true"
          aria-label={`Select workspace, current: ${activeOrg?.name || "Personal"}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-50 hover:bg-stone-100 border border-black/[0.07] text-xs font-medium text-stone-700 transition-colors duration-150 cursor-pointer"
        >
          <Building size={13} weight="bold" className="text-stone-400" />
          <span className="font-semibold text-stone-900 max-w-[120px] sm:max-w-[160px] truncate">
            {activeOrg?.name || "Personal"}
          </span>
          {activeOrg?.ownerRole && (
            <span className="hidden sm:inline text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-stone-200 text-stone-500 uppercase font-semibold">
              {activeOrg.ownerRole}
            </span>
          )}
          <CaretDown size={11} weight="bold" className="text-stone-400" />
        </button>

        {/* Org Dropdown Menu */}
        {isOrgDropdownOpen && (
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-56 rounded-2xl bg-white border border-black/[0.07] shadow-[0_4px_12px_rgba(0,0,0,0.05),0_8px_32px_rgba(0,0,0,0.06)] p-1.5 z-50">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
              Select Workspace
            </div>
            {userOrgs.map((org: { id: string; name: string }) => (
              <button
                key={org.id}
                type="button"
                onClick={() => {
                  switchOrg(org.id);
                  setIsOrgDropdownOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  activeOrg?.id === org.id
                    ? "bg-stone-100 text-stone-900 font-semibold"
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Building size={14} />
                  <span className="truncate">{org.name}</span>
                </div>
                {activeOrg?.id === org.id && <Check size={13} weight="bold" className="text-stone-900" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Connectivity Status + Live Radar + User Avatar */}
      <div className="flex items-center gap-2">
        {/* Tool Connect Hub Button */}
        <button
          type="button"
          onClick={() => {
            if (onOpenToolDrawer) {
              onOpenToolDrawer();
            } else {
              router.push("/integrations");
            }
          }}
          aria-label={`Open Connect Hub, ${connectedToolsCount} of ${totalToolsCount} tools active`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-stone-50 border border-black/[0.07] text-xs font-medium text-stone-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors cursor-pointer"
        >
          <PlugsConnected size={13} weight="bold" className={connectedToolsCount > 0 ? "text-emerald-500" : "text-stone-400"} />
          <span className="hidden sm:inline text-stone-500">Tools</span>
          <span className="font-semibold text-stone-900">{connectedToolsCount}/{totalToolsCount}</span>
        </button>

        {/* Live Radar Toggle Button */}
        <button
          type="button"
          onClick={onToggleRadar}
          aria-expanded={isRadarOpen}
          aria-label={`Toggle Live Stack Radar, ${unreadRadarCount} unread alerts`}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-150 cursor-pointer ${
            isRadarOpen
              ? "bg-stone-900 border-stone-900 text-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              : "bg-white hover:bg-stone-50 border-black/[0.07] text-stone-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          }`}
        >
          <Pulse size={13} weight="bold" className={isRadarOpen ? "text-emerald-400" : "text-stone-500"} />
          <span className="hidden sm:inline">Radar</span>
          {unreadRadarCount > 0 && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                isRadarOpen ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"
              }`}
            >
              {unreadRadarCount}
            </span>
          )}
        </button>

        {/* User Profile Dropdown */}
        <div className="relative" ref={userDropdownRef}>
          <button
            type="button"
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            aria-expanded={isUserDropdownOpen}
            aria-haspopup="true"
            aria-label="User profile and account settings"
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 border border-black/[0.07] flex items-center justify-center text-xs font-bold text-stone-800 transition-colors cursor-pointer"
          >
            {user?.email ? user.email.slice(0, 2).toUpperCase() : "PR"}
          </button>

          {isUserDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl bg-white border border-black/[0.07] shadow-[0_4px_12px_rgba(0,0,0,0.05),0_8px_32px_rgba(0,0,0,0.06)] p-2 z-50">
              <div className="px-3 py-2 border-b border-stone-100 mb-1">
                <p className="text-xs font-semibold text-stone-900 truncate">
                  {profile?.displayName || user?.email?.split("@")[0] || "Executive"}
                </p>
                <p className="text-[10.5px] text-stone-400 truncate">{user?.email}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  signOut().then(() => {
                    router.push("/auth/login");
                  });
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <SignOut size={14} weight="bold" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
