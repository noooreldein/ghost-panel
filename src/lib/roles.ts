export const ROLES = ["admin", "user", "supplier"] as const;
export type Role = (typeof ROLES)[number];
export const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/;
