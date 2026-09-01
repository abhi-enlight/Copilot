'use client';

import React from 'react';
import { 
  Activity, FileText, Briefcase, Mail, Zap, 
  Inbox, Sparkles, ChevronRight, ShieldCheck, KeyRound, LogOut 
} from 'lucide-react';
import { QUICK_ACTIONS } from '@/lib/constants';

type TelemetrySidebarProps = {
  onQuickAction: (prompt: string) => void;
  onOpenConsentModal: () => void;
  onLogout: () => void;
};

export function TelemetrySidebar({
  onQuickAction,
  onOpenConsentModal,
  onLogout
}: TelemetrySidebarProps) {
  return (
    <aside className="w-full md:w-80 lg:w-88 flex flex-col chassis-inner-light rounded-[calc(2.25rem-0.625rem)] p-5 justify-between border border-slate-200/70 mr-0 md:mr-2.5 mb-2.5 md:mb-0">
      <div className="space-y-6">
        {/* Telemetry Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Live Endpoints
            </span>
          </div>
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Connected
          </span>
        </div>

        {/* Endpoints Cards */}
        <div className="space-y-2.5">
          {/* SharePoint / OneDrive */}
          <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5 transition-all hover:border-slate-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold text-slate-900">SharePoint & OneDrive</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            </div>
            <div className="text-[10.5px] text-slate-500 flex justify-between font-mono pl-9.5">
              <span>Drive Root</span>
              <span className="text-slate-700 font-medium">/sites/root/drive</span>
            </div>
          </div>

          {/* Dynamics 365 CRM */}
          <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5 transition-all hover:border-slate-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
                  <Briefcase className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold text-slate-900">Dynamics 365 CRM</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            </div>
            <div className="text-[10.5px] text-slate-500 flex justify-between font-mono pl-9.5">
              <span>Dataverse API</span>
              <span className="text-slate-700 font-medium">org98ee0c24.crm8</span>
            </div>
          </div>

          {/* Outlook */}
          <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-1.5 transition-all hover:border-slate-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold text-slate-900">Outlook & Calendar</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            </div>
            <div className="text-[10.5px] text-slate-500 flex justify-between font-mono pl-9.5">
              <span>Authorized</span>
              <span className="text-slate-700 font-medium">dj@enlightlab.com</span>
            </div>
          </div>
        </div>

        {/* Quick Action Capsules */}
        <div className="space-y-2 pt-2 border-t border-slate-200/60">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
            Executive Actions
          </span>
          <div className="flex flex-col space-y-1.5">
            {QUICK_ACTIONS.map((action, idx) => {
              const IconComponent =
                action.icon === 'Zap' ? Zap : action.icon === 'Inbox' ? Inbox : Sparkles;
              return (
                <button
                  key={idx}
                  onClick={() => onQuickAction(action.prompt)}
                  className="text-left text-[11.5px] p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 border border-slate-200/70 hover:border-slate-300 transition-all flex items-center justify-between group active:scale-[0.98] shadow-2xs"
                >
                  <span className="flex items-center truncate">
                    <IconComponent className="w-3.5 h-3.5 text-indigo-600 mr-2 shrink-0" />
                    <span className="truncate">{action.title}</span>
                  </span>
                  <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 group-hover:text-indigo-600 transition-all shrink-0 ml-1" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Security / Multi-Tenant Badge */}
      <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center space-x-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="font-mono text-[10.5px]">AES-256 Vault</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={onOpenConsentModal}
            className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded-lg hover:bg-slate-100"
            title="View Permission Health & Admin Consent"
          >
            <KeyRound className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onLogout}
            className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-lg hover:bg-rose-50"
            title="Log Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
