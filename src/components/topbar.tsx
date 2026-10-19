"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Ghost, KeyRound, LogOut, Menu, Wallet } from "lucide-react";
import { CURRENCIES, fmtMoney, type Currency } from "@/lib/client";
import { cx } from "@/components/ui";
import { NAV } from "@/components/sidebar";
import type { SafeUser } from "@/lib/auth";

function currentSection(pathname: string): string | null {
  for (const entry of NAV) {
    if (entry.href && (pathname === entry.href || pathname.startsWith(`${entry.href}/`))) return entry.label;
    for (const child of entry.children ?? []) {
      if (child.href && pathname.startsWith(child.href)) return entry.label;
      for (const grand of child.children ?? []) {
        if (grand.href && pathname.startsWith(grand.href)) return entry.label;
      }
    }
  }
  return null;
}

export default function Topbar({
  onMenu,
  user,
  currency,
  onCurrency,
  panelName = "Ghost Panel",
}: {
  onMenu: () => void;
  user: SafeUser;
  currency: Currency;
  onCurrency: (c: Currency) => void;
  panelName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const section = currentSection(pathname);

  const balance =
    currency === "EUR" ? user.balanceEur : currency === "EGP" ? user.balanceEgp : user.balanceUsd;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    window.location.assign("/login");
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-white/85 px-3 backdrop-blur-xl sm:px-4">
      {/* left cluster */}
      <button
        onClick={onMenu}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition-all hover:bg-slate-100 active:scale-95"
        aria-label="Toggle navigation"
      >
        <Menu className="h-5 w-5" strokeWidth={1.75} />
      </button>

      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-blue-500 shadow-md shadow-blue-600/25">
          <Ghost className="h-[18px] w-[18px] text-white" strokeWidth={1.75} />
        </div>
        <div className="hidden sm:block">
          <p className="text-[15px] font-bold leading-tight tracking-tight text-slate-900">{panelName}</p>
          <p className="tnum text-[8.5px] font-semibold tracking-[0.26em] text-blue-600">SMS TERMINATION HUB</p>
        </div>
      </div>

      {section && (
        <div className="ml-2 hidden items-center gap-2 lg:flex">
          <span className="h-4 w-px bg-slate-200" />
          <p className="tnum text-[10px] font-semibold tracking-[0.22em] text-slate-400">{section.toUpperCase()}</p>
        </div>
      )}

      <div className="flex-1" />

      {/* right cluster */}
      <div className="hidden items-center gap-2 md:flex">
        <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1">
          <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="tnum text-[9.5px] font-bold tracking-[0.18em] text-emerald-700">LIVE</span>
        </span>
      </div>

      <div className="hidden rounded-xl border border-slate-200 bg-slate-100/70 p-0.5 sm:flex">
        {CURRENCIES.map((c) => (
          <button
            key={c}
            onClick={() => onCurrency(c)}
            className={cx(
              "tnum rounded-[9px] px-2.5 py-1 text-[11px] font-bold transition-all",
              currency === c ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200" : "text-slate-400 hover:text-slate-700"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 px-3 py-1.5 sm:flex">
        <Wallet className="h-4 w-4 text-blue-600" strokeWidth={1.9} />
        <span className="tnum text-[13.5px] font-bold text-slate-900">{fmtMoney(balance, currency)}</span>
      </div>

      {/* profile */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2.5 rounded-xl p-1 pr-1.5 transition-colors hover:bg-slate-100"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-700 to-blue-500 text-[13px] font-bold text-white shadow-sm">
            {user.username.slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden text-left xl:block">
            <span className="block max-w-[120px] truncate text-[12.5px] font-bold leading-tight text-slate-800">
              {user.fullName ?? user.username}
            </span>
            <span className="tnum block text-[9px] font-semibold uppercase leading-tight tracking-[0.18em] text-slate-400">
              {user.role}
            </span>
          </span>
        </button>

        <div
          className={cx(
            "absolute right-0 top-[calc(100%+8px)] w-64 origin-top-right rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl transition-all",
            open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
          )}
        >
          <div className="mb-1 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-700 to-blue-500 text-[15px] font-bold text-white">
              {user.username.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-bold text-slate-900">{user.fullName ?? user.username}</p>
              <p className="tnum truncate text-[11px] text-slate-400">@{user.username}</p>
            </div>
            <span className="tnum ml-auto rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              {user.role}
            </span>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              router.push("/ghost-api");
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <KeyRound className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
            API keys &amp; webhooks
          </button>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
