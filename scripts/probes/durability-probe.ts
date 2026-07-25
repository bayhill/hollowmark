// DURABILITY: does a hero's progress survive the server being shut down?
//
// This is the probe that guards the write-behind queue in persistence.ts. Saves are no
// longer written synchronously — they are queued and flushed asynchronously — which is
// only safe because gameServer.onShutdown() drains the queue before the process exits.
// Fly auto-stops machines, so that drain is the difference between "the lights went out"
// and "everyone lost their last few minutes".
//
// Unlike the other live probes this one owns its server: it has to start it, kill it with
// a real SIGTERM, and read what actually landed on disk.
//
//   npx tsx scripts/probes/durability-probe.ts
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { Client } from "colyseus.js";

const ROOT = process.cwd();
const PORT = Number(process.env.DURABILITY_PORT || 2571);
const ENDPOINT = `ws://localhost:${PORT}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let fails = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "✔" : "✗"} ${name}: ${detail}`);
  if (!ok) fails++;
};

const profilesDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "hollowmark-durability-")), "profiles");
fs.mkdirSync(profilesDir, { recursive: true });

// A 30s flush debounce means NOTHING reaches the disk on the normal timer during this
// probe. Every assertion below therefore tests the shutdown flush specifically — with
// the stock 100ms timer the writes would land on their own and the probe would pass
// even if gameServer.onShutdown() were deleted.
const HELD_QUEUE_MS = 30_000;

function startServer(): ChildProcess {
  return spawn("npx", ["tsx", path.join(ROOT, "server", "src", "index.ts")], {
    cwd: path.join(ROOT, "server"), // tsx needs server/tsconfig.json for experimentalDecorators
    env: {
      ...process.env,
      PORT: String(PORT),
      ARPG_DATA_DIR: profilesDir,
      ARPG_FLUSH_DEBOUNCE_MS: String(HELD_QUEUE_MS),
      NODE_ENV: "test",
      ARPG_PROD: "",
    },
    stdio: ["ignore", "ignore", "inherit"],
  });
}

async function waitForHealth(timeoutMs = 30_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`http://localhost:${PORT}/health`)).ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  return false;
}

/** SIGTERM, then wait for the process to actually exit (that's when the flush is done). */
function stopServer(proc: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (proc.exitCode !== null) return resolve();
    const kill = setTimeout(() => proc.kill("SIGKILL"), 15_000); // never hang the suite
    proc.on("exit", () => {
      clearTimeout(kill);
      resolve();
    });
    proc.kill("SIGTERM");
  });
}

async function main() {
  const key = `durab${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const profileFile = path.join(profilesDir, `${key}.json`);

  // ── round one: earn something worth keeping, then pull the plug ──
  let server = startServer();
  if (!(await waitForHealth())) {
    console.error("server never came up");
    process.exit(1);
  }

  const c1 = new Client(ENDPOINT);
  const r1 = await c1.create("dungeon", { key, cls: "barbarian", name: "Ledger" });
  r1.onMessage("*", () => {});
  await sleep(700);

  const st1 = () => r1.state as any;
  const me1 = () => st1().players.get(r1.sessionId);

  // spend stat points — a deliberate, player-made change that must not evaporate
  for (let i = 0; i < 5; i++) r1.send("allocstat", { attr: "vit" });
  await sleep(400);
  const vit = me1().vit;
  const gold = me1().gold;
  const level = me1().level;
  check("hero made progress worth saving", vit > 0, `VIT ${vit}, ${gold}g, level ${level}`);

  // Nothing can have reached the disk yet: the flush timer is held at 30s and the
  // 10s checkpoint has not come round either. Prove it, so the assertions after the
  // SIGTERM are unambiguously about the shutdown flush and nothing else.
  check(
    "nothing on disk before shutdown (the queue really is held)",
    !fs.existsSync(profileFile),
    fs.existsSync(profileFile) ? "a write escaped early — this probe is not testing the flush" : "queue held"
  );

  // Kill it. The only thing that can save this hero now is the shutdown flush.
  await stopServer(server);

  const onDisk = fs.existsSync(profileFile);
  check("profile reached the disk after SIGTERM", onDisk, onDisk ? profileFile : "NO FILE — the flush was lost");
  if (!onDisk) {
    console.log(`\n❌ durability FAILED — the shutdown flush did not run`);
    process.exit(1);
  }

  const saved = JSON.parse(fs.readFileSync(profileFile, "utf8"));
  check("saved VIT survived", saved.attrs?.vit === vit, `disk ${saved.attrs?.vit} vs live ${vit}`);
  check("saved name survived", saved.name === "Ledger", String(saved.name));
  check("saved class survived", saved.cls === "barbarian", String(saved.cls));

  // ── round two: a fresh process must hand the hero back ──
  server = startServer();
  if (!(await waitForHealth())) {
    console.error("server never came back up");
    process.exit(1);
  }

  const c2 = new Client(ENDPOINT);
  const r2 = await c2.create("dungeon", { key, cls: "barbarian", name: "Ledger" });
  r2.onMessage("*", () => {});
  await sleep(700);
  const me2 = () => (r2.state as any).players.get(r2.sessionId);
  check("hero restored into a new process", me2()?.vit === vit, `VIT ${me2()?.vit} (expected ${vit})`);
  check("hero kept their name", me2()?.name === "Ledger", String(me2()?.name));

  // the Hall of Legends is served from the in-memory cache — a restart must reseed it
  const legends: any[] = await (await fetch(`http://localhost:${PORT}/legends`)).json();
  check(
    "ladder cache reseeded from disk at boot",
    legends.some((l) => l.name === "Ledger"),
    legends.length ? legends.map((l) => l.name).join(", ") : "empty ladder"
  );

  await stopServer(server);
  fs.rmSync(path.dirname(profilesDir), { recursive: true, force: true });

  console.log(`\n${fails === 0 ? "✅ ALL GREEN" : `❌ ${fails} FAILURE(S)`} — durability across shutdown`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("durability probe crashed:", err);
  process.exit(1);
});
