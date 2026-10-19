"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { FlaskConical, ScanSearch, Send, TerminalSquare, Timer, Zap } from "lucide-react";
import { apiGet, apiPost, fmtDateTime } from "@/lib/client";
import { extractOtp } from "@/lib/sms";
import {
  Badge,
  Btn,
  Card,
  cx,
  EmptyState,
  Field,
  Input,
  LoadingRows,
  PageHeader,
  StatusPill,
  TableShell,
  tdCls,
  Textarea,
  thCls,
} from "@/components/ui";

interface TestRow {
  id: number;
  msisdn: string;
  senderId: string | null;
  body: string;
  otpCode: string | null;
  status: string;
  latencyMs: number | null;
  supplier: string | null;
  createdAt: string;
}

interface FireResult {
  row: TestRow;
  extraction: { otp: string | null; matchedRange: { id: number; name: string; prefix: string } | null };
}

export default function SmsTestPanelPage() {
  const [msisdn, setMsisdn] = useState("");
  const [senderId, setSenderId] = useState("");
  const [body, setBody] = useState("");
  const [firing, setFiring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FireResult | null>(null);
  const [rows, setRows] = useState<TestRow[] | null>(null);

  const liveOtp = extractOtp(body);
  const parts = Math.max(1, Math.ceil(body.length / 160));

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ rows: TestRow[] }>("/api/sms/test");
      setRows(d.rows);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function fire(e: FormEvent) {
    e.preventDefault();
    if (firing) return;
    setFiring(true);
    setError(null);
    setResult(null);
    try {
      const d = await apiPost<FireResult & { ok: true }>("/api/sms/test", {
        msisdn,
        senderId: senderId || undefined,
        body,
      });
      setResult({ row: d.row, extraction: d.extraction });
      setBody("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test injection failed.");
    } finally {
      setFiring(false);
    }
  }

  return (
    <div>
      <PageHeader
        icon={FlaskConical}
        title="SMS Test Panel"
        subtitle="Sandbox injection — exercises OTP parsing and range resolution without touching live routes."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* compose */}
        <Card className="h-fit p-5">
          <h3 className="mb-4 flex items-center gap-2 text-[14.5px] font-bold text-slate-900">
            <TerminalSquare className="h-4 w-4 text-blue-600" strokeWidth={1.9} />
            Inject sandbox message
          </h3>

          {error && (
            <p className="animate-shake mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-medium text-rose-700">{error}</p>
          )}

          {result && (
            <div className="animate-fade-up mb-4 space-y-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="flex items-center gap-2 text-[13px] font-bold text-emerald-800">
                <Zap className="h-4 w-4" strokeWidth={2} />
                Delivered into sandbox
              </p>
              <div className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-lg bg-white/80 px-3 py-2">
                  <p className="tnum text-[9px] font-bold tracking-[0.16em] text-slate-400">EXTRACTED CODE</p>
                  <p className="tnum mt-0.5 text-[15px] font-bold text-slate-900">{result.extraction.otp ?? "—"}</p>
                </div>
                <div className="rounded-lg bg-white/80 px-3 py-2">
                  <p className="tnum text-[9px] font-bold tracking-[0.16em] text-slate-400">LATENCY</p>
                  <p className="tnum mt-0.5 flex items-center gap-1 text-[15px] font-bold text-slate-900">
                    <Timer className="h-3.5 w-3.5 text-blue-600" strokeWidth={2} />
                    {result.row.latencyMs} ms
                  </p>
                </div>
              </div>
              <p className="tnum text-[11px] text-emerald-700">
                {result.extraction.matchedRange
                  ? `RESOLVED RANGE: ${result.extraction.matchedRange.name} (+${result.extraction.matchedRange.prefix})`
                  : "NO RANGE MATCHED — routed as unrated"}
              </p>
            </div>
          )}

          <form onSubmit={fire} className="space-y-4">
            <Field label="RECIPIENT (MSISDN)">
              <Input
                value={msisdn}
                onChange={(e) => setMsisdn(e.target.value)}
                placeholder="+447700900123"
                className="tnum"
                required
              />
            </Field>
            <Field label="SENDER ID / CLI" hint="Max 11 alphanumeric chars">
              <Input value={senderId} onChange={(e) => setSenderId(e.target.value)} placeholder="GHOST-TEST" className="tnum" maxLength={16} />
            </Field>
            <Field label={`MESSAGE BODY — ${body.length} chars · ${parts} part${parts > 1 ? "s" : ""}`}>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Your GHOST verification code is 482913. It expires in 5 minutes."
                required
                rows={4}
              />
            </Field>

            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
              <span className="flex items-center gap-2 text-[12px] font-medium text-slate-500">
                <ScanSearch className="h-4 w-4 text-blue-600" strokeWidth={1.9} />
                Parser preview
              </span>
              {liveOtp ? <Badge tone="emerald">code {liveOtp}</Badge> : <Badge tone="slate">no code detected</Badge>}
            </div>

            <Btn type="submit" icon={Send} loading={firing} className="w-full">
              Fire test message
            </Btn>
          </form>
        </Card>

        {/* recent tests */}
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h3 className="text-[14.5px] font-bold text-slate-900">Sandbox log</h3>
            <Badge tone="blue">ISOLATED FROM LIVE METRICS</Badge>
          </div>
          <TableShell>
            <thead>
              <tr>
                <th className={thCls}>Time</th>
                <th className={thCls}>MSISDN</th>
                <th className={thCls}>Message</th>
                <th className={thCls}>Code</th>
                <th className={thCls}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                <LoadingRows colSpan={5} />
              ) : rows.length === 0 ? (
                <EmptyState
                  colSpan={5}
                  icon={FlaskConical}
                  title="Sandbox is empty"
                  description="Fire a test message to validate OTP extraction and longest-prefix range resolution."
                />
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                    <td className={cx(tdCls, "tnum whitespace-nowrap text-slate-500")}>{fmtDateTime(r.createdAt)}</td>
                    <td className={cx(tdCls, "tnum font-semibold text-slate-900")}>{r.msisdn}</td>
                    <td className={cx(tdCls, "max-w-[280px]")}>
                      <p className="truncate text-[12.5px] text-slate-600" title={r.body}>
                        {r.body}
                      </p>
                      <p className="tnum text-[10.5px] text-slate-400">from {r.senderId ?? "—"}</p>
                    </td>
                    <td className={tdCls}>{r.otpCode ? <Badge tone="blue">{r.otpCode}</Badge> : <span className="text-slate-300">—</span>}</td>
                    <td className={tdCls}>
                      <StatusPill status={r.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </TableShell>
        </Card>
      </div>
    </div>
  );
}
