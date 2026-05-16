/**
 * Cross-OS local dev bootstrap for the Prescription Management API.
 *
 * Replaces the manual 7-step sequence (install → generate → migrate →
 * build → seed → start) with a single command:
 *
 *     node scripts/dev-up.mjs          # or `pnpm dev:up`
 *
 * Flags:
 *   --skip-seed     Skip `prisma db seed`
 *   --skip-build    Skip `pnpm run build` (and therefore seed, since
 *                   the seed runs against dist/prisma/seed.js)
 *   --dev           Use `prisma migrate dev` instead of `migrate deploy`
 *   --no-server     Stop after seed (don't `pnpm run start:dev`)
 *
 * Works on Windows, macOS, Linux. No extra dependencies.
 */
import { spawnSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = resolve(SCRIPT_DIR, "..");
const COMPOSE_FILE = resolve(BACKEND_DIR, "..", "docker-compose.yml");

const args = new Set(process.argv.slice(2));
const flags = {
  skipSeed: args.has("--skip-seed"),
  skipBuild: args.has("--skip-build"),
  dev: args.has("--dev"),
  noServer: args.has("--no-server"),
};

const useColor = process.stdout.isTTY;
const c = {
  blue: (s) => (useColor ? `\x1b[34m${s}\x1b[0m` : s),
  green: (s) => (useColor ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s) => (useColor ? `\x1b[33m${s}\x1b[0m` : s),
  red: (s) => (useColor ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s) => (useColor ? `\x1b[2m${s}\x1b[0m` : s),
};

function step(n, label) {
  console.log(`\n${c.blue(`[${n}/7]`)} ${label}`);
}
function warn(msg) {
  console.log(c.yellow(`  ⚠ ${msg}`));
}
function ok(msg) {
  console.log(c.green(`  ✓ ${msg}`));
}
function fail(msg) {
  console.error(c.red(`  ✗ ${msg}`));
  process.exit(1);
}

function run(cmd, argv, { cwd = BACKEND_DIR, env = process.env } = {}) {
  const r = spawnSync(cmd, argv, {
    cwd,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    fail(`${cmd} ${argv.join(" ")} failed (exit ${r.status})`);
  }
}

function which(cmd) {
  const probe = process.platform === "win32" ? "where" : "which";
  const r = spawnSync(probe, [cmd], { encoding: "utf8" });
  return r.status === 0 && r.stdout.trim().length > 0;
}

// --- 1. Preflight ----------------------------------------------------
step(1, "Preflight");
const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 20) fail(`Node ${process.versions.node} < 20. Upgrade Node.`);
ok(`Node ${process.versions.node}`);
if (!which("pnpm")) fail("pnpm not on PATH. Install: https://pnpm.io/installation");
ok("pnpm on PATH");
if (!which("docker")) fail("docker not on PATH. Install Docker Desktop / Engine.");
ok("docker on PATH");

// --- 2. .env ---------------------------------------------------------
step(2, "Ensure .env");
const envPath = resolve(BACKEND_DIR, ".env");
const envExamplePath = resolve(BACKEND_DIR, ".env.example");
if (!existsSync(envPath)) {
  copyFileSync(envExamplePath, envPath);
  warn(".env created from .env.example — replace JWT_*_SECRET before deploying");
} else {
  ok(".env present");
}

// --- 3. Postgres -----------------------------------------------------
step(3, "Postgres (docker compose)");
if (!existsSync(COMPOSE_FILE)) {
  fail(`docker-compose.yml not found at ${COMPOSE_FILE}`);
}
run("docker", ["compose", "-f", COMPOSE_FILE, "up", "-d", "postgres"]);
process.stdout.write("  waiting for pg_isready");
const deadline = Date.now() + 60_000;
let ready = false;
while (Date.now() < deadline) {
  const probe = spawnSync(
    "docker",
    ["exec", "prescriptions-db", "pg_isready", "-U", "user"],
    { stdio: "ignore" },
  );
  if (probe.status === 0) {
    ready = true;
    break;
  }
  process.stdout.write(".");
  spawnSync(
    process.platform === "win32" ? "timeout" : "sleep",
    process.platform === "win32" ? ["/t", "1"] : ["1"],
    { stdio: "ignore" },
  );
}
process.stdout.write("\n");
if (!ready) fail("Postgres did not become ready in 60s");
ok("Postgres ready on localhost:5433");

// --- 4. Deps ---------------------------------------------------------
step(4, "pnpm install");
const lockPath = resolve(BACKEND_DIR, "pnpm-lock.yaml");
const modulesMarker = resolve(BACKEND_DIR, "node_modules", ".modules.yaml");
let installNeeded = !existsSync(modulesMarker);
if (!installNeeded && existsSync(lockPath)) {
  installNeeded = statSync(lockPath).mtimeMs > statSync(modulesMarker).mtimeMs;
}
if (installNeeded) {
  run("pnpm", ["install", "--frozen-lockfile"]);
  ok("dependencies installed");
} else {
  ok("dependencies up to date (skipped)");
}

// --- 5. Prisma -------------------------------------------------------
step(5, "Prisma generate + migrate");
run("pnpm", ["exec", "prisma", "generate"]);
run("pnpm", ["exec", "prisma", "migrate", flags.dev ? "dev" : "deploy"]);
ok("schema in sync");

// --- 6. Build + seed -------------------------------------------------
if (!flags.skipBuild) {
  step(6, "Build (required so seed can run dist/prisma/seed.js)");
  run("pnpm", ["run", "build"]);
  ok("build complete");
} else {
  step(6, "Build (skipped via --skip-build)");
}
if (!flags.skipSeed && !flags.skipBuild) {
  console.log(c.dim("  seeding…"));
  run("pnpm", ["exec", "prisma", "db", "seed"]);
  ok("seed complete");
} else if (flags.skipSeed) {
  warn("seed skipped via --skip-seed");
} else {
  warn("seed skipped (depends on build)");
}

// --- 7. Server -------------------------------------------------------
if (flags.noServer) {
  step(7, "Skip server (--no-server)");
  console.log(c.green("\n✅ Backend ready. Start with: pnpm run start:dev\n"));
  process.exit(0);
}
step(7, "Start Nest dev server (Ctrl-C to stop)");
const child = spawn("pnpm", ["run", "start:dev"], {
  cwd: BACKEND_DIR,
  stdio: "inherit",
  shell: process.platform === "win32",
});
const forward = (sig) => {
  if (!child.killed) child.kill(sig);
};
process.on("SIGINT", () => forward("SIGINT"));
process.on("SIGTERM", () => forward("SIGTERM"));
child.on("exit", (code) => process.exit(code ?? 0));
