"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Ban, CheckCircle2, Copy, Eye, EyeOff, KeyRound, Plus, Search, ShieldAlert, UserCog, Wand2 } from "lucide-react";
import { apiGet, apiPatch, apiPost, fmtDate, fmtMoney, qs } from "@/lib/client";
import type { SafeUser } from "@/lib/auth";
import { useMe } from "@/lib/use-me";
import {
  Badge,
  Btn,
  Card,
  CopyButton,
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

const PAGE_LIMIT = 15;

const ROLE_TONE: Record<string, "blue" | "slate" | "violet"> = { admin: "blue", user: "slate", supplier: "violet" };

function randomPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `${out}#${Math.floor(Math.random() * 90 + 10)}`;
}

export default function AccessControlPage() {
  const me = useMe();
  const isAdmin = me?.role === "admin";

  const [rows, setRows] = useState<SafeUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createPw, setCreatePw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [resetTarget, setResetTarget] = useState<SafeUser | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ rows: SafeUser[]; total: number }>(`/api/users${qs({ q, page, limit: PAGE_LIMIT })}`);
      setRows(d.rows);
      setTotal(d.total);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load accounts.");
      setRows([]);
    }
  }, [q, page]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  }

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setFormError(null);
    try {
      await apiPost("/api/users", {
        username: fd.get("username"),
        password: createPw,
        fullName: fd.get("fullName"),
        email: fd.get("email"),
        role: fd.get("role"),
      });
      setCreateOpen(false);
      setCreatePw("");
      flash("Account created — share the credentials securely.");
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create account.");
    } finally {
      setSaving(false);
    }
  }

  async function patch(user: SafeUser, body: Record<string, unknown>, okMsg: string) {
    try {
      await apiPatch(`/api/users/${user.id}`, body);
      flash(okMsg);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  async function resetPassword(e: FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiPatch(`/api/users/${resetTarget.id}`, { newPassword: resetPw });
      setResetTarget(null);
      setResetPw("");
      flash("Password rotated successfully.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setSaving(false);
    }
  }

  if (me && !isAdmin) {
    return (
      <div>
        <PageHeader icon={UserCog} title="Access Control" subtitle="Operator accounts and role assignments." />
        <Card>
          <EmptyState
            icon={ShieldAlert}
            title="Owner access required"
            description="Account provisioning is restricted to panel owners (admin role). Contact your administrator."
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        icon={UserCog}
        title="Access Control"
        subtitle="Create operator accounts, assign roles and rotate credentials — owner level."
        actions={
          <Btn
            icon={Plus}
            onClick={() => {
              setCreatePw(randomPassword());
              setFormError(null);
              setCreateOpen(true);
            }}
          >
            Create account
          </Btn>
        }
      />

      {notice && (
        <p className="animate-fade-up mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" strokeWidth={1.9} />
          {notice}
        </p>
      )}
      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">{error}</p>}

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
          <Input className="pl-10" placeholder="Search username or name…" value={qInput} onChange={(e) => setQInput(e.target.value)} />
        </form>
        <Badge tone="blue">ROLE-BASED ACCESS CONTROL</Badge>
      </Card>

      <Card>
        <TableShell>
          <thead>
            <tr>
              <th className={thCls}>Account</th>
              <th className={thCls}>Role</th>
              <th className={thCls}>Balance (USD)</th>
              <th className={thCls}>API key</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Created</th>
              <th className={cx(thCls, "text-right")}>Manage</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <LoadingRows colSpan={7} />
            ) : rows.length === 0 ? (
              <EmptyState colSpan={7} icon={UserCog} title="No accounts found" description="Create operator accounts to grant access to the panel." />
            ) : (
              rows.map((u) => {
                const isSelf = me?.id === u.id;
                return (
                  <tr key={u.id} className="transition-colors hover:bg-slate-50/70">
                    <td className={tdCls}>
                      <span className="font-bold text-slate-900">
                        {u.fullName ?? u.username}
                        {isSelf && <Badge tone="blue" className="ml-1.5">you</Badge>}
                      </span>
                      <span className="tnum block text-[11px] text-slate-400">@{u.username}{u.email ? ` · ${u.email}` : ""}</span>
                    </td>
                    <td className={tdCls}>
                      <Select
                        className="h-8 w-32 text-[12px]"
                        value={u.role}
                        disabled={isSelf}
                        onChange={(e) => patch(u, { role: e.target.value }, `Role for @${u.username} set to ${e.target.value}.`)}
                      >
                        <option value="admin">admin</option>
                        <option value="user">user</option>
                        <option value="supplier">supplier</option>
                      </Select>
                    </td>
                    <td className={cx(tdCls, "tnum font-semibold text-slate-900")}>{fmtMoney(u.balanceUsd, "USD")}</td>
                    <td className={tdCls}>
                      {u.apiKey ? (
                        <span className="inline-flex items-center gap-1.5">
                          <code className="tnum text-[11px] text-slate-500">{u.apiKey.slice(0, 12)}…</code>
                          <CopyButton value={u.apiKey} label="" className="h-6 px-1.5" />
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className={tdCls}>
                      <StatusPill status={u.status} />
                    </td>
                    <td className={cx(tdCls, "tnum whitespace-nowrap text-slate-500")}>{fmtDate(u.createdAt)}</td>
                    <td className={cx(tdCls, "text-right")}>
                      <div className="inline-flex gap-1.5">
                        <Btn
                          size="sm"
                          variant="outline"
                          icon={KeyRound}
                          onClick={() => {
                            setResetTarget(u);
                            setResetPw(randomPassword());
                            setFormError(null);
                          }}
                        >
                          Reset
                        </Btn>
                        {!isSelf &&
                          (u.status === "active" ? (
                            <Btn size="sm" variant="danger" icon={Ban} onClick={() => patch(u, { status: "suspended" }, `@${u.username} suspended.`)}>
                              Suspend
                            </Btn>
                          ) : (
                            <Btn size="sm" variant="outline" icon={CheckCircle2} onClick={() => patch(u, { status: "active" }, `@${u.username} reactivated.`)}>
                              Activate
                            </Btn>
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </TableShell>
        <Pagination page={page} limit={PAGE_LIMIT} total={total} onPage={setPage} />
      </Card>

      {/* create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create account" subtitle="The account can sign in immediately with these credentials." wide>
        <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
          {formError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-medium text-rose-700 sm:col-span-2">{formError}</p>
          )}
          <Field label="USERNAME">
            <Input name="username" placeholder="operator.name" className="tnum" required autoComplete="off" />
          </Field>
          <Field label="ROLE" hint="supplier = ingest-only API account">
            <Select name="role" defaultValue="user">
              <option value="user">user — standard</option>
              <option value="supplier">supplier — API ingest</option>
              <option value="admin">admin — full control</option>
            </Select>
          </Field>
          <Field label="FULL NAME">
            <Input name="fullName" placeholder="Ahmed Hassan" />
          </Field>
          <Field label="EMAIL">
            <Input name="email" type="email" placeholder="ops@example.com" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="PASSWORD" hint="Minimum 8 characters — stored as a salted scrypt hash">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={createPw}
                    onChange={(e) => setCreatePw(e.target.value)}
                    className="tnum pr-10"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    aria-label="Toggle password visibility"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
                  </button>
                </div>
                <Btn type="button" variant="outline" icon={Wand2} onClick={() => setCreatePw(randomPassword())}>
                  Generate
                </Btn>
                <CopyButton value={createPw} label="Copy" className="h-10 rounded-xl px-3" />
              </div>
            </Field>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Btn type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Btn>
            <Btn type="submit" loading={saving} icon={Plus}>
              Create account
            </Btn>
          </div>
        </form>
      </Modal>

      {/* reset modal */}
      <Modal open={!!resetTarget} onClose={() => setResetTarget(null)} title={`Reset password — @${resetTarget?.username ?? ""}`} subtitle="The old password stops working immediately.">
        <form onSubmit={resetPassword} className="space-y-4">
          {formError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12.5px] font-medium text-rose-700">{formError}</p>
          )}
          <Field label="NEW PASSWORD">
            <div className="flex gap-2">
              <Input value={resetPw} onChange={(e) => setResetPw(e.target.value)} className="tnum" required />
              <Btn type="button" variant="outline" icon={Wand2} onClick={() => setResetPw(randomPassword())}>
                Generate
              </Btn>
            </div>
          </Field>
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
            <span className="tnum text-[11px] text-slate-500">SHARE VIA A SECURE CHANNEL</span>
            <CopyButton value={resetPw} label="Copy" />
          </div>
          <div className="flex justify-end gap-2">
            <Btn type="button" variant="outline" onClick={() => setResetTarget(null)}>
              Cancel
            </Btn>
            <Btn type="submit" loading={saving} icon={Copy}>
              Rotate password
            </Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
