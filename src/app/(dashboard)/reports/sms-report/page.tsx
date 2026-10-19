"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Download, FileText, Search } from "lucide-react";
import { apiGet, daysAgoIso, fmtDateTime, fmtNum, qs, todayIso } from "@/lib/client";
import {
  Badge,
  Btn,
  Card,
  cx,
  EmptyState,
  Input,
  LoadingRows,
  PageHeader,
  Pagination,
  Select,
  StatusPill,
  TableShell,
  tdCls,
  thCls,
} from "@/components/ui";

interface MessageRow {
  id: number;
  msisdn: string;
  senderId: string | null;
  body: string;
  otpCode: string | null;
  status: string;
  latencyMs: number | null;
  rate: string;
  payout: string;
  currency: string;
  supplier: string | null;
  isTest: boolean;
  createdAt: string;
  rangeName: string | null;
  clientName: string | null;
}

const PAGE_LIMIT = 20;
const SUMMARY_KEYS = ["delivered", "received", "rejected", "expired"] as const;

export default function SmsReportPage() {
  const [rows, setRows] = useState<MessageRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState(daysAgoIso(6));
  const [to, setTo] = useState(todayIso());
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [scope, setScope] = useState("live");
  const [error, setError] = useState<string | null>(null);

  const params = { from, to, status, q, scope };

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ rows: MessageRow[]; total: number; summary: Record<string, number> }>(
        `/api/sms/messages${qs({ ...params, page, limit: PAGE_LIMIT })}`
      );
      setRows(d.rows);
      setTotal(d.total);
      setSummary(d.summary ?? {});
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report.");
      setRows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, status, q, scope, page]);

  useEffect(() => {
    load();
  }, [load]);

  const csvHref = `/api/sms/messages${qs({ ...params, format: "csv" })}`;

  return (
    <div>
      <PageHeader
        icon={FileText}
        title="SMS Report"
        subtitle="Raw termination logs — delivery state, extracted codes, latency and payout per record."
        actions={
          <a href={csvHref} download>
            <Btn icon={Download} variant="dark">
              Export CSV
            </Btn>
          </a>
        }
      />

      {/* summary chips */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SUMMARY_KEYS.map((k) => (
          <Card key={k} className="flex items-center justify-between p-4">
            <div>
              <p className="tnum text-[9.5px] font-bold uppercase tracking-[0.18em] text-slate-400">{k}</p>
              <p className="tnum mt-1 text-xl font-bold text-slate-900">{fmtNum(summary[k] ?? 0)}</p>
            </div>
            <StatusPill status={k} />
          </Card>
        ))}
      </div>

      {/* filters */}
      <Card className="mb-4 flex flex-wrap items-center gap-2.5 p-3.5">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
          <Input type="date" className="tnum w-40" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
          <span className="text-slate-400">→</span>
          <Input type="date" className="tnum w-40" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
        </div>
        <Select className="w-36" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">Any status</option>
          <option value="delivered">Delivered</option>
          <option value="received">Received</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </Select>
        <Select className="w-32" value={scope} onChange={(e) => { setPage(1); setScope(e.target.value); }}>
          <option value="live">Live only</option>
          <option value="all">Live + tests</option>
          <option value="test">Tests only</option>
        </Select>
        <form
          className="relative min-w-[200px] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQ(qInput);
          }}
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={1.75} />
          <Input className="pl-10" placeholder="Search MSISDN, sender, body…" value={qInput} onChange={(e) => setQInput(e.target.value)} />
        </form>
        {(status || q || scope !== "live") && (
          <Btn variant="ghost" onClick={() => { setStatus(""); setQ(""); setQInput(""); setScope("live"); setPage(1); }}>
            Reset
          </Btn>
        )}
      </Card>

      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">{error}</p>}

      <Card>
        <TableShell>
          <thead>
            <tr>
              <th className={thCls}>Timestamp</th>
              <th className={thCls}>MSISDN</th>
              <th className={thCls}>Sender</th>
              <th className={thCls}>Message</th>
              <th className={thCls}>Code</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Rate</th>
              <th className={thCls}>Supplier</th>
              <th className={thCls}>Latency</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <LoadingRows colSpan={9} rows={8} />
            ) : rows.length === 0 ? (
              <EmptyState
                colSpan={9}
                icon={FileText}
                title="No messages in this window"
                description="No traffic matches the current filters. Widen the date range or ingest messages via the Ghost API pipeline."
              />
            ) : (
              rows.map((m) => (
                <tr key={m.id} className="transition-colors hover:bg-slate-50/70">
                  <td className={cx(tdCls, "tnum whitespace-nowrap text-slate-500")}>{fmtDateTime(m.createdAt)}</td>
                  <td className={cx(tdCls, "tnum font-bold text-slate-900")}>
                    {m.msisdn}
                    {m.isTest && <Badge tone="violet" className="ml-1.5">test</Badge>}
                  </td>
                  <td className={cx(tdCls, "tnum")}>{m.senderId ?? "—"}</td>
                  <td className={cx(tdCls, "max-w-[260px]")}>
                    <p className="truncate text-[12.5px]" title={m.body}>
                      {m.body}
                    </p>
                    {m.rangeName && <p className="tnum text-[10px] text-slate-400">{m.rangeName}</p>}
                  </td>
                  <td className={tdCls}>{m.otpCode ? <Badge tone="blue">{m.otpCode}</Badge> : <span className="text-slate-300">—</span>}</td>
                  <td className={tdCls}>
                    <StatusPill status={m.status} />
                  </td>
                  <td className={cx(tdCls, "tnum whitespace-nowrap")}>
                    {m.rate} <span className="text-[10px] text-slate-400">{m.currency}</span>
                  </td>
                  <td className={cx(tdCls, "tnum text-slate-500")}>{m.supplier ?? "—"}</td>
                  <td className={cx(tdCls, "tnum text-slate-500")}>{m.latencyMs !== null ? `${m.latencyMs} ms` : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
        <Pagination page={page} limit={PAGE_LIMIT} total={total} onPage={setPage} />
      </Card>
    </div>
  );
}
