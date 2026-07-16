// Verifies the new behavioral champion affixes end-to-end against a live server:
//   Vampiric — the pack heals itself for half of every blow it lands on you (unambiguous:
//              we wound it, then STOP attacking and watch its hp climb as it hits us).
//   Spiked   — attacking the pack throws ~15% of the blow back at you (differential: the
//              same attack routine costs more hp against a Spiked bag than a no-reflect one).
// Requires the dev server (NODE_ENV != production) so the smokespawnchamp hook is live.
import { Client } from "colyseus.js";
import { TOWN_BOUNDARY_Y } from "@hollowmark/common";

const ENDPOINT = "ws://localhost:2567";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const c = new Client(ENDPOINT);
  const r = await c.create("dungeon", { key: `champ${Date.now().toString(36)}`, cls: "barbarian", name: "Prober" });
  r.onMessage("*", () => {});
  let champId = "";
  r.onMessage("smokechamp", (m: any) => (champId = m.id));
  await sleep(700);
  const st: any = r.state;
  const me = () => st.players.get(r.sessionId);
  const mob = () => st.monsters.get(champId);

  let failures = 0;
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "✔" : "✗"} ${name}: ${detail}`);
    if (!ok) failures++;
  };

  // leave the sacred ground — monsters won't engage a player who is in town
  for (let i = 0; i < 40 && me() && me().y < TOWN_BOUNDARY_Y + 80; i++) {
    r.send("move", { x: me().x, y: me().y + 140 });
    await sleep(200);
  }
  const inField = me().y >= TOWN_BOUNDARY_Y;
  check("reached the field", inField, `y=${me().y.toFixed(0)} (town boundary ${TOWN_BOUNDARY_Y})`);
  if (!inField) { console.error("could not leave town — aborting"); process.exit(1); }

  const spawn = async (modifier: string, hp?: number) => {
    champId = "";
    r.send("smokespawnchamp", { modifier, hp });
    for (let i = 0; i < 20 && !mob(); i++) await sleep(80);
    return mob();
  };
  const clear = async () => { if (champId) { r.send("smokeclear", { id: champId }); await sleep(200); } };

  // --- Vampiric: self-heal on hit (the primary, unambiguous proof) ---
  {
    const m0 = await spawn("vampiric", 120);
    if (!m0) { console.error("vampiric champ never spawned"); process.exit(1); }
    // wound it to ~35% so there is clear headroom to heal into
    const target = mob().maxHp * 0.35;
    for (let i = 0; i < 60 && mob() && mob().hp > target; i++) {
      r.send("attack", { x: mob().x, y: mob().y });
      await sleep(140);
    }
    if (!mob()) { console.error("vampiric champ died before the heal window"); process.exit(1); }
    const wounded = mob().hp;
    // stop attacking; let it reach us and swing — each landed blow should knit it back up
    let peak = wounded;
    for (let i = 0; i < 40 && mob(); i++) {
      await sleep(200);
      if (mob()) peak = Math.max(peak, mob().hp);
    }
    check(
      "vampiric self-heals",
      peak > wounded + 1,
      `wounded to ${wounded.toFixed(0)}, climbed to ${peak.toFixed(0)} / ${m0.maxHp}`
    );
    await clear();
  }

  // --- Spiked: reflected damage (differential vs a no-reflect control) ---
  {
    // same fixed attack routine against each bag; sum the hp we lose. Reflect should make
    // the Spiked run cost strictly more than the "brutal" control (identical stats, no reflect).
    const routine = async (modifier: string): Promise<number> => {
      const m0 = await spawn(modifier, 100000); // effectively unkillable so the window is stable
      if (!m0) { console.error(`${modifier} bag never spawned`); process.exit(1); }
      // let it close so BOTH runs eat the same melee pressure, then attack a fixed number of times
      await sleep(1200);
      const before = me().hp;
      for (let i = 0; i < 20 && mob(); i++) {
        const m = mob();
        r.send("attack", { x: m.x, y: m.y });
        await sleep(160);
        if (me().hp <= 1) break;
      }
      const lost = before - me().hp;
      await clear(); // remove the bag on the SERVER so it stops hitting us between runs
      return lost;
    };
    // control first (id "strong" / label "Brutal" — no reflect), then spiked
    const controlLost = await routine("strong");
    // top the hero back off via a fresh room would be cleaner, but regen out of combat suffices
    await sleep(3000);
    const spikedLost = await routine("spiked");
    check(
      "spiked reflects extra damage",
      spikedLost > controlLost,
      `spiked cost ${spikedLost.toFixed(0)} hp vs control ${controlLost.toFixed(0)} hp over 20 swings`
    );
    check("no reflect loop/crash", !!me(), `server alive, hero hp ${me() ? me().hp.toFixed(0) : "?"}`);
  }

  console.log(failures === 0 ? "\nCHAMP AFFIX PROBE PASSED ✔" : `\nCHAMP AFFIX PROBE FAILED (${failures}) ✗`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
