import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  net,
  session,
  shell,
  type IpcMainInvokeEvent,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from "electron";
import { basename, join } from "node:path";
import { chmod, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { ChecklistPatch, PasswordOptions } from "../shared/contracts";
import { parsePasswordCsv } from "./csv-import";
import { generatePassword } from "./generator";
import { PwnedPasswordsClient } from "./hibp";
import { analyzePassword } from "./password-analysis";
import { DEMO_RECORDS, VaultSession } from "./vault";

const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);
const DEFAULT_ZOOM_FACTOR = 1.08;

app.disableHardwareAcceleration();

const pwned = new PwnedPasswordsClient((url, init) => net.fetch(url, init));
const vault = new VaultSession(pwned);

function showStartupError(error: unknown): void {
  const detail = error instanceof Error && error.message
    ? error.message.replace(/\s+/g, " ").slice(0, 500)
    : "Unknown startup error.";
  dialog.showErrorBox(
    "VaultMedic could not start",
    `The application failed before its window opened.\n\n${detail}\n\nTry the unpacked Windows build or report this message.`,
  );
}

function trustedSender(event: IpcMainInvokeEvent): void {
  const senderUrl = event.senderFrame?.url ?? "";
  const trusted = isDevelopment
    ? senderUrl.startsWith("http://127.0.0.1:5173/")
    : senderUrl.startsWith("file://");
  if (!trusted) throw new Error("Blocked an untrusted app request.");
}

function registerHandler(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown,
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    trustedSender(event);
    return handler(event, ...args);
  });
}

function stringArgument(value: unknown, label: string, maxLength = 512): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
}

function passwordOptions(value: unknown): PasswordOptions {
  if (!value || typeof value !== "object") throw new Error("Invalid generator options.");
  const options = value as Partial<PasswordOptions>;
  return {
    length: Number(options.length),
    lowercase: options.lowercase === true,
    uppercase: options.uppercase === true,
    numbers: options.numbers === true,
    symbols: options.symbols === true,
    avoidAmbiguous: options.avoidAmbiguous === true,
  };
}

async function secureWrite(filePath: string, contents: string): Promise<void> {
  await writeFile(filePath, contents, { encoding: "utf8", mode: 0o600 });
  try {
    await chmod(filePath, 0o600);
  } catch {
    // Windows does not implement POSIX modes; the user's ACL still applies.
  }
}

async function createWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1160,
    minHeight: 760,
    show: false,
    backgroundColor: "#f4f4ef",
    title: "VaultMedic",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      devTools: isDevelopment,
    },
  });

  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
  window.webContents.on("render-process-gone", (_event, details) => {
    if (details.reason !== "clean-exit" && !window.isDestroyed()) {
      dialog.showErrorBox(
        "VaultMedic stopped",
        "The secure interface stopped unexpectedly. Close VaultMedic and try again.",
      );
    }
  });

  try {
    if (isDevelopment) {
      await window.loadURL(process.env.VITE_DEV_SERVER_URL!);
    } else {
      await window.loadFile(join(__dirname, "../dist/index.html"));
    }
    window.webContents.setZoomFactor(DEFAULT_ZOOM_FACTOR);
    window.show();
    return window;
  } catch (error) {
    if (!window.isDestroyed()) window.destroy();
    throw error;
  }
}

async function copyWithExpiry(secret: string): Promise<{ clearsInSeconds: number }> {
  await clipboard.writeText(secret);
  const fingerprint = createHash("sha256").update(secret).digest("hex");
  setTimeout(async () => {
    const current = await clipboard.readText();
    const currentFingerprint = createHash("sha256").update(current).digest("hex");
    if (currentFingerprint === fingerprint) clipboard.clear();
  }, 45_000);
  return { clearsInSeconds: 45 };
}

function installNetworkPolicy(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    const permitted =
      url.startsWith("file://") ||
      url.startsWith("data:") ||
      url.startsWith("blob:") ||
      url.startsWith("https://api.pwnedpasswords.com/range/") ||
      (isDevelopment &&
        (url.startsWith("http://127.0.0.1:5173/") || url.startsWith("ws://127.0.0.1:5173/")));
    callback({ cancel: !permitted });
  });
}

function registerIpc(): void {
  registerHandler("vault:get-snapshot", () => vault.snapshot());
  registerHandler("vault:clear", () => vault.clear());
  registerHandler("vault:load-demo", () =>
    vault.import(DEMO_RECORDS, { fileName: "Safe demo vault", filePath: null, isDemo: true }),
  );

  registerHandler("vault:import", async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const options: OpenDialogOptions = {
      title: "Open a browser password export",
      buttonLabel: "Open locally",
      properties: ["openFile", "dontAddToRecent"],
      filters: [{ name: "Password CSV", extensions: ["csv"] }],
    };
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return { cancelled: true };

    const filePath = result.filePaths[0];
    const fileStats = await stat(filePath);
    if (!fileStats.isFile() || fileStats.size > MAX_IMPORT_BYTES) {
      throw new Error("Choose a CSV file smaller than 25 MB.");
    }

    const buffer = await readFile(filePath);
    try {
      const records = parsePasswordCsv(buffer.toString("utf8"));
      return {
        cancelled: false,
        snapshot: vault.import(records, {
          fileName: basename(filePath),
          filePath,
          isDemo: false,
        }),
        warning: "The source CSV is plaintext. Move it to Trash when you no longer need it.",
      };
    } catch (error) {
      const safeMessages = [
        "No password records were found",
        "No password column was found",
        "not a text CSV",
        "supports up to",
        "unexpectedly large",
      ];
      const message = error instanceof Error ? error.message : "";
      if (safeMessages.some((prefix) => message.includes(prefix))) throw new Error(message);
      throw new Error("VaultMedic could not parse this CSV. Export it directly from Chrome or Firefox and try again.");
    } finally {
      buffer.fill(0);
    }
  });

  registerHandler("vault:trash-source", async () => {
    const filePath = vault.sourcePath();
    if (!filePath) throw new Error("There is no source file available to move to Trash.");
    await shell.trashItem(filePath);
    return vault.markSourceTrashed();
  });

  registerHandler("vault:reveal", (_event, accountId) =>
    vault.reveal(stringArgument(accountId, "account identifier", 24)),
  );
  registerHandler("vault:copy-password", (_event, accountId) => {
    const secret = vault.reveal(stringArgument(accountId, "account identifier", 24)).value;
    return copyWithExpiry(secret);
  });
  registerHandler("vault:copy-generated", (_event, password) =>
    copyWithExpiry(stringArgument(password, "generated password", 128)),
  );

  registerHandler("vault:generate", (_event, rawOptions) => {
    const value = generatePassword(passwordOptions(rawOptions));
    return { value, strengthScore: analyzePassword(value).score };
  });
  registerHandler("vault:generate-for-account", (_event, accountId, rawOptions) => {
    const id = stringArgument(accountId, "account identifier", 24);
    const value = generatePassword(passwordOptions(rawOptions));
    return {
      generated: { value, strengthScore: analyzePassword(value).score },
      snapshot: vault.stageReplacement(id, value),
    };
  });
  registerHandler("vault:set-replacement", (_event, accountId, replacement) =>
    vault.stageReplacement(
      stringArgument(accountId, "account identifier", 24),
      stringArgument(replacement, "replacement password", 128),
    ),
  );
  registerHandler("vault:discard-replacement", (_event, accountId) =>
    vault.discardReplacement(stringArgument(accountId, "account identifier", 24)),
  );
  registerHandler("vault:update-checklist", (_event, accountId, rawPatch) => {
    if (!rawPatch || typeof rawPatch !== "object") throw new Error("Invalid checklist update.");
    return vault.updateChecklist(
      stringArgument(accountId, "account identifier", 24),
      rawPatch as ChecklistPatch,
    );
  });

  registerHandler("vault:check-one", (_event, accountId) =>
    vault.checkOne(stringArgument(accountId, "account identifier", 24)),
  );
  registerHandler("vault:check-all", async (event) =>
    vault.checkAll((progress) => {
      if (!event.sender.isDestroyed()) event.sender.send("vault:breach-progress", progress);
    }),
  );

  registerHandler("vault:export-passwords", async (event, includeUnchanged) => {
    if (typeof includeUnchanged !== "boolean") throw new Error("Invalid export option.");
    const contents = vault.passwordManagerCsv(includeUnchanged);
    const parent = BrowserWindow.fromWebContents(event.sender);
    const options: SaveDialogOptions = {
      title: "Export password manager CSV",
      defaultPath: "VaultMedic Password Manager Import.csv",
      buttonLabel: "Export plaintext CSV",
      properties: ["showOverwriteConfirmation", "dontAddToRecent"],
      filters: [{ name: "Password manager CSV", extensions: ["csv"] }],
    };
    const result = parent
      ? await dialog.showSaveDialog(parent, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return { cancelled: true };
    await secureWrite(result.filePath, contents);
    return { cancelled: false, fileName: basename(result.filePath) };
  });

  registerHandler("vault:export-report", async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender);
    const options: SaveDialogOptions = {
      title: "Export password free security report",
      defaultPath: "VaultMedic Security Report.json",
      buttonLabel: "Export report",
      properties: ["showOverwriteConfirmation", "dontAddToRecent"],
      filters: [{ name: "JSON report", extensions: ["json"] }],
    };
    const result = parent
      ? await dialog.showSaveDialog(parent, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return { cancelled: true };
    await secureWrite(result.filePath, vault.securityReport());
    return { cancelled: false, fileName: basename(result.filePath) };
  });

  registerHandler("app:open-external", async (_event, rawUrl) => {
    const value = stringArgument(rawUrl, "external URL", 2_048);
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("VaultMedic only opens HTTPS links without embedded credentials.");
    }
    await shell.openExternal(url.toString());
  });
}

app.whenReady()
  .then(async () => {
    installNetworkPolicy();
    registerIpc();
    await createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createWindow().catch(showStartupError);
      }
    });
  })
  .catch((error) => {
    showStartupError(error);
    app.quit();
  });

app.on("window-all-closed", () => {
  vault.clear();
  if (process.platform !== "darwin") app.quit();
});
