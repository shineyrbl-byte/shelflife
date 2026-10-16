import { describe, expect, it } from "vitest";
import { hashPassword, hashToken, newToken, verifyPassword } from "../auth";

describe("passwords", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const stored = await hashPassword("correct horse battery");
    expect(stored).toMatch(/^scrypt\$/);
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("wrong password", stored)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects malformed stored hashes instead of crashing", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  });
});

describe("one-time tokens", () => {
  it("stores only a hash that matches the token", () => {
    const { token, tokenHash } = newToken();
    expect(token).not.toBe(tokenHash);
    expect(hashToken(token)).toBe(tokenHash);
    expect(token.length).toBeGreaterThanOrEqual(40);
  });
});
