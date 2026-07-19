// Pure check: gloves are a first-class slot with bases, generated magic/rare, and uniques/set.
import { BASE_ITEMS, FIXED_ITEMS, SET_ITEMS, SETS, EFFECTS, EQUIP_SLOTS, equipSlotFor, generateItem, GAMBLE_WEIGHTS } from "@hollowmark/common";
let fails = 0;
const check = (n: string, ok: boolean, d: string) => { if (!ok) fails++; console.log(`${ok ? "✔" : "✗"} ${n}: ${d}`); };

const gloveBases = Object.entries(BASE_ITEMS).filter(([, b]) => b.slot === "gloves").map(([k]) => k);
check("gloves is an equip slot", EQUIP_SLOTS.includes("gloves"), EQUIP_SLOTS.join(","));
check("glove bases exist", gloveBases.length >= 3, gloveBases.join(", "));
check("equipSlotFor maps a glove to the gloves slot", equipSlotFor({ slot: "gloves" }, {}) === "gloves", String(equipSlotFor({ slot: "gloves" }, {})));

const gloveFixed = FIXED_ITEMS.filter((f) => BASE_ITEMS[f.base]?.slot === "gloves");
check("glove uniques/legendaries/epics added", gloveFixed.length >= 6, `${gloveFixed.length}: ${gloveFixed.map((f) => `${f.name}[${f.rarity}]`).join(", ")}`);
check("every glove fixed item has a real effect", gloveFixed.every((f) => f.effect && EFFECTS[f.effect]), gloveFixed.filter((f) => !f.effect || !EFFECTS[f.effect!]).map((f) => f.name).join(", ") || "all valid");
const rarities = new Set(gloveFixed.map((f) => f.rarity));
check("glove fixed items span rarities", rarities.has("unique") && rarities.has("legendary") && rarities.has("epic"), [...rarities].join(", "));

const gloveSet = SET_ITEMS.filter((s) => BASE_ITEMS[s.base]?.slot === "gloves");
check("a set piece is a glove", gloveSet.length >= 1, gloveSet.map((s) => `${s.name} (${SETS[s.setId]?.name})`).join(", "));

// generation: force each glove base, confirm it produces a gloves-slot item across rarities
let genGloves = 0, sawSet = false, sawUnique = false;
for (const base of gloveBases) {
  for (let i = 0; i < 400; i++) {
    const it = generateItem(10, 200, Math.random, GAMBLE_WEIGHTS, base);
    if (BASE_ITEMS[it.base].slot === "gloves") genGloves++;
    if (it.rarity === "set" && BASE_ITEMS[it.base].slot === "gloves") sawSet = true;
    if ((it.rarity === "unique" || it.rarity === "legendary" || it.rarity === "epic") && BASE_ITEMS[it.base].slot === "gloves") sawUnique = true;
  }
}
check("glove bases generate glove-slot items", genGloves > 0, `${genGloves} generated`);
check("glove set piece can roll", sawSet, sawSet ? "yes" : "none in sample");
check("glove unique+ can roll", sawUnique, sawUnique ? "yes" : "none in sample");

console.log(`\n${fails === 0 ? "✅ ALL GREEN" : `❌ ${fails} FAILURE(S)`} — Gloves`);
process.exit(fails === 0 ? 0 : 1);
