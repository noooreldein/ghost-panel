"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Download, DownloadCloud, MessageSquare, Phone, Search } from "lucide-react";
import { apiGet, fmtDate, fmtDateTime, fmtNum, qs } from "@/lib/client";
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

interface MyNumberRow {
  id: number;
  msisdn: string;
  status: string;
  source: string | null;
  notes: string | null;
  lastMessageAt: string | null;
  assignedAt: string | null;
  rangeName: string | null;
  rangePrefix: string | null;
  country: string | null;
  messagesCount: number;
}

const PAGE_LIMIT = 15;

export default function MyNumbersPage() {
  const [rows, setRows] = useState<MyNumberRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ rows: MyNumberRow[]; total: number }>(
        `/api/sms/numbers/mine${qs({ q, status, page, limit: PAGE_LIMIT })}`
      );
      setRows(d.rows);
      setTotal(d.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load assigned numbers.");
      setRows([]);
    }
  }, [q, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const activeCount = rows ? rows.filter((r) => r.status === "active").length : 0;
  const totalMessages = rows ? rows.reduce((acc, r) => acc + (r.messagesCount || 0), 0) : 0;

  return (
    <div>
      <PageHeader
        icon={DownloadCloud}
        title="My Numbers"
        subtitle="SMS numbers assigned to your account, with live inventory stats and one-click CSV export."
        actions={
          <Btn
            variant="outline"
            icon={Download}
            onClick={() => {
              window.location.href = "/api/sms/numbers/mine?format=csv";
            }}
          >
            Download CSV
          </Btn>
        }
      />

      {/* Stat Cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3.5 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
            <Phone className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Total Assigned</p>
            <p className="tnum mt-0.5 text-xl font-bold text-slate-900">{fmtNum(total)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3.5 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Active Count</p>
            <p className="tnum mt-0.5 text-xl font-bold text-slate-900">{rows ? fmtNum(activeCount) : "—"}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3.5 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-100 bg-violet-50 text-violet-700">
            <MessageSquare className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Messages Received</p>
            <p className="tnum mt-0.5 text-xl font-bold text-slate-900">{rows ? fmtNum(totalMessages) : "—"}</p>
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="mb-4 flex flex-wrap items-center gap-2.5 p-3.5">
        <form
          className="relative min-w-[220px] flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQ(qInput);
          }}
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={1.75} />
          <Input
            className="pl-10"
            placeholder="Search MSISDN…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
          />
        </form>
        <Select
          className="w-36"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="blocked">Blocked</option>
        </Select>
        {(q || status) && (
          <Btn
            variant="ghost"
            size="md"
            onClick={() => {
              setQ("");
              setQInput("");
              setStatus("");
              setPage(1);
            }}
          >
            Reset
          </Btn>
        )}
      </Card>

      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">{error}</p>}

      <Card>
        <TableShell>
          <thead>
            <tr>
              <th className={thCls}>MSISDN</th>
              <th className={thCls}>Range</th>
              <th className={thCls}>Country</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Messages</th>
              <th className={thCls}>Assigned</th>
              <th className={thCls}>Last message</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <LoadingRows colSpan={7} />
            ) : rows.length === 0 ? (
              <EmptyState
                colSpan={7}
                icon={Phone}
                title="No assigned numbers"
                description="No SMS numbers are assigned to your account matching the selected filter criteria."
              />
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                  <td className={cx(tdCls, "tnum font-bold text-slate-900")}>
                    <span className="tnum">{r.msisdn}</span>
                  </td>
                  <td className={tdCls}>
                    {r.rangeName || r.rangePrefix ? (
                      <div className="inline-flex items-center gap-1.5">
                        {r.rangeName && <span className="font-medium text-slate-700">{r.rangeName}</span>}
                        {r.rangePrefix && <Badge tone="blue">+{r.rangePrefix.replace(/^\+/, "")}</Badge>}
                      </div>
                    ) : (
                      <Badge tone="slate">unassigned</Badge>
                    )}
                  </td>
                  <td className={tdCls}>{r.country ?? "—"}</td>
                  <td className={tdCls}>
                    <StatusPill status={r.status} />
                  </td>
                  <td className={cx(tdCls, "tnum font-semibold text-slate-900")}>{fmtNum(r.messagesCount)}</td>
                  <td className={cx(tdCls, "tnum text-slate-500")}>{fmtDate(r.assignedAt)}</td>
                  <td className={cx(tdCls, "tnum text-slate-500")}>{fmtDateTime(r.lastMessageAt)}</td>
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
