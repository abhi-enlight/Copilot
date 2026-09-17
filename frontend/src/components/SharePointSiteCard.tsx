"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Globe,
  ShareNetwork,
  UsersThree,
  Newspaper,
  CheckCircle,
  WarningCircle,
  ArrowsClockwise,
  ArrowSquareOut,
  ShieldCheck,
  PencilSimple,
  X,
} from "@phosphor-icons/react";

export interface SharePointSiteDraftData {
  name: string;
  description?: string;
  webUrl?: string;
  siteSlug?: string;
  template?: "sts" | "sitepagepublishing";
}

interface SharePointSiteCardProps {
  draft: SharePointSiteDraftData;
  onCreated?: (result: { name: string; webUrl: string; siteId?: string }) => void;
  onCancel?: () => void;
}

export default function SharePointSiteCard({
  draft,
  onCreated,
  onCancel,
}: SharePointSiteCardProps) {
  const [name, setName] = useState(draft.name || "");
  const [description, setDescription] = useState(draft.description || "");
  const [siteSlug, setSiteSlug] = useState(
    draft.siteSlug ||
      (draft.name || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
  );
  const [template, setTemplate] = useState<"sts" | "sitepagepublishing">(
    draft.template === "sitepagepublishing" ? "sitepagepublishing" : "sts"
  );

  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [status, setStatus] = useState<"idle" | "created" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(draft.webUrl || null);
  const [requiresReconnect, setRequiresReconnect] = useState(false);
  const [reconnectUrl, setReconnectUrl] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setStatus("error");
      setStatusMessage("Please provide a site name.");
      return;
    }

    setIsCreating(true);
    setStatus("idle");
    setStatusMessage(null);
    setRequiresReconnect(false);

    try {
      const res = await fetch("/api/sharepoint/site/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          siteSlug: siteSlug.trim(),
          template,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus("error");
        setStatusMessage(data.error || "Failed to create SharePoint site.");
        if (data.requiresReconnect) {
          setRequiresReconnect(true);
          setReconnectUrl(
            data.reconnectUrl ||
              "/api/integrations/microsoft/connect?preset=org_sharepoint&prompt=consent&returnTo=/"
          );
        }
        return;
      }

      setStatus("created");
      setCreatedUrl(data.webUrl || null);
      setStatusMessage(data.message || `SharePoint site "${name}" was successfully provisioned.`);
      setIsEditing(false);

      if (onCreated && data.webUrl) {
        onCreated({
          name: data.name || name,
          webUrl: data.webUrl,
          siteId: data.siteId,
        });
      }
    } catch (err: unknown) {
      setStatus("error");
      setStatusMessage(err instanceof Error ? err.message : "Network error creating SharePoint site.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="my-3 rounded-xl border border-indigo-200/80 bg-gradient-to-b from-indigo-50/40 via-white to-white shadow-sm overflow-hidden text-stone-800"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-50/90 to-sky-50/60 border-b border-indigo-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <ShareNetwork size={14} weight="bold" />
          </div>
          <span className="text-xs font-semibold text-indigo-950">
            SharePoint Site Action
          </span>
          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-100/80 text-indigo-700 border border-indigo-200">
            Microsoft 365
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {status === "idle" && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 hover:text-indigo-700 hover:bg-white/80 px-2 py-1 rounded transition-colors"
              title="Edit site details"
            >
              <PencilSimple size={12} weight="bold" />
              <span>{isEditing ? "Done" : "Edit"}</span>
            </button>
          )}
          {onCancel && status === "idle" && (
            <button
              onClick={onCancel}
              className="text-stone-400 hover:text-stone-600 p-1 rounded transition-colors"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Site Name & Template */}
        <div>
          <label className="block text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1">
            Site Title
          </label>
          {isEditing ? (
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!siteSlug || siteSlug === draft.siteSlug) {
                  setSiteSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]/g, "-")
                      .replace(/-+/g, "-")
                      .replace(/^-|-$/g, "")
                  );
                }
              }}
              className="w-full text-sm font-medium px-3 py-1.5 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              placeholder="e.g. Project Pegasus"
            />
          ) : (
            <div className="text-sm font-semibold text-stone-900">{name}</div>
          )}
        </div>

        {/* Site URL Slug Preview */}
        <div>
          <label className="block text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1">
            Site URL Slug
          </label>
          {isEditing ? (
            <div className="flex items-center text-xs font-mono bg-stone-50 rounded-lg border border-stone-200 px-3 py-1.5">
              <span className="text-stone-400 select-none">/sites/</span>
              <input
                type="text"
                value={siteSlug}
                onChange={(e) =>
                  setSiteSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "")
                  )
                }
                className="w-full bg-transparent text-stone-800 font-mono focus:outline-none ml-0.5"
                placeholder="project-slug"
              />
            </div>
          ) : (
            <div className="text-xs font-mono text-indigo-700 bg-indigo-50/50 border border-indigo-100 rounded-md px-2.5 py-1 inline-flex items-center gap-1">
              <Globe size={13} weight="duotone" className="text-indigo-500" />
              <span>/sites/{siteSlug || "site"}</span>
            </div>
          )}
        </div>

        {/* Template Selector */}
        <div>
          <label className="block text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1">
            Site Template
          </label>
          {isEditing ? (
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => setTemplate("sts")}
                className={`flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all ${
                  template === "sts"
                    ? "border-indigo-500 bg-indigo-50/50 text-indigo-950 ring-1 ring-indigo-500"
                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                <UsersThree size={18} weight="bold" className="mt-0.5 text-indigo-600 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Team Site (sts)</div>
                  <div className="text-[10px] text-stone-500 mt-0.5">
                    Collaboration with linked document library & team files.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTemplate("sitepagepublishing")}
                className={`flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all ${
                  template === "sitepagepublishing"
                    ? "border-indigo-500 bg-indigo-50/50 text-indigo-950 ring-1 ring-indigo-500"
                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                <Newspaper size={18} weight="bold" className="mt-0.5 text-indigo-600 shrink-0" />
                <div>
                  <div className="text-xs font-semibold">Communication Site</div>
                  <div className="text-[10px] text-stone-500 mt-0.5">
                    Broadcasting news, resources, and company portals.
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-xs text-stone-700 bg-stone-100/70 border border-stone-200 rounded-md px-2.5 py-1">
              {template === "sts" ? (
                <>
                  <UsersThree size={14} weight="bold" className="text-indigo-600" />
                  <span>Team Site (sts) • Document Library Enabled</span>
                </>
              ) : (
                <>
                  <Newspaper size={14} weight="bold" className="text-indigo-600" />
                  <span>Communication Site (Publishing Portal)</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1">
            Description
          </label>
          {isEditing ? (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              placeholder="Site objective and team purpose..."
            />
          ) : (
            <div className="text-xs text-stone-600 bg-stone-50/60 rounded-md p-2.5 border border-stone-100">
              {description || "No description provided."}
            </div>
          )}
        </div>

        {/* Status Alerts */}
        <AnimatePresence>
          {status === "created" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-emerald-900 text-xs flex flex-col gap-2"
            >
              <div className="flex items-start gap-2">
                <CheckCircle size={16} weight="fill" className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold">{statusMessage}</div>
                  {createdUrl && (
                    <div className="mt-1 font-mono text-[11px] text-emerald-700 break-all">
                      {createdUrl}
                    </div>
                  )}
                </div>
              </div>
              {createdUrl && (
                <div className="pt-1 flex justify-end">
                  <a
                    href={createdUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs transition-colors"
                  >
                    <span>Open in SharePoint</span>
                    <ArrowSquareOut size={13} weight="bold" />
                  </a>
                </div>
              )}
            </motion.div>
          )}

          {status === "error" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-900 text-xs flex items-start gap-2"
            >
              <WarningCircle size={16} weight="fill" className="text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold">{statusMessage}</div>
                {requiresReconnect && (
                  <div className="mt-2 flex items-center gap-2">
                    <a
                      href={
                        reconnectUrl ||
                        "/api/integrations/microsoft/connect?preset=org_sharepoint&prompt=consent&returnTo=/"
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium text-[11px] transition-colors"
                    >
                      <ShareNetwork size={12} weight="bold" />
                      <span>Authorize Site Creation in M365</span>
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Footer */}
      {(status === "idle" || status === "error") && (
        <div className="px-4 py-3 bg-stone-50/80 border-t border-indigo-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
            <ShieldCheck size={14} weight="bold" className="text-indigo-600" />
            <span>Provisions new site via Microsoft Graph API</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-xs shadow-xs transition-colors"
            >
              {isCreating ? (
                <ArrowsClockwise size={13} weight="bold" className="animate-spin" />
              ) : (
                <Globe size={13} weight="bold" />
              )}
              <span>{status === "error" ? "Retry Provisioning" : "Approve & Create Site"}</span>
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
