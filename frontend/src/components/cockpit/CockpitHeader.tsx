'use client';

import React from 'react';
import { Sparkle, Building2, ChevronDown, Check, KeyRound, LogOut, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tenant } from '@/types';

type CockpitHeaderProps = {
  isAuthenticated: boolean;
  activeTenant: Tenant;
  isTenantDropdownOpen: boolean;
  tenantDropdownRef: React.RefObject<HTMLDivElement | null>;
  setIsTenantDropdownOpen: (open: boolean) => void;
  setShowIntegrationsModal: (show: boolean) => void;
  setShowConsentModal: (show: boolean) => void;
  onLogin: () => void;
  onLogout: () => void;
};

export function CockpitHeader({
  isAuthenticated,
  activeTenant,
  isTenantDropdownOpen,
  tenantDropdownRef,
  setIsTenantDropdownOpen,
  setShowIntegrationsModal,
  setShowConsentModal,
  onLogin,
  onLogout
}: CockpitHeaderProps) {
  return (
    <header className="w-full max-w-7xl mx-auto mb-3.5 flex items-center justify-between z-30 relative px-2">
      {/* Brand & Logo */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white flex items-center justify-center shadow-md shadow-slate-900/10 border border-slate-700/30">
          <Sparkle className="w-4 h-4 text-indigo-300" />
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-slate-900">Operations Cockpit</h1>
        </div>
      </div>

      {isAuthenticated ? (
        <>
          {/* Center: Multi-Tenant Workspace Selector */}
          <div className="relative" ref={tenantDropdownRef}>
            <button
              onClick={() => setIsTenantDropdownOpen(!isTenantDropdownOpen)}
              className="flex items-center space-x-2.5 px-3.5 py-1.5 rounded-full bg-white/90 hover:bg-white border border-slate-200/80 backdrop-blur-xl transition-all text-xs font-medium text-slate-700 shadow-xs group active:scale-[0.98]"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-slate-900 font-semibold">{activeTenant.name}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/60 uppercase font-semibold">
                {activeTenant.role}
              </span>
              <ChevronDown
                className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
                  isTenantDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Tenant Dropdown Menu */}
            <AnimatePresence>
              {isTenantDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-1/2 -translate-x-1/2 mt-2 w-72 p-2 rounded-2xl bg-white/95 border border-slate-200 backdrop-blur-2xl shadow-xl shadow-slate-900/10 z-50 space-y-1"
                >
                  <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                    Active Workspace
                  </div>

                  <div className="w-full flex items-center justify-between p-2.5 rounded-xl bg-indigo-50/80 text-indigo-950 border border-indigo-200/70 text-xs">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <div>
                        <div className="font-semibold text-slate-900">{activeTenant.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">Endpoints Connected</div>
                      </div>
                    </div>
                    <Check className="w-3.5 h-3.5 text-indigo-600" />
                  </div>

                  <div className="pt-1.5 border-t border-slate-100 space-y-1">
                    <button
                      onClick={() => {
                        setIsTenantDropdownOpen(false);
                        setShowIntegrationsModal(true);
                      }}
                      className="w-full flex items-center space-x-2 p-2 rounded-xl text-[11px] text-slate-800 hover:bg-slate-50 transition-colors font-medium"
                    >
                      <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Connect Data Sources</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsTenantDropdownOpen(false);
                        setShowConsentModal(true);
                      }}
                      className="w-full flex items-center space-x-2 p-2 rounded-xl text-[11px] text-indigo-700 hover:bg-indigo-50 transition-colors font-medium"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Enterprise IT Admin Consent</span>
                    </button>

                    <button
                      onClick={onLogout}
                      className="w-full flex items-center space-x-2 p-2 rounded-xl text-[11px] text-rose-600 hover:bg-rose-50 transition-colors font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-500" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right: Logout Action */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onLogout}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-white/90 hover:bg-rose-50/80 border border-slate-200/80 hover:border-rose-200 text-xs font-medium text-slate-700 hover:text-rose-600 transition-all shadow-xs group active:scale-[0.98]"
              title="Log out of current workspace"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-500 transition-colors" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </>
      ) : (
        /* Right: Sign In Action when logged out */
        <div className="flex items-center space-x-2">
          <button
            onClick={onLogin}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-full bg-[#0f172a] hover:bg-slate-800 text-xs font-semibold text-white transition-all shadow-xs active:scale-[0.98]"
          >
            <span>Sign In</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-300" />
          </button>
        </div>
      )}
    </header>
  );
}
