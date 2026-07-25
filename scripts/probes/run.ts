// The regression suite, on one command: `npm run probes`.
//
// Boots ONE throwaway server (its own port, its own temp data dir) and runs every
// probe against it, then the full smoke test. Nothing here touches data/profiles/,
// so a run can never disturb a real hero.
//
//   offline/  pure checks against @hollowmark/common — no server needed
//   live/     drive the real server through its dev hooks (see TEST_HOOKS in DungeonRoom)
//
// Exits non-zero if any gated probe fails, so CI and a human get the same answer.
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

// Always invoked as `npm run probes` from the repo root (import.meta.url is avoided
// so this runs identically whether tsx loads it as ESM or CJS).
const ROOT = process.cwd();
const HERE = path.join(ROOT, "scripts", "probes");
const PORT = Number(process.env.PROBE_PORT || 2568);
const ENDPOINT = `ws://localhost:${PORT}`;

interface Probe {
  name: string;
  file: string;
  /** Talks to the shared server this runner booted. */
  live: boolean;
  /** A report prints numbers for a human to weigh — it has no pass/fail, so it never gates. */
  report?: boolean;
  /** Boots and kills its OWN server (it tests the shutdown path) — hand it nothing. */
  ownServer?: boolean;
}

// Ordered cheapest-first: a broken data model should fail before we spend a minute
// on the live probes.
const PROBES: Probe[] = [
  { name: "lore-check", file: "offline/lore-check.ts", live: false },
  { name: "codex-probe", file: "offline/codex-probe.ts", live: false },
  { name: "gloves-probe", file: "offline/gloves-probe.ts", live: false },
  { name: "forest-check", file: "offline/forest-check.ts", live: false },
  { name: "pathfind-check", file: "offline/pathfind-check.ts", live: false },
  { name: "skill-balance", file: "offline/skill-balance.ts", live: false },
  { name: "balance-check", file: "offline/balance-check.ts", live: false, report: true },

  { name: "merc-probe", file: "live/merc-probe.ts", live: true },
  { name: "reforge-probe", file: "live/reforge-probe.ts", live: true },
  { name: "champ-affix-probe", file: "live/champ-affix-probe.ts", live: true },
  { name: "powers-probe", file: "live/powers-probe.ts", live: true },
  { name: "powers-probe2", file: "live/powers-probe2.ts", live: true },
  { name: "skills-probe", file: "live/skills-probe.ts", live: true },
  { name: "keystone-probe", file: "live/keystone-probe.ts", live: true },
  { name: "setpiece-probe", file: "live/setpiece-probe.ts", live: true },
  { name: "story-probe", file: "live/story-probe.ts", live: true },
  { name: "codex-rt-probe", file: "live/codex-rt-probe.ts", live: true },
  { name: "hc-probe", file: "live/hc-probe.ts", live: true },

  // owns its server: SIGTERMs it and reads what actually landed on disk
  { name: "durability-probe", file: "durability-probe.ts", live: false, ownServer: true },
];

const SMOKE: Probe = { name: "smoke", file: "../smoke.ts", live: true };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run one script under tsx, streaming its output, and resolve its exit code. */
function runScript(file: string, env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", path.join(HERE, file)], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

/** Wait for the server's /health probe to answer, or give up. */
async function waitForHealth(timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${PORT}/health`);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  return false;
}

async function main() {
  // A throwaway data dir: profiles AND accounts land here (persistence.ts derives the
  // accounts dir as the profiles dir's sibling), so real saves are never touched.
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "hollowmark-probes-"));
  const profilesDir = path.join(dataDir, "profiles");
  fs.mkdirSync(profilesDir, { recursive: true });

  let server: ChildProcess | null = null;
  const results: Array<{ name: string; code: number; report: boolean }> = [];

  const shutdown = () => {
    if (server && !server.killed) server.kill("SIGTERM");
    server = null;
  };
  process.on("SIGINT", () => {
    shutdown();
    process.exit(130);
  });

  try {
    console.log(`\n▶ booting probe server on :${PORT} (data: ${dataDir})\n`);
    server = spawn("npx", ["tsx", path.join(ROOT, "server", "src", "index.ts")], {
      // cwd MUST be server/ — tsx resolves tsconfig from cwd, and the Colyseus @type
      // decorators need that tsconfig's experimentalDecorators. Run from the repo root
      // instead and every schema class throws at import time.
      cwd: path.join(ROOT, "server"),
      env: {
        ...process.env,
        PORT: String(PORT),
        ARPG_DATA_DIR: profilesDir,
        // The live probes depend on the dev hooks, which TEST_HOOKS gates on BOTH of
        // these being absent. Clear them explicitly in case the shell exports them.
        NODE_ENV: "test",
        ARPG_PROD: "",
      },
      stdio: ["ignore", "inherit", "inherit"],
    });
    server.on("exit", (code) => {
      if (code !== 0 && code !== null) console.error(`\n✗ probe server exited early (code ${code})`);
    });

    if (!(await waitForHealth())) {
      console.error(`✗ probe server never answered /health on :${PORT}`);
      shutdown();
      process.exit(1);
    }
    console.log(`✔ probe server ready\n`);

    for (const probe of [...PROBES, SMOKE]) {
      const tag = probe.report ? "report" : probe.ownServer ? "own server" : probe.live ? "live" : "offline";
      console.log(`\n─── ${probe.name} (${tag}) ${"─".repeat(Math.max(0, 46 - probe.name.length))}`);
      // Live probes need the endpoint; smoke additionally seeds a veteran profile
      // straight onto disk, so it must write into the same dir the server reads.
      const code = await runScript(probe.file, probe.live ? { PROBE_ENDPOINT: ENDPOINT, ARPG_DATA_DIR: profilesDir } : {});
      results.push({ name: probe.name, code, report: !!probe.report });
    }
  } finally {
    shutdown();
    // give the server a moment to flush its writes before the dir goes away
    await sleep(500);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }

  console.log(`\n${"═".repeat(58)}\n  PROBE SUITE\n${"═".repeat(58)}`);
  let failed = 0;
  for (const r of results) {
    if (r.report) {
      console.log(`  ○ ${r.name.padEnd(20)} report (not gated)`);
      continue;
    }
    const ok = r.code === 0;
    if (!ok) failed++;
    console.log(`  ${ok ? "✔" : "✗"} ${r.name.padEnd(20)} ${ok ? "pass" : `FAIL (exit ${r.code})`}`);
  }
  const gated = results.filter((r) => !r.report).length;
  console.log(`${"═".repeat(58)}`);
  console.log(failed === 0 ? `  ALL ${gated} PROBES GREEN ✔\n` : `  ${failed}/${gated} PROBES FAILED ✗\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("probe runner crashed:", err);
  process.exit(1);
});
