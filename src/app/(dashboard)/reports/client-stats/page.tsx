"use client";

import { useEffect, useState } from "react";
import { ContactRound } from "lucide-react";
import { apiGet, fmtNum } from "@/lib/client";
import { Card, cx, EmptyState, LoadingRows, PageHeader, StatusPill, TableShell, tdCls, thCls } from "@/components/ui";

interface ClientStatRow {
  id: number;
  name: string;
  company: string | null;
  status: string;
  received: number;
  hits: number;
  revenue: string;
}

export default function ClientStatsPage() {
  const [rows, setRows] = useState<ClientStatRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ rows: ClientStatRow[] }>("/api/sms/stats/clients")
      .then((d) => setRows(d.rows))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load client stats.");
        setRows([]);
      });
  }, []);

  const max = Math.max(...(rows ?? []).map((r) => r.received), 1);

  return (
    <div>
      <PageHeader icon={ContactRound} title="SMS Client Stats" subtitle="Traffic attribution per downstream client account." />

      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">{error}</p>}

      <Card>
        <TableShell>
          <thead>
            <tr>
              <th className={thCls}>Client</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Received</th>
              <th className={thCls}>Codes</th>
              <th className={thCls}>Hit rate</th>
              <th className={thCls}>Rated revenue</th>
              <th className={thCls}>Volume share</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <LoadingRows colSpan={7} />
            ) : rows.length === 0 ? (
              <EmptyState
                colSpan={7}
                icon={ContactRound}
                title="No client traffic"
                description="Attach client accounts to inbound messages via the ingest payload (clientId) to unlock per-client attribution."
              />
            ) : (
              rows.map((c) => {
                const ratePct = c.received > 0 ? Math.round((c.hits / c.received) * 1000) / 10 : 0;
                return (
                  <tr key={c.id} className="transition-colors hover:bg-slate-50/70">
                    <td className={tdCls}>
                      <span className="font-bold text-slate-900">{c.name}</span>
                      {c.company && <span className="block text-[11.5px] text-slate-400">{c.company}</span>}
                    </td>
                    <td className={tdCls}>
                      <StatusPill status={c.status} />
                    </td>
                    <td className={cx(tdCls, "tnum font-bold text-slate-900")}>{fmtNum(c.received)}</td>
                    <td className={cx(tdCls, "tnum")}>{fmtNum(c.hits)}</td>
                    <td className={cx(tdCls, "tnum")}>{c.received ? `${ratePct}%` : "—"}</td>
                    <td className={cx(tdCls, "tnum font-semibold")}>{c.revenue}</td>
                    <td className={cx(tdCls, "w-44")}>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-700 to-blue-500 transition-all duration-700"
                          style={{ width: `${Math.max((c.received / max) * 100, c.received ? 4 : 0)}%` }}
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
