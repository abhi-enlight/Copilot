"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import PrismLogo from "@/components/brand/PrismLogo";
import { humanizeError } from "@/lib/errors/humanize";

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder-stone-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all duration-150";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/";
  const magicLinkSent = searchParams.get("magic") === "sent";

  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    magicLinkSent ? "Check your inbox — we sent you a sign-in link." : null
  );
  const [loading, setLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);

  // ── Password sign-in via Supabase ──────────────────────────────────────────
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setError(null);
    setNotice(null);
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
          setError("Incorrect email or password. Please double-check and try again.");
        } else if (signInError.message.includes("Email not confirmed")) {
          setError("Please check your email and confirm your account first.");
        } else {
          setError(humanizeError(signInError, "auth").description);
        }
        return;
      }

      router.push(returnTo);
      router.refresh();
    } catch {
      setError("Unable to connect to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Passwordless Magic Link via Supabase ───────────────────────────────────
  const handleMagicLink = async () => {
    if (!email.trim()) {
      setError("Please enter your email first to receive a sign-in link.");
      return;
    }

    setError(null);
    setNotice(null);
    setMagicLinkLoading(true);

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
        },
      });
      if (otpError) {
        setError(humanizeError(otpError, "auth").description);
        return;
      }
      try {
        sessionStorage.setItem("prism_magic_return_to", returnTo);
      } catch {}
      setNotice("Check your inbox — we sent you a magic sign-in link.");
    } catch {
      setError("Could not send the sign-in link. Try again.");
    } finally {
      setMagicLinkLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Brand lockup (shown on mobile, hidden on desktop where left panel shows it) */}
      <div className="lg:hidden flex items-center gap-2.5 mb-8">
        <PrismLogo size={32} variant="tile" />
        <div>
          <div className="text-[14px] font-bold text-stone-900 leading-none">Prism</div>
          <div className="text-[10.5px] text-stone-400 mt-0.5">Operations Platform</div>
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-[26px] font-bold text-stone-900 tracking-[-0.025em] leading-tight">
          Sign in
        </h1>
        <p className="text-sm text-stone-500 mt-1.5">
          Enter your credentials to access your operational cockpit.
        </p>
      </div>

      <form onSubmit={handlePasswordSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-[12px] font-semibold text-stone-700 mb-1.5 tracking-wide uppercase">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-[12px] font-semibold text-stone-700 mb-1.5 tracking-wide uppercase">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className={inputClass}
          />
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <span className="text-red-500 mt-0.5">⚠</span>
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3 text-sm text-indigo-800">
            {notice}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || magicLinkLoading || !email || !password}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer"
          style={{
            background:
              loading || !email || !password
                ? "#94a3b8"
                : "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
            boxShadow:
              !loading && email && password
                ? "0 2px 8px rgba(99, 102, 241, 0.3)"
                : "none",
          }}
        >
          {loading ? "Signing in…" : "Sign in →"}
        </button>
      </form>

      <div className="mt-3 relative flex items-center gap-3">
        <div className="flex-1 h-px bg-stone-100" />
        <span className="text-[11px] text-stone-400">or</span>
        <div className="flex-1 h-px bg-stone-100" />
      </div>

      <button
        type="button"
        onClick={handleMagicLink}
        disabled={loading || magicLinkLoading || !email}
        className="mt-3 w-full py-3 rounded-xl text-sm font-semibold text-stone-700 bg-stone-50 hover:bg-stone-100 border border-stone-200 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {magicLinkLoading ? "Sending link…" : "Email me a sign-in link"}
      </button>

      <p className="mt-6 text-center text-[12.5px] text-stone-400">
        Don&apos;t have an account?{" "}
        <Link href="/auth/signup" className="text-indigo-600 font-semibold hover:text-indigo-700 transition-colors">
          Create one
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  useEffect(() => {
    // Exchange a magic-link / recovery code in the URL hash for a session
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
        <div className="w-full space-y-4 animate-pulse">
          <div className="h-10 bg-stone-100 rounded-xl" />
          <div className="h-12 bg-stone-100 rounded-xl" />
          <div className="h-12 bg-stone-100 rounded-xl" />
          <div className="h-12 bg-stone-100 rounded-xl" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
