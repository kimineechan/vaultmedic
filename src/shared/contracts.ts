export type BreachState = "unknown" | "checking" | "safe" | "exposed" | "error";
export type RiskLevel = "critical" | "high" | "medium" | "healthy";

export interface RotationChecklist {
  passwordUpdated: boolean;
  mfaReviewed: boolean;
  passkeyReviewed: boolean;
  managerUpdated: boolean;
}

export interface PasswordFinding {
  code:
    | "compromised"
    | "reused"
    | "very-weak"
    | "weak"
    | "short"
    | "personal"
    | "sequence"
    | "limited-charset";
  label: string;
  detail: string;
  severity: "critical" | "high" | "medium";
}

export interface AccountSummary {
  id: string;
  name: string;
  website: string;
  hostname: string;
  username: string;
  risk: RiskLevel;
  strengthScore: number;
  findings: PasswordFinding[];
  reusedCount: number;
  breachState: BreachState;
  breachCount: number | null;
  hasReplacement: boolean;
  checklist: RotationChecklist;
  secured: boolean;
  completedSteps: number;
  changePasswordUrl: string | null;
  websiteUrl: string | null;
  mfaRecommendation: string;
  passkeyRecommendation: string;
  passkeyKnown: boolean;
}

export interface VaultStats {
  accounts: number;
  critical: number;
  weak: number;
  reused: number;
  exposed: number;
  secured: number;
  completionPercent: number;
}

export interface SourceInfo {
  fileName: string;
  importedAt: string;
  rowCount: number;
  isDemo: boolean;
  sourceInTrash: boolean;
}

export interface VaultSnapshot {
  accounts: AccountSummary[];
  stats: VaultStats;
  source: SourceInfo | null;
}

export interface ImportResult {
  cancelled: boolean;
  snapshot?: VaultSnapshot;
  warning?: string;
}

export interface PasswordOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
}

export interface GeneratedPassword {
  value: string;
  strengthScore: number;
}

export interface RevealedSecret {
  value: string;
  kind: "imported" | "replacement";
}

export interface FileActionResult {
  cancelled: boolean;
  fileName?: string;
  message?: string;
}

export interface BreachProgress {
  completed: number;
  total: number;
  snapshot: VaultSnapshot;
}

export type ChecklistPatch = Partial<RotationChecklist>;

export interface VaultMedicApi {
  importCsv(): Promise<ImportResult>;
  loadDemo(): Promise<VaultSnapshot>;
  getSnapshot(): Promise<VaultSnapshot>;
  clearVault(): Promise<VaultSnapshot>;
  trashSource(): Promise<VaultSnapshot>;
  revealPassword(accountId: string): Promise<RevealedSecret>;
  copyPassword(accountId: string): Promise<{ clearsInSeconds: number }>;
  copyGenerated(password: string): Promise<{ clearsInSeconds: number }>;
  generatePassword(options: PasswordOptions): Promise<GeneratedPassword>;
  generateForAccount(
    accountId: string,
    options: PasswordOptions,
  ): Promise<{ generated: GeneratedPassword; snapshot: VaultSnapshot }>;
  setReplacement(accountId: string, password: string): Promise<VaultSnapshot>;
  discardReplacement(accountId: string): Promise<VaultSnapshot>;
  updateChecklist(accountId: string, patch: ChecklistPatch): Promise<VaultSnapshot>;
  checkBreaches(): Promise<VaultSnapshot>;
  checkAccountBreach(accountId: string): Promise<VaultSnapshot>;
  exportPasswordManagerCsv(includeUnchanged: boolean): Promise<FileActionResult>;
  exportSecurityReport(): Promise<FileActionResult>;
  openExternal(url: string): Promise<void>;
  onBreachProgress(callback: (progress: BreachProgress) => void): () => void;
}
