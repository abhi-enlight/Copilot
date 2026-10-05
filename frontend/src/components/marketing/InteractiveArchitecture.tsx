"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldCheck,
  LockKey,
  ArrowsLeftRight,
} from "@phosphor-icons/react";

interface NodeDetail {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  specs: { label: string; value: string }[];
  description: string;
}

const ARCHITECTURE_NODES: Record<string, NodeDetail> = {
  aggregation: {
    id: "aggregation",
    badge: "Layer 01 / Omnichannel Ingestion",
    title: "Universal Data Mesh Across 12 Toolkits",
    subtitle: "Hardware-isolated per-user OAuth with real-time webhooks and SSE pipelines",
    specs: [
      { label: "Coverage", value: "Microsoft 365, Zoho Suite, Google, Linear, GitHub, Slack" },
      { label: "Isolation", value: "Hardware-encrypted per-user vaults, zero tenant mixing" },
      { label: "Transport", value: "Server-Sent Events and fail-closed webhook ingestion" },
    ],
    description:
      "Unlike vendor-locked copilots that only see Outlook or only see Google, Prism unifies your entire operating stack without migrating a single database.",
  },
  classifier: {
    id: "classifier",
    badge: "Layer 02 / Deterministic Gatekeeper",
    title: "Fail-Closed Safety Classifier",
    subtitle: "Runtime code boundary separates safe queries from external state writes",
    specs: [
      { label: "Read Path", value: "Instant query execution for morning briefings" },
      { label: "Write Path", value: "Deterministic interception with staged action card" },
      { label: "Hard Policy", value: "Destructive deletes, credential export, and money movement blocked" },
    ],
    description:
      "A software boundary that prompt injection cannot bypass. If a model generates an action that modifies state anywhere in the world, execution halts until human sign-off.",
  },
  ledger: {
    id: "ledger",
    badge: "Layer 03 / Cryptographic Verifiability",
    title: "Append-Only Verification Ledger",
    subtitle: "SHA-256 signed proposal lifecycle with row-level security",
    specs: [
      { label: "Payload Hash", value: "Cryptographic SHA-256 digest calculated before review" },
      { label: "Audit Record", value: "Immutable timestamp, approving actor, exact API response" },
      { label: "Auto Expiry", value: "Unreviewed proposals self-destruct after 24 hours" },
    ],
    description:
      "Complete auditability for leadership and compliance teams. Every email sent, deal stage updated, or issue resolved leaves an unforgeable digital receipt.",
  },
};

export default function InteractiveArchitecture() {
  const [selectedNode, setSelectedNode] = useState<string>("classifier");
  const active = ARCHITECTURE_NODES[selectedNode];

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="rounded-2xl border border-black/[0.08] bg-black/[0.02] p-2 sm:p-2.5 shadow-lg">
        <div className="rounded-xl border border-black/[0.06] bg-[#FAFAF9] p-6 sm:p-8">
          {/* Top selector buttons */}
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                id: "aggregation",
                icon: <ArrowsLeftRight size={20} weight="duotone" className="text-sky-600" />,
                title: "1. Cross-Suite Mesh",
                desc: "12 connected toolkits",
              },
              {
                id: "classifier",
                icon: <ShieldCheck size={20} weight="duotone" className="text-emerald-600" />,
                title: "2. Safety Gatekeeper",
                desc: "Fail-closed classification",
              },
              {
                id: "ledger",
                icon: <LockKey size={20} weight="duotone" className="text-indigo-600" />,
                title: "3. Cryptographic Ledger",
                desc: "Immutable audit trail",
              },
            ].map((node) => {
              const isSelected = selectedNode === node.id;
              return (
                <button
                  key={node.id}
                  onClick={() => setSelectedNode(node.id)}
                  className={`group relative flex items-start gap-3.5 rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "border-sky-500/50 bg-sky-50/50 shadow-xs"
                      : "border-black/[0.08] bg-[#F5F5F4] hover:border-black/[0.14] hover:bg-[#EFECE8]"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border transition-colors ${
                      isSelected
                        ? "border-sky-200 bg-white shadow-xs"
                        : "border-black/[0.06] bg-white group-hover:bg-[#EFECE8]"
                    }`}
                  >
                    {node.icon}
                  </div>
                  <div>
                    <h4
                      className={`text-[13.5px] font-semibold transition-colors ${
                        isSelected ? "text-[#0369a1]" : "text-[#1C1917]"
                      }`}
                    >
                      {node.title}
                    </h4>
                    <p className="mt-0.5 text-[12px] text-[#78716C]">{node.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Deep inspection panel */}
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 rounded-xl border border-black/[0.08] bg-[#F5F5F4] p-6 sm:p-7"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] pb-4">
                <div>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0284c7]">
                    {active.badge}
                  </p>
                  <h3 className="mt-1 text-xl font-bold tracking-tight text-[#1C1917] sm:text-2xl">
                    {active.title}
                  </h3>
                  <p className="mt-1 text-[13px] text-[#57534E]">{active.subtitle}</p>
                </div>
              </div>

              <p className="mt-4 text-[14px] leading-relaxed text-[#44403C]">{active.description}</p>

              {/* Interactive Schematic Conduit */}
              <div className="mt-6 rounded-xl border border-black/[0.06] bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-black/[0.05] pb-3">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#78716C]">
                    Interactive Dataflow Conduit
                  </span>
                  <span className="font-mono text-[11px] font-medium text-emerald-600">
                    REAL-TIME RUNTIME PATHWAY
                  </span>
                </div>

                {active.id === "aggregation" && (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-black/[0.06] bg-[#FAFAF9] p-3">
                        <span className="font-mono text-[10px] uppercase text-[#78716C]">Step 01 / Authentication</span>
                        <h5 className="mt-1 text-[13px] font-semibold text-[#1C1917]">Scoped OAuth Vaults</h5>
                        <p className="mt-1 text-[11.5px] text-[#57534E]">Per-user tokens stored in hardware-encrypted enclave.</p>
                      </div>
                      <div className="rounded-lg border border-black/[0.06] bg-[#FAFAF9] p-3">
                        <span className="font-mono text-[10px] uppercase text-[#78716C]">Step 02 / Ingestion</span>
                        <h5 className="mt-1 text-[13px] font-semibold text-[#1C1917]">Composio SSE Streams</h5>
                        <p className="mt-1 text-[11.5px] text-[#57534E]">Webhooks ingest real-time events across 12 toolkits.</p>
                      </div>
                      <div className="rounded-lg border border-black/[0.06] bg-[#FAFAF9] p-3">
                        <span className="font-mono text-[10px] uppercase text-[#78716C]">Step 03 / Synthesis</span>
                        <h5 className="mt-1 text-[13px] font-semibold text-[#1C1917]">Unified Operations Matrix</h5>
                        <p className="mt-1 text-[11.5px] text-[#57534E]">Cross-suite context merged into morning briefing.</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[0.05] bg-[#F5F5F4]/60 px-4 py-2 font-mono text-[11px] text-[#78716C]">
                      <span>P95 INGESTION LATENCY: 38MS</span>
                      <span>TENANT ISOLATION: 100% ENFORCED</span>
                      <span>ACTIVE TOOLKITS: 12</span>
                    </div>
                  </div>
                )}

                {active.id === "classifier" && (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-black/[0.06] bg-[#FAFAF9] p-3">
                        <span className="font-mono text-[10px] uppercase text-[#78716C]">Phase 01 / AST Inspection</span>
                        <h5 className="mt-1 text-[13px] font-semibold text-[#1C1917]">Deterministic Parsing</h5>
                        <p className="mt-1 text-[11.5px] text-[#57534E]">Model-generated tool call is intercepted before runtime.</p>
                      </div>
                      <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/40 p-3">
                        <span className="font-mono text-[10px] uppercase text-emerald-800">Branch A / Read Only</span>
                        <h5 className="mt-1 text-[13px] font-semibold text-emerald-950">Inline Safe Query</h5>
                        <p className="mt-1 text-[11.5px] text-emerald-900">GET queries execute in 12ms into morning briefing stream.</p>
                      </div>
                      <div className="rounded-lg border border-amber-200/70 bg-amber-50/40 p-3">
                        <span className="font-mono text-[10px] uppercase text-amber-800">Branch B / External Write</span>
                        <h5 className="mt-1 text-[13px] font-semibold text-amber-950">Fail-Closed Gatekeeper</h5>
                        <p className="mt-1 text-[11.5px] text-amber-900">State mutations halt; signed action proposal is minted.</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[0.05] bg-[#F5F5F4]/60 px-4 py-2 font-mono text-[11px] text-[#78716C]">
                      <span>POLICY REFUSAL: DETERMINISTIC</span>
                      <span>PROMPT INJECTION BYPASS: IMPOSSIBLE</span>
                      <span>SIGN-OFF GATE: REQUIRED</span>
                    </div>
                  </div>
                )}

                {active.id === "ledger" && (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-black/[0.06] bg-[#FAFAF9] p-3">
                        <span className="font-mono text-[10px] uppercase text-[#78716C]">Hash 01 / Payload Digest</span>
                        <h5 className="mt-1 text-[13px] font-semibold text-[#1C1917]">SHA-256 Generation</h5>
                        <p className="mt-1 text-[11.5px] text-[#57534E]">Payload is hashed prior to human presentation.</p>
                      </div>
                      <div className="rounded-lg border border-black/[0.06] bg-[#FAFAF9] p-3">
                        <span className="font-mono text-[10px] uppercase text-[#78716C]">Hash 02 / Human Review</span>
                        <h5 className="mt-1 text-[13px] font-semibold text-[#1C1917]">Cryptographic Signature</h5>
                        <p className="mt-1 text-[11.5px] text-[#57534E]">Sign-off binds approving user ID and exact timestamp.</p>
                      </div>
                      <div className="rounded-lg border border-black/[0.06] bg-[#FAFAF9] p-3">
                        <span className="font-mono text-[10px] uppercase text-[#78716C]">Hash 03 / Persistence</span>
                        <h5 className="mt-1 text-[13px] font-semibold text-[#1C1917]">Append-Only Audit Log</h5>
                        <p className="mt-1 text-[11.5px] text-[#57534E]">Row-level security prevents alteration; auto-purges at 24h.</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[0.05] bg-[#F5F5F4]/60 px-4 py-2 font-mono text-[11px] text-[#78716C]">
                      <span>HASH ALGORITHM: SHA-256</span>
                      <span>TAMPER TOLERANCE: ZERO</span>
                      <span>EXPIRY WINDOW: 24 HOURS</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Technical Specifications */}
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {active.specs.map((spec) => (
                  <div key={spec.label} className="rounded-lg border border-black/[0.06] bg-white p-3.5 shadow-xs">
                    <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[#78716C]">
                      {spec.label}
                    </span>
                    <p className="mt-1 text-[12.5px] font-medium leading-snug text-[#1C1917]">{spec.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
