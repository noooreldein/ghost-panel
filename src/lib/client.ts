/* Client-side helpers — safe to import from "use client" components */

export interface ApiOk<T> {
  ok: true;
  data: T;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parse(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    throw new ApiError(json.error ?? `Request failed (${res.status})`, res.status);
  }
  return json;
}

export async function apiGet<T = any>(url: string): Promise<T> {
  return parse(await fetch(url, { cache: "no-store", credentials: "include" })) as Promise<T>;
}

/* ------------------------------------------------------------------ */
/*  Weak-network resilience                                           */
/* ------------------------------------------------------------------ */

/**
 * Short-lived client-side GET cache with in-flight deduplication.
 * On slow links this turns N mount-time fetches (e.g. every page calling
 * /api/settings via useMe) into one round-trip per TTL window. Any mutating
 * call (POST/PATCH/DELETE through apiPost) busts the whole cache, so data
 * written by the user is always re-read fresh.
 */
const getCache = new Map<string, { at: number; data: unknown }>();
const getInflight = new Map<string, Promise<unknown>>();

export function bustGetCache(): void {
  getCache.clear();
}

export async function apiGetCached<T = any>(url: string, ttlMs = 30000): Promise<T> {
  const hit = getCache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  const existing = getInflight.get(url);
  if (existing) return existing as Promise<T>;
  const p = apiGet<T>(url)
    .then((data) => {
      getCache.set(url, { at: Date.now(), data });
      getInflight.delete(url);
      return data;
    })
    .catch((e) => {
      getInflight.delete(url);
      throw e;
    });
  getInflight.set(url, p);
  return p;
}

export async function apiPost<T = any>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const out = (await parse(
    await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  )) as T;
  bustGetCache(); // a successful write invalidates every cached read
  return out;
}

export const apiPatch = <T = any>(url: string, body?: unknown) => apiPost<T>(url, body ?? {}, "PATCH");

/* ------------------------------------------------------------------ */

export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v) !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/* ------------------------------------------------------------------ */

export const CURRENCIES = ["USD", "EUR", "EGP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_META: Record<Currency, { label: string; symbol: string }> = {
  USD: { label: "US Dollar", symbol: "$" },
  EUR: { label: "Euro", symbol: "€" },
  EGP: { label: "Egyptian Pound", symbol: "E£" },
};

export function fmtMoney(value: string | number | null | undefined, currency = "USD"): string {
  const n = Number(value ?? 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(
      Number.isFinite(n) ? n : 0
    );
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function fmtNum(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

export function fmtDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function setCookie(name: string, value: string, days = 365): void {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}
