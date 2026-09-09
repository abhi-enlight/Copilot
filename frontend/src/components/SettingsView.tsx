"use client";

import { useState } from "react";
import {
  GearSix,
  Buildings,
  ShieldCheck,
  Key,
  Users,
  CheckCircle,
  FloppyDisk,
} from "@phosphor-icons/react";

export default function SettingsView() {
  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"workspace" | "zoho" | "guardrails" | "team">("workspace");

  const [settings, setSettings] = useState({
    orgName: "BigCity Promotions Pvt Ltd",
    orgDomain: "bigcity.in",
    portalId: "81293",
    timezone: "Asia/Kolkata (IST)",
    zohoClientId: "1000.QGDY8ZROICOLZXB8M0QK3Q41KZ562H",
    zohoDataCenter: "India (.in)",
    autoPushToZoho: false,
    requireAdvancePaymentSignOff: true,
    requirePartnerLogoSignOff: true,
    uatLeadTimeHours: "72",
    n8nWebhookUrl: "https://indigo-pelican-266513.hostingersite.com/webhook/7a7d4575-950e-4090-84b4-f5bc3a5c6017/chat",
    geminiModel: "gemini-3.7-flash",
    temperature: "0.3",
  });

  const handleSave = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const inputClass = "w-full px-3 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all";
  const labelClass = "block text-xs font-semibold text-stone-700 mb-1.5";

  const tabs = [
    { id: "workspace", label: "Workspace", icon: Buildings },
    { id: "zoho", label: "Zoho Config", icon: Key },
    { id: "guardrails", label: "Compliance Gates", icon: ShieldCheck },
    { id: "team", label: "Roles & Access", icon: Users },
  ] as const;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAFAF9]">
      {/* Header */}
      <header className="h-14 border-b border-stone-200/70 bg-white/90 backdrop-blur-md px-6 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-bold text-stone-900 tracking-tight">Settings</h1>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200">
            BigCity Workspace
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isSaved && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
              <CheckCircle size={13} weight="fill" /> Saved
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-900 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition-all duration-200 cursor-pointer"
          >
            <FloppyDisk size={14} weight="bold" />
            <span>Save Changes</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Underline Tabs */}
        <div className="flex items-center border-b border-stone-200 gap-1">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-all duration-150 cursor-pointer whitespace-nowrap -mb-px ${
                  isActive
                    ? "border-amber-500 text-amber-700"
                    : "border-transparent text-stone-500 hover:text-stone-800"
                }`}
              >
                <Icon size={14} weight={isActive ? "fill" : "bold"} />
                {label}
              </button>
            );
          })}
        </div>

        {/* Tab: Workspace */}
        {activeTab === "workspace" && (
          <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-4">
            <h3 className="text-[13px] font-bold text-stone-900">Organization Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Company / Organization</label>
                <input type="text" value={settings.orgName} onChange={(e) => setSettings({ ...settings, orgName: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Domain</label>
                <input type="text" value={settings.orgDomain} onChange={(e) => setSettings({ ...settings, orgDomain: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Zoho Portal ID</label>
                <input type="text" value={settings.portalId} onChange={(e) => setSettings({ ...settings, portalId: e.target.value })} className={`${inputClass} font-mono`} />
              </div>
              <div>
                <label className={labelClass}>Default Timezone</label>
                <input type="text" value={settings.timezone} disabled className={`${inputClass} bg-stone-100 text-stone-500 font-mono cursor-not-allowed`} />
              </div>
            </div>
          </div>
        )}

        {/* Tab: Zoho Config */}
        {activeTab === "zoho" && (
          <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-4">
            <h3 className="text-[13px] font-bold text-stone-900">Zoho Cloud OAuth & Endpoints</h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Zoho OAuth Client ID</label>
                <input type="text" value={settings.zohoClientId} onChange={(e) => setSettings({ ...settings, zohoClientId: e.target.value })} className={`${inputClass} font-mono`} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Data Center</label>
                  <select value={settings.zohoDataCenter} onChange={(e) => setSettings({ ...settings, zohoDataCenter: e.target.value })} className={inputClass}>
                    <option value="India (.in)">Zoho India (zoho.in)</option>
                    <option value="US (.com)">Zoho US (zoho.com)</option>
                    <option value="EU (.eu)">Zoho EU (zoho.eu)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>AI Reasoning Model</label>
                  <input type="text" value={settings.geminiModel} disabled className={`${inputClass} bg-stone-100 text-stone-500 font-mono cursor-not-allowed`} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Workflow Webhook Endpoint</label>
                <input type="text" value={settings.n8nWebhookUrl} onChange={(e) => setSettings({ ...settings, n8nWebhookUrl: e.target.value })} className={`${inputClass} font-mono text-stone-700`} />
              </div>
            </div>
          </div>
        )}

        {/* Tab: Compliance Guardrails */}
        {activeTab === "guardrails" && (
          <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-4">
            <div>
              <h3 className="text-[13px] font-bold text-stone-900">Mandatory Campaign Compliance Gates</h3>
              <p className="text-xs text-stone-500 mt-0.5">Guardrails preventing campaign deployment without mandatory sign-offs.</p>
            </div>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 rounded-xl bg-stone-50 border border-stone-200 cursor-pointer hover:bg-stone-100 transition-colors">
                <input
                  type="checkbox"
                  checked={settings.requireAdvancePaymentSignOff}
                  onChange={(e) => setSettings({ ...settings, requireAdvancePaymentSignOff: e.target.checked })}
                  className="mt-0.5 w-4 h-4 accent-amber-600 rounded"
                />
                <div>
                  <span className="text-xs font-bold text-stone-900 block">100% Advance Payment Gate (Zoho Books)</span>
                  <span className="text-[11px] text-stone-500 block mt-0.5">Prohibits issuing Purchase Orders until finance confirms 100% receipt in Zoho Books.</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 rounded-xl bg-stone-50 border border-stone-200 cursor-pointer hover:bg-stone-100 transition-colors">
                <input
                  type="checkbox"
                  checked={settings.requirePartnerLogoSignOff}
                  onChange={(e) => setSettings({ ...settings, requirePartnerLogoSignOff: e.target.checked })}
                  className="mt-0.5 w-4 h-4 accent-amber-600 rounded"
                />
                <div>
                  <span className="text-xs font-bold text-stone-900 block">Third-Party Partner Logo Consent Gate</span>
                  <span className="text-[11px] text-stone-500 block mt-0.5">Requires written partner approval email attached before printing run commences.</span>
                </div>
              </label>

              <div className="flex items-center justify-between p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div>
                  <span className="text-xs font-bold text-stone-900 block">Mandatory Staging UAT Lead Time</span>
                  <span className="text-[11px] text-stone-500">Required buffer before Go-Live for multi-device verification.</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={settings.uatLeadTimeHours}
                    onChange={(e) => setSettings({ ...settings, uatLeadTimeHours: e.target.value })}
                    className="w-16 px-2 py-1.5 text-xs font-mono font-bold bg-white border border-stone-300 rounded-lg text-center focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-xs font-semibold text-stone-600">Hours</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Team */}
        {activeTab === "team" && (
          <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-sm space-y-4">
            <h3 className="text-[13px] font-bold text-stone-900">Key Stakeholders & SPOCs</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { name: "Rohit Sharma", role: "Admin & Commercial Head", email: "rohit.sharma@bigcity.in", scope: "Commercial Sign-off & System Administration" },
                { name: "Prashant Mittal", role: "Legal Head & Compliance SPOC", email: "prashant@bigcity.in", scope: "T&C, Partner Consents & CPA Rules" },
                { name: "Sneha Nair", role: "Finance & Accounts Head", email: "sneha.nair@bigcity.in", scope: "Zoho Books Advance Verification & GST" },
                { name: "Sachin", role: "Cloud & Tech Lead", email: "sachin.tech@bigcity.in", scope: "Microsite, DNS & Dual-Gateway Failover" },
                { name: "Khaleel Ahmed", role: "Operations & UAT Lead", email: "khaleel@bigcity.in", scope: "200k Cryptographic QR Codes & UAT" },
              ].map((member, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-stone-900">{member.name}</span>
                    <span className="text-[9.5px] font-semibold px-1.5 py-px rounded bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0">
                      {member.role.split(" ")[0]}
                    </span>
                  </div>
                  <span className="text-[10.5px] font-mono text-stone-400 block">{member.email}</span>
                  <span className="text-[11px] text-stone-600 block mt-1.5">{member.scope}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
