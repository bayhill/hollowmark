// MERCENARIES: Captain Maren's Wardens — the archetypes she hires out, their gear
// slots, levelling, and the cost of raising one who fell. A leaf; its only outside
// reference is the Element type, which erases at compile time.
import type { Element } from "./index";

// --- mercenaries: Maren's rogues, hired blades that walk beside you ---

export const MERC_SLOTS = ["weapon", "helm", "chest"] as const; // D2 austerity: no jewelry on the payroll
export type MercSlot = (typeof MERC_SLOTS)[number];

export interface MercArchetype {
  id: string;
  title: string;
  blurb: string;
  element: Element | "";
  dmgMult: number;
  crit: number; // %
  cooldownMs: number;
}

// how a hireling fights: looses arrows, hurls spells, or wades in with steel
export type MercAttackStyle = "arrow" | "spell" | "melee";

// A hiring hall: one per act, each offering a different school of companion.
// One merc at a time (D2 austerity) — signing a new class dismisses the old.
export interface MercClass {
  id: string; // "rogue" | "mage" | "barbarian" | "paladin"
  className: string; // "Rogue" — shown in labels and messages
  npcKey: "maren" | "loremaster" | "warband" | "sanctum"; // which TOWN tile they keep
  npcName: string; // the recruiter's full name (shrine label)
  npcTitle: string; // storefront banner, e.g. "MAREN'S ROGUES"
  npcColor: number; // accent for shrine glow + hire panel trim
  unlockAct: number; // road east that must be open before they'll serve you
  attackStyle: MercAttackStyle;
  projKind: string; // client visual for a ranged shot ("arrow" | "bolt"); "" for melee
  hpMult: number; // barbarians soak, mages are frail
  archetypes: MercArchetype[];
  names: string[];
}

export const MERC_ARCHETYPES: MercArchetype[] = [
  { id: "fire", title: "Ember Archer", blurb: "her arrows arrive burning", element: "fire", dmgMult: 1.18, crit: 5, cooldownMs: 1250 },
  { id: "cold", title: "Frost Archer", blurb: "her arrows slow what they touch", element: "cold", dmgMult: 0.95, crit: 5, cooldownMs: 1250 },
  { id: "vicious", title: "Deadeye", blurb: "she aims for the throat", element: "", dmgMult: 1.0, crit: 25, cooldownMs: 1100 },
];

// the Rogue sisterhood's roll call (D1/D2 flavor)
export const MERC_NAMES = [
  "Ashwen", "Briala", "Carys", "Deryn", "Elsbeth", "Fenna",
  "Isolde", "Maura", "Nyssa", "Rowena", "Sable", "Tamsin",
];

export const MERC_CLASSES: MercClass[] = [
  {
    id: "rogue", className: "Rogue", npcKey: "maren",
    npcName: "Captain Maren of the Wardens", npcTitle: "MAREN'S ROGUES",
    npcColor: 0xc03848, unlockAct: 1, attackStyle: "arrow", projKind: "arrow", hpMult: 1.0,
    archetypes: MERC_ARCHETYPES, names: MERC_NAMES,
  },
  {
    id: "mage", className: "Mage", npcKey: "loremaster",
    npcName: "Orsavio, the Exiled Magus", npcTitle: "ORSAVIO'S ACOLYTES",
    npcColor: 0x6a6ad8, unlockAct: 2, attackStyle: "spell", projKind: "bolt", hpMult: 0.82,
    archetypes: [
      { id: "fire", title: "Pyromancer", blurb: "his bolts detonate in cinders", element: "fire", dmgMult: 1.22, crit: 5, cooldownMs: 1450 },
      { id: "cold", title: "Cryomancer", blurb: "his frost seizes the limbs", element: "cold", dmgMult: 1.0, crit: 5, cooldownMs: 1450 },
      { id: "light", title: "Stormcaller", blurb: "lightning leaps from his fingers", element: "light", dmgMult: 1.08, crit: 8, cooldownMs: 1350 },
    ],
    names: ["Alaric", "Corvin", "Dain", "Ellara", "Fioran", "Isadora", "Malric", "Nerith", "Orin", "Sylas", "Thessaly", "Yorick"],
  },
  {
    id: "barbarian", className: "Barbarian", npcKey: "warband",
    npcName: "Hrothgar, Chief of the Fells", npcTitle: "HROTHGAR'S WARBAND",
    npcColor: 0xb06a2a, unlockAct: 3, attackStyle: "melee", projKind: "", hpMult: 1.45,
    archetypes: [
      { id: "vicious", title: "Reaver", blurb: "he opens throats with a wide arc", element: "", dmgMult: 1.28, crit: 12, cooldownMs: 950 },
      { id: "fire", title: "Warbringer", blurb: "his blade is wrapped in flame", element: "fire", dmgMult: 1.15, crit: 6, cooldownMs: 950 },
      { id: "cold", title: "Frostwolf", blurb: "his rune-etched axe drags the cold behind it", element: "cold", dmgMult: 1.1, crit: 6, cooldownMs: 950 },
    ],
    names: ["Brant", "Gunnar", "Harrek", "Korgan", "Magnus", "Rurik", "Thane", "Ulf", "Vargas", "Draka", "Sigrun", "Wren"],
  },
  {
    id: "paladin", className: "Paladin", npcKey: "sanctum",
    npcName: "Dame Iseult, the Last Vigil", npcTitle: "ISEULT'S SANCTUM",
    npcColor: 0xd8c46a, unlockAct: 4, attackStyle: "melee", projKind: "", hpMult: 1.28,
    archetypes: [
      { id: "vicious", title: "Templar", blurb: "she guards you with shield and mace", element: "", dmgMult: 1.18, crit: 8, cooldownMs: 950 },
      { id: "light", title: "Zealot", blurb: "her holy strikes crackle with light", element: "light", dmgMult: 1.14, crit: 10, cooldownMs: 850 },
      { id: "cold", title: "Sentinel", blurb: "her frozen ward slows the horde", element: "cold", dmgMult: 1.02, crit: 6, cooldownMs: 1050 },
    ],
    names: ["Aldous", "Bertram", "Caelan", "Doran", "Everard", "Godwin", "Lucan", "Percival", "Rainer", "Tristan", "Elowen", "Seraphine"],
  },
];

const MERC_CLASS_BY_ID = new Map(MERC_CLASSES.map((c) => [c.id, c]));
export function mercClassById(id: string | undefined | null): MercClass {
  return MERC_CLASS_BY_ID.get(id ?? "") ?? MERC_CLASSES[0];
}
// each recruiter keeps to ONE act: rogue in I, mage in II, barbarian in III,
// paladin in IV (and the Abyss borrows the last). Only that act's recruiter
// stands at the muster post; you hire that act's school, or revive whoever you
// already march with.
export function recruiterForAct(act: number): MercClass {
  const a = Math.min(Math.max(act, 1), 4);
  return MERC_CLASSES.find((c) => c.unlockAct === a) ?? MERC_CLASSES[0];
}
export const MERC_MELEE_RANGE = 46; // a barbarian must be on top of his quarry

export function mercHireCost(level: number): number {
  return 100 + 60 * (Math.max(1, level) - 1);
}
export function mercReviveCost(level: number): number {
  return 50 + 25 * (Math.max(1, level) - 1);
}
export function mercBaseHp(level: number): number {
  return 45 + 14 * (Math.max(1, level) - 1);
}
export function mercBaseDmg(level: number): [number, number] {
  const l = Math.max(1, level) - 1;
  return [Math.round(4 + 1.5 * l), Math.round(7 + 2.2 * l)];
}

export const MERC_ATTACK_RANGE = 240;
export const MERC_ENGAGE_RANGE = 300; // won't chase prey farther than this from her employer
export const MERC_FOLLOW_DIST = 80;
export const MERC_TELEPORT_DIST = 550; // lost sight of you? she finds you
export const MERC_SPEED = 155;
export const MERC_REGEN_PER_S = 4;
export const MERC_REGEN_DELAY_MS = 4000;
export const MERC_CHILL_MS = 1400; // cold rogue's arrows
