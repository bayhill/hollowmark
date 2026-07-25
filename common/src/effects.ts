// THE REASON LEGENDARIES FEEL LEGENDARY: unique effect definitions, the legendary
// skill-powers that rewrite a skill outright, the item base table, the affix pools, and
// the hand-designed fixed items.
//
// Depends only on types (Slot, Rarity, ClassName), imported with `import type` so this
// module initialises with no runtime dependency on index.ts. index.ts imports the data
// back out of here — a one-way edge, which is what keeps the graph acyclic.
import type { ClassName, Rarity, Slot } from "./index";
import type { ItemStats } from "./stats";

// --- unique effects: the reason legendaries feel legendary ---

export const EFFECTS: Record<string, { name: string; desc: string }> = {
  executioner: { name: "Executioner", desc: "+30% damage to enemies below half life" },
  frostnova_on_hit: { name: "Frostbite", desc: "8% chance on hit to unleash a frost nova" },
  chain_on_kill: { name: "Stormsoul", desc: "lightning erupts from slain enemies" },
  corpse_explosion: { name: "Detonation", desc: "slain enemies explode for fire damage" },
  gold_burst: { name: "Midas Touch", desc: "25% chance slain enemies burst into gold" },
  second_wind: { name: "Second Wind", desc: "heal 30% when struck below 25% life (60s cooldown)" },
  arcane_surge: { name: "Arcane Surge", desc: "kills restore 10 mana" },
  patriarch: { name: "Patriarch", desc: "+1 damage per character level" },
  knockback_shot: { name: "Gale Force", desc: "15% chance to knock enemies back" },
  // unique-tier: subtle, but the game plays differently
  giantslayer: { name: "Giantslayer", desc: "+25% damage to elites, champions and bosses" },
  bleed: { name: "Bloodletter", desc: "your hits open wounds that bleed for 45% more over 3s" },
  frost_armor: { name: "Frostplate", desc: "melee attackers are chilled by the blow" },
  mana_shield: { name: "Mana Shield", desc: "30% of damage taken drains mana instead of life" },
  deep_pockets: { name: "Bottomless Flask", desc: "25% chance potions aren't consumed" },
  hoarder: { name: "Golden Vigor", desc: "picking up gold heals 1 life per 10 gold" },
  vampiric_rush: { name: "Blood Rush", desc: "kills grant +25% move speed for 3s" },
  adrenaline: { name: "Adrenaline", desc: "taking a hit grants +25% move speed for 2s" },
  terror: { name: "Dread Presence", desc: "your kills terrify nearby monsters, slowing them" },
  // legendary-tier: dramatic
  twin_strike: { name: "Twin Strike", desc: "20% chance your hits strike twice" },
  berserk_low: { name: "Death Wish", desc: "+40% damage while below 35% life" },
  lightning_storm: { name: "Storm Herald", desc: "critical strikes call lightning down on another enemy" },
  aegis: { name: "Aegis", desc: "blocks ALL damage from one hit every 8 seconds" },
  // epic-tier: build-defining
  culling: { name: "Culling Blade", desc: "non-boss enemies below 20% life are executed outright" },
  deathless: { name: "Undying", desc: "cheat death — survive lethal damage at 1 life (90s cooldown)" },
  echo: { name: "Echo", desc: "25% chance skills incur no cooldown" },
  immolation: { name: "Immolation", desc: "nearby enemies burn every second you stand among them" },
  stormlord: { name: "Stormlord", desc: "every 6th attack unleashes chain lightning" },
};

// Legendary skill-powers REWRITE a specific skill (the D3-legendary / PoE-unique fantasy).
// An item carries a `power` id; the server reads p.powers.has(id) in that skill's handler.
// These are what make gear TRANSFORM a build rather than just add stats.
export const SKILL_POWERS: Record<string, { skill: string; name: string; desc: string }> = {
  meteor_twice: { skill: "meteor", name: "Twinned Meteor", desc: "Meteor falls a second time, moments later." },
  hammer_twin: { skill: "hammers", name: "Twin Hammers", desc: "Blessed Hammer conjures twice the blessed steel." },
  bone_legion: { skill: "skeleton", name: "Bone Legion", desc: "Raise Skeleton musters an extra warrior and commands a larger host." },
  whirl_rend: { skill: "whirlwind", name: "Rending Storm", desc: "Whirlwind reaps a wider circle and leaves the ground burning." },
  multi_volley: { skill: "multishot", name: "Endless Quiver", desc: "Multishot looses a far wider volley." },
  twister_swarm: { skill: "twister", name: "Tempest", desc: "Twister splits into three blades of wind." },
  // Legendary Powers II
  chain_fork: { skill: "chain", name: "Stormfork", desc: "Chain Lightning forks to two more foes and stuns everything it strikes." },
  teleport_rift: { skill: "teleport", name: "Riftwalk", desc: "Teleport tears a burning arcane rift at both ends that keeps searing for a few seconds." },
  leap_quake: { skill: "leap", name: "Aftershock", desc: "Leap Slam splits the ground where you land — a quake that keeps rupturing for a beat." },
  warcry_shred: { skill: "warcry", name: "Sundering Roar", desc: "War Cry shreds the guard off everything it staggers (they take more damage) and hurls the pack back." },
  frost_shatter: { skill: "coldarrow", name: "Killing Frost", desc: "Frost Arrow shatters on impact into a nova of cold." },
  pierce_ricochet: { skill: "pierce", name: "Ricochet", desc: "Impaling Shot splits — a second bolt caroms off into a parallel lane." },
  zeal_nova: { skill: "zeal", name: "Holy Fervor", desc: "Every fifth strike of Zeal detonates a nova of holy light." },
  prayer_aegis: { skill: "prayer", name: "Sanctuary", desc: "Prayer wraps the whole party in a shield that swallows the next blow each." },
  poison_lingering: { skill: "poisonnova", name: "Contagion", desc: "Poison Nova leaves a lingering plague pool that keeps eating the ground it covers." },
  wither_spread: { skill: "decrepify", name: "Plaguecarrier", desc: "A withered foe's death spreads the curse to everything around the corpse." },
  volcano_twin: { skill: "volcano", name: "Cataclysm", desc: "Volcano erupts a second time, just off-center, moments later." },
  werewolf_howl: { skill: "werewolf", name: "Pack Leader", desc: "Shifting to Werewolf calls a spirit wolf to hunt at your side." },
};
export const FROSTBITE_CHANCE = 0.08;
export const KNOCKBACK_CHANCE = 0.15;
export const SECOND_WIND_CD_MS = 60000;
// new-perk tuning
export const GIANTSLAYER_MULT = 1.25;
export const BLEED_FRACTION = 0.45; // of the triggering hit, over 3 ticks
export const BLEED_TICKS = 3;
export const BLEED_TICK_MS = 1000;
// Barbarian "Carnage" tree — a bleed & sustain brawling line (3rd tree)
export const CLEAVE_RANGE = 95; // forward sweep reach
export const REND_RANGE = 72; // the wounding strike's reach
export const REND_BLEED_FRACTION = 0.9; // of the strike, bled out over its ticks (reuses BLEED_TICK_MS cadence)
export const REND_BLEED_TICKS = 4;
// Rogue "Venom" tree — traps & lingering poison (3rd tree; reuses the ground-hazard system)
export const CALTROPS_RANGE = 200; // how far you can seed the trap field
export const CALTROPS_RADIUS = 60;
export const CALTROPS_MS = 4000;
export const CALTROPS_MULT = 0.16; // per-tick fraction of the skill's damage
export const NOXIOUS_RANGE = 240;
export const NOXIOUS_RADIUS = 95;
export const NOXIOUS_MS = 3600;
export const NOXIOUS_MULT = 0.22;
// Sorcerer "Winter" tree — a dedicated cold spec (3rd tree)
export const ICESHARD_SPEED = 380; // a fast, spammable frost bolt
export const ICESHARD_CHILL_MS = 1400; // chills what it strikes
export const BLIZZARD_RANGE = 260;
export const BLIZZARD_RADIUS = 100;
export const BLIZZARD_MS = 3400;
export const BLIZZARD_MULT = 0.24;
// Paladin "Retribution" tree — holy-fire striker (3rd tree)
export const HOLYFIRE_RADIUS = 92; // self-centered nova of holy flame
export const HOLYWRATH_RANGE = 72; // the heavy single strike's reach
export const HOLYWRATH_SPLASH = 62; // holy light spilling to those beside the victim
// Necromancer "Blood Magic" tree — a self-sustaining caster line (3rd tree)
export const BLOODSPEAR_LENGTH = 280; // a lance of congealed blood, through a line
export const BLOODSPEAR_WIDTH = 34;
export const BLOODBOIL_RANGE = 230;
export const BLOODBOIL_RADIUS = 88; // the blood in them, brought to a boil
// Druid "Spirits" tree — a summoner/beastmaster line (3rd tree; reuses the pet system)
export const SPIRIT_CAP = 4; // how many spirit wolves one druid may keep at once
export const SPIRITPACK_COUNT = 3; // wolves called by a single Call the Pack
export const MANA_SHIELD_FRACTION = 0.3;
export const DEEP_POCKETS_CHANCE = 0.25;
export const HOARDER_HEAL_PER_GOLD = 0.1;
export const RUSH_MS = 3000;
export const ADRENALINE_MS = 2000;
export const TERROR_RADIUS = 110;
export const TERROR_MS = 2000;
export const TWIN_STRIKE_CHANCE = 0.2;
export const TWIN_STRIKE_MULT = 0.6;
export const BERSERK_THRESHOLD = 0.35;
export const BERSERK_MULT = 1.4;
export const STORM_HERALD_MULT = 0.7;
export const AEGIS_CD_MS = 8000;
export const CULLING_THRESHOLD = 0.2;
export const DEATHLESS_CD_MS = 90000;
export const DEATHLESS_IMMUNE_MS = 2000;
export const ECHO_CHANCE = 0.25;
export const IMMOLATION_RADIUS = 75;
export const IMMOLATION_MULT = 0.15;
export const IMMOLATION_TICK_MS = 1000;
export const STORMLORD_EVERY = 6;

export const BASE_ITEMS: Record<string, { name: string; slot: Slot; minIlvl: number; implicit: ItemStats }> = {
  // weapons
  dagger: { name: "Dagger", slot: "weapon", minIlvl: 1, implicit: { dmg: 2, atkSpd: 5 } },
  shortsword: { name: "Short Sword", slot: "weapon", minIlvl: 1, implicit: { dmg: 3 } },
  bow: { name: "Hunting Bow", slot: "weapon", minIlvl: 2, implicit: { dmg: 4, atkSpd: 5 } },
  waraxe: { name: "War Axe", slot: "weapon", minIlvl: 2, implicit: { dmg: 5 } },
  morningstar: { name: "Morning Star", slot: "weapon", minIlvl: 3, implicit: { dmg: 6 } },
  warstaff: { name: "War Staff", slot: "weapon", minIlvl: 3, implicit: { dmg: 4, maxMana: 10 } },
  maul: { name: "Maul", slot: "weapon", minIlvl: 4, implicit: { dmg: 8 } },
  greatsword: { name: "Greatsword", slot: "weapon", minIlvl: 5, implicit: { dmg: 9 } },
  scythe: { name: "Reaper's Scythe", slot: "weapon", minIlvl: 6, implicit: { dmg: 10, lifeSteal: 2 } },
  greataxe: { name: "Great Axe", slot: "weapon", minIlvl: 5, implicit: { dmg: 8 } },
  // offhands
  buckler: { name: "Buckler", slot: "offhand", minIlvl: 1, implicit: { armor: 2 } },
  orb: { name: "Sorcerer's Orb", slot: "offhand", minIlvl: 2, implicit: { maxMana: 12 } },
  quiver: { name: "Quiver", slot: "offhand", minIlvl: 2, implicit: { atkSpd: 8 } },
  kiteshield: { name: "Kite Shield", slot: "offhand", minIlvl: 3, implicit: { armor: 3 } },
  tome: { name: "Tome of Secrets", slot: "offhand", minIlvl: 4, implicit: { maxMana: 15, cdr: 5 } },
  towershield: { name: "Tower Shield", slot: "offhand", minIlvl: 5, implicit: { armor: 5 } },
  // helms
  cap: { name: "Cap", slot: "helm", minIlvl: 1, implicit: { armor: 1 } },
  fullhelm: { name: "Full Helm", slot: "helm", minIlvl: 3, implicit: { armor: 2, maxHp: 5 } },
  greathelm: { name: "Great Helm", slot: "helm", minIlvl: 5, implicit: { armor: 4 } },
  crown: { name: "Crown", slot: "helm", minIlvl: 6, implicit: { armor: 2, goldFind: 15 } },
  // chests
  robe: { name: "Robe", slot: "chest", minIlvl: 1, implicit: { maxMana: 15 } },
  leather: { name: "Leather Armor", slot: "chest", minIlvl: 1, implicit: { armor: 2 } },
  studded: { name: "Studded Leather", slot: "chest", minIlvl: 2, implicit: { armor: 3 } },
  chainmail: { name: "Chain Mail", slot: "chest", minIlvl: 3, implicit: { armor: 4 } },
  plate: { name: "Plate Mail", slot: "chest", minIlvl: 5, implicit: { armor: 6 } },
  // class flavor
  scepter: { name: "War Scepter", slot: "weapon", minIlvl: 2, implicit: { dmg: 4, maxHp: 5 } },
  wand: { name: "Bone Wand", slot: "weapon", minIlvl: 2, implicit: { dmg: 3, maxMana: 8 } },
  club: { name: "Gnarled Club", slot: "weapon", minIlvl: 1, implicit: { dmg: 4 } },
  circlet: { name: "Circlet", slot: "helm", minIlvl: 4, implicit: { armor: 1, maxMana: 8 } },
  // deep-floor prestige bases
  warpike: { name: "War Pike", slot: "weapon", minIlvl: 8, implicit: { dmg: 12 } },
  colossusblade: { name: "Titan Blade", slot: "weapon", minIlvl: 11, implicit: { dmg: 15 } },
  bonehelm: { name: "Bone Helm", slot: "helm", minIlvl: 6, implicit: { armor: 3, maxMana: 6 } },
  sacredarmor: { name: "Sacred Armor", slot: "chest", minIlvl: 11, implicit: { armor: 9 } },
  // jewelry
  ring: { name: "Ring", slot: "ring", minIlvl: 1, implicit: {} },
  amulet: { name: "Amulet", slot: "amulet", minIlvl: 1, implicit: {} },
  // belts
  sash: { name: "Sash", slot: "belt", minIlvl: 1, implicit: { armor: 1 } },
  warbelt: { name: "War Belt", slot: "belt", minIlvl: 4, implicit: { armor: 2, maxHp: 8 } },
  girdle: { name: "Plated Girdle", slot: "belt", minIlvl: 6, implicit: { armor: 2, potionPower: 20 } },
  // boots
  boots: { name: "Leather Boots", slot: "boots", minIlvl: 1, implicit: { moveSpd: 5 } },
  greaves: { name: "Greaves", slot: "boots", minIlvl: 4, implicit: { armor: 2, moveSpd: 5 } },
  // gloves — the hands: quick to strike, and the classic home of attack speed
  gloves: { name: "Leather Gloves", slot: "gloves", minIlvl: 1, implicit: { atkSpd: 4 } },
  gauntlets: { name: "Gauntlets", slot: "gloves", minIlvl: 4, implicit: { armor: 2, atkSpd: 3 } },
  battlegloves: { name: "Battle Gauntlets", slot: "gloves", minIlvl: 8, implicit: { armor: 4, atkSpd: 4 } },
};

// exported now that index.ts lives in a different file — it rolls affixes from this table
export interface AffixDef {
  id: string;
  kind: "prefix" | "suffix";
  name: string;
  stat: keyof ItemStats;
  min: number;
  max: number;
  minIlvl?: number; // deeper floors unlock stronger tiers
  cls?: ClassName; // class-locked affix — goes into classBonus
  stat2?: keyof ItemStats; // some affixes roll a second stat
  min2?: number;
  max2?: number;
  flat?: boolean; // never ilvl-scale this affix's value (for +skills, penetration)
}

export const AFFIXES: AffixDef[] = [
  // damage tiers
  { id: "sharp", kind: "prefix", name: "Sharp", stat: "dmg", min: 1, max: 4 },
  { id: "brutal", kind: "prefix", name: "Brutal", stat: "dmg", min: 4, max: 9, minIlvl: 5 },
  { id: "vicious", kind: "prefix", name: "Vicious", stat: "dmgPct", min: 5, max: 20 },
  { id: "cruel", kind: "prefix", name: "Cruel", stat: "dmgPct", min: 18, max: 40, minIlvl: 4 },
  { id: "merciless", kind: "prefix", name: "Merciless", stat: "dmgPct", min: 35, max: 60, minIlvl: 8 },
  // defense tiers
  { id: "sturdy", kind: "prefix", name: "Sturdy", stat: "armor", min: 1, max: 4 },
  { id: "fortified", kind: "prefix", name: "Fortified", stat: "armor", min: 4, max: 9, minIlvl: 4 },
  { id: "vital", kind: "prefix", name: "Vital", stat: "maxHp", min: 5, max: 20 },
  { id: "stalwart", kind: "prefix", name: "Stalwart", stat: "maxHp", min: 15, max: 35, minIlvl: 4 },
  { id: "titans", kind: "prefix", name: "Titan's", stat: "maxHp", min: 30, max: 60, minIlvl: 8 },
  { id: "arcane", kind: "prefix", name: "Arcane", stat: "maxMana", min: 5, max: 15 },
  // elemental prefixes
  { id: "fiery", kind: "prefix", name: "Fiery", stat: "fireDmg", min: 2, max: 6, minIlvl: 2 },
  { id: "blazing", kind: "prefix", name: "Blazing", stat: "fireDmg", min: 5, max: 12, minIlvl: 6 },
  { id: "frozen", kind: "prefix", name: "Frozen", stat: "coldDmg", min: 2, max: 5, minIlvl: 3 },
  { id: "glacial", kind: "prefix", name: "Glacial", stat: "coldDmg", min: 4, max: 10, minIlvl: 7 },
  { id: "charged", kind: "prefix", name: "Charged", stat: "lightDmg", min: 3, max: 8, minIlvl: 3 },
  { id: "storm", kind: "prefix", name: "Storm", stat: "lightDmg", min: 6, max: 14, minIlvl: 7 },
  { id: "keen", kind: "prefix", name: "Keen", stat: "crit", min: 2, max: 5, minIlvl: 2 },
  { id: "masters", kind: "prefix", name: "Master's", stat: "crit", min: 4, max: 8, minIlvl: 6 },
  // suffixes
  { id: "haste", kind: "suffix", name: "of Haste", stat: "atkSpd", min: 5, max: 15 },
  { id: "swift", kind: "suffix", name: "of Swiftness", stat: "moveSpd", min: 5, max: 15 },
  { id: "renewal", kind: "suffix", name: "of Renewal", stat: "regen", min: 1, max: 3 },
  { id: "fortune", kind: "suffix", name: "of Fortune", stat: "magicFind", min: 5, max: 25 },
  { id: "mind", kind: "suffix", name: "of the Mind", stat: "maxMana", min: 5, max: 15 },
  { id: "leech", kind: "suffix", name: "of the Leech", stat: "lifeSteal", min: 2, max: 4, minIlvl: 3 },
  { id: "locust", kind: "suffix", name: "of the Locust", stat: "lifeSteal", min: 4, max: 7, minIlvl: 7 },
  { id: "bat", kind: "suffix", name: "of the Bat", stat: "manaSteal", min: 2, max: 4, minIlvl: 3 },
  { id: "thorns", kind: "suffix", name: "of Thorns", stat: "thorns", min: 2, max: 6, minIlvl: 2 },
  { id: "learning", kind: "suffix", name: "of Learning", stat: "xpBonus", min: 5, max: 12, minIlvl: 2 },
  { id: "greed", kind: "suffix", name: "of Greed", stat: "goldFind", min: 10, max: 25, minIlvl: 2 },
  { id: "alacrity", kind: "suffix", name: "of Alacrity", stat: "cdr", min: 4, max: 8, minIlvl: 4 },
  { id: "elixir", kind: "suffix", name: "of the Elixir", stat: "potionPower", min: 15, max: 30, minIlvl: 3 },
  // resistances — the armor of the deep floors
  { id: "salamander", kind: "suffix", name: "of the Salamander", stat: "fireRes", min: 5, max: 15, minIlvl: 2 },
  { id: "tundra", kind: "suffix", name: "of the Tundra", stat: "coldRes", min: 5, max: 15, minIlvl: 2 },
  { id: "grounding", kind: "suffix", name: "of Grounding", stat: "lightRes", min: 5, max: 15, minIlvl: 2 },
  { id: "prismatic", kind: "prefix", name: "Prismatic", stat: "allRes", min: 4, max: 10, minIlvl: 5 },
  // the rare, build-shaping affixes — deliberately flat so depth never inflates them
  { id: "adept", kind: "prefix", name: "Adept's", stat: "plusSkills", min: 1, max: 1, minIlvl: 8, flat: true },
  { id: "archmage", kind: "prefix", name: "Archmage's", stat: "plusSkills", min: 2, max: 2, minIlvl: 20, flat: true },
  { id: "piercing", kind: "suffix", name: "of Piercing", stat: "penetration", min: 8, max: 18, minIlvl: 5, flat: true },
  { id: "sundering", kind: "suffix", name: "of Sundering", stat: "penetration", min: 18, max: 32, minIlvl: 14, flat: true },
  // class-locked (only counts if YOU are that class)
  { id: "berserker", kind: "suffix", name: "of the Berserker", stat: "dmgPct", min: 10, max: 20, stat2: "maxHp", min2: 10, max2: 20, minIlvl: 3, cls: "barbarian" },
  { id: "viper", kind: "suffix", name: "of the Viper", stat: "atkSpd", min: 6, max: 12, stat2: "crit", min2: 3, max2: 6, minIlvl: 3, cls: "rogue" },
  { id: "magus", kind: "suffix", name: "of the Magus", stat: "maxMana", min: 10, max: 25, stat2: "cdr", min2: 4, max2: 8, minIlvl: 3, cls: "sorcerer" },
  { id: "crusader", kind: "suffix", name: "of the Crusader", stat: "armor", min: 3, max: 7, stat2: "dmgPct", min2: 8, max2: 16, minIlvl: 3, cls: "paladin" },
  { id: "lich", kind: "suffix", name: "of the Lich", stat: "maxMana", min: 10, max: 20, stat2: "lifeSteal", min2: 2, max2: 4, minIlvl: 3, cls: "necromancer" },
  { id: "beast", kind: "suffix", name: "of the Beast", stat: "maxHp", min: 10, max: 20, stat2: "atkSpd", min2: 5, max2: 10, minIlvl: 3, cls: "druid" },
];

export const RARE_NAME_A = ["Storm", "Blood", "Grim", "Doom", "Shadow", "Iron", "Raven", "Bone"];
export const RARE_NAME_B = ["fang", "ward", "song", "grip", "bane", "veil", "howl", "brand"];

export const FIXED_ITEMS: Array<{ base: string; name: string; rarity: Rarity; stats: ItemStats; effect?: string; power?: string }> = [
  { base: "waraxe", name: "Hargol's Cleaver", rarity: "unique", stats: { dmg: 8, dmgPct: 25, maxHp: 15 }, effect: "executioner" },
  { base: "dagger", name: "Raven's Talon", rarity: "unique", stats: { dmg: 6, atkSpd: 15, moveSpd: 5, crit: 5 }, effect: "vampiric_rush" },
  { base: "chainmail", name: "Broodmother's Carapace", rarity: "unique", stats: { armor: 7, maxHp: 25, regen: 2, thorns: 5 }, effect: "frost_armor" },
  { base: "greathelm", name: "The Mummer's Crown", rarity: "unique", stats: { maxHp: 30, regen: 2, magicFind: 20 }, effect: "deep_pockets" },
  { base: "amulet", name: "The Weeping Eye", rarity: "unique", stats: { regen: 2, magicFind: 15, maxHp: 10 }, effect: "giantslayer" },
  { base: "towershield", name: "Thunderwall", rarity: "unique", stats: { armor: 8, maxHp: 20, thorns: 4, lightRes: 25 }, effect: "aegis" },
  { base: "sash", name: "The Flayed Cord", rarity: "unique", stats: { armor: 3, maxHp: 15, lifeSteal: 3 }, effect: "mana_shield" },
  { base: "ring", name: "Winterclaw", rarity: "unique", stats: { dmg: 5, armor: 2, coldDmg: 4, coldRes: 20 }, effect: "frost_armor" },
  { base: "ring", name: "The Orphan Star", rarity: "legendary", stats: { dmgPct: 30, maxHp: 20, magicFind: 10, maxMana: 20 }, effect: "arcane_surge" },
  { base: "boots", name: "The Long March", rarity: "legendary", stats: { moveSpd: 15, armor: 4, magicFind: 15, goldFind: 20 }, effect: "hoarder" },
  { base: "fullhelm", name: "Kragmar's Face", rarity: "legendary", stats: { armor: 5, maxHp: 25, atkSpd: 10, crit: 4 }, effect: "berserk_low" },
  { base: "dagger", name: "Hoarfang", rarity: "legendary", stats: { dmg: 5, coldDmg: 6, atkSpd: 10 }, effect: "frostnova_on_hit" },
  { base: "warstaff", name: "Skysplitter", rarity: "legendary", stats: { dmg: 4, lightDmg: 10, maxMana: 20 }, effect: "chain_on_kill" },
  { base: "sash", name: "The Miser's Sash", rarity: "legendary", stats: { armor: 3, goldFind: 40, magicFind: 10 }, effect: "gold_burst" },
  { base: "plate", name: "The First Dawn", rarity: "epic", stats: { armor: 10, maxHp: 40, moveSpd: 10, dmgPct: 20, allRes: 15 }, effect: "second_wind" },
  { base: "greatsword", name: "The Bloodline", rarity: "epic", stats: { dmg: 12, dmgPct: 30, maxHp: 30 }, effect: "patriarch" },
  { base: "greatsword", name: "The Last Argument", rarity: "epic", stats: { dmg: 10, crit: 8, lifeSteal: 4 }, effect: "corpse_explosion" },
  { base: "bow", name: "The Howling Yew", rarity: "epic", stats: { dmg: 9, atkSpd: 15, crit: 5 }, effect: "knockback_shot" },
  // --- the great expansion: boss signatures ---
  { base: "circlet", name: "Vessira's Visage", rarity: "legendary", stats: { armor: 4, atkSpd: 12, lifeSteal: 4, fireRes: -5 }, effect: "frostnova_on_hit" },
  { base: "chainmail", name: "Vuruk's Carapace", rarity: "legendary", stats: { armor: 8, maxHp: 30, coldRes: 25, thorns: 4 }, effect: "frost_armor" },
  { base: "amulet", name: "The Grudgestone", rarity: "epic", stats: { dmgPct: 20, maxMana: 25, lightRes: 20, magicFind: 15 }, effect: "chain_on_kill" },
  { base: "greatsword", name: "The Sleetbrand", rarity: "legendary", stats: { dmg: 8, coldDmg: 9, atkSpd: 10, coldRes: 15 }, effect: "frostnova_on_hit" },
  { base: "greataxe", name: "The Unmaker's Edge", rarity: "epic", stats: { dmg: 12, dmgPct: 25, crit: 6, fireDmg: 8 }, effect: "corpse_explosion" },
  // --- uniques: the bread and butter of the chase ---
  { base: "dagger", name: "Mudlark", rarity: "unique", stats: { dmg: 4, atkSpd: 20, crit: 3 }, effect: "bleed" },
  { base: "shortsword", name: "Marrowedge", rarity: "unique", stats: { dmg: 5, fireDmg: 4, maxHp: 8 }, effect: "giantslayer" },
  { base: "waraxe", name: "Axe of Kolvar", rarity: "unique", stats: { dmg: 6, coldDmg: 4, coldRes: 10 }, effect: "frost_armor" },
  { base: "morningstar", name: "The Red Sunrise", rarity: "unique", stats: { dmg: 5, lifeSteal: 3, atkSpd: 8 }, effect: "vampiric_rush" },
  { base: "warstaff", name: "The Adder King", rarity: "unique", stats: { dmg: 3, maxMana: 25, manaSteal: 3 }, effect: "mana_shield" },
  { base: "maul", name: "The Blunt Truth", rarity: "unique", stats: { dmg: 10, dmgPct: 15, coldRes: 8, fireRes: 8 }, effect: "terror" },
  { base: "scythe", name: "The Grim Reaper", rarity: "unique", stats: { dmg: 8, lifeSteal: 5, magicFind: 10 }, effect: "terror" },
  { base: "bow", name: "The Sparrowhawk", rarity: "unique", stats: { dmg: 5, crit: 4, regen: 1 }, effect: "giantslayer" },
  { base: "scepter", name: "Vesper", rarity: "unique", stats: { dmg: 5, maxHp: 12, goldFind: 15 }, effect: "hoarder" },
  { base: "wand", name: "Tallowlight", rarity: "unique", stats: { dmg: 3, fireDmg: 5, regen: 1 }, effect: "arcane_surge" },
  { base: "club", name: "Bitterbranch", rarity: "unique", stats: { dmg: 5, fireRes: 12, maxHp: 10 }, effect: "adrenaline" },
  { base: "buckler", name: "Doorwarden", rarity: "unique", stats: { armor: 3, maxHp: 12, moveSpd: 5 }, effect: "adrenaline" },
  { base: "kiteshield", name: "Dinmaker", rarity: "unique", stats: { armor: 4, allRes: 8, thorns: 3 }, effect: "mana_shield" },
  { base: "orb", name: "The Unblinking Glass", rarity: "unique", stats: { maxMana: 20, cdr: 6, magicFind: 15 }, effect: "arcane_surge" },
  { base: "quiver", name: "Cinderspit", rarity: "unique", stats: { atkSpd: 10, fireDmg: 5, crit: 2 }, effect: "bleed" },
  { base: "tome", name: "Bovax's Hide?", rarity: "unique", stats: { maxMana: 18, xpBonus: 8 }, effect: "deep_pockets" },
  { base: "cap", name: "The Potlid", rarity: "unique", stats: { armor: 2, dmg: 3, maxHp: 8 }, effect: "giantslayer" },
  { base: "fullhelm", name: "Gloamguard", rarity: "unique", stats: { armor: 4, allRes: 6, thorns: 2 }, effect: "mana_shield" },
  { base: "circlet", name: "The Searing Eye", rarity: "unique", stats: { maxMana: 15, fireDmg: 4, fireRes: 15 }, effect: "giantslayer" },
  { base: "robe", name: "Ashweave", rarity: "unique", stats: { armor: 2, maxMana: 12, coldRes: 12 }, effect: "mana_shield" },
  { base: "leather", name: "The Flittermouse", rarity: "unique", stats: { armor: 3, moveSpd: 10, dodge: 3 }, effect: "adrenaline" },
  { base: "studded", name: "The Legionnaire", rarity: "unique", stats: { armor: 4, maxHp: 15, regen: 2 }, effect: "second_wind" },
  { base: "plate", name: "Gilderhide", rarity: "unique", stats: { armor: 7, goldFind: 35, magicFind: 8 }, effect: "hoarder" },
  { base: "ring", name: "Cutpurse Band", rarity: "unique", stats: { magicFind: 25, armor: 2 }, effect: "deep_pockets" },
  { base: "ring", name: "Mendwell", rarity: "unique", stats: { maxHp: 12, regen: 2, manaSteal: 2 }, effect: "hoarder" },
  { base: "amulet", name: "Emberheart Relic", rarity: "unique", stats: { fireDmg: 5, fireRes: 20, atkSpd: 5 }, effect: "adrenaline" },
  { base: "amulet", name: "The Knotwood Curio", rarity: "unique", stats: { armor: 3, allRes: 5, maxHp: 8 }, effect: "second_wind" },
  { base: "warbelt", name: "Hearthsmoke", rarity: "unique", stats: { armor: 3, maxMana: 15, allRes: 5 }, effect: "mana_shield" },
  { base: "boots", name: "Cinderheels", rarity: "unique", stats: { moveSpd: 10, fireDmg: 3, fireRes: 15, maxHp: 6 }, effect: "vampiric_rush" },
  { base: "greaves", name: "Redtread", rarity: "unique", stats: { moveSpd: 12, armor: 3, lifeSteal: 2 }, effect: "vampiric_rush" },
  { base: "crown", name: "The Barrow Crown", rarity: "unique", stats: { armor: 3, lifeSteal: 3, maxHp: 10 }, effect: "terror" },
  { base: "girdle", name: "Razorgirdle", rarity: "unique", stats: { armor: 4, thorns: 5, maxHp: 10 }, effect: "bleed" },
  // --- legendaries: the beam turns orange ---
  { base: "waraxe", name: "The Warspeaker", rarity: "legendary", stats: { dmg: 7, dmgPct: 20, atkSpd: 10, allRes: 5 }, effect: "twin_strike" },
  { base: "bow", name: "Kestrelcry", rarity: "legendary", stats: { dmg: 8, crit: 7, atkSpd: 12, dodge: 3 }, effect: "twin_strike" },
  { base: "warstaff", name: "The Iron Bellstaff", rarity: "legendary", stats: { dmg: 5, dmgPct: 18, maxMana: 30, cdr: 8 }, effect: "lightning_storm" },
  { base: "scepter", name: "The Absolver", rarity: "legendary", stats: { dmg: 7, dmgPct: 15, maxHp: 20, allRes: 8 }, effect: "second_wind" },
  { base: "wand", name: "The Skeleton's Key", rarity: "legendary", stats: { dmg: 4, dmgPct: 20, lifeSteal: 3, maxMana: 20 }, effect: "gold_burst" },
  { base: "club", name: "Skullringer", rarity: "legendary", stats: { dmg: 9, dmgPct: 18, maxHp: 15 }, effect: "executioner" },
  { base: "towershield", name: "Halvard's Rest", rarity: "legendary", stats: { armor: 9, maxHp: 25, regen: 3, allRes: 10 }, effect: "aegis" },
  { base: "greathelm", name: "The Hungry Stare", rarity: "legendary", stats: { armor: 5, lifeSteal: 4, manaSteal: 3, coldDmg: 4 }, effect: "bleed" },
  { base: "circlet", name: "Croftkeeper's Crown", rarity: "legendary", stats: { armor: 3, maxHp: 15, maxMana: 15, xpBonus: 8, moveSpd: 5 }, effect: "deep_pockets" },
  { base: "chainmail", name: "Arrowsbane", rarity: "legendary", stats: { armor: 9, maxHp: 35, thorns: 3 }, effect: "adrenaline" },
  { base: "plate", name: "The Deephide", rarity: "legendary", stats: { armor: 11, maxHp: 25, allRes: 6 }, effect: "aegis" },
  { base: "ring", name: "The Sunken Star", rarity: "legendary", stats: { maxHp: 20, fireRes: 20, goldFind: 25 }, effect: "hoarder" },
  { base: "ring", name: "Aldegar's Wedding Band", rarity: "legendary", stats: { maxHp: 18, lifeSteal: 3, dmgPct: 10 }, effect: "berserk_low" },
  { base: "amulet", name: "Nightprowler", rarity: "legendary", stats: { moveSpd: 15, atkSpd: 12, dodge: 5 }, effect: "adrenaline" },
  { base: "amulet", name: "Moonwane", rarity: "legendary", stats: { lightDmg: 8, manaSteal: 3, magicFind: 12 }, effect: "lightning_storm" },
  { base: "sash", name: "Spinner's Girdle", rarity: "legendary", stats: { armor: 3, cdr: 10, maxMana: 20 }, effect: "echo" },
  { base: "boots", name: "The Wastewalkers", rarity: "legendary", stats: { moveSpd: 15, maxHp: 15, thorns: 4 }, effect: "vampiric_rush" },
  { base: "quiver", name: "The Endless Quiver", rarity: "legendary", stats: { atkSpd: 15, dmg: 4, crit: 4 }, effect: "knockback_shot" },
  // --- epics: the screen-shot tier ---
  { base: "maul", name: "The Groundswell", rarity: "epic", stats: { dmg: 13, dmgPct: 22, maxHp: 20 }, effect: "frostnova_on_hit" },
  { base: "scythe", name: "The Ferryman's Fee", rarity: "epic", stats: { dmg: 11, lifeSteal: 6, crit: 5, dmgPct: 15 }, effect: "executioner" },
  { base: "bow", name: "The Silent Suitor", rarity: "epic", stats: { dmg: 10, crit: 9, atkSpd: 12, magicFind: 10 }, effect: "chain_on_kill" },
  { base: "scepter", name: "The Morninglight", rarity: "epic", stats: { dmg: 9, dmgPct: 20, cdr: 10, maxHp: 20 }, effect: "second_wind" },
  { base: "wand", name: "Sextonwood", rarity: "epic", stats: { dmg: 6, dmgPct: 25, lifeSteal: 4, maxMana: 25 }, effect: "corpse_explosion" },
  { base: "orb", name: "Eye of the Storm", rarity: "epic", stats: { maxMana: 35, lightDmg: 10, cdr: 10 }, effect: "arcane_surge" },
  { base: "towershield", name: "The Ward of Kings", rarity: "epic", stats: { armor: 12, maxHp: 30, allRes: 12, thorns: 5 }, effect: "second_wind" },
  { base: "circlet", name: "The Wyvern's Eye", rarity: "epic", stats: { lightDmg: 9, cdr: 12, maxMana: 25, dmgPct: 12 }, effect: "chain_on_kill" },
  { base: "plate", name: "Oathchains", rarity: "epic", stats: { armor: 10, maxHp: 30, allRes: 15, dmgPct: 15 }, effect: "deathless" },
  { base: "ring", name: "The Lantern Ring", rarity: "epic", stats: { lightRes: 25, magicFind: 20, dodge: 4, lightDmg: 5 }, effect: "gold_burst" },
  { base: "amulet", name: "The Prism Eternal", rarity: "epic", stats: { allRes: 18, maxHp: 15, maxMana: 15 }, effect: "echo" },
  { base: "girdle", name: "Bramwell's Hearty Cord", rarity: "epic", stats: { armor: 5, maxHp: 35, regen: 3, potionPower: 25 }, effect: "deathless" },
  { base: "greaves", name: "The Gloamstep", rarity: "epic", stats: { moveSpd: 18, dodge: 6, atkSpd: 8, armor: 4 }, effect: "culling" },
  // the deep-floor prestige library — rarer bases, crueler rolls
  { base: "warpike", name: "Vampire's Fang", rarity: "unique", stats: { dmg: 8, lifeSteal: 5, maxHp: 10 }, effect: "vampiric_rush" },
  { base: "warpike", name: "Ridgebreaker", rarity: "unique", stats: { dmg: 10, crit: 5, thorns: 4 }, effect: "bleed" },
  { base: "warpike", name: "Ironspire", rarity: "legendary", stats: { dmg: 14, dmgPct: 18, armor: 5 }, effect: "giantslayer" },
  { base: "colossusblade", name: "The Coldlight Edge", rarity: "legendary", stats: { dmg: 12, coldDmg: 12, coldRes: 20 }, effect: "frostnova_on_hit" },
  { base: "colossusblade", name: "The Glimmerbrand", rarity: "legendary", stats: { dmg: 11, lightDmg: 8, atkSpd: 12, dodge: 3 }, effect: "lightning_storm" },
  { base: "colossusblade", name: "The Bloodline's Shadow", rarity: "epic", stats: { dmg: 16, dmgPct: 25, maxHp: 25, crit: 6 }, effect: "twin_strike" },
  { base: "bonehelm", name: "Charnelcap", rarity: "unique", stats: { armor: 4, maxMana: 15, manaRegen: 1, lifeSteal: 2 }, effect: "arcane_surge" },
  { base: "bonehelm", name: "The Moundking's Crown", rarity: "unique", stats: { armor: 5, maxHp: 12, lifeSteal: 3 }, effect: "terror" },
  { base: "sacredarmor", name: "Archangel's Aegis", rarity: "epic", stats: { armor: 14, maxHp: 35, allRes: 15, moveSpd: 8 }, effect: "aegis" },
  { base: "sacredarmor", name: "Templar's Bulwark", rarity: "legendary", stats: { armor: 12, maxHp: 25, thorns: 8 }, effect: "second_wind" },
  { base: "bow", name: "Kragfall", rarity: "epic", stats: { dmg: 12, dmgPct: 22, atkSpd: 14, dodge: 4 }, effect: "knockback_shot" },
  { base: "dagger", name: "The Magpie", rarity: "unique", stats: { dmg: 3, magicFind: 30, goldFind: 25 }, effect: "gold_burst" },
  { base: "scepter", name: "The Verdict", rarity: "legendary", stats: { dmg: 8, dmgPct: 15, maxHp: 15, lightRes: 15 }, effect: "culling" },
  { base: "wand", name: "The Widow's Loom", rarity: "epic", stats: { dmg: 7, dmgPct: 20, maxMana: 25, manaRegen: 1.5 }, effect: "corpse_explosion" },
  { base: "warstaff", name: "Quindral's Wisdom", rarity: "legendary", stats: { dmg: 6, maxMana: 30, cdr: 12, xpBonus: 8 }, effect: "mana_shield" },
  { base: "towershield", name: "Nyzat's Lid", rarity: "legendary", stats: { armor: 10, maxHp: 25, fireRes: 15, thorns: 6 }, effect: "second_wind" },
  { base: "warstaff", name: "Ssarim's Riverspine", rarity: "legendary", stats: { dmg: 7, coldDmg: 10, maxMana: 25, coldRes: 20 }, effect: "frostnova_on_hit" },
  { base: "circlet", name: "The Owlshroud", rarity: "epic", stats: { armor: 3, coldDmg: 10, dmgPct: 18, maxMana: 18 }, effect: "echo" },

  // ---- the build-DEFINING legends: each rewrites one class's signature skill ----
  { base: "warstaff", name: "Starfall", rarity: "epic", stats: { dmg: 8, fireDmg: 12, dmgPct: 22, maxMana: 30, plusSkills: 1 }, effect: "arcane_surge", power: "meteor_twice" },
  { base: "orb", name: "The Tempest Coil", rarity: "epic", stats: { lightDmg: 16, dmgPct: 22, maxMana: 30, cdr: 8, plusSkills: 1 }, effect: "chain_on_kill", power: "chain_fork" },
  { base: "warstaff", name: "Voidstride", rarity: "epic", stats: { dmg: 7, dmgPct: 20, maxMana: 30, moveSpd: 8, plusSkills: 1 }, effect: "arcane_surge", power: "teleport_rift" },
  { base: "maul", name: "Groundsplitter", rarity: "epic", stats: { dmg: 11, dmgPct: 26, maxHp: 25, plusSkills: 1 }, effect: "berserk_low", power: "leap_quake" },
  { base: "morningstar", name: "The Sundering", rarity: "epic", stats: { dmg: 10, dmgPct: 24, thorns: 6, plusSkills: 1 }, effect: "adrenaline", power: "warcry_shred" },
  { base: "bow", name: "Winter's Recompense", rarity: "epic", stats: { dmg: 7, coldDmg: 12, atkSpd: 10, plusSkills: 1 }, effect: "frostnova_on_hit", power: "frost_shatter" },
  { base: "quiver", name: "The Ricochet", rarity: "epic", stats: { dmg: 6, atkSpd: 12, crit: 7, plusSkills: 1 }, effect: "giantslayer", power: "pierce_ricochet" },
  { base: "scepter", name: "The Zealot's Oath", rarity: "epic", stats: { dmg: 9, dmgPct: 24, maxHp: 20, plusSkills: 1 }, effect: "second_wind", power: "zeal_nova" },
  { base: "kiteshield", name: "The Warding Light", rarity: "epic", stats: { armor: 14, allRes: 12, maxHp: 30, plusSkills: 1 }, effect: "aegis", power: "prayer_aegis" },
  { base: "scythe", name: "The Plaguebringer", rarity: "epic", stats: { dmg: 8, dmgPct: 22, maxMana: 25, plusSkills: 1 }, effect: "corpse_explosion", power: "poison_lingering" },
  { base: "wand", name: "The Long Withering", rarity: "epic", stats: { dmg: 6, dmgPct: 24, maxMana: 25, plusSkills: 1 }, effect: "mana_shield", power: "wither_spread" },
  { base: "club", name: "Emberheart", rarity: "epic", stats: { dmg: 9, fireDmg: 12, dmgPct: 20, plusSkills: 1 }, effect: "immolation", power: "volcano_twin" },
  { base: "warpike", name: "The Wildcaller", rarity: "epic", stats: { dmg: 12, dmgPct: 26, moveSpd: 8, plusSkills: 1 }, effect: "berserk_low", power: "werewolf_howl" },
  { base: "scepter", name: "Auric Verdict", rarity: "epic", stats: { dmg: 9, dmgPct: 25, maxHp: 20, plusSkills: 1 }, effect: "patriarch", power: "hammer_twin" },
  { base: "wand", name: "The Bone Choir", rarity: "epic", stats: { dmg: 7, maxMana: 25, dmgPct: 20, plusSkills: 1 }, effect: "corpse_explosion", power: "bone_legion" },
  { base: "club", name: "Tempest's Kiss", rarity: "epic", stats: { dmg: 8, coldDmg: 8, moveSpd: 8, plusSkills: 1 }, effect: "knockback_shot", power: "twister_swarm" },
  { base: "quiver", name: "The Thousandfold Quiver", rarity: "epic", stats: { dmg: 6, atkSpd: 12, crit: 6, plusSkills: 1 }, effect: "twin_strike", power: "multi_volley" },
  { base: "greataxe", name: "Maelrend", rarity: "epic", stats: { dmg: 12, dmgPct: 28, fireDmg: 10, plusSkills: 1 }, effect: "berserk_low", power: "whirl_rend" },
  // --- gloves: the hands — speed, crits, and the on-hit trick ---
  { base: "gauntlets", name: "Gravekeeper's Grip", rarity: "unique", stats: { atkSpd: 12, crit: 4, dmg: 4 }, effect: "executioner" },
  { base: "gloves", name: "The Fingersmith", rarity: "unique", stats: { atkSpd: 10, goldFind: 30, magicFind: 12 }, effect: "gold_burst" },
  { base: "gauntlets", name: "The Flensing Hand", rarity: "unique", stats: { dmgPct: 15, lifeSteal: 3, atkSpd: 6 }, effect: "bleed" },
  { base: "gloves", name: "Hoarfrost Knuckles", rarity: "unique", stats: { coldDmg: 5, atkSpd: 8, coldRes: 15 }, effect: "frostnova_on_hit" },
  { base: "gauntlets", name: "Ashgrip Gauntlets", rarity: "legendary", stats: { fireDmg: 8, dmgPct: 20, atkSpd: 8, fireRes: 15 }, effect: "immolation" },
  { base: "gloves", name: "The Quickening", rarity: "legendary", stats: { atkSpd: 22, crit: 6, moveSpd: 8 }, effect: "adrenaline" },
  { base: "battlegloves", name: "The Titan's Grasp", rarity: "epic", stats: { dmgPct: 30, maxHp: 25, atkSpd: 10, crit: 6 }, effect: "giantslayer" },
];

