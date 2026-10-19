"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Ban, CheckCircle2, PencilLine, Plus, Search, UsersRound } from "lucide-react";
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
  Textarea,
  thCls,
} from "@/components/ui";

interface ClientRow {
  id: number;
  name: string;
  email: string | null;
  company: string | null;
  status: string;
  marginPct: string;
  permissions: string[];
  notes: string | null;
  createdAt: string;
  messagesCount: number;
}

const PAGE_LIMIT = 15;

export default function ClientsPage() {
  const me = useMe();
  const [rows, setRows] = useState<ClientRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isAdmin = me?.role === "admin";

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ rows: ClientRow[]; total: number }>(`/api/clients${qs({ q, status, page, limit: PAGE_LIMIT })}`);
      setRows(d.rows);
      setTotal(d.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clients.");
      setRows([]);
    }
  }, [q, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(row: ClientRow) {
    setEditing(row);
    setFormError(null);
    setModalOpen(true);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await apiPatch(`/api/clients/${editing.id}`, {
          name: fd.get("name"),
          email: fd.get("email"),
          company: fd.get("company"),
          marginPct: fd.get("marginPct"),
          notes: fd.get("notes"),
        });
      } else {
        await apiPost("/api/clients", Object.fromEntries(fd.entries()));
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(row: ClientRow) {
    try {
      await apiPatch(`/api/clients/${row.id}`, { status: row.status === "active" ? "suspended" : "active" });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  return (
    <div>
      <PageHeader
        icon={UsersRound}
        title="Clients"
        subtitle="Downstream client accounts, commercial margins and termination permissions."
        actions={isAdmin ? <Btn icon={Plus} onClick={openCreate}>Add client</Btn> : undefined}
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
          <Input className="pl-10" placeholder="Search clients…" value={qInput} onChange={(e) => setQInput(e.target.value)} />
        </form>
        <Select className="w-36" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </Select>
      </Card>

      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">{error}</p>}

      <Card>
        <TableShell>
          <thead>
            <tr>
              <th className={thCls}>Client</th>
              <th className={thCls}>Contact</th>
              <th className={thCls}>Margin</th>
              <th className={thCls}>Permissions</th>
              <th className={thCls}>Messages</th>
              <th className={thCls}>Status</th>
              {isAdmin && <th className={cx(thCls, "text-right")}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <LoadingRows colSpan={isAdmin ? 7 : 6} />
            ) : rows.length === 0 ? (
              <EmptyState
                colSpan={isAdmin ? 7 : 6}
                icon={UsersRound}
                title="No clients onboarded"
                description="Register downstream clients to attribute traffic, apply margins and gate termination permissions."
                action={isAdmin ? <Btn size="sm" icon={Plus} onClick={openCreate}>Add first client</Btn> : undefined}
              />
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-slate-50/70">
                  <td className={tdCls}>
                    <span className="font-bold text-slate-900">{c.name}</span>
                    {c.company && <span className="block text-[11.5px] text-slate-400">{c.company}</span>}
                  </td>
                  <td className={cx(tdCls, "tnum text-slate-500")}>{c.email ?? "—"}</td>
                  <td className={tdCls}>
                    <Badge tone="blue">{c.marginPct}%</Badge>
                  </td>
                  <td className={tdCls}>
                    {c.permissions.length ? (
                      <span className="tnum text-[11px] text-slate-500">{c.permissions.join(" · ")}</span>
                    ) : (
                      <span className="text-slate-300">default</span>
                    )}
                  </td>
                  <td className={cx(tdCls, "tnum font-semibold text-slate-900")}>{c.messagesCount}</td>
                  <td className={tdCls}>
                    <StatusPill status={c.status} />
                  </td>
                  {isAdmin && (
                    <td className={cx(tdCls, "text-right")}>
                      <div className="inline-flex gap-1.5">
                        <Btn size="sm" variant="outline" icon={PencilLine} onClick={() => openEdit(c)}>
                          Edit
                        </Btn>
                        {c.status === "active" ? (
                          <Btn size="sm" variant="danger" icon={Ban} onClick={() => toggle(c)}>
                            Suspend
                          </Btn>
                        ) : (
                          <Btn size="sm" variant="outline" icon={CheckCircle2} onClick={() => toggle(c)}>
                            Activate
                          </Btn>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
        <Pagination page={page} limit={PAGE_LIMIT} total={total} onPage={setPage} />
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit — ${editing.name}` : "Add client"}
        subtitle="Commercial terms apply to all attributed traffic."
        wide
      >
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          {formError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-medium text-rose-700 sm:col-span-2">{formError}</p>
          )}
          <Field label="Client name">
            <Input name="name" defaultValue={editing?.name ?? ""} required placeholder="Acme Verification Ltd" />
          </Field>
          <Field label="Company">
            <Input name="company" defaultValue={editing?.company ?? ""} placeholder="Acme Group" />
          </Field>
          <Field label="Contact email">
            <Input name="email" type="email" defaultValue={editing?.email ?? ""} placeholder="ops@acme.com" />
          </Field>
          <Field label="Margin %" hint="Markup applied on buy rates">
            <Input name="marginPct" defaultValue={editing?.marginPct ?? "0"} inputMode="decimal" className="tnum" placeholder="10" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea name="notes" defaultValue={editing?.notes ?? ""} placeholder="Routing preferences, invoice terms…" />
            </Field>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Btn type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Btn>
            <Btn type="submit" loading={saving}>
              {editing ? "Save changes" : "Create client"}
            </Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
