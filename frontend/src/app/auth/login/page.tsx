"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import PrismLogo from "@/components/brand/PrismLogo";
import { ArrowLeft } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/";
  const magicLinkSent = searchParams.get("magic") === "sent";

  const supabase = createClient();

  // ── Identifier-first state machine: "identifier" → "password" | "sso" ──
  const [step, setStep] = useState<"identifier" | "password">(magicLinkSent ? "password" : "identifier");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    magicLinkSent ? "Check your inbox — we sent you a sign-in link." : null
  );
  const [loading, setLoading] = useState(false);
  const [ssoChecking, setSsoChecking] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);

  // ── Step 1: identifier lookup (plan §3) ─────────────────────────────────────
  const handleIdentifierContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setError(null);
    setSsoChecking(true);

    try {
      const res = await fetch("/api/auth/sso-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();

      if (data?.sso) {
        // Verified enterprise domain: forward to the Microsoft SSO endpoint
        // (plan §3.1). The existing Microsoft connect route IS the app's
        // Entra ID entry point, so reuse it with a login hint.
        sessionStorage.setItem("prism_magic_return_to", returnTo);
        window.location.href = `/api/integrations/microsoft/connect?preset=readonly&login_hint=${encodeURIComponent(
          email.trim().toLowerCase()
        )}`;
        return;
      }

      setShowMagicLink(true);
      setStep("password");
    } catch {
      // Lookup service unavailable — degrade to the classic password form.
      setStep("password");
    } finally {
      setSsoChecking(false);
    }
  };

  // ── Step 2a: password sign-in ────────────────────────────────────────────────
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        if (
          signInError.message.includes("Invalid login credentials") ||
          signInError.message.includes("invalid_credentials")
        ) {
          setError("Incorrect email or password.");
        } else if (signInError.message.includes("Email not confirmed")) {
          setError("Check your email and confirm your account first.");
        } else {
          setError(signInError.message);
        }
        return;
      }

      router.push(returnTo);
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2b: magic link (plan §2, "Login Methods") ──────────────────────────
  const handleMagicLink = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
        },
      });
      if (otpError) {
        setError(otpError.message);
        return;
      }
      // Persist the intended destination for the post-verification redirect.
      try {
        sessionStorage.setItem("prism_magic_return_to", returnTo);
      } catch {}
      router.push("/auth/login?magic=sent");
    } catch {
      setError("Could not send the sign-in link. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep("identifier");
    setPassword("");
    setError(null);
    setNotice(null);
  };

  // ── Identifier step ──────────────────────────────────────────────────────────
  if (step === "identifier") {
    return (
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2.5 mb-5">
            <PrismLogo size={36} variant="tile" />
            <div className="text-left">
              <div className="text-[14px] font-bold text-stone-900 leading-none">Prism</div>
              <div className="text-[10.5px] text-stone-400 leading-none mt-1">
                by <span className="text-blue-600 font-semibold">Enlight Lab</span>
              </div>
            </div>
          </div>
          <h1 className="text-xl font-bold text-stone-900">Sign in</h1>
          <p className="text-sm text-stone-500 mt-1">Enter your work email to continue</p>
        </div>

        <form onSubmit={handleIdentifierContinue} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-stone-700 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder-stone-400 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 transition"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || ssoChecking || !email}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background:
                loading || ssoChecking || !email
                  ? "#a78bfa"
                  : "linear-gradient(135deg, #0369a1 0%, #2563eb 100%)",
            }}
          >
            {ssoChecking ? "Checking…" : "Continue"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-stone-500">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="text-sky-600 font-semibold hover:text-sky-700">
            Sign up
          </Link>
        </p>
      </div>
    );
  }

  // ── Password / magic link step ───────────────────────────────────────────────
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2.5 mb-5">
          <PrismLogo size={36} variant="tile" />
          <div className="text-left">
            <div className="text-[14px] font-bold text-stone-900 leading-none">Prism</div>
            <div className="text-[10.5px] text-stone-400 leading-none mt-1">
              by <span className="text-blue-600 font-semibold">Enlight Lab</span>
            </div>
          </div>
        </div>
        <h1 className="text-xl font-bold text-stone-900">Welcome back</h1>
        <p className="text-sm text-stone-500 mt-1 truncate">
          Signing in as <span className="font-medium text-stone-700">{email}</span>
        </p>
      </div>

      <form onSubmit={handlePasswordSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-xs font-semibold text-stone-700 mb-1.5">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder-stone-400 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 transition"
          />
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm text-rose-700">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-xl bg-sky-50 border border-sky-200 px-4 py-2.5 text-sm text-sky-800">
            {notice}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background:
              loading || !password ? "#a78bfa" : "linear-gradient(135deg, #0369a1 0%, #2563eb 100%)",
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {showMagicLink && (
        <button
          type="button"
          onClick={handleMagicLink}
          disabled={loading}
          className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition disabled:opacity-50"
        >
          Email me a sign-in link instead
        </button>
      )}

      <button
        type="button"
        onClick={handleBack}
        className="mt-5 mx-auto flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition"
      >
        <ArrowLeft size={13} />
        Use a different email
      </button>

      <p className="mt-4 text-center text-xs text-stone-500">
        Don&apos;t have an account?{" "}
        <Link href="/auth/signup" className="text-sky-600 font-semibold hover:text-sky-700">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  useEffect(() => {
    // Exchange a magic-link / recovery code in the URL hash for a session
    // (Supabase SSR pkce flow lands back on this page with #access_token=...).
    const hash = window.location.hash;
    if (hash.includes("access_token=")) {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          const returnTo = sessionStorage.getItem("prism_magic_return_to") || "/";
          sessionStorage.removeItem("prism_magic_return_to");
          window.location.href = returnTo;
        }
      });
    }
  }, []);

  return (
    <Suspense
      fallback={
        <div className="w-full max-w-sm animate-pulse space-y-4">
          <div className="h-8 bg-stone-200 rounded-xl" />
          <div className="h-10 bg-stone-200 rounded-xl" />
          <div className="h-10 bg-stone-200 rounded-xl" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
