'use client';

import React, { useState } from 'react';
import { KeyRound, Copy, Check, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { REQUIRED_ENTRA_SCOPES } from '@/lib/constants';
import { copyToClipboard } from '@/lib/utils';

type AdminConsentModalProps = {
  isOpen: boolean;
  /** Entra tenant to target; defaults to multi-tenant "common" (plan §4.3). */
  tenantId?: string;
  /** Optional context used in the pre-drafted IT helpdesk email. */
  userEmail?: string | null;
  showConsentSuccess: boolean;
  setShowConsentSuccess: (success: boolean) => void;
  onClose: () => void;
};

/**
 * Enterprise IT Admin Consent helper (plan §4.3).
 *
 * When a non-admin enterprise user hits AADSTS65001 or a missing Dataverse
 * role, this modal hands them the two artifacts they need:
 *  1. A 1-click Entra ID admin consent URL with a redirect URI that actually
 *     matches the Azure App Registration (the app's Microsoft OAuth callback),
 *     not a placeholder subdomain.
 *  2. A pre-drafted helpdesk email with the exact scopes and justification,
 *     copied to the clipboard ready to paste into their IT ticket system.
 */
export function AdminConsentModal({
  isOpen,
  tenantId,
  userEmail,
  showConsentSuccess,
  setShowConsentSuccess,
  onClose
}: AdminConsentModalProps) {
  const [emailCopied, setEmailCopied] = useState(false);

  // The redirect URI MUST be registered on the Azure App Registration.
  // Same-origin, derived from the current host — works in dev and prod.
  const redirectUri = typeof window !== 'undefined'
    ? `${window.location.origin}/api/integrations/microsoft/callback`
    : '/api/integrations/microsoft/callback';

  const clientId = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '';
  const consentUrl = `https://login.microsoftonline.com/${tenantId || 'common'}/adminconsent?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  const state = userEmail ? `Consent requested by: ${userEmail}` : '';
  const helpdeskSubject = 'Action required: approve Prism (Enlight Lab) app consent for Microsoft 365 access';
  const helpdeskBody = `Hello IT team,

I need access to the Prism operations workspace (by Enlight Lab), which connects to our Microsoft 365 tenant. My account is currently blocked by missing admin consent${userEmail ? ` (account: ${userEmail})` : ''}.

Please approve the app's tenant-wide admin consent by opening this one-click link while signed in with an admin account:

${consentUrl}

The app requests the following Microsoft Graph / Dataverse scopes:
${REQUIRED_ENTRA_SCOPES.map((s) => `  - ${s}`).join('\n')}

Justification: Prism is used to read Outlook mail, SharePoint/OneDrive documents and (for licensed users) Dynamics 365 CRM data into a unified operations dashboard. Access is per-user and audited; no data is modified without explicit approval.
${state ? `\n${state}\n` : ''}
Thank you!`;

  const handleCopyConsent = async () => {
    const success = await copyToClipboard(consentUrl);
    if (success) {
      setShowConsentSuccess(true);
      setTimeout(() => setShowConsentSuccess(false), 2500);
    }
  };

  const handleCopyEmail = async () => {
    const success = await copyToClipboard(`Subject: ${helpdeskSubject}\n\n${helpdeskBody}`);
    if (success) {
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2500);
    }
  };

  const handleOpenMailClient = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent(helpdeskSubject)}&body=${encodeURIComponent(helpdeskBody)}`;
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
                <p className="text-xs text-slate-500">Microsoft Entra ID &amp; Dynamics 365 Scope Resolution</p>
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
                  <div key={idx} className="text-sky-700">
                    • {scope}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleCopyConsent}
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

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleCopyEmail}
                  className="py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all"
                >
                  {emailCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Email copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy IT email</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleOpenMailClient}
                  className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Open in mail app</span>
                </button>
              </div>

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
