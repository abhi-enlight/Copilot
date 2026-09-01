'use client';

import React from 'react';
import { KeyRound, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { REQUIRED_ENTRA_SCOPES } from '@/lib/constants';
import { copyToClipboard } from '@/lib/utils';
import { Tenant } from '@/types';

type AdminConsentModalProps = {
  isOpen: boolean;
  activeTenant: Tenant;
  showConsentSuccess: boolean;
  setShowConsentSuccess: (success: boolean) => void;
  onClose: () => void;
};

export function AdminConsentModal({
  isOpen,
  activeTenant,
  showConsentSuccess,
  setShowConsentSuccess,
  onClose
}: AdminConsentModalProps) {
  const handleCopy = async () => {
    const clientId =
      process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '9b9717eb-8dbf-41b1-b788-d7a3ae6f4269';
    const consentUrl = `https://login.microsoftonline.com/common/adminconsent?client_id=${clientId}&redirect_uri=https://${activeTenant.slug}.yourapp.com/auth/callback`;
    const success = await copyToClipboard(consentUrl);
    if (success) {
      setShowConsentSuccess(true);
      setTimeout(() => setShowConsentSuccess(false), 2500);
    }
  };

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
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Enterprise IT Admin Consent</h3>
                <p className="text-xs text-slate-500">Microsoft Entra ID & Dynamics 365 Scope Resolution</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed space-y-2.5">
              <p>
                If non-admin enterprise users encounter{' '}
                <code className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-mono border border-amber-200">
                  AADSTS65001
                </code>{' '}
                or missing Dataverse roles, your IT Administrator must grant tenant-wide consent once.
              </p>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-700">
                <div className="text-slate-400 mb-1">Required Entra Scopes:</div>
                {REQUIRED_ENTRA_SCOPES.map((scope, idx) => (
                  <div key={idx} className="text-indigo-700">
                    • {scope}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleCopy}
                className="w-full py-2.5 px-4 rounded-xl bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-all shadow-md shadow-slate-900/10"
              >
                {showConsentSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Copied Consent Link to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Entra ID /adminconsent URL</span>
                  </>
                )}
              </button>

              <button
                onClick={onClose}
                className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
