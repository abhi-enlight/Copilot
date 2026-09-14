"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import PrismLogo from "@/components/brand/PrismLogo";

export default function SignupPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
          setError(signUpError.message);
        }
        return;
      }

      if (!data.user) {
        setError("Signup failed. Please try again.");
        return;
      }

      // Provision app_users row + personal org via API
      // (server-side with service role to bypass RLS)
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

      router.push("/");
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
        <h1 className="text-xl font-bold text-stone-900">Create account</h1>
        <p className="text-sm text-stone-500 mt-1">
          Your workspace will be set up automatically
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="displayName"
            className="block text-xs font-semibold text-stone-700 mb-1.5"
          >
            Your name
          </label>
          <input
            id="displayName"
            type="text"
            autoComplete="name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Abhinav"
            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder-stone-400 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 transition"
          />
        </div>

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
            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 placeholder-stone-400 outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 transition"
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
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
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
          disabled={loading || !email || !password || !displayName}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background:
              loading || !email || !password || !displayName
                ? "#a78bfa"
                : "linear-gradient(135deg, #0369a1 0%, #2563eb 100%)",
          }}
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      {/* Footer */}
      <p className="mt-6 text-center text-xs text-stone-500">
        Already have an account?{" "}
        <Link
          href="/auth/login"
          className="text-sky-600 font-semibold hover:text-sky-700"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
