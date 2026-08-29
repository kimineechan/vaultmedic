import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { siteGuidance } from "../src/main/links";

describe("desktop security guardrails", () => {
  const mainSource = readFileSync(new URL("../src/main/index.ts", import.meta.url), "utf8");
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

  it("isolates and sandboxes the renderer", () => {
    expect(mainSource).toContain("contextIsolation: true");
    expect(mainSource).toContain("nodeIntegration: false");
    expect(mainSource).toContain("sandbox: true");
    expect(mainSource).toContain("webSecurity: true");
  });

  it("denies renderer permissions, navigation, and popup windows", () => {
    expect(mainSource).toContain("setPermissionRequestHandler");
    expect(mainSource).toContain("callback(false)");
    expect(mainSource).toContain('setWindowOpenHandler(() => ({ action: "deny" }))');
    expect(mainSource).toContain('on("will-navigate"');
  });

  it("ships a restrictive renderer content security policy", () => {
    expect(html).toContain("connect-src 'none'");
    expect(html).toContain("object-src 'none'");
    expect(html).toContain("form-action 'none'");
    expect(html).not.toContain("http://");
    expect(html).not.toContain("https://");
  });

  it("uses the standard well-known change-password URL", () => {
    const guidance = siteGuidance("http://accounts.example.com/login");
    expect(guidance.changePasswordUrl).toBe("https://accounts.example.com/.well-known/change-password");
  });

  it("never opens a URL containing embedded credentials", () => {
    expect(mainSource).toContain("url.username || url.password");
    expect(mainSource).toContain('url.protocol !== "https:"');
  });

  it("surfaces startup failures instead of leaving a hidden process", () => {
    expect(mainSource).toContain("app.disableHardwareAcceleration()");
    expect(mainSource).toContain("await window.loadFile");
    expect(mainSource).toContain("window.show()");
    expect(mainSource).toContain("showStartupError");
    expect(mainSource).toContain("dialog.showErrorBox");
    expect(mainSource).not.toContain('once("ready-to-show"');
  });
});
