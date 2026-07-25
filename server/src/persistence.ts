import fs from "fs";
import path from "path";
import { Attributes, EquipSlot, Item, MercSlot, themeIndexForFloor } from "@hollowmark/common";

// Dead-simple file-backed profiles: one JSON per player key.
// The key is a client-generated UUID kept in localStorage — no accounts, no
// passwords, just "this browser owns this hero".

export interface Profile {
  cls: string;
  name?: string;
  level: number;
  xp: number;
  gold: number;
  potions: number;
  manaPotions?: number;
  gear: Partial<Record<EquipSlot, Item>>;
  inventory: Item[];
  stash: Item[];
  // character-sheet era additions (older profiles lack them — migrated on load)
  attrs?: Attributes;
  statPoints?: number;
  skillPoints?: number;
  skills?: Record<string, number>;
  binds?: Record<string, string>;
  // paragon: the endless post-99 track
  paragonLevel?: number;
  paragonXp?: number;
  paragonPoints?: number;
  paragonAlloc?: Record<string, number>;
  deepestFloor?: number; // true-depth high-water mark (danger units since the acts era)
  // the acts era: how far the roads have opened, which waypoints answer, how deep the Abyss goes
  actsUnlocked?: number;
  diffUnlocked?: number; // 1 Normal · 2 Nightmare · 3 Hell
  waypoints?: string[]; // "act:floor"
  abyssDeepest?: number;
  season?: number; // which seasonal ladder this hero belongs to
  riftTier?: number; // deepest Rift Tier cleared — the endgame high-water mark
  // quest-log era additions
  quests?: Record<string, number>;
  questsDone?: string[];
  // the hired companion rides the profile: class, archetype, name, gear, and whether they live
  merc?: { cls?: string; archetype: string; name: string; gear: Partial<Record<MercSlot, Item>>; dead: boolean };
  // hardcore: one life. The profile remembers how it ended.
  hardcore?: boolean;
  dead?: boolean;
  diedTo?: string;
  diedFloor?: number;
  diedAct?: number;
  diedAt?: number;
  updatedAt: number;
}

const DIR = process.env.ARPG_DATA_DIR || path.resolve(process.cwd(), "data", "profiles");
const ACCOUNT_DIR = process.env.ARPG_ACCOUNT_DIR || path.resolve(path.dirname(DIR), "accounts");
const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;

// ─────────────────────────────────────────────────────────────────────────────
// WRITE-BEHIND
//
// Saves used to be writeFileSync, on the same event loop as every room's 20 Hz
// authoritative simulation — so every checkpoint (all players, every 10s) and every
// equip/pickup/sale stalled combat for everyone in the process.
//
// Now a save lands in `pending` and a short timer flushes it asynchronously. Repeated
// saves of the same key collapse into one write, which is the common case: a party of
// four checkpointing together, or a player equipping a whole set in a few seconds.
//
// Two rules make this safe rather than merely fast:
//   1. READS CONSULT `pending` FIRST. A hero who leaves and instantly rejoins must see
//      what they just did, not whatever last reached the disk.
//   2. flushAll() MUST run before the process exits. The Dockerfile leans on
//      SIGTERM → Colyseus drain → onLeave persisting each hero, and Fly auto-stops
//      machines; an unflushed queue at exit is silently lost progress. server/index.ts
//      wires this into gameServer.onShutdown().
// ─────────────────────────────────────────────────────────────────────────────

// How long a save sits in the queue before it is written. Tunable so the durability
// probe can hold the queue wide open and prove that ONLY the shutdown flush saves it.
const FLUSH_DEBOUNCE_MS = Number(process.env.ARPG_FLUSH_DEBOUNCE_MS || 100);

const pendingProfiles = new Map<string, Profile>();
const pendingAccounts = new Map<string, Account>();
let flushTimer: NodeJS.Timeout | null = null;
let flushing: Promise<void> | null = null;

/** tmp + rename, so a crash mid-write can never leave a torn profile on disk. */
async function writeAtomic(file: string, data: string) {
  const tmp = `${file}.tmp`;
  await fs.promises.writeFile(tmp, data);
  await fs.promises.rename(tmp, file);
}

async function flushOnce() {
  const profiles = [...pendingProfiles];
  const accounts = [...pendingAccounts];
  pendingProfiles.clear();
  pendingAccounts.clear();
  if (profiles.length) await fs.promises.mkdir(DIR, { recursive: true });
  if (accounts.length) await fs.promises.mkdir(ACCOUNT_DIR, { recursive: true });
  await Promise.all([
    ...profiles.map(([key, prof]) =>
      writeAtomic(path.join(DIR, `${key}.json`), JSON.stringify(prof)).catch((err) =>
        console.error(`[persistence] failed to save ${key}:`, err)
      )
    ),
    ...accounts.map(([key, acc]) =>
      writeAtomic(path.join(ACCOUNT_DIR, `${key}.json`), JSON.stringify(acc)).catch((err) =>
        console.error(`[persistence] failed to save account ${key}:`, err)
      )
    ),
  ]);
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushing = flushOnce().finally(() => {
      flushing = null;
    });
  }, FLUSH_DEBOUNCE_MS);
  flushTimer.unref?.(); // a queued save must never hold the process open on its own
}

/**
 * Drain every queued write. Call before exit — and await it.
 * Loops because a flush in flight can be racing saves that land while it runs.
 */
export async function flushAll(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  while (flushing || pendingProfiles.size || pendingAccounts.size) {
    if (flushing) await flushing;
    if (pendingProfiles.size || pendingAccounts.size) await flushOnce();
  }
}

// an ACCOUNT spans all of a player's heroes — its shared stash and Codex are the
// cross-character meta. Kept in its OWN file (never inside a hero profile) so items
// are never double-stored and the Codex is shared by every hero the account owns.
export interface AccountCodex {
  bestiary?: Record<string, number>; // kind → total kills
  fragments?: string[]; // recovered lore-fragment ids
  relics?: string[]; // discovered relic (item) names
}
export interface Account {
  sharedStash?: Item[];
  codex?: AccountCodex;
}
export function loadAccount(key: string): Account {
  if (!KEY_RE.test(key)) return {};
  const queued = pendingAccounts.get(key);
  if (queued) return structuredClone(queued); // newer than the file; cloned — see loadProfile
  try {
    return JSON.parse(fs.readFileSync(path.join(ACCOUNT_DIR, `${key}.json`), "utf8")) as Account;
  } catch {
    return {};
  }
}
// Partial-merge save: only the fields present in `patch` are overwritten, so a
// stash-only save never clobbers the Codex (and vice-versa). Read-modify-write —
// and because loadAccount reads the queue first, merging still composes correctly
// when several patches land before the flush.
export function saveAccount(key: string, patch: Account) {
  if (!KEY_RE.test(key)) return;
  pendingAccounts.set(key, { ...loadAccount(key), ...patch });
  scheduleFlush();
}

// --- the Great Renaming ---
// The world found its own name. Saves written before the pivot still speak the
// old tongue; translate them on load so no hero loses gear or quest progress.

const QUEST_ID_MAP: Record<string, string> = {
  fresh_meat: "the_flenser", maiden_of_anguish: "thorned_maiden", horadrim: "ternion",
  lord_of_pain: "white_maw", hatreds_end: "spites_end", terror_itself: "dread_itself",
  destructions_end: "the_unmaking", dark_wanderer: "hollow_pilgrim",
};

const RUNE_ID_MAP: Record<string, string> = {
  el: "vek", tir: "ond", ith: "rok", ral: "fyr", ort: "zel", thul: "hym", lum: "mur",
  amn: "vor", sol: "kel", ko: "ash", fal: "tor", ber: "karn", um: "ghal",
};

const RUNEWORD_MAP: Record<string, string> = {
  "Steel": "Warbrand", "Stealth": "Ghoststep", "Leaf": "Kindling", "Lore": "Scholar",
  "Ancient's Pledge": "Oathward", "Wealth": "King's Purse", "Insight": "Clarity",
  "Wrath": "Ruin", "Spirit": "Anima",
};

const SET_ID_MAP: Record<string, string> = { sigons: "vargans", deaths: "pallbearer" };

const ITEM_NAME_MAP: Record<string, string> = {
  "The Butcher's Cleaver": "Hargol's Cleaver", "Harlequin Crest": "The Mummer's Crown",
  "The Eye of Etlich": "The Weeping Eye", "Stormshield": "Thunderwall",
  "String of Ears": "The Flayed Cord", "Raven Frost": "Winterclaw",
  "The Stone of Jordan": "The Orphan Star", "War Traveler": "The Long March",
  "Arreat's Face": "Kragmar's Face", "Frostburn Fang": "Hoarfang",
  "Thunderstroke": "Skysplitter", "Goldwrap": "The Miser's Sash",
  "Tyrael's Might": "The First Dawn", "The Grandfather": "The Bloodline",
  "Grandfather's Shadow": "The Bloodline's Shadow", "Doombringer": "The Last Argument",
  "Windforce": "The Howling Yew", "Andariel's Visage": "Vessira's Visage",
  "Duriel's Shell": "Vuruk's Carapace", "The Soulstone": "The Grudgestone",
  "Frostwind": "The Sleetbrand", "Destruction's Edge": "The Unmaker's Edge",
  "The Diggler": "Mudlark", "Bladebone": "Marrowedge", "Axe of Fechmar": "Axe of Kolvar",
  "Bloodrise": "The Red Sunrise", "Serpent Lord": "The Adder King",
  "Bonesnap": "The Blunt Truth", "Pluckeye": "The Sparrowhawk", "Knell Striker": "Vesper",
  "Torch of Iro": "Tallowlight", "Felloak": "Bitterbranch", "Pelta Lunata": "Doorwarden",
  "Steelclash": "Dinmaker", "The Oculus": "The Unblinking Glass", "Hellcast": "Cinderspit",
  "The Cow King's Hide?": "Bovax's Hide?", "Biggin's Bonnet": "The Potlid",
  "Duskdeep": "Gloamguard", "Greyform": "Ashweave", "Blinkbat's Form": "The Flittermouse",
  "The Centurion": "The Legionnaire", "Goldskin": "Gilderhide", "Nagelring": "Cutpurse Band",
  "Manald Heal": "Mendwell", "Nokozan Relic": "Emberheart Relic",
  "The Mahim-Oak Curio": "The Knotwood Curio", "Nightsmoke": "Hearthsmoke",
  "Hotspur": "Cinderheels", "Gorefoot": "Redtread", "Undead Crown": "The Barrow Crown",
  "The Undead Crown": "The Moundking's Crown", "Bladebuckle": "Razorgirdle",
  "The Chieftain": "The Warspeaker", "Eaglehorn": "Kestrelcry",
  "The Iron Jang Bong": "The Iron Bellstaff", "Blackhand Key": "The Skeleton's Key",
  "The Cranium Basher": "Skullringer", "Gerke's Sanctuary": "Halvard's Rest",
  "Vampire Gaze": "The Hungry Stare", "Peasant Crown": "Croftkeeper's Crown",
  "Shaftstop": "Arrowsbane", "Leviathan": "The Deephide", "Dwarf Star": "The Sunken Star",
  "Bul-Kathos' Wedding Band": "Aldegar's Wedding Band", "The Cat's Eye": "Nightprowler",
  "Crescent Moon": "Moonwane", "Arachnid Mesh": "Spinner's Girdle",
  "Sandstorm Trek": "The Wastewalkers", "Earthshaker": "The Groundswell",
  "Reaper's Toll": "The Ferryman's Fee", "Widowmaker": "The Silent Suitor",
  "Heaven's Light": "The Morninglight", "Deathspade": "Sextonwood",
  "Griffon's Eye": "The Wyvern's Eye", "Chains of Honor": "Oathchains",
  "Wisp Projector": "The Lantern Ring", "Mara's Kaleidoscope": "The Prism Eternal",
  "Verdungo's Hearty Cord": "Bramwell's Hearty Cord", "Shadow Dancer": "The Gloamstep",
  "Hone Sundan": "Ridgebreaker", "Steel Pillar": "Ironspire",
  "Azurewrath": "The Coldlight Edge", "Lightsabre": "The Glimmerbrand",
  "Wormskull": "Charnelcap", "Cliffkiller": "Kragfall", "Gull": "The Magpie",
  "Lawbringer": "The Verdict", "Death's Web": "The Widow's Loom",
  "Ondal's Wisdom": "Quindral's Wisdom", "Nightwing's Veil": "The Owlshroud",
  "Annihilus": "The Pilgrim's Burden", "Wirt's Leg": "The Peg Leg",
  "Colossus Blade": "Titan Blade",
  "Sigon's Visor": "Vargan's Visor", "Sigon's Shelter": "Vargan's Hauberk",
  "Sigon's Wrap": "Vargan's Girdle", "Death's Hand": "Pallbearer's Blade",
  "Death's Guard": "Pallbearer's Sash",
  "El Rune": "Vek Rune", "Tir Rune": "Ond Rune", "Ith Rune": "Rok Rune",
  "Ral Rune": "Fyr Rune", "Ort Rune": "Zel Rune", "Thul Rune": "Hym Rune",
  "Lum Rune": "Mur Rune", "Amn Rune": "Vor Rune", "Sol Rune": "Kel Rune",
  "Ko Rune": "Ash Rune", "Fal Rune": "Tor Rune", "Ber Rune": "Karn Rune",
  "Um Rune": "Ghal Rune",
};

// old cause-of-death labels, so the Hall of Legends speaks the new tongue too
const DIED_TO_MAP: Array<[string, string]> = [
  ["The Butcher", "Hargol the Flenser"], ["Blood Raven", "Corvessa, the Carrion Bride"],
  ["The Lord of Terror", "Malgrim, the King of Dread"],
  ["Andariel, Maiden of Anguish", "Vessira, the Thorned Maiden"],
  ["Duriel, Lord of Pain", "Vuruk, the White Maw"],
  ["Mephisto, Lord of Hatred", "Orvath, the Grudge Eternal"],
  ["Izual, the Fallen", "Aldric the Forsworn"],
  ["Baal, Lord of Destruction", "Uldrath, the Unmaker"],
  ["The Cow King", "Bovax, Tyrant of the Meadow"],
  ["The Dark Wanderer", "The Hollow Pilgrim"],
  ["a fallen", "an imp"], ["a quillrat", "a spineback"],
  ["a khazra", "a goatman"], ["a balrog", "a hellion"],
];

function migrateItem(it: Item | undefined | null) {
  if (!it) return;
  if (ITEM_NAME_MAP[it.name]) it.name = ITEM_NAME_MAP[it.name];
  if (it.runeword && RUNEWORD_MAP[it.runeword]) it.runeword = RUNEWORD_MAP[it.runeword];
  if (it.runes) it.runes = it.runes.map((r) => RUNE_ID_MAP[r] ?? r);
  if (it.base?.startsWith("rune_")) {
    const k = it.base.slice(5);
    if (RUNE_ID_MAP[k]) it.base = `rune_${RUNE_ID_MAP[k]}`;
  }
  const anyIt = it as { setId?: string };
  if (anyIt.setId && SET_ID_MAP[anyIt.setId]) anyIt.setId = SET_ID_MAP[anyIt.setId];
}

function migrateProfile(prof: Profile): Profile {
  for (const it of Object.values(prof.gear ?? {})) migrateItem(it);
  for (const it of prof.inventory ?? []) migrateItem(it);
  for (const it of prof.stash ?? []) migrateItem(it);
  for (const it of Object.values(prof.merc?.gear ?? {})) migrateItem(it);
  if (prof.quests) {
    for (const [oldId, newId] of Object.entries(QUEST_ID_MAP)) {
      if (oldId in prof.quests) {
        prof.quests[newId] = prof.quests[oldId];
        delete prof.quests[oldId];
      }
    }
  }
  if (prof.questsDone) prof.questsDone = prof.questsDone.map((q) => QUEST_ID_MAP[q] ?? q);
  if (prof.diedTo) for (const [old, next] of DIED_TO_MAP) prof.diedTo = prof.diedTo.split(old).join(next);
  // the acts era: translate the old single endless descent into acts + waypoints + abyss.
  // Old deepestFloor bands map to acts (1-3 → I, 4-6 → II, 7-9 → III, 10+ → IV);
  // floor-10 veterans beat the old game and keep the Abyss they lived in.
  if (prof.actsUnlocked === undefined) {
    const d = Math.max(1, prof.deepestFloor ?? 1);
    prof.actsUnlocked = Math.min(4, themeIndexForFloor(d) + 1);
    prof.waypoints = [1, 3, 5].filter((f) => f <= Math.min(d, 7)).map((f) => `1:${f}`);
    prof.abyssDeepest = d >= 10 ? d - 9 : 0;
    if (prof.abyssDeepest > 0) prof.actsUnlocked = 5;
  }
  // the difficulty ladder: anyone who had already opened the Abyss beat the game — Nightmare is theirs
  if (prof.diffUnlocked === undefined) {
    prof.diffUnlocked = (prof.actsUnlocked ?? 1) >= 5 ? 2 : 1;
  }
  // seasons: every hero that predates the ladder belongs to the inaugural season (1)
  if (prof.season === undefined) prof.season = 1;
  return prof;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE LADDER CACHE
//
// /legends used to readdirSync + readFileSync + migrate EVERY profile on disk, per
// request, synchronously — on the event loop running every room's simulation. One
// person opening the lobby stuttered every live fight, and with `Access-Control-
// Allow-Origin: *` a curl loop was a denial of service.
//
// Now it's a Map, scanned once at boot and kept current by saveProfile. A ladder row
// is a dozen scalars — the gear and inventory that make a profile big are not kept.
// ─────────────────────────────────────────────────────────────────────────────

export interface LadderEntry {
  name: string;
  cls: string;
  level: number;
  deepestFloor: number;
  actsUnlocked: number;
  diffUnlocked: number;
  abyssDeepest: number;
  riftTier: number;
  season: number;
  hardcore: boolean;
  dead: boolean;
  diedTo: string;
  diedFloor: number;
  diedAct: number;
  diedAt: number;
}

const ladder = new Map<string, LadderEntry>();

function ladderEntryOf(prof: Profile): LadderEntry {
  return {
    name: prof.name ?? "",
    cls: prof.cls,
    level: prof.level,
    deepestFloor: prof.deepestFloor ?? 1,
    actsUnlocked: prof.actsUnlocked ?? 1,
    diffUnlocked: prof.diffUnlocked ?? 1,
    abyssDeepest: prof.abyssDeepest ?? 0,
    riftTier: prof.riftTier ?? 0,
    season: prof.season ?? 1,
    hardcore: !!prof.hardcore,
    dead: !!prof.dead,
    diedTo: prof.diedTo ?? "",
    diedFloor: prof.diedFloor ?? 0,
    diedAct: prof.diedAct ?? 0,
    diedAt: prof.diedAt ?? 0,
  };
}

/** The one full scan of the profile directory — at boot, before anyone is playing. */
function seedLadder(limit = 5000) {
  ladder.clear();
  let files: string[];
  try {
    files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
  } catch {
    return; // no profiles yet
  }
  for (const f of files.slice(0, limit)) {
    try {
      const prof = migrateProfile(JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as Profile);
      if (typeof prof.level === "number") ladder.set(f.slice(0, -5), ladderEntryOf(prof));
    } catch {
      /* unreadable profile — skip it, it just doesn't appear on the ladder */
    }
  }
}

/** Every hero this server remembers — served from memory, never off the disk. */
export function listLadder(): LadderEntry[] {
  return [...ladder.values()];
}

export function ensureDataDir() {
  fs.mkdirSync(DIR, { recursive: true });
  if (ladder.size === 0) seedLadder();
}

export function validKey(key: unknown): key is string {
  return typeof key === "string" && KEY_RE.test(key);
}

export function loadProfile(key: string): Profile | null {
  if (!validKey(key)) return null;
  // A queued write is newer than the file — see WRITE-BEHIND. Cloned, because the
  // queued profile still points at the live Player's gear/inventory arrays: handing
  // those out would let a rejoining hero share array objects with the one still in
  // the room. Reads returned a fresh object before this change; they still do.
  const queued = pendingProfiles.get(key);
  if (queued) return structuredClone(queued);
  try {
    const raw = fs.readFileSync(path.join(DIR, `${key}.json`), "utf8");
    const prof = JSON.parse(raw) as Profile;
    if (!prof || typeof prof.level !== "number") return null;
    return migrateProfile(prof);
  } catch {
    return null; // first visit, or unreadable — start fresh
  }
}

export function saveProfile(key: string, prof: Profile) {
  if (!validKey(key)) return;
  pendingProfiles.set(key, prof);
  ladder.set(key, ladderEntryOf(prof)); // the Hall of Legends is current immediately
  scheduleFlush();
}
