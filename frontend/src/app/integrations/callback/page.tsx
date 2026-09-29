"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Warning, SpinnerGap } from "@phosphor-icons/react";
import type { ToolConnectionStatus } from "@/types/integrations";

function CallbackContent() {
  const searchParams = useSearchParams();
  const appParam = searchParams.get("app") || searchParams.get("toolkit");
  const errorParam =
    searchParams.get("error_description") ||
    searchParams.get("error") ||
    searchParams.get("message");
  const rawStatus = (searchParams.get("status") || "").toLowerCase();
  const isSuccessParam = searchParams.get("is_success");

  const isExplicitFail = Boolean(
    errorParam || rawStatus === "failed" || rawStatus === "error" || isSuccessParam === "false"
  );

  const [statusState, setStatusState] = useState<"verifying" | "success" | "failed">(
    isExplicitFail ? "failed" : "verifying"
  );
  const [errorMessage, setErrorMessage] = useState<string>(
    isExplicitFail ? (errorParam || "Authorization was denied or failed in the provider.") : ""
  );
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (isExplicitFail) {
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              type: "PRISM_AUTH_FAILED",
              error: errorMessage || "Authorization was denied or failed in the provider.",
              timestamp: Date.now(),
            },
            window.location.origin
          );
        }
      } catch {}
      return;
    }

    // Active verification: check /api/integrations/status
    let attempts = 0;
    const maxAttempts = 4;
    let timerId: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const verifyActiveConnection = async () => {
      attempts++;
      try {
        const queryUrl = appParam
          ? `/api/integrations/status?app=${encodeURIComponent(appParam)}&refresh=true`
          : `/api/integrations/status?refresh=true`;
        const res = await fetch(queryUrl);
        if (!isCancelled && res.ok) {
          const data = await res.json();
          const tools: ToolConnectionStatus[] = data.tools || [];

          let isTargetConnected = false;
          if (appParam) {
            if (data.isConnected === true) {
              isTargetConnected = true;
            } else {
              const match = tools.find((t) => t.slug === appParam);
              isTargetConnected = match?.isConnected === true;
            }
          } else {
            isTargetConnected = tools.some((t) => t.isConnected);
          }

          if (isTargetConnected) {
            setStatusState("success");
            try {
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage(
                  { type: "PRISM_AUTH_SUCCESS", app: appParam, timestamp: Date.now() },
                  window.location.origin
                );
              }
            } catch {}

            timerId = setTimeout(() => {
              try {
                window.close();
                setClosed(true);
              } catch {}
            }, 1500);
            return;
          }
        }
      } catch {}

      if (!isCancelled) {
        if (attempts < maxAttempts) {
          timerId = setTimeout(verifyActiveConnection, 1200);
        } else {
          const failMsg =
            "Authorization could not be confirmed. The connection was cancelled or incomplete.";
          setStatusState("failed");
          setErrorMessage(failMsg);

          try {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage(
                { type: "PRISM_AUTH_FAILED", error: failMsg, timestamp: Date.now() },
                window.location.origin
              );
            }
          } catch {}
        }
      }
    };

    void verifyActiveConnection();

    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [isExplicitFail, errorMessage, appParam]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9] p-6 font-sans">
      <div className="w-full max-w-sm text-center bg-white rounded-2xl border border-black/[0.07] shadow-[0_8px_24px_rgba(0,0,0,0.06),0_16px_48px_rgba(0,0,0,0.04)] p-8">
        {statusState === "verifying" && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 mx-auto mb-4 flex items-center justify-center">
              <SpinnerGap size={28} className="animate-spin" />
            </div>
            <h1 className="text-base font-bold text-stone-900 tracking-tight mb-1">
              Verifying Authorization…
            </h1>
            <p className="text-xs text-stone-500 leading-relaxed">
              Confirming credentials with the Prism Sovereign Vault gateway.
            </p>
          </>
        )}

        {statusState === "success" && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 mx-auto mb-4 flex items-center justify-center">
              <Check size={28} weight="bold" />
            </div>
            <h1 className="text-base font-bold text-stone-900 tracking-tight mb-1">
              Prism Connected
            </h1>
            <p className="text-xs text-stone-500 leading-relaxed mb-6">
              Authorization was confirmed successfully. Returning to the Prism Operations Cockpit…
            </p>
            <button
              type="button"
              onClick={() => window.close()}
              className="w-full py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              {closed ? "Window Closing…" : "Close Window"}
            </button>
          </>
        )}

        {statusState === "failed" && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 text-red-600 mx-auto mb-4 flex items-center justify-center">
              <Warning size={28} weight="bold" />
            </div>
            <h1 className="text-base font-bold text-stone-900 tracking-tight mb-1">
              Connection Incomplete
            </h1>
            <p className="text-xs text-stone-600 leading-relaxed mb-2">
              {errorMessage}
            </p>
            <p className="text-[11px] text-stone-400 mb-6">
              No changes were made to your workspace. You can retry from the Connect Hub.
            </p>
            <button
              type="button"
              onClick={() => window.close()}
              className="w-full py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              Close Window
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function IntegrationsCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9] p-6 font-sans">
          <div className="w-full max-w-sm text-center bg-white rounded-2xl p-8 border border-stone-200">
            <SpinnerGap size={24} className="animate-spin text-stone-400 mx-auto mb-2" />
            <p className="text-xs text-stone-500">Loading…</p>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
