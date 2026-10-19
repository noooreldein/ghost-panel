"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Save, Shield, UserRound } from "lucide-react";
import { apiPatch, fmtDate, fmtMoney } from "@/lib/client";
import { useMe } from "@/lib/use-me";
import { Badge, Btn, Card, Field, Input, PageHeader } from "@/components/ui";

export default function ProfilePage() {
  const router = useRouter();
  const me = useMe();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me) {
      setFullName(me.fullName ?? "");
      setEmail(me.email ?? "");
    }
  }, [me]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSuccess(false);
    setError(null);

    if (newPassword) {
      if (newPassword.length < 8) {
        setError("New password must be at least 8 characters long.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("New passwords do not match.");
        return;
      }
      if (!currentPassword) {
        setError("Please enter your current password.");
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, string> = {
        fullName,
        email,
      };

      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      await apiPatch("/api/profile", payload);
      setSuccess(true);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  if (!me) {
    return (
      <div>
        <PageHeader
          icon={UserRound}
          title="Profile"
          subtitle="Your account, contact details, and credentials."
        />
        <Card className="p-8 text-center text-sm text-slate-500">
          Loading profile…
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        icon={UserRound}
        title="Profile"
        subtitle="Your account, contact details, and credentials."
      />

      {error && (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">
          {error}
        </p>
      )}

      {success && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-700">
          <Check className="h-4 w-4" /> Saved / تم الحفظ
        </p>
      )}

      {/* Summary Card */}
      <Card className="mb-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <UserRound className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-900">{me.username}</span>
                <Badge tone={me.role === "admin" ? "violet" : "blue"}>{me.role}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Member since {fmtDate(me.createdAt)}
              </p>
            </div>
          </div>
        </div>

        {/* Currency balances */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
            <p className="text-[11px] font-semibold text-slate-400">USD BALANCE</p>
            <p className="tnum mt-1 text-base font-bold text-slate-900">
              {fmtMoney(me.balanceUsd, "USD")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
            <p className="text-[11px] font-semibold text-slate-400">EUR BALANCE</p>
            <p className="tnum mt-1 text-base font-bold text-slate-900">
              {fmtMoney(me.balanceEur, "EUR")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
            <p className="text-[11px] font-semibold text-slate-400">EGP BALANCE</p>
            <p className="tnum mt-1 text-base font-bold text-slate-900">
              {fmtMoney(me.balanceEgp, "EGP")}
            </p>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Form Card 1: Details */}
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-bold text-slate-900">Account Info</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full Name">
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
              />
            </Field>
            <Field label="Email Address">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </Field>
          </div>
        </Card>

        {/* Form Card 2: Change Password */}
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-slate-500" strokeWidth={1.75} />
            <h2 className="text-sm font-bold text-slate-900">Change Password</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Current Password">
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <Field label="New Password" hint="Minimum 8 characters">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                placeholder="••••••••"
              />
            </Field>
            <Field label="Confirm New Password">
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
          </div>
        </Card>

        <div className="flex justify-end">
          <Btn type="submit" icon={Save} loading={saving}>
            Save changes
          </Btn>
        </div>
      </form>

      {/* Ghost API Hint Card */}
      <Card className="mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Shield className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Developer & Integration Access</p>
              <p className="text-xs text-slate-500">
                Manage API keys, webhooks and IP whitelist from the Ghost API page.
              </p>
            </div>
          </div>
          <Btn variant="outline" onClick={() => router.push("/ghost-api")}>
            Open Ghost API
          </Btn>
        </div>
      </Card>
    </div>
  );
}
