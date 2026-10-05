import type { Metadata } from "next";

export const metadata: Metadata = {
  // The root layout appends " · Prism", so this must not repeat the brand.
  title: "Sign in",
  description: "Sign in to Prism by Enlight Lab",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-[#FAFAF9] font-[family-name:var(--font-geist-sans)]">
      {/* Left: Brand panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-1/2 relative overflow-hidden flex-col justify-between p-12">
        {/* Ambient gradient background */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 20% 30%, rgba(2, 132, 199, 0.12), transparent 60%),
              radial-gradient(ellipse 60% 50% at 80% 70%, rgba(2, 132, 199, 0.08), transparent 55%),
              radial-gradient(ellipse 100% 80% at 50% 100%, rgba(29, 78, 216, 0.07), transparent 70%),
              #F5F5F4
            `,
          }}
        />

        {/* Decorative mesh grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.5) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Floating orb decorations */}
        <div
          className="absolute top-1/4 left-1/3 w-64 h-64 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #0284c7, transparent)" }}
        />
        <div
          className="absolute bottom-1/3 right-1/4 w-48 h-48 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #1d4ed8, transparent)" }}
        />

        <div className="relative z-10">
          {/* Brand mark */}
          <div className="flex items-center gap-3 mb-16">
            <div
              className="w-10 h-10 rounded-[30%] flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #0369a1 0%, #2563eb 60%, #3b82f6 100%)",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
              }}
            >
              {/* Inline prism SVG */}
              <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                <path d="M16 4.5 25 26H7L16 4.5Z" stroke="white" strokeWidth="2.6" strokeLinejoin="round" />
                <path d="M2.5 20.5H8" stroke="rgba(255,255,255,0.75)" strokeWidth="2.4" strokeLinecap="round" />
                <path d="M16 15.5 22.5 23.5" stroke="rgba(255,255,255,0.95)" strokeWidth="2.4" strokeLinecap="round" />
                <path d="M21 17.5 26.5 24.5" stroke="rgba(255,255,255,0.55)" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="text-[15px] font-bold text-stone-900 tracking-tight leading-none">Prism</div>
              <div className="text-[10.5px] text-stone-400 mt-0.5">Operations Platform</div>
            </div>
          </div>
        </div>

        {/* Center hero copy */}
        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-sm">
          <h1 className="text-[36px] font-bold text-stone-900 tracking-[-0.03em] leading-[1.1] mb-5">
            One interface.<br />
            Every system.
          </h1>
          <p className="text-[15px] text-stone-500 leading-relaxed">
            Connect Outlook, Teams, Slack, Linear, and Zoho CRM. Let Prism synthesize, draft, and execute across all of them, with your approval.
          </p>

          {/* Feature list */}
          <div className="mt-8 space-y-3">
            {[
              "AI-powered morning briefings",
              "Human-in-the-loop action approvals",
              "Real-time cross-stack telemetry",
            ].map((feat) => (
              <div key={feat} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#0284c7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-[13px] text-stone-600">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom tagline */}
        <div className="relative z-10">
          <p className="text-[11px] text-stone-400">
            Built by Enlight Lab · Secured by Prism Sovereign Vault
          </p>
        </div>
      </div>

      {/* Right: Form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12 bg-white lg:border-l border-black/[0.05]">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
