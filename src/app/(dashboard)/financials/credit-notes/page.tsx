"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Plus, RotateCcw, StickyNote, Wallet } from "lucide-react";
import { apiGet, apiGetCached, apiPatch, apiPost, CURRENCIES, daysAgoIso, fmtDate, fmtMoney, qs, todayIso } from "@/lib/client";
import { useMe } from "@/lib/use-me";
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
  thCls,
} from "@/components/ui";

interface CreditNoteRow {
  id: number;
  userId: number;
  username?: string;
  periodStart: string;
  periodEnd: string;
  amount: string;
  currency: string;
  status: string;
  remarks: string | null;
  issuedAt: string;
  dueDate: string | null;
  paidAt: string | null;
}

interface UserOption {
  id: number;
  username: string;
  fullName: string | null;
  role: string;
}

const PAGE_LIMIT = 15;

export default function CreditNotesPage() {
  const me = useMe();
  const isAdmin = me?.role === "admin";

  const [rows, setRows] = useState<CreditNoteRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Admin modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [usersList, setUsersList] = useState<UserOption[]>([]);

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ rows: CreditNoteRow[]; total: number }>(
        `/api/credit-notes${qs({ status, page, limit: PAGE_LIMIT })}`
      );
      setRows(d.rows);
      setTotal(d.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load credit notes.");
      setRows([]);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isAdmin) {
      apiGetCached<{ rows: UserOption[] }>("/api/users?limit=200", 60000)
        .then((d) => setUsersList(d.rows))
        .catch(() => {});
    }
  }, [isAdmin]);

  const statsByCurrency = useMemo(() => {
    if (!rows) return [];
    const map: Record<string, { pending: number; paid: number }> = {};
    for (const r of rows) {
      const c = r.currency || "USD";
      if (!map[c]) map[c] = { pending: 0, paid: 0 };
      const amt = Number(r.amount) || 0;
      if (r.status === "pending") map[c].pending += amt;
      else if (r.status === "paid") map[c].paid += amt;
    }
    const keys = Object.keys(map);
    if (keys.length === 0) return [{ currency: "USD", pending: 0, paid: 0 }];
    return keys.map((c) => ({ currency: c, pending: map[c].pending, paid: map[c].paid }));
  }, [rows]);

  async function handleGenerate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setFormError(null);
    setSuccessMsg(null);

    const userIdVal = fd.get("userId");
    const body = {
      userId: userIdVal ? Number(userIdVal) : undefined,
      currency: fd.get("currency") || "USD",
      periodStart: fd.get("periodStart") || undefined,
      periodEnd: fd.get("periodEnd") || undefined,
      remarks: fd.get("remarks") || undefined,
    };

    try {
      const res = await apiPost<{ created: number }>("/api/credit-notes", body);
      setModalOpen(false);
      setSuccessMsg(`Successfully generated ${res.created} credit note(s).`);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to generate notes.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: number, newStatus: "paid" | "pending") {
    // Optimistic update: flip the row locally, roll back on failure. No refetch
    // round-trip needed on slow links.
    const snapshot = rows;
    setRows((prev) =>
      (prev ?? []).map((r) =>
        r.id === id
          ? { ...r, status: newStatus, paidAt: newStatus === "paid" ? new Date().toISOString() : null }
          : r
      )
    );
    try {
      await apiPatch("/api/credit-notes", { id, status: newStatus });
    } catch (err) {
      setRows(snapshot);
      setError(err instanceof Error ? err.message : "Failed to update credit note.");
    }
  }

  return (
    <div>
      <PageHeader
        icon={StickyNote}
        title="Credit Notes"
        subtitle="Periodic settlement statements of earnings — generate, review, and settle."
        actions={
          isAdmin ? (
            <Btn icon={Plus} onClick={() => { setFormError(null); setModalOpen(true); }}>
              Generate notes
            </Btn>
          ) : undefined
        }
      />

      {/* Stat cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {statsByCurrency.map((st) => (
          <Card key={st.currency} className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
                <Wallet className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <p className="tnum text-[10px] font-bold tracking-[0.15em] text-slate-400">
                  {st.currency} · PENDING
                </p>
                <p className="tnum text-lg font-bold text-amber-600">
                  {fmtMoney(st.pending, st.currency)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="tnum text-[10px] font-bold tracking-[0.15em] text-slate-400">
                SETTLED / PAID
              </p>
              <p className="tnum text-lg font-bold text-emerald-600">
                {fmtMoney(st.paid, st.currency)}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Filter and Export controls */}
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            className="w-40"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </Select>
          {isAdmin && <Badge tone="blue">ADMIN VIEW — ALL ACCOUNTS</Badge>}
        </div>
        {isAdmin && (
          <Btn
            variant="outline"
            size="sm"
            icon={Download}
            onClick={() => {
              window.location.href = `/api/credit-notes${qs({ format: "csv", status })}`;
            }}
          >
            Export CSV
          </Btn>
        )}
      </Card>

      {/* Banners */}
      {successMsg && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-700">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-800">
            ×
          </button>
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">
          {error}
        </p>
      )}

      {/* Credit notes table */}
      <Card>
        <TableShell>
          <thead>
            <tr>
              <th className={thCls}>Note ID</th>
              {isAdmin && <th className={thCls}>Account</th>}
              <th className={thCls}>Period</th>
              <th className={thCls}>Amount</th>
              <th className={thCls}>Currency</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Due Date</th>
              <th className={thCls}>Remarks</th>
              <th className={thCls}>Issued</th>
              {isAdmin && <th className={cx(thCls, "text-right")}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <LoadingRows colSpan={isAdmin ? 10 : 8} />
            ) : rows.length === 0 ? (
              <EmptyState
                colSpan={isAdmin ? 10 : 8}
                icon={StickyNote}
                title="No credit notes"
                description="Periodic settlement statements of earnings will appear here once generated."
                action={
                  isAdmin ? (
                    <Btn size="sm" icon={Plus} onClick={() => setModalOpen(true)}>
                      Generate notes
                    </Btn>
                  ) : undefined
                }
              />
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                  <td className={cx(tdCls, "tnum font-semibold text-slate-500")}>#CN-{r.id}</td>
                  {isAdmin && <td className={cx(tdCls, "tnum font-medium text-slate-800")}>@{r.username}</td>}
                  <td className={cx(tdCls, "tnum whitespace-nowrap text-slate-600")}>
                    {fmtDate(r.periodStart)} → {fmtDate(r.periodEnd)}
                  </td>
                  <td className={cx(tdCls, "tnum font-bold text-slate-900")}>
                    {fmtMoney(r.amount, r.currency)}
                  </td>
                  <td className={tdCls}>
                    <Badge tone="blue">{r.currency}</Badge>
                  </td>
                  <td className={tdCls}>
                    <StatusPill status={r.status} />
                  </td>
                  <td className={cx(tdCls, "tnum whitespace-nowrap text-slate-500")}>{fmtDate(r.dueDate)}</td>
                  <td className={cx(tdCls, "max-w-[200px] truncate text-slate-500")} title={r.remarks || ""}>
                    {r.remarks || "—"}
                  </td>
                  <td className={cx(tdCls, "tnum whitespace-nowrap text-slate-500")}>{fmtDate(r.issuedAt)}</td>
                  {isAdmin && (
                    <td className={cx(tdCls, "text-right")}>
                      {r.status === "pending" ? (
                        <Btn size="sm" variant="outline" icon={CheckCircle2} onClick={() => updateStatus(r.id, "paid")}>
                          Mark paid
                        </Btn>
                      ) : (
                        <Btn size="sm" variant="ghost" icon={RotateCcw} onClick={() => updateStatus(r.id, "pending")}>
                          Reopen
                        </Btn>
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

      {/* Admin modal for generating credit notes */}
      {isAdmin && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Generate Credit Notes"
          subtitle="Computes net ledger earnings (credits - debits) for the selected period and issues statements."
        >
          <form onSubmit={handleGenerate} className="space-y-4">
            {formError && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-medium text-rose-700">
                {formError}
              </p>
            )}

            <Field label="Target Account">
              <Select name="userId" defaultValue="">
                <option value="">All active users & suppliers</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    @{u.username} ({u.fullName || u.role})
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Currency">
              <Select name="currency" defaultValue="USD">
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Period Start">
                <Input type="date" name="periodStart" defaultValue={daysAgoIso(7)} required />
              </Field>
              <Field label="Period End">
                <Input type="date" name="periodEnd" defaultValue={todayIso()} required />
              </Field>
            </div>

            <Field label="Remarks" hint="Optional description or reference on statement">
              <Input name="remarks" placeholder="Weekly earnings settlement" />
            </Field>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <Btn type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Btn>
              <Btn type="submit" loading={saving} icon={Plus}>
                Generate
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
