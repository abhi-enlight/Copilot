import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in · Prism",
  description: "Sign in to Prism by Enlight Lab",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9] px-4">
      {children}
    </div>
  );
}
