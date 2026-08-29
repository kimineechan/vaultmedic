import { randomInt } from "node:crypto";
import type { PasswordOptions } from "../shared/contracts";

const SETS = {
  lowercase: "abcdefghijkmnopqrstuvwxyz",
  uppercase: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  numbers: "23456789",
  symbols: "!@#$%^&*()-_=+[]{}:,.?",
};

const AMBIGUOUS = new Set(["i", "l", "I", "L", "o", "O", "0", "1", "|", "`"]);

function sample(characters: string): string {
  return characters[randomInt(0, characters.length)] ?? "";
}

function shuffle(value: string[]): string[] {
  for (let index = value.length - 1; index > 0; index -= 1) {
    const replacement = randomInt(0, index + 1);
    [value[index], value[replacement]] = [value[replacement]!, value[index]!];
  }
  return value;
}

export function validatePasswordOptions(options: PasswordOptions): PasswordOptions {
  const length = Math.trunc(options.length);
  if (length < 12 || length > 128) {
    throw new Error("Password length must be between 12 and 128 characters.");
  }
  if (!options.lowercase && !options.uppercase && !options.numbers && !options.symbols) {
    throw new Error("Select at least one character set.");
  }
  return { ...options, length };
}

export function generatePassword(rawOptions: PasswordOptions): string {
  const options = validatePasswordOptions(rawOptions);
  const selected = (Object.keys(SETS) as Array<keyof typeof SETS>)
    .filter((key) => options[key])
    .map((key) => {
      const set = SETS[key];
      return options.avoidAmbiguous
        ? [...set].filter((character) => !AMBIGUOUS.has(character)).join("")
        : set;
    });

  const pool = selected.join("");
  const password = selected.map((set) => sample(set));
  while (password.length < options.length) password.push(sample(pool));
  return shuffle(password).join("");
}

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 24,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  avoidAmbiguous: true,
};
