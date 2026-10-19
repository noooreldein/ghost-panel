"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PauseCircle, PlayCircle, Plus, Rows3, Search } from "lucide-react";
import { apiGet, apiPatch, apiPost, fmtDate, qs } from "@/lib/client";
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

interface RangeRow {
  id: number;
  name: string;
  prefix: string;
  country: string;
  network: string | null;
  currency: string;
  rate: string;
  payout: string;
  supplier: string | null;
  status: string;
  createdAt: string;
  numbersCount: number;
}

const PAGE_LIMIT = 15;

export default function SmsRangesPage() {
  const me = useMe();
  const [rows, setRows] = useState<RangeRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isAdmin = me?.role === "admin";

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ rows: RangeRow[]; total: number }>(
        `/api/sms/ranges${qs({ q, status, page, limit: PAGE_LIMIT })}`
      );
      setRows(d.rows);
      setTotal(d.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load ranges.");
      setRows([]);
    }
  }, [q, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function addRange(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setFormError(null);
    try {
      await apiPost("/api/sms/ranges", Object.fromEntries(fd.entries()));
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create range.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(row: RangeRow) {
    try {
      await apiPatch(`/api/sms/ranges/${row.id}`, { status: row.status === "active" ? "paused" : "active" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  return (
    <div>
      <PageHeader
        icon={Rows3}
        title="SMS Ranges"
        subtitle="Prefix blocks, per-range rates and supplier attribution."
        actions={
          isAdmin ? (
            <Btn icon={Plus} onClick={() => setModalOpen(true)}>
              Assign range
            </Btn>
          ) : undefined
        }
      />

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
          <Input className="pl-10" placeholder="Search name, prefix or country…" value={qInput} onChange={(e) => setQInput(e.target.value)} />
        </form>
        <Select className="w-36" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </Select>
        {(q || status) && (
          <Btn variant="ghost" onClick={() => { setQ(""); setQInput(""); setStatus(""); setPage(1); }}>
            Reset
          </Btn>
        )}
      </Card>

      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">{error}</p>}

      <Card>
        <TableShell>
          <thead>
            <tr>
              <th className={thCls}>Range</th>
              <th className={thCls}>Prefix</th>
              <th className={thCls}>Country / Network</th>
              <th className={thCls}>Rate</th>
              <th className={thCls}>Payout</th>
              <th className={thCls}>Supplier</th>
              <th className={thCls}>Numbers</th>
              <th className={thCls}>Status</th>
              {isAdmin && <th className={cx(thCls, "text-right")}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <LoadingRows colSpan={isAdmin ? 9 : 8} />
            ) : rows.length === 0 ? (
              <EmptyState
                colSpan={isAdmin ? 9 : 8}
                icon={Rows3}
                title="No active ranges found"
                description="No active ranges found. Assign ranges via Admin or API — ingestion routes resolve against this table automatically."
                action={
                  isAdmin ? (
                    <Btn size="sm" icon={Plus} onClick={() => setModalOpen(true)}>
                      Assign first range
                    </Btn>
                  ) : undefined
                }
              />
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                  <td className={cx(tdCls, "font-bold text-slate-900")}>
                    {r.name}
                    <span className="tnum mt-0.5 block text-[10.5px] font-medium text-slate-400">since {fmtDate(r.createdAt)}</span>
                  </td>
                  <td className={tdCls}>
                    <Badge tone="blue" className="text-[11.5px]">+{r.prefix}</Badge>
                  </td>
                  <td className={tdCls}>
                    <span className="font-medium text-slate-700">{r.country}</span>
                    {r.network && <span className="block text-[11.5px] text-slate-400">{r.network}</span>}
                  </td>
                  <td className={cx(tdCls, "tnum font-semibold text-slate-900")}>
                    {r.rate} <span className="text-[10.5px] text-slate-400">{r.currency}</span>
                  </td>
                  <td className={cx(tdCls, "tnum text-slate-600")}>
                    {r.payout} <span className="text-[10.5px] text-slate-400">{r.currency}</span>
                  </td>
                  <td className={cx(tdCls, "tnum text-slate-500")}>{r.supplier ?? "—"}</td>
                  <td className={tdCls}>
                    <Badge tone={r.numbersCount > 0 ? "slate" : "amber"}>{r.numbersCount}</Badge>
                  </td>
                  <td className={tdCls}>
                    <StatusPill status={r.status} />
                  </td>
                  {isAdmin && (
                    <td className={cx(tdCls, "text-right")}>
                      <Btn
                        size="sm"
                        variant={r.status === "active" ? "outline" : "primary"}
                        icon={r.status === "active" ? PauseCircle : PlayCircle}
                        onClick={() => toggle(r)}
                      >
                        {r.status === "active" ? "Pause" : "Activate"}
                      </Btn>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
        <Pagination page={page} limit={PAGE_LIMIT} total={total} onPage={setPage} />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Assign range" subtitle="Register a prefix block for live termination." wide>
        <form onSubmit={addRange} className="grid gap-4 sm:grid-cols-2">
          {formError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-medium text-rose-700 sm:col-span-2">{formError}</p>
          )}
          <Field label="Range name">
            <Input name="name" placeholder="UK EE — OTP Pool A" required />
          </Field>
          <Field label="Prefix" hint="Digits only — longest-prefix matching applies">
            <Input name="prefix" placeholder="4477" required className="tnum" />
          </Field>
          <Field label="Country">
            <Input name="country" placeholder="United Kingdom" required />
          </Field>
          <Field label="Network / MNC">
            <Input name="network" placeholder="EE" />
          </Field>
          <Field label="Rate">
            <Input name="rate" placeholder="0.0250" inputMode="decimal" className="tnum" />
          </Field>
          <Field label="Payout">
            <Input name="payout" placeholder="0.0180" inputMode="decimal" className="tnum" />
          </Field>
          <Field label="Currency">
            <Select name="currency" defaultValue="USD">
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="EGP">EGP</option>
            </Select>
          </Field>
          <Field label="Supplier">
            <Input name="supplier" placeholder="supplier-handle" />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Btn type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Btn>
            <Btn type="submit" loading={saving} icon={Plus}>
              Assign range
            </Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
