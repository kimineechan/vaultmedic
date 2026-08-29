import { build } from "esbuild";
import { mkdir } from "node:fs/promises";

await mkdir("dist-electron", { recursive: true });

const shared = {
  bundle: true,
  platform: "node",
  target: "node22",
  sourcemap: false,
  minify: false,
  external: ["electron"],
  logLevel: "info",
};

await build({
  ...shared,
  entryPoints: ["src/main/index.ts"],
  outfile: "dist-electron/main.cjs",
  format: "cjs",
});

await build({
  ...shared,
  entryPoints: ["src/preload/index.ts"],
  outfile: "dist-electron/preload.cjs",
  format: "cjs",
});
