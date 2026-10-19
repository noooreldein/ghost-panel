"use client";

import { useEffect, useState } from "react";
import { ChartSpline, Inbox, Percent, Wallet, Zap } from "lucide-react";
import { useMe } from "@/lib/use-me";
import { apiGet, fmtMoney, fmtNum } from "@/lib/client";
import { Bars } from "@/components/charts";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "@/components/ui";

interface OverviewData {
  series: { day: string; received: number; hits: number; revenue: string }[];
  totals: { total: number; hits: number; revenueUsd: string; revenueEur: string; revenueEgp: string };
}

export default function SmsStatsPage() {
  const me = useMe();
  const isAdmin = me?.role === "admin";
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<OverviewData>("/api/sms/stats/overview")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load stats."));
  }, []);

  const series14: { day: string; received: number; hits: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const hit = data?.series.find((s) => s.day === key);
    series14.push({ day: key, received: hit?.received ?? 0, hits: hit?.hits ?? 0 });
  }

  const label = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
  const hitRate = data && data.totals.total > 0 ? Math.round((data.totals.hits / data.totals.total) * 1000) / 10 : 0;

  const kpi = [
    { icon: Inbox, label: "TOTAL RECEIVED", value: data ? fmtNum(data.totals.total) : null },
    { icon: Zap, label: "CODES EXTRACTED", value: data ? fmtNum(data.totals.hits) : null },
    { icon: Percent, label: "EXTRACTION RATE", value: data ? `${hitRate}%` : null },
  ];

  return (
    <div>
      <PageHeader icon={ChartSpline} title="SMS Stats" subtitle="Aggregated throughput across the whole termination footprint · 14 days." />

      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">{error}</p>}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {kpi.map((k) => (
          <Card key={k.label} className="flex items-center gap-4 p-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700">
              <k.icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <p className="tnum text-[9.5px] font-bold tracking-[0.18em] text-slate-400">{k.label}</p>
              <p className="tnum mt-0.5 text-2xl font-bold text-slate-900">{k.value ?? "…"}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14.5px] font-bold text-slate-900">Daily volume</h3>
          <Badge tone="blue">UTC · LIVE TRAFFIC ONLY</Badge>
        </div>
        {data ? (
          <Bars
            height={220}
            legend={["Received", "Codes"]}
            data={series14.map((s) => ({
              label: label(s.day),
              value: s.received,
              value2: s.hits,
              hint: `${label(s.day)} — ${s.received} received / ${s.hits} codes`,
            }))}
          />
        ) : (
          <div className="flex h-[220px] items-center justify-center">
            <Spinner />
          </div>
        )}
      </Card>

      {isAdmin && (
  <Card className="mt-4 p-5">
          <h3 className="mb-4 flex items-center gap-2 text-[14.5px] font-bold text-slate-900">
            <Wallet className="h-4 w-4 text-blue-600" strokeWidth={1.9} />
            Rated revenue by currency
          </h3>
          {data ? (
            Number(data.totals.revenueUsd) + Number(data.totals.revenueEur) + Number(data.totals.revenueEgp) === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No rated traffic yet"
                description="Revenue accrues as messages terminate against rated ranges. Rates attach automatically via longest-prefix resolution."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {(["USD", "EUR", "EGP"] as const).map((c) => (
                  <div key={c} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                    <p className="tnum text-[9.5px] font-bold tracking-[0.18em] text-slate-400">{c}</p>
                    <p className="tnum mt-1 text-xl font-bold text-slate-900">
                      {fmtMoney(c === "USD" ? data.totals.revenueUsd : c === "EUR" ? data.totals.revenueEur : data.totals.revenueEgp, c)}
                    </p>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="skeleton h-20 w-full" />
          )}
        </Card>
)}
    </div>
  );
}
