"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Download, FileSpreadsheet, Scale } from "lucide-react";
import { apiGet, CURRENCIES, daysAgoIso, fmtDateTime, fmtMoney, qs, todayIso, type Currency } from "@/lib/client";
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
  Segmented,
  Select,
  TableShell,
  tdCls,
  thCls,
} from "@/components/ui";

interface LedgerRow {
  id: number;
  currency: string;
  direction: string;
  amount: string;
  description: string;
  reference: string | null;
  createdAt: string;
}

const PAGE_LIMIT = 20;

export default function StatementPage() {
  const params = useParams<{ currency: string }>();
  const router = useRouter();
  const raw = (params.currency ?? "usd").toUpperCase();
  const currency: Currency = (CURRENCIES as readonly string[]).includes(raw) ? (raw as Currency) : "USD";

  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [balance, setBalance] = useState<string | null>(null);
  const [totals, setTotals] = useState<{ credit: string; debit: string }>({ credit: "0", debit: "0" });
  const [from, setFrom] = useState(daysAgoIso(29));
  const [to, setTo] = useState(todayIso());
  const [direction, setDirection] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{
        rows: LedgerRow[];
        total: number;
        balance: string;
        totals: { credit: string; debit: string };
      }>(`/api/statements${qs({ currency, from, to, direction, page, limit: PAGE_LIMIT })}`);
      setRows(d.rows);
      setTotal(d.total);
      setBalance(d.balance);
      setTotals(d.totals);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load statement.");
      setRows([]);
    }
  }, [currency, from, to, direction, page]);

  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  const csvHref = `/api/statements${qs({ currency, from, to, direction, format: "csv" })}`;

  return (
    <div>
      <PageHeader
        icon={FileSpreadsheet}
        title={`${currency} Statement`}
        subtitle="Multi-currency ledger — every credit and debit movement on this currency account."
        actions={
          <>
            <Segmented<Currency>
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              value={currency}
              onChange={(c) => router.push(`/financials/statements/${c.toLowerCase()}`)}
            />
            <a href={csvHref} download>
              <Btn icon={Download} variant="dark">
                Export CSV
              </Btn>
            </a>
          </>
        }
      />

      {/* totals */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700">
            <Scale className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="tnum text-[9.5px] font-bold tracking-[0.18em] text-slate-400">CURRENT BALANCE</p>
            <p className="tnum mt-0.5 text-xl font-bold text-slate-900">{balance !== null ? fmtMoney(balance, currency) : "…"}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <ArrowDownLeft className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="tnum text-[9.5px] font-bold tracking-[0.18em] text-slate-400">CREDITS (WINDOW)</p>
            <p className="tnum mt-0.5 text-xl font-bold text-emerald-700">{fmtMoney(totals.credit, currency)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600">
            <ArrowUpRight className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="tnum text-[9.5px] font-bold tracking-[0.18em] text-slate-400">DEBITS (WINDOW)</p>
            <p className="tnum mt-0.5 text-xl font-bold text-rose-700">{fmtMoney(totals.debit, currency)}</p>
          </div>
        </Card>
      </div>

      {/* filters */}
      <Card className="mb-4 flex flex-wrap items-center gap-2.5 p-3.5">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-400" strokeWidth={1.75} />
          <Input type="date" className="tnum w-40" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
          <span className="text-slate-400">→</span>
          <Input type="date" className="tnum w-40" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
        </div>
        <Select className="w-40" value={direction} onChange={(e) => { setPage(1); setDirection(e.target.value); }}>
          <option value="">Credits + debits</option>
          <option value="credit">Credits only</option>
          <option value="debit">Debits only</option>
        </Select>
      </Card>

      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">{error}</p>}

      <Card>
        <TableShell>
          <thead>
            <tr>
              <th className={thCls}>Timestamp</th>
              <th className={thCls}>Description</th>
              <th className={thCls}>Reference</th>
              <th className={cx(thCls, "text-right")}>Credit</th>
              <th className={cx(thCls, "text-right")}>Debit</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <LoadingRows colSpan={5} />
            ) : rows.length === 0 ? (
              <EmptyState
                colSpan={5}
                icon={FileSpreadsheet}
                title={`No ${currency} ledger entries`}
                description="Withdrawals, refunds and settlement credits post to this ledger automatically as activity occurs."
              />
            ) : (
              rows.map((r) => {
                const isCredit = r.direction === "credit";
                return (
                  <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                    <td className={cx(tdCls, "tnum whitespace-nowrap text-slate-500")}>{fmtDateTime(r.createdAt)}</td>
                    <td className={tdCls}>
                      <span className="font-medium text-slate-800">{r.description}</span>
                    </td>
                    <td className={tdCls}>{r.reference ? <Badge tone="slate">{r.reference}</Badge> : "—"}</td>
                    <td className={cx(tdCls, "tnum text-right font-bold", isCredit ? "text-emerald-600" : "text-slate-200")}>
                      {isCredit ? `+${fmtMoney(r.amount, currency)}` : "—"}
                    </td>
                    <td className={cx(tdCls, "tnum text-right font-bold", !isCredit ? "text-rose-600" : "text-slate-200")}>
                      {!isCredit ? `−${fmtMoney(r.amount, currency)}` : "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </TableShell>
        <Pagination page={page} limit={PAGE_LIMIT} total={total} onPage={setPage} />
      </Card>
    </div>
  );
}
