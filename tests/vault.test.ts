import { describe, expect, it } from "vitest";
import { PwnedPasswordsClient } from "../src/main/hibp";
import { VaultSession } from "../src/main/vault";

function session() {
  const client = new PwnedPasswordsClient(async () => ({
    ok: true,
    status: 200,
    text: async () => "",
  }));
  return new VaultSession(client);
}

const records = [
  { name: "One", url: "https://one.example", username: "alex", password: "shared-secret-1!", note: "" },
  { name: "Two", url: "https://two.example", username: "alex", password: "shared-secret-1!", note: "" },
];

describe("vault session boundary", () => {
  it("returns findings without bulk plaintext passwords", () => {
    const vault = session();
    const snapshot = vault.import(records, { fileName: "passwords.csv", filePath: "/tmp/passwords.csv", isDemo: false });
    expect(snapshot.stats.reused).toBe(2);
    expect(snapshot.accounts[0]?.reusedCount).toBe(2);
    expect(JSON.stringify(snapshot)).not.toContain("shared-secret-1!");
    expect(JSON.stringify(snapshot)).not.toContain("/tmp/passwords.csv");
  });

  it("reveals only one explicitly selected secret", () => {
    const vault = session();
    const snapshot = vault.import(records, { fileName: "passwords.csv", filePath: null, isDemo: false });
    expect(vault.reveal(snapshot.accounts[0]!.id)).toEqual({ value: "shared-secret-1!", kind: "imported" });
  });

  it("recalculates reuse after staging a unique replacement", () => {
    const vault = session();
    const snapshot = vault.import(records, { fileName: "passwords.csv", filePath: null, isDemo: false });
    const updated = vault.stageReplacement(snapshot.accounts[0]!.id, "Unique!Replacement#2026");
    expect(updated.stats.reused).toBe(0);
    expect(updated.accounts[0]?.hasReplacement).toBe(true);
  });

  it("keeps passwords out of the security report but includes them in an explicit manager export", () => {
    const vault = session();
    const snapshot = vault.import(records, { fileName: "passwords.csv", filePath: null, isDemo: false });
    vault.stageReplacement(snapshot.accounts[0]!.id, "Unique!Replacement#2026");
    expect(vault.securityReport()).not.toContain("shared-secret-1!");
    expect(vault.securityReport()).not.toContain("Unique!Replacement#2026");
    expect(vault.passwordManagerCsv(false)).toContain("Unique!Replacement#2026");
    expect(vault.passwordManagerCsv(false)).not.toContain("shared-secret-1!");
  });
});
