"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  FlaskConical,
  Inbox,
  LayoutDashboard,
  MessageSquareText,
  RefreshCw,
  Satellite,
  Wallet,
  Webhook,
  Zap,
} from "lucide-react";
import { apiGet, CURRENCIES, fmtMoney, fmtNum, fmtDateTime, qs, type Currency } from "@/lib/client";
import { useMe } from "@/lib/use-me";
import {
  Badge,
  Card,
  CopyButton,
  cx,
  EmptyState,
  Segmented,
  Spinner,
  StatDelta,
  statusToneDot,
  tdCls,
  thCls,
} from "@/components/ui";
import { Bars, Donut, Sparkline } from "@/components/charts";

interface DashboardData {
  todayCount: number;
  weekHits: number;
  lastWeekHits: number;
  trendPct: number | null;
  statusBreakdown: { status: string; value: number }[];
  series: { day: string; received: number; hits: number }[];
  recent: { id: number; msisdn: string; senderId: string | null; otpCode: string | null; status: string; supplier: string | null; createdAt: string }[];
  balances: Record<Currency, string>;
}

const DONUT_COLORS: Record<string, string> = {
  received: "#2563eb",
  delivered: "#10b981",
  rejected: "#f43f5e",
  expired: "#f59e0b",
};

export default function DashboardPage() {
  const me = useMe();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [spinning, setSpinning] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setSpinning(true);
    try {
      const d = await apiGet<DashboardData>("/api/dashboard");
      setData(d);
      setError(null);
      setLastSync(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load metrics.");
    } finally {
      setSpinning(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  /* build a full 7-day series (fill missing days with zero) */
  const series7: { day: string; received: number; hits: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const hit = data?.series.find((s) => s.day === key);
    series7.push({ day: key, received: hit?.received ?? 0, hits: hit?.hits ?? 0 });
  }

  const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  const hitRate = data && data.weekHits + 0 > 0 ? null : null;
  void hitRate;

  return (
    <div>
      {/* heading row */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white text-blue-700 shadow-sm">
            <LayoutDashboard className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Welcome back{me ? `, ${me.fullName?.split(" ")[0] ?? me.username}` : ""}
            </h1>
            <p className="mt-0.5 flex items-center gap-2 text-[13px] text-slate-500">
              <span className="animate-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Pipeline online{lastSync ? ` · synced ${lastSync.toLocaleTimeString("en-GB", { hour12: false })}` : ""}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/sms/test"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-[13.5px] font-semibold text-slate-700 transition-all hover:border-blue-300 hover:text-blue-700"
          >
            <FlaskConical className="h-4 w-4" strokeWidth={1.9} />
            Test Panel
          </Link>
          <button
            onClick={() => load()}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 px-4 text-[13.5px] font-semibold text-white shadow-md shadow-blue-600/20 transition-all hover:brightness-110"
          >
            <RefreshCw className={cx("h-4 w-4", spinning && "animate-spin")} strokeWidth={1.9} />
            Refresh
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">{error}</p>}

      {/* KPI cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Daily volume */}
        <Card className="group relative overflow-hidden p-5">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-500/[0.06] blur-2xl transition-all group-hover:bg-blue-500/[0.12]" />
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700">
              <Inbox className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <Badge tone="emerald" className="gap-1.5">
              <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
              LIVE
            </Badge>
          </div>
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">SMS Received Today</p>
          <p className="tnum mt-1 text-[34px] font-bold leading-none tracking-tight text-slate-900">
            {data ? fmtNum(data.todayCount) : <span className="skeleton inline-block h-8 w-20" />}
          </p>
          <div className="mt-3">
            <Sparkline values={series7.map((s) => s.received)} height={40} />
          </div>
          <p className="tnum mt-2 text-[10.5px] font-medium tracking-[0.14em] text-slate-400">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long" }).toUpperCase()}
          </p>
        </Card>

        {/* Weekly output */}
        <Card className="group relative overflow-hidden p-5">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sky-400/[0.08] blur-2xl transition-all group-hover:bg-sky-400/[0.14]" />
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
              <Zap className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <StatDelta value={data?.trendPct ?? null} />
          </div>
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Codes / Hits This Week</p>
          <p className="tnum mt-1 text-[34px] font-bold leading-none tracking-tight text-slate-900">
            {data ? fmtNum(data.weekHits) : <span className="skeleton inline-block h-8 w-20" />}
          </p>
          <div className="mt-3">
            <Sparkline values={series7.map((s) => s.hits)} height={40} stroke="#0284c7" />
          </div>
          <p className="tnum mt-2 text-[10.5px] font-medium tracking-[0.14em] text-slate-400">
            LAST WEEK: {data ? fmtNum(data.lastWeekHits) : "…"} CODES
          </p>
        </Card>

        {/* Revenue */}
        <Card className="group relative overflow-hidden p-5">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-400/[0.08] blur-2xl transition-all group-hover:bg-indigo-400/[0.14]" />
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
              <Wallet className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <Segmented<Currency>
              size="sm"
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              value={currency}
              onChange={setCurrency}
            />
          </div>
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Total Earnings</p>
          <p className="tnum mt-1 text-[34px] font-bold leading-none tracking-tight text-slate-900">
            {data ? fmtMoney(data.balances[currency], currency) : <span className="skeleton inline-block h-8 w-28" />}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={cx(
                  "rounded-xl border px-2 py-2 text-left transition-all",
                  currency === c ? "border-blue-300 bg-blue-50/70" : "border-slate-100 bg-slate-50/60 hover:border-slate-200"
                )}
              >
                <p className="tnum text-[9px] font-bold tracking-[0.16em] text-slate-400">{c}</p>
                <p className="tnum mt-0.5 truncate text-[12px] font-bold text-slate-800">
                  {data ? fmtMoney(data.balances[c], c) : "…"}
                </p>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* charts row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-[14.5px] font-bold text-slate-900">
                <Activity className="h-4 w-4 text-blue-600" strokeWidth={1.9} />
                Traffic — last 7 days
              </h3>
              <p className="mt-0.5 text-[12px] text-slate-400">Inbound volume vs. extracted codes</p>
            </div>
            <Badge tone="blue">UTC</Badge>
          </div>
          <Bars
            data={series7.map((s) => ({
              label: dayLabel(s.day),
              value: s.received,
              value2: s.hits,
              hint: `${dayLabel(s.day)} — ${s.received} received / ${s.hits} codes`,
            }))}
            legend={["Received", "Codes"]}
          />
        </Card>

        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-[14.5px] font-bold text-slate-900">
            <Satellite className="h-4 w-4 text-blue-600" strokeWidth={1.9} />
            Delivery mix
          </h3>
          <p className="mt-0.5 text-[12px] text-slate-400">Status breakdown · 7 days</p>
          <div className="mt-5 flex justify-center">
            <Donut
              centerLabel="messages"
              slices={["received", "delivered", "rejected", "expired"].map((s) => ({
                label: s,
                value: data?.statusBreakdown.find((b) => b.status === s)?.value ?? 0,
                color: DONUT_COLORS[s],
              }))}
            />
          </div>
        </Card>
      </div>

      {/* recent + setup */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="flex items-center gap-2 text-[14.5px] font-bold text-slate-900">
              <MessageSquareText className="h-4 w-4 text-blue-600" strokeWidth={1.9} />
              Latest inbound
            </h3>
            <Link href="/reports/sms-report" className="text-[12.5px] font-semibold text-blue-600 hover:text-blue-800">
              Open full report →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr>
                  <th className={thCls}>Time</th>
                  <th className={thCls}>MSISDN</th>
                  <th className={thCls}>Sender</th>
                  <th className={thCls}>Code</th>
                  <th className={thCls}>Status</th>
                </tr>
              </thead>
              <tbody>
                {!data ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center">
                      <Spinner className="mx-auto" />
                    </td>
                  </tr>
                ) : data.recent.length === 0 ? (
                  <EmptyState
                    colSpan={5}
                    icon={Inbox}
                    title="No inbound SMS yet"
                    description="Push live traffic through the ingestion endpoint or fire a sandbox message from the Test Panel — rows appear here instantly."
                    action={
                      <Link href="/sms/test" className="text-[12.5px] font-semibold text-blue-600 hover:text-blue-800">
                        Open Test Panel →
                      </Link>
                    }
                  />
                ) : (
                  data.recent.map((m) => (
                    <tr key={m.id} className="transition-colors hover:bg-slate-50/70">
                      <td className={cx(tdCls, "tnum whitespace-nowrap text-slate-500")}>{fmtDateTime(m.createdAt)}</td>
                      <td className={cx(tdCls, "tnum font-semibold text-slate-900")}>{m.msisdn}</td>
                      <td className={cx(tdCls, "tnum")}>{m.senderId ?? "—"}</td>
                      <td className={tdCls}>{m.otpCode ? <Badge tone="blue">{m.otpCode}</Badge> : <span className="text-slate-300">—</span>}</td>
                      <td className={tdCls}>
                        <StatusDotLabel status={m.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="flex flex-col p-5">
          <h3 className="flex items-center gap-2 text-[14.5px] font-bold text-slate-900">
            <Webhook className="h-4 w-4 text-blue-600" strokeWidth={1.9} />
            Integration quick-start
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-400">
            Bridge your suppliers over HTTPS. Every payload is validated, parsed for codes and routed to your ledger.
          </p>
          <div className="mt-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
              <code className="tnum text-[11.5px] font-semibold text-slate-700">POST /api/ingest</code>
              <CopyButton value={`${typeof window !== "undefined" ? window.location.origin : ""}/api/ingest`} />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
              <code className="tnum text-[11.5px] font-semibold text-slate-700">x-api-key: gk_live_…</code>
              <CopyButton value={me?.apiKey ?? ""} label="Key" />
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-white p-3.5 text-[12px] leading-relaxed text-slate-500">
            Export-ready reports, live OTP extraction and multi-currency statements are enabled on this account.
          </div>
          <Link
            href="/ghost-api"
            className="mt-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 pt-0 text-[12.5px] font-semibold text-white transition-colors hover:bg-slate-800"
            style={{ marginTop: "1rem" }}
          >
            Configure Ghost API →
          </Link>
        </Card>
      </div>
    </div>
  );
}

function StatusDotLabel({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] font-medium capitalize text-slate-600">
      <span className={cx("h-1.5 w-1.5 rounded-full", statusToneDot(status))} />
      {status}
    </span>
  );
}
