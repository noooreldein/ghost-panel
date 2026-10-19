"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CheckCircle2, HandCoins, Plus, Wallet, XCircle } from "lucide-react";
import { apiGet, apiPatch, apiPost, CURRENCIES, fmtDateTime, fmtMoney, qs } from "@/lib/client";
import type { SafeUser } from "@/lib/auth";
import {
  Badge,
  Btn,
  Card,
  cx,
  EmptyState,
  Field,
  Input,
  LoadingRows,
  Modal,
  PageHeader,
  Pagination,
  Select,
  StatusPill,
  TableShell,
  tdCls,
  Textarea,
  thCls,
} from "@/components/ui";

interface RequestRow {
  id: number;
  userId: number;
  username: string;
  amount: string;
  currency: string;
  method: string;
  destination: string;
  status: string;
  note: string | null;
  createdAt: string;
  processedAt: string | null;
}
interface PayoutAccount { id: number; label: string; method: string; destinationHint: string; status: string; }

const PAGE_LIMIT = 15;
const METHOD_META: Record<string, string> = { bank: "Bank transfer", paypal: "PayPal", crypto: "Crypto wallet" };

export default function PaymentRequestsPage() {
  const [me, setMe] = useState<SafeUser | null>(null);
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [payoutAccounts, setPayoutAccounts] = useState<PayoutAccount[]>([]);
  const isAdmin = me?.role === "admin";

  const loadMe = useCallback(() => {
    apiGet<{ user: SafeUser }>("/api/settings").then((d) => setMe(d.user)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ rows: RequestRow[]; total: number }>(
        `/api/payment-requests${qs({ status, page, limit: PAGE_LIMIT })}`
      );
      setRows(d.rows);
      setTotal(d.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load requests.");
      setRows([]);
    }
  }, [status, page]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiGet<{ accounts: PayoutAccount[] }>("/api/payout-accounts").then((d) => setPayoutAccounts(d.accounts.filter((a) => a.status === "active"))).catch(() => {});
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setFormError(null);
    try {
      await apiPost("/api/payment-requests", Object.fromEntries(fd.entries()));
      setModalOpen(false);
      load();
      loadMe();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Withdrawal failed.");
    } finally {
      setSaving(false);
    }
  }

  async function act(row: RequestRow, action: "approve" | "reject") {
    try {
      await apiPatch(`/api/payment-requests/${row.id}`, { action });
      load();
      loadMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    }
  }

  return (
    <div>
      <PageHeader
        icon={HandCoins}
        title="Payment Requests"
        subtitle="Withdraw earnings across USD, EUR and EGP corridors. Funds lock instantly on request."
        actions={<Btn icon={Plus} onClick={() => setModalOpen(true)}>New withdrawal</Btn>}
      />

      {/* balances */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {CURRENCIES.map((c) => {
          const balance = me ? (c === "EUR" ? me.balanceEur : c === "EGP" ? me.balanceEgp : me.balanceUsd) : null;
          return (
            <Card key={c} className="flex items-center gap-4 p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700">
                <Wallet className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div>
                <p className="tnum text-[9.5px] font-bold tracking-[0.18em] text-slate-400">AVAILABLE · {c}</p>
                <p className="tnum mt-0.5 text-xl font-bold text-slate-900">{balance !== null ? fmtMoney(balance, c) : "…"}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mb-4 flex flex-wrap items-center gap-2.5 p-3.5">
        <Select className="w-40" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">Any status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
        {isAdmin && <Badge tone="blue">ADMIN VIEW — ALL ACCOUNTS</Badge>}
      </Card>

      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">{error}</p>}

      <Card>
        <TableShell>
          <thead>
            <tr>
              <th className={thCls}>Ref</th>
              {isAdmin && <th className={thCls}>Account</th>}
              <th className={thCls}>Amount</th>
              <th className={thCls}>Method</th>
              <th className={thCls}>Destination</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Requested</th>
              {isAdmin && <th className={cx(thCls, "text-right")}>Decision</th>}
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <LoadingRows colSpan={isAdmin ? 8 : 6} />
            ) : rows.length === 0 ? (
              <EmptyState
                colSpan={isAdmin ? 8 : 6}
                icon={HandCoins}
                title="No payment requests"
                description="Withdraw your available balance — requests lock funds instantly and settle after admin approval."
                action={<Btn size="sm" icon={Plus} onClick={() => setModalOpen(true)}>Request payout</Btn>}
              />
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                  <td className={cx(tdCls, "tnum font-semibold text-slate-500")}>PR-{r.id}</td>
                  {isAdmin && <td className={cx(tdCls, "tnum")}>@{r.username}</td>}
                  <td className={cx(tdCls, "tnum font-bold text-slate-900")}>{fmtMoney(r.amount, r.currency)}</td>
                  <td className={tdCls}>
                    <Badge tone="slate">{METHOD_META[r.method] ?? r.method}</Badge>
                  </td>
                  <td className={cx(tdCls, "tnum max-w-[220px] truncate text-slate-500")} title={r.destination}>
                    {r.destination}
                  </td>
                  <td className={tdCls}>
                    <StatusPill status={r.status} />
                  </td>
                  <td className={cx(tdCls, "tnum whitespace-nowrap text-slate-500")}>{fmtDateTime(r.createdAt)}</td>
                  {isAdmin && (
                    <td className={cx(tdCls, "text-right")}>
                      {r.status === "pending" ? (
                        <div className="inline-flex gap-1.5">
                          <Btn size="sm" variant="outline" icon={CheckCircle2} onClick={() => act(r, "approve")}>
                            Approve
                          </Btn>
                          <Btn size="sm" variant="danger" icon={XCircle} onClick={() => act(r, "reject")}>
                            Reject
                          </Btn>
                        </div>
                      ) : (
                        <span className="tnum text-[11px] text-slate-400">{r.processedAt ? fmtDateTime(r.processedAt) : "—"}</span>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
        <Pagination page={page} limit={PAGE_LIMIT} total={total} onPage={setPage} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New withdrawal" subtitle="Amount is locked from your balance immediately; rejected requests are auto-refunded.">
        <form onSubmit={submit} className="space-y-4">
          {formError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-medium text-rose-700">{formError}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount">
              <Input name="amount" placeholder="250.00" inputMode="decimal" className="tnum" required />
            </Field>
            <Field label="Currency">
              <Select name="currency" defaultValue="USD">
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="EGP">EGP</option>
              </Select>
            </Field>
          </div>
          <Field label="Payout method">
            <Select name="method" defaultValue="bank">
              <option value="bank">Bank transfer</option>
              <option value="paypal">PayPal</option>
              <option value="crypto">Crypto wallet</option>
            </Select>
          </Field>
          {payoutAccounts.length > 0 && (
            <Field label="Saved payout account" hint="Selecting one uses its encrypted destination.">
              <Select name="payoutAccountId" defaultValue="">
                <option value="">Enter a destination manually</option>
                {payoutAccounts.map((account) => <option key={account.id} value={account.id}>{account.label} · {account.destinationHint}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Destination" hint="IBAN / account, PayPal email or wallet address">
            <Input name="destination" placeholder="DE44 5001 0517 5407 3249 31" className="tnum" />
          </Field>
          <Field label="Note (optional)">
            <Textarea name="note" placeholder="Invoice reference, instructions…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Btn>
            <Btn type="submit" loading={saving}>Lock &amp; request</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
