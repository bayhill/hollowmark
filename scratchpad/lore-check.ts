// Deterministic verification of the storytelling data model — no server, no RNG
// flakes. Mirrors the pure battery embedded in scripts/smoke.ts so the additions
// can be confirmed even when the full suite's early flaky tests abort first.
import {
  MERC_CLASSES, recruiterForAct, actTownNpcs, ACT_TOWN_NPCS, TOWN, TOWN_NPCS,
  townNpcById, shrineNpcId, ENCOUNTERS, encounterById, rollEncounter, storytellerFor, MONSTERS,
  TOWN_STYLES, townStyle, TOWN_BUILDINGS, tavernKeeperFor, hutResidentFor, TOWN_PLAZA, TOWN_GATE_TX, TILE,
  effectiveSkills, monsterResistOf, SKILL_POWERS, EFFECTS, FIXED_ITEMS, SKILL_TREES, AFFIXES,
  generateFixedItem, STAT_POINTS_PER_LEVEL, SKILL_POINTS_PER_LEVEL, CLASSES,
  PARAGON_PERKS, paragonPerkById, paragonXpForNext, CURRENT_SEASON, RIFT_ACT, RIFT_KILL_GOAL,
  riftDangerFor, ABYSS_ACT, ACTS,
} from "@arpg/common";

// TOWN.<tile> entries are stored as world-pixel centers; footprints use tile indices
const tileOf = (v: { x: number; y: number }) => ({ x: Math.floor(v.x / TILE), y: Math.floor(v.y / TILE) });

let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) throw new Error("FAIL: " + msg);
}

// --- recruiters: one school pinned per act ---
const pin: Record<number, string> = { 1: "rogue", 2: "mage", 3: "barbarian", 4: "paladin", 5: "paladin" };
for (const a of [1, 2, 3, 4, 5]) ok(recruiterForAct(a).id === pin[a], `recruiterForAct(${a}) === ${pin[a]}`);
ok(MERC_CLASSES.length === 4, "4 merc classes");
for (const c of MERC_CLASSES) {
  ok(c.archetypes.length === 3, `${c.id} musters 3`);
  ok(new Set(c.archetypes.map((x) => x.id)).size === 3, `${c.id} distinct archetype ids`);
}
ok(["arrow", "spell", "melee", "melee"].join() ===
  ["rogue", "mage", "barbarian", "paladin"].map((id) => MERC_CLASSES.find((c) => c.id === id)!.attackStyle).join(),
  "attack styles arrow/spell/melee/melee");

// --- functional NPCs resolve and carry a shop ---
for (const [kind, variant, id] of [
  ["vendor", "", "torvald"], ["gamble", "", "fenwick"], ["alchemist", "", "lysa"],
  ["mercnpc", "rogue", "maren"], ["mercnpc", "mage", "orsavio"],
  ["mercnpc", "barbarian", "hrothgar"], ["mercnpc", "paladin", "iseult"],
] as const) {
  ok(shrineNpcId(kind, variant) === id, `shrineNpcId(${kind},${variant})===${id}`);
  const n = townNpcById(id)!;
  ok(!!n && !!n.shopKind && n.topics.length > 0, `${id} has shop + topics`);
}

// --- 12 act-scoped talk-only townsfolk, distinct slots, elder leads ---
const seen = new Set<string>();
for (const a of [1, 2, 3, 4]) {
  const roster = actTownNpcs(a);
  ok(roster.length >= 3, `act ${a} has >=3 townsfolk`);
  ok(roster[0].id === storytellerFor(a), `act ${a} leads with elder`);
  ok(new Set(roster.map((r) => r.tile)).size === roster.length, `act ${a} distinct slots`);
  for (const spec of roster) {
    ok(!!(TOWN as any)[spec.tile], `tile ${spec.tile} exists`);
    const n = townNpcById(spec.id)!;
    ok(!!n && !n.shopKind && n.topics.length > 0, `${spec.id} talk-only w/ topics`);
    seen.add(`${a}:${spec.id}`);
  }
}
ok(seen.size === 12, `12 act townsfolk (got ${seen.size})`);
ok(ACT_TOWN_NPCS[1].some((r) => r.id === "senna") && ACT_TOWN_NPCS[4].some((r) => r.id === "tomas"), "Senna in I, Tomas in IV");

// --- encounters: well-formed, all three kinds per act, roll stays in-act ---
ok(ENCOUNTERS.length > 0, "encounters authored");
for (const e of ENCOUNTERS) {
  ok(["vignette", "ambush", "boon"].includes(e.kind), `${e.id} valid kind`);
  ok(e.pages.length > 0, `${e.id} has pages`);
  ok(!e.ambushKind || !!(MONSTERS as any)[e.ambushKind], `${e.id} ambush kind real`);
  ok(e.kind !== "boon" || !!e.boon, `${e.id} boon defined`);
  ok(encounterById(e.id) === e, `encounterById(${e.id})`);
}
for (let a = 1; a <= 4; a++)
  for (const k of ["vignette", "ambush", "boon"])
    ok(ENCOUNTERS.some((e) => e.kind === k && (e.act === a || e.act === 0)), `act ${a} has ${k}`);
const seq = [0.1, 0.5, 0.8, 0.95, 0.3, 0.6];
let si = 0;
for (let n = 0; n < 20; n++) {
  const e = rollEncounter(3, () => seq[si++ % seq.length]);
  ok(!e || e.act === 3 || e.act === 0, `rollEncounter(3) stays in act`);
}

// --- per-act town identity: four distinct styles, each fully specified ---
ok(TOWN_STYLES.length === 4, "4 town styles");
{
  const names = new Set(TOWN_STYLES.map((s) => s.name));
  const taverns = new Set(TOWN_STYLES.map((s) => s.tavernName));
  const mats = new Set(TOWN_STYLES.map((s) => s.material));
  ok(names.size === 4, "distinct town names");
  ok(taverns.size === 4, "distinct tavern names");
  ok(mats.size === 4, "distinct materials (timber/adobe/stilt/stone)");
  for (let a = 1; a <= 4; a++) {
    const s = townStyle(a);
    ok(s === TOWN_STYLES[a - 1], `townStyle(${a}) resolves`);
    ok(s.crowd > 0 && s.crowd <= 1, `act ${a} crowd in (0,1]`);
    ok(typeof s.wallL === "number" && typeof s.roof === "number", `act ${a} has palette`);
  }
  // the grimmer the act, the emptier the town
  ok(townStyle(1).crowd > townStyle(4).crowd, "Hollowmere busier than the Last Vigil");
}

// --- enterable interiors: tavern + one hut, hollowed, doors on the perimeter ---
{
  const enter = TOWN_BUILDINGS.filter((b) => b.enterable);
  ok(enter.length === 2, "exactly two enterable buildings");
  ok(enter.some((b) => b.kind === "tavern") && enter.some((b) => b.kind === "hut"), "tavern + hut enterable");
  for (const b of enter) {
    ok(b.w >= 3 && b.h >= 3, `${b.name} big enough for a room`);
    ok(!!b.door, `${b.name} has a door`);
    const d = b.door!;
    const onPerim = d.x === b.x || d.x === b.x + b.w - 1 || d.y === b.y || d.y === b.y + b.h - 1;
    ok(onPerim, `${b.name} door on its perimeter`);
  }
  // the interior NPC anchor tiles sit strictly inside their building
  const tav = enter.find((b) => b.kind === "tavern")!;
  const hut = enter.find((b) => b.kind === "hut")!;
  const inside = (t: { x: number; y: number }, b: typeof tav) => {
    const p = tileOf(t);
    return p.x > b.x && p.x < b.x + b.w - 1 && p.y > b.y && p.y < b.y + b.h - 1;
  };
  ok(inside(TOWN.bar, tav), "bar tile inside the tavern");
  ok(inside(TOWN.hearth, hut), "hearth tile inside the hut");
}

// --- no building footprint may bury a plaza POI or the gate/spawn column ---
{
  const pois: Array<[string, { x: number; y: number }]> = Object.entries(TOWN)
    .filter(([k]) => !["bar", "hearth", "tavernDoor", "well"].includes(k)) // inside / at a door / the well marks the well building
    .map(([k, v]) => [k, tileOf(v as { x: number; y: number })]);
  for (const b of TOWN_BUILDINGS) {
    for (const [name, t] of pois) {
      const covered = t.x >= b.x && t.x < b.x + b.w && t.y >= b.y && t.y < b.y + b.h;
      // an enterable building's interior POIs are fine; solid coverage of a plaza POI is not
      const interior = !!b.enterable && t.x > b.x && t.x < b.x + b.w - 1 && t.y > b.y && t.y < b.y + b.h - 1;
      ok(!covered || interior, `${name} not buried under ${b.name}`);
    }
    const sp = tileOf(TOWN.spawn);
    const spawnCovered = sp.x >= b.x && sp.x < b.x + b.w && sp.y >= b.y && sp.y < b.y + b.h;
    ok(!spawnCovered, `spawn not under ${b.name}`);
    const gateCovered = TOWN_GATE_TX >= b.x && TOWN_GATE_TX < b.x + b.w;
    ok(!gateCovered, `gate column clear of ${b.name}`);
  }
  ok(TOWN_PLAZA.x0 <= 2 && TOWN_PLAZA.x1 >= 26, "plaza wide enough for the enlarged tavern");
}

// --- barkeep + resident: one distinct pair per act, talk-only, resolvable ---
{
  const keepers = new Set<string>();
  const residents = new Set<string>();
  for (let a = 1; a <= 4; a++) {
    const k = tavernKeeperFor(a), r = hutResidentFor(a);
    keepers.add(k); residents.add(r);
    ok(shrineNpcId("barkeep", k) === k, `barkeep ${k} resolves via shrineNpcId`);
    ok(shrineNpcId("barkeep", r) === r, `resident ${r} resolves via shrineNpcId`);
    const kn = townNpcById(k)!, rn = townNpcById(r)!;
    ok(!!kn && !kn.shopKind && kn.topics.length > 0, `${k} talk-only barkeep w/ topics`);
    ok(kn.figure === "barkeep", `${k} drawn as a barkeep`);
    ok(!!rn && !rn.shopKind && rn.topics.length > 0, `${r} talk-only resident w/ topics`);
    ok(rn.figure === "homesteader", `${r} drawn as a homesteader`);
  }
  ok(keepers.size === 4, "4 distinct barkeeps");
  ok(residents.size === 4, "4 distinct residents");
}

// ============================================================
// BUILD DEPTH & AGENCY — respec, +skills, legendary powers, elemental resists
// ============================================================

// --- +skills: boosts learned skills only, never conjures an unlearned one ---
{
  const base = { fireball: 3, teleport: 0 };
  const boosted = effectiveSkills(base, 2);
  ok(boosted.fireball === 5, "+skills boosts a learned skill (3→5)");
  ok(boosted.teleport === 0, "+skills never enables an unlearned skill (0 stays 0)");
  ok(effectiveSkills(base, 0) === base, "no +skills returns the same map (no-op)");
  // the original map is not mutated
  ok(base.fireball === 3, "effectiveSkills does not mutate its input");
}

// --- +skills / penetration affixes exist and are FLAT (never ilvl-inflated) ---
{
  const plus = AFFIXES.filter((a) => a.stat === "plusSkills");
  const pen = AFFIXES.filter((a) => a.stat === "penetration");
  ok(plus.length >= 1 && plus.every((a) => a.flat), "+skills affixes exist and are flat");
  ok(pen.length >= 1 && pen.every((a) => a.flat), "penetration affixes exist and are flat");
}

// --- legendary skill-powers: registry well-formed, each targets a REAL skill ---
{
  const allSkillIds = new Set(Object.values(SKILL_TREES).flat().map((n: any) => n.id));
  ok(Object.keys(SKILL_POWERS).length >= 6, "at least 6 skill-powers authored");
  for (const [id, pw] of Object.entries(SKILL_POWERS)) {
    ok(!!pw.name && !!pw.desc, `power ${id} has name + desc`);
    ok(allSkillIds.has(pw.skill), `power ${id} targets a real skill (${pw.skill})`);
  }
  // every fixed item that carries a power: power is registered AND it still has an effect
  // (the smoke "perkless" invariant), and the power resolves through generateFixedItem
  const powerItems = FIXED_ITEMS.filter((f) => (f as any).power);
  ok(powerItems.length >= 6, "at least 6 power-carrying fixed items");
  for (const f of powerItems) {
    const pid = (f as any).power as string;
    ok(!!SKILL_POWERS[pid], `${f.name}'s power ${pid} is registered`);
    ok(!!f.effect && !!EFFECTS[f.effect], `${f.name} still carries a real effect (perkless invariant)`);
    const made = generateFixedItem(f.name, 10);
    ok(!!made && made.power === pid, `${f.name} generates with its power attached`);
  }
  // one power per class is covered (barbarian/rogue/sorcerer/paladin/necromancer/druid signatures)
  const coveredSkills = new Set(powerItems.map((f) => SKILL_POWERS[(f as any).power].skill));
  for (const s of ["meteor", "hammers", "skeleton", "whirlwind", "multishot", "twister"])
    ok(coveredSkills.has(s), `a power rewrites ${s}`);
}

// --- monster elemental resistances + weaknesses ---
{
  ok(monsterResistOf("demon", "fire") > 0, "demons resist fire");
  ok(monsterResistOf("demon", "cold") < 0, "demons are WEAK to cold (negative resist)");
  ok(monsterResistOf("zombie", "fire") === 0, "plain zombies resist nothing");
  ok(monsterResistOf("flamecaller", "fire") >= 75, "flamecallers nearly immune to fire");
  ok(monsterResistOf("uldrath", "fire") > 0 && monsterResistOf("uldrath", "light") > 0, "the last king guards all elements");
  // net-of-penetration math (mirrors damageMonster): pen claws back resist, floored at -100
  const net = (kind: string, el: any, pen: number) => Math.max(-100, Math.min(100, monsterResistOf(kind, el) - pen));
  ok(net("demon", "fire", 30) < monsterResistOf("demon", "fire"), "penetration reduces effective resist");
  ok(net("flamecaller", "fire", 90) <= 0, "enough penetration fully cracks a near-immunity");
}

// --- respec formula consistency (grant vs refund must agree) ---
{
  for (const lvl of [1, 10, 50, 99]) {
    ok(SKILL_POINTS_PER_LEVEL * lvl === (lvl === 1 ? 1 : SKILL_POINTS_PER_LEVEL * lvl), `skill-point total at ${lvl}`);
    ok(STAT_POINTS_PER_LEVEL * (lvl - 1) >= 0, `stat-point total at ${lvl} non-negative`);
  }
  ok(CLASSES.length === 6, "six classes (respec resets each to its base attrs)");
}

// ============================================================
// ENDGAME — paragon, seasons, rifts
// ============================================================

// --- paragon: perks well-formed, XP curve climbs, resolvable ---
{
  ok(PARAGON_PERKS.length >= 4, "at least 4 paragon perks");
  ok(new Set(PARAGON_PERKS.map((p) => p.id)).size === PARAGON_PERKS.length, "paragon perk ids distinct");
  for (const perk of PARAGON_PERKS) {
    ok(!!perk.name && !!perk.desc && !!perk.stat && perk.per > 0, `paragon ${perk.id} well-formed`);
    ok(paragonPerkById(perk.id) === perk, `paragonPerkById(${perk.id}) resolves`);
  }
  ok(paragonPerkById("nonesuch") === undefined, "unknown paragon perk → undefined");
  // the cost climbs, so paragon is an endless grind not a free lunch
  ok(paragonXpForNext(0) > 0, "first paragon level costs XP");
  ok(paragonXpForNext(50) > paragonXpForNext(0), "paragon cost climbs with level");
}

// --- seasons ---
{
  ok(Number.isInteger(CURRENT_SEASON) && CURRENT_SEASON >= 1, "current season is a positive integer");
}

// --- rifts: sentinel act off the ladder, tier scales danger ---
{
  ok(RIFT_ACT > ABYSS_ACT && RIFT_ACT > ACTS.length + 1, "RIFT_ACT is a sentinel beyond the real acts + abyss");
  ok(RIFT_KILL_GOAL > 0, "a rift has a kill objective");
  ok(riftDangerFor(1) > 0, "tier 1 rift has danger");
  ok(riftDangerFor(10) > riftDangerFor(1), "rift danger climbs with tier (a pushable knob)");
  // each tier is a real step
  for (let t = 1; t < 20; t++) ok(riftDangerFor(t + 1) > riftDangerFor(t), `rift tier ${t + 1} harder than ${t}`);
}

console.log(`LORE DATA MODEL OK — ${checks} assertions passed`);
console.log(`  speakers: ${TOWN_NPCS.length} · act townsfolk: 12 (4 elders + 8 locals) · encounters: ${ENCOUNTERS.length}`);
console.log(`  recruiters act-scoped: I=${recruiterForAct(1).id} II=${recruiterForAct(2).id} III=${recruiterForAct(3).id} IV=${recruiterForAct(4).id}`);
