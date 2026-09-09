"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  ShieldWarning,
  Copy,
  Check,
  ArrowSquareOut,
  EnvelopeSimple,
  FolderOpen,
  Briefcase,
  Sparkle,
  ArrowRight,
  ShieldCheck,
} from "@phosphor-icons/react";

interface AdminApprovalModalProps {
  open: boolean;
  onClose: () => void;
  onSwitchToZoho?: () => void;
}

export default function AdminApprovalModal({
  open,
  onClose,
  onSwitchToZoho,
}: AdminApprovalModalProps) {
  const [copied, setCopied] = useState(false);

  const clientId = "9b9717eb-8dbf-41b1-b788-d7a3ae6f4269";
  const redirectUri = typeof window !== "undefined"
    ? `${window.location.origin}/api/integrations/microsoft/callback`
    : "http://localhost:3000/api/integrations/microsoft/callback";

  const adminConsentUrl = `https://login.microsoftonline.com/common/adminconsent?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(adminConsentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback if clipboard API is blocked
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-950/50 backdrop-blur-xs"
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label="Admin approval required fallback"
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden z-10 max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-start justify-between border-b border-stone-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <ShieldWarning size={22} weight="duotone" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-stone-900 leading-tight">
                    Microsoft IT Admin Approval Fallbacks
                  </h3>
                  <p className="text-[11.5px] text-stone-500 mt-0.5">
                    Your tenant restricts standard users from consenting to Dynamics 365 or elevated write scopes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            {/* Content / Fallbacks */}
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <p className="text-[12.5px] text-stone-600 leading-relaxed">
                You do not have to wait for IT admin approval to continue your campaign work. You can connect Outlook and SharePoint right now, or use alternative data sources:
              </p>

              {/* Fallback Option 1: Outlook & SharePoint / OneDrive (No Admin Required) */}
              <div className="p-4 rounded-2xl bg-stone-50/80 border border-stone-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-stone-900 font-semibold text-[13px]">
                    <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold flex items-center justify-center">
                      1
                    </span>
                    <span>Connect Outlook & SharePoint / OneDrive</span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck size={11} weight="bold" />
                    <span>No Admin Needed</span>
                  </span>
                </div>
                <p className="text-[11.5px] text-stone-500 leading-relaxed pl-7">
                  You can connect your <strong className="text-stone-700 font-semibold">Outlook emails</strong> and <strong className="text-stone-700 font-semibold">SharePoint / OneDrive files</strong> right now using standard delegated permissions (<code className="text-[10.5px] bg-white px-1 py-0.5 rounded border border-stone-200">Mail.Read</code> & <code className="text-[10.5px] bg-white px-1 py-0.5 rounded border border-stone-200">Files.Read</code>). Enterprise users can self-consent immediately without waiting for IT.
                </p>
                <div className="pt-1 pl-7 flex flex-wrap items-center gap-2">
                  <a
                    href="/api/integrations/microsoft/connect?preset=readonly&returnTo=/"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-[12px] font-semibold transition-colors shadow-2xs"
                  >
                    <EnvelopeSimple size={14} weight="bold" />
                    <FolderOpen size={14} weight="bold" />
                    <span>Connect Outlook + SharePoint</span>
                    <ArrowSquareOut size={12} weight="bold" />
                  </a>
                  <a
                    href="/api/integrations/microsoft/connect?preset=mail_readonly&returnTo=/"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-stone-300 text-stone-700 text-[11px] font-medium transition-colors"
                  >
                    <EnvelopeSimple size={13} />
                    <span>Outlook Only</span>
                  </a>
                  <a
                    href="/api/integrations/microsoft/connect?preset=files_readonly&returnTo=/"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-stone-200 hover:border-stone-300 text-stone-700 text-[11px] font-medium transition-colors"
                  >
                    <FolderOpen size={13} />
                    <span>SharePoint / OneDrive Only</span>
                  </a>
                </div>
              </div>

              {/* Fallback Option 2: Alternative CRM & Hybrid Stack */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-950 font-semibold text-[13px]">
                    <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 text-[11px] font-bold flex items-center justify-center">
                      2
                    </span>
                    <Sparkle size={15} weight="duotone" className="text-emerald-600" />
                    <span>Alternative CRM + Outlook & SharePoint</span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                </div>
                <p className="text-[11.5px] text-emerald-800/90 leading-relaxed pl-7">
                  You can pair <span className="font-semibold text-emerald-900">Zoho CRM</span>, <span className="font-semibold text-emerald-900">Zoho Projects</span>, or the <span className="font-semibold text-emerald-900">Knowledge Base</span> for pipeline and deal data, while keeping <span className="font-semibold text-emerald-900">Outlook Mail</span> and <span className="font-semibold text-emerald-900">SharePoint / OneDrive</span> connected for email threads and client briefs. Neither Zoho nor Knowledge Base requires Microsoft IT admin consent.
                </p>
                <div className="pt-1 pl-7 flex flex-wrap items-center gap-2">
                  {onSwitchToZoho && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSwitchToZoho();
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[12px] font-semibold transition-colors shadow-2xs cursor-pointer"
                    >
                      <Briefcase size={14} weight="duotone" />
                      <span>Switch to Zoho CRM & Knowledge Base</span>
                      <ArrowRight size={12} weight="bold" />
                    </button>
                  )}
                  <a
                    href="/api/integrations/microsoft/connect?preset=readonly&returnTo=/"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-emerald-300 hover:border-emerald-400 text-emerald-900 text-[11.5px] font-semibold transition-colors shadow-2xs"
                  >
                    <FolderOpen size={13} weight="bold" className="text-blue-600" />
                    <EnvelopeSimple size={13} weight="bold" className="text-sky-600" />
                    <span>Connect Outlook & SharePoint</span>
                  </a>
                </div>
              </div>

              {/* Fallback Option 3: Send Admin Consent Link to IT */}
              <div className="p-4 rounded-2xl bg-stone-50/80 border border-stone-200/80 space-y-2">
                <div className="flex items-center gap-2 text-stone-900 font-semibold text-[13px]">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold flex items-center justify-center">
                    3
                  </span>
                  <span>Ask Your IT Administrator to Approve Dynamics 365</span>
                </div>
                <p className="text-[11.5px] text-stone-500 leading-relaxed pl-7">
                  If you need direct Microsoft Dataverse CRM synchronization, send this one-click link to any M365 administrator. Once an admin approves it once, all users in your organization will be unlocked.
                </p>
                <div className="pt-1 pl-7 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-300 hover:border-stone-400 text-stone-700 text-[11.5px] font-semibold transition-colors shadow-2xs cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check size={13} weight="bold" className="text-emerald-600" />
                        <span className="text-emerald-700">Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} weight="bold" />
                        <span>Copy Admin Approval URL</span>
                      </>
                    )}
                  </button>
                  <span className="text-[10.5px] text-stone-400 font-mono truncate max-w-[200px]">
                    .../common/adminconsent?client_id=...
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-stone-100 bg-stone-50/50 flex items-center justify-end flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-[12.5px] font-semibold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
