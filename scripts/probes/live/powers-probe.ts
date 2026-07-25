// Verifies the two new Sorcerer legendary powers end-to-end against a live dev server:
//   Stormfork (chain_fork)  — Chain Lightning strikes MORE targets with the power than without.
//   Riftwalk  (teleport_rift) — Teleport tears a rift at BOTH ends (2 riftbloom events) that
//                               ticks damage into a nearby foe.
// Targets are champs spawned in town (they don't aggro on sacred ground, so they stand still and
// can't kill us — chain/rift damage doesn't care about aggro). Requires the dev server hooks.
import { Client } from "colyseus.js";

const ENDPOINT = process.env.PROBE_ENDPOINT || "ws://localhost:2567";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const c = new Client(ENDPOINT);
  const r = await c.create("dungeon", { key: `pow${Date.now().toString(36)}`, cls: "sorcerer", name: "Zappy" });
  r.onMessage("*", () => {});
  let lastLoadout: any = null, lastChain: any = null, riftblooms = 0, champId = "";
  r.onMessage("loadout", (m: any) => (lastLoadout = m));
  r.onMessage("chainfx", (m: any) => (lastChain = m));
  r.onMessage("riftbloom", () => riftblooms++);
  r.onMessage("smokechamp", (m: any) => (champId = m.id));
  await sleep(700);
  const st: any = r.state;
  const me = () => st.players.get(r.sessionId);
  const mob = (id: string) => st.monsters.get(id);
  r.send("smokegod", {});
  await sleep(150);

  let failures = 0;
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "✔" : "✗"} ${name}: ${detail}`);
    if (!ok) failures++;
  };

  const spawnCluster = async (n: number, hp: number) => {
    const ids: string[] = [];
    for (let i = 0; i < n; i++) { champId = ""; r.send("smokespawnchamp", { modifier: "stone", hp }); for (let k = 0; k < 15 && !champId; k++) await sleep(60); if (champId) ids.push(champId); }
    await sleep(300);
    return ids;
  };
  const clearAll = async (ids: string[]) => { for (const id of ids) r.send("smokeclear", { id }); await sleep(200); };
  const targetsHit = () => (lastChain?.points?.length ?? 1) - 1; // points = [caster, ...targets]

  // --- Stormfork: chain hits more foes WITH the power than without ---
  {
    r.send("allocskill", { id: "chain" });
    await sleep(300);
    if (lastLoadout?.binds?.["1"] !== "chain") { console.error("chain not learned/bound"); process.exit(1); }
    const cluster = await spawnCluster(9, 4000); // 9 tanky targets, more than the base 4-jump chain
    const near = me();
    // cast WITHOUT the power first
    lastChain = null;
    r.send("skill", { key: "1", x: near.x + 10, y: near.y + 10 });
    await sleep(500);
    const baseHits = targetsHit();
    // grant the power, wait out the cooldown, cast again at the same cluster
    r.send("smokepower", { id: "chain_fork" });
    await sleep(2600);
    lastChain = null;
    r.send("skill", { key: "1", x: near.x + 10, y: near.y + 10 });
    await sleep(500);
    const forkHits = targetsHit();
    check("stormfork strikes more foes", forkHits > baseHits, `base chain hit ${baseHits}, forked chain hit ${forkHits}`);
    check("stormfork exceeds the base jump cap", forkHits > 4, `forked chain hit ${forkHits} (base cap is 4)`);
    await clearAll(cluster);
  }

  // --- Riftwalk: teleport leaves a rift at both ends that damages a nearby foe ---
  {
    r.send("respec", {});
    await sleep(400);
    r.send("allocskill", { id: "teleport" });
    await sleep(300);
    if (lastLoadout?.binds?.["1"] !== "teleport") { console.error("teleport not learned/bound"); process.exit(1); }
    r.send("smokepower", { id: "teleport_rift" });
    await sleep(150);
    const ids = await spawnCluster(1, 6000);
    const target = ids[0];
    if (!mob(target)) { console.error("no rift target spawned"); process.exit(1); }
    const hp0 = mob(target).hp;
    riftblooms = 0;
    const here = me();
    // teleport a short hop so the DEPARTURE rift lands right on the champ clustered at our feet
    r.send("skill", { key: "1", x: here.x + 60, y: here.y });
    await sleep(300);
    check("riftwalk tears a rift at both ends", riftblooms === 2, `${riftblooms} riftbloom(s) (expect 2: from + to)`);
    // let the departure rift sear the champ we left behind
    await sleep(2600);
    check("the rift sears a foe left in it", mob(target) && mob(target).hp < hp0, mob(target) ? `champ hp ${hp0.toFixed(0)} → ${mob(target).hp.toFixed(0)}` : "champ gone");
    await clearAll(ids);
  }

  console.log(failures === 0 ? "\nPOWERS PROBE PASSED ✔" : `\nPOWERS PROBE FAILED (${failures}) ✗`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
