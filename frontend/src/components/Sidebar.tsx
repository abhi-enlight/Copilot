"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkle,
  SidebarSimple,
  Megaphone,
  PlugsConnected,
  Users,
  Buildings,
  Robot,
  User,
} from "@phosphor-icons/react";

import BigCityLogo from "./BigCityLogo";
import EnlightLogo from "./brand/EnlightLogo";

export type NavView = "copilot" | "campaigns" | "connections" | "users";

interface SidebarProps {
  currentView: NavView;
  onViewChange: (view: NavView) => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  campaignCount?: number;
}

export default function Sidebar({
  currentView,
  onViewChange,
  isMobileOpen,
  onMobileClose,
  campaignCount = 4,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    {
      id: "copilot" as NavView,
      label: "Copilot",
      icon: Robot,
      badge: null,
    },
    {
      id: "campaigns" as NavView,
      label: "Campaigns",
      icon: Megaphone,
      badge: `${campaignCount}`,
    },
    {
      id: "connections" as NavView,
      label: "Connections",
      icon: PlugsConnected,
      badge: "4",
    },
    {
      id: "users" as NavView,
      label: "Users & Roles",
      icon: Users,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onMobileClose}
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 bg-white border-r border-stone-200/70 flex flex-col transition-all duration-300 ease-in-out select-none lg:shadow-none ${
          isCollapsed ? "w-[68px]" : "w-60"
        } ${
          isMobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className={`h-14 border-b border-stone-200/70 flex items-center flex-shrink-0 transition-all ${isCollapsed ? "justify-center px-0" : "justify-between px-4"}`}>
          {!isCollapsed ? (
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center flex-shrink-0">
                <BigCityLogo size={32} className="shadow-xs rounded-lg" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13.5px] font-bold tracking-tight text-stone-900 truncate">
                    BCP Assist
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-px">
                  <span className="text-[11px] text-stone-400 truncate font-medium">BigCity Promotions</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <BigCityLogo size={30} className="shadow-xs rounded-lg" />
            </div>
          )}

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer flex-shrink-0"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <SidebarSimple size={16} weight="bold" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onViewChange(item.id);
                  onMobileClose();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-left group cursor-pointer relative ${
                  isActive
                    ? "bg-stone-900 text-white"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-100/80"
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                {/* Active left accent bar */}
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-bar"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-amber-400"
                  />
                )}

                <Icon
                  size={17}
                  weight={isActive ? "fill" : "bold"}
                  className={`flex-shrink-0 ${isActive ? "text-white" : "text-stone-500 group-hover:text-stone-800"}`}
                />

                {!isCollapsed && (
                  <div className="min-w-0 flex-1 flex items-center justify-between">
                    <span className="text-[13px] font-semibold truncate">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-mono font-semibold px-1.5 py-px rounded-full ml-1 flex-shrink-0 ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-stone-100 text-stone-500"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile & Enlight Labs attribution */}
        <div className="p-3 border-t border-stone-200/70 space-y-2.5">
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-8 h-8 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400 flex-shrink-0 shadow-2xs">
              <User size={16} weight="duotone" className="text-stone-500" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12.5px] font-semibold text-stone-900 truncate">
                    Rohit Sharma
                  </span>
                  <span className="text-[9px] font-semibold px-1.5 py-px rounded bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0">
                    Admin
                  </span>
                </div>
                <span className="text-[10.5px] text-stone-400 font-mono block truncate mt-px">
                  rohit.sharma@bigcity.in
                </span>
              </div>
            )}
          </div>

          {!isCollapsed ? (
            <div className="pt-2 border-t border-stone-100 px-1 flex items-center justify-between">
              <span className="text-[10px] text-stone-400 font-medium">Built by</span>
              <EnlightLogo size="xs" showWordmark={false} href="/" ariaLabel="Enlight Lab" />
            </div>
          ) : (
            <div className="pt-1 flex justify-center" title="Built by Enlight Lab">
              <EnlightLogo size="xs" showWordmark={false} href="/" ariaLabel="Enlight Lab" />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
