import type { VaultMedicApi } from "../shared/contracts";

declare global {
  interface Window {
    vaultMedic: VaultMedicApi;
  }
}

export {};
