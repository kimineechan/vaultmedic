import { describe, expect, it } from "vitest";
import { parsePasswordCsv } from "../src/main/csv-import";

describe("password CSV import", () => {
  it("normalizes Chrome-compatible columns", () => {
    const records = parsePasswordCsv(
      'name,url,username,password,note\nExample,https://example.com,alex@example.com,"a,b""c",personal\n',
    );
    expect(records).toEqual([
      {
        name: "Example",
        url: "https://example.com",
        username: "alex@example.com",
        password: 'a,b"c',
        note: "personal",
      },
    ]);
  });

  it("accepts Firefox export columns", () => {
    const records = parsePasswordCsv(
      "url,username,password,httpRealm,formActionOrigin,guid,timeCreated\nhttps://mozilla.org,fox,den-secret,,,abc,0\n",
    );
    expect(records[0]).toMatchObject({
      url: "https://mozilla.org",
      username: "fox",
      password: "den-secret",
    });
  });

  it("rejects a CSV without password data", () => {
    expect(() => parsePasswordCsv("url,username\nhttps://example.com,alex\n")).toThrow(
      /No password column/,
    );
  });

  it("rejects NUL bytes instead of treating a binary file as CSV", () => {
    expect(() => parsePasswordCsv("url,password\n\0,bad\n")).toThrow(/not a text CSV/);
  });
});
