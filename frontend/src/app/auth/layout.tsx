import type { Metadata } from "next";
import PrismLogo from "@/components/brand/PrismLogo";

export const metadata: Metadata = {
  // The root layout appends " · Prism", so this must not repeat the brand.
  title: "Sign in",
  description: "Sign in to Prism by Enlight Lab",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#FAFAF9] font-[family-name:var(--font-geist-sans)]">
      {/* Left: ambient brand panel (hidden on mobile) */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-[45%] xl:w-1/2">
        {/* The same sky-to-sunrise wash as the landing page hero */}
        <div className="prism-app-wash pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -left-24 -top-28 h-80 w-80 rounded-full bg-sky-200/45 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-16 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />

        <div className="relative z-10 flex w-full flex-col justify-between p-12">
          {/* Brand lockup */}
          <div className="flex items-center gap-2.5">
            <PrismLogo size={34} variant="tile" />
            <div className="leading-none">
              <div className="text-[15px] font-bold tracking-tight text-[#1C1917]">Prism</div>
              <div className="mt-0.5 text-[10.5px] uppercase tracking-[0.14em] text-[#78716C]">
                Operations
              </div>
            </div>
          </div>

          {/* Message, in the same voice as the landing page */}
          <div className="max-w-sm">
            <h1 className="font-display text-[34px] font-bold leading-[1.1] tracking-[-0.03em] text-[#1C1917]">
              Your morning,
              <span className="block bg-gradient-to-r from-[#0369A1] via-[#0284C7] to-[#B45309] bg-clip-text text-transparent">
                already sorted.
              </span>
            </h1>
            <p className="mt-5 text-[15px] leading-relaxed text-[#57534E]">
              Prism reads your email, your deals, and your team’s messages overnight, then hands
              you one short briefing, with every follow-up already written.
            </p>
          </div>

          <p className="text-[11.5px] text-[#A8A29E]">
            Built by Enlight Lab · Nothing sends without your approval
          </p>
        </div>
      </div>

      {/* Right: form panel */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12 lg:border-l lg:border-black/[0.05] lg:px-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
