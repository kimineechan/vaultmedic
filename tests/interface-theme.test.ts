import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("interface theme", () => {
  const appSource = readFileSync(new URL("../src/renderer/App.tsx", import.meta.url), "utf8");
  const mainSource = readFileSync(new URL("../src/main/index.ts", import.meta.url), "utf8");
  const rendererEntry = readFileSync(new URL("../src/renderer/main.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/renderer/styles.css", import.meta.url), "utf8");

  it("bundles and applies the pixel font locally", () => {
    expect(rendererEntry).toContain('@fontsource/pixelify-sans/latin-400.css');
    expect(rendererEntry).toContain('@fontsource/pixelify-sans/latin-700.css');
    expect(styles).toContain('font-family: "Pixelify Sans", monospace');
  });

  it("contains the light monochrome pixel theme overrides", () => {
    expect(styles).toContain("/* Light monochrome pixel theme */");
    expect(styles).toContain("color-scheme: light");
    expect(styles).toContain("background: #f4f4ef !important");
    expect(styles).toContain("background: #fff !important");
    expect(styles).toContain("color: #111");
    expect(styles).toContain("image-rendering: pixelated");
  });

  it("keeps dash punctuation out of authored interface copy", () => {
    expect(appSource).not.toMatch(/[‐‑‒–—―]/u);
    expect(appSource).not.toMatch(
      /Compromised-password|Prefix-only|k-anonymity|change-password|full-hash|password-manager|Highest-priority|phishing-resistant|session-only|Clipboard-monitoring|garbage-collected|password-health|Password-free|SHA-1|Add-Padding/,
    );
  });

  it("uses a readable default scale and removes tiny final font overrides", () => {
    expect(mainSource).toContain("const DEFAULT_ZOOM_FACTOR = 1.08");
    expect(mainSource).toContain("width: 1480");
    expect(mainSource).toContain("minWidth: 1160");
    expect(mainSource).toContain("setZoomFactor(DEFAULT_ZOOM_FACTOR)");

    const readableOverrides = styles.split("/* Readable desktop scale */")[1];
    expect(readableOverrides).toBeTruthy();
    expect(readableOverrides).not.toMatch(/font-size:\s*(?:8|9|10)px/);
    expect(readableOverrides).toContain(".page-heading-row p { font-size: 15px");
    expect(readableOverrides).toContain(".account-drawer { width: 560px; }");
  });
});
