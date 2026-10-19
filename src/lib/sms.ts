/* Shared SMS utilities (safe on server & client) */

const OTP_REGEX = /\b(\d{4,8})\b/;

/** Extract the first 4-8 digit OTP / verification code from a message body. */
export function extractOtp(body: string): string | null {
  const match = body?.match(OTP_REGEX);
  return match ? match[1] : null;
}

/** Normalize an MSISDN: strips spaces / dashes, keeps leading +. */
export function normalizeMsisdn(value: string): string {
  const cleaned = value.replace(/[\s\-()]/g, "");
  return cleaned.startsWith("+") ? `+${cleaned.slice(1).replace(/\D/g, "")}` : cleaned.replace(/\D/g, "");
}

/** Mask an MSISDN for compact display: +4477****321 */
export function maskMsisdn(value: string): string {
  if (value.length <= 8) return value;
  return `${value.slice(0, 5)}${"*".repeat(Math.max(value.length - 8, 2))}${value.slice(-3)}`;
}

/** Longest prefix match of a number against a set of prefixes. */
export function longestPrefixMatch<T extends { prefix: string }>(number: string, rows: T[]): T | null {
  const digits = number.replace(/^\+/, "");
  let best: T | null = null;
  for (const row of rows) {
    const p = row.prefix.replace(/^\+/, "");
    if (digits.startsWith(p) && (!best || p.length > best.prefix.replace(/^\+/, "").length)) {
      best = row;
    }
  }
  return best;
}
