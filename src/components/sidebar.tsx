"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  BellRing,
  ChartColumnBig,
  ChartSpline,
  ChevronDown,
  ContactRound,
  DollarSign,
  Euro,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Hash,
  KeyRound,
  LayoutDashboard,
  MessageSquareText,
  Network,
  PlugZap,
  Phone,
  Rows3,
  SquareTerminal,
  UsersRound,
  Wallet,
  HandCoins,
  History,
  UserCog,
  Palette,
  PhoneOutgoing,
  RadioTower,
  ShieldCheck,
  StickyNote,
  DownloadCloud,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cx } from "@/components/ui";

export interface NavEntry {
  label: string;
  icon: LucideIcon;
  href?: string;
  children?: NavEntry[];
  adminOnly?: boolean;
}

export const NAV: NavEntry[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  {
    label: "SMS",
    icon: MessageSquareText,
    children: [
      { label: "SMS Numbers", icon: Phone, href: "/sms/numbers" },
      { label: "SMS Ranges", icon: Rows3, href: "/sms/ranges" },
      { label: "SMS Send", icon: PhoneOutgoing, href: "/sms/send", adminOnly: true },
    ],
  },
  { label: "SMS Test Panel", icon: FlaskConical, href: "/sms/test" },
  { label: "My Numbers", icon: DownloadCloud, href: "/my-numbers" },
  { label: "Clients", icon: UsersRound, href: "/clients" },
  {
    label: "SMS Report & Stats",
    icon: ChartColumnBig,
    children: [
      { label: "SMS Report", icon: FileText, href: "/reports/sms-report" },
      { label: "SMS Stats", icon: ChartSpline, href: "/reports/sms-stats" },
      { label: "SMS Range Stats", icon: Network, href: "/reports/range-stats" },
      { label: "SMS Numbers Stats", icon: Hash, href: "/reports/number-stats" },
      { label: "SMS Client Stats", icon: ContactRound, href: "/reports/client-stats" },
    ],
  },
  {
    label: "Financials & Payouts",
    icon: Wallet,
    children: [
      { label: "Payment Requests", icon: HandCoins, href: "/financials/payment-requests" },
      { label: "Credit Notes", icon: StickyNote, href: "/financials/credit-notes" },
      { label: "حسابات السحب", icon: Banknote, href: "/financials/payout-accounts" },
      {
        label: "Statements",
        icon: FileSpreadsheet,
        children: [
          { label: "USD Statement", icon: DollarSign, href: "/financials/statements/usd" },
          { label: "EUR Statement", icon: Euro, href: "/financials/statements/eur" },
          { label: "EGP Statement", icon: Banknote, href: "/financials/statements/egp" },
        ],
      },
    ],
  },
  { label: "Ghost API", icon: KeyRound, href: "/ghost-api" },
  { label: "Live Monitor", icon: RadioTower, href: "/operations/monitor", adminOnly: true },
  { label: "التحديثات", icon: BellRing, href: "/updates" },
  { label: "مزودو الاتصال", icon: PlugZap, href: "/providers", adminOnly: true },
  { label: "CLI Search", icon: SquareTerminal, href: "/cli-search" },
  { label: "Access Control", icon: UserCog, href: "/access", adminOnly: true },
  { label: "سجل النشاط", icon: History, href: "/operations/activity", adminOnly: true },
  { label: "Branding & Themes", icon: Palette, href: "/settings/branding", adminOnly: true },
  { label: "Backup & Export", icon: ShieldCheck, href: "/settings/backup", adminOnly: true },
  { label: "Profile", icon: UserRound, href: "/profile" },
];

function isActive(pathname: string, href?: string): boolean {
  if (!href) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function subtreeActive(pathname: string, entry: NavEntry): boolean {
  if (isActive(pathname, entry.href)) return true;
  return (entry.children ?? []).some((c) => subtreeActive(pathname, c));
}

export default function Sidebar({
  collapsed,
  mobileOpen,
  onClose,
  onExpand,
  role,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onClose: () => void;
  onExpand: () => void;
  role?: string;
}) {
  const pathname = usePathname();
  const rail = collapsed && !mobileOpen;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const items = NAV.filter((n) => !n.adminOnly || role === "admin");

  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev };
      for (const entry of items) {
        if (entry.children) next[entry.label] = subtreeActive(pathname, entry) ? true : (prev[entry.label] ?? false);
        for (const child of entry.children ?? []) {
          if (child.children) next[child.label] = subtreeActive(pathname, child) ? true : (prev[child.label] ?? false);
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, role]);

  const toggle = (key: string) => setOpen((p) => ({ ...p, [key]: !p[key] }));

  function renderLeaf(entry: NavEntry, depth: number) {
    const active = isActive(pathname, entry.href);
    const Icon = entry.icon;
    return (
      <Link
        key={entry.href + entry.label}
        href={entry.href ?? "#"}
        onClick={onClose}
        title={rail ? entry.label : undefined}
        className={cx(
          "group relative flex items-center gap-2.5 rounded-[10px] text-[13px] font-medium transition-all",
          rail ? "mx-auto h-10 w-10 justify-center" : depth > 1 ? "py-2 pl-[52px] pr-3" : "py-[9px] pl-3 pr-3",
          active
            ? "bg-gradient-to-r from-blue-50 to-blue-50/40 font-semibold text-blue-700"
            : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-900"
        )}
      >
        {active && (rail ? (
          <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-blue-600" />
        ) : (
          depth === 0 && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-blue-600" />
        ))}
        {depth === 0 || rail ? (
          <Icon className={cx("h-[17px] w-[17px] shrink-0", active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600")} strokeWidth={1.75} />
        ) : (
          <span className={cx("h-1 w-1 shrink-0 rounded-full", active ? "bg-blue-500" : "bg-slate-300")} />
        )}
        {!rail && <span className="truncate">{entry.label}</span>}
        {rail && (
          <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-xl group-hover:block">
            {entry.label}
          </span>
        )}
      </Link>
    );
  }

  function renderGroup(entry: NavEntry, depth: number) {
    const Icon = entry.icon;
    const expanded = rail ? false : !!open[entry.label];
    const active = subtreeActive(pathname, entry);

    return (
      <div key={entry.label}>
        <button
          onClick={() => (rail ? onExpand() : toggle(entry.label))}
          title={rail ? entry.label : undefined}
          className={cx(
            "group relative flex w-full items-center gap-2.5 rounded-[10px] text-[13px] font-medium transition-all",
            rail ? "mx-auto h-10 w-10 justify-center" : depth > 0 ? "py-2 pl-[30px] pr-3" : "py-[9px] pl-3 pr-3",
            active ? "text-slate-900" : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-900"
          )}
        >
          <Icon
            className={cx("h-[17px] w-[17px] shrink-0", active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600")}
            strokeWidth={1.75}
          />
          {!rail && (
            <>
              <span className="flex-1 truncate text-left">{entry.label}</span>
              <ChevronDown
                className={cx("h-3.5 w-3.5 text-slate-400 transition-transform duration-300", expanded && "rotate-180")}
                strokeWidth={2}
              />
            </>
          )}
          {rail && (
            <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-xl group-hover:block">
              {entry.label}
            </span>
          )}
        </button>
        <div
          className={cx(
            "grid transition-all duration-300 ease-out",
            expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <div className={cx("space-y-0.5 pb-1", depth === 0 && "relative before:absolute before:bottom-2 before:left-[22px] before:top-1 before:w-px before:bg-slate-200")}>
              {(entry.children ?? []).map((child) => (child.children ? renderGroup(child, depth + 1) : renderLeaf(child, depth + 1)))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* mobile backdrop */}
      <div
        className={cx(
          "fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      <aside
        className={cx(
          "fixed bottom-0 left-0 top-16 z-40 flex flex-col border-r border-slate-200/80 bg-white transition-all duration-300",
          rail ? "w-[76px]" : "w-[268px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {items.map((entry) => (entry.children ? renderGroup(entry, 0) : renderLeaf(entry, 0)))}
        </nav>
        {!rail && (
          <div className="border-t border-slate-100 p-4">
            <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-white p-3.5">
              <p className="tnum text-[9.5px] font-bold tracking-[0.22em] text-blue-600">GHOST PIPELINE</p>
              <p className="mt-1 text-[11.5px] leading-snug text-slate-500">
                Ingestion endpoint
              </p>
              <code className="tnum mt-1.5 block truncate rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-sky-300">
                POST /api/ingest
              </code>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
