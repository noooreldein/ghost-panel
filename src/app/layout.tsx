import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { getPanelSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { panelName } = await getPanelSettings();
  return {
    title: `${panelName} — SMS Termination Hub`,
    description:
      `${panelName}: carrier-grade SMS hub & termination console. Ranges, numbers, OTP extraction, client billing, multi-currency ledger and a live REST pipeline.`,
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { primaryColor } = await getPanelSettings();
  return { themeColor: primaryColor };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-slate-100 font-sans text-slate-900 antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
