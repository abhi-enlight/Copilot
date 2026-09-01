'use client';

import React from 'react';
import { Sparkle, Building2, Zap, ShieldCheck } from 'lucide-react';
import { Tenant } from '@/types';

type LoginViewProps = {
  activeTenant: Tenant;
  onEnterDemo: () => void;
};

export function LoginView({ activeTenant, onEnterDemo }: LoginViewProps) {
  return (
    <div className="w-full h-full flex items-center justify-center p-6 chassis-inner-light rounded-[calc(2.25rem-0.625rem)] border border-slate-200/70 relative">
      <div className="w-full max-w-md p-8 rounded-3xl bg-white/95 border border-slate-200/80 shadow-2xl shadow-slate-900/10 backdrop-blur-2xl text-center space-y-6">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white flex items-center justify-center shadow-lg shadow-slate-900/20 border border-slate-700/40">
          <Sparkle className="w-6 h-6 text-indigo-300" />
        </div>

        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Operations Cockpit</h2>
          <p className="text-xs text-slate-500 mt-1">
            Multi-Tenant Enterprise Copilot & Workspace Intelligence
          </p>
        </div>

        <div className="space-y-3 pt-1">
          <a
            href={`/api/integrations/microsoft/connect?tenant=${activeTenant.slug}&returnTo=/`}
            className="w-full py-3 px-4 rounded-xl bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-md shadow-slate-900/10 group"
          >
            <Building2 className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
            <span>Sign In with Microsoft Entra ID / M365</span>
          </a>

          <button
            onClick={onEnterDemo}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100/80 text-indigo-950 border border-indigo-200/70 text-xs font-semibold flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
          >
            <Zap className="w-4 h-4 text-indigo-600" />
            <span>Enter Workspace Demo</span>
          </button>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-center space-x-2 text-[11px] text-slate-400 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Protected by Microsoft Entra ID • Multi-Tenant Isolated</span>
        </div>
      </div>
    </div>
  );
}
