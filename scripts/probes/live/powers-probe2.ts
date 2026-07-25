// Verifies all TEN Legendary Powers II slice-2 powers end-to-end against a live dev server, one
// hero per class. Targets are champs spawned in town (no aggro on sacred ground → stationary, safe).
// Observable signals per power (broadcasts / synced state), asserted below. Requires dev hooks
// (smokegod / smokelevel / smokepower / smokespawnchamp / smokeclear).
//   PROBE_ENDPOINT=ws://localhost:2568 npx tsx scripts/probes/live/powers-probe2.ts
import { Client } from "colyseus.js";

const ENDPOINT = process.env.PROBE_ENDPOINT || "ws://localhost:2567";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "✔" : "✗"} ${name}: ${detail}`);
  if (!ok) failures++;
};

// one probe session for a single class
async function withHero(cls: string, fn: (h: any) => Promise<void>) {
  const c = new Client(ENDPOINT);
  const r = await c.create("dungeon", { key: `p2${cls}${Date.now().toString(36)}`, cls, name: `T${cls}` });
  const ev: Record<string, number> = {};
  const classfx: Record<string, number> = {};
  r.onMessage("*", () => {});
  for (const t of ["poolfx", "frostfx", "piercefx", "aegisfx"]) r.onMessage(t, () => (ev[t] = (ev[t] ?? 0) + 1));
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
  r.send("smokelevel", { level: 20, points: 30 });
  await sleep(250);
  const learn = async (id: string) => { r.send("allocskill", { id }); await sleep(150); };
  const bindOf = (id: string) => Object.entries(loadout?.binds ?? {}).find(([, v]) => v === id)?.[0];
  const cast = async (id: string, x: number, y: number) => { const k = bindOf(id); if (!k) throw new Error(`${id} not bound`); r.send("skill", { key: k, x, y }); await sleep(220); };
  const power = async (id: string) => { r.send("smokepower", { id }); await sleep(120); };
  const champs = async (n: number, hp: number) => { const ids: string[] = []; for (let i = 0; i < n; i++) { champId = ""; r.send("smokespawnchamp", { modifier: "stone", hp }); for (let k = 0; k < 15 && !champId; k++) await sleep(60); if (champId) ids.push(champId); } await sleep(250); return ids; };
  const clear = async (ids: string[]) => { for (const id of ids) r.send("smokeclear", { id }); await sleep(150); };
  await fn({ r, st, me, mob, ev, classfx, learn, cast, power, champs, clear, loadout: () => loadout });
  await r.leave();
  await sleep(150);
}

async function main() {
  // --- Barbarian: Aftershock (leap_quake) + Sundering Roar (warcry_shred) ---
  await withHero("barbarian", async (h) => {
    for (const s of ["bash", "whirlwind", "leap", "shout", "warcry"]) await h.learn(s);
    await h.power("leap_quake"); await h.power("warcry_shred");
    const c = await h.champs(6, 5000);
    const at = h.me();
    h.ev.poolfx = 0;
    await h.cast("leap", at.x + 30, at.y); // leap onto the cluster
    check("Aftershock leaves a quake pool", (h.ev.poolfx ?? 0) >= 1, `${h.ev.poolfx ?? 0} poolfx`);
    await h.clear(c);
    // warcry knockback on a FRESH tight pair right at our feet (leap scattered the last lot)
    const c2 = await h.champs(2, 5000);
    const champ = c2.map((id: string) => h.mob(id)).filter(Boolean)[0]; // live schema ref — x/y update in place
    const d0 = champ ? Math.hypot(champ.x - h.me().x, champ.y - h.me().y) : 999;
    await h.cast("warcry", h.me().x, h.me().y);
    await sleep(200);
    const d1 = champ ? Math.hypot(champ.x - h.me().x, champ.y - h.me().y) : 999;
    check("Sundering Roar knocks the pack back", d1 > d0 + 5, `nearest champ ${d0.toFixed(0)} → ${d1.toFixed(0)} px away`);
    await h.clear(c2);
  });

  // --- Rogue: Killing Frost (frost_shatter) + Ricochet (pierce_ricochet) ---
  await withHero("rogue", async (h) => {
    for (const s of ["multishot", "coldarrow", "pierce"]) await h.learn(s);
    await h.power("frost_shatter"); await h.power("pierce_ricochet");
    const c = await h.champs(4, 5000);
    const m0 = h.mob(c[0]);
    h.ev.frostfx = 0;
    await h.cast("coldarrow", m0.x, m0.y); // arrow flies into the champ; shatter novas on impact
    await sleep(500);
    check("Killing Frost shatters into a nova", (h.ev.frostfx ?? 0) >= 1, `${h.ev.frostfx ?? 0} frostfx (the cold shatter)`);
    h.ev.piercefx = 0;
    await h.cast("pierce", m0.x, m0.y);
    check("Ricochet fires a second lane", (h.ev.piercefx ?? 0) >= 2, `${h.ev.piercefx ?? 0} piercefx lanes (expect 2)`);
    await h.clear(c);
  });

  // --- Paladin: Holy Fervor (zeal_nova) + Sanctuary (prayer_aegis) ---
  await withHero("paladin", async (h) => {
    for (const s of ["smite", "zeal", "prayer"]) await h.learn(s);
    await h.power("zeal_nova"); await h.power("prayer_aegis");
    const c = await h.champs(2, 8000); // tight pair so Zeal (60px reach) actually connects each cast
    const at = h.me();
    h.classfx.prayer = 0;
    for (let i = 0; i < 6; i++) { const t = h.mob(c[0]) ?? at; await h.cast("zeal", t.x, t.y); await sleep(2700); } // Zeal cd is 2600ms — space past it so all 6 land; the 5th detonates
    check("Holy Fervor detonates on the 5th Zeal", (h.classfx.prayer ?? 0) >= 1, `${h.classfx.prayer ?? 0} holy nova(s) over 6 casts`);
    h.ev.aegisfx = 0;
    await h.cast("prayer", at.x, at.y);
    check("Sanctuary shields the party", (h.ev.aegisfx ?? 0) >= 1, `${h.ev.aegisfx ?? 0} shield grant(s)`);
    await h.clear(c);
  });

  // --- Necromancer: Contagion (poison_lingering) + Plaguecarrier (wither_spread) ---
  await withHero("necromancer", async (h) => {
    for (const s of ["teeth", "decrepify", "poisonnova"]) await h.learn(s);
    await h.power("poison_lingering"); await h.power("wither_spread");
    const c = await h.champs(6, 40); // low hp so a couple of teeth volleys kill the cursed host
    const host = h.mob(c[0]);
    h.ev.poolfx = 0;
    await h.cast("poisonnova", h.me().x, h.me().y);
    check("Contagion leaves a plague pool", (h.ev.poolfx ?? 0) >= 1, `${h.ev.poolfx ?? 0} poolfx`);
    // curse the host, then kill it with neighbors nearby → the curse should leap (classfx curse)
    await h.cast("decrepify", host.x, host.y);
    await sleep(150);
    h.classfx.curse = 0;
    for (let i = 0; i < 8 && h.mob(c[0]); i++) { await h.cast("teeth", host.x, host.y); await sleep(200); }
    await sleep(300);
    check("Plaguecarrier spreads the curse on death", (h.classfx.curse ?? 0) >= 1, `${h.classfx.curse ?? 0} spread burst(s)`);
    await h.clear(c);
  });

  // --- Druid: Cataclysm (volcano_twin) + Pack Leader (werewolf_howl) ---
  await withHero("druid", async (h) => {
    for (const s of ["firestorm", "twister", "volcano", "werewolf"]) await h.learn(s);
    await h.power("volcano_twin"); await h.power("werewolf_howl");
    const c = await h.champs(3, 6000);
    const at = h.me();
    h.classfx.volcano = 0;
    await h.cast("volcano", at.x + 30, at.y);
    await sleep(600); // wait out the twin's delay
    check("Cataclysm erupts twice", (h.classfx.volcano ?? 0) >= 2, `${h.classfx.volcano ?? 0} eruptions (expect 2)`);
    const pets0 = h.st.pets.size;
    await h.cast("werewolf", at.x, at.y);
    await sleep(200);
    check("Pack Leader summons a spirit wolf", h.st.pets.size > pets0, `pets ${pets0} → ${h.st.pets.size}`);
    await h.clear(c);
  });

  console.log(failures === 0 ? "\nPOWERS PROBE 2 PASSED ✔" : `\nPOWERS PROBE 2 FAILED (${failures}) ✗`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
