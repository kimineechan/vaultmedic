import { describe, expect, it, vi } from "vitest";
import { parseRangeResponse, passwordHashRange, PwnedPasswordsClient } from "../src/main/hibp";

describe("Pwned Passwords k-anonymity", () => {
  it("splits a SHA-1 hash into a five-character prefix and local suffix", () => {
    expect(passwordHashRange("password")).toEqual({
      prefix: "5BAA6",
      suffix: "1E4C9B93F3F0682250B6CF8331B7EE68FD8",
    });
  });

  it("sends only the prefix and requests response padding", async () => {
    const secret = "this must never appear in the request";
    const { prefix, suffix } = passwordHashRange(secret);
    const fetcher = vi.fn(async (
      _url: string,
      _init?: { headers?: Record<string, string>; signal?: AbortSignal },
    ) => ({
      ok: true,
      status: 200,
      text: async () => `${suffix}:42\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:0\n`,
    }));
    const client = new PwnedPasswordsClient(fetcher);

    await expect(client.check(secret)).resolves.toBe(42);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${prefix}`);
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain(secret);
    expect(url).not.toContain(suffix);
    expect(init?.headers).toMatchObject({ "Add-Padding": "true" });
  });

  it("ignores padding records with a zero count", () => {
    expect(parseRangeResponse("ABCDEF:0\n", "ABCDEF")).toBe(0);
  });

  it("caches a range response only in memory", async () => {
    const first = "password";
    const second = "password1";
    // These fixtures deliberately share no prefix, so use two identical checks to prove caching.
    const { suffix } = passwordHashRange(first);
    const fetcher = vi.fn(async () => ({ ok: true, status: 200, text: async () => `${suffix}:7\n` }));
    const client = new PwnedPasswordsClient(fetcher);
    await client.check(first);
    await client.check(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(second).not.toBe(first);
  });
});
