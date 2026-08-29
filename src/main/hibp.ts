import { createHash } from "node:crypto";

export interface FetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type FetchLike = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<FetchResponse>;

export interface HashRange {
  prefix: string;
  suffix: string;
}

export function passwordHashRange(password: string): HashRange {
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  return { prefix: hash.slice(0, 5), suffix: hash.slice(5) };
}

export function parseRangeResponse(body: string, expectedSuffix: string): number {
  for (const line of body.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    const suffix = line.slice(0, separator).trim().toUpperCase();
    if (suffix !== expectedSuffix) continue;
    const count = Number.parseInt(line.slice(separator + 1).trim(), 10);
    return Number.isFinite(count) && count > 0 ? count : 0;
  }
  return 0;
}

export class PwnedPasswordsClient {
  private readonly cache = new Map<string, string>();

  constructor(private readonly fetcher: FetchLike) {}

  async check(password: string): Promise<number> {
    const { prefix, suffix } = passwordHashRange(password);
    let body = this.cache.get(prefix);

    if (body === undefined) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await this.fetcher(
          `https://api.pwnedpasswords.com/range/${prefix}`,
          {
            headers: {
              "Add-Padding": "true",
              "User-Agent": "VaultMedic/0.1 (local desktop password health assistant)",
            },
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          throw new Error(`Pwned Passwords returned HTTP ${response.status}.`);
        }
        body = await response.text();
        this.cache.set(prefix, body);
      } finally {
        clearTimeout(timeout);
      }
    }

    return parseRangeResponse(body, suffix);
  }

  clear(): void {
    this.cache.clear();
  }
}
