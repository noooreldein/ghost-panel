"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Ban, CheckCircle2, Phone, Plus, Search, Upload, UserPlus } from "lucide-react";
import { apiGet, apiPatch, apiPost, fmtDateTime, qs } from "@/lib/client";
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
  Textarea,
  thCls,
} from "@/components/ui";

interface NumberRow {
  id: number;
  msisdn: string;
  status: string;
  source: string | null;
  notes: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  rangeId: number | null;
  rangeName: string | null;
  rangePrefix: string | null;
  country: string | null;
  assignedClientId: number | null;
  assignedClientName: string | null;
}

interface RangeOption {
  id: number;
  name: string;
  prefix: string;
}
interface ClientOption {
  id: number;
  name: string;
  status: string;
}

const PAGE_LIMIT = 15;

export default function SmsNumbersPage() {
  const me = useMe();
  const [rows, setRows] = useState<NumberRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [status, setStatus] = useState("");
  const [rangeId, setRangeId] = useState("");
  const [ranges, setRanges] = useState<RangeOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const isAdmin = me?.role === "admin";

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ rows: NumberRow[]; total: number }>(
        `/api/sms/numbers${qs({ q, status, rangeId, page, limit: PAGE_LIMIT })}`
      );
      setRows(d.rows);
      setTotal(d.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load numbers.");
      setRows([]);
    }
  }, [q, status, rangeId, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiGet<{ rows: RangeOption[] }>("/api/sms/ranges?limit=200")
      .then((d) => setRanges(d.rows))
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiGet<{ rows: ClientOption[] }>("/api/clients?limit=200")
      .then((d) => setClients(d.rows.filter((c) => c.status === "active")))
      .catch(() => {});
  }, []);

  useEffect(() => { setSelected([]); }, [page, q, status, rangeId]);

  async function addNumber(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setFormError(null);
    try {
      await apiPost("/api/sms/numbers", {
        msisdn: fd.get("msisdn"),
        rangeId: fd.get("rangeId") || null,
        notes: fd.get("notes"),
      });
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not add number.");
    } finally {
      setSaving(false);
    }
  }

  async function setNumberStatus(row: NumberRow, next: string) {
    try {
      await apiPatch(`/api/sms/numbers/${row.id}`, { status: next });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  async function allocate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAllocating(true);
    const fd = new FormData(e.currentTarget);
    try {
      await apiPost("/api/sms/numbers/allocate", { numberIds: selected, clientId: fd.get("clientId") || null, onlyUnassigned: fd.get("onlyUnassigned") === "on" });
      setSelected([]); setAllocationOpen(false); load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Allocation failed.");
    } finally { setAllocating(false); }
  }

  async function importNumbers(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setImporting(true);
    const fd = new FormData(e.currentTarget);
    try {
      const result = await apiPost<{ inserted: number; skipped: number }>("/api/sms/numbers/import", Object.fromEntries(fd.entries()));
      setImportOpen(false); setError(`Imported ${result.inserted} numbers; skipped ${result.skipped} existing entries.`); load();
    } catch (err) { setError(err instanceof Error ? err.message : "Import failed."); }
    finally { setImporting(false); }
  }

  return (
    <div>
      <PageHeader
        icon={Phone}
        title="SMS Numbers"
        subtitle="Provisioned DIDs / MSISDN inventory wired for inbound termination."
        actions={
          isAdmin ? (
            <div className="flex gap-2">
              <Btn variant="outline" icon={UserPlus} disabled={!selected.length} onClick={() => setAllocationOpen(true)}>Assign ({selected.length})</Btn>
              <Btn variant="outline" icon={Upload} onClick={() => setImportOpen(true)}>Import</Btn>
              <Btn icon={Plus} onClick={() => setModalOpen(true)}>Provision number</Btn>
            </div>
          ) : undefined
        }
      />

      {/* filter bar */}
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
        <Select className="w-44" value={rangeId} onChange={(e) => { setPage(1); setRangeId(e.target.value); }}>
          <option value="">All ranges</option>
          {ranges.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} (+{r.prefix})
            </option>
          ))}
        </Select>
        <Select className="w-36" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="blocked">Blocked</option>
        </Select>
        {(q || status || rangeId) && (
          <Btn
            variant="ghost"
            size="md"
            onClick={() => {
              setQ(""); setQInput(""); setStatus(""); setRangeId(""); setPage(1);
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
              {isAdmin && <th className={thCls}><input type="checkbox" aria-label="Select all" checked={!!rows?.length && selected.length === rows.length} onChange={(e) => setSelected(e.target.checked ? (rows ?? []).map((n) => n.id) : [])} /></th>}
              <th className={thCls}>MSISDN</th>
              <th className={thCls}>Range</th>
              <th className={thCls}>Country</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Client</th>
              <th className={thCls}>Source</th>
              <th className={thCls}>Last message</th>
              <th className={thCls}>Added</th>
              {isAdmin && <th className={cx(thCls, "text-right")}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <LoadingRows colSpan={isAdmin ? 10 : 8} />
            ) : rows.length === 0 ? (
              <EmptyState
                colSpan={isAdmin ? 10 : 8}
                icon={Phone}
                title="No numbers provisioned"
                description="No active numbers found. Assign numbers via Admin provisioning or the ingestion API — the table is live-ready."
                action={
                  isAdmin ? (
                    <Btn size="sm" icon={Plus} onClick={() => setModalOpen(true)}>
                      Provision first number
                    </Btn>
                  ) : undefined
                }
              />
            ) : (
              rows.map((n) => (
                <tr key={n.id} className="transition-colors hover:bg-slate-50/70">
                  {isAdmin && <td className={tdCls}><input type="checkbox" checked={selected.includes(n.id)} onChange={(e) => setSelected((ids) => e.target.checked ? [...ids, n.id] : ids.filter((id) => id !== n.id))} aria-label={`Select ${n.msisdn}`} /></td>}
                  <td className={cx(tdCls, "tnum font-bold text-slate-900")}>{n.msisdn}</td>
                  <td className={tdCls}>
                    {n.rangeName ? (
                      <span className="font-medium text-slate-700">
                        {n.rangeName}
                        <span className="tnum ml-1.5 text-[11px] text-slate-400">+{n.rangePrefix}</span>
                      </span>
                    ) : (
                      <Badge tone="slate">unassigned</Badge>
                    )}
                  </td>
                  <td className={tdCls}>{n.country ?? "—"}</td>
                  <td className={tdCls}>
                    <StatusPill status={n.status} />
                  </td>
                  <td className={tdCls}>{n.assignedClientName ? <span className="font-medium text-slate-700">{n.assignedClientName}</span> : <span className="text-slate-300">Unassigned</span>}</td>
                  <td className={cx(tdCls, "tnum text-slate-500")}>{n.source ?? "—"}</td>
                  <td className={cx(tdCls, "tnum whitespace-nowrap text-slate-500")}>{n.lastMessageAt ? fmtDateTime(n.lastMessageAt) : "—"}</td>
                  <td className={cx(tdCls, "tnum whitespace-nowrap text-slate-500")}>{fmtDateTime(n.createdAt)}</td>
                  {isAdmin && (
                    <td className={cx(tdCls, "text-right")}>
                      {n.status === "blocked" ? (
                        <Btn size="sm" variant="outline" icon={CheckCircle2} onClick={() => setNumberStatus(n, "active")}>
                          Unblock
                        </Btn>
                      ) : (
                        <Btn size="sm" variant="danger" icon={Ban} onClick={() => setNumberStatus(n, "blocked")}>
                          Block
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

      {/* provision modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Provision number" subtitle="Attach a live DID to a termination range.">
        <form onSubmit={addNumber} className="space-y-4">
          {formError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-medium text-rose-700">{formError}</p>
          )}
          <Field label="MSISDN" hint="E.164 preferred, e.g. +447700900123">
            <Input name="msisdn" placeholder="+447700900123" required className="tnum" />
          </Field>
          <Field label="Termination range">
            <Select name="rangeId" defaultValue="">
              <option value="">— Unassigned —</option>
              {ranges.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} (+{r.prefix})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes">
            <Textarea name="notes" placeholder="Supplier, channel, special handling…" />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Btn type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Btn>
            <Btn type="submit" loading={saving} icon={Plus}>
              Provision
            </Btn>
          </div>
        </form>
      </Modal>

      <Modal open={allocationOpen} onClose={() => setAllocationOpen(false)} title="Assign selected numbers" subtitle={`${selected.length} numbers selected. Assign them to a client or reclaim them to inventory.`}>
        <form onSubmit={allocate} className="space-y-4">
          <Field label="Client">
            <Select name="clientId" defaultValue="">
              <option value="">— Reclaim to inventory —</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="onlyUnassigned" /> Only change currently unassigned numbers</label>
          <div className="flex justify-end gap-2"><Btn type="button" variant="outline" onClick={() => setAllocationOpen(false)}>Cancel</Btn><Btn type="submit" loading={allocating} icon={UserPlus}>Confirm assignment</Btn></div>
        </form>
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Bulk import numbers" subtitle="Paste E.164 numbers separated by lines, spaces, commas, or semicolons. Maximum 1,000 per import.">
        <form onSubmit={importNumbers} className="space-y-4">
          <Field label="Numbers"><Textarea name="numbers" required className="tnum min-h-[160px]" placeholder={"+447700900123\n+201001234567\n+4915123456789"} /></Field>
          <Field label="Termination range"><Select name="rangeId" defaultValue=""><option value="">— Unassigned —</option>{ranges.map((r) => <option key={r.id} value={r.id}>{r.name} (+{r.prefix})</option>)}</Select></Field>
          <Field label="Notes"><Input name="notes" placeholder="Supplier, batch reference, special handling" /></Field>
          <div className="flex justify-end gap-2"><Btn type="button" variant="outline" onClick={() => setImportOpen(false)}>Cancel</Btn><Btn type="submit" loading={importing} icon={Upload}>Import numbers</Btn></div>
        </form>
      </Modal>
    </div>
  );
}
