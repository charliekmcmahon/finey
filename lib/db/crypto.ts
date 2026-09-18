import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for refresh tokens at rest. The single master key lives only in
 * `.env.local` (`TOKEN_ENCRYPTION_KEY`, 32 random bytes, base64) — never in the DB, never
 * committed. Access tokens are never persisted at all, so this is the only secret material
 * that ever touches the SQLite file.
 */
function encryptionKey(): Buffer {
  const b64 = process.env.TOKEN_ENCRYPTION_KEY;
  if (!b64) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set — generate one with " +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` +
        " and put it in .env.local",
    );
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

/** Returns `iv.authTag.ciphertext`, each base64. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(payload: string): string {
  const [ivB64, authTagB64, dataB64] = payload.split(".");
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error("malformed encrypted payload");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
