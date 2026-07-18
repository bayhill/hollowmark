// Verifies the TWELVE new third-tree actives (2 per class) end-to-end against a live dev server,
// one hero per class. Targets are stone champs spawned in town (no aggro on sacred ground →
// stationary, safe, high-hp so they survive being observed). Observable signals per skill:
// synced monster hp (damage + damage-over-time), synced projectile/pet counts, and FX broadcasts
// (poolfx / piercefx / rendfx / classfx). Requires dev hooks (smokegod / smokelevel /
// smokespawnchamp / smokeclear).
//   PROBE_ENDPOINT=ws://localhost:2568 npx tsx scratchpad/skills-probe.ts
import { Client } from "colyseus.js";

const ENDPOINT = process.env.PROBE_ENDPOINT || "ws://localhost:2567";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "✔" : "✗"} ${name}: ${detail}`);
  if (!ok) failures++;
};

async function withHero(cls: string, fn: (h: any) => Promise<void>) {
  const c = new Client(ENDPOINT);
  const r = await c.create("dungeon", { key: `sk${cls}${Date.now().toString(36)}`, cls, name: `S${cls}` });
  const ev: Record<string, number> = {};
  const classfx: Record<string, number> = {};
  r.onMessage("*", () => {});
  for (const t of ["poolfx", "piercefx", "rendfx", "swing"]) r.onMessage(t, () => (ev[t] = (ev[t] ?? 0) + 1));
  r.onMessage("classfx", (m: any) => (classfx[m?.kind ?? "?"] = (classfx[m?.kind ?? "?"] ?? 0) + 1));
  let loadout: any = null;
  let champId = "";
  r.onMessage("loadout", (m: any) => (loadout = m));
  r.onMessage("smokechamp", (m: any) => (champId = m.id));
  await sleep(600);
  const st: any = r.state;
  const me = () => st.players.get(r.sessionId);
  const mob = (id: string) => st.monsters.get(id);
  r.send("smokegod", {});
  r.send("smokelevel", { level: 24, points: 40 });
  await sleep(300);
  const learn = async (id: string) => { r.send("allocskill", { id }); await sleep(160); };
  const bindOf = (id: string) => Object.entries(loadout?.binds ?? {}).find(([, v]) => v === id)?.[0];
  const cast = async (id: string, x: number, y: number) => {
    r.send("smokegod", {}); // top up mana so no cast is refused for want of it
    await sleep(40);
    const k = bindOf(id);
    if (!k) throw new Error(`${id} not bound (binds=${JSON.stringify(loadout?.binds)})`);
    r.send("skill", { key: k, x, y });
    await sleep(240);
  };
  const champ = async (hp: number) => {
    champId = "";
    r.send("smokespawnchamp", { modifier: "stone", hp });
    for (let k = 0; k < 25 && !champId; k++) await sleep(60);
    await sleep(150);
    return champId;
  };
  const clear = async (ids: string[]) => { for (const id of ids) r.send("smokeclear", { id }); await sleep(150); };
  await fn({ r, st, me, mob, ev, classfx, learn, cast, champ, clear });
  await r.leave();
  await sleep(150);
}

async function main() {
  // --- Barbarian · Carnage: Cleave (front-arc AoE) + Rend (strike + lingering bleed) ---
  await withHero("barbarian", async (h) => {
    await h.learn("cleave"); await h.learn("rend");
    const id = await h.champ(9000);
    let m = h.mob(id);
    const hp0 = m.hp;
    await h.cast("cleave", m.x, m.y);
    await sleep(150);
    check("Cleave damages the front rank", !!h.mob(id) && h.mob(id).hp < hp0, `hp ${hp0} → ${h.mob(id)?.hp}`);
    const hp1 = h.mob(id).hp;
    h.ev.rendfx = 0;
    await h.cast("rend", h.mob(id).x, h.mob(id).y);
    await sleep(220);
    const hp2 = h.mob(id).hp; // after the direct strike
    check("Rend strikes and marks (rendfx)", (h.ev.rendfx ?? 0) >= 1 && hp2 < hp1, `rendfx ${h.ev.rendfx ?? 0}, hp ${hp1}→${hp2}`);
    await sleep(1700); // let the bleed tick with NO further casts
    const hp3 = h.mob(id).hp;
    check("Rend bleed keeps ticking after the hit", hp3 < hp2, `hp ${hp2} → ${hp3} over the bleed`);
    await h.clear([id]);
  });

  // --- Rogue · Venom: Caltrops (slowing trap field) + Noxious Cloud (poison pool) ---
  await withHero("rogue", async (h) => {
    await h.learn("caltrops"); await h.learn("noxious");
    const id = await h.champ(9000);
    const m = h.mob(id);
    const hp0 = m.hp;
    h.ev.poolfx = 0;
    await h.cast("caltrops", m.x, m.y);
    check("Caltrops lays a field (poolfx)", (h.ev.poolfx ?? 0) >= 1, `${h.ev.poolfx ?? 0} poolfx`);
    await sleep(1200); // hazard ticks on the stationary champ
    check("Caltrops damages over time", !!h.mob(id) && h.mob(id).hp < hp0, `hp ${hp0} → ${h.mob(id)?.hp}`);
    const hp1 = h.mob(id).hp;
    h.ev.poolfx = 0;
    await h.cast("noxious", h.mob(id).x, h.mob(id).y);
    check("Noxious Cloud blooms (poolfx)", (h.ev.poolfx ?? 0) >= 1, `${h.ev.poolfx ?? 0} poolfx`);
    await sleep(1200);
    check("Noxious damages over time", !!h.mob(id) && h.mob(id).hp < hp1, `hp ${hp1} → ${h.mob(id)?.hp}`);
    await h.clear([id]);
  });

  // --- Sorcerer · Winter: Ice Shard (frost bolt) + Blizzard (cold pool) ---
  await withHero("sorcerer", async (h) => {
    await h.learn("iceshard"); await h.learn("blizzard");
    const id = await h.champ(9000);
    const m = h.mob(id);
    const hp0 = m.hp;
    await h.cast("iceshard", m.x, m.y);
    await sleep(500); // let the bolt fly and strike
    check("Ice Shard strikes for damage", !!h.mob(id) && h.mob(id).hp < hp0, `hp ${hp0} → ${h.mob(id)?.hp}`);
    const hp1 = h.mob(id).hp;
    h.ev.poolfx = 0;
    await h.cast("blizzard", h.mob(id).x, h.mob(id).y);
    check("Blizzard falls (poolfx)", (h.ev.poolfx ?? 0) >= 1, `${h.ev.poolfx ?? 0} poolfx`);
    await sleep(1200);
    check("Blizzard damages over time", !!h.mob(id) && h.mob(id).hp < hp1, `hp ${hp1} → ${h.mob(id)?.hp}`);
    await h.clear([id]);
  });

  // --- Paladin · Retribution: Holy Fire (self nova) + Holy Wrath (strike + splash) ---
  await withHero("paladin", async (h) => {
    await h.learn("holyfire"); await h.learn("holywrath");
    const id = await h.champ(9000);
    const m = h.mob(id);
    const hp0 = m.hp;
    h.classfx.prayer = 0;
    await h.cast("holyfire", m.x, m.y);
    check("Holy Fire novas (prayer fx)", (h.classfx.prayer ?? 0) >= 1, `${h.classfx.prayer ?? 0} prayer fx`);
    check("Holy Fire burns those nearby", !!h.mob(id) && h.mob(id).hp < hp0, `hp ${hp0} → ${h.mob(id)?.hp}`);
    const hp1 = h.mob(id).hp;
    await h.cast("holywrath", h.mob(id).x, h.mob(id).y);
    await sleep(150);
    check("Holy Wrath strikes", !!h.mob(id) && h.mob(id).hp < hp1, `hp ${hp1} → ${h.mob(id)?.hp}`);
    await h.clear([id]);
  });

  // --- Necromancer · Blood Magic: Blood Spear (pierce line) + Blood Boil (AoE burst) ---
  await withHero("necromancer", async (h) => {
    await h.learn("bloodspear"); await h.learn("bloodboil");
    const id = await h.champ(9000);
    const m = h.mob(id);
    const hp0 = m.hp;
    h.ev.piercefx = 0;
    await h.cast("bloodspear", m.x, m.y);
    check("Blood Spear skewers a line (piercefx)", (h.ev.piercefx ?? 0) >= 1, `${h.ev.piercefx ?? 0} piercefx`);
    check("Blood Spear damages", !!h.mob(id) && h.mob(id).hp < hp0, `hp ${hp0} → ${h.mob(id)?.hp}`);
    const hp1 = h.mob(id).hp;
    h.ev.poolfx = 0;
    await h.cast("bloodboil", h.mob(id).x, h.mob(id).y);
    check("Blood Boil bursts (poolfx)", (h.ev.poolfx ?? 0) >= 1, `${h.ev.poolfx ?? 0} poolfx`);
    await sleep(160);
    check("Blood Boil damages", !!h.mob(id) && h.mob(id).hp < hp1, `hp ${hp1} → ${h.mob(id)?.hp}`);
    await h.clear([id]);
  });

  // --- Druid · Spirits: Spirit Wolf (one pet) + Call the Pack (several) ---
  await withHero("druid", async (h) => {
    await h.learn("spiritwolf"); await h.learn("spiritpack");
    const at = h.me();
    const pets0 = h.st.pets.size;
    await h.cast("spiritwolf", at.x + 20, at.y);
    await sleep(200);
    const pets1 = h.st.pets.size;
    check("Spirit Wolf summons a pet", pets1 > pets0, `pets ${pets0} → ${pets1}`);
    await h.cast("spiritpack", at.x + 20, at.y);
    await sleep(220);
    check("Call the Pack summons several", h.st.pets.size > pets1 + 1, `pets ${pets1} → ${h.st.pets.size} (the pack)`);
  });

  console.log(failures === 0 ? "\nSKILLS PROBE PASSED ✔" : `\nSKILLS PROBE FAILED (${failures}) ✗`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
