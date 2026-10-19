import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function key(): Buffer {
  const secret = process.env.PROVIDER_ENCRYPTION_KEY;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("Set PROVIDER_ENCRYPTION_KEY before managing provider credentials in production.");
  }
  return createHash("sha256").update(secret || "ghost-development-provider-key").digest();
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(value: string): string {
  const [iv, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

// Kept for provider integrations that already depend on these names.
export const encryptProviderSecret = encryptSecret;
export const decryptProviderSecret = decryptSecret;
