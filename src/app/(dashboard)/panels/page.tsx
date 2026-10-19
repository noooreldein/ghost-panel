"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  LayoutDashboard,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { apiPost, fmtDate } from "@/lib/client";
import { useMe } from "@/lib/use-me";
import { Badge, Btn, Card, EmptyState, Field, Input, Modal, PageHeader, StatusPill, Textarea, cx } from "@/components/ui";

interface PanelBoard {
  id: number;
  ownerId: number;
  ownerName: string | null;
  name: string;
  accentColor: string;
  status: string;
  syncKey: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function PanelsPage() {
  const me = useMe();
  const isAdmin = me?.role === "admin";
  const [rows, setRows] = useState<PanelBoard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<PanelBoard | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    try {
      const d = await apiPost<{ rows: PanelBoard[] }>("/api/panels", undefined, "GET");
      setRows(d.rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load panels.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function reveal(id: number) {
    setRevealed((prev) => new Set(prev).add(id));
  }
  function hide(id: number) {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function createPanel(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiPost("/api/panels", {
        name: fd.get("name"),
        accentColor: fd.get("accentColor"),
        notes: fd.get("notes") || undefined,
      });
      setCreateOpen(false);
      setSuccess("تم إنشاء اللوح بنجاح — panel created.");
      void load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create panel.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editRow) return;
    setSaving(true);
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiPost("/api/panels", {
        id: editRow.id,
        name: fd.get("name"),
        accentColor: fd.get("accentColor"),
        notes: fd.get("notes") || undefined,
      }, "PATCH");
      setEditRow(null);
      setSuccess("تم تحديث اللوح — panel updated.");
      void load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update panel.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(row: PanelBoard) {
    setBusyId(row.id);
    try {
      await apiPost("/api/panels", { id: row.id, status: row.status === "active" ? "suspended" : "active" }, "PATCH");
      setRows((prev) => (prev ?? []).map((r) => (r.id === row.id ? { ...r, status: r.status === "active" ? "suspended" : "active" } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to change panel status.");
    } finally {
      setBusyId(null);
    }
  }

  async function rotateKey(row: PanelBoard) {
    setBusyId(row.id);
    try {
      const d = await apiPost<{ row: PanelBoard }>("/api/panels", { id: row.id, rotateKey: true }, "PATCH");
      setRows((prev) => (prev ?? []).map((r) => (r.id === row.id ? { ...r, syncKey: d.row.syncKey } : r)));
      setSuccess("Sync key rotated. Update any consumers with the new key.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rotate sync key.");
    } finally {
      setBusyId(null);
    }
  }

  async function removePanel(row: PanelBoard) {
    if (!window.confirm(`Delete panel "${row.name}"? This cannot be undone.`)) return;
    setBusyId(row.id);
    try {
      await apiPost("/api/panels", { id: row.id }, "DELETE");
      setRows((prev) => (prev ?? []).filter((r) => r.id !== row.id));
      setSuccess("Panel deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete panel.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        icon={LayoutDashboard}
        title={isAdmin ? "Panels" : "لوحاتي · My Panels"}
        subtitle="Create and control your own sub-panels — each one carries its own accent and a private sync key. You only ever see the panels you own."
        actions={
          <Btn icon={Plus} onClick={() => { setFormError(null); setCreateOpen(true); }}>
            Add panel
          </Btn>
        }
      />

      {error && <ErrorBannerInline message={error} />}
      {success && <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>}

      {rows === null ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-5">
              <div className="skeleton h-24 w-full" />
            </Card>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={LayoutDashboard}
            title="No panels yet"
            description="Create your first sub-panel: give it a name and an accent color, then use its sync key to feed it data."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <Card key={row.id} className={cx("relative overflow-hidden p-5", row.status !== "active" && "opacity-80")}>
              <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: row.accentColor }} />
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md"
                    style={{ background: row.accentColor }}
                  >
                    <LayoutDashboard className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-slate-900">{row.name}</p>
                    <p className="tnum text-[10.5px] text-slate-400">
                      created {fmtDate(row.createdAt)}
                      {isAdmin && row.ownerName ? ` · ${row.ownerName}` : ""}
                    </p>
                  </div>
                </div>
                <StatusPill status={row.status === "active" ? "delivered" : "expired"} />
              </div>

              {row.notes && <p className="mt-3 line-clamp-2 text-[12.5px] text-slate-500">{row.notes}</p>}

              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-slate-400">Sync key</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="tnum min-w-0 flex-1 truncate text-[12px] text-slate-700">
                    {revealed.has(row.id) ? row.syncKey : `${row.syncKey.slice(0, 9)}${"•".repeat(18)}`}
                  </code>
                  <button
                    type="button"
                    onClick={() => (revealed.has(row.id) ? hide(row.id) : reveal(row.id))}
                    className="rounded-md p-1 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600"
                    aria-label={revealed.has(row.id) ? "Hide key" : "Show key"}
                  >
                    {revealed.has(row.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <CopyIconInline value={row.syncKey} />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Btn size="sm" variant="outline" icon={Pencil} onClick={() => { setFormError(null); setEditRow(row); }}>
                  Edit
                </Btn>
                <Btn
                  size="sm"
                  variant="outline"
                  icon={row.status === "active" ? PauseCircle : PlayCircle}
                  loading={busyId === row.id}
                  onClick={() => void toggleStatus(row)}
                >
                  {row.status === "active" ? "Suspend" : "Activate"}
                </Btn>
                <Btn size="sm" variant="outline" icon={RefreshCw} loading={busyId === row.id} onClick={() => void rotateKey(row)}>
                  Rotate key
                </Btn>
                <Btn size="sm" variant="outline" icon={Trash2} className="!text-rose-600" loading={busyId === row.id} onClick={() => void removePanel(row)}>
                  Delete
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add panel" subtitle="A new board under your account, with its own identity and sync key.">
        <form onSubmit={createPanel} className="space-y-4">
          {formError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</p>}
          <Field label="Panel name" hint="2-100 characters.">
            <Input name="name" required placeholder="SMS Hub — Egypt" />
          </Field>
          <Field label="Accent color" hint="Used across the panel's highlights.">
            <Input name="accentColor" type="color" defaultValue="#2563eb" className="h-10 w-20 cursor-pointer p-1" />
          </Field>
          <Field label="Notes" hint="Optional, max 255 characters.">
            <Textarea name="notes" rows={2} maxLength={255} placeholder="What this panel is for…" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Btn type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Btn>
            <Btn type="submit" icon={Plus} loading={saving}>
              Create panel
            </Btn>
          </div>
        </form>
      </Modal>

      <Modal open={!!editRow} onClose={() => setEditRow(null)} title="Edit panel" subtitle={editRow?.name}>
        {editRow && (
          <form onSubmit={saveEdit} className="space-y-4">
            {formError && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</p>}
            <Field label="Panel name">
              <Input name="name" required defaultValue={editRow.name} />
            </Field>
            <Field label="Accent color">
              <Input name="accentColor" type="color" defaultValue={editRow.accentColor} className="h-10 w-20 cursor-pointer p-1" />
            </Field>
            <Field label="Notes">
              <Textarea name="notes" rows={2} maxLength={255} defaultValue={editRow.notes ?? ""} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Btn type="button" variant="outline" onClick={() => setEditRow(null)}>
                Cancel
              </Btn>
              <Btn type="submit" icon={Pencil} loading={saving}>
                Save changes
              </Btn>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

function ErrorBannerInline({ message }: { message: string }) {
  return <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</p>;
}

function CopyIconInline({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-md p-1 text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-600"
      aria-label="Copy sync key"
    >
      <Copy className={cx("h-3.5 w-3.5", copied && "text-emerald-600")} />
    </button>
  );
}
