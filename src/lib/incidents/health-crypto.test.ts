import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { decryptHealthField, encryptHealthField } from "./health-crypto";

// P10c health field encryption (pure, no DB). Sets a throwaway key for the
// run so the round-trip and tamper-detection are exercised deterministically.
describe("health field encryption (P10c)", () => {
  beforeAll(() => {
    process.env.HEALTH_DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  });

  it("round-trips a value", () => {
    const plain = "Fraktur linker Unterarm, Gips 6 Wochen";
    const enc = encryptHealthField(plain);
    expect(enc).not.toBeNull();
    expect(enc).not.toContain(plain); // ciphertext is not the plaintext
    expect(decryptHealthField(enc)).toBe(plain);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptHealthField("same text");
    const b = encryptHealthField("same text");
    expect(a).not.toBe(b);
    expect(decryptHealthField(a)).toBe("same text");
    expect(decryptHealthField(b)).toBe("same text");
  });

  it("returns null for null/empty input (absent stays absent)", () => {
    expect(encryptHealthField(null)).toBeNull();
    expect(encryptHealthField("")).toBeNull();
    expect(decryptHealthField(null)).toBeNull();
  });

  it("carries a key-generation prefix", () => {
    const enc = encryptHealthField("x");
    expect(enc?.startsWith("v1:")).toBe(true);
  });

  it("rejects a tampered ciphertext (auth tag fails)", () => {
    const enc = encryptHealthField("secret diagnosis") as string;
    const parts = enc.split(":");
    // Flip a byte in the ciphertext part.
    const ct = Buffer.from(parts[3], "base64");
    ct[0] = ct[0] ^ 0xff;
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${ct.toString("base64")}`;
    expect(() => decryptHealthField(tampered)).toThrow();
  });

  it("rejects an unknown key generation", () => {
    const enc = encryptHealthField("x") as string;
    const swapped = `v9:${enc.split(":").slice(1).join(":")}`;
    expect(() => decryptHealthField(swapped)).toThrow(/key generation/);
  });

  it("rejects a malformed payload", () => {
    expect(() => decryptHealthField("not-valid")).toThrow(/Malformed/);
  });
});
