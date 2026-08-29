import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import * as common from "@zxcvbn-ts/language-common";
import * as english from "@zxcvbn-ts/language-en";
import type { PasswordFinding } from "../shared/contracts";

const zxcvbn = new ZxcvbnFactory({
  translations: english.translations,
  graphs: common.adjacencyGraphs,
  dictionary: {
    ...common.dictionary,
    ...english.dictionary,
  },
});

export interface PasswordAnalysis {
  score: number;
  findings: PasswordFinding[];
}

const SEQUENCES = [
  "abcdefghijklmnopqrstuvwxyz",
  "0123456789",
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm",
];

function containsSequence(password: string): boolean {
  const lower = password.toLowerCase();
  const reverse = [...lower].reverse().join("");
  return SEQUENCES.some((sequence) => {
    for (let index = 0; index <= sequence.length - 4; index += 1) {
      const part = sequence.slice(index, index + 4);
      if (lower.includes(part) || reverse.includes(part)) return true;
    }
    return false;
  });
}

export function analyzePassword(
  password: string,
  context: { username?: string; hostname?: string } = {},
): PasswordAnalysis {
  const userInputs = [context.username, context.hostname]
    .filter((value): value is string => Boolean(value && value.length >= 3))
    .map((value) => value.toLowerCase());
  const result = zxcvbn.check(password, userInputs);
  const findings: PasswordFinding[] = [];

  if (result.score <= 1) {
    findings.push({
      code: "very-weak",
      label: "Very weak password",
      detail: "This password is likely to fall quickly to common guessing strategies.",
      severity: "critical",
    });
  } else if (result.score === 2) {
    findings.push({
      code: "weak",
      label: "Weak password",
      detail: "Use a longer, randomly generated password for this account.",
      severity: "high",
    });
  }

  if (password.length < 12) {
    findings.push({
      code: "short",
      label: "Too short",
      detail: "Fewer than 12 characters leaves little margin against offline guessing.",
      severity: password.length < 8 ? "critical" : "high",
    });
  } else if (password.length < 16 && result.score < 4) {
    findings.push({
      code: "short",
      label: "Could be longer",
      detail: "Aim for 16 or more random characters when the site permits it.",
      severity: "medium",
    });
  }

  const normalized = password.toLowerCase();
  if (userInputs.some((input) => input.length >= 3 && normalized.includes(input))) {
    findings.push({
      code: "personal",
      label: "Contains account details",
      detail: "The password appears to include the username or website name.",
      severity: "high",
    });
  }

  if (containsSequence(password)) {
    findings.push({
      code: "sequence",
      label: "Predictable sequence",
      detail: "Keyboard and alphabetical sequences are easy for guessing tools to test.",
      severity: "high",
    });
  }

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) =>
    pattern.test(password),
  ).length;
  if (password.length < 20 && classes < 3) {
    findings.push({
      code: "limited-charset",
      label: "Limited character variety",
      detail: "For shorter passwords, a broader random character set improves resistance.",
      severity: "medium",
    });
  }

  return { score: result.score, findings };
}
