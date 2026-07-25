// Balance report — measures the real drop economy (Monte-Carlo over generateItem)
// and the depth/HP scaling curve, so tuning is data-driven not vibes. No server.
//   npx tsx scripts/probes/offline/balance-check.ts
import {
  generateItem, RARITY_WEIGHTS, BOSS_RARITY_WEIGHTS, RARITY_ORDER, Rarity,
  DROP_CHANCE, RUNE_DROP_CHANCE, CHARM_DROP_CHANCE, JEWEL_DROP_CHANCE,
  floorHpMult, floorDmgMult, campPackSize, eliteChanceFor, CHAMPION_CHANCE,
  dangerFor, ACT_FLOORS, DIFF_DANGER_OFFSET, MONSTERS,
  BOSS_GUARANTEED_DROPS, BOSS_EXTRA_DROP_CHANCE,
} from "@hollowmark/common";

const N = 300_000;
const pct = (x: number) => (x * 100).toFixed(2) + "%";
const uniquePlus: Rarity[] = ["unique", "legendary", "epic"];

function rarityDist(mf: number, table = RARITY_WEIGHTS, ilvl = 20) {
  const tally: Record<string, number> = {};
  for (let i = 0; i < N; i++) {
    const r = generateItem(ilvl, mf, Math.random, table).rarity;
    tally[r] = (tally[r] ?? 0) + 1;
  }
  const out: Record<string, number> = {};
  for (const r of RARITY_ORDER) out[r] = (tally[r] ?? 0) / N;
  return out;
}

console.log("═══ DROP ECONOMY (trash kills) ═══");
console.log(`per normal kill: gear ${pct(DROP_CHANCE)} · rune ${pct(RUNE_DROP_CHANCE)} · charm ${pct(CHARM_DROP_CHANCE)} · jewel ${pct(JEWEL_DROP_CHANCE)}`);
console.log(`  → 1 gear item every ${(1 / DROP_CHANCE).toFixed(1)} kills · 1 rune / ${(1 / RUNE_DROP_CHANCE).toFixed(0)} · 1 charm / ${(1 / CHARM_DROP_CHANCE).toFixed(0)} · 1 jewel / ${(1 / JEWEL_DROP_CHANCE).toFixed(0)}`);

console.log("\n═══ RARITY DISTRIBUTION of a dropped gear item, by Magic Find ═══");
console.log(["MF".padEnd(6), ...RARITY_ORDER.map((r) => r.slice(0, 4).padStart(7))].join(""));
for (const mf of [0, 100, 300, 600]) {
  const d = rarityDist(mf);
  console.log([String(mf).padEnd(6), ...RARITY_ORDER.map((r) => pct(d[r]).padStart(7))].join(""));
}

console.log("\n═══ THE ITEM CHASE: kills per outcome (trash), by Magic Find ═══");
for (const mf of [0, 100, 300, 600]) {
  const d = rarityDist(mf);
  const pUnq = uniquePlus.reduce((s, r) => s + d[r], 0);
  const pRareUp = pUnq + d.rare + d.set;
  const killsUnq = 1 / (DROP_CHANCE * pUnq);
  const killsRare = 1 / (DROP_CHANCE * pRareUp);
  console.log(`MF ${String(mf).padStart(3)}: 1 rare+ every ${killsRare.toFixed(0)} kills · 1 unique+ every ${killsUnq.toFixed(0)} kills (${pct(pUnq)} of gear)`);
}

console.log("\n═══ BOSS DROPS (2 guaranteed + 30% third, boosted table) ═══");
{
  const d = rarityDist(300, BOSS_RARITY_WEIGHTS);
  const pUnq = uniquePlus.reduce((s, r) => s + d[r], 0);
  const expDrops = BOSS_GUARANTEED_DROPS + BOSS_EXTRA_DROP_CHANCE;
  console.log(`per boss kill @MF300: ~${expDrops.toFixed(1)} drops, ${pct(pUnq)} unique+ each → ${(expDrops * pUnq).toFixed(2)} unique+/kill (1 every ${(1 / (expDrops * pUnq)).toFixed(1)} boss kills)`);
  console.log(`  boss rarity spread: ${RARITY_ORDER.filter((r) => d[r] > 0.001).map((r) => `${r.slice(0, 4)} ${pct(d[r])}`).join(" · ")}`);
}

console.log("\n═══ DEPTH SCALING: monster HP & pack pressure across the descent ═══");
console.log("(base = a zombie's HP; danger = (act-1)*7 + floor; +diff offset for NM/Hell)");
const baseHp = MONSTERS.zombie?.maxHp ?? 30;
console.log(["where".padEnd(20), "danger".padStart(7), "hpMult".padStart(8), "zombieHP".padStart(9), "pack".padStart(6), "elite%".padStart(8)].join(""));
const spots: Array<[string, number, number]> = [
  ["Act I surface", 1, 1], ["Act I boss (f7)", 1, 7],
  ["Act II f1", 2, 1], ["Act II boss", 2, 7],
  ["Act III boss", 3, 7], ["Act IV boss (f7)", 4, 7],
  ["Abyss f1", 5, 1], ["Abyss f7", 5, 7], ["Abyss f21", 5, 21],
];
for (const [name, act, floor] of spots) {
  const dgr = dangerFor(act, floor);
  const hm = floorHpMult(dgr);
  console.log([name.padEnd(20), String(dgr).padStart(7), hm.toFixed(2).padStart(8), Math.round(baseHp * hm).toString().padStart(9), campPackSize(dgr).toString().padStart(6), pct(eliteChanceFor(dgr)).padStart(8)].join(""));
}
console.log("\ndifficulty adds a flat danger offset: Normal +0, Nightmare +" + DIFF_DANGER_OFFSET[1] + ", Hell +" + DIFF_DANGER_OFFSET[2]);
console.log(`  → Hell Act I surface plays at danger ${1 + DIFF_DANGER_OFFSET[2]} (hpMult ${floorHpMult(1 + DIFF_DANGER_OFFSET[2]).toFixed(1)}, dmgMult ${floorDmgMult(1 + DIFF_DANGER_OFFSET[2]).toFixed(1)})`);
console.log(`champion pack chance (flat): ${pct(CHAMPION_CHANCE)} per camp`);

console.log("\n═══ observations to eyeball ═══");
console.log("- if 'kills per unique+' at MF0 is > ~800, the base chase may be too dry for casual play");
console.log("- if the Hell danger offset makes hpMult balloon past ~25×, low-level trash on Hell f1 may be spongey");
console.log("- pack size caps at 12 and elite% at 40% by danger ~14 — check that deep floors don't feel identical to mid");

console.log("\n═══ DENSITY PLATEAU: where combat variety stops scaling ═══");
// find the danger at which pack size and elite% hit their caps
let packCapAt = 0, eliteCapAt = 0;
for (let d = 1; d <= 84; d++) {
  if (!packCapAt && campPackSize(d) >= 12) packCapAt = d;
  if (!eliteCapAt && eliteChanceFor(d) >= 0.4 - 1e-9) eliteCapAt = d;
}
console.log(`pack size caps at 12 by danger ${packCapAt} (Act ${Math.ceil(packCapAt/ACT_FLOORS)}); elite% caps at 40% by danger ${eliteCapAt}`);
console.log(`champion-pack chance is FLAT at ${pct(CHAMPION_CHANCE)} for all 84 danger levels`);
console.log(`→ from danger ${Math.max(packCapAt,eliteCapAt)} to 84 (the deepest ${Math.round((84-Math.max(packCapAt,eliteCapAt))/84*100)}% of the game) combat changes ONLY by HP/damage numbers`);
console.log(`  (behavioral champion affixes now add mid-fight variety, but pack SIZE / elite & champion DENSITY stay flat)`);

console.log("\n═══ PER-FLOOR LOOT: the fountain (denser packs since pack cap 5 → 12) ═══");
const CAMPS = 11; // a typical floor's camp count (from live logs)
for (const [label, packCap] of [["old cap (5)", 5], ["current cap (12)", 12]] as Array<[string, number]>) {
  const deepPack = Math.min(packCap, campPackSize(84));
  const mobs = CAMPS * deepPack;
  const gearPerFloor = mobs * DROP_CHANCE;
  const uniquePlusPerFloor = gearPerFloor * 0.0594; // MF0 unique+ share of a gear drop
  console.log(`${label.padEnd(16)} ~${mobs} trash/floor → ~${gearPerFloor.toFixed(1)} gear, ~${uniquePlusPerFloor.toFixed(2)} unique+/floor (MF0), +gold/runes/charms`);
}
console.log(`→ the pack-density bump (5→12) roughly ${(12/5).toFixed(1)}×'d per-floor loot; DROP_CHANCE (${pct(DROP_CHANCE)}/kill) was left untouched on purpose`);

console.log("\n═══ HP SPONGE CHECK: monster HP is unbounded, player level is not ═══");
for (const d of [28, 42, 56, 70, 84]) {
  console.log(`danger ${d}: zombie ${Math.round(baseHp*floorHpMult(d))} hp (${floorHpMult(d).toFixed(1)}×), monster dmg ${floorDmgMult(d).toFixed(1)}× — vs a level-cap hero whose base HP/DPS growth has stopped (only paragon trickles)`);
}
