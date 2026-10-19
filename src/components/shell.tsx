"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/sidebar";
import ConnectionBanner from "@/components/connection-banner";
import Topbar from "@/components/topbar";
import { cx } from "@/components/ui";
import { CURRENCIES, getCookie, setCookie, type Currency } from "@/lib/client";
import type { SafeUser } from "@/lib/auth";
import { themeCss } from "@/lib/theme";

interface ShellSettings {
  panelName: string;
  primaryColor: string;
  theme: string;
  themeLabel: string;
}

export default function Shell({ user, settings, children }: { user: SafeUser; settings: ShellSettings; children: ReactNode }) {
  const pathname = usePathname();
  const themeOverride = themeCss(settings.primaryColor);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [hydrated, setHydrated] = useState(false);

  /* Restore client prefs after hydration — deferred so the server render
     stays deterministic (no synchronous setState in the effect body). */
  useEffect(() => {
    const id = setTimeout(() => {
      setCollapsed(localStorage.getItem("ghost.sidebar") === "1");
      const c = getCookie("ghost.currency");
      if (c && (CURRENCIES as readonly string[]).includes(c)) setCurrency(c as Currency);
      setHydrated(true);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  function onMenu() {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setMobileOpen((o) => !o);
    } else {
      setCollapsed((c) => {
        localStorage.setItem("ghost.sidebar", c ? "0" : "1");
        return !c;
      });
    }
  }

  function changeCurrency(c: Currency) {
    setCurrency(c);
    setCookie("ghost.currency", c);
  }

  const rail = hydrated && collapsed;

  return (
    <div className="min-h-screen bg-slate-100">
      {themeOverride && <style id="ghost-theme" dangerouslySetInnerHTML={{ __html: themeOverride }} />}
      <ConnectionBanner />
      <Topbar onMenu={onMenu} user={user} currency={currency} onCurrency={changeCurrency} panelName={settings.panelName} />
      <Sidebar
        collapsed={rail}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onExpand={() => {
          setCollapsed(false);
          localStorage.setItem("ghost.sidebar", "0");
        }}
        role={user.role}
      />
      <main className={cx("pt-16 transition-[padding] duration-300", rail ? "lg:pl-[76px]" : "lg:pl-[268px]")}>
        <div key={pathname} className="animate-fade-in mx-auto max-w-[1440px] p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
