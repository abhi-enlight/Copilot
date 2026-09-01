'use client';

import React from 'react';
import { Building2, Mail, Briefcase, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tenant } from '@/types';

type IntegrationsModalProps = {
  isOpen: boolean;
  activeTenant: Tenant;
  onClose: () => void;
};

export function IntegrationsModal({
  isOpen,
  activeTenant,
  onClose
}: IntegrationsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        >
          <motion.div
            initial={{ scale: 0.95, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 16 }}
            className="w-full max-w-lg p-6 rounded-3xl bg-white border border-slate-200 shadow-2xl shadow-slate-900/20 space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Connect Data Sources</h3>
                  <p className="text-xs text-slate-500">OAuth 2.0 Account Onboarding</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 text-xs font-medium"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {/* 1. Microsoft 365 Direct OAuth */}
              <div className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-700">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">Microsoft 365 & SharePoint</div>
                    <div className="text-[11px] text-slate-500">Mailbox, Calendar & Document Libraries</div>
                  </div>
                </div>
                <a
                  href={`/api/integrations/microsoft/connect?tenant=${activeTenant.slug}&returnTo=/`}
                  className="px-3 py-1.5 rounded-xl bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-medium flex items-center space-x-1.5 transition-all shadow-xs"
                >
                  <span>Connect</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>

              {/* 2. Dynamics 365 Dataverse */}
              <div className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-900">Dynamics 365 CRM</div>
                    <div className="text-[11px] text-slate-500">Dataverse v9.2 Pipeline & Deals</div>
                  </div>
                </div>
                <a
                  href={`/api/integrations/microsoft/connect?tenant=${activeTenant.slug}&returnTo=/`}
                  className="px-3 py-1.5 rounded-xl bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-medium flex items-center space-x-1.5 transition-all shadow-xs"
                >
                  <span>Authorize</span>
                  <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={onClose}
                className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
