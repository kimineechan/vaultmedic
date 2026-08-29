import { createHash } from "node:crypto";
import type {
  AccountSummary,
  BreachProgress,
  ChecklistPatch,
  PasswordFinding,
  RotationChecklist,
  VaultSnapshot,
} from "../shared/contracts";
import type { ImportedRecord } from "./csv-import";
import { analyzePassword, type PasswordAnalysis } from "./password-analysis";
import { siteGuidance, type SiteGuidance } from "./links";
import type { PwnedPasswordsClient } from "./hibp";

interface SecretEntry {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  replacement: string | null;
  note: string;
  analysis: PasswordAnalysis;
  reusedCount: number;
  breachState: "unknown" | "checking" | "safe" | "exposed" | "error";
  breachCount: number | null;
  checklist: RotationChecklist;
  guidance: SiteGuidance & { hostname: string };
}

interface SourceState {
  fileName: string;
  filePath: string | null;
  importedAt: string;
  rowCount: number;
  isDemo: boolean;
  sourceInTrash: boolean;
}

const EMPTY_CHECKLIST: RotationChecklist = {
  passwordUpdated: false,
  mfaReviewed: false,
  passkeyReviewed: false,
  managerUpdated: false,
};

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function riskFor(entry: SecretEntry, findings: PasswordFinding[]): AccountSummary["risk"] {
  if (findings.some((finding) => finding.severity === "critical")) return "critical";
  if (findings.some((finding) => finding.severity === "high")) return "high";
  if (findings.some((finding) => finding.severity === "medium")) return "medium";
  return "healthy";
}

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function displayName(record: ImportedRecord, hostname: string): string {
  if (record.name.trim()) return record.name.trim().slice(0, 160);
  if (hostname && hostname !== "Unknown website") {
    return hostname.replace(/^www\./, "").split(".")[0]?.replace(/^./, (value) => value.toUpperCase()) || hostname;
  }
  return "Unnamed account";
}

export class VaultSession {
  private entries: SecretEntry[] = [];
  private source: SourceState | null = null;

  constructor(private readonly pwned: PwnedPasswordsClient) {}

  import(records: ImportedRecord[], source: { fileName: string; filePath: string | null; isDemo: boolean }): VaultSnapshot {
    this.clear();
    this.entries = records.map((record, index) => {
      const guidance = siteGuidance(record.url);
      const id = digest(`${record.url}\u0000${record.username}\u0000${index}`).slice(0, 24);
      return {
        id,
        name: displayName(record, guidance.hostname),
        url: record.url,
        username: record.username.slice(0, 512),
        password: record.password,
        replacement: null,
        note: record.note,
        analysis: analyzePassword(record.password, {
          username: record.username,
          hostname: guidance.hostname,
        }),
        reusedCount: 1,
        breachState: "unknown",
        breachCount: null,
        checklist: { ...EMPTY_CHECKLIST },
        guidance,
      };
    });
    this.source = {
      fileName: source.fileName,
      filePath: source.filePath,
      importedAt: new Date().toISOString(),
      rowCount: records.length,
      isDemo: source.isDemo,
      sourceInTrash: false,
    };
    this.recalculateReuse();
    return this.snapshot();
  }

  clear(): VaultSnapshot {
    for (const entry of this.entries) {
      entry.password = "";
      entry.replacement = null;
      entry.note = "";
    }
    this.entries = [];
    this.source = null;
    this.pwned.clear();
    return this.snapshot();
  }

  snapshot(): VaultSnapshot {
    const accounts = this.entries.map((entry) => this.accountSummary(entry));
    const completed = accounts.reduce((sum, account) => sum + account.completedSteps, 0);
    const possible = accounts.length * 4;
    return {
      accounts,
      stats: {
        accounts: accounts.length,
        critical: accounts.filter((account) => account.risk === "critical").length,
        weak: accounts.filter((account) => account.strengthScore <= 2).length,
        reused: accounts.filter((account) => account.reusedCount > 1).length,
        exposed: accounts.filter((account) => account.breachState === "exposed").length,
        secured: accounts.filter((account) => account.secured).length,
        completionPercent: possible === 0 ? 0 : Math.round((completed / possible) * 100),
      },
      source: this.source
        ? {
            fileName: this.source.fileName,
            importedAt: this.source.importedAt,
            rowCount: this.source.rowCount,
            isDemo: this.source.isDemo,
            sourceInTrash: this.source.sourceInTrash,
          }
        : null,
    };
  }

  private accountSummary(entry: SecretEntry): AccountSummary {
    const findings = [...entry.analysis.findings];
    if (entry.reusedCount > 1) {
      findings.unshift({
        code: "reused",
        label: `Reused on ${entry.reusedCount} accounts`,
        detail: "One breach could unlock every account that shares this password.",
        severity: "high",
      });
    }
    if (entry.breachState === "exposed") {
      findings.unshift({
        code: "compromised",
        label: "Found in breach data",
        detail: `This password appears ${entry.breachCount?.toLocaleString() ?? "at least once"} in Pwned Passwords.`,
        severity: "critical",
      });
    }

    const completedSteps = Object.values(entry.checklist).filter(Boolean).length;
    const risk = riskFor(entry, findings);
    return {
      id: entry.id,
      name: entry.name,
      website: entry.guidance.websiteUrl ?? entry.url.slice(0, 160),
      hostname: entry.guidance.hostname,
      username: entry.username,
      risk,
      strengthScore: entry.analysis.score,
      findings,
      reusedCount: entry.reusedCount,
      breachState: entry.breachState,
      breachCount: entry.breachCount,
      hasReplacement: Boolean(entry.replacement),
      checklist: { ...entry.checklist },
      secured: completedSteps === 4 && risk !== "critical" && risk !== "high",
      completedSteps,
      changePasswordUrl: entry.guidance.changePasswordUrl,
      websiteUrl: entry.guidance.websiteUrl,
      mfaRecommendation: entry.guidance.mfaRecommendation,
      passkeyRecommendation: entry.guidance.passkeyRecommendation,
      passkeyKnown: entry.guidance.passkeyKnown,
    };
  }

  private entry(accountId: string): SecretEntry {
    if (!/^[a-f\d]{24}$/.test(accountId)) throw new Error("Invalid account identifier.");
    const entry = this.entries.find((candidate) => candidate.id === accountId);
    if (!entry) throw new Error("Account not found in this vault session.");
    return entry;
  }

  private effectivePassword(entry: SecretEntry): string {
    return entry.replacement ?? entry.password;
  }

  reveal(accountId: string): { value: string; kind: "imported" | "replacement" } {
    const entry = this.entry(accountId);
    return {
      value: this.effectivePassword(entry),
      kind: entry.replacement ? "replacement" : "imported",
    };
  }

  stageReplacement(accountId: string, password: string): VaultSnapshot {
    if (typeof password !== "string" || password.length < 12 || password.length > 128) {
      throw new Error("Replacement passwords must contain 12 to 128 characters.");
    }
    const entry = this.entry(accountId);
    entry.replacement = password;
    entry.analysis = analyzePassword(password, {
      username: entry.username,
      hostname: entry.guidance.hostname,
    });
    entry.breachState = "unknown";
    entry.breachCount = null;
    this.recalculateReuse();
    return this.snapshot();
  }

  discardReplacement(accountId: string): VaultSnapshot {
    const entry = this.entry(accountId);
    entry.replacement = null;
    entry.analysis = analyzePassword(entry.password, {
      username: entry.username,
      hostname: entry.guidance.hostname,
    });
    entry.breachState = "unknown";
    entry.breachCount = null;
    this.recalculateReuse();
    return this.snapshot();
  }

  updateChecklist(accountId: string, patch: ChecklistPatch): VaultSnapshot {
    const entry = this.entry(accountId);
    const allowed: Array<keyof RotationChecklist> = [
      "passwordUpdated",
      "mfaReviewed",
      "passkeyReviewed",
      "managerUpdated",
    ];
    for (const key of allowed) {
      if (typeof patch[key] === "boolean") entry.checklist[key] = patch[key]!;
    }
    return this.snapshot();
  }

  private recalculateReuse(): void {
    const counts = new Map<string, number>();
    for (const entry of this.entries) {
      const fingerprint = digest(this.effectivePassword(entry));
      counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);
    }
    for (const entry of this.entries) {
      entry.reusedCount = counts.get(digest(this.effectivePassword(entry))) ?? 1;
    }
  }

  async checkOne(accountId: string): Promise<VaultSnapshot> {
    const entry = this.entry(accountId);
    const fingerprint = digest(this.effectivePassword(entry));
    const group = this.entries.filter((candidate) => digest(this.effectivePassword(candidate)) === fingerprint);
    for (const candidate of group) candidate.breachState = "checking";
    try {
      const count = await this.pwned.check(this.effectivePassword(entry));
      for (const candidate of group) {
        candidate.breachCount = count;
        candidate.breachState = count > 0 ? "exposed" : "safe";
      }
    } catch {
      for (const candidate of group) {
        candidate.breachCount = null;
        candidate.breachState = "error";
      }
    }
    return this.snapshot();
  }

  async checkAll(onProgress?: (progress: BreachProgress) => void): Promise<VaultSnapshot> {
    const groups = new Map<string, SecretEntry[]>();
    for (const entry of this.entries) {
      const fingerprint = digest(this.effectivePassword(entry));
      const group = groups.get(fingerprint) ?? [];
      group.push(entry);
      groups.set(fingerprint, group);
      entry.breachState = "checking";
      entry.breachCount = null;
    }

    const work = [...groups.values()];
    let cursor = 0;
    let completed = 0;
    const worker = async () => {
      while (cursor < work.length) {
        const group = work[cursor++];
        if (!group?.[0]) continue;
        try {
          const count = await this.pwned.check(this.effectivePassword(group[0]));
          for (const entry of group) {
            entry.breachCount = count;
            entry.breachState = count > 0 ? "exposed" : "safe";
          }
        } catch {
          for (const entry of group) {
            entry.breachState = "error";
            entry.breachCount = null;
          }
        }
        completed += 1;
        onProgress?.({ completed, total: work.length, snapshot: this.snapshot() });
      }
    };

    await Promise.all(Array.from({ length: Math.min(3, work.length) }, () => worker()));
    return this.snapshot();
  }

  passwordManagerCsv(includeUnchanged: boolean): string {
    const selected = includeUnchanged ? this.entries : this.entries.filter((entry) => entry.replacement);
    if (selected.length === 0) throw new Error("No generated replacements are ready to export.");
    const rows = ["name,url,username,password,note"];
    for (const entry of selected) {
      rows.push(
        [
          entry.name,
          entry.guidance.websiteUrl ?? entry.url,
          entry.username,
          this.effectivePassword(entry),
          entry.note || "Reviewed with VaultMedic",
        ]
          .map(csvCell)
          .join(","),
      );
    }
    return `${rows.join("\r\n")}\r\n`;
  }

  securityReport(): string {
    const snapshot = this.snapshot();
    const report = {
      schema: "org.vaultmedic.security-report/v1",
      generatedAt: new Date().toISOString(),
      containsPasswords: false,
      source: snapshot.source
        ? { fileName: snapshot.source.fileName, rowCount: snapshot.source.rowCount }
        : null,
      stats: snapshot.stats,
      accounts: snapshot.accounts.map((account) => ({
        name: account.name,
        website: account.website,
        username: account.username,
        risk: account.risk,
        findings: account.findings.map(({ code, label, severity }) => ({ code, label, severity })),
        breachState: account.breachState,
        checklist: account.checklist,
        secured: account.secured,
      })),
    };
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  sourcePath(): string | null {
    return this.source?.filePath ?? null;
  }

  markSourceTrashed(): VaultSnapshot {
    if (this.source) {
      this.source.sourceInTrash = true;
      this.source.filePath = null;
    }
    return this.snapshot();
  }
}

export const DEMO_RECORDS: ImportedRecord[] = [
  {
    name: "Northstar Mail",
    url: "https://mail.example.com",
    username: "alex@example.com",
    password: "Sparrow!1998",
    note: "Demo account only",
  },
  {
    name: "Juniper Shop",
    url: "https://shop.example.net",
    username: "alex@example.com",
    password: "Sparrow!1998",
    note: "Demo account only",
  },
  {
    name: "GitHub",
    url: "https://github.com",
    username: "alexdev",
    password: "correct horse battery staple",
    note: "Demo account only",
  },
  {
    name: "Atlas Finance",
    url: "https://finance.example.org",
    username: "a.morgan",
    password: "tide",
    note: "Demo account only",
  },
  {
    name: "Google",
    url: "https://accounts.google.com",
    username: "alex@example.com",
    password: "vL7!fQ2#rT9@wZ4$kP8&",
    note: "Demo account only",
  },
];
