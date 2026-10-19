import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import type { User } from "@/db/schema";

/* ------------------------------------------------------------------ */
/*  JSON responses                                                    */
/* ------------------------------------------------------------------ */

export const ok = (data: Record<string, unknown>, status = 200) =>
  NextResponse.json({ ok: true, ...data }, { status });

export const fail = (error: string, status = 400, extra?: Record<string, unknown>) =>
  NextResponse.json({ ok: false, error, ...extra }, { status });

export function isDatabaseConnectionError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const record = current as { code?: unknown; cause?: unknown; message?: unknown };
    if (record.code === "ECONNREFUSED" || record.code === "ENOTFOUND" || record.code === "ETIMEDOUT") return true;
    if (typeof record.message === "string" && /ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(record.message)) return true;
    current = record.cause;
  }

  return false;
}

/* ------------------------------------------------------------------ */
/*  Auth guards for API routes                                        */
/* ------------------------------------------------------------------ */

interface AuthResult {
  user: User | null;
  error: NextResponse | null;
}

export async function requireAuth(roles?: string[]): Promise<AuthResult> {
  const user = await getSessionUser();
  if (!user) return { user: null, error: fail("Unauthorized. Please sign in.", 401) };
  if (roles && !roles.includes(user.role)) {
    return { user: null, error: fail("Forbidden: insufficient permissions.", 403) };
  }
  return { user, error: null };
}

/* ------------------------------------------------------------------ */
/*  Validation helpers                                                */
/* ------------------------------------------------------------------ */

export const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export const isMsisdn = (v: string): boolean => /^\+?[0-9]{7,15}$/.test(v);

export const isSenderId = (v: string): boolean => /^[A-Za-z0-9\-_ ]{1,11}$/.test(v) || /^\+?[0-9]{1,15}$/.test(v);

export const isCurrency = (v: string): boolean => ["USD", "EUR", "EGP"].includes(v.toUpperCase());

export const strAmount = (v: unknown): string | null => {
  const s = str(v);
  if (!/^\d+(\.\d{1,4})?$/.test(s)) return null;
  return s;
};

/* ------------------------------------------------------------------ */
/*  CSV export                                                        */
/* ------------------------------------------------------------------ */

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvResponse(filename: string, headers: string[], rows: unknown[][]): NextResponse {
  const body = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new NextResponse(`﻿${body}`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Misc                                                              */
/* ------------------------------------------------------------------ */

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "127.0.0.1";
}

export function parseDateBoundary(value: string | null, end = false): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (end && /^\d{4}-\d{2}-\d{2}$/.test(value)) d.setHours(23, 59, 59, 999);
  return d;
}

export function pagination(url: URL, defaultLimit = 50): { limit: number; offset: number; page: number } {
  const limitRaw = Number(url.searchParams.get("limit") ?? defaultLimit);
  const pageRaw = Number(url.searchParams.get("page") ?? 1);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : defaultLimit, 1), 200);
  const page = Math.max(Number.isFinite(pageRaw) ? pageRaw : 1, 1);
  return { limit, offset: (page - 1) * limit, page };
}
