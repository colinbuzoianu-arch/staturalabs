import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// P10c (SLD_P10_COMPARTMENT_DESIGN_NOTE.md §7, D3) field-level encryption for
// the free-text medical fields of the health sub-compartment (ERGO §3.18(c):
// "field-level encryption at rest for free-text medical fields"). AES-256-GCM,
// one random 96-bit IV per field, the authentication tag stored with the
// ciphertext, and a key-GENERATION id prefix so a future rotation can tell key
// generations apart without re-reading this file.
//
// Storage format (base64 parts): "<keyId>:<ivB64>:<tagB64>:<ciphertextB64>".
//
// Key: HEALTH_DATA_ENCRYPTION_KEY (env, 32 bytes base64), read LAZILY so a unit
// test can set it before calling. PRODUCTION key management — KMS-backed
// storage, rotation, per-tenant keys — is a P13 hardening item, deliberately
// not faked here; the keyId prefix is the seam that makes rotation possible.

const KEY_ID = "v1";
const IV_BYTES = 12;

function loadKey(): Buffer {
  const raw = process.env.HEALTH_DATA_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "HEALTH_DATA_ENCRYPTION_KEY is not set — health data cannot be encrypted/decrypted.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `HEALTH_DATA_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}).`,
    );
  }
  return key;
}

// Encrypt a free-text medical value. Returns the storage string, or null for a
// null/empty input (an absent field stays absent, never an encrypted empty
// string).
export function encryptHealthField(plaintext: string | null): string | null {
  if (plaintext === null || plaintext.length === 0) return null;
  const key = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${KEY_ID}:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

// Decrypt a stored value. Returns null for null input. Throws on a malformed
// payload, an unknown key id, or a failed authentication tag (tamper) — a
// decrypt failure is never swallowed into a partial/plaintext read.
export function decryptHealthField(stored: string | null): string | null {
  if (stored === null) return null;
  const parts = stored.split(":");
  if (parts.length !== 4) {
    throw new Error("Malformed encrypted health field");
  }
  const [keyId, ivB64, tagB64, ctB64] = parts;
  if (keyId !== KEY_ID) {
    throw new Error(`Unknown health key generation: ${keyId}`);
  }
  const key = loadKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}
