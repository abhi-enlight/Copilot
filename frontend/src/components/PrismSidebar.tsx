"use client";

import { useState, type ComponentType } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  House,
  Robot,
  Megaphone,
  PlugsConnected,
  Users,
  GearSix,
  SidebarSimple,
  Buildings,
  X,
  // Preserved for later release:
  // EnvelopeSimple,
  // FolderOpen,
} from "@phosphor-icons/react";
import BigCityLogo from "@/components/BigCityLogo";
import EnlightLogo from "@/components/brand/EnlightLogo";

export type NavView =
  | "home"
  | "copilot"
  | "campaigns"
  | "connections"
  | "users"
  | "settings"
  // Deferred / Preserved for future release:
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
      // Preserved for later release:
      // { id: "inbox", label: "Inbox", icon: EnvelopeSimple },
      // { id: "documents", label: "Documents", icon: FolderOpen },
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
      // Preserved for later release:
      // { id: "settings", label: "Settings", icon: GearSix },
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
  // Preserved labels for later release
  inbox: "Inbox",
  documents: "Documents",
};

interface PrismSidebarProps {
  currentView: NavView;
  onViewChange: (view: NavView) => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  campaignCount?: number;
}

export default function PrismSidebar({
  currentView,
  onViewChange,
  isMobileOpen,
  onMobileClose,
  campaignCount = 0,
}: PrismSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const collapsed = isCollapsed;

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

      {/* Sidebar container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 bg-white border-r border-stone-200/70 flex flex-col transition-[width,transform] duration-200 ease-out select-none ${
          collapsed ? "w-[70px]" : "w-60"
        } ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Brand header: App Icon Tile + Product Name + by Enlight Lab subtext */}
        <div
          className={`h-[66px] border-b border-stone-200/70 flex items-center flex-shrink-0 transition-colors ${
            collapsed ? "justify-center px-0" : "justify-between px-3.5"
          }`}
        >
          {collapsed ? (
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="p-1 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
              title="Expand sidebar — BCP Assist by Enlight Lab"
            >
              <BigCityLogo size={34} variant="tile" className="rounded-xl border border-stone-200/90 shadow-2xs p-1" />
            </button>
          ) : (
            <div className="flex items-center justify-between w-full min-w-0">
              <button
                type="button"
                onClick={() => onViewChange("home")}
                className="flex items-center gap-2.5 min-w-0 flex-1 group text-left cursor-pointer"
                title="BCP Assist — by Enlight Lab"
              >
                {/* BigCity skyline icon tile */}
                <BigCityLogo
                  size={36}
                  variant="tile"
                  className="rounded-xl border border-stone-200/90 shadow-2xs p-1 shrink-0 group-hover:border-stone-300 transition-colors"
                />

                <div className="min-w-0 flex-1">
                  {/* Product title */}
                  <span className="block text-[14.5px] font-bold tracking-tight text-stone-900 leading-tight group-hover:text-blue-600 transition-colors truncate">
                    BCP Assist
                  </span>
                  {/* Clean by Enlight Lab subtext */}
                  <div className="flex items-center gap-1 leading-tight mt-0.5">
                    <span className="text-[11px] text-stone-400 font-medium">by</span>
                    <span className="text-[11px] font-semibold text-blue-600 tracking-tight">
                      Enlight Lab
                    </span>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                className="hidden lg:flex p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors flex-shrink-0 cursor-pointer ml-1"
                title="Collapse sidebar"
              >
                <SidebarSimple size={15} weight="bold" />
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

        {/* Navigation */}
        <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto prism-scroll">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <div className="px-2.5 pb-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-stone-400">
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
                      className={`prism-sidebar-link relative w-full flex items-center gap-3 rounded-xl text-left group cursor-pointer ${
                        collapsed ? "justify-center px-0 py-2.5" : "px-2.5 py-2"
                      } ${
                        isActive
                          ? "bg-stone-900 text-white shadow-sm"
                          : "text-stone-500 hover:text-stone-900 hover:bg-stone-100/80"
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="prism-active-bar"
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full prism-gradient"
                        />
                      )}
                      <Icon
                        size={17}
                        weight={isActive ? "fill" : "bold"}
                        className="flex-shrink-0"
                      />
                      {!collapsed && (
                        <span className="min-w-0 flex-1 flex items-center justify-between gap-2">
                          <span className="text-[13px] font-semibold truncate">{item.label}</span>
                          {showBadge && (
                            <span
                              className={`text-[10px] font-mono font-semibold px-1.5 py-px rounded-full flex-shrink-0 ${
                                isActive
                                  ? "bg-white/20 text-white"
                                  : "bg-stone-100 text-stone-500"
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
        </nav>

        {/* Footer workspace chip */}
        <div className="p-3 border-t border-stone-200/70">
          <div
            className={`flex items-center gap-2.5 px-1 ${collapsed ? "flex-col gap-1.5" : ""}`}
            title="Current workspace"
          >
            <div className="w-8 h-8 rounded-[10px] bg-stone-100 border border-stone-200 text-stone-500 flex items-center justify-center flex-shrink-0 shadow-2xs">
              <Buildings size={15} weight="duotone" />
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12.5px] font-semibold text-stone-900 truncate">
                    Workspace
                  </span>
                  <span className="text-[9px] font-semibold px-1.5 py-px rounded bg-violet-50 text-violet-700 border border-violet-200 flex-shrink-0 uppercase">
                    Owner
                  </span>
                </div>
                <div className="text-[10.5px] text-stone-400 font-mono block truncate mt-px">
                  personal workspace
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
