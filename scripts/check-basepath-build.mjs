// Sandbox-readiness build check (SLD_SANDBOX_READINESS_RULES.md rule 9): the app
// must build with base path /sandbox. The sandbox deployment sets BASE_PATH +
// NEXT_PUBLIC_BASE_PATH; this reproduces that build so a base-path-breaking
// change (hard-coded absolute path, cookie assumption, etc.) fails here.
import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  BASE_PATH: "/sandbox",
  NEXT_PUBLIC_BASE_PATH: "/sandbox",
};
console.log("Building with BASE_PATH=/sandbox …");
const r = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});
process.exit(r.status ?? 1);
