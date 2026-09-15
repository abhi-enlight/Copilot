"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import PrismLogo from "@/components/brand/PrismLogo";

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
        setError(otpError.message);
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
        <p className="text-sm text-stone-500 mt-1">Enter your credentials to access your account</p>
      </div>

      <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
            placeholder="name@example.com"
            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder-stone-400 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 transition"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-xs font-semibold text-stone-700">
              Password
            </label>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
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
          disabled={loading || magicLinkLoading || !email || !password}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background:
              loading || !email || !password
                ? "#a78bfa"
                : "linear-gradient(135deg, #0369a1 0%, #2563eb 100%)",
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        onClick={handleMagicLink}
        disabled={loading || magicLinkLoading || !email}
        className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {magicLinkLoading ? "Sending link…" : "Email me a sign-in link instead"}
      </button>

      <p className="mt-6 text-center text-xs text-stone-500">
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
