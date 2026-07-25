// Skill balance model — role-aware "effective DPS" for every active, in weapon-damage units
// (rank 5, no gear, no synergies — a level playing field). Converts each skill's per-cast output
// to a single-target-equivalent sustained DPS so peers can be compared, folding in DoT ticks
// (Rend bleed) and hazard tick totals (Caltrops/Noxious/Blizzard). Flags anything outside its
// role band. No server. Run:  npx tsx scripts/probes/offline/skill-balance.ts
import {
  SKILL_TREES, FIREWALL_TICK_MS, REND_BLEED_FRACTION,
  CALTROPS_MULT, CALTROPS_MS, NOXIOUS_MULT, NOXIOUS_MS, BLIZZARD_MULT, BLIZZARD_MS,
} from "@hollowmark/common";

type Role = "strike" | "spam" | "line" | "aoe" | "hazard" | "ult" | "summon" | "buff";

// how each active behaves — set per skill so the comparison is apples-to-apples
const ROLE: Record<string, Role> = {
  // barbarian
  bash: "strike", whirlwind: "aoe", leap: "aoe", ancients: "ult", warcry: "aoe", cleave: "aoe", rend: "strike",
  // rogue
  multishot: "spam", coldarrow: "spam", pierce: "line", vengeance: "ult", caltrops: "hazard", noxious: "hazard",
  // sorcerer
  chain: "aoe", frostnova: "aoe", firewall: "hazard", meteor: "ult", iceshard: "spam", blizzard: "hazard",
  // paladin
  smite: "strike", zeal: "strike", hammers: "aoe", fistofheavens: "ult", prayer: "buff", holyfire: "aoe", holywrath: "aoe", // holywrath = a heavy strike WITH splash → compared as AoE
  // necromancer
  teeth: "spam", decrepify: "aoe", poisonnova: "aoe", army: "ult", bloodspear: "line", bloodboil: "aoe",
  // druid
  firestorm: "hazard", twister: "aoe", volcano: "aoe", hurricane: "ult", spiritwolf: "summon", spiritpack: "summon",
};

// single-target-equivalent sustained-DPS band expected of each role (weapon-damage units)
const BAND: Record<Role, [number, number]> = {
  strike: [0.9, 1.8],   // melee/heavy single-target
  spam: [0.6, 1.15],    // cheap fast ranged single-target
  line: [0.4, 0.75],    // pierces many — lower per-target
  aoe: [0.25, 0.9],     // hits a cluster — lower per-target
  hazard: [0.12, 0.4],  // area denial over time
  ult: [0.05, 0.3],     // huge burst, long cd
  summon: [0.1, 0.45],  // damage flows through pets
  buff: [0, 99],        // not a damage skill
};

const HAZARD: Record<string, [number, number]> = {
  caltrops: [CALTROPS_MULT, CALTROPS_MS], noxious: [NOXIOUS_MULT, NOXIOUS_MS], blizzard: [BLIZZARD_MULT, BLIZZARD_MS],
};

function effectiveDps(node: any): number {
  const mult5 = (node.baseMult ?? 0) + 4 * (node.rankMult ?? 0);
  const cdS = (node.cooldownMs ?? 1000) / 1000;
  if (HAZARD[node.id]) {
    const [frac, ms] = HAZARD[node.id];
    const ticks = ms / FIREWALL_TICK_MS;
    return (mult5 * frac * ticks) / cdS; // total pool damage per cast, amortized over the cooldown
  }
  if (node.id === "rend") return (mult5 * (1 + REND_BLEED_FRACTION)) / cdS; // strike + full bleed
  return mult5 / cdS;
}

const NEW = new Set(["cleave", "rend", "caltrops", "noxious", "iceshard", "blizzard", "holyfire", "holywrath", "bloodspear", "bloodboil", "spiritwolf", "spiritpack"]);

console.log("═══ SKILL DPS (rank 5, weapon-damage units, single-target-equivalent) ═══");
console.log(`${"skill".padEnd(14)}${"role".padEnd(8)}${"tier".padEnd(5)}${"dps".padStart(7)}   band        flag`);
const byRole: Record<string, any[]> = {};
let outliers = 0;
for (const [, nodes] of Object.entries(SKILL_TREES)) {
  for (const n of nodes as any[]) {
    if (n.type === "passive" || n.baseMult === undefined) continue;
    const role = ROLE[n.id] ?? "aoe";
    const dps = effectiveDps(n);
    (byRole[role] ??= []).push({ id: n.id, tier: n.tier, dps, role, isNew: NEW.has(n.id) });
  }
}
for (const role of ["strike", "spam", "line", "aoe", "hazard", "summon", "ult"] as Role[]) {
  const [lo, hi] = BAND[role];
  for (const r of (byRole[role] ?? []).sort((a, b) => b.dps - a.dps)) {
    const out = r.dps < lo - 1e-9 || r.dps > hi + 1e-9;
    if (out && r.isNew) outliers++;
    const flag = out ? (r.dps > hi ? "⚠ HIGH" : "⚠ low") : "ok";
    console.log(`${(r.isNew ? "• " : "  ") + r.id.padEnd(12)}${role.padEnd(8)}t${String(r.tier).padEnd(4)}${r.dps.toFixed(2).padStart(7)}   [${lo}-${hi}]`.padEnd(52) + `${flag}${r.isNew ? "  (new)" : ""}`);
  }
}
console.log(`\n${outliers === 0 ? "✔ all NEW skills sit within their role band" : `✗ ${outliers} NEW skill(s) out of band`}`);
process.exit(outliers === 0 ? 0 : 1);
