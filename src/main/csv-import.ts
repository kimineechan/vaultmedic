import { parse } from "csv-parse/sync";

export interface ImportedRecord {
  name: string;
  url: string;
  username: string;
  password: string;
  note: string;
}

const MAX_ROWS = 20_000;
const MAX_SECRET_LENGTH = 16_384;

function canonicalHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function first(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "";
}

export function parsePasswordCsv(contents: string): ImportedRecord[] {
  if (contents.includes("\0")) throw new Error("The selected file is not a text CSV file.");

  const rows = parse(contents, {
    bom: true,
    columns: (headers: string[]) => headers.map(canonicalHeader),
    skip_empty_lines: true,
    relax_column_count: true,
    max_record_size: 1_048_576,
    to: MAX_ROWS + 1,
  }) as Array<Record<string, unknown>>;

  if (rows.length > MAX_ROWS) {
    throw new Error(`VaultMedic supports up to ${MAX_ROWS.toLocaleString()} accounts per import.`);
  }

  const records = rows
    .map((row) => ({
      name: first(row, ["name", "title", "label"]),
      url: first(row, ["url", "origin", "hostname", "website", "loginuri"]),
      username: first(row, ["username", "user", "login", "email"]),
      password: first(row, ["password", "pass", "loginpassword"]),
      note: first(row, ["note", "notes", "comment"]),
    }))
    .filter((record) => record.password.length > 0 || record.username.length > 0 || record.url.length > 0);

  if (records.length === 0) {
    throw new Error("No password records were found. Expected URL, username, and password columns.");
  }
  if (records.every((record) => record.password.length === 0)) {
    throw new Error("No password column was found. Export a password CSV directly from your browser.");
  }
  if (records.some((record) => record.password.length > MAX_SECRET_LENGTH)) {
    throw new Error("A password field is unexpectedly large; import stopped as a safety precaution.");
  }

  return records;
}
