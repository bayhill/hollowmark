// Verifies the four behavioral champion affixes end-to-end against a live dev server:
//   Vampiric — heals itself for half of every blow it lands (wound it, hold fire, watch it climb)
//   Spiked   — throws ~15% of every blow back (differential vs a no-reflect, non-lethal control)
//   Mortar   — lobs telegraphed AoE shells at your position (warn -> impact events + damage if still)
//   Warded   — raises a periodic damage-immunity bubble (wardup events; damage refused while up)
// Requires the dev server (NODE_ENV != production) so smokespawnchamp/smokeclear are live.
// NOTE: telegraph affixes only fire once the pack has AGGROED, and monsters never aggro a player
// standing in town — so we re-field before every test (a fragile probe hero can die and respawn
// in town mid-run). We also avoid lethal bags so the hero doesn't get bounced back to town.
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
  let wardups = 0;
  let mortarWarns = 0;
  let mortarHits = 0;
  r.onMessage("wardup", () => wardups++);
  r.onMessage("mortarwarn", () => mortarWarns++);
  r.onMessage("mortarhit", () => mortarHits++);
  await sleep(700);
  const st: any = r.state;
  const me = () => st.players.get(r.sessionId);
  const mob = () => st.monsters.get(champId);

  let failures = 0;
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "✔" : "✗"} ${name}: ${detail}`);
    if (!ok) failures++;
  };

  // walk south out of town (also recovers from a respawn that dropped us back in the plaza),
  // and top up a huge hp pool so sustained combat can't kill us back into a town respawn
  const toField = async () => {
    r.send("smokegod", {});
    await sleep(120);
    for (let i = 0; i < 50 && me() && me().y < TOWN_BOUNDARY_Y + 90; i++) {
      r.send("move", { x: me().x, y: me().y + 150 });
      await sleep(180);
    }
    r.send("smokegod", {}); // top up again after the walk
    await sleep(120);
    return me() && me().y >= TOWN_BOUNDARY_Y;
  };
  const spawn = async (modifier: string, hp?: number) => {
    champId = "";
    r.send("smokespawnchamp", { modifier, hp });
    for (let i = 0; i < 20 && !mob(); i++) await sleep(80);
    return mob();
  };
  const clear = async () => { if (champId) { r.send("smokeclear", { id: champId }); await sleep(200); } };

  check("reached the field", await toField(), `y=${me().y.toFixed(0)} (town boundary ${TOWN_BOUNDARY_Y})`);

  // --- Vampiric: self-heal on hit (unambiguous) ---
  {
    await toField();
    const m0 = await spawn("vampiric", 120);
    if (!m0) { console.error("vampiric champ never spawned"); process.exit(1); }
    const target = mob().maxHp * 0.35;
    for (let i = 0; i < 60 && mob() && mob().hp > target; i++) { r.send("attack", { x: mob().x, y: mob().y }); await sleep(140); }
    if (!mob()) { console.error("vampiric champ died before the heal window"); process.exit(1); }
    const wounded = mob().hp;
    let peak = wounded;
    for (let i = 0; i < 40 && mob(); i++) { await sleep(200); if (mob()) peak = Math.max(peak, mob().hp); }
    check("vampiric self-heals", peak > wounded + 1, `wounded to ${wounded.toFixed(0)}, climbed to ${peak.toFixed(0)} / ${m0.maxHp}`);
    await clear();
  }

  // --- Spiked: reflected damage (differential vs a NON-lethal, no-reflect control) ---
  {
    // "stone" (Stoneskin) is the control: dmgMult 1 like spiked, no reflect — so the melee each bag
    // deals is equal and cancels, and neither one-shots the hero. The delta is the reflect.
    const routine = async (modifier: string): Promise<number> => {
      await toField();
      const m0 = await spawn(modifier, 900); // tanky enough to survive 20 swings, not lethal to us
      if (!m0) { console.error(`${modifier} bag never spawned`); process.exit(1); }
      await sleep(1000);
      const before = me().hp;
      for (let i = 0; i < 20 && mob() && me().hp > 5; i++) { r.send("attack", { x: mob().x, y: mob().y }); await sleep(150); }
      const lost = before - me().hp;
      await clear();
      return lost;
    };
    const controlLost = await routine("stone");
    await sleep(2500); // regen a little between runs
    const spikedLost = await routine("spiked");
    check("spiked reflects extra damage", spikedLost > controlLost, `spiked cost ${spikedLost.toFixed(0)} hp vs control ${controlLost.toFixed(0)} hp over 20 swings`);
    check("no reflect loop/crash", !!me(), `server alive, hero hp ${me() ? me().hp.toFixed(0) : "?"}`);
  }

  // --- Warded: bubble refuses damage; vulnerable in the gaps (events fire on a timer once aggroed) ---
  {
    await toField();
    const m0 = await spawn("warded", 500);
    if (!m0) { console.error("warded champ never spawned"); process.exit(1); }
    // wait for the first bubble WITHOUT attacking much (attacking a live bag can get us killed)
    for (let i = 0; i < 45 && wardups === 0 && mob(); i++) await sleep(200);
    check("warded raised a bubble", wardups > 0, `${wardups} wardup events`);
    // damage-refusal: attack a burst right after a fresh ward; hp must stay flat
    let blockedWhileUp = false;
    let choppedInGap = false;
    const seenAt = wardups;
    if (mob() && wardups > 0) {
      const hpAtWard = mob().hp;
      for (let i = 0; i < 6 && mob(); i++) { r.send("attack", { x: mob().x, y: mob().y }); await sleep(110); }
      if (mob() && mob().hp >= hpAtWard - 0.5) blockedWhileUp = true;
    }
    // vulnerable gap: wait for the ward to lapse (no new ward for a beat), then a hit should chip
    for (let i = 0; i < 40 && mob() && !choppedInGap; i++) {
      const nowWards = wardups;
      const before = mob() ? mob().hp : 0;
      r.send("attack", { x: mob().x, y: mob().y });
      await sleep(160);
      if (nowWards === wardups && mob() && mob().hp < before - 0.5) choppedInGap = true;
    }
    check("warded refuses damage while up", blockedWhileUp, `hp held flat across a fresh ward (seen ${seenAt})`);
    check("warded is vulnerable in the gaps", choppedInGap, `took chip damage between wards`);
    await clear();
  }

  // --- Mortar: telegraph -> detonation -> damage if you hold still ---
  {
    await toField();
    mortarWarns = 0; mortarHits = 0;
    const hp0 = me().hp;
    const m0 = await spawn("mortar", 400);
    if (!m0) { console.error("mortar champ never spawned"); process.exit(1); }
    // stand still so shells lock onto us and land on our head
    for (let i = 0; i < 45 && mob() && mortarHits < 1; i++) await sleep(200);
    check("mortar telegraphs a shell", mortarWarns > 0, `${mortarWarns} warning rings`);
    check("mortar shell detonates", mortarHits > 0, `${mortarHits} impacts`);
    check("mortar hurts if you hold still", me().hp < hp0, `hero hp ${hp0.toFixed(0)} -> ${me().hp.toFixed(0)}`);
    await clear();
  }

  console.log(failures === 0 ? "\nCHAMP AFFIX PROBE PASSED ✔" : `\nCHAMP AFFIX PROBE FAILED (${failures}) ✗`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
