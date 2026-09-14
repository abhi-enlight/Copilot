"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import PrismLogo from "@/components/brand/PrismLogo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
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

  return (
    <div className="w-full max-w-sm">
      {/* Brand lockup */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2.5 mb-5">
          <PrismLogo size={36} variant="tile" />
          <div className="text-left">
            <div className="text-[14px] font-bold text-stone-900 leading-none">
              Prism
            </div>
            <div className="text-[10.5px] text-stone-400 leading-none mt-1">
              by{" "}
              <span className="text-blue-600 font-semibold">Enlight Lab</span>
            </div>
          </div>
        </div>
        <h1 className="text-xl font-bold text-stone-900">Sign in</h1>
        <p className="text-sm text-stone-500 mt-1">
          Enter your email and password to continue
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold text-stone-700 mb-1.5"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder-stone-400 outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-stone-700 mb-1.5"
          >
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
            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder-stone-400 outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition"
          />
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm text-rose-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background:
              loading || !email || !password
                ? "#a78bfa"
                : "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {/* Footer */}
      <p className="mt-6 text-center text-xs text-stone-500">
        Don&apos;t have an account?{" "}
        <Link
          href="/auth/signup"
          className="text-violet-600 font-semibold hover:text-violet-700"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
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
