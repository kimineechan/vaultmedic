import { describe, expect, it } from "vitest";
import { analyzePassword } from "../src/main/password-analysis";
import { generatePassword } from "../src/main/generator";

describe("password health", () => {
  it("warns about short and predictable passwords", () => {
    const result = analyzePassword("qwerty123", { username: "alex", hostname: "example.com" });
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(["very-weak", "short", "sequence"]),
    );
  });

  it("detects account details without returning the source password", () => {
    const password = "alex-example-2026";
    const result = analyzePassword(password, { username: "alex", hostname: "example.com" });
    expect(result.findings.some((finding) => finding.code === "personal")).toBe(true);
    expect(JSON.stringify(result)).not.toContain(password);
  });

  it("generates exact-length passwords with every selected class", () => {
    for (let index = 0; index < 25; index += 1) {
      const password = generatePassword({
        length: 32,
        lowercase: true,
        uppercase: true,
        numbers: true,
        symbols: true,
        avoidAmbiguous: true,
      });
      expect(password).toHaveLength(32);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/\d/);
      expect(password).toMatch(/[^A-Za-z0-9]/);
      expect(password).not.toMatch(/[ilILO01|`]/);
    }
  });

  it("requires a usable length and at least one character set", () => {
    expect(() => generatePassword({ length: 8, lowercase: true, uppercase: false, numbers: false, symbols: false, avoidAmbiguous: true })).toThrow(/between 12 and 128/);
    expect(() => generatePassword({ length: 20, lowercase: false, uppercase: false, numbers: false, symbols: false, avoidAmbiguous: true })).toThrow(/at least one/);
  });
});
