import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { MotionProvider } from "@/components/providers/MotionProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { RouteProgressBar } from "@/components/ui/RouteProgressBar";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Prism. One interface for every system.",
    template: "%s · Prism",
  },
  description:
    "Prism is the unified productivity copilot connecting Microsoft 365 (Outlook, SharePoint, Dynamics 365 CRM) and Zoho (CRM, Projects, Books), all in one conversation across every system you work in.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <MotionProvider>
          <AuthProvider>
            <ToastProvider>
              <Suspense fallback={null}>
                <RouteProgressBar />
              </Suspense>
              {children}
            </ToastProvider>
          </AuthProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
