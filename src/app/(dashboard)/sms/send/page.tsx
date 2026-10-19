"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PhoneOutgoing, Send, MessageSquareText, Search, AlertCircle, CheckCircle2 } from "lucide-react";
import { apiGet, apiPost, fmtDateTime, qs } from "@/lib/client";
import {
  Btn,
  Card,
  cx,
  EmptyState,
  Field,
  Input,
  LoadingRows,
  PageHeader,
  Pagination,
  Select,
  StatusPill,
  TableShell,
  tdCls,
  Textarea,
  thCls,
} from "@/components/ui";

interface NumberOption {
  id: number;
  msisdn: string;
  rangeName?: string | null;
  rangePrefix?: string | null;
}

interface OutboundRow {
  id: number;
  msisdn: string;
  senderId: string | null;
  body: string;
  destination: string | null;
  status: string;
  isTest: boolean;
  createdAt: string;
  rangeName?: string | null;
  clientName?: string | null;
}

const PAGE_LIMIT = 15;

export default function SmsSendPage() {
  // Number options state
  const [numbers, setNumbers] = useState<NumberOption[]>([]);
  const [loadingNumbers, setLoadingNumbers] = useState(true);

  // Form state
  const [fromMsisdn, setFromMsisdn] = useState("");
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [singleDestination, setSingleDestination] = useState("");
  const [bulkDestinations, setBulkDestinations] = useState("");
  const [cli, setCli] = useState("");
  const [message, setMessage] = useState("");

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Outbound log table state
  const [rows, setRows] = useState<OutboundRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loadingTable, setLoadingTable] = useState(false);

  // Load sender numbers
  const loadNumbers = useCallback(async () => {
    setLoadingNumbers(true);
    try {
      const res = await apiGet<{ rows: NumberOption[] }>("/api/sms/numbers?limit=100");
      setNumbers(res.rows || []);
      if (res.rows && res.rows.length > 0 && !fromMsisdn) {
        setFromMsisdn(res.rows[0].msisdn);
      }
    } catch {
      setNumbers([]);
    } finally {
      setLoadingNumbers(false);
    }
  }, [fromMsisdn]);

  // Load recent outbound messages log
  const loadOutbound = useCallback(async (p: number, qStr: string) => {
    setLoadingTable(true);
    try {
      const query = qs({ page: p, limit: PAGE_LIMIT, q: qStr || undefined });
      const res = await apiGet<{ total: number; page: number; rows: OutboundRow[] }>(`/api/sms/outbound${query}`);
      setRows(res.rows || []);
      setTotal(res.total || 0);
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoadingTable(false);
    }
  }, []);

  useEffect(() => {
    loadNumbers();
  }, [loadNumbers]);

  useEffect(() => {
    loadOutbound(page, search);
  }, [loadOutbound, page, search]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;

    setError(null);
    setSuccessMsg(null);

    if (!fromMsisdn) {
      setError("Please select a 'From' number.");
      return;
    }

    const payload: Record<string, unknown> = {
      msisdn: fromMsisdn,
      cli,
      message,
    };

    if (mode === "single") {
      if (!singleDestination.trim()) {
        setError("Please enter a destination phone number.");
        return;
      }
      payload.destination = singleDestination.trim();
    } else {
      const list = bulkDestinations
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      if (!list.length) {
        setError("Please enter at least one destination number.");
        return;
      }
      if (list.length > 100) {
        setError("Maximum 100 destinations allowed per batch.");
        return;
      }
      payload.destinations = list;
    }

    setSending(true);
    try {
      const res = await apiPost<{ count: number; ids: number[] }>("/api/sms/outbound", payload);
      setSuccessMsg(`${res.count} message(s) sent successfully.`);
      if (mode === "single") {
        setSingleDestination("");
      } else {
        setBulkDestinations("");
      }
      setPage(1);
      loadOutbound(1, search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send outbound SMS.");
    } finally {
      setSending(false);
    }
  };

  const smsParts = Math.max(1, Math.ceil(message.length / 160));

  return (
    <div>
      <PageHeader
        icon={PhoneOutgoing}
        title="SMS Send"
        subtitle="Send single or bulk outbound SMS from panel numbers — traffic is recorded in the outbound ledger."
      />

      <div className="grid gap-6">
        {/* Send Form Card */}
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
              <MessageSquareText className="h-4.5 w-4.5 text-blue-600" strokeWidth={1.9} />
              Dispatch Outbound Traffic
            </h3>

            {/* Segmented Mode Switcher */}
            <div className="flex rounded-xl border border-slate-200 bg-slate-50/80 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("single");
                  setError(null);
                }}
                className={cx(
                  "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                  mode === "single"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("bulk");
                  setError(null);
                }}
                className={cx(
                  "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                  mode === "bulk"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Bulk
              </button>
            </div>
          </div>

          {error && (
            <div className="animate-shake mb-5 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
              <p>{error}</p>
            </div>
          )}

          {successMsg && (
            <div className="animate-fade-up mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2} />
              <p>{successMsg}</p>
            </div>
          )}

          <form onSubmit={handleSend} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="FROM NUMBER" hint={loadingNumbers ? "Loading numbers..." : undefined}>
                <Select
                  value={fromMsisdn}
                  onChange={(e) => setFromMsisdn(e.target.value)}
                  disabled={loadingNumbers || sending}
                  required
                >
                  <option value="">-- Select panel number --</option>
                  {numbers.map((n) => (
                    <option key={n.id} value={n.msisdn} className="tnum">
                      {n.msisdn} {n.rangeName ? `(${n.rangeName})` : ""}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="SENDER ID / CLI" hint="Max 11 characters">
                <Input
                  value={cli}
                  onChange={(e) => setCli(e.target.value)}
                  placeholder="Sender ID / CLI"
                  maxLength={11}
                  disabled={sending}
                  required
                />
              </Field>
            </div>

            {mode === "single" ? (
              <Field label="DESTINATION" hint="E.164 format e.g. +447700900123">
                <Input
                  value={singleDestination}
                  onChange={(e) => setSingleDestination(e.target.value)}
                  placeholder="+E.164"
                  className="tnum"
                  disabled={sending}
                  required
                />
              </Field>
            ) : (
              <Field label="DESTINATIONS (BULK)" hint="One E.164 number per line (max 100)">
                <Textarea
                  value={bulkDestinations}
                  onChange={(e) => setBulkDestinations(e.target.value)}
                  placeholder={"+447700900123\n+447700900124\n+447700900125"}
                  rows={4}
                  className="tnum font-mono text-xs"
                  disabled={sending}
                  required
                />
              </Field>
            )}

            <Field
              label="MESSAGE BODY"
              hint={`${message.length} / 1600 chars · ${smsParts} part${smsParts > 1 ? "s" : ""}`}
            >
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter SMS message content..."
                maxLength={1600}
                rows={4}
                disabled={sending}
                required
              />
            </Field>

            <div className="flex justify-end pt-2">
              <Btn type="submit" icon={Send} loading={sending}>
                Send SMS
              </Btn>
            </div>
          </form>
        </Card>

        {/* Recent Outbound Table Card */}
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div>
              <h3 className="text-[14.5px] font-bold text-slate-900">Recent Outbound Messages</h3>
              <p className="mt-0.5 text-[12.5px] text-slate-500">Live ledger of outbound dispatches</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search destination, msisdn..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
          </div>

          <TableShell>
            <thead>
              <tr>
                <th className={thCls}>Time</th>
                <th className={thCls}>From</th>
                <th className={thCls}>To</th>
                <th className={thCls}>CLI</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Message</th>
              </tr>
            </thead>
            <tbody>
              {loadingTable && rows === null ? (
                <LoadingRows colSpan={6} rows={5} />
              ) : !rows || rows.length === 0 ? (
                <EmptyState
                  colSpan={6}
                  icon={PhoneOutgoing}
                  title="No outbound messages recorded"
                  description="Use the dispatch form above to send single or bulk SMS messages."
                />
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                    <td className={cx(tdCls, "tnum whitespace-nowrap text-slate-500")}>
                      {fmtDateTime(r.createdAt)}
                    </td>
                    <td className={cx(tdCls, "tnum font-semibold text-slate-900")}>
                      {r.msisdn}
                    </td>
                    <td className={cx(tdCls, "tnum text-slate-800")}>
                      {r.destination ?? "—"}
                    </td>
                    <td className={cx(tdCls, "tnum text-slate-600")}>
                      {r.senderId ?? "—"}
                    </td>
                    <td className={tdCls}>
                      <StatusPill status={r.status} />
                    </td>
                    <td className={cx(tdCls, "max-w-[320px]")}>
                      <p className="truncate text-[12.5px] text-slate-600" title={r.body}>
                        {r.body}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </TableShell>

          {total > PAGE_LIMIT && (
            <div className="border-t border-slate-100 p-4">
              <Pagination page={page} limit={PAGE_LIMIT} total={total} onPage={(p) => setPage(p)} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
