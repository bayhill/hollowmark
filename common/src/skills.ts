// SKILL TREES: every class's two-or-three archetypes, the tier gates and prerequisites,
// the synergy web, and the Transcendence keystones that rewrite a build.
//
// A leaf by construction: it needs only ClassName and MeleeAttack, both types, imported
// with `import type` so nothing survives to runtime and no import cycle can form.
// index.ts re-exports everything here.
import type { ClassName, MeleeAttack } from "./index";
import type { ItemStats } from "./stats";

// --- skill trees: choose, rank up, synergize, ascend ---

export const SKILL_POINTS_PER_LEVEL = 1;
// tier index → character level required to allocate
export const TIER_LEVELS = [0, 1, 4, 8, 12, 30]; // tier 5: Transcendence — the level-99 endgame
export const ULTIMATE_TIER = 4;

// --- class keystones: one transformative capstone per class at the Transcendence tier ---
// Single rank, level 30, no loot required — the build-defining CHOICE (spend it here, or on flat
// Transcendence stats?). Each is a conditional RULE branched in server combat, keyed by node id.
export const KEYSTONE_CRIT_MULT = 2.5; // Rogue "Lethality": crits deal ×2.5 instead of ×2
export const KEYSTONE_PENETRATION = 25; // Sorcerer "Unraveling": ignore +25% of monster elem resist
export const KEYSTONE_BULWARK_HP = 0.6; // Paladin "Bulwark": while above 60% life…
export const KEYSTONE_BULWARK_DR = 0.2; // …take 20% less damage
export const KEYSTONE_SIPHON_FRAC = 0.03; // Necromancer "Soul Siphon": each kill restores 3% hp+mana
export const KEYSTONE_PRIMAL_DMG = 1.3; // Druid "Primal Fury": +30% damage in Werewolf form…
export const KEYSTONE_PRIMAL_ATKSPD = 30; // …and +30% attack speed

export type SkillType = "active" | "passive" | "ultimate";

export interface SkillNode {
  id: string;
  name: string;
  desc: string;
  tree: string; // column in the tree UI
  tier: number; // 1..5 — gated by TIER_LEVELS
  type: SkillType;
  maxRank: number;
  req?: string; // prerequisite node (needs at least 1 rank)
  // actives
  mana?: number;
  cooldownMs?: number;
  baseMult?: number; // damage multiplier at rank 1
  rankMult?: number; // added multiplier per rank past 1
  synergies?: Array<{ from: string; pct: number }>; // each source adds +pct% damage per hard point in `from` — a web, not a chain
  // passives grant stats per rank
  passive?: ItemStats;
  // a class KEYSTONE: a single-rank Transcendence capstone whose effect is a transformative RULE
  // (handled in server combat), not a stat block. The string is the one-line rule for the tooltip;
  // its presence is what brands the node a keystone.
  keystone?: string;
}

export const SKILL_TREES: Record<ClassName, SkillNode[]> = {
  barbarian: [
    { id: "bash", name: "Bash", desc: "A crushing blow that stuns its victim", tree: "Might", tier: 1, type: "active", maxRank: 5, mana: 6, cooldownMs: 1500, baseMult: 1.6, rankMult: 0.25 },
    { id: "ironskin", name: "Iron Skin", desc: "Hardened hide and harder bones", tree: "Might", tier: 1, type: "passive", maxRank: 10, passive: { armor: 3, maxHp: 8 } },
    { id: "whirlwind", name: "Whirlwind", desc: "Become a steel hurricane", tree: "Might", tier: 2, type: "active", maxRank: 5, req: "bash", mana: 12, cooldownMs: 3000, baseMult: 1.5, rankMult: 0.2, synergies: [{ from: "bash", pct: 8 }] },
    { id: "mastery", name: "Weapon Mastery", desc: "Every weapon is an old friend", tree: "Might", tier: 3, type: "passive", maxRank: 10, passive: { dmgPct: 6, crit: 1 } },
    { id: "leap", name: "Leap Slam", desc: "Death from above, scattering the pack", tree: "Might", tier: 3, type: "active", maxRank: 5, req: "whirlwind", mana: 15, cooldownMs: 5000, baseMult: 1.2, rankMult: 0.2, synergies: [{ from: "whirlwind", pct: 6 }] },
    { id: "ancients", name: "Wrath of the Mountain", desc: "The mountain itself strikes with you", tree: "Might", tier: 4, type: "ultimate", maxRank: 5, req: "leap", mana: 30, cooldownMs: 25000, baseMult: 3.0, rankMult: 0.5, synergies: [{ from: "leap", pct: 10 }] },
    { id: "shout", name: "Battle Shout", desc: "A roar that turns men into weapons", tree: "War Cries", tier: 1, type: "active", maxRank: 5, mana: 10, cooldownMs: 10000 },
    { id: "frenzy", name: "Frenzy", desc: "Blood sings; hands blur", tree: "War Cries", tier: 2, type: "passive", maxRank: 10, passive: { atkSpd: 4, moveSpd: 2 } },
    { id: "warcry", name: "War Cry", desc: "A concussive bellow that staggers the horde", tree: "War Cries", tier: 2, type: "active", maxRank: 5, req: "shout", mana: 14, cooldownMs: 8000, baseMult: 1.0, rankMult: 0.15, synergies: [{ from: "shout", pct: 10 }] },
    { id: "bloodrage", name: "Blood Rage", desc: "Every wound you deal feeds you", tree: "War Cries", tier: 3, type: "passive", maxRank: 10, passive: { lifeSteal: 1, dmgPct: 4 } },
    { id: "t5_blood", name: "Blood of the Mountain", desc: "Kragmar's stone runs in your veins", tree: "Might", tier: 5, type: "passive", maxRank: 12, passive: { maxHp: 14 } },
    { id: "t5_edge", name: "Warlord's Edge", desc: "Ten thousand swings, distilled", tree: "Might", tier: 5, type: "passive", maxRank: 12, passive: { dmgPct: 5, crit: 1 } },
    { id: "t5_skin", name: "Skin of Kragmar", desc: "Weather, wars, and worse have tried", tree: "War Cries", tier: 5, type: "passive", maxRank: 12, passive: { armor: 4, allRes: 1 } },
    { id: "t5_voice", name: "Voice of War", desc: "Your shout arrives before your axe", tree: "War Cries", tier: 5, type: "passive", maxRank: 12, passive: { atkSpd: 2, dmg: 1 } },
    { id: "ks_immovable", name: "Immovable", desc: "The mountain does not flinch, and cannot be moved", tree: "Might", tier: 5, type: "passive", maxRank: 1, keystone: "Cannot be chilled or slowed" },
    // Carnage — the bleed & sustain brawler line (a hungrier, bloodier path than Might's burst)
    { id: "cleave", name: "Cleave", desc: "One swing, the whole front rank", tree: "Carnage", tier: 1, type: "active", maxRank: 5, mana: 7, cooldownMs: 1600, baseMult: 0.7, rankMult: 0.1, synergies: [{ from: "bash", pct: 6 }] },
    { id: "bloodlust", name: "Bloodlust", desc: "The smell of it quickens everything", tree: "Carnage", tier: 1, type: "passive", maxRank: 10, passive: { lifeSteal: 1, atkSpd: 3 } },
    { id: "rend", name: "Rend", desc: "A wound that keeps on giving", tree: "Carnage", tier: 2, type: "active", maxRank: 5, req: "cleave", mana: 9, cooldownMs: 3000, baseMult: 1.1, rankMult: 0.18, synergies: [{ from: "cleave", pct: 8 }, { from: "bash", pct: 4 }] },
    { id: "warpaint", name: "War Paint", desc: "Wear their blood where they can see it", tree: "Carnage", tier: 3, type: "passive", maxRank: 10, passive: { dmgPct: 5, crit: 1 } },
    { id: "t5_carnage", name: "Red Harvest", desc: "The field feeds the reaper", tree: "Carnage", tier: 5, type: "passive", maxRank: 12, passive: { lifeSteal: 1, dmgPct: 3 } },
  ],
  rogue: [
    { id: "multishot", name: "Multishot", desc: "One draw, a fan of death", tree: "Archery", tier: 1, type: "active", maxRank: 5, mana: 10, cooldownMs: 2000, baseMult: 0.9, rankMult: 0.1 },
    { id: "precision", name: "Precision", desc: "Aim for the gaps in the armor", tree: "Archery", tier: 1, type: "passive", maxRank: 10, passive: { crit: 2 } },
    { id: "coldarrow", name: "Frost Arrow", desc: "An arrow of winter that chills the marrow", tree: "Archery", tier: 2, type: "active", maxRank: 5, req: "multishot", mana: 9, cooldownMs: 2500, baseMult: 1.3, rankMult: 0.2, synergies: [{ from: "multishot", pct: 7 }] },
    { id: "pierce", name: "Impaling Shot", desc: "Through one, through all", tree: "Archery", tier: 3, type: "active", maxRank: 5, req: "coldarrow", mana: 12, cooldownMs: 4000, baseMult: 1.1, rankMult: 0.2, synergies: [{ from: "coldarrow", pct: 8 }] },
    { id: "sharpshot", name: "Sharpshooter", desc: "Faster hands, deadlier arrows", tree: "Archery", tier: 3, type: "passive", maxRank: 10, passive: { dmgPct: 5, atkSpd: 2 } },
    { id: "vengeance", name: "Rain of Vengeance", desc: "Blot out the sky", tree: "Archery", tier: 4, type: "ultimate", maxRank: 5, req: "pierce", mana: 28, cooldownMs: 22000, baseMult: 1.2, rankMult: 0.25, synergies: [{ from: "pierce", pct: 10 }] },
    { id: "dash", name: "Dash", desc: "Be somewhere else", tree: "Shadow", tier: 1, type: "active", maxRank: 5, mana: 8, cooldownMs: 4000 },
    { id: "evasion", name: "Evasion", desc: "They cannot kill what they cannot touch", tree: "Shadow", tier: 2, type: "passive", maxRank: 10, passive: { dodge: 2, moveSpd: 2 } },
    { id: "envenom", name: "Envenom", desc: "A coating of something unpleasant", tree: "Shadow", tier: 3, type: "passive", maxRank: 10, passive: { dmg: 3 } },
    { id: "t5_patience", name: "Deadeye's Patience", desc: "The shot that waits is the shot that lands", tree: "Archery", tier: 5, type: "passive", maxRank: 12, passive: { crit: 2 } },
    { id: "t5_quiver", name: "Quiver of Hours", desc: "You have never once run out", tree: "Archery", tier: 5, type: "passive", maxRank: 12, passive: { atkSpd: 2, dmgPct: 3 } },
    { id: "t5_nowhere", name: "Nowhere Twice", desc: "They aim where you were", tree: "Shadow", tier: 5, type: "passive", maxRank: 12, passive: { dodge: 2, moveSpd: 1 } },
    { id: "t5_cuts", name: "A Thousand Cuts", desc: "None of them individually matters. That's the trick.", tree: "Shadow", tier: 5, type: "passive", maxRank: 12, passive: { dmg: 2, dmgPct: 2 } },
    { id: "ks_lethality", name: "Lethality", desc: "When you find the gap, drive everything through it", tree: "Shadow", tier: 5, type: "passive", maxRank: 1, keystone: "Critical hits deal ×2.5 instead of ×2" },
    // Venom — traps & attrition, a patient area-denial path beside Archery (burst) and Shadow (mobility)
    { id: "caltrops", name: "Caltrops", desc: "The ground itself turns on them", tree: "Venom", tier: 1, type: "active", maxRank: 5, mana: 8, cooldownMs: 3500, baseMult: 0.4, rankMult: 0.06, synergies: [{ from: "multishot", pct: 4 }] },
    { id: "toxin", name: "Toxin", desc: "A little something on every edge", tree: "Venom", tier: 1, type: "passive", maxRank: 10, passive: { dmg: 2, crit: 1 } },
    { id: "noxious", name: "Noxious Cloud", desc: "A breath the whole room comes to share", tree: "Venom", tier: 2, type: "active", maxRank: 5, req: "caltrops", mana: 12, cooldownMs: 5000, baseMult: 0.5, rankMult: 0.08, synergies: [{ from: "caltrops", pct: 8 }, { from: "toxin", pct: 4 }] },
    { id: "gangrene", name: "Gangrene", desc: "It spreads faster than they can run", tree: "Venom", tier: 3, type: "passive", maxRank: 10, passive: { dmgPct: 5, crit: 1 } },
    { id: "t5_venom", name: "The Long Poison", desc: "Patience is the deadliest toxin", tree: "Venom", tier: 5, type: "passive", maxRank: 12, passive: { dmg: 2, dmgPct: 3 } },
  ],
  sorcerer: [
    { id: "chain", name: "Chain Lightning", desc: "Lightning that hungers for company", tree: "Elements", tier: 1, type: "active", maxRank: 5, mana: 14, cooldownMs: 2500, baseMult: 1.0, rankMult: 0.15, synergies: [{ from: "frostnova", pct: 6 }] },
    { id: "warmth", name: "Warmth", desc: "The fire within never gutters", tree: "Arcane", tier: 1, type: "passive", maxRank: 10, passive: { manaRegen: 1 } },
    { id: "frostnova", name: "Frost Nova", desc: "A ring of killing cold", tree: "Elements", tier: 2, type: "active", maxRank: 5, req: "chain", mana: 15, cooldownMs: 5000, baseMult: 0.8, rankMult: 0.15, synergies: [{ from: "chain", pct: 7 }] },
    { id: "firewall", name: "Firewall", desc: "Paint the floor with flame", tree: "Elements", tier: 3, type: "active", maxRank: 5, req: "frostnova", mana: 18, cooldownMs: 7000, baseMult: 0.5, rankMult: 0.1, synergies: [{ from: "chain", pct: 6 }] },
    { id: "meteor", name: "Meteor", desc: "Call down the burning sky", tree: "Elements", tier: 4, type: "ultimate", maxRank: 5, req: "firewall", mana: 32, cooldownMs: 24000, baseMult: 3.5, rankMult: 0.5, synergies: [{ from: "firewall", pct: 10 }] },
    { id: "teleport", name: "Teleport", desc: "Space is a suggestion", tree: "Arcane", tier: 1, type: "active", maxRank: 5, mana: 10, cooldownMs: 3000 },
    { id: "attunement", name: "Arcane Attunement", desc: "The well runs deeper", tree: "Arcane", tier: 2, type: "passive", maxRank: 10, passive: { maxMana: 8, cdr: 1 } },
    { id: "archon", name: "Archon", desc: "Power beyond the flesh", tree: "Arcane", tier: 3, type: "passive", maxRank: 10, passive: { dmgPct: 4, maxMana: 4 } },
    { id: "t5_stormheart", name: "Stormheart", desc: "The weather answers to you now", tree: "Elements", tier: 5, type: "passive", maxRank: 12, passive: { dmgPct: 5 } },
    { id: "t5_frost", name: "Killing Frost", desc: "Cold enough to find the gaps in anything", tree: "Elements", tier: 5, type: "passive", maxRank: 12, passive: { crit: 2 } },
    { id: "t5_well", name: "Bottomless Well", desc: "The well was never the limit. You were.", tree: "Arcane", tier: 5, type: "passive", maxRank: 12, passive: { maxMana: 10, manaRegen: 0.5 } },
    { id: "t5_dilation", name: "Time Dilation", desc: "Everyone else is simply slow", tree: "Arcane", tier: 5, type: "passive", maxRank: 12, passive: { cdr: 1, atkSpd: 1 } },
    { id: "ks_unraveling", name: "Unraveling", desc: "Every ward is just a knot you haven't undone yet", tree: "Elements", tier: 5, type: "passive", maxRank: 1, keystone: "Your attacks ignore an extra 25% of monster resistance" },
    // Winter — a dedicated cold spec beside Elements (mixed) and Arcane (utility): chill, control, attrition
    { id: "iceshard", name: "Ice Shard", desc: "A splinter of the deep cold", tree: "Winter", tier: 1, type: "active", maxRank: 5, mana: 6, cooldownMs: 850, baseMult: 0.5, rankMult: 0.1, synergies: [{ from: "blizzard", pct: 5 }] },
    { id: "frostarmor", name: "Frost Armor", desc: "Cold enough to turn a blade", tree: "Winter", tier: 1, type: "passive", maxRank: 10, passive: { armor: 2, allRes: 1 } },
    { id: "blizzard", name: "Blizzard", desc: "Bring the whole storm down on them", tree: "Winter", tier: 3, type: "active", maxRank: 5, req: "iceshard", mana: 20, cooldownMs: 7000, baseMult: 0.55, rankMult: 0.1, synergies: [{ from: "iceshard", pct: 8 }] },
    { id: "coldmastery", name: "Cold Mastery", desc: "Find the cold that lives in everything", tree: "Winter", tier: 3, type: "passive", maxRank: 8, passive: { penetration: 3 } },
    { id: "t5_winter", name: "Endless Winter", desc: "The season that forgot to turn", tree: "Winter", tier: 5, type: "passive", maxRank: 12, passive: { dmgPct: 4, crit: 1 } },
  ],
  paladin: [
    { id: "smite", name: "Smite", desc: "A shield-blow that leaves them reeling", tree: "Combat", tier: 1, type: "active", maxRank: 5, mana: 6, cooldownMs: 1400, baseMult: 1.4, rankMult: 0.2 },
    { id: "devotion", name: "Devotion", desc: "The body is a temple; fortify it", tree: "Combat", tier: 1, type: "passive", maxRank: 10, passive: { maxHp: 8, armor: 2 } },
    { id: "zeal", name: "Zeal", desc: "Three strikes in the space of one breath", tree: "Combat", tier: 2, type: "active", maxRank: 5, req: "smite", mana: 10, cooldownMs: 2600, baseMult: 0.75, rankMult: 0.1, synergies: [{ from: "smite", pct: 8 }] },
    { id: "hammers", name: "Hammer of Faith", desc: "Holy steel in every direction", tree: "Combat", tier: 3, type: "active", maxRank: 5, req: "zeal", mana: 14, cooldownMs: 3200, baseMult: 1.0, rankMult: 0.15, synergies: [{ from: "zeal", pct: 7 }] },
    { id: "fistofheavens", name: "Judgment", desc: "The sky passes judgment", tree: "Combat", tier: 4, type: "ultimate", maxRank: 5, req: "hammers", mana: 30, cooldownMs: 22000, baseMult: 3.2, rankMult: 0.5, synergies: [{ from: "hammers", pct: 10 }] },
    { id: "prayer", name: "Prayer", desc: "Mend the wounds of everyone beside you", tree: "Auras", tier: 1, type: "active", maxRank: 5, mana: 12, cooldownMs: 9000, baseMult: 0.8, rankMult: 0.15 },
    { id: "resolve", name: "Resolve", desc: "Faith, worn as armor", tree: "Auras", tier: 2, type: "passive", maxRank: 10, passive: { allRes: 2, armor: 1 } },
    { id: "fervor", name: "Fervor", desc: "Righteousness quickens the hand", tree: "Auras", tier: 3, type: "passive", maxRank: 10, passive: { atkSpd: 3, dmgPct: 3 } },
    { id: "t5_crusade", name: "Crusade Without End", desc: "You stopped counting the miles at Zerath", tree: "Combat", tier: 5, type: "passive", maxRank: 12, passive: { dmgPct: 4, atkSpd: 1 } },
    { id: "t5_anvil", name: "The Anvil", desc: "Let them break themselves upon you", tree: "Combat", tier: 5, type: "passive", maxRank: 12, passive: { armor: 4, maxHp: 8 } },
    { id: "t5_aegisfaith", name: "Aegis of Faith", desc: "Fire, frost, and lightning read the same scripture", tree: "Auras", tier: 5, type: "passive", maxRank: 12, passive: { allRes: 2 } },
    { id: "t5_everlasting", name: "Light Everlasting", desc: "The lamp that outlasts the night", tree: "Auras", tier: 5, type: "passive", maxRank: 12, passive: { maxHp: 10, manaRegen: 0.3 } },
    { id: "ks_bulwark", name: "Bulwark", desc: "Faith is a wall, and you are well-built", tree: "Combat", tier: 5, type: "passive", maxRank: 1, keystone: "While above 60% life, take 20% less damage" },
    // Retribution — a holy-fire offense beside Combat (melee) and Auras (support): burn crowds, smash the lone foe
    { id: "holyfire", name: "Holy Fire", desc: "Burn the wicked from where you stand", tree: "Retribution", tier: 1, type: "active", maxRank: 5, mana: 9, cooldownMs: 2200, baseMult: 0.7, rankMult: 0.12, synergies: [{ from: "smite", pct: 5 }] },
    { id: "conviction", name: "Conviction", desc: "Doubt is a luxury of the living", tree: "Retribution", tier: 1, type: "passive", maxRank: 10, passive: { dmgPct: 3, allRes: 1 } },
    { id: "holywrath", name: "Holy Wrath", desc: "One blow, and the light behind it", tree: "Retribution", tier: 3, type: "active", maxRank: 5, req: "holyfire", mana: 14, cooldownMs: 3200, baseMult: 1.5, rankMult: 0.22, synergies: [{ from: "holyfire", pct: 7 }, { from: "smite", pct: 4 }] },
    { id: "zealotry", name: "Zealotry", desc: "Faith repaid in kind", tree: "Retribution", tier: 3, type: "passive", maxRank: 10, passive: { thorns: 2, dmgPct: 2 } },
    { id: "t5_retribution", name: "Wrath Everlasting", desc: "The verdict was passed long ago", tree: "Retribution", tier: 5, type: "passive", maxRank: 12, passive: { dmgPct: 4, atkSpd: 1 } },
  ],
  necromancer: [
    { id: "teeth", name: "Teeth", desc: "A fan of splintered bone", tree: "Poison & Bone", tier: 1, type: "active", maxRank: 5, mana: 9, cooldownMs: 2000, baseMult: 0.6, rankMult: 0.08 },
    { id: "bonearmor", name: "Bone Armor", desc: "The dead protect their shepherd", tree: "Poison & Bone", tier: 1, type: "passive", maxRank: 10, passive: { armor: 3, maxHp: 4 } },
    { id: "decrepify", name: "Wither", desc: "A curse that makes flesh remember its age", tree: "Poison & Bone", tier: 2, type: "active", maxRank: 5, req: "teeth", mana: 12, cooldownMs: 6000, baseMult: 0.4, rankMult: 0.08, synergies: [{ from: "teeth", pct: 6 }] },
    { id: "poisonnova", name: "Poison Nova", desc: "A breath the whole room regrets", tree: "Poison & Bone", tier: 3, type: "active", maxRank: 5, req: "decrepify", mana: 16, cooldownMs: 6000, baseMult: 1.0, rankMult: 0.15, synergies: [{ from: "decrepify", pct: 8 }] },
    { id: "skeleton", name: "Raise Skeleton", desc: "The floor is full of volunteers", tree: "Summoning", tier: 1, type: "active", maxRank: 5, mana: 15, cooldownMs: 6000, baseMult: 0.4, rankMult: 0.08 },
    { id: "deathpact", name: "Death's Bargain", desc: "Every ending feeds you", tree: "Summoning", tier: 2, type: "passive", maxRank: 10, passive: { manaRegen: 0.6, dmgPct: 3 } },
    { id: "mastery", name: "Skeleton Mastery", desc: "Better bones, sharper service", tree: "Summoning", tier: 3, type: "passive", maxRank: 10, passive: { dmgPct: 4, maxMana: 5 } },
    { id: "army", name: "Army of the Dead", desc: "All of them. At once.", tree: "Summoning", tier: 4, type: "ultimate", maxRank: 5, req: "skeleton", mana: 32, cooldownMs: 26000, baseMult: 0.6, rankMult: 0.1, synergies: [{ from: "skeleton", pct: 10 }] },
    { id: "t5_ossuary", name: "Ossuary King", desc: "Every skeleton in the world is technically yours", tree: "Poison & Bone", tier: 5, type: "passive", maxRank: 12, passive: { dmg: 2, maxMana: 5 } },
    { id: "t5_plague", name: "Plague Eternal", desc: "It never burned out. It just got patient.", tree: "Poison & Bone", tier: 5, type: "passive", maxRank: 12, passive: { dmgPct: 5 } },
    { id: "t5_pact", name: "Deathlord's Pact", desc: "Death signed. You witnessed.", tree: "Summoning", tier: 5, type: "passive", maxRank: 12, passive: { maxHp: 8, manaRegen: 0.4 } },
    { id: "t5_legion", name: "The Grave Legion", desc: "The dead do not desert", tree: "Summoning", tier: 5, type: "passive", maxRank: 12, passive: { dmgPct: 3, maxMana: 8 } },
    { id: "ks_siphon", name: "Soul Siphon", desc: "Every death feeds the one who dealt it", tree: "Poison & Bone", tier: 5, type: "passive", maxRank: 1, keystone: "Each kill restores 3% of your life and mana" },
    // Blood Magic — a self-sustaining caster line beside Poison & Bone (attrition) and Summoning (pets)
    { id: "bloodspear", name: "Blood Spear", desc: "A lance drawn from the wound of the world", tree: "Blood Magic", tier: 1, type: "active", maxRank: 5, mana: 8, cooldownMs: 1500, baseMult: 0.6, rankMult: 0.1, synergies: [{ from: "teeth", pct: 5 }] },
    { id: "bloodwarden", name: "Blood Warden", desc: "The blood remembers who spilled it", tree: "Blood Magic", tier: 1, type: "passive", maxRank: 10, passive: { maxHp: 8, lifeSteal: 1 } },
    { id: "bloodboil", name: "Blood Boil", desc: "Bring the blood in them to a rolling boil", tree: "Blood Magic", tier: 3, type: "active", maxRank: 5, req: "bloodspear", mana: 18, cooldownMs: 5500, baseMult: 1.0, rankMult: 0.16, synergies: [{ from: "bloodspear", pct: 8 }, { from: "decrepify", pct: 5 }] },
    { id: "hemorrhage", name: "Hemorrhage", desc: "Some wounds simply refuse to close", tree: "Blood Magic", tier: 3, type: "passive", maxRank: 10, passive: { dmgPct: 5, lifeSteal: 1 } },
    { id: "t5_sanguine", name: "Sanguine Ascendant", desc: "Master of the red hour", tree: "Blood Magic", tier: 5, type: "passive", maxRank: 12, passive: { dmgPct: 4, maxHp: 6 } },
  ],
  druid: [
    { id: "firestorm", name: "Firestorm", desc: "Ribbons of flame race along the ground", tree: "Elemental", tier: 1, type: "active", maxRank: 5, mana: 8, cooldownMs: 2500, baseMult: 0.45, rankMult: 0.08 },
    { id: "oakheart", name: "Heart of Oak", desc: "Roots run deep; so does the life in you", tree: "Wild", tier: 1, type: "passive", maxRank: 10, passive: { maxHp: 10 } },
    { id: "twister", name: "Twister", desc: "A blade of wind that carves a path", tree: "Elemental", tier: 2, type: "active", maxRank: 5, req: "firestorm", mana: 11, cooldownMs: 3000, baseMult: 0.9, rankMult: 0.15, synergies: [{ from: "firestorm", pct: 7 }] },
    { id: "volcano", name: "Volcano", desc: "Ask the earth for its opinion", tree: "Elemental", tier: 3, type: "active", maxRank: 5, req: "twister", mana: 17, cooldownMs: 6500, baseMult: 1.4, rankMult: 0.2, synergies: [{ from: "twister", pct: 8 }] },
    { id: "hurricane", name: "Hurricane", desc: "Wear the storm like a cloak", tree: "Elemental", tier: 4, type: "ultimate", maxRank: 5, req: "volcano", mana: 30, cooldownMs: 24000, baseMult: 0.5, rankMult: 0.1, synergies: [{ from: "volcano", pct: 10 }] },
    { id: "barkskin", name: "Barkskin", desc: "Let them chew on that", tree: "Wild", tier: 1, type: "passive", maxRank: 10, passive: { armor: 2, thorns: 1 } },
    { id: "werewolf", name: "Werewolf", desc: "Become the thing the dark is afraid of", tree: "Wild", tier: 2, type: "active", maxRank: 5, mana: 12, cooldownMs: 14000 },
    { id: "hunger", name: "Feral Hunger", desc: "The wolf is always starving", tree: "Wild", tier: 3, type: "passive", maxRank: 10, passive: { lifeSteal: 1, atkSpd: 2 } },
    { id: "t5_stormcall", name: "Stormcaller's Patience", desc: "The sky owes you several favors", tree: "Elemental", tier: 5, type: "passive", maxRank: 12, passive: { dmgPct: 4, cdr: 1 } },
    { id: "t5_wildfire", name: "Wildfire", desc: "It spreads because you let it", tree: "Elemental", tier: 5, type: "passive", maxRank: 12, passive: { crit: 2 } },
    { id: "t5_weald", name: "Heart of the Weald", desc: "Older than the town, older than the war", tree: "Wild", tier: 5, type: "passive", maxRank: 12, passive: { maxHp: 12 } },
    { id: "t5_oldshape", name: "The Old Shape", desc: "The wolf remembers what you keep forgetting", tree: "Wild", tier: 5, type: "passive", maxRank: 12, passive: { atkSpd: 2, armor: 2 } },
    { id: "ks_primal", name: "Primal Fury", desc: "The shape was never a costume — it is what you are", tree: "Wild", tier: 5, type: "passive", maxRank: 1, keystone: "In Werewolf form, +30% damage and attack speed" },
    // Spirits — a summoner/beastmaster path beside Elemental (nukes) and Wild (shapeshift): fight with a pack
    { id: "spiritwolf", name: "Spirit Wolf", desc: "Call one of the old pack to your side", tree: "Spirits", tier: 1, type: "active", maxRank: 5, mana: 10, cooldownMs: 4000, baseMult: 0.6, rankMult: 0.1 },
    { id: "oaksage", name: "Oak Sage", desc: "An old spirit lends its stubborn vigor", tree: "Spirits", tier: 1, type: "passive", maxRank: 10, passive: { maxHp: 10, manaRegen: 0.3 } },
    { id: "spiritpack", name: "Call the Pack", desc: "Not one wolf. All of them.", tree: "Spirits", tier: 3, type: "active", maxRank: 5, req: "spiritwolf", mana: 22, cooldownMs: 9000, baseMult: 0.7, rankMult: 0.1, synergies: [{ from: "spiritwolf", pct: 8 }] },
    { id: "kinship", name: "Kinship", desc: "What you feel, the pack feels", tree: "Spirits", tier: 3, type: "passive", maxRank: 10, passive: { dmgPct: 4, lifeSteal: 1 } },
    { id: "t5_spirits", name: "The Endless Pack", desc: "The wood always has more sons", tree: "Spirits", tier: 5, type: "passive", maxRank: 12, passive: { maxHp: 10, dmgPct: 2 } },
  ],
};

// werewolf form tuning
export const WOLF_DURATION_MS = 20000;
export const WOLF_DURATION_PER_RANK_MS = 4000;
export const WOLF_DMG_MULT = 1.3;
export const WOLF_SPEED_BONUS = 0.15;
export const WOLF_ATTACK: MeleeAttack = { type: "melee", range: 50, arcDeg: 110, dmg: [11, 17], cooldownMs: 420 };

// necromancer pets
export const PET_DURATION_MS = 45000;
export const PET_SPEED = 150;
export const PET_ATTACK_RANGE = 34;
export const PET_ATTACK_MS = 900;
export const PET_SEEK_RANGE = 320;
export const PET_FOLLOW_DIST = 60;
export function petCapFor(rank: number): number {
  return Math.min(3, 1 + Math.floor(rank / 2));
}

// curse & misc class tuning
export const DECREPIFY_RADIUS = 110;
export const DECREPIFY_MS = 5000;
export const DECREPIFY_VULN = 1.25; // cursed monsters take 25% more damage
export const POISONNOVA_RADIUS = 115;
export const TEETH_COUNT = 5;
export const ZEAL_HITS = 3;
export const HAMMER_COUNT = 5;
export const HAMMER_SPEED = 260;
export const FIST_RADIUS = 95;
export const PRAYER_RADIUS = 180;
export const HURRICANE_MS = 6000;
export const HURRICANE_RADIUS = 105;

export function skillById(cls: ClassName, id: string): SkillNode | null {
  return SKILL_TREES[cls]?.find((s) => s.id === id) ?? null;
}

export type SkillKey = "1" | "2" | "3" | "4" | "5" | "6";
export const SKILL_KEYS: SkillKey[] = ["1", "2", "3", "4", "5", "6"];

// can this hero put a point into this node right now?
export function canAllocSkill(
  node: SkillNode,
  skills: Record<string, number>,
  level: number,
  points: number
): boolean {
  if (points <= 0) return false;
  if ((skills[node.id] ?? 0) >= node.maxRank) return false;
  const tier = Math.min(node.tier, TIER_LEVELS.length - 1);
  if (level < TIER_LEVELS[tier]) return false;
  if (node.req && (skills[node.req] ?? 0) <= 0) return false;
  return true;
}

// damage multiplier of an active at a given rank, synergies included
export function skillDamageMult(node: SkillNode, skills: Record<string, number>): number {
  const rank = skills[node.id] ?? 0;
  if (rank <= 0 || node.baseMult === undefined) return 1;
  let mult = node.baseMult + (node.rankMult ?? 0) * (rank - 1);
  // each synergy source stacks additively into the multiplier — investing across the web pays off
  for (const s of node.synergies ?? []) {
    mult *= 1 + ((skills[s.from] ?? 0) * s.pct) / 100;
  }
  return mult;
}

// human-readable summary of what a node gives per rank (for tooltips)
export function skillRankLine(node: SkillNode): string {
  if (node.passive) {
    return Object.entries(node.passive)
      .map(([k, v]) => `+${v} ${k}/rank`)
      .join(", ");
  }
  if (node.baseMult !== undefined) {
    return `${Math.round(node.baseMult * 100)}% weapon damage, +${Math.round((node.rankMult ?? 0) * 100)}%/rank`;
  }
  return "";
}

// level-5 skill tuning
export const LEAP_RANGE = 180;
export const LEAP_RADIUS = 70;
export const LEAP_MULT = 1.2;
export const LEAP_KNOCKBACK = 40;
export const PIERCE_LENGTH = 300;
export const PIERCE_WIDTH = 34;
export const PIERCE_MULT = 1.1;
export const FROSTNOVA_RADIUS = 95;
export const FROSTNOVA_MULT = 0.8;
export const FROSTNOVA_SLOW = 0.5;
export const FROSTNOVA_SLOW_MS = 3000;

// new-school skill tuning
export const BASH_RANGE = 60;
export const BASH_STUN_MS = 1000;
export const WARCRY_RADIUS = 90;
export const WARCRY_STUN_MS = 800;
export const ANCIENTS_RADIUS = 140;
export const ANCIENTS_STUN_MS = 1500;
export const COLDARROW_SPEED = 420;
export const COLDARROW_CHILL_MS = 2500;
export const VENGEANCE_RADIUS = 120;
export const VENGEANCE_WAVES = 3;
export const VENGEANCE_WAVE_MS = 500;
export const FIREWALL_LENGTH = 140;
export const FIREWALL_DURATION_MS = 4000;
export const FIREWALL_TICK_MS = 500;
export const METEOR_DELAY_MS = 1000;
export const METEOR_RADIUS = 110;
export const METEOR_BURN_MS = 3000;
export const SHOUT_RANK_MS = 2000; // Battle Shout lasts longer per rank

export const WHIRLWIND_RADIUS = 80;
export const WHIRLWIND_MULT = 1.5;
export const SHOUT_DURATION_MS = 8000;
export const SHOUT_DMG_MULT = 1.5;
export const MULTISHOT_COUNT = 5;
export const MULTISHOT_SPREAD_DEG = 12;
export const DASH_RANGE = 130;
export const CHAIN_CAST_RANGE = 260;
export const CHAIN_JUMP_RANGE = 110;
export const CHAIN_FALLOFF = [1, 0.85, 0.7, 0.55];
export const TELEPORT_RANGE = 220;
// legendary-power tuning (Legendary Powers II)
export const CHAIN_FORK_JUMPS = 2; // Stormfork: extra chain jumps
export const CHAIN_FORK_STUN_MS = 700; // …and how long each struck foe is stunned
export const RIFT_RADIUS = 56; // Riftwalk: the burning rift left at each teleport end
export const RIFT_DURATION_MS = 2600;
export const LEAP_QUAKE_MS = 1600; // Aftershock: the ground keeps rupturing after you land
export const LEAP_QUAKE_MULT = 0.2;
export const WARCRY_SHRED_MS = 4000; // Sundering Roar: how long the guard stays shredded
export const WARCRY_KNOCKBACK = 44;
export const FROST_SHATTER_RADIUS = 72; // Killing Frost: the cold nova a Frost Arrow shatters into
export const FROST_SHATTER_MULT = 0.55;
export const FROST_SHATTER_CHILL_MS = 1400;
export const PIERCE_RICOCHET_ANGLE = 0.3; // Ricochet: the angle of the second bolt's lane
export const ZEAL_NOVA_EVERY = 5; // Holy Fervor: every Nth Zeal cast detonates
export const ZEAL_NOVA_RADIUS = 96;
export const ZEAL_NOVA_MULT = 1.3;
export const PRAYER_SHIELD_MS = 5000; // Sanctuary: the party shield lasts this long or until it eats a blow
export const POISON_POOL_MS = 3200; // Contagion: the lingering plague pool
export const POISON_POOL_MULT = 0.2;
export const WITHER_SPREAD_RADIUS = 130; // Plaguecarrier: how far the curse leaps from a corpse
export const VOLCANO_TWIN_DELAY_MS = 420; // Cataclysm: the second eruption's delay
