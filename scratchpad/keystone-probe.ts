// Verifies all SIX class keystones end-to-end against a live dev server, each measured through its
// REAL code path and compared against a control hero (same class, keystone NOT allocated) so the
// delta is provably the keystone's doing. Deterministic — no averaging. Requires dev hooks
// (smokelevel / smokegod / smokeset / smokedmg / smokechill / smokehurt / smokespawnkind /
// smokedmgmob).
//   PROBE_ENDPOINT=ws://localhost:2568 npx tsx scratchpad/keystone-probe.ts
import { Client } from "colyseus.js";

const ENDPOINT = process.env.PROBE_ENDPOINT || "ws://localhost:2567";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "✔" : "✗"} ${name}: ${detail}`);
  if (!ok) failures++;
};

// a session for one hero; pass keystoneId to allocate it, or "" for the control
async function session(cls: string, keystoneId: string, extraSkills: string[] = []) {
  const c = new Client(ENDPOINT);
  const r = await c.create("dungeon", { key: `ks${cls}${keystoneId}${Date.now().toString(36)}`, cls, name: `K${cls}` });
  r.onMessage("*", () => {});
  let loadout: any = null, dmgVal = 0, chilled = false, champId = "";
  r.onMessage("loadout", (m: any) => (loadout = m));
  r.onMessage("smokedmgval", (m: any) => (dmgVal = m.v));
  r.onMessage("smokechilled", (m: any) => (chilled = m.chilled));
  r.onMessage("smokechamp", (m: any) => (champId = m.id));
  await sleep(600);
  const st: any = r.state;
  const me = () => st.players.get(r.sessionId);
  const mob = (id: string) => st.monsters.get(id);
  r.send("smokelevel", { level: 40, points: 80 });
  await sleep(250);
  for (const s of extraSkills) { r.send("allocskill", { id: s }); await sleep(140); }
  if (keystoneId) { r.send("allocskill", { id: keystoneId }); await sleep(160); }
  const bindOf = (id: string) => Object.entries(loadout?.binds ?? {}).find(([, v]) => v === id)?.[0];
  const cast = async (id: string, x: number, y: number) => { const k = bindOf(id); if (!k) throw new Error(`${id} not bound`); r.send("skill", { key: k, x, y }); await sleep(240); };
  const set = async (o: any) => { r.send("smokeset", o); await sleep(120); };
  const god = async () => { r.send("smokegod", {}); await sleep(120); };
  const dmg = async () => { dmgVal = -1; r.send("smokedmg", {}); for (let i = 0; i < 20 && dmgVal < 0; i++) await sleep(40); return dmgVal; };
  const chill = async () => { r.send("smokechill", {}); await sleep(160); return chilled; };
  const hurt = async (amount: number) => { r.send("smokehurt", { amount }); await sleep(160); };
  const spawnKind = async (kind: string, hp: number) => { champId = ""; r.send("smokespawnkind", { kind, hp }); for (let i = 0; i < 25 && !champId; i++) await sleep(60); await sleep(120); return champId; };
  const dmgMob = async (id: string) => { r.send("smokedmgmob", { id }); await sleep(180); };
  return { r, st, me, mob, cast, set, god, dmg, chill, hurt, spawnKind, dmgMob, close: async () => { await r.leave(); await sleep(120); } };
}

async function main() {
  // --- Barbarian · Immovable: a cold hit must NOT chill the keystone hero ---
  {
    const k = await session("barbarian", "ks_immovable"); await k.god();
    const c = await session("barbarian", ""); await c.god();
    const chK = await k.chill(), chC = await c.chill();
    check("Immovable — keystone hero shrugs off the chill", chK === false && chC === true, `keystone chilled=${chK}, control chilled=${chC}`);
    await k.close(); await c.close();
  }

  // --- Rogue · Lethality: a forced crit should hit ×2.5 vs the control's ×2 ---
  {
    const k = await session("rogue", "ks_lethality"); await k.set({ crit: 100 });
    const c = await session("rogue", ""); await c.set({ crit: 100 });
    const dK = await k.dmg(), dC = await c.dmg();
    const ratio = dC ? dK / dC : 0;
    check("Lethality — crits hit ×2.5 vs ×2", Math.abs(ratio - 1.25) < 0.03, `keystone ${dK} vs control ${dC} (ratio ${ratio.toFixed(3)}, expect 1.25)`);
    await k.close(); await c.close();
  }

  // --- Sorcerer · Unraveling: +25 penetration → more damage into a cold-resistant wraith ---
  {
    const k = await session("sorcerer", "ks_unraveling"); await k.set({ crit: 0, cold: 100 });
    const c = await session("sorcerer", ""); await c.set({ crit: 0, cold: 100 });
    const idK = await k.spawnKind("wraith", 9000), idC = await c.spawnKind("wraith", 9000);
    const hpK0 = k.mob(idK).hp, hpC0 = c.mob(idC).hp;
    await k.dmgMob(idK); await c.dmgMob(idC);
    const dK = hpK0 - k.mob(idK).hp, dC = hpC0 - c.mob(idC).hp;
    check("Unraveling — cuts deeper into a cold-resistant foe", dK > dC + 2, `keystone dealt ${dK} vs control ${dC} into wraith (cold res 60)`);
    await k.close(); await c.close();
  }

  // --- Paladin · Bulwark: above 60% life, take ~20% less from a fixed hit ---
  {
    const k = await session("paladin", "ks_bulwark"); await k.god();
    const c = await session("paladin", ""); await c.god();
    const hK0 = k.me().hp, hC0 = c.me().hp;
    await k.hurt(1000); await c.hurt(1000);
    const lossK = hK0 - k.me().hp, lossC = hC0 - c.me().hp;
    check("Bulwark — sheds ~20% of the blow while healthy", lossK < lossC * 0.9, `keystone lost ${lossK} vs control ${lossC} (expect ~800 vs ~1000)`);
    await k.close(); await c.close();
  }

  // --- Necromancer · Soul Siphon: a kill restores life & mana ---
  {
    const k = await session("necromancer", "ks_siphon");
    const c = await session("necromancer", "");
    for (const h of [k, c]) await h.set({ hp: 100, mana: 10 });
    const idK = await k.spawnKind("zombie", 1), idC = await c.spawnKind("zombie", 1);
    const hK0 = k.me().hp, mK0 = k.me().mana, hC0 = c.me().hp, mC0 = c.me().mana;
    await k.dmgMob(idK); await c.dmgMob(idC); // 1-dmg all-cold hit one-shots the 1-hp mob → on-kill
    await sleep(150);
    const dHpK = k.me().hp - hK0, dMpK = k.me().mana - mK0, dHpC = c.me().hp - hC0, dMpC = c.me().mana - mC0;
    // both heroes passively regen over the window; the keystone must add its ~3% siphon ON TOP of that
    const r2 = (n: number) => Math.round(n * 10) / 10;
    check("Soul Siphon — the kill restores life & mana on top of regen", dHpK - dHpC > 4 && dMpK - dMpC > 1,
      `keystone +${r2(dHpK)}hp/+${r2(dMpK)}mp vs control (regen only) +${r2(dHpC)}hp/+${r2(dMpC)}mp`);
    await k.close(); await c.close();
  }

  // --- Druid · Primal Fury: in Werewolf form, +30% damage vs the control's wolf ---
  {
    const k = await session("druid", "ks_primal", ["werewolf"]);
    const c = await session("druid", "", ["werewolf"]);
    for (const h of [k, c]) { await h.set({ crit: 0 }); await h.cast("werewolf", h.me().x, h.me().y); }
    const dK = await k.dmg(), dC = await c.dmg();
    const ratio = dC ? dK / dC : 0;
    check("Primal Fury — the wolf hits +30% harder", Math.abs(ratio - 1.3) < 0.04, `keystone ${dK} vs control ${dC} (ratio ${ratio.toFixed(3)}, expect 1.30)`);
    await k.close(); await c.close();
  }

  console.log(failures === 0 ? "\nKEYSTONE PROBE PASSED ✔" : `\nKEYSTONE PROBE FAILED (${failures}) ✗`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
