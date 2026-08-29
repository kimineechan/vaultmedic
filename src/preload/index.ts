import { contextBridge, ipcRenderer } from "electron";
import type {
  BreachProgress,
  ChecklistPatch,
  PasswordOptions,
  VaultMedicApi,
} from "../shared/contracts";

const api: VaultMedicApi = {
  importCsv: () => ipcRenderer.invoke("vault:import"),
  loadDemo: () => ipcRenderer.invoke("vault:load-demo"),
  getSnapshot: () => ipcRenderer.invoke("vault:get-snapshot"),
  clearVault: () => ipcRenderer.invoke("vault:clear"),
  trashSource: () => ipcRenderer.invoke("vault:trash-source"),
  revealPassword: (accountId: string) => ipcRenderer.invoke("vault:reveal", accountId),
  copyPassword: (accountId: string) => ipcRenderer.invoke("vault:copy-password", accountId),
  copyGenerated: (password: string) => ipcRenderer.invoke("vault:copy-generated", password),
  generatePassword: (options: PasswordOptions) => ipcRenderer.invoke("vault:generate", options),
  generateForAccount: (accountId: string, options: PasswordOptions) =>
    ipcRenderer.invoke("vault:generate-for-account", accountId, options),
  setReplacement: (accountId: string, password: string) =>
    ipcRenderer.invoke("vault:set-replacement", accountId, password),
  discardReplacement: (accountId: string) =>
    ipcRenderer.invoke("vault:discard-replacement", accountId),
  updateChecklist: (accountId: string, patch: ChecklistPatch) =>
    ipcRenderer.invoke("vault:update-checklist", accountId, patch),
  checkBreaches: () => ipcRenderer.invoke("vault:check-all"),
  checkAccountBreach: (accountId: string) => ipcRenderer.invoke("vault:check-one", accountId),
  exportPasswordManagerCsv: (includeUnchanged: boolean) =>
    ipcRenderer.invoke("vault:export-passwords", includeUnchanged),
  exportSecurityReport: () => ipcRenderer.invoke("vault:export-report"),
  openExternal: (url: string) => ipcRenderer.invoke("app:open-external", url),
  onBreachProgress: (callback: (progress: BreachProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: BreachProgress) => callback(progress);
    ipcRenderer.on("vault:breach-progress", listener);
    return () => ipcRenderer.removeListener("vault:breach-progress", listener);
  },
};

contextBridge.exposeInMainWorld("vaultMedic", Object.freeze(api));
