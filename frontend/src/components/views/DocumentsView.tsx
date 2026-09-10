"use client";

import { FolderOpen, MagnifyingGlass, FileText, UploadSimple } from "@phosphor-icons/react";
import BigCityLogo from "@/components/BigCityLogo";

/**
 * Documents, cross-source explorer (Phase 6 feature surface).
 * Phase 3 ships the shell + design; this view will mount the SharePoint/OneDrive
 * connectors (Phase 4) and the document-intelligence features (F5) later.
 */
export default function DocumentsView() {
  const sources = [
    { icon: FolderOpen, title: "OneDrive", note: "Personal and shared files" },
    { icon: FolderOpen, title: "SharePoint", note: "Team sites and document libraries" },
    { icon: UploadSimple, title: "Uploads", note: "CSV · Excel · PDF analysis" },
  ];

  return (
    <div className="flex-1 overflow-y-auto prism-scroll prism-shell-bg">
      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-14 flex flex-col items-center text-center">
        <BigCityLogo size={54} variant="tile" className="mb-5 p-2 rounded-2xl" />
        <h1 className="text-[22px] font-bold tracking-tight text-stone-900">Documents</h1>
        <p className="text-sm text-stone-500 max-w-md mt-2 leading-relaxed">
          Explore and interrogate every file across your drives and the organization knowledge
          base, with answers that cite their sources.
        </p>

        <div className="mt-8 w-full grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          {sources.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-2xs"
              >
                <div className="w-8 h-8 rounded-lg prism-gradient-soft border border-cyan-100 text-cyan-700 flex items-center justify-center mb-2.5">
                  <Icon size={15} weight="duotone" />
                </div>
                <div className="text-[12.5px] font-bold text-stone-900">{s.title}</div>
                <div className="text-[11px] text-stone-500 mt-1 leading-snug">{s.note}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 w-full max-w-md flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-stone-200 shadow-2xs text-stone-400">
          <MagnifyingGlass size={16} />
          <span className="text-[12.5px] font-medium">
            &ldquo;Compare the signed MSA with the latest addendum&rdquo;
          </span>
          <FileText size={15} className="ml-auto text-stone-300" />
        </div>

        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-stone-200 text-[11.5px] font-semibold text-stone-600 shadow-2xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
          </span>
          Coming Soon
        </div>
      </div>
    </div>
  );
}
