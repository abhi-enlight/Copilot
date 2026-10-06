"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import PrismLogo from "@/components/brand/PrismLogo";
import { humanizeError } from "@/lib/errors/humanize";

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-black/[0.08] bg-white text-sm text-[#1C1917] placeholder-[#A8A29E] outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-all duration-150";

export default function SignupPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [isEmailVerificationSent, setIsEmailVerificationSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || !displayName.trim()) return;

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      // Create the Supabase Auth user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { display_name: displayName.trim() },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          setError("An account with this email already exists. Sign in instead.");
        } else {
          setError(humanizeError(signUpError, "auth").description);
        }
        return;
      }

      if (!data.user) {
        setError("Account creation could not be completed. Please try again.");
        return;
      }

      // Provision app_users row + personal org via API
      const provisionRes = await fetch("/api/auth/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authUserId: data.user.id,
          email: email.trim().toLowerCase(),
          displayName: displayName.trim(),
        }),
      });

      if (!provisionRes.ok) {
        console.warn("[signup] provision failed, continuing anyway");
      }

      // If Supabase email confirmation is enabled, session is null
      if (!data.session) {
        setIsEmailVerificationSent(true);
        return;
      }

      router.push("/cockpit");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (isEmailVerificationSent) {
    return (
      <div className="w-full text-center">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50">
          <PrismLogo size={32} variant="tile" />
        </div>
        <h2 className="text-[24px] font-bold tracking-[-0.02em] text-[#1C1917]">Check your email</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#57534E]">
          We sent a confirmation link to{" "}
          <span className="font-semibold text-[#1C1917]">{email}</span>. Confirm it and your
          briefing setup takes about two minutes.
        </p>
        <div className="mt-8">
          <Link
            href="/auth/login"
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#1C1917] px-4 py-3 text-sm font-medium text-white transition-all duration-150 hover:bg-black active:scale-[0.98]"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Brand lockup (mobile only) */}
      <div className="lg:hidden flex items-center gap-2.5 mb-8">
        <PrismLogo size={32} variant="tile" />
        <div>
          <div className="text-[14px] font-bold text-stone-900 leading-none">Prism</div>
          <div className="text-[10.5px] text-stone-400 mt-0.5">Operations Platform</div>
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[#1C1917]">
          Get your first briefing
        </h1>
        <p className="mt-1.5 text-sm text-[#57534E]">
          Two minutes to set up. Tomorrow, your morning is already sorted.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="displayName"
            className="block text-[12px] font-semibold text-stone-700 mb-1.5 tracking-wide uppercase"
          >
            Full Name
          </label>
          <input
            id="displayName"
            type="text"
            autoComplete="name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Jane Doe"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-[12px] font-semibold text-stone-700 mb-1.5 tracking-wide uppercase"
          >
            Work Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@company.com"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-[12px] font-semibold text-stone-700 mb-1.5 tracking-wide uppercase"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className={inputClass}
          />
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <span className="text-red-500 mt-0.5">⚠</span>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email || !password || !displayName}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] cursor-pointer"
          style={{
            background:
              loading || !email || !password || !displayName
                ? "#A8A29E"
                : "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
            boxShadow:
              !loading && email && password && displayName
                ? "0 2px 8px rgba(2, 132, 199, 0.28)"
                : "none",
          }}
        >
          {loading ? "Setting up…" : "Get my first briefing →"}
        </button>
      </form>

      <p className="mt-6 text-center text-[12.5px] text-stone-400">
        Already have an account?{" "}
        <Link
          href="/auth/login"
          className="font-semibold text-sky-700 transition-colors hover:text-sky-800"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
