import { cpSync, mkdirSync, writeFileSync } from "node:fs";

console.log("[prepare-standalone] copying .next/static");
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true, force: true });

console.log("[prepare-standalone] copying public");
cpSync("public", ".next/standalone/public", { recursive: true, force: true });

console.log("[prepare-standalone] writing electron/build-meta.json");
mkdirSync("electron", { recursive: true });
writeFileSync(
  "electron/build-meta.json",
  JSON.stringify({ repoRoot: process.cwd() }, null, 2) + "\n",
);

console.log("[prepare-standalone] done");
