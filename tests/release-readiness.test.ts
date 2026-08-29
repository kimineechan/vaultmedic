import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("release readiness", () => {
  const packageSource = readFileSync(new URL("../package.json", import.meta.url), "utf8");
  const releaseWorkflow = readFileSync(
    new URL("../.github/workflows/release.yml", import.meta.url),
    "utf8",
  );
  const ignoreRules = readFileSync(new URL("../.gitignore", import.meta.url), "utf8");

  it("includes the public project policies and MIT license", () => {
    for (const name of [
      "LICENSE",
      "README.md",
      "SECURITY.md",
      "PRIVACY.md",
      "THREAT_MODEL.md",
      "CONTRIBUTING.md",
      "CODE_OF_CONDUCT.md",
    ]) {
      expect(existsSync(new URL(`../${name}`, import.meta.url))).toBe(true);
    }
    expect(readFileSync(new URL("../LICENSE", import.meta.url), "utf8")).toContain(
      "MIT License",
    );
  });

  it("configures installer and portable Windows builds", () => {
    expect(packageSource).toContain('"package:win"');
    expect(packageSource).toContain('"package:win:unpacked"');
    expect(packageSource).toContain('"target": "nsis"');
    expect(packageSource).toContain('"target": "portable"');
    expect(packageSource).toContain('"icon": "build/icon.ico"');
    expect(existsSync(new URL("../build/icon.ico", import.meta.url))).toBe(true);
  });

  it("builds releases on Windows and excludes credential shaped files", () => {
    expect(releaseWorkflow).toContain("runs-on: windows-latest");
    expect(releaseWorkflow).toContain("npm test");
    expect(releaseWorkflow).toContain("npm run package:win");
    expect(releaseWorkflow).toContain("VaultMedic-Windows-Unpacked");
    expect(releaseWorkflow).toContain('release/*.zip');
    expect(releaseWorkflow).toContain("SHA256SUMS.txt");
    expect(ignoreRules).toContain("*.csv");
    expect(ignoreRules).toContain("*.pfx");
    expect(ignoreRules).toContain(".env");
  });
});
