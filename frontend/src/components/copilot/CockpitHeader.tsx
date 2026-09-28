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

interface CockpitHeaderProps {
  connectedToolsCount?: number;
  onOpenToolDrawer: () => void;
  unreadRadarCount?: number;
  onToggleRadar: () => void;
  isRadarOpen?: boolean;
  onOpenMobileNav?: () => void;
}

export default function CockpitHeader({
  connectedToolsCount = 0,
  onOpenToolDrawer,
  unreadRadarCount = 0,
  onToggleRadar,
  isRadarOpen = false,
  onOpenMobileNav,
}: CockpitHeaderProps) {
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const { userOrgs, activeOrg, switchOrg } = useAuth();

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
    <header className="h-14 w-full bg-white/85 border-b border-slate-200/80 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between z-20 font-sans select-none">
      {/* Left: Brand & Mobile Nav Toggle */}
      <div className="flex items-center gap-3">
        {onOpenMobileNav && (
          <button
            type="button"
            onClick={onOpenMobileNav}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
          >
            <List size={20} weight="bold" />
          </button>
        )}

        <div className="flex items-center gap-2.5">
          <PrismLogo size={26} variant="tile" />
          <div className="hidden sm:flex flex-col">
            <span className="text-sm font-bold text-slate-900 tracking-tight leading-none">
              Prism
            </span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase mt-0.5">
              Operations Cockpit
            </span>
          </div>
        </div>
      </div>

      {/* Center: Multi-Tenant Workspace Selector */}
      <div className="relative" ref={orgDropdownRef}>
        <button
          type="button"
          onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 text-xs font-medium text-slate-700 transition cursor-pointer"
        >
          <Building size={14} weight="bold" className="text-slate-500" />
          <span className="font-semibold text-slate-900 max-w-[120px] sm:max-w-[160px] truncate">
            {activeOrg?.name || "Personal Workspace"}
          </span>
          {activeOrg?.ownerRole && (
            <span className="hidden sm:inline text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-white text-slate-600 border border-slate-200 uppercase font-semibold">
              {activeOrg.ownerRole}
            </span>
          )}
          <CaretDown size={12} weight="bold" className="text-slate-400" />
        </button>

        {/* Dropdown Menu */}
        {isOrgDropdownOpen && (
          <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 w-56 rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 z-50">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
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
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                  activeOrg?.id === org.id
                    ? "bg-slate-100 text-slate-900 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Building size={14} />
                  <span className="truncate">{org.name}</span>
                </div>
                {activeOrg?.id === org.id && <Check size={13} weight="bold" className="text-slate-900" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Connectivity Status + Live Radar + User Avatar */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Tool Connect Hub Button */}
        <button
          type="button"
          onClick={onOpenToolDrawer}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-slate-50 border border-slate-200/90 text-xs font-medium text-slate-700 shadow-2xs transition cursor-pointer"
        >
          <PlugsConnected size={14} weight="bold" className={connectedToolsCount > 0 ? "text-emerald-600" : "text-slate-400"} />
          <span className="hidden sm:inline font-medium">Tools:</span>
          <span className="font-semibold text-slate-900">{connectedToolsCount}/5</span>
        </button>

        {/* Live Radar Toggle Button */}
        <button
          type="button"
          onClick={onToggleRadar}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition cursor-pointer ${
            isRadarOpen
              ? "bg-slate-900 text-white border-slate-900 shadow-xs"
              : "bg-white hover:bg-slate-50 border-slate-200/90 text-slate-700 shadow-2xs"
          }`}
        >
          <Pulse size={14} weight="bold" className={isRadarOpen ? "text-emerald-400" : "text-slate-500"} />
          <span className="hidden sm:inline">Radar</span>
          {unreadRadarCount > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              isRadarOpen ? "bg-white/20 text-white" : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}>
              {unreadRadarCount}
            </span>
          )}
        </button>

        {/* User Profile Dropdown */}
        <div className="relative" ref={userDropdownRef}>
          <button
            type="button"
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200/80 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-800 transition cursor-pointer"
          >
            {user?.email ? user.email.slice(0, 2).toUpperCase() : "PR"}
          </button>

          {isUserDropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 z-50">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {profile?.displayName || user?.email?.split("@")[0] || "Executive"}
                </p>
                <p className="text-[10.5px] text-slate-400 truncate">{user?.email}</p>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    signOut().then(() => {
                      router.push("/auth/login");
                    });
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                >
                  <SignOut size={14} weight="bold" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
