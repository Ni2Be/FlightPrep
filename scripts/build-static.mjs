#!/usr/bin/env node
// Builds the static GitHub Pages export.
//
// Next.js hard-fails `output: "export"` builds if any dynamic Route Handler
// is present — and src/app/api is inherently dynamic (DFS login, live
// weather fetch at request time). Since this repo serves both a static
// export and an optional "hosted" build from the same source, this script
// temporarily moves src/app/api out of the way, runs the export build, and
// restores it afterward.
//
// Uses copy+delete rather than rename: on Windows, a concurrently running
// `next dev` (or any other process watching src/app) can hold a lock that
// makes rename() fail with EPERM even after the build itself has finished,
// whereas a plain copy only needs read access. The delete-the-original step
// is still best-effort/retried — if it ultimately fails, src/app/api has
// already been restored correctly and the leftover src/app/_api.bak is a
// harmless stray folder (it doesn't match Next's route conventions) you can
// delete once nothing else has it open.
import { cpSync, existsSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.join(__dirname, "..", "src", "app", "api");
const backupDir = path.join(__dirname, "..", "src", "app", "_api.bak");

async function removeWithRetry(dir, attempts = 5) {
  for (let i = 1; i <= attempts; i++) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return true;
    } catch (err) {
      if (i === attempts) {
        console.warn(`\nWARNING: couldn't remove ${dir} (${err.message}). It's harmless to leave — delete it manually once nothing has it open.`);
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * i));
    }
  }
}

const hadApiDir = existsSync(apiDir);
if (hadApiDir) {
  cpSync(apiDir, backupDir, { recursive: true });
  await removeWithRetry(apiDir);
}

try {
  execSync("next build", {
    stdio: "inherit",
    env: { ...process.env, GITHUB_PAGES: "true" },
  });
} finally {
  if (hadApiDir) {
    cpSync(backupDir, apiDir, { recursive: true });
    await removeWithRetry(backupDir);
  }
}
