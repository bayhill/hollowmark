// THE QUEST LOG: the persistent 17-quest spine (forest arc, boss hunts, milestones),
// plus the elite and random-encounter tables that decorate a floor. A leaf — only the
// Element type crosses the boundary, and types erase.
import type { Element } from "./index";

// --- the quest log ---

export interface QuestDef {
  id: string;
  name: string;
  desc: string;
  goal: number;
  rewardGold: number;
  rewardXp: number;
  act?: number; // which act's chapter of the log it lives in (default 1)
}

export const QUESTS: QuestDef[] = [
  {
    id: "clear_forest", name: "The Overgrowth",
    desc: "Slay 15 creatures in the forest beyond the town gate.",
    goal: 15, rewardGold: 300, rewardXp: 120,
  },
  {
    id: "enter_cathedral", name: "The Cathedral",
    desc: "Find the cathedral deep in the forest and descend into its depths.",
    goal: 1, rewardGold: 150, rewardXp: 100,
  },
  {
    id: "the_flenser", name: "Hooks and Cleavers",
    desc: "Slay Hargol the Flenser.",
    goal: 1, rewardGold: 500, rewardXp: 250,
  },
  {
    id: "thorned_maiden", name: "The Thorned Maiden",
    desc: "Slay Vessira, who nests beneath the cathedral.",
    goal: 1, rewardGold: 800, rewardXp: 400,
  },
  {
    id: "into_the_dark", name: "Into the Dark",
    desc: "Reach floor 5 of the labyrinth.",
    goal: 1, rewardGold: 1000, rewardXp: 600,
  },
  {
    id: "watchtower", name: "The Watchtower",
    desc: "Climb to the top of the watchtower in the forest.",
    goal: 1, rewardGold: 250, rewardXp: 150,
  },
  {
    id: "spelunker", name: "Spelunker",
    desc: "Explore one of the dark caves hidden in the forest.",
    goal: 1, rewardGold: 200, rewardXp: 120,
  },
  {
    id: "gambler", name: "A Fool and His Gold",
    desc: "Gamble on one of Fenwick's unidentified treasures.",
    goal: 1, rewardGold: 150, rewardXp: 80,
  },
  {
    id: "ternion", name: "The Ternion Craft",
    desc: "Transmute something at the Ternion Altar.",
    goal: 1, rewardGold: 300, rewardXp: 180,
  },
  {
    id: "legend", name: "Dressed for the Occasion",
    desc: "Equip a unique, legendary, or epic item.",
    goal: 1, rewardGold: 400, rewardXp: 250,
  },
  {
    id: "seasoned", name: "Seasoned",
    desc: "Reach level 10.",
    goal: 1, rewardGold: 600, rewardXp: 0,
  },
  {
    id: "white_maw", name: "The White Maw", act: 2,
    desc: "Slay Vuruk, the White Maw, who prowls the middle tombs of the Necropolis.",
    goal: 1, rewardGold: 900, rewardXp: 450,
  },
  {
    id: "spites_end", name: "Spite's End", act: 3,
    desc: "Slay Orvath, the Grudge Eternal, who broods in the flooded temple.",
    goal: 1, rewardGold: 1200, rewardXp: 600,
  },
  {
    id: "dread_itself", name: "Dread Itself", act: 4,
    desc: "Slay Malgrim, King of Dread, at the gates of the Unmaker's hall.",
    goal: 1, rewardGold: 2000, rewardXp: 1000,
  },
  {
    id: "the_unmaking", name: "The Unmaking", act: 4,
    desc: "Unmake Uldrath in his own hall, and open the Endless Abyss.",
    goal: 1, rewardGold: 2500, rewardXp: 1200,
  },
  {
    id: "hollow_pilgrim", name: "The Hollow Pilgrim",
    desc: "Hunt down the dark presence that walks the floors.",
    goal: 1, rewardGold: 1500, rewardXp: 800,
  },
  {
    id: "thirsty_road", name: "The Thirsty Road", act: 2,
    desc: "Reach the Zerath Oasis, east across the wastes.",
    goal: 1, rewardGold: 400, rewardXp: 300,
  },
  {
    id: "vultures", name: "Vultures Overhead", act: 2,
    desc: "Slay 20 creatures in the Sunscar Wastes.",
    goal: 20, rewardGold: 500, rewardXp: 350,
  },
  {
    id: "sunken_door", name: "The Sunken Door", act: 2,
    desc: "Enter one of the tombs sunk beneath the sand.",
    goal: 1, rewardGold: 350, rewardXp: 250,
  },
  {
    id: "embalmed_queen", name: "The Embalmed Queen", act: 2,
    desc: "Slay Queen Nyzat at the bottom of the Sunken Necropolis, and open the road east.",
    goal: 1, rewardGold: 1500, rewardXp: 800,
  },
  {
    id: "mirefall_landing", name: "Landfall", act: 3,
    desc: "Reach Mirefall Landing, where the river meets the green.",
    goal: 1, rewardGold: 600, rewardXp: 450,
  },
  {
    id: "green_hell", name: "Green Hell", act: 3,
    desc: "Slay 20 creatures in the Drowned Green.",
    goal: 20, rewardGold: 700, rewardXp: 500,
  },
  {
    id: "flooded_steps", name: "The Flooded Steps", act: 3,
    desc: "Enter one of the ruins drowned beneath the canopy.",
    goal: 1, rewardGold: 450, rewardXp: 350,
  },
  {
    id: "drowned_god", name: "The Drowned God", act: 3,
    desc: "Slay Ssarim at the heart of the Ziggurat, and open the road to the Hollow Throne.",
    goal: 1, rewardGold: 1800, rewardXp: 1000,
  },
  {
    id: "last_vigil", name: "The Last Vigil", act: 4,
    desc: "Reach the Last Vigil, the bastion at the edge of the breach.",
    goal: 1, rewardGold: 800, rewardXp: 600,
  },
  {
    id: "the_breach", name: "The Breach", act: 4,
    desc: "Slay 20 of the Hollow Throne's vanguard on the Ashfall Road.",
    goal: 20, rewardGold: 900, rewardXp: 700,
  },
  {
    id: "oathbreaker", name: "The Oathbreaker", act: 4,
    desc: "Slay Aldric the Forsworn, who remembers the light.",
    goal: 1, rewardGold: 1200, rewardXp: 800,
  },
  {
    id: "into_the_endless", name: "Into the Endless", act: 4,
    desc: "Descend to the third floor of the Endless Abyss.",
    goal: 1, rewardGold: 2000, rewardXp: 1500,
  },
  {
    id: "moo", name: "A Load of Bull",
    desc: "Slay Bovax, Tyrant of the Meadow. (What meadow?)",
    goal: 1, rewardGold: 1000, rewardXp: 500,
  },
];

// --- elites & random encounters ---

export const ELITE_CHANCE = 0.15; // per camp, one member may spawn elite
// the deep breeds champions: elite odds climb with every floor
export function eliteChanceFor(floor: number): number {
  return Math.min(0.4, ELITE_CHANCE + 0.02 * (floor - 1));
}
export const ELITE_HP_MULT = 2.5;
export const ELITE_DMG_MULT = 1.4;
export const ELITE_SPEED_MULT = 1.15;
export const ELITE_XP_MULT = 4;

export const GOBLIN_SPAWN_CHANCE = 0.4; // per floor
export const GOBLIN_ESCAPE_MS = 9000; // aggro time before it portals out
export const GOBLIN_DROPS = 3;
export const GOBLIN_POTION_DROPS = 2;

// champion packs: the whole camp shares one modifier (blue, D2-style)
export const CHAMPION_CHANCE = 0.2;

export interface ChampionMod {
  id: string;
  label: string;
  hpMult: number;
  dmgMult: number;
  speedMult: number;
  cdMult: number; // attack cooldown multiplier (lower = faster attacks)
  alpha?: number; // ghostly packs render translucent
  element?: Element; // enchanted packs deal typed damage
  explode?: boolean; // Fire Enchanted: dies violently
  // behavioral mods — these change how you FIGHT the pack, not just its numbers
  vampiric?: boolean; // heals itself for a slice of every blow it lands — burst it down
  reflect?: number; // throws this fraction of each melee blow back at the attacker
  mortar?: boolean; // lobs telegraphed AoE shells at your position — keep moving
  warded?: boolean; // raises a periodic damage-immunity bubble — burst it in the gaps
  hexer?: boolean; // seals a telegraphed curse-circle that saps your damage — step out or burst it
  aura?: number; // client aura tint (defaults to champion blue when absent)
}

export const CHAMPION_MODS: ChampionMod[] = [
  { id: "fast", label: "Frenzied", hpMult: 1.2, dmgMult: 1.1, speedMult: 1.5, cdMult: 1 },
  { id: "strong", label: "Brutal", hpMult: 1.3, dmgMult: 1.6, speedMult: 1, cdMult: 1 },
  { id: "stone", label: "Stoneskin", hpMult: 2.0, dmgMult: 1, speedMult: 0.9, cdMult: 1 },
  { id: "ghostly", label: "Ghostly", hpMult: 0.9, dmgMult: 1.3, speedMult: 1.2, cdMult: 1, alpha: 0.55 },
  { id: "fanatic", label: "Fanatic", hpMult: 1.1, dmgMult: 1.15, speedMult: 1.1, cdMult: 0.55 },
  // the D2 classics — read the label BEFORE you swing
  { id: "fire", label: "Fire Enchanted", hpMult: 1.4, dmgMult: 1.2, speedMult: 1, cdMult: 1, element: "fire", explode: true },
  { id: "cold", label: "Cold Enchanted", hpMult: 1.3, dmgMult: 1.1, speedMult: 0.95, cdMult: 1, element: "cold" },
  { id: "light", label: "Lightning Enchanted", hpMult: 1.2, dmgMult: 1.3, speedMult: 1.05, cdMult: 0.85, element: "light" },
  // behavioral packs — the label warns you, the fight plays differently
  { id: "vampiric", label: "Vampiric", hpMult: 1.4, dmgMult: 1.1, speedMult: 1, cdMult: 1, vampiric: true, aura: 0xc0303a },
  { id: "spiked", label: "Spiked", hpMult: 1.6, dmgMult: 1, speedMult: 0.95, cdMult: 1, reflect: 0.15, aura: 0xe0872a },
  { id: "mortar", label: "Mortar", hpMult: 1.3, dmgMult: 1, speedMult: 0.95, cdMult: 1, mortar: true, aura: 0x6ad0b0 },
  { id: "warded", label: "Warded", hpMult: 1.5, dmgMult: 1.05, speedMult: 1, cdMult: 1, warded: true, aura: 0xc9b24a },
  { id: "hexer", label: "Hexer", hpMult: 1.35, dmgMult: 1, speedMult: 1, cdMult: 1, hexer: true, aura: 0x8a4fbf },
];

export const FE_EXPLODE_RADIUS = 75;
export const FE_EXPLODE_MULT = 1.5; // × the champion's own damage
export const VAMPIRIC_HEAL_FRAC = 0.5; // a Vampiric blow heals it for half of what it deals

export const CHAMPION_XP_MULT = 2;
export const CHAMPION_EXTRA_DROP = 0.3;
export const CHAMPION_GOLD_MULT = 2;

const ELITE_A = ["Bone", "Gore", "Skull", "Dread", "Blood", "Rot", "Grim", "Ash"];
const ELITE_B = ["crusher", "render", "maw", "fang", "claw", "gnaw", "spike", "howl"];
const ELITE_T = ["the Cruel", "the Vile", "the Swift", "the Mad", "the Unclean", "the Hungry"];

export function eliteName(rng: () => number = Math.random): string {
  return `${ELITE_A[Math.floor(rng() * ELITE_A.length)]}${ELITE_B[Math.floor(rng() * ELITE_B.length)]} ${
    ELITE_T[Math.floor(rng() * ELITE_T.length)]
  }`;
}

