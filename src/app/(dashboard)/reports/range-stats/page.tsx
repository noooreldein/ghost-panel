"use client";

import { useEffect, useState } from "react";
import { Network } from "lucide-react";
import { apiGet, fmtNum } from "@/lib/client";
import { Badge, Card, cx, EmptyState, LoadingRows, PageHeader, TableShell, tdCls, thCls } from "@/components/ui";

interface RangeStatRow {
  id: number;
  name: string;
  prefix: string;
  country: string;
  currency: string;
  received: number;
  hits: number;
  revenue: string;
}

export default function RangeStatsPage() {
  const [rows, setRows] = useState<RangeStatRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ rows: RangeStatRow[] }>("/api/sms/stats/ranges")
      .then((d) => setRows(d.rows))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load range stats.");
        setRows([]);
      });
  }, []);

  const max = Math.max(...(rows ?? []).map((r) => r.received), 1);
  const topTotal = (rows ?? []).reduce((s, r) => s + r.received, 0);

  return (
    <div>
      <PageHeader icon={Network} title="SMS Range Stats" subtitle="Throughput and rated revenue per termination range." />

      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">{error}</p>}

      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-[14.5px] font-bold text-slate-900">Range leaderboard</h3>
          <Badge tone="blue">{fmtNum(topTotal)} TOTAL MESSAGES</Badge>
        </div>
        <TableShell>
          <thead>
            <tr>
              <th className={thCls}>Range</th>
              <th className={thCls}>Prefix</th>
              <th className={thCls}>Received</th>
              <th className={thCls}>Codes</th>
              <th className={thCls}>Hit rate</th>
              <th className={thCls}>Revenue</th>
              <th className={thCls}>Share</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <LoadingRows colSpan={7} />
            ) : rows.length === 0 ? (
              <EmptyState
                colSpan={7}
                icon={Network}
                title="No ranges to measure"
                description="Stats populate once ranges are assigned and live traffic terminates against them."
              />
            ) : (
              rows.map((r) => {
                const ratePct = r.received > 0 ? Math.round((r.hits / r.received) * 1000) / 10 : 0;
                return (
                  <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                    <td className={tdCls}>
                      <span className="font-bold text-slate-900">{r.name}</span>
                      <span className="block text-[11.5px] text-slate-400">{r.country}</span>
                    </td>
                    <td className={tdCls}>
                      <Badge tone="blue">+{r.prefix}</Badge>
                    </td>
                    <td className={cx(tdCls, "tnum font-bold text-slate-900")}>{fmtNum(r.received)}</td>
                    <td className={cx(tdCls, "tnum")}>{fmtNum(r.hits)}</td>
                    <td className={cx(tdCls, "tnum")}>{r.received ? `${ratePct}%` : "—"}</td>
                    <td className={cx(tdCls, "tnum font-semibold")}>
                      {r.revenue} <span className="text-[10px] text-slate-400">{r.currency}</span>
                    </td>
                    <td className={cx(tdCls, "w-40")}>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-700 to-blue-500 transition-all duration-700"
                          style={{ width: `${Math.max((r.received / max) * 100, r.received ? 4 : 0)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </TableShell>
      </Card>
    </div>
  );
}
