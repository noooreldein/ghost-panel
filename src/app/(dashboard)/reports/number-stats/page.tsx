"use client";

import { useEffect, useState } from "react";
import { Hash } from "lucide-react";
import { apiGet, fmtDateTime, fmtNum } from "@/lib/client";
import { Card, cx, EmptyState, LoadingRows, PageHeader, StatusPill, TableShell, tdCls, thCls } from "@/components/ui";

interface NumberStatRow {
  id: number;
  msisdn: string;
  status: string;
  rangeName: string | null;
  received: number;
  hits: number;
  revenue: string;
  lastMessageAt: string | null;
}

export default function NumberStatsPage() {
  const [rows, setRows] = useState<NumberStatRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ rows: NumberStatRow[] }>("/api/sms/stats/numbers")
      .then((d) => setRows(d.rows))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load number stats.");
        setRows([]);
      });
  }, []);

  return (
    <div>
      <PageHeader icon={Hash} title="SMS Numbers Stats" subtitle="Per-DID performance — volume, extraction yield and last activity." />

      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">{error}</p>}

      <Card>
        <TableShell>
          <thead>
            <tr>
              <th className={thCls}>#</th>
              <th className={thCls}>MSISDN</th>
              <th className={thCls}>Range</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Received</th>
              <th className={thCls}>Codes</th>
              <th className={thCls}>Hit rate</th>
              <th className={thCls}>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <LoadingRows colSpan={8} />
            ) : rows.length === 0 ? (
              <EmptyState
                colSpan={8}
                icon={Hash}
                title="No number activity"
                description="Provision numbers and stream traffic through the ingestion API — per-number yield shows up here."
              />
            ) : (
              rows.map((r, i) => {
                const ratePct = r.received > 0 ? Math.round((r.hits / r.received) * 1000) / 10 : 0;
                return (
                  <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                    <td className={cx(tdCls, "tnum text-slate-400")}>{String(i + 1).padStart(2, "0")}</td>
                    <td className={cx(tdCls, "tnum font-bold text-slate-900")}>{r.msisdn}</td>
                    <td className={cx(tdCls, "text-slate-500")}>{r.rangeName ?? "—"}</td>
                    <td className={tdCls}>
                      <StatusPill status={r.status} />
                    </td>
                    <td className={cx(tdCls, "tnum font-bold text-slate-900")}>{fmtNum(r.received)}</td>
                    <td className={cx(tdCls, "tnum")}>{fmtNum(r.hits)}</td>
                    <td className={cx(tdCls, "tnum")}>{r.received ? `${ratePct}%` : "—"}</td>
                    <td className={cx(tdCls, "tnum whitespace-nowrap text-slate-500")}>{r.lastMessageAt ? fmtDateTime(r.lastMessageAt) : "—"}</td>
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
