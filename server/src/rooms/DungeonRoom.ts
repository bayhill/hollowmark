import { Room, Client } from "colyseus";
import { Schema, MapSchema, type } from "@colyseus/schema";
import { Profile, ensureDataDir, loadProfile, saveProfile, validKey, loadAccount, saveAccount } from "../persistence";
import {
  Attack,
  BOSS_EXTRA_DROP_CHANCE,
  BOSS_GUARANTEED_DROPS,
  BOSS_POTION_DROPS,
  BOSS_RARITY_WEIGHTS,
  BOSS_RESPAWN_MS,
  CAMP_RESPAWN_MS,
  CHAIN_CAST_RANGE,
  CHAIN_FALLOFF,
  CHAIN_JUMP_RANGE,
  CHAIN_FORK_JUMPS,
  CHAIN_FORK_STUN_MS,
  RIFT_RADIUS,
  RIFT_DURATION_MS,
  LEAP_QUAKE_MS,
  LEAP_QUAKE_MULT,
  WARCRY_SHRED_MS,
  WARCRY_KNOCKBACK,
  FROST_SHATTER_RADIUS,
  FROST_SHATTER_MULT,
  FROST_SHATTER_CHILL_MS,
  PIERCE_RICOCHET_ANGLE,
  ZEAL_NOVA_EVERY,
  ZEAL_NOVA_RADIUS,
  ZEAL_NOVA_MULT,
  PRAYER_SHIELD_MS,
  POISON_POOL_MS,
  POISON_POOL_MULT,
  WITHER_SPREAD_RADIUS,
  VOLCANO_TWIN_DELAY_MS,
  CLASSES,
  CLASS_ATTACKS,
  ClassName,
  DASH_RANGE,
  ATTRS,
  AttrName,
  Attributes,
  CLASS_BASE_ATTRS,
  CLASS_OFFENSIVE_ATTR,
  STAT_POINTS_PER_LEVEL,
  SKILL_POINTS_PER_LEVEL,
  SKILL_TREES,
  SkillNode,
  SKILL_KEYS,
  SkillKey,
  skillById,
  canAllocSkill,
  skillDamageMult,
  effectiveSkills,
  attrBonus,
  maxHpFor,
  maxManaFor,
  DODGE_CAP,
  BASH_RANGE,
  BASH_STUN_MS,
  WARCRY_RADIUS,
  WARCRY_STUN_MS,
  ANCIENTS_RADIUS,
  ANCIENTS_STUN_MS,
  COLDARROW_SPEED,
  COLDARROW_CHILL_MS,
  VENGEANCE_RADIUS,
  VENGEANCE_WAVES,
  VENGEANCE_WAVE_MS,
  FIREWALL_LENGTH,
  FIREWALL_DURATION_MS,
  FIREWALL_TICK_MS,
  METEOR_DELAY_MS,
  METEOR_RADIUS,
  METEOR_BURN_MS,
  SHOUT_RANK_MS,
  Element,
  MONSTER_ELEMENTS,
  monsterResistOf,
  MONSTER_ELEMENT_FRACTION,
  resistOf,
  PLAYER_CHILL_MS,
  PLAYER_CHILL_FACTOR,
  DEATH_GOLD_FRACTION,
  identifyCost,
  canPunchSockets,
  socketPunchCost,
  unsocketCost,
  hasSeatedStones,
  canReforge,
  reforgeCost,
  maxSockets,
  UNIDENTIFIED_RARITIES,
  BASE_ITEMS,
  RUNE_ORDER,
  TRANSMUTE_RUNES_NEEDED,
  TRANSMUTE_MAGICS_NEEDED,
  VICTORY_ACT,
  FE_EXPLODE_RADIUS,
  FE_EXPLODE_MULT,
  VAMPIRIC_HEAL_FRAC,
  MORTAR_INTERVAL_MS,
  MORTAR_TELEGRAPH_MS,
  MORTAR_RADIUS,
  MORTAR_DMG,
  WARD_INTERVAL_MS,
  WARD_DURATION_MS,
  MANA_POTION_DROP_CHANCE,
  MANA_POTION_RESTORE_FRACTION,
  BOSS_MANA_POTION_DROPS,
  BountyKind,
  bountyGoalFor,
  bountyTextFor,
  BOUNTY_XP_PER_FLOOR,
  BOUNTY_GOLD_PER_FLOOR,
  PILGRIM_CHANCE,
  PILGRIM_HP_MULT,
  PILGRIM_DMG_MULT,
  PILGRIM_XP_MULT,
  BURDEN_CHANCE,
  PEG_LEG_GOBLIN_CHANCE,
  PEG_LEG_JACKPOT_CHANCE,
  COW_ZONE_NAME,
  generateCowLevel,
  PROJECTILE_CLASS,
  WOLF_DURATION_MS,
  WOLF_DURATION_PER_RANK_MS,
  WOLF_DMG_MULT,
  WOLF_SPEED_BONUS,
  WOLF_ATTACK,
  PET_DURATION_MS,
  PET_SPEED,
  PET_ATTACK_RANGE,
  PET_ATTACK_MS,
  PET_SEEK_RANGE,
  PET_FOLLOW_DIST,
  petCapFor,
  DECREPIFY_RADIUS,
  DECREPIFY_MS,
  DECREPIFY_VULN,
  POISONNOVA_RADIUS,
  TEETH_COUNT,
  ZEAL_HITS,
  HAMMER_COUNT,
  HAMMER_SPEED,
  FIST_RADIUS,
  PRAYER_RADIUS,
  HURRICANE_MS,
  HURRICANE_RADIUS,
  NOVA_BOSSES,
  BROOD_BOSSES,
  VURUK_CHARGE_INTERVAL_MS,
  VURUK_CHARGE_MS,
  VURUK_CHARGE_SPEED_MULT,
  ORVATH_KEEP_DISTANCE,
  ORVATH_ORB_SPEED,
  RARITY_ORDER,
  AGGRO_MEMORY_MS,
  GIANTSLAYER_MULT,
  BLEED_FRACTION,
  BLEED_TICKS,
  BLEED_TICK_MS,
  MANA_SHIELD_FRACTION,
  DEEP_POCKETS_CHANCE,
  HOARDER_HEAL_PER_GOLD,
  RUSH_MS,
  ADRENALINE_MS,
  TERROR_RADIUS,
  TERROR_MS,
  TWIN_STRIKE_CHANCE,
  TWIN_STRIKE_MULT,
  BERSERK_THRESHOLD,
  BERSERK_MULT,
  STORM_HERALD_MULT,
  AEGIS_CD_MS,
  CULLING_THRESHOLD,
  DEATHLESS_CD_MS,
  DEATHLESS_IMMUNE_MS,
  ECHO_CHANCE,
  IMMOLATION_RADIUS,
  IMMOLATION_MULT,
  IMMOLATION_TICK_MS,
  STORMLORD_EVERY,
  DROP_CHANCE,
  DungeonLayout,
  ELITE_CHANCE,
  eliteChanceFor,
  CULTIST_KEEP_DISTANCE,
  CULTIST_BOLT_SPEED,
  SUCCUBUS_KEEP_DISTANCE,
  SUCCUBUS_STAR_SPEED,
  ELITE_DMG_MULT,
  ELITE_HP_MULT,
  ELITE_SPEED_MULT,
  ELITE_XP_MULT,
  GOBLIN_DROPS,
  GOBLIN_ESCAPE_MS,
  GOBLIN_POTION_DROPS,
  GOBLIN_SPAWN_CHANCE,
  BOSS_LINES,
  BOSS_NAMES,
  BossKind,
  NOVA_DMG,
  NOVA_INTERVAL_MS,
  NOVA_RADIUS,
  NOVA_TELEGRAPH_MS,
  PLAYER_RADIUS,
  QUEEN_MAX_ADDS,
  QUEEN_SPAWN_MS,
  CORVESSA_ARROW_SPEED,
  CORVESSA_KEEP_DISTANCE,
  ARCHER_ARROW_SPEED,
  ARCHER_KEEP_DISTANCE,
  actBossKindFor,
  isBossKind,
  CHARM_DROP_CHANCE,
  SETS,
  generateCharm,
  BOSS_GOLD_MULT,
  BOSS_GOLD_PILES,
  ELITE_GOLD_MULT,
  GAMBLE_WEIGHTS,
  GAMBLE_STOCK_SIZE,
  gambleIlvl,
  gamblePrice,
  VENDOR_STOCK_SIZE,
  VENDOR_WEIGHTS,
  vendorPrice,
  GOBLIN_GOLD_MULT,
  GOBLIN_GOLD_PILES,
  GOLD_DROP_CHANCE,
  gambleCost,
  goldRoll,
  FROSTBITE_CHANCE,
  KNOCKBACK_CHANCE,
  SECOND_WIND_CD_MS,
  RUNES,
  RUNE_DROP_CHANCE,
  JEWEL_DROP_CHANCE,
  generateJewel,
  generateRune,
  matchRuneword,
  runewordByName,
  CHAMPION_CHANCE,
  CHAMPION_EXTRA_DROP,
  CHAMPION_GOLD_MULT,
  CHAMPION_MODS,
  CHAMPION_XP_MULT,
  CHEST_AMBUSH,
  CHEST_CURSED_CHANCE,
  CHEST_TREASURE_CHANCE,
  LORE_LINES,
  TOME_XP_BASE,
  loreBandFor,
  townNpcById,
  rollEncounter,
  encounterById,
  ENCOUNTER_CHANCE,
  ENCOUNTER_XP_BASE,
  FROSTNOVA_MULT,
  FROSTNOVA_RADIUS,
  FROSTNOVA_SLOW,
  FROSTNOVA_SLOW_MS,
  LEAP_KNOCKBACK,
  LEAP_MULT,
  LEAP_RADIUS,
  LEAP_RANGE,
  PIERCE_LENGTH,
  PIERCE_MULT,
  PIERCE_WIDTH,
  SHRINE_DMG_MS,
  SHRINE_DMG_MULT,
  SHRINE_KINDS,
  SHRINE_MF_BONUS,
  SHRINE_MF_MS,
  SHRINE_SPEED_BONUS,
  SHRINE_SPEED_MS,
  SHRINE_TOUCH_RANGE,
  SHRINE_XP_BASE,
  eliteName,
  zoneNameFor,
  ACTS,
  ACT_FLOORS,
  ABYSS_ACT,
  dangerFor,
  RANGED_MONSTERS,
  MONSTER_AI,
  pickMonsterKindFor,
  BROOD_ADD_KIND,
  DIFFICULTIES,
  DIFF_DANGER_OFFSET,
  DIFF_RES_PENALTY,
  DIFF_MYTHIC_MULT,
  MAX_LEVEL,
  PARAGON_PERKS,
  paragonXpForNext,
  paragonPerkById,
  CURRENT_SEASON,
  RIFT_ACT,
  RIFT_KILL_GOAL,
  riftDangerFor,
  BOSS_KIND_LIST,
  EQUIP_SLOTS,
  EquipSlot,
  GameMap,
  HP_PER_LEVEL,
  INVENTORY_SIZE,
  Item,
  Rarity,
  ItemStats,
  LOOT_DESPAWN_MS,
  AUTO_PICKUP_RANGE,
  BASE_POTION_CAP,
  BOSS_SIGNATURES,
  PORTAL_CAST_MS,
  PORTAL_RETURN_MS,
  STASH_SIZE,
  TRADE_RANGE,
  TRADE_MAX_ITEMS,
  TRADE_INVITE_TTL_MS,
  TOWN,
  TOWN_BOUNDARY_Y,
  TOWN_INTERACT_RANGE,
  POTION_PRICES,
  MERC_ARCHETYPES,
  MERC_NAMES,
  mercClassById,
  recruiterForAct,
  actTownNpcs,
  tavernKeeperFor,
  hutResidentFor,
  MERC_MELEE_RANGE,
  MERC_SLOTS,
  MercSlot,
  mercHireCost,
  mercReviveCost,
  mercBaseHp,
  mercBaseDmg,
  MERC_ATTACK_RANGE,
  MERC_ENGAGE_RANGE,
  MERC_FOLLOW_DIST,
  MERC_TELEPORT_DIST,
  MERC_SPEED,
  MERC_REGEN_PER_S,
  MERC_REGEN_DELAY_MS,
  MERC_CHILL_MS,
  mulberry32,
  QUESTS,
  SPINEBACK_KEEP_DISTANCE,
  SPINEBACK_SPEED,
  IMP_FLEE_MS,
  IMP_FLEE_RADIUS,
  isInTown,
  sellValue,
  SIGNATURE_DROP_CHANCE,
  generateFixedItem,
  potionCapFor,
  MANA_REGEN_PER_S,
  MONSTERS,
  MULTISHOT_COUNT,
  MULTISHOT_SPREAD_DEG,
  MonsterKind,
  PICKUP_RANGE,
  PLAYER_MAX_HP,
  PLAYER_MAX_MANA,
  PLAYER_REGEN_PER_S,
  PLAYER_RESPAWN_MS,
  RESPAWN_IMMUNE_MS,
  PLAYER_SPEED,
  POTION_DROP_CHANCE,
  POTION_HEAL,
  POTION_HEAL_PER_FLOOR,
  PROJECTILE_LIFETIME_MS,
  REGEN_DELAY_MS,
  SHOUT_DMG_MULT,
  SHOUT_DURATION_MS,
  STAIRS_USE_RANGE,
  TELEPORT_RANGE,
  TICK_RATE,
  WHIRLWIND_MULT,
  WHIRLWIND_RADIUS,
  XP_SHARE_RANGE,
  addStats,
  campPackSize,
  canStand,
  equipSlotFor,
  floorDmgMult,
  floorHpMult,
  floorXpMult,
  generateDungeon,
  generateItem,
  hasLineOfSight,
  isWalkable,
  makeMap,
  pickMonsterKind,
  rollDamage,
  xpForNext,
} from "@hollowmark/common";

// dev/test affordances (the smoke suite's deterministic self-kill) — off in production
const TEST_HOOKS = process.env.NODE_ENV !== "production" && process.env.ARPG_PROD !== "1";

// a charger plants its feet and telegraphs before the burst — a mechanic, not a cheap shot
const CHARGE_WINDUP_MS = 550;

// hero names: letters, digits, spaces; trimmed to 12 chars; fallback flavor
function sanitizeName(raw: unknown): string {
  const cleaned = typeof raw === "string" ? raw.replace(/[^A-Za-z0-9 '\-]/g, "").trim().slice(0, 12) : "";
  return cleaned || "Pilgrim";
}

export class Player extends Schema {
  @type("number") x: number;
  @type("number") y: number;
  @type("number") targetX: number;
  @type("number") targetY: number;
  @type("string") cls: string;
  @type("string") name = "";
  @type("number") hp = PLAYER_MAX_HP;
  @type("number") maxHp = PLAYER_MAX_HP;
  @type("number") level = 1;
  @type("number") xp = 0;
  @type("number") mana = PLAYER_MAX_MANA;
  @type("number") maxMana = PLAYER_MAX_MANA;
  // attributes & unspent points — the character sheet
  @type("number") str = 20;
  @type("number") dex = 20;
  @type("number") vit = 20;
  @type("number") ene = 20;
  @type("number") statPoints = 0;
  @type("number") skillPoints = 0;
  // paragon: the endless track past level 99
  @type("number") paragonLevel = 0;
  @type("number") paragonXp = 0; // progress toward the next paragon level (for the bar)
  @type("number") paragonPoints = 0; // unspent paragon points
  paragonAlloc: Record<string, number> = {}; // perkId → points spent (server-only, in loadout)
  @type("number") deepestFloor = 1; // true depth high-water mark (danger units) — the ladder of legends
  @type("number") actsUnlocked = 1; // how far east the roads have opened for this hero
  @type("number") diffUnlocked = 1; // how sharp a world this hero has earned
  waypoints = new Set<string>(); // "act:floor" — every stone on the network this hero has touched
  abyssDeepest = 0; // deepest Abyss floor reached (the postgame ladder)
  seasonNum = CURRENT_SEASON; // which seasonal ladder this hero belongs to
  @type("number") riftBest = 0; // deepest Rift Tier cleared (synced for the HUD/ladder)
  diedAct = 0;
  @type("boolean") hardcore = false; // one life — everyone can see the skull
  @type("number") wolfUntil = 0; // druids run on all fours until this timestamp
  @type("number") potions = 0;
  @type("number") maxPotions = BASE_POTION_CAP;
  @type("number") manaPotions = 0;
  @type("number") gold = 0;
  // synced gear visuals — base-item keys so other clients can draw your kit
  @type("string") weaponBase = "";
  @type("string") offhandBase = "";
  @type("string") helmBase = "";
  @type("string") chestBase = "";
  @type("string") bootsBase = "";
  @type("string") beltBase = "";
  @type("number") gearTier = 0; // best equipped rarity (RARITY_ORDER index) — your visible swagger

  // server-only (not synced)
  lastAttack = 0;
  lastDamaged = 0;
  respawnAt = 0;
  gear: Partial<Record<EquipSlot, Item>> = {};
  inventory: Item[] = [];
  stashItems: Item[] = [];
  sharedStash: Item[] = []; // the ACCOUNT-wide stash — shared across all this player's heroes
  derived: ItemStats = {};
  persistKey = ""; // profile identity, from client join options
  accountKey = ""; // account identity — spans heroes, keys the shared stash
  portalAt = 0; // town portal completes at this timestamp
  returnX = 0; // where the portal leads back to
  returnY = 0;
  skillReady: Record<string, number> = {};
  skills: Record<string, number> = {}; // skill id → hard points
  binds: Partial<Record<SkillKey, string>> = {}; // Q/E/F → skill id
  shoutUntil = 0;
  buffDmgUntil = 0;
  buffMfUntil = 0;
  buffSpeedUntil = 0;
  curseVulnUntil = 0; // a dungeon bargain gone wrong — takes extra harm for a while
  effects = new Set<string>(); // unique effects from equipped gear
  powers = new Set<string>(); // legendary skill-powers that REWRITE a skill (from gear)
  lastCrit = false; // set by outgoingDamage, read by damageMonster for the hit broadcast
  lastElem: Element | "" = ""; // the dominant element of the last hit (for monster resists)
  lastElemFrac = 0; // …and how much of that hit was elemental (0..1)
  secondWindReadyAt = 0;
  chilledUntil = 0; // cold-struck players trudge
  lastChatAt = 0;
  lastPingAt = 0; // world pings are rate-limited too
  aegisReadyAt = 0; // Aegis: next free block
  deathlessReadyAt = 0; // Undying: next free death
  immuneUntil = 0; // brief invulnerability after cheating death
  attackCounter = 0; // Stormlord counts your swings
  zealCounter = 0; // Holy Fervor counts your Zeal casts
  shieldUntil = 0; // Sanctuary: swallows the next blow while this holds
  lastImmolationAt = 0; // Immolation burn tick
  questProgress: Record<string, number> = {}; // quest id → progress
  questsDone: string[] = []; // rewarded quests never pay twice
  merc: { cls: string; archetype: string; name: string; gear: Partial<Record<MercSlot, Item>>; dead: boolean } | null = null; // the hired companion's contract (one at a time)
  fallen = false; // hardcore death — this body does not get up
  diedTo = "";
  diedFloor = 0;
  diedAt = 0;

  constructor(x: number, y: number, cls: string) {
    super();
    this.x = this.targetX = x;
    this.y = this.targetY = y;
    this.cls = cls;
  }
}

export class Monster extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") hp = 1;
  @type("number") maxHp = 1;
  @type("string") kind: string = "zombie";
  @type("string") name: string = ""; // elites and special monsters
  @type("boolean") elite = false;
  @type("string") modifier: string = ""; // champion pack modifier id

  camp = -1; // -1 = not part of a camp (boss), -2 = boss-spawned add
  cdMult = 1; // attack cooldown multiplier
  lastAttack = 0;
  aggroed = false;
  aggroAt = 0;
  lastSeenX = 0; // where the quarry was last in view — hunted from memory when LOS breaks
  lastSeenY = 0;
  lastSeenAt = 0;
  dmgMult = 1;
  speedMult = 1;
  xpMult = 1;
  addAt = 0; // maggot queen brood timer
  novaAt = 0; // dread nova cycle
  novaFireAt = 0;
  slowUntil = 0; // frost nova chill
  stunUntil = 0; // bash / war cry stagger — no moving, no attacking
  element: Element | "" = ""; // enchanted champions deal typed damage
  explodeOnDeath = false; // Fire Enchanted
  vulnUntil = 0; // decrepified — takes extra damage
  curseSpreadsUntil = 0; // Plaguecarrier: this curse leaps to nearby foes when the host dies
  chargeAt = 0; // vuruk's next charge
  chargeUntil = 0; // …and how long the current one lasts
  chargeWindupUntil = 0; // …braced and telegraphing, before he launches
  bleedDmg = 0; // Bloodletter wound, per tick
  bleedTicksLeft = 0;
  bleedNextAt = 0;
  bleedBy = ""; // who opened the wound
  fleeUntil = 0; // fallen scatter when a packmate dies
  // behavioral champion timers (server-only; the client is driven by broadcasts)
  mortarAt = 0; // Mortar: when the next shell launches (telegraph begins)
  mortarFireAt = 0; // …and when the shell in the air lands
  mortarTX = 0; // the ground it was aimed at (locked at launch, so you can dodge)
  mortarTY = 0;
  wardUntil = 0; // Warded: incoming damage is refused while now < this
  nextWardAt = 0; // …and when the next bubble goes up
}

// a hired Rogue: follows her employer, shoots what threatens them, can die
export class Merc extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") hp = 1;
  @type("number") maxHp = 1;
  @type("string") name = "";
  @type("string") cls = "rogue"; // rogue | mage | barbarian | paladin — decides figure + attack
  @type("string") archetype = "fire";
  @type("string") weaponBase = ""; // gear visuals, like players
  @type("string") helmBase = "";
  @type("string") chestBase = "";

  // server-only
  dmgMin = 4;
  dmgMax = 7;
  crit = 5;
  armor = 0;
  cooldownMs = 1200;
  element: Element | "" = "";
  lastAttack = 0;
  lastDamaged = 0;
}

// a necromancer's servant: seeks, follows, bites; belongs to no monster list
export class Pet extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("string") kind: string = "skeleton";

  owner = ""; // sessionId of the summoner
  dmg = 0; // locked in at summon time
  until = 0;
  lastAttack = 0;
}

export class Projectile extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("string") kind: string = "arrow";

  vx = 0;
  vy = 0;
  bornAt = 0;
  owner = "";
  hostile = false; // fired by a monster, hits players
  dmg = 0;
  byName = ""; // who shot it, for the death recap
  mult = 0; // skill-scaled damage multiplier (0 = plain attack)
  chillMs = 0; // frost arrows chill on impact
  element: Element | "" = ""; // hostile projectiles may carry an element
}

export class GroundItem extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("string") kind: string = "item"; // "item" | "potion" | "gold"
  @type("string") rarity: string = "common";
  @type("string") name: string = "";
  @type("string") data: string = "{}";
  @type("number") amount = 0; // gold piles

  bornAt = 0;
}

export class Shrine extends Schema {
  @type("number") x = 0;
  @type("number") y = 0;
  @type("string") kind: string = "healing";
  @type("string") label: string = "";
  @type("string") variant: string = ""; // area portals: towerdoor/stairsup/cavemouth/…
  @type("boolean") used = false;
}

export class DungeonState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Monster }) monsters = new MapSchema<Monster>();
  @type({ map: Pet }) pets = new MapSchema<Pet>();
  @type({ map: Merc }) mercs = new MapSchema<Merc>(); // keyed by employer's sessionId
  @type({ map: Projectile }) projectiles = new MapSchema<Projectile>();
  @type({ map: GroundItem }) loot = new MapSchema<GroundItem>();
  @type({ map: Shrine }) shrines = new MapSchema<Shrine>();
  @type("number") act = 1;
  @type("number") difficulty = 1; // 1 Normal · 2 Nightmare · 3 Hell
  @type("number") floor = 1;
  @type("string") zoneName = "";
  @type("string") mapData = "";
  @type("number") stairsX = 0;
  @type("number") stairsY = 0;
  // the floor's bounty — a reason to do more than run for the stairs
  @type("string") bountyText = "";
  @type("number") bountyProgress = 0;
  @type("number") bountyGoal = 1;
  @type("boolean") bountyDone = false;
  // floor 1 only: the cathedral's tile rect, so the client can dress it in stone
  @type("number") cathedralX = -1;
  @type("number") cathedralY = -1;
  @type("number") cathedralW = 0;
  @type("number") cathedralH = 0;
  // floor 1 only: tower/cave interior rects (JSON) so the client dresses them right
  @type("string") areasData = "";
  // the surface has a sky, and the sky has moods: "" | "clear" | "rain" | "mist"
  @type("string") weather = "";
}

// a trade in progress: offers stay in their owners' bags until the final handshake
interface TradeSession {
  a: string;
  b: string;
  items: Record<string, string[]>; // sid → offered item ids
  gold: Record<string, number>;
  confirmed: Record<string, boolean>;
}

export class DungeonRoom extends Room<DungeonState> {
  maxClients = 8;

  private nextId = 0;
  private map!: GameMap;
  private layout!: DungeonLayout;
  private campAlive: number[] = [];
  private campRespawnAt: number[] = [];
  private bossRespawnAt = 0;
  private pendingTravel: { act: number; floor: number; atWaypoint?: boolean } | null = null; // ALL travel funnels through here
  private areaPortals = new Map<string, { x: number; y: number }>(); // shrine id → destination
  private vendorStock: Array<{ item: Item; price: number }> = []; // Torvald's shelves
  private mercOfferSeed = 1; // which three sisters stand with Maren this floor
  private gambleStock: Array<{ id: string; base: string; name: string; price: number }> = []; // Fenwick's spread
  // live trades: both partners' sessionIds map to the same session object
  private trades = new Map<string, TradeSession>();
  private tradeInvites = new Map<string, { from: string; at: number }>(); // keyed by invitee
  private lastPersistAt = 0;
  private victoryAnnounced = false;
  private isCowLevel = false;
  private pendingCow = false; // a red portal was touched — moo awaits
  private isRift = false; // this instance is a Rift (a self-contained, pushable endgame run)
  private riftTier = 0;
  private riftBossSpawned = false;
  private preRiftAct = 1; // the act to return to when the Rift is done
  private pendingRift = 0; // a rift portal was touched — enter at this tier (0 = none)
  private bountyKind: BountyKind = "kills";
  // burning ground (firewall lines, meteor craters) — a segment with width;
  // a hurricane is a hazard that follows its druid and chills what it touches
  private hazards: Array<{
    ax: number; ay: number; bx: number; by: number;
    width: number; until: number; nextTick: number; owner: string; mult: number;
    followSid?: string; chill?: boolean;
  }> = [];

  onCreate(options?: { difficulty?: number; key?: string }) {
    ensureDataDir();
    this.setState(new DungeonState());
    // the forge asks for a difficulty; the creator's own record decides what's allowed
    const asked = Math.max(1, Math.min(DIFFICULTIES.length, Math.floor(Number(options?.difficulty) || 1)));
    let allowed = 1;
    if (options?.key && validKey(options.key)) {
      const prof = loadProfile(options.key);
      allowed = Math.max(1, prof?.diffUnlocked ?? 1);
    }
    this.state.difficulty = Math.min(asked, allowed);
    this.startFloor(1, 1);

    this.onMessage("move", (client: Client, msg: { x: number; y: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0) return;
      if (!this.validCoords(msg)) return;
      if (!canStand(this.map, msg.x, msg.y)) return;
      p.targetX = msg.x;
      p.targetY = msg.y;
    });

    this.onMessage("attack", (client: Client, msg: { x: number; y: number }) => {
      this.handleAttack(client.sessionId, msg);
    });

    this.onMessage("skill", (client: Client, msg: { key: string; x: number; y: number }) => {
      this.handleSkill(client.sessionId, msg);
    });

    this.onMessage("allocstat", (client: Client, msg: { attr: string }) => this.handleAllocStat(client, msg));
    this.onMessage("allocskill", (client: Client, msg: { id: string }) => this.handleAllocSkill(client, msg));
    this.onMessage("respec", (client: Client) => this.handleRespec(client));
    this.onMessage("allocparagon", (client: Client, msg: { id: string }) => this.handleAllocParagon(client, msg));
    this.onMessage("bindskill", (client: Client, msg: { id: string; key: string }) => this.handleBindSkill(client, msg));
    this.onMessage("pickup", (client: Client, msg: { id: string }) => this.handlePickup(client, msg));
    this.onMessage("equip", (client: Client, msg: { id: string }) => this.handleEquip(client, msg));
    this.onMessage("unequip", (client: Client, msg: { slot: EquipSlot }) => this.handleUnequip(client, msg));
    this.onMessage("dropitem", (client: Client, msg: { id: string }) => this.handleDropItem(client, msg));
    this.onMessage("drink", (client: Client) => this.handleDrink(client));
    this.onMessage("drinkmana", (client: Client) => this.handleDrinkMana(client));
    // Dev-only, self-only: let an automated smoke client end its OWN hero on demand,
    // routed through the real damage pipeline so permadeath is exercised (epitaph,
    // grave, persist, re-entry lockout) rather than bypassed. Never in production, and
    // it can never touch another player — combat already lets anyone die, so this grants
    // no advantage. It exists purely so the hardcore test isn't hostage to Act-I monster
    // DPS barely out-pacing a hero's 3 HP/s regen.
    if (TEST_HOOKS) {
      this.onMessage("smokekill", (client: Client) => {
        const p = this.state.players.get(client.sessionId);
        if (!p || p.hp <= 0) return;
        p.immuneUntil = 0; // clear the safety nets a debug kill shouldn't be foiled by
        for (const e of ["aegis", "mana_shield", "second_wind", "deathless"]) p.effects.delete(e);
        // credit the nearest monster for a truthful epitaph; the dark, if none is near
        let by = "the dark";
        let best = Infinity;
        this.state.monsters.forEach((m) => {
          const d = Math.hypot(m.x - p.x, m.y - p.y);
          if (d < best) { best = d; by = this.monsterLabel(m); }
        });
        // more than enough to punch past armor; loop guards the vanishing dodge chance
        for (let i = 0; i < 12 && p.hp > 0; i++) this.damagePlayer(client.sessionId, p, p.maxHp * 10, by);
      });
      // Dev-only: drop a lone champion of a named modifier beside the caller, so the smoke
      // suite can exercise behavioral pack affixes deterministically (they're a ~20% random roll
      // otherwise). Returns the mob's id so the probe can watch it heal / reflect.
      this.onMessage("smokespawnchamp", (client: Client, msg: { modifier?: string; hp?: number }) => {
        const p = this.state.players.get(client.sessionId);
        if (!p) return;
        const champion = CHAMPION_MODS.find((c) => c.id === msg?.modifier);
        if (!champion) return;
        const m = new Monster();
        const kind: MonsterKind = "zombie"; // a plain melee body so behavior is unambiguous
        const def = MONSTERS[kind];
        m.kind = kind;
        const pos = this.scatter(p.x, p.y, 40);
        m.x = pos.x;
        m.y = pos.y;
        m.hp = m.maxHp = Math.round((msg?.hp && msg.hp > 0 ? msg.hp : def.maxHp) * champion.hpMult);
        m.modifier = champion.id;
        m.name = `${champion.label} ${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
        m.dmgMult = champion.dmgMult;
        m.speedMult = champion.speedMult;
        m.cdMult = champion.cdMult;
        m.xpMult = CHAMPION_XP_MULT;
        m.element = champion.element ?? "";
        m.explodeOnDeath = !!champion.explode;
        m.camp = -3; // belongs to no camp — never respawns
        const id = `champ_${this.nextId++}`;
        this.state.monsters.set(id, m);
        client.send("smokechamp", { id });
      });
      // Dev-only: remove a specific spawned monster (so an affix probe can reset between runs).
      this.onMessage("smokeclear", (_client: Client, msg: { id?: string }) => {
        if (msg?.id) this.state.monsters.delete(msg.id);
      });
      // Dev-only, self-only: give the caller a huge hp pool so an affix probe can sit in sustained
      // combat without dying and respawning back to town (which would break aggro-gated tests).
      // NOT immunity — the hero still takes real, measurable damage, just can't be killed mid-probe.
      this.onMessage("smokegod", (client: Client) => {
        const p = this.state.players.get(client.sessionId);
        if (!p) return;
        p.maxHp = 100000;
        p.hp = 100000;
        p.mana = p.maxMana;
        p.immuneUntil = 0;
      });
      // Dev-only, self-only: hand the caller an identified magic/rare item and a pile of gold so an
      // altar probe can deterministically reforge (a reforgeable item + funds aren't guaranteed to
      // exist mid-grind). Returns the item's id so the probe can watch it change.
      this.onMessage("smokegive", (client: Client, msg: { rarity?: string }) => {
        const p = this.state.players.get(client.sessionId);
        if (!p) return;
        const rarity: Rarity = msg?.rarity === "rare" ? "rare" : "magic";
        const it = generateItem(Math.max(1, this.danger()), 0, Math.random, [[rarity, 1]]);
        delete it.unidentified;
        p.inventory.push(it);
        p.gold += 5000;
        this.sendLoadout(client, p);
        client.send("smokegave", { id: it.id, name: it.name, rarity: it.rarity });
      });
      // Dev-only, self-only: grant a legendary skill-power directly (the gear→p.powers plumbing is
      // already proven; this lets a probe exercise a skill handler's power branch without farming
      // the exact epic). Cleared on the next recompute, which is fine for an immediate cast test.
      this.onMessage("smokepower", (client: Client, msg: { id?: string }) => {
        const p = this.state.players.get(client.sessionId);
        if (!p || !msg?.id) return;
        p.powers.add(msg.id);
        client.send("smokepowered", { id: msg.id });
      });
      // Dev-only, self-only: jump the hero to a high level with spare skill points so a probe can
      // learn tier-gated skills (and their prereqs) to test every class's powers without grinding.
      this.onMessage("smokelevel", (client: Client, msg: { level?: number; points?: number }) => {
        const p = this.state.players.get(client.sessionId);
        if (!p) return;
        p.level = Math.max(p.level, Math.min(99, Math.floor(msg?.level ?? 20)));
        p.skillPoints += Math.floor(msg?.points ?? 30);
        this.recompute(p);
        this.sendLoadout(client, p);
        client.send("smokeleveled", { level: p.level, skillPoints: p.skillPoints });
      });
    }
    this.onMessage("socketrune", (client: Client, msg: { runeId: string; itemId: string }) =>
      this.handleSocketRune(client, msg)
    );
    this.onMessage("identify", (client: Client, msg: { id: string }) => this.handleIdentify(client, msg));
    this.onMessage("opensmith", (client: Client) => this.sendSmith(client));
    this.onMessage("openaltar", (client: Client) => this.sendAltar(client));
    this.onMessage("altarrecipe", (client: Client, msg: { recipe?: string }) => this.handleAltarRecipe(client, msg));
    this.onMessage("reforge", (client: Client, msg: { id?: string }) => this.handleReforge(client, msg));
    this.onMessage("punchsockets", (client: Client, msg: { id: string }) => this.handlePunchSockets(client, msg));
    this.onMessage("unsocket", (client: Client, msg: { id: string }) => this.handleUnsocket(client, msg));
    this.onMessage("touchshrine", (client: Client, msg: { id: string }) => this.handleShrine(client, msg));
    this.onMessage("chat", (client: Client, msg: { text: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof msg?.text !== "string") return;
      const now = Date.now();
      if (now - p.lastChatAt < 800) return; // no flooding the war channel
      const text = msg.text.replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 120);
      if (!text) return;
      p.lastChatAt = now;
      this.broadcast("chat", { name: p.name || p.cls, cls: p.cls, text });
    });

    this.onMessage("usestairs", (client: Client) => {
      // descending is deliberate: you must ask, and you must be standing there
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0) return;
      // a Rift is a single sealed arena — there is no way down, only through the horde. The lock
      // message reflects where you ARE in the run, so it never misleads (esp. once it's cleared).
      if (this.isRift) {
        let text: string;
        if (this.state.bountyDone) {
          text = "the Rift is spent — step through the portal to go home";
        } else if (this.riftBossSpawned) {
          text = "the Rift Warden bars the way — put it down, then take the portal home";
        } else {
          text = `a Rift has no stairs — cull the horde (${this.state.bountyProgress}/${this.state.bountyGoal}) to summon the Warden`;
        }
        client.send("stairslocked", { text });
        return;
      }
      if (Math.hypot(p.x - this.state.stairsX, p.y - this.state.stairsY) > STAIRS_USE_RANGE) return;
      const act = this.state.act;
      const floor = this.state.floor;
      if (act >= ABYSS_ACT || floor < ACT_FLOORS) {
        this.pendingTravel = { act, floor: floor + 1 };
      } else if (p.actsUnlocked > act) {
        // the act boss has fallen for this hero — the stairs lead into the next land
        this.pendingTravel = { act: act + 1, floor: 1 };
      } else {
        const guard = BOSS_NAMES[ACTS[act - 1].actBoss];
        client.send("stairslocked", { text: `the way onward is sealed while ${guard} reigns` });
      }
    });
    // the waypoint network: jump anywhere you have earned, and take the party with you
    this.onMessage("waypointjump", (client: Client, msg: { act?: number; floor?: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0) return;
      const act = Math.floor(Number(msg?.act) || 0);
      const floor = Math.floor(Number(msg?.floor) || 0);
      if (act < 1 || floor < 1 || act > p.actsUnlocked) return;
      if (act < ABYSS_ACT && floor > ACT_FLOORS) return;
      if (!p.waypoints.has(`${act}:${floor}`)) return;
      if (act === this.state.act && floor === this.state.floor && !this.isCowLevel) return;
      let near = false; // the network only answers from one of its stones
      this.state.shrines.forEach((s) => {
        if (s.kind === "waypoint" && Math.hypot(p.x - s.x, p.y - s.y) <= TOWN_INTERACT_RANGE) near = true;
      });
      if (!near) return;
      this.pendingTravel = { act, floor, atWaypoint: true }; // arrive AT the destination stone, not the entrance
      this.broadcast("waypointfx", { x: p.x, y: p.y, by: client.sessionId });
    });
    this.onMessage("townportal", (client: Client) => this.handleTownPortal(client));
    // G pings the world: a pulse everyone sees — "here, look HERE"
    this.onMessage("ping", (client: Client, msg: { x: number; y: number }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !this.validCoords(msg)) return;
      const now = Date.now();
      if (now - p.lastPingAt < 1000) return;
      p.lastPingAt = now;
      this.broadcast("ping", { x: msg.x, y: msg.y, by: client.sessionId, name: p.name || p.cls });
    });
    // clients ask for the quest log once their handlers are wired up
    this.onMessage("getquests", (client: Client) => {
      const p = this.state.players.get(client.sessionId);
      if (p) this.sendQuests(client.sessionId, p);
    });
    // the alchemist's trade: flasks for gold, while you stand at her stall
    this.onMessage("buypotion", (client: Client, msg: { kind?: string; fill?: boolean }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0) return;
      if (Math.hypot(p.x - TOWN.alchemist.x, p.y - TOWN.alchemist.y) > TOWN_INTERACT_RANGE) return;
      const kind = msg?.kind === "mana" ? "mana" : "health";
      const price = POTION_PRICES[kind];
      let bought = 0;
      // fill: top the belt off in one click, as far as the purse allows
      const wanted = msg?.fill ? p.maxPotions : 1;
      while (bought < wanted) {
        if (p.gold < price) break;
        if (kind === "health" ? p.potions >= p.maxPotions : p.manaPotions >= p.maxPotions) break;
        p.gold -= price;
        if (kind === "health") p.potions++;
        else p.manaPotions++;
        bought++;
      }
      if (bought > 0) {
        client.send("shopbought", { kind, count: bought, gold: p.gold });
      } else {
        const full = kind === "health" ? p.potions >= p.maxPotions : p.manaPotions >= p.maxPotions;
        client.send("shopfail", { reason: full ? "full" : "gold" });
      }
    });
    // --- the trade ring: two heroes, one handshake ---
    this.onMessage("tradeinvite", (client: Client, msg: { target?: string }) => {
      const p = this.state.players.get(client.sessionId);
      const target = typeof msg?.target === "string" ? msg.target : "";
      const tp = this.state.players.get(target);
      if (!p || !tp || p.hp <= 0 || tp.hp <= 0 || target === client.sessionId) return;
      if (this.trades.has(client.sessionId) || this.trades.has(target)) return;
      if (Math.hypot(p.x - tp.x, p.y - tp.y) > TRADE_RANGE) {
        client.send("tradeclosed", { reason: "too far away — stand beside them" });
        return;
      }
      this.tradeInvites.set(target, { from: client.sessionId, at: Date.now() });
      this.clientOf(target)?.send("tradeinvite", { from: client.sessionId, name: p.name || p.cls });
      client.send("tradehint", { text: "trade offered — waiting for an answer" });
    });
    this.onMessage("tradeaccept", (client: Client) => {
      const inv = this.tradeInvites.get(client.sessionId);
      if (!inv || Date.now() - inv.at > TRADE_INVITE_TTL_MS) return;
      this.tradeInvites.delete(client.sessionId);
      const a = inv.from;
      const b = client.sessionId;
      const pa = this.state.players.get(a);
      const pb = this.state.players.get(b);
      if (!pa || !pb || pa.hp <= 0 || pb.hp <= 0) return;
      if (this.trades.has(a) || this.trades.has(b)) return;
      if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > TRADE_RANGE) return;
      const t: TradeSession = {
        a, b,
        items: { [a]: [], [b]: [] },
        gold: { [a]: 0, [b]: 0 },
        confirmed: { [a]: false, [b]: false },
      };
      this.trades.set(a, t);
      this.trades.set(b, t);
      this.clientOf(a)?.send("tradeopen", { partner: b, name: pb.name || pb.cls });
      this.clientOf(b)?.send("tradeopen", { partner: a, name: pa.name || pa.cls });
      this.sendTradeState(t);
    });
    this.onMessage("tradedecline", (client: Client) => {
      const inv = this.tradeInvites.get(client.sessionId);
      if (!inv) return;
      this.tradeInvites.delete(client.sessionId);
      this.clientOf(inv.from)?.send("tradeclosed", { reason: "declined" });
    });
    this.onMessage("tradeset", (client: Client, msg: { itemIds?: unknown; gold?: unknown }) => {
      const t = this.trades.get(client.sessionId);
      const p = this.state.players.get(client.sessionId);
      if (!t || !p) return;
      const raw = Array.isArray(msg?.itemIds) ? msg.itemIds.filter((x): x is string => typeof x === "string") : [];
      const ids: string[] = [];
      for (const id of raw) {
        if (ids.length >= TRADE_MAX_ITEMS) break;
        if (!ids.includes(id) && p.inventory.some((it) => it.id === id)) ids.push(id);
      }
      t.items[client.sessionId] = ids;
      t.gold[client.sessionId] = Math.max(0, Math.min(Math.floor(Number(msg?.gold) || 0), p.gold));
      t.confirmed[t.a] = false; // any change voids both signatures — the anti-scam law
      t.confirmed[t.b] = false;
      this.sendTradeState(t);
    });
    this.onMessage("tradeconfirm", (client: Client) => {
      const t = this.trades.get(client.sessionId);
      if (!t) return;
      t.confirmed[client.sessionId] = true;
      if (t.confirmed[t.a] && t.confirmed[t.b]) this.executeTrade(t);
      else this.sendTradeState(t);
    });
    this.onMessage("tradecancel", (client: Client) => {
      const t = this.trades.get(client.sessionId);
      if (t) this.cancelTrade(t, "cancelled");
    });

    // the hiring halls' ledger: hire, revive, and outfit your companion
    this.onMessage("hiremerc", (client: Client, msg: { classId?: string; archetype?: string; name?: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0) return;
      const mcls = mercClassById(msg?.classId);
      // must stand at the muster post; only this act's school is offered here
      if (Math.hypot(p.x - TOWN.maren.x, p.y - TOWN.maren.y) > TOWN_INTERACT_RANGE) return;
      if (mcls.id !== recruiterForAct(this.state.act).id) return; // no hiring another act's school
      if (p.actsUnlocked < mcls.unlockAct) {
        client.send("shopfail", { reason: "locked" });
        return;
      }
      const arch = mcls.archetypes.find((a) => a.id === msg?.archetype) ?? mcls.archetypes[0];
      const cost = mercHireCost(p.level);
      if (p.gold < cost) {
        client.send("shopfail", { reason: "gold" });
        return;
      }
      p.gold -= cost;
      // a new contract voids the old one — gear on the old companion comes home first
      if (p.merc) {
        for (const slot of MERC_SLOTS) {
          const it = p.merc.gear[slot];
          if (it && p.inventory.length < INVENTORY_SIZE) p.inventory.push(it);
        }
      }
      const name = typeof msg?.name === "string" && mcls.names.includes(msg.name)
        ? msg.name
        : mcls.names[Math.floor(Math.random() * mcls.names.length)];
      p.merc = { cls: mcls.id, archetype: arch.id, name, gear: {}, dead: false };
      this.state.mercs.delete(client.sessionId);
      this.spawnMercFor(client.sessionId, p);
      this.persist(p);
      client.send("merchired", { name, cls: mcls.id, archetype: arch.id });
      this.sendMercOffers(client, p, mcls.id);
      this.sendMercLoadout(client, p);
      this.sendLoadout(client, p);
      this.broadcast("announce", { text: `${name} the ${mcls.className} now marches with ${p.name || p.cls}` });
    });
    this.onMessage("revivemerc", (client: Client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0 || !p.merc || !p.merc.dead) return;
      const mcls = mercClassById(p.merc.cls);
      // any recruiter at the muster post will raise your fallen companion
      if (Math.hypot(p.x - TOWN.maren.x, p.y - TOWN.maren.y) > TOWN_INTERACT_RANGE) return;
      const cost = mercReviveCost(p.level);
      if (p.gold < cost) {
        client.send("shopfail", { reason: "gold" });
        return;
      }
      p.gold -= cost;
      p.merc.dead = false;
      this.spawnMercFor(client.sessionId, p);
      this.persist(p);
      client.send("merchired", { name: p.merc.name, cls: p.merc.cls, archetype: p.merc.archetype, revived: true });
      this.sendMercOffers(client, p, mcls.id);
      this.sendMercLoadout(client, p);
    });
    // hand the Rogue a weapon, helm, or chestpiece from your bag
    this.onMessage("mercequip", (client: Client, msg: { id?: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !p.merc || p.merc.dead) return;
      const idx = p.inventory.findIndex((it) => it.id === msg?.id);
      if (idx < 0) return;
      const item = p.inventory[idx];
      if (item.unidentified) return; // she won't wear mysteries either
      if (!(MERC_SLOTS as readonly string[]).includes(item.slot)) return; // no jewelry on the payroll
      const slot = item.slot as MercSlot;
      p.inventory.splice(idx, 1);
      const prev = p.merc.gear[slot];
      if (prev) p.inventory.push(prev);
      p.merc.gear[slot] = item;
      this.recomputeMerc(client.sessionId, p);
      this.persist(p);
      this.sendLoadout(client, p);
      this.sendMercLoadout(client, p);
    });
    this.onMessage("mercunequip", (client: Client, msg: { slot?: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !p.merc) return;
      if (!(MERC_SLOTS as readonly string[]).includes(msg?.slot ?? "")) return;
      const slot = msg!.slot as MercSlot;
      const item = p.merc.gear[slot];
      if (!item || p.inventory.length >= INVENTORY_SIZE) return;
      delete p.merc.gear[slot];
      p.inventory.push(item);
      this.recomputeMerc(client.sessionId, p);
      this.persist(p);
      this.sendLoadout(client, p);
      this.sendMercLoadout(client, p);
    });
    this.onMessage("getmercloadout", (client: Client) => {
      const p = this.state.players.get(client.sessionId);
      if (p) this.sendMercLoadout(client, p);
    });

    // one click, an orderly bag: slot order, then rarity, then depth
    this.onMessage("sortbag", (client: Client) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const slotRank = (it: Item) =>
        ["weapon", "offhand", "helm", "chest", "belt", "boots", "ring", "amulet", "charm", "rune", "jewel"].indexOf(it.slot);
      p.inventory.sort(
        (a, b) =>
          slotRank(a) - slotRank(b) ||
          RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) ||
          b.ilvl - a.ilvl
      );
      this.sendLoadout(client, p);
    });
    // Torvald's shelves: identified goods, honest quality, dishonest prices
    this.onMessage("buyitem", (client: Client, msg: { id?: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0) return;
      if (Math.hypot(p.x - TOWN.vendor.x, p.y - TOWN.vendor.y) > TOWN_INTERACT_RANGE) return;
      const idx = this.vendorStock.findIndex((e) => e.item.id === msg?.id);
      if (idx < 0) return;
      const entry = this.vendorStock[idx];
      if (p.gold < entry.price) {
        client.send("shopfail", { reason: "gold" });
        return;
      }
      if (p.inventory.length >= INVENTORY_SIZE) {
        client.send("shopfail", { reason: "bag" });
        return;
      }
      p.gold -= entry.price;
      p.inventory.push(entry.item);
      this.vendorStock[idx] = this.rollVendorItem(); // the shelf never stays empty
      client.send("vendorbought", { name: entry.item.name, rarity: entry.item.rarity, gold: p.gold });
      this.sendVendor(client);
      this.sendLoadout(client, p);
    });
    // Fenwick's spread: you pay for the base; the roll is between you and fate
    this.onMessage("gambleitem", (client: Client, msg: { id?: string }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0) return;
      if (Math.hypot(p.x - TOWN.fenwick.x, p.y - TOWN.fenwick.y) > TOWN_INTERACT_RANGE) return;
      const idx = this.gambleStock.findIndex((e) => e.id === msg?.id);
      if (idx < 0) return;
      const slot = this.gambleStock[idx];
      if (p.gold < slot.price) {
        client.send("gamblefail", { cost: slot.price });
        return;
      }
      if (p.inventory.length >= INVENTORY_SIZE) {
        client.send("shopfail", { reason: "bag" });
        return;
      }
      p.gold -= slot.price;
      const ilvl = gambleIlvl(this.danger());
      const item = generateItem(ilvl, this.magicFindOf(p), Math.random, GAMBLE_WEIGHTS, slot.base, this.mythicMult());
      // the tier shows, the truth doesn't — identifying is the second gamble
      if (UNIDENTIFIED_RARITIES.includes(item.rarity)) item.unidentified = true;
      p.inventory.push(item);
      this.questAdvance(p, client.sessionId, "gambler");
      this.gambleStock[idx] = this.rollGambleSlot();
      this.broadcast("gamblefx", { x: TOWN.fenwick.x, y: TOWN.fenwick.y, by: client.sessionId });
      client.send("gambled", { rarity: item.rarity, base: item.base, ilvl: item.ilvl, unidentified: !!item.unidentified, name: item.unidentified ? slot.name : item.name });
      this.sendGamble(client);
      this.sendLoadout(client, p);
    });
    this.onMessage("stashput", (client: Client, msg: { id: string }) => this.handleStashPut(client, msg));
    this.onMessage("stashtake", (client: Client, msg: { id: string }) => this.handleStashTake(client, msg));
    this.onMessage("sharedstashput", (client: Client, msg: { id: string }) => this.handleSharedStashPut(client, msg));
    this.onMessage("sharedstashtake", (client: Client, msg: { id: string }) => this.handleSharedStashTake(client, msg));
    this.onMessage("sellitem", (client: Client, msg: { id: string }) => this.handleSell(client, msg));

    this.setSimulationInterval((dt) => this.update(dt), 1000 / TICK_RATE);
    console.log(`[room ${this.roomId}] created`);
  }

  onJoin(client: Client, options?: { key?: string; cls?: string; name?: string; randomize?: boolean; hardcore?: boolean; account?: string }) {
    const index = this.state.players.size;
    const key = validKey(options?.key) ? options!.key! : "";
    const profile = key ? loadProfile(key) : null;
    const accountKey = validKey(options?.account) ? options!.account! : "";

    // one hero, one body — a second window must bring a different character
    if (key) {
      let duplicate = false;
      this.state.players.forEach((p) => {
        if (p.persistKey === key) duplicate = true;
      });
      if (duplicate) throw new Error("hero_already_here");
    }

    // the fallen do not return — hardcore is a promise, and we keep it
    const preProfile = key ? loadProfile(key) : null;
    if (preProfile?.dead) throw new Error("hero_fallen");
    // a sharpened world must be earned — guests and unproven heroes stay in Normal games
    if (this.state.difficulty > Math.max(1, preProfile?.diffUnlocked ?? 1)) throw new Error("difficulty_locked");

    // class: saved profile wins; then the creation screen's choice; then round-robin
    const requested = typeof options?.cls === "string" ? options.cls : "";
    const cls = profile?.cls && (CLASSES as readonly string[]).includes(profile.cls)
      ? profile.cls
      : (CLASSES as readonly string[]).includes(requested)
        ? requested
        : CLASSES[index % CLASSES.length];
    // on the surface, heroes arrive in town; underground, the camp is sealed —
    // late joiners land at the floor's entrance, beside the fight
    const joinAt = this.state.floor > 1 && this.layout ? this.layout.spawn : TOWN.spawn;
    const player = new Player(
      joinAt.x + (index % 3) * 24,
      joinAt.y + Math.floor(index / 3) * 20,
      cls
    );
    player.persistKey = key;
    player.accountKey = accountKey;
    if (accountKey) player.sharedStash = loadAccount(accountKey).sharedStash ?? [];
    player.name = sanitizeName(profile?.name ?? options?.name);

    const base = CLASS_BASE_ATTRS[cls as ClassName];
    player.str = base.str;
    player.dex = base.dex;
    player.vit = base.vit;
    player.ene = base.ene;
    player.skillPoints = 1; // level 1 hero picks a first skill

    player.hardcore = options?.hardcore === true;
    if (profile) {
      // welcome back — restore the hero
      player.hardcore = profile.hardcore === true;
      player.level = Math.max(1, profile.level);
      player.xp = Math.max(0, profile.xp);
      player.gold = Math.max(0, profile.gold);
      player.potions = Math.max(0, profile.potions);
      player.manaPotions = Math.max(0, profile.manaPotions ?? 0);
      player.gear = profile.gear ?? {};
      player.inventory = profile.inventory ?? [];
      player.stashItems = profile.stash ?? [];
      player.deepestFloor = Math.max(1, profile.deepestFloor ?? 1);
      player.actsUnlocked = Math.max(1, profile.actsUnlocked ?? 1);
      player.diffUnlocked = Math.max(1, profile.diffUnlocked ?? 1);
      player.waypoints = new Set(profile.waypoints ?? ["1:1"]);
      player.abyssDeepest = Math.max(0, profile.abyssDeepest ?? 0);
      player.questProgress = profile.quests ?? {};
      player.questsDone = profile.questsDone ?? [];
      // legacy saves predate the class field — every old companion was a Rogue
      player.merc = profile.merc ? { ...profile.merc, cls: profile.merc.cls ?? "rogue" } : null;
      if (profile.attrs) {
        player.str = profile.attrs.str;
        player.dex = profile.attrs.dex;
        player.vit = profile.attrs.vit;
        player.ene = profile.attrs.ene;
        player.statPoints = Math.max(0, profile.statPoints ?? 0);
        player.skillPoints = Math.max(0, profile.skillPoints ?? 0);
        player.skills = profile.skills ?? {};
        // migrate legacy skill binds (Q/E/F) to the number row (1/2/3); keep valid 1-6
        {
          const legacy: Record<string, SkillKey> = { Q: "1", E: "2", F: "3" };
          const raw = (profile.binds ?? {}) as Record<string, string>;
          const migrated: Partial<Record<SkillKey, string>> = {};
          for (const [k, v] of Object.entries(raw)) {
            const key = (legacy[k] ?? k) as SkillKey;
            if (v && SKILL_KEYS.includes(key)) migrated[key] = v;
          }
          player.binds = migrated;
        }
        player.paragonLevel = Math.max(0, profile.paragonLevel ?? 0);
        player.paragonXp = Math.max(0, profile.paragonXp ?? 0);
        player.paragonPoints = Math.max(0, profile.paragonPoints ?? 0);
        player.paragonAlloc = profile.paragonAlloc ?? {};
        player.seasonNum = profile.season ?? 1; // pre-season heroes belong to season 1
        player.riftBest = Math.max(0, profile.riftTier ?? 0);
      } else {
        // pre-attribute hero: hand back everything they've earned, unspent
        player.statPoints = STAT_POINTS_PER_LEVEL * (player.level - 1);
        player.skillPoints = SKILL_POINTS_PER_LEVEL * player.level;
      }
    } else if (options?.randomize) {
      // a stranger arrives, forged to match the party
      this.randomizeHero(player, options?.name);
    }

    // you're standing here now — the ladder and the roads should know it
    player.deepestFloor = Math.max(player.deepestFloor, this.danger());
    player.actsUnlocked = Math.max(player.actsUnlocked, Math.min(this.state.act, ACTS.length + 1));
    player.waypoints.add(`${Math.min(this.state.act, ABYSS_ACT)}:1`);
    if (this.state.act >= ABYSS_ACT) player.abyssDeepest = Math.max(player.abyssDeepest, this.state.floor);

    this.state.players.set(client.sessionId, player);
    this.recompute(player);
    player.hp = player.maxHp;
    player.mana = player.maxMana;
    player.potions = Math.min(player.potions, player.maxPotions);
    this.sendLoadout(client, player);
    // the log arrives with the hero; floor-gated quests complete on the next DESCENT
    this.sendQuests(client.sessionId, player);
    // …and if a Rogue is on the payroll, she reports for duty
    if (player.merc && !player.merc.dead) this.spawnMercFor(client.sessionId, player);
    this.sendMercLoadout(client, player);
    console.log(
      `[room ${this.roomId}] ${client.sessionId} joined as ${player.name || "(unnamed)"} the ${cls} lvl ${player.level}${profile ? " (returning)" : ""} (${this.state.players.size} players)`
    );
  }

  onLeave(client: Client) {
    this.cancelTradesFor(client.sessionId, "a partner left");
    const p = this.state.players.get(client.sessionId);
    if (p) this.persist(p);
    this.state.players.delete(client.sessionId);
    // the master leaves; the servants crumble
    const orphans: string[] = [];
    this.state.pets.forEach((pet, id) => {
      if (pet.owner === client.sessionId) orphans.push(id);
    });
    orphans.forEach((id) => this.state.pets.delete(id));
    this.state.mercs.delete(client.sessionId); // the Rogue walks out with her employer
    console.log(`[room ${this.roomId}] ${client.sessionId} left (${this.state.players.size} players)`);
  }

  // forge a hero to match the party: same level as the strongest member,
  // random legal skill build, random gear at this floor's item level
  private randomizeHero(p: Player, requestedName?: string) {
    let level = 1;
    this.state.players.forEach((o) => (level = Math.max(level, o.level)));
    const ilvl = Math.max(1, this.danger());
    const cls = p.cls as ClassName;

    if (!requestedName || sanitizeName(requestedName) === "Pilgrim") {
      const POOL = ["Osric", "Hedda", "Jorund", "Petra", "Alwin", "Greta", "Corbin", "Maud", "Silas", "Ysolt"];
      p.name = POOL[Math.floor(Math.random() * POOL.length)];
    }

    p.level = level;
    p.xp = 0;

    // attributes: lean into the class, keep some meat on the bones
    const off = CLASS_OFFENSIVE_ATTR[cls];
    for (let i = 0; i < STAT_POINTS_PER_LEVEL * (level - 1); i++) {
      const roll = Math.random();
      const attr: AttrName = roll < 0.4 ? off : roll < 0.7 ? "vit" : ATTRS[Math.floor(Math.random() * ATTRS.length)];
      p[attr]++;
    }
    p.statPoints = 0;

    // skills: spend every point on a random legal choice, binding actives as they come
    p.skillPoints = SKILL_POINTS_PER_LEVEL * level;
    const nodes = SKILL_TREES[cls] ?? [];
    for (let i = 0; i < 200 && p.skillPoints > 0; i++) {
      const legal = nodes.filter((n) => canAllocSkill(n, p.skills, p.level, p.skillPoints));
      if (!legal.length) break;
      const node = legal[Math.floor(Math.random() * legal.length)];
      p.skillPoints--;
      p.skills[node.id] = (p.skills[node.id] ?? 0) + 1;
      if (node.type !== "passive" && p.skills[node.id] === 1 && !Object.values(p.binds).includes(node.id)) {
        const free = SKILL_KEYS.find((k) => !p.binds[k]);
        if (free) p.binds[free] = node.id;
      }
    }

    // gear: roll until each slot fills (or luck runs out)
    for (const slot of EQUIP_SLOTS) {
      const want = slot === "ring1" || slot === "ring2" ? "ring" : slot;
      for (let tries = 0; tries < 40; tries++) {
        const item = generateItem(ilvl, 60);
        if (item.slot === want) {
          p.gear[slot] = item;
          break;
        }
      }
    }
    p.inventory.push(generateCharm(ilvl, 0)); // a little something for the bag

    p.potions = 4;
    p.manaPotions = 2;
    p.gold = 50 * level;
  }

  private clientOf(sid: string): Client | undefined {
    return this.clients.find((c) => c.sessionId === sid);
  }

  private sendTradeState(t: TradeSession) {
    for (const sid of [t.a, t.b]) {
      const other = sid === t.a ? t.b : t.a;
      const c = this.clientOf(sid);
      const mine = this.state.players.get(sid);
      const theirs = this.state.players.get(other);
      if (!c || !mine || !theirs) continue;
      const resolve = (owner: Player, ids: string[]) =>
        ids.map((id) => owner.inventory.find((it) => it.id === id)).filter(Boolean);
      c.send("tradeupdate", {
        mine: { items: resolve(mine, t.items[sid]), gold: t.gold[sid] },
        theirs: { items: resolve(theirs, t.items[other]), gold: t.gold[other] },
        myConfirmed: t.confirmed[sid],
        theirConfirmed: t.confirmed[other],
      });
    }
  }

  private cancelTrade(t: TradeSession, reason: string) {
    for (const sid of [t.a, t.b]) {
      this.trades.delete(sid);
      this.clientOf(sid)?.send("tradeclosed", { reason });
    }
  }

  private cancelTradesFor(sid: string, reason: string) {
    const t = this.trades.get(sid);
    if (t) this.cancelTrade(t, reason);
    this.tradeInvites.delete(sid);
    this.tradeInvites.forEach((inv, key) => {
      if (inv.from === sid) this.tradeInvites.delete(key);
    });
  }

  // both signatures are in — validate everything one last time, then swap atomically
  private executeTrade(t: TradeSession) {
    const pa = this.state.players.get(t.a);
    const pb = this.state.players.get(t.b);
    if (!pa || !pb) {
      this.cancelTrade(t, "a partner vanished");
      return;
    }
    const pull = (p: Player, ids: string[]) =>
      ids.map((id) => p.inventory.find((it) => it.id === id)).filter((it): it is Item => !!it);
    const aItems = pull(pa, t.items[t.a]);
    const bItems = pull(pb, t.items[t.b]);
    const fail = (reason: string) => {
      t.confirmed[t.a] = false;
      t.confirmed[t.b] = false;
      for (const sid of [t.a, t.b]) this.clientOf(sid)?.send("tradefail", { reason });
      this.sendTradeState(t);
    };
    if (aItems.length !== t.items[t.a].length || bItems.length !== t.items[t.b].length) return fail("an offered item is gone");
    if (pa.gold < t.gold[t.a] || pb.gold < t.gold[t.b]) return fail("not enough gold");
    if (pa.inventory.length - aItems.length + bItems.length > INVENTORY_SIZE) return fail(`${pa.name || pa.cls}'s bag would overflow`);
    if (pb.inventory.length - bItems.length + aItems.length > INVENTORY_SIZE) return fail(`${pb.name || pb.cls}'s bag would overflow`);
    pa.inventory = pa.inventory.filter((it) => !aItems.includes(it));
    pb.inventory = pb.inventory.filter((it) => !bItems.includes(it));
    pa.inventory.push(...bItems);
    pb.inventory.push(...aItems);
    pa.gold += t.gold[t.b] - t.gold[t.a];
    pb.gold += t.gold[t.a] - t.gold[t.b];
    this.trades.delete(t.a);
    this.trades.delete(t.b);
    this.persist(pa);
    this.persist(pb);
    const sides: Array<[string, Item[], number]> = [
      [t.a, bItems, t.gold[t.b]],
      [t.b, aItems, t.gold[t.a]],
    ];
    for (const [sid, got, goldGot] of sides) {
      const c = this.clientOf(sid);
      if (!c) continue;
      c.send("tradedone", { items: got, gold: goldGot });
      const pl = this.state.players.get(sid);
      if (pl) this.sendLoadout(c, pl);
    }
    this.broadcast("announce", { text: `🤝 ${pa.name || pa.cls} and ${pb.name || pb.cls} struck a deal` });
  }

  private persist(p: Player) {
    if (!p.persistKey) return;
    const prof: Profile = {
      cls: p.cls,
      name: p.name,
      level: p.level,
      xp: p.xp,
      gold: p.gold,
      potions: p.potions,
      manaPotions: p.manaPotions,
      gear: p.gear,
      inventory: p.inventory,
      stash: p.stashItems,
      attrs: { str: p.str, dex: p.dex, vit: p.vit, ene: p.ene },
      statPoints: p.statPoints,
      skillPoints: p.skillPoints,
      skills: p.skills,
      binds: p.binds,
      paragonLevel: p.paragonLevel,
      paragonXp: p.paragonXp,
      paragonPoints: p.paragonPoints,
      paragonAlloc: p.paragonAlloc,
      season: p.seasonNum,
      riftTier: p.riftBest,
      deepestFloor: p.deepestFloor,
      actsUnlocked: p.actsUnlocked,
      diffUnlocked: p.diffUnlocked,
      waypoints: [...p.waypoints],
      abyssDeepest: p.abyssDeepest,
      quests: p.questProgress,
      questsDone: p.questsDone,
      merc: p.merc ?? undefined,
      hardcore: p.hardcore || undefined,
      dead: p.fallen || undefined,
      diedTo: p.fallen ? p.diedTo : undefined,
      diedFloor: p.fallen ? p.diedFloor : undefined,
      diedAct: p.fallen ? p.diedAct : undefined,
      diedAt: p.fallen ? p.diedAt : undefined,
      updatedAt: Date.now(),
    };
    saveProfile(p.persistKey, prof);
  }

  // --- quests: the log fills in as the world pushes back ---

  private sendQuests(sid: string, p: Player) {
    const client = this.clients.find((c) => c.sessionId === sid);
    if (!client) return;
    client.send("quests", {
      list: QUESTS.map((q) => ({
        id: q.id,
        name: q.name,
        desc: q.desc,
        act: q.act ?? 1,
        goal: q.goal,
        progress: Math.min(q.goal, p.questProgress[q.id] ?? 0),
        done: p.questsDone.includes(q.id),
        rewardGold: q.rewardGold,
        rewardXp: q.rewardXp,
      })),
    });
  }

  // advance one quest for one hero; completing it pays out on the spot
  private questAdvance(p: Player, sid: string, id: string, amount = 1) {
    const q = QUESTS.find((x) => x.id === id);
    if (!q || p.questsDone.includes(id)) return;
    p.questProgress[id] = Math.min(q.goal, (p.questProgress[id] ?? 0) + amount);
    if (p.questProgress[id] >= q.goal) {
      p.questsDone.push(id);
      p.gold += q.rewardGold;
      this.grantXp(p, sid, q.rewardXp);
      const client = this.clients.find((c) => c.sessionId === sid);
      client?.send("questdone", { id: q.id, name: q.name, gold: q.rewardGold, xp: q.rewardXp });
      if (this.state.players.size > 1) {
        this.broadcast("announce", { text: `${p.name || p.cls} completed "${q.name}"` });
      }
    }
    this.sendQuests(sid, p);
  }

  // kills advance quests for the whole party — evil slain is evil shared
  private questCredit(id: string, amount = 1) {
    this.state.players.forEach((p, sid) => this.questAdvance(p, sid, id, amount));
  }

  // quests satisfied by simply standing on a floor
  private questFloorCheck(p: Player, sid: string) {
    const act = this.state.act;
    const floor = this.state.floor;
    if (act === 1) {
      if (floor >= 2) this.questAdvance(p, sid, "enter_cathedral", 1);
      if (floor >= 5) this.questAdvance(p, sid, "into_the_dark", 1);
    }
    if (act >= 2) this.questAdvance(p, sid, "thirsty_road", 1);
    if (act >= 3) this.questAdvance(p, sid, "mirefall_landing", 1);
    if (act >= 4) this.questAdvance(p, sid, "last_vigil", 1);
    if (act >= ABYSS_ACT && floor >= 3) this.questAdvance(p, sid, "into_the_endless", 1);
  }

  // one scalar for difficulty, ilvl, and loot: how deep into the WORLD we are.
  // in a Rift, depth is the Rift Tier — the pushable endgame knob.
  private danger(): number {
    if (this.isRift) return riftDangerFor(this.riftTier);
    return dangerFor(this.state.act, this.state.floor) + (DIFF_DANGER_OFFSET[this.state.difficulty - 1] ?? 0);
  }

  private mythicMult(): number {
    return DIFF_MYTHIC_MULT[this.state.difficulty - 1] ?? 1;
  }

  // resistances are taxed by the difficulty — Hell wants you overcapped
  private resistFor(p: Player, element: Element): number {
    return Math.max(-100, resistOf(p.derived, element) + (DIFF_RES_PENALTY[this.state.difficulty - 1] ?? 0));
  }

  private actLabel(): string {
    if (this.isCowLevel) return "the Hidden Meadow";
    if (this.state.act >= ABYSS_ACT) return `Abyss floor ${this.state.floor}`;
    return `Act ${this.state.act}, floor ${this.state.floor}`;
  }

  private discoverWaypoint(p: Player, act: number, floor: number) {
    p.waypoints.add(`${act}:${floor}`);
  }

  private sendWaypoints(client: Client, p: Player, open: boolean) {
    client.send("waypoints", {
      list: [...p.waypoints],
      actsUnlocked: p.actsUnlocked,
      act: this.state.act,
      floor: this.state.floor,
      open,
    });
  }

  private validCoords(msg: { x: number; y: number }): boolean {
    return (
      typeof msg?.x === "number" &&
      typeof msg?.y === "number" &&
      Number.isFinite(msg.x) &&
      Number.isFinite(msg.y)
    );
  }

  // --- floors ---

  private startFloor(act: number, floor: number, cow = false, rift = false, tier = 0, atWaypoint = false) {
    const seed = Math.floor(Math.random() * 2 ** 31);
    this.isCowLevel = cow;
    this.isRift = rift;
    this.riftTier = tier;
    this.riftBossSpawned = false;
    this.layout = cow ? generateCowLevel(floor, seed) : generateDungeon(act, floor, seed);
    this.map = makeMap(this.layout.rows);

    this.state.act = act; // set BEFORE mapData — the client re-themes on the mapData listener
    this.state.floor = floor;
    this.state.zoneName = rift ? `Rift Tier ${tier}` : cow ? COW_ZONE_NAME : zoneNameFor(act, floor);
    this.state.mapData = this.layout.rows.join("\n");
    this.state.stairsX = this.layout.stairs.x;
    this.state.stairsY = this.layout.stairs.y;
    this.state.cathedralX = this.layout.cathedral?.x ?? -1;
    this.state.cathedralY = this.layout.cathedral?.y ?? -1;
    this.state.cathedralW = this.layout.cathedral?.w ?? 0;
    this.state.cathedralH = this.layout.cathedral?.h ?? 0;
    this.state.areasData = this.layout.areas.length ? JSON.stringify(this.layout.areas) : "";
    // each act's surface rolls its own sky; underground there is no sky to roll
    const skyPool = act <= ACTS.length ? ACTS[act - 1].weathers : [];
    this.state.weather = floor === 1 && act < ABYSS_ACT && !cow && skyPool.length
      ? skyPool[Math.floor(Math.random() * skyPool.length)]
      : "";

    // roll the floor's bounty — a Rift is always a horde to clear, then a Rift Boss
    const bountyKind: BountyKind = cow || rift
      ? "kills"
      : (["boss", "kills", "chest"] as BountyKind[])[Math.floor(Math.random() * 3)];
    this.bountyKind = bountyKind;
    const danger = this.danger(); // rift-aware
    this.state.bountyGoal = rift ? RIFT_KILL_GOAL : bountyGoalFor(bountyKind, danger);
    this.state.bountyProgress = 0;
    this.state.bountyDone = false;
    this.state.bountyText = rift
      ? `Rift Tier ${tier} — cull the horde`
      : bountyTextFor(bountyKind, danger, BOSS_NAMES[cow ? "bovax" : actBossKindFor(act, floor)]);

    this.state.monsters.clear();
    this.state.projectiles.clear();
    this.state.loot.clear();
    this.state.shrines.clear();
    this.state.pets.clear(); // the dead do not descend stairs
    this.hazards = [];

    this.layout.shrines.forEach((pos) => {
      const kind = SHRINE_KINDS[Math.floor(Math.random() * SHRINE_KINDS.length)];
      const s = new Shrine();
      s.x = pos.x;
      s.y = pos.y;
      s.kind = kind.id;
      s.label = kind.label;
      this.state.shrines.set(`shrine_${this.nextId++}`, s);
    });

    this.layout.chests.forEach((pos) => {
      const c = new Shrine();
      c.x = pos.x;
      c.y = pos.y;
      c.kind = "chest";
      c.label = "Ancient Chest";
      this.state.shrines.set(`chest_${this.nextId++}`, c);
    });

    if (this.layout.tome) {
      const t = new Shrine();
      t.x = this.layout.tome.x;
      t.y = this.layout.tome.y;
      t.kind = "tome";
      t.label = "Ancient Tome";
      this.state.shrines.set(`tome_${this.nextId++}`, t);
    }

    // a story waits on most floors — sat near a camp, out in the dark
    if (!this.isCowLevel && this.layout.camps.length && Math.random() < ENCOUNTER_CHANCE) {
      const enc = rollEncounter(this.state.act, Math.random);
      if (enc) {
        const camp = this.layout.camps[Math.floor(Math.random() * this.layout.camps.length)];
        let ex = camp.x;
        let ey = camp.y;
        for (let tries = 0; tries < 24; tries++) {
          const p = this.scatter(camp.x, camp.y);
          if (canStand(this.map, p.x, p.y) && !isInTown(p.y)) {
            ex = p.x;
            ey = p.y;
            break;
          }
        }
        const e = new Shrine();
        e.x = ex;
        e.y = ey;
        e.kind = "encounter";
        e.variant = enc.id;
        e.label = enc.label;
        this.state.shrines.set(`enc_${this.nextId++}`, e);
      }
    }

    // the town is furnished the same way every floor
    const stash = new Shrine();
    stash.x = TOWN.stash.x;
    stash.y = TOWN.stash.y;
    stash.kind = "stash";
    stash.label = "Your Stash";
    this.state.shrines.set(`stash_${this.nextId++}`, stash);

    const vendor = new Shrine();
    vendor.x = TOWN.vendor.x;
    vendor.y = TOWN.vendor.y;
    vendor.kind = "vendor";
    vendor.label = "Torvald the Smith";
    this.state.shrines.set(`vendor_${this.nextId++}`, vendor);

    const waypoint = new Shrine();
    waypoint.x = TOWN.waypoint.x;
    waypoint.y = TOWN.waypoint.y;
    waypoint.kind = "waypoint";
    waypoint.label = "Waypoint";
    this.state.shrines.set(`waypoint_${this.nextId++}`, waypoint);

    // a waypoint found in the dark is worth ten in town
    if (this.layout.waypoint && !cow && !rift) {
      const fieldWp = new Shrine();
      fieldWp.x = this.layout.waypoint.x;
      fieldWp.y = this.layout.waypoint.y;
      fieldWp.kind = "waypoint";
      fieldWp.label = "Waypoint";
      this.state.shrines.set(`waypoint_${this.nextId++}`, fieldWp);
    }

    // the caravan: the road to the next act, for those who have earned it (NEVER inside a Rift —
    // it would let you advance acts from within, so a rift is a one-way commitment until cleared)
    if (!rift) {
      const caravan = new Shrine();
      caravan.x = TOWN.caravan.x;
      caravan.y = TOWN.caravan.y;
      caravan.kind = "caravan";
      caravan.label =
        act >= ABYSS_ACT ? `Caravan — ${ACTS[ACTS.length - 1].name}`
        : act >= ACTS.length ? "The Abyss Gate"
        : `Caravan — ${ACTS[act].name}`;
      this.state.shrines.set(`caravan_${this.nextId++}`, caravan);

      // the Rift obelisk: step through to push the next Rift Tier (the endless endgame)
      const riftPortal = new Shrine();
      riftPortal.x = TOWN.rift.x;
      riftPortal.y = TOWN.rift.y;
      riftPortal.kind = "riftportal";
      riftPortal.label = "The Rift";
      this.state.shrines.set(`riftportal_${this.nextId++}`, riftPortal);
    } else {
      // inside a Rift there's no caravan — but there IS always a way out (touch it to abandon
      // the run and return to town). Sits on the safe town strip, reachable by town portal.
      const bail = new Shrine();
      bail.x = TOWN.caravan.x;
      bail.y = TOWN.caravan.y;
      bail.kind = "riftexit";
      bail.label = "Abandon the Rift";
      this.state.shrines.set(`riftexit_${this.nextId++}`, bail);
    }

    const transmute = new Shrine();
    transmute.x = TOWN.transmute.x;
    transmute.y = TOWN.transmute.y;
    transmute.kind = "transmute";
    transmute.label = "Ternion Altar";
    this.state.shrines.set(`transmute_${this.nextId++}`, transmute);

    const alchemist = new Shrine();
    alchemist.x = TOWN.alchemist.x;
    alchemist.y = TOWN.alchemist.y;
    alchemist.kind = "alchemist";
    alchemist.label = "Lysa the Alchemist";
    this.state.shrines.set(`alchemist_${this.nextId++}`, alchemist);

    // forest doorways: tower doors, cave mouths, stairs between stories
    this.areaPortals.clear();
    for (const ap of this.layout.portals) {
      const s = new Shrine();
      s.x = ap.x;
      s.y = ap.y;
      s.kind = "areaportal";
      s.variant = ap.variant;
      s.label = ap.label;
      const id = `areaportal_${this.nextId++}`;
      this.state.shrines.set(id, s);
      this.areaPortals.set(id, { x: ap.tx, y: ap.ty });
    }

    // neither portals home nor open trades survive the descent
    {
      const seen = new Set<TradeSession>();
      this.trades.forEach((tr) => {
        if (!seen.has(tr)) {
          seen.add(tr);
          this.cancelTrade(tr, "the floor changed");
        }
      });
      this.tradeInvites.clear();
    }
    this.state.players.forEach((p) => {
      p.returnX = 0;
      p.returnY = 0;
      p.portalAt = 0;
    });

    // ONE recruiter per act, at the muster post: rogues in I, mages in II,
    // barbarians in III, paladins in IV (the Abyss borrows the last).
    const recruiter = recruiterForAct(this.state.act);
    const rNpc = new Shrine();
    rNpc.x = TOWN.maren.x; // the muster post — the same corner in every town
    rNpc.y = TOWN.maren.y;
    rNpc.kind = "mercnpc";
    rNpc.variant = recruiter.id;
    rNpc.label = recruiter.npcName;
    this.state.shrines.set(`recruiter_${this.nextId++}`, rNpc);

    // the act's own townsfolk — the elder and two locals, present only here
    for (const spec of actTownNpcs(this.state.act)) {
      const tile = TOWN[spec.tile];
      const t = new Shrine();
      t.x = tile.x;
      t.y = tile.y;
      t.kind = "storyteller";
      t.variant = spec.id;
      t.label = townNpcById(spec.id)?.name ?? "A weathered stranger";
      this.state.shrines.set(`${spec.id}_${this.nextId++}`, t);
    }

    // Fenwick lurks by the tavern now — a townsman, technically
    const fenwick = new Shrine();
    fenwick.x = TOWN.fenwick.x;
    fenwick.y = TOWN.fenwick.y;
    fenwick.kind = "gamble";
    fenwick.label = "Fenwick";
    this.state.shrines.set(`fenwick_${this.nextId++}`, fenwick);

    // the indoor folk: a barkeep behind the tavern counter and a resident by the hut fire,
    // a different pair each act — the warm rooms you can actually walk into now
    const keeperId = tavernKeeperFor(this.state.act);
    const barkeep = new Shrine();
    barkeep.x = TOWN.bar.x;
    barkeep.y = TOWN.bar.y;
    barkeep.kind = "barkeep";
    barkeep.variant = keeperId;
    barkeep.label = townNpcById(keeperId)?.name ?? "The barkeep";
    this.state.shrines.set(`barkeep_${this.nextId++}`, barkeep);

    const residentId = hutResidentFor(this.state.act);
    const resident = new Shrine();
    resident.x = TOWN.hearth.x;
    resident.y = TOWN.hearth.y;
    resident.kind = "barkeep"; // same talk-only kind; the variant carries who they are
    resident.variant = residentId;
    resident.label = townNpcById(residentId)?.name ?? "A resident";
    this.state.shrines.set(`resident_${this.nextId++}`, resident);

    // fresh shelves for a fresh floor
    this.rollVendorStock();
    this.rollGambleStock();
    this.mercOfferSeed = Math.floor(Math.random() * 2 ** 31) || 1;

    this.campAlive = [];
    this.campRespawnAt = [];
    this.layout.camps.forEach((_, i) => {
      this.campAlive[i] = 0;
      this.campRespawnAt[i] = 0;
      this.spawnCamp(i);
    });
    if (!rift) this.spawnBoss(); // a Rift Boss is summoned later, once the horde is culled
    this.bossRespawnAt = 0;

    // a treasure goblin may be lurking somewhere on this floor…
    if (this.layout.camps.length > 0 && Math.random() < GOBLIN_SPAWN_CHANCE) {
      const camp = this.layout.camps[Math.floor(Math.random() * this.layout.camps.length)];
      this.spawnGoblin(camp.x, camp.y);
    }

    // …and, rarely, something far worse
    if (!cow && this.layout.camps.length > 0 && Math.random() < PILGRIM_CHANCE) {
      const camp = this.layout.camps[Math.floor(Math.random() * this.layout.camps.length)];
      this.spawnPilgrim(camp.x, camp.y);
    }

    // gather the party at the new entrance; revive the fallen at half strength.
    // a waypoint jump lands you ON the destination stone, not at the floor entrance —
    // town stone in the plaza, or the field stone wherever this fresh layout dropped it.
    const wpStone = floor === 1 && act < ABYSS_ACT ? TOWN.waypoint : this.layout.waypoint;
    const arrival = atWaypoint && wpStone ? wpStone : this.layout.spawn;
    let i = 0;
    this.state.players.forEach((p, sid) => {
      p.x = p.targetX = arrival.x + (i % 3) * 24;
      p.y = p.targetY = arrival.y + Math.floor(i / 3) * 24;
      if (p.hp <= 0) p.hp = Math.floor(p.maxHp / 2);
      // a Rift is off the world-ladder entirely — it must not inflate depth/act/waypoint marks
      if (!rift) {
        p.deepestFloor = Math.max(p.deepestFloor, danger); // the ladder measures true depth
        p.actsUnlocked = Math.max(p.actsUnlocked, Math.min(act, ACTS.length + 1)); // standing here is proof enough
        if (act >= ABYSS_ACT) p.abyssDeepest = Math.max(p.abyssDeepest, floor);
        if (floor === 1 && act < ABYSS_ACT && !cow) this.discoverWaypoint(p, act, 1); // the town stone knows you now
      }
      this.questFloorCheck(p, sid); // descending IS the quest, sometimes
      const mc = this.state.mercs.get(sid);
      if (mc) {
        mc.x = p.x + 26;
        mc.y = p.y + 10;
      }
      i++;
    });

    const actName = cow ? COW_ZONE_NAME : act >= ABYSS_ACT ? "The Endless Abyss" : ACTS[act - 1].name;
    this.broadcast("descend", { act, floor, zoneName: this.state.zoneName, actName });
    this.setMetadata({ act, floor, zoneName: this.state.zoneName, difficulty: this.state.difficulty }); // the lobby reads this
    console.log(`[room ${this.roomId}] act ${act} floor ${floor} "${this.state.zoneName}" (${this.layout.camps.length} camps, ${this.layout.shrines.length} shrines)`);
  }

  // --- items ---

  private sendLoadout(client: Client, p: Player) {
    client.send("loadout", {
      inventory: p.inventory,
      equipment: p.gear,
      stash: p.stashItems,
      sharedStash: p.sharedStash,
      derived: p.derived,
      skills: p.skills,
      binds: p.binds,
      paragonAlloc: p.paragonAlloc,
      sheet: this.buildSheet(p),
    });
  }

  // the numbers a Malgrim player actually reads on the character screen
  private buildSheet(p: Player) {
    const atk = CLASS_ATTACKS[p.cls as keyof typeof CLASS_ATTACKS];
    const d = p.derived;
    const flat = (d.dmg ?? 0) + (d.fireDmg ?? 0) + (d.coldDmg ?? 0);
    const pctMult = 1 + (d.dmgPct ?? 0) / 100;
    return {
      dmgMin: Math.round((atk.dmg[0] + flat) * pctMult),
      dmgMax: Math.round((atk.dmg[1] + flat + 2 * (d.lightDmg ?? 0)) * pctMult),
      crit: Math.round((d.crit ?? 0) * 10) / 10,
      dodge: Math.round(Math.min(DODGE_CAP, d.dodge ?? 0) * 10) / 10,
      armor: d.armor ?? 0,
      atkSpd: d.atkSpd ?? 0,
      moveSpd: d.moveSpd ?? 0,
      magicFind: d.magicFind ?? 0,
      goldFind: d.goldFind ?? 0,
      lifeSteal: d.lifeSteal ?? 0,
      manaSteal: d.manaSteal ?? 0,
      thorns: d.thorns ?? 0,
      cdr: Math.min(40, d.cdr ?? 0),
      regen: PLAYER_REGEN_PER_S + (d.regen ?? 0),
      manaRegen: Math.round((MANA_REGEN_PER_S + (d.manaRegen ?? 0)) * 100) / 100,
      xpBonus: d.xpBonus ?? 0,
      fireRes: resistOf(d, "fire"),
      coldRes: resistOf(d, "cold"),
      lightRes: resistOf(d, "light"),
    };
  }

  // --- character sheet: stats & skills ---

  private handleAllocStat(client: Client, msg: { attr: string }) {
    const p = this.state.players.get(client.sessionId);
    if (!p || p.statPoints <= 0) return;
    const attr = msg?.attr as AttrName;
    if (!ATTRS.includes(attr)) return;
    p.statPoints--;
    p[attr]++;
    this.recompute(p);
    this.sendLoadout(client, p);
  }

  private handleAllocSkill(client: Client, msg: { id: string }) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !msg?.id) return;
    const node = skillById(p.cls as ClassName, msg.id);
    if (!node) return;
    if (!canAllocSkill(node, p.skills, p.level, p.skillPoints)) return;
    p.skillPoints--;
    p.skills[node.id] = (p.skills[node.id] ?? 0) + 1;

    // first rank of an active auto-binds to the first free key
    if (node.type !== "passive" && p.skills[node.id] === 1) {
      if (!Object.values(p.binds).includes(node.id)) {
        const free = SKILL_KEYS.find((k) => !p.binds[k]);
        if (free) p.binds[free] = node.id;
      }
    }

    this.recompute(p);
    this.sendLoadout(client, p);
    client.send("skilllearned", { id: node.id, rank: p.skills[node.id], name: node.name });
  }

  // free respec: wipe every allocated point, hand it all back, reset attributes to the
  // class base — build experimentation is the whole point, so it costs nothing
  private handleRespec(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    const base = CLASS_BASE_ATTRS[p.cls as ClassName];
    p.str = base.str;
    p.dex = base.dex;
    p.vit = base.vit;
    p.ene = base.ene;
    p.skills = {};
    p.binds = {};
    p.skillReady = {}; // a re-learned skill shouldn't inherit an old cooldown
    p.statPoints = STAT_POINTS_PER_LEVEL * (p.level - 1);
    p.skillPoints = SKILL_POINTS_PER_LEVEL * p.level;
    // paragon is part of the build too — hand every paragon point back to reallocate
    p.paragonAlloc = {};
    p.paragonPoints = p.paragonLevel;
    this.recompute(p); // maxHp/maxMana fall back to the base — clamp so we don't overheal
    p.hp = Math.min(p.hp, p.maxHp);
    p.mana = Math.min(p.mana, p.maxMana);
    this.persist(p);
    this.sendLoadout(client, p);
    client.send("respecdone", { statPoints: p.statPoints, skillPoints: p.skillPoints });
  }

  private handleBindSkill(client: Client, msg: { id: string; key: string }) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !msg?.id) return;
    const key = String(msg.key).toUpperCase() as SkillKey;
    if (!SKILL_KEYS.includes(key)) return;
    const node = skillById(p.cls as ClassName, msg.id);
    if (!node || node.type === "passive" || (p.skills[node.id] ?? 0) <= 0) return;
    // one key per skill — unbind it elsewhere first
    for (const k of SKILL_KEYS) {
      if (p.binds[k] === node.id) delete p.binds[k];
    }
    p.binds[key] = node.id;
    this.sendLoadout(client, p);
  }

  // --- town: portal, stash, vendor ---

  // --- the Ternion Altar: reforge + the recipe book ---

  // open the altar panel: reforge-eligible items (gamble their affixes for gold) + which recipes
  // can fire right now (rune upgrade, 3 magic → rare, 3 rare → Adept's craft, the peg-leg secret).
  private sendAltar(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !this.nearTownSpot(p, TOWN.transmute)) return;
    const reforge = p.inventory
      .filter((it) => canReforge(it))
      .map((it) => ({ id: it.id, base: it.base, name: it.name, rarity: it.rarity, slot: it.slot, ilvl: it.ilvl, price: reforgeCost(it.ilvl, it.rarity) }));
    let runeup: string | null = null; // the lowest rune tier you can currently upgrade
    for (let tier = 0; tier < RUNE_ORDER.length - 1 && !runeup; tier++) {
      const key = RUNE_ORDER[tier];
      if (p.inventory.filter((it) => it.slot === "rune" && it.base === `rune_${key}`).length >= TRANSMUTE_RUNES_NEEDED) runeup = RUNES[key].name;
    }
    const magics = p.inventory.filter((it) => it.rarity === "magic" && it.slot !== "rune" && it.slot !== "charm" && !it.unidentified).length;
    const rares = p.inventory.filter((it) => it.rarity === "rare" && it.slot !== "rune" && it.slot !== "charm" && it.slot !== "jewel").length;
    client.send("openaltar", {
      gold: p.gold,
      reforge,
      recipes: {
        runeup,
        magics: magics >= TRANSMUTE_MAGICS_NEEDED,
        rares: rares >= TRANSMUTE_MAGICS_NEEDED,
        pegleg: p.inventory.some((it) => it.name === "The Peg Leg"),
      },
    });
  }

  // reforge one item: gamble its affixes for a fresh roll at the same base/rarity/ilvl, for gold
  private handleReforge(client: Client, msg: { id?: string }) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !msg?.id || !this.nearTownSpot(p, TOWN.transmute)) return;
    const idx = p.inventory.findIndex((it) => it.id === msg.id);
    if (idx < 0) return;
    const item = p.inventory[idx];
    if (!canReforge(item)) return;
    const cost = reforgeCost(item.ilvl, item.rarity);
    if (p.gold < cost) { client.send("reforgefail", { cost }); return; }
    p.gold -= cost;
    const fresh = generateItem(item.ilvl, 0, Math.random, [[item.rarity, 1]], item.base);
    fresh.id = item.id; // keep the id so worn/stash/UI references stay stable
    delete fresh.unidentified; // you watched it happen — you know exactly what you got
    p.inventory[idx] = fresh;
    this.broadcast("reforgefx", { x: TOWN.transmute.x, y: TOWN.transmute.y });
    this.questAdvance(p, client.sessionId, "ternion");
    client.send("reforged", { name: fresh.name, rarity: fresh.rarity, cost });
    this.sendLoadout(client, p);
    this.persist(p);
    this.sendAltar(client); // refresh the panel — the item (and its price) changed
  }

  // run one recipe from the altar panel's buttons (the old auto-fire book, now click-to-craft)
  private handleAltarRecipe(client: Client, msg: { recipe?: string }) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !this.nearTownSpot(p, TOWN.transmute)) return;
    const fx = () => this.broadcast("transmutefx", { x: TOWN.transmute.x, y: TOWN.transmute.y });
    switch (msg?.recipe) {
      case "pegleg": {
        const legIdx = p.inventory.findIndex((it) => it.name === "The Peg Leg");
        if (legIdx < 0) return;
        p.inventory.splice(legIdx, 1);
        const portal = new Shrine();
        const pos = this.scatter(TOWN.transmute.x + 40, TOWN.transmute.y + 40);
        portal.x = pos.x;
        portal.y = pos.y;
        portal.kind = "cowportal";
        portal.label = "??? (there is no meadow)";
        this.state.shrines.set(`cowportal_${this.nextId++}`, portal);
        this.broadcast("cowopen", { x: portal.x, y: portal.y });
        break;
      }
      case "runeup": {
        let done = false;
        for (let tier = 0; tier < RUNE_ORDER.length - 1 && !done; tier++) {
          const runeKey = RUNE_ORDER[tier];
          const matches = p.inventory.filter((it) => it.slot === "rune" && it.base === `rune_${runeKey}`);
          if (matches.length >= TRANSMUTE_RUNES_NEEDED) {
            for (let i = 0; i < TRANSMUTE_RUNES_NEEDED; i++) p.inventory.splice(p.inventory.findIndex((it) => it.id === matches[i].id), 1);
            const nextKey = RUNE_ORDER[tier + 1];
            const def = RUNES[nextKey];
            p.inventory.push({ id: `rune_t_${this.nextId++}`, base: `rune_${nextKey}`, name: `${def.name} Rune`, slot: "rune", rarity: "magic", ilvl: this.danger(), stats: { ...def.stats } });
            fx();
            this.questAdvance(p, client.sessionId, "ternion");
            client.send("transmuted", { result: `${def.name} Rune`, recipe: `3× ${RUNES[runeKey].name}` });
            done = true;
          }
        }
        if (!done) return;
        break;
      }
      case "magics": {
        const magics = p.inventory.filter((it) => it.rarity === "magic" && it.slot !== "rune" && it.slot !== "charm" && !it.unidentified);
        if (magics.length < TRANSMUTE_MAGICS_NEEDED) return;
        const consumed = magics.slice(0, TRANSMUTE_MAGICS_NEEDED);
        const ilvl = Math.max(...consumed.map((it) => it.ilvl));
        for (const it of consumed) p.inventory.splice(p.inventory.findIndex((x) => x.id === it.id), 1);
        const rare = generateItem(ilvl, 0, Math.random, [["rare", 1]]);
        rare.unidentified = true;
        p.inventory.push(rare);
        fx();
        this.questAdvance(p, client.sessionId, "ternion");
        client.send("transmuted", { result: "an unidentified rare", recipe: "3× magic items" });
        break;
      }
      case "rares": {
        const rares = p.inventory.filter((it) => it.rarity === "rare" && it.slot !== "rune" && it.slot !== "charm" && it.slot !== "jewel");
        if (rares.length < TRANSMUTE_MAGICS_NEEDED) return;
        const consumed = rares.slice(0, TRANSMUTE_MAGICS_NEEDED);
        const ilvl = Math.max(...consumed.map((it) => it.ilvl));
        for (const it of consumed) p.inventory.splice(p.inventory.findIndex((x) => x.id === it.id), 1);
        const crafted = generateItem(ilvl, 0, Math.random, [["rare", 1]]);
        crafted.stats.plusSkills = (crafted.stats.plusSkills ?? 0) + 1; // the altar's true gift
        crafted.name = `Adept's ${crafted.name}`;
        crafted.unidentified = false;
        p.inventory.push(crafted);
        fx();
        this.questAdvance(p, client.sessionId, "ternion");
        client.send("transmuted", { result: `${crafted.name} (+1 skills)`, recipe: "3× rare items" });
        break;
      }
      default:
        return;
    }
    this.sendLoadout(client, p);
    this.persist(p);
    this.sendAltar(client);
  }

  // identify: pay the price of curiosity — or let Torvald squint at it for free
  private handleIdentify(client: Client, msg: { id: string }) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !msg?.id) return;
    const item = p.inventory.find((it) => it.id === msg.id);
    if (!item || !item.unidentified) return;
    const cost = this.nearTownSpot(p, TOWN.vendor) ? 0 : identifyCost(item.ilvl);
    if (p.gold < cost) {
      client.send("identifyfail", { cost });
      return;
    }
    p.gold -= cost;
    delete item.unidentified;
    if (item.slot === "charm") this.recompute(p); // identified charms start working
    this.sendLoadout(client, p);
    client.send("identified", { name: item.name, rarity: item.rarity, cost });
  }

  private handleTownPortal(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (!p || p.hp <= 0 || p.portalAt > 0) return;
    const ms = isInTown(p.y) ? PORTAL_RETURN_MS : PORTAL_CAST_MS;
    p.portalAt = Date.now() + ms;
    this.broadcast("portalcast", { id: client.sessionId, x: p.x, y: p.y, ms });
  }

  private nearTownSpot(p: Player, spot: { x: number; y: number }): boolean {
    return isInTown(p.y) && Math.hypot(p.x - spot.x, p.y - spot.y) <= TOWN_INTERACT_RANGE;
  }

  private handleStashPut(client: Client, msg: { id: string }) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !msg?.id || !this.nearTownSpot(p, TOWN.stash)) return;
    if (p.stashItems.length >= STASH_SIZE) return;
    const idx = p.inventory.findIndex((it) => it.id === msg.id);
    if (idx < 0) return;
    const item = p.inventory.splice(idx, 1)[0];
    p.stashItems.push(item);
    if (item.slot === "charm") this.recompute(p);
    this.sendLoadout(client, p);
  }

  private handleStashTake(client: Client, msg: { id: string }) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !msg?.id || !this.nearTownSpot(p, TOWN.stash)) return;
    if (p.inventory.length >= INVENTORY_SIZE) return;
    const idx = p.stashItems.findIndex((it) => it.id === msg.id);
    if (idx < 0) return;
    const item = p.stashItems.splice(idx, 1)[0];
    p.inventory.push(item);
    if (item.slot === "charm") this.recompute(p);
    this.sendLoadout(client, p);
  }

  // the ACCOUNT-wide shared stash: deposit/withdraw travels across all your heroes. Saved to
  // its own account file on every mutation (never into the hero profile — no duplication).
  private handleSharedStashPut(client: Client, msg: { id: string }) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !p.accountKey || !msg?.id || !this.nearTownSpot(p, TOWN.stash)) return;
    if (p.sharedStash.length >= STASH_SIZE) return;
    const idx = p.inventory.findIndex((it) => it.id === msg.id);
    if (idx < 0) return;
    const item = p.inventory.splice(idx, 1)[0];
    p.sharedStash.push(item);
    if (item.slot === "charm") this.recompute(p);
    saveAccount(p.accountKey, { sharedStash: p.sharedStash });
    this.sendLoadout(client, p);
  }

  private handleSharedStashTake(client: Client, msg: { id: string }) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !p.accountKey || !msg?.id || !this.nearTownSpot(p, TOWN.stash)) return;
    if (p.inventory.length >= INVENTORY_SIZE) return;
    const idx = p.sharedStash.findIndex((it) => it.id === msg.id);
    if (idx < 0) return;
    const item = p.sharedStash.splice(idx, 1)[0];
    p.inventory.push(item);
    if (item.slot === "charm") this.recompute(p);
    saveAccount(p.accountKey, { sharedStash: p.sharedStash });
    this.sendLoadout(client, p);
  }

  // find a forge-eligible item anywhere the player controls it: bag, own paper doll,
  // or a living merc's three slots. Returns where it lives so we recompute the right owner.
  private findForgeItem(p: Player, id: string): { item: Item; source: "bag" | "worn" | "merc" } | null {
    const bag = p.inventory.find((it) => it.id === id);
    if (bag) return { item: bag, source: "bag" };
    const worn = Object.values(p.gear).find((it) => it?.id === id);
    if (worn) return { item: worn, source: "worn" };
    if (p.merc && !p.merc.dead) {
      const onMerc = Object.values(p.merc.gear).find((it) => it?.id === id);
      if (onMerc) return { item: onMerc, source: "merc" };
    }
    return null;
  }

  // Torvald's forge board: everything he can work — bare gear he'll punch, and
  // socketed gear he'll empty — drawn from your bag, your body, and your merc's kit
  private sendSmith(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !this.nearTownSpot(p, TOWN.vendor)) return;
    const rows: any[] = [];
    const consider = (it: Item | undefined, source: "bag" | "worn" | "merc") => {
      if (!it) return;
      if (canPunchSockets(it)) {
        rows.push({
          id: it.id, base: it.base, name: it.name, rarity: it.rarity, slot: it.slot, source,
          action: "punch", sockets: maxSockets(it.ilvl), price: socketPunchCost(it.ilvl),
        });
      } else if (hasSeatedStones(it) && !it.unidentified) {
        rows.push({
          id: it.id, base: it.base, name: it.name, rarity: it.rarity, slot: it.slot, source,
          action: "unsocket", seated: (it.runes?.length ?? 0) + (it.jewels?.length ?? 0), price: unsocketCost(it.ilvl),
        });
      }
    };
    p.inventory.forEach((it) => consider(it, "bag"));
    Object.values(p.gear).forEach((it) => consider(it, "worn"));
    if (p.merc && !p.merc.dead) Object.values(p.merc.gear).forEach((it) => consider(it, "merc"));
    client.send("opensmith", { items: rows });
  }

  private handlePunchSockets(client: Client, msg: { id: string }) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !msg?.id || !this.nearTownSpot(p, TOWN.vendor)) return;
    const found = this.findForgeItem(p, msg.id);
    if (!found || !canPunchSockets(found.item)) return;
    const { item, source } = found;
    const cost = socketPunchCost(item.ilvl);
    if (p.gold < cost) {
      client.send("smithfail", { cost });
      return;
    }
    p.gold -= cost;
    item.sockets = maxSockets(item.ilvl);
    if (source === "merc") this.recomputeMerc(client.sessionId, p);
    else this.recompute(p);
    this.persist(p);
    client.send("socketpunched", { name: item.name, sockets: item.sockets, cost });
    this.sendLoadout(client, p);
    if (source === "merc") this.sendMercLoadout(client, p);
    this.sendSmith(client); // refresh his board — the item's changed state now
  }

  // pull every seated rune/jewel back out as loose stones — into the bag, or onto the
  // floor if it's full. The empty sockets remain; any runeword breaks.
  private handleUnsocket(client: Client, msg: { id: string }) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !msg?.id || !this.nearTownSpot(p, TOWN.vendor)) return;
    const found = this.findForgeItem(p, msg.id);
    if (!found || !hasSeatedStones(found.item)) return;
    const { item, source } = found;
    const cost = unsocketCost(item.ilvl);
    if (p.gold < cost) {
      client.send("smithfail", { cost });
      return;
    }
    // rebuild the loose stones the sockets held
    const returned: Item[] = [];
    for (const key of item.runes ?? []) {
      const def = RUNES[key];
      if (!def) continue;
      returned.push({
        id: `rune_us${this.nextId++}`, base: `rune_${key}`, name: `${def.name} Rune`,
        slot: "rune", rarity: "magic", ilvl: item.ilvl, stats: { ...def.stats },
      });
    }
    for (const j of item.jewels ?? []) {
      returned.push({
        id: `jewel_us${this.nextId++}`, base: "jewel", name: j.name,
        slot: "jewel", rarity: j.rarity, ilvl: item.ilvl, stats: { ...j.stats },
      });
    }
    if (returned.length === 0) return;
    p.gold -= cost;
    // empty the sockets (they stay open) and undo any runeword
    item.runes = [];
    item.jewels = [];
    delete item.runeword;
    // deal the stones out: bag first, ground for the overflow
    let dropped = 0;
    for (const stone of returned) {
      if (p.inventory.length < INVENTORY_SIZE) p.inventory.push(stone);
      else {
        this.spawnGroundItem(stone, p.x, p.y);
        dropped++;
      }
    }
    if (source === "merc") this.recomputeMerc(client.sessionId, p);
    else this.recompute(p);
    this.persist(p);
    client.send("unsocketed", { name: item.name, count: returned.length, dropped, cost });
    this.sendLoadout(client, p);
    if (source === "merc") this.sendMercLoadout(client, p);
    this.sendSmith(client);
  }

  private handleSell(client: Client, msg: { id: string }) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !msg?.id || !this.nearTownSpot(p, TOWN.vendor)) return;
    const idx = p.inventory.findIndex((it) => it.id === msg.id);
    if (idx < 0) return;
    const item = p.inventory.splice(idx, 1)[0];
    const value = sellValue(item);
    p.gold += value;
    if (item.slot === "charm") this.recompute(p);
    client.send("sold", { name: item.name, value });
    this.sendLoadout(client, p);
  }

  private recompute(p: Player) {
    const totals: ItemStats = {};
    p.effects.clear();
    p.powers.clear();

    // raw attributes come first — the foundation everything else stacks on
    addStats(totals, attrBonus({ str: p.str, dex: p.dex, vit: p.vit, ene: p.ene }, p.cls as ClassName));

    // skill-tree passives, per hard rank
    for (const node of SKILL_TREES[p.cls as ClassName] ?? []) {
      const rank = p.skills[node.id] ?? 0;
      if (rank > 0 && node.passive) {
        for (const [k, v] of Object.entries(node.passive) as Array<[keyof ItemStats, number]>) {
          totals[k] = (totals[k] ?? 0) + v * rank;
        }
      }
    }

    for (const item of Object.values(p.gear)) {
      if (!item) continue;
      addStats(totals, item.stats);
      if (item.classBonus?.cls === p.cls) addStats(totals, item.classBonus.stats);
      if (item.effect) p.effects.add(item.effect);
      if (item.power) p.powers.add(item.power);
      // socketed runes
      for (const r of item.runes ?? []) {
        const rune = RUNES[r];
        if (rune) addStats(totals, rune.stats);
      }
      // seated jewels
      for (const j of item.jewels ?? []) addStats(totals, j.stats);
      // formed runewords
      if (item.runeword) {
        const rw = runewordByName(item.runeword);
        if (rw) {
          addStats(totals, rw.bonus);
          if (rw.effect) p.effects.add(rw.effect);
        }
      }
    }
    // charms grant their stats from the inventory (once identified)
    for (const item of p.inventory) {
      if (item.slot === "charm" && !item.unidentified) addStats(totals, item.stats);
    }
    // set bonuses: partial tier, full tier, and set effects
    for (const [setId, set] of Object.entries(SETS)) {
      const worn = new Set(
        Object.values(p.gear)
          .filter((i) => i?.setId === setId)
          .map((i) => i!.name)
      );
      if (set.partial && worn.size >= set.partial.count) addStats(totals, set.partial.stats);
      if (worn.size >= set.pieces) {
        addStats(totals, set.bonus);
        if (set.effect) p.effects.add(set.effect);
      }
    }
    // paragon perks: small permanent bonuses, one per spent point
    for (const perk of PARAGON_PERKS) {
      const pts = p.paragonAlloc[perk.id] ?? 0;
      if (pts > 0) totals[perk.stat] = (totals[perk.stat] ?? 0) + perk.per * pts;
    }
    p.derived = totals;
    p.maxHp = maxHpFor(p.vit, p.level, totals.maxHp ?? 0);
    p.hp = Math.min(p.hp, p.maxHp);
    p.maxMana = maxManaFor(p.ene, totals.maxMana ?? 0);
    p.mana = Math.min(p.mana, p.maxMana);
    p.maxPotions = potionCapFor(p.gear);
    p.potions = Math.min(p.potions, p.maxPotions);
    p.manaPotions = Math.min(p.manaPotions, p.maxPotions);
    p.weaponBase = p.gear.weapon?.base ?? "";
    p.offhandBase = p.gear.offhand?.base ?? "";
    p.helmBase = p.gear.helm?.base ?? "";
    p.chestBase = p.gear.chest?.base ?? "";
    p.bootsBase = p.gear.boots?.base ?? "";
    p.beltBase = p.gear.belt?.base ?? "";
    // the best rarity you wear is the aura you carry
    let tier = 0;
    for (const item of Object.values(p.gear)) {
      if (item) tier = Math.max(tier, RARITY_ORDER.indexOf(item.rarity));
    }
    p.gearTier = tier;
  }

  private handlePickup(client: Client, msg: { id: string }) {
    const p = this.state.players.get(client.sessionId);
    const g = msg?.id ? this.state.loot.get(msg.id) : undefined;
    if (!p || !g || p.hp <= 0) return;
    if (Math.hypot(g.x - p.x, g.y - p.y) > PICKUP_RANGE) return;

    if (g.kind === "potion") {
      if (p.potions >= p.maxPotions) return;
      p.potions++;
      this.state.loot.delete(msg.id);
      this.broadcast("pickedup", { id: msg.id, by: client.sessionId });
      return;
    }

    if (g.kind === "manapotion") {
      if (p.manaPotions >= p.maxPotions) return; // the belt holds both colors
      p.manaPotions++;
      this.state.loot.delete(msg.id);
      this.broadcast("pickedup", { id: msg.id, by: client.sessionId });
      return;
    }

    if (g.kind === "gold") {
      p.gold += g.amount;
      this.hoarderHeal(client.sessionId, p, g.amount);
      this.state.loot.delete(msg.id);
      this.broadcast("pickedup", { id: msg.id, by: client.sessionId, gold: g.amount });
      return;
    }

    const item: Item = JSON.parse(g.data);
    const slot = item.unidentified ? null : equipSlotFor(item, p.gear); // no wearing mysteries
    if (slot && !p.gear[slot]) {
      // wearable and the slot is free — straight onto the paper doll
      p.gear[slot] = item;
      if (RARITY_ORDER.indexOf(item.rarity) >= RARITY_ORDER.indexOf("unique")) {
        this.questAdvance(p, client.sessionId, "legend");
      }
      this.recompute(p);
    } else if (p.inventory.length < INVENTORY_SIZE) {
      p.inventory.push(item);
      if (item.slot === "charm") this.recompute(p); // charms work from the bag
    } else {
      return; // nowhere to put it
    }

    this.state.loot.delete(msg.id);
    this.broadcast("pickedup", { id: msg.id, by: client.sessionId });
    this.sendLoadout(client, p);
  }

  private handleDrink(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (!p || p.hp <= 0 || p.potions <= 0 || p.hp >= p.maxHp) return;
    // Bottomless Flask: sometimes the bottle refills itself
    if (!(p.effects.has("deep_pockets") && Math.random() < DEEP_POCKETS_CHANCE)) p.potions--;
    const heal = Math.round(
      (POTION_HEAL + POTION_HEAL_PER_FLOOR * (this.danger() - 1)) * (1 + (p.derived.potionPower ?? 0) / 100)
    );
    const healed = Math.min(heal, p.maxHp - p.hp);
    p.hp += healed;
    this.broadcast("heal", { id: client.sessionId, amount: healed, x: p.x, y: p.y });
  }

  private handleDrinkMana(client: Client) {
    const p = this.state.players.get(client.sessionId);
    if (!p || p.hp <= 0 || p.manaPotions <= 0 || p.mana >= p.maxMana) return;
    if (!(p.effects.has("deep_pockets") && Math.random() < DEEP_POCKETS_CHANCE)) p.manaPotions--;
    const restored = Math.min(Math.round(p.maxMana * MANA_POTION_RESTORE_FRACTION), p.maxMana - p.mana);
    p.mana += restored;
    this.broadcast("manaheal", { id: client.sessionId, amount: restored, x: p.x, y: p.y });
  }

  private handleEquip(client: Client, msg: { id: string }) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !msg?.id) return;
    const idx = p.inventory.findIndex((it) => it.id === msg.id);
    if (idx < 0) return;
    const item = p.inventory[idx];
    if (item.unidentified) return; // identify it first
    const slot = equipSlotFor(item, p.gear);
    if (!slot) return; // charms can't be equipped
    p.inventory.splice(idx, 1);
    const prev = p.gear[slot];
    if (prev) p.inventory.push(prev);
    p.gear[slot] = item;
    if (RARITY_ORDER.indexOf(item.rarity) >= RARITY_ORDER.indexOf("unique")) {
      this.questAdvance(p, client.sessionId, "legend");
    }
    this.recompute(p);
    this.sendLoadout(client, p);
  }

  private handleUnequip(client: Client, msg: { slot: EquipSlot }) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !msg?.slot || !EQUIP_SLOTS.includes(msg.slot)) return;
    const item = p.gear[msg.slot];
    if (!item) return;
    if (p.inventory.length >= INVENTORY_SIZE) return;
    delete p.gear[msg.slot];
    p.inventory.push(item);
    this.recompute(p);
    this.sendLoadout(client, p);
  }

  // insert a rune from the inventory into a socketed item (in bag or equipped)
  private handleSocketRune(client: Client, msg: { runeId: string; itemId: string }) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !msg?.runeId || !msg?.itemId) return;

    const gemIdx = p.inventory.findIndex(
      (it) => it.id === msg.runeId && (it.slot === "rune" || it.slot === "jewel")
    );
    if (gemIdx < 0) return;
    const gem = p.inventory[gemIdx];

    // target may be in the bag or on the paper doll
    const target =
      p.inventory.find((it) => it.id === msg.itemId) ??
      Object.values(p.gear).find((it) => it?.id === msg.itemId);
    if (!target || !target.sockets) return;
    target.runes = target.runes ?? [];
    target.jewels = target.jewels ?? [];
    if (target.runes.length + target.jewels.length >= target.sockets) return;

    let formed: string | undefined;
    let seatedName: string;
    if (gem.slot === "jewel") {
      // a jewel is a choice AGAINST the book: it can never be part of a word
      p.inventory.splice(gemIdx, 1);
      target.jewels.push({ name: gem.name, stats: gem.stats, rarity: gem.rarity });
      seatedName = gem.name;
    } else {
      const runeKey = gem.base.startsWith("rune_") ? gem.base.slice(5) : "";
      if (!RUNES[runeKey]) return;
      p.inventory.splice(gemIdx, 1);
      target.runes.push(runeKey);
      seatedName = RUNES[runeKey].name;
      // did that complete a runeword? (only pure-rune, fully-runed plain steel forms one)
      if (target.jewels.length === 0) {
        const rw = matchRuneword(target);
        if (rw && !target.runeword) {
          target.runeword = rw.name;
          formed = rw.name;
        }
      }
    }

    this.recompute(p);
    this.sendLoadout(client, p);
    client.send("socketed", { item: target.name, rune: seatedName, runeword: formed });
  }

  private handleDropItem(client: Client, msg: { id: string }) {
    const p = this.state.players.get(client.sessionId);
    if (!p || !msg?.id) return;
    const idx = p.inventory.findIndex((it) => it.id === msg.id);
    if (idx < 0) return;
    const item = p.inventory.splice(idx, 1)[0];
    if (item.slot === "charm") this.recompute(p);
    this.spawnGroundItem(item, p.x, p.y);
    this.sendLoadout(client, p);
  }

  private scatter(x: number, y: number, radius = 26): { x: number; y: number } {
    for (let tries = 0; tries < 8; tries++) {
      const ox = x + (Math.random() * 2 - 1) * radius;
      const oy = y + (Math.random() * 2 - 1) * radius;
      if (canStand(this.map, ox, oy)) return { x: ox, y: oy };
    }
    return { x, y };
  }

  private spawnGroundItem(item: Item, x: number, y: number, identified = false) {
    const g = new GroundItem();
    const pos = this.scatter(x, y);
    g.x = pos.x;
    g.y = pos.y;
    g.rarity = item.rarity;
    // good drops land unidentified: the beam tells you the tier, not the truth
    if (!identified && !item.unidentified && UNIDENTIFIED_RARITIES.includes(item.rarity)) {
      item.unidentified = true;
    }
    g.name = item.unidentified
      ? `Unidentified ${BASE_ITEMS[item.base]?.name ?? "Relic"}`
      : item.name;
    if (item.sockets) g.name += ` ◈${item.sockets}`; // socketed steel announces itself
    g.data = JSON.stringify(item);
    g.bornAt = Date.now();
    this.state.loot.set(`loot_${this.nextId++}`, g);
  }

  private spawnGold(x: number, y: number, amount: number) {
    const g = new GroundItem();
    const pos = this.scatter(x, y);
    g.x = pos.x;
    g.y = pos.y;
    g.kind = "gold";
    g.name = `${amount} gold`;
    g.amount = amount;
    g.bornAt = Date.now();
    this.state.loot.set(`loot_${this.nextId++}`, g);
  }

  private spawnPotion(x: number, y: number) {
    const g = new GroundItem();
    const pos = this.scatter(x, y);
    g.x = pos.x;
    g.y = pos.y;
    g.kind = "potion";
    g.name = "Health Potion";
    g.bornAt = Date.now();
    this.state.loot.set(`loot_${this.nextId++}`, g);
  }

  private spawnManaPotion(x: number, y: number) {
    const g = new GroundItem();
    const pos = this.scatter(x, y);
    g.x = pos.x;
    g.y = pos.y;
    g.kind = "manapotion";
    g.name = "Mana Potion";
    g.bornAt = Date.now();
    this.state.loot.set(`loot_${this.nextId++}`, g);
  }

  // --- combat ---

  // Golden Vigor: wealth is health
  private hoarderHeal(sid: string, p: Player, gold: number) {
    if (!p.effects.has("hoarder") || p.hp <= 0 || p.hp >= p.maxHp) return;
    const heal = Math.min(Math.max(1, Math.round(gold * HOARDER_HEAL_PER_GOLD)), p.maxHp - p.hp);
    p.hp += heal;
    this.broadcast("heal", { id: sid, amount: heal, x: p.x, y: p.y });
  }

  private cdrMult(p: Player): number {
    return 1 - Math.min(40, p.derived.cdr ?? 0) / 100;
  }

  private attackCooldown(p: Player): number {
    const atk = CLASS_ATTACKS[p.cls as keyof typeof CLASS_ATTACKS];
    return Math.max(150, atk.cooldownMs * (1 - (p.derived.atkSpd ?? 0) / 100) * this.cdrMult(p));
  }

  private outgoingDamage(p: Player, base: [number, number], mult = 1): number {
    const now = Date.now();
    const d = p.derived;
    const fire = d.fireDmg ?? 0;
    const cold = d.coldDmg ?? 0;
    const lightRoll = d.lightDmg ? Math.round(Math.random() * 2 * d.lightDmg) : 0; // lightning is swingy
    const elem = fire + cold + lightRoll;
    let flat = rollDamage(base) + (d.dmg ?? 0) + elem;
    if (p.effects.has("patriarch")) flat += p.level;
    // record the elemental make-up so damageMonster can apply monster resistances. The
    // dominant element (by contribution) is what a resistant monster shrugs off.
    if (elem > 0) {
      p.lastElem = fire >= cold && fire >= lightRoll ? "fire" : cold >= lightRoll ? "cold" : "light";
      p.lastElemFrac = Math.min(1, elem / flat);
    } else {
      p.lastElem = "";
      p.lastElemFrac = 0;
    }
    const shout = now < p.shoutUntil ? SHOUT_DMG_MULT : 1;
    const blessed = now < p.buffDmgUntil ? SHRINE_DMG_MULT : 1;
    const wolf = now < p.wolfUntil ? WOLF_DMG_MULT : 1;
    // Death Wish: the dying hit hardest
    const berserk = p.effects.has("berserk_low") && p.hp < p.maxHp * BERSERK_THRESHOLD ? BERSERK_MULT : 1;
    let total = flat * (1 + (d.dmgPct ?? 0) / 100) * mult * shout * blessed * wolf * berserk;
    p.lastCrit = Math.random() < (d.crit ?? 0) / 100;
    if (p.lastCrit) total *= 2;
    return Math.max(1, Math.round(total));
  }

  private magicFindOf(p: Player | undefined): number {
    if (!p) return 0;
    return (p.derived.magicFind ?? 0) + (Date.now() < p.buffMfUntil ? SHRINE_MF_BONUS : 0);
  }

  private goldAmount(p: Player | undefined, base: number): number {
    return Math.round(base * (1 + (p?.derived.goldFind ?? 0) / 100));
  }

  private monsterDamage(m: Monster): number {
    const def = MONSTERS[m.kind as MonsterKind];
    return Math.round(rollDamage(def.dmg) * floorDmgMult(this.danger()) * m.dmgMult);
  }

  private monsterStep(m: Monster, dt: number, now: number): number {
    const def = MONSTERS[m.kind as MonsterKind];
    const chill = now < m.slowUntil ? FROSTNOVA_SLOW : 1;
    const charge = now < m.chargeUntil ? VURUK_CHARGE_SPEED_MULT : 1; // Vuruk comes for you FAST
    return def.speed * m.speedMult * chill * charge * dt;
  }

  // monsters never set foot in town — sacred ground stops them at the gate
  private monsterCanStand(x: number, y: number): boolean {
    return y >= TOWN_BOUNDARY_Y + 6 && canStand(this.map, x, y);
  }

  private spawnProjectile(p: Player, sessionId: string, kind: string, dirX: number, dirY: number, speed: number, mult = 0) {
    const proj = new Projectile();
    proj.x = p.x;
    proj.y = p.y;
    proj.kind = kind;
    proj.vx = dirX * speed;
    proj.vy = dirY * speed;
    proj.bornAt = Date.now();
    proj.owner = sessionId;
    proj.mult = mult;
    this.state.projectiles.set(`proj_${this.nextId++}`, proj);
  }

  private handleAttack(sessionId: string, msg: { x: number; y: number }) {
    const p = this.state.players.get(sessionId);
    if (!p || p.hp <= 0 || !this.validCoords(msg)) return;

    // a druid in wolf form fights with tooth and claw, whatever he's holding
    const atk: Attack = Date.now() < p.wolfUntil ? WOLF_ATTACK : CLASS_ATTACKS[p.cls as keyof typeof CLASS_ATTACKS];
    if (!atk) return;

    const now = Date.now();
    if (now - p.lastAttack < this.attackCooldown(p)) return;
    p.lastAttack = now;

    // Stormlord: every 6th swing, the sky joins in
    if (p.effects.has("stormlord") && ++p.attackCounter % STORMLORD_EVERY === 0) {
      const targets: Array<{ id: string; m: Monster }> = [];
      this.state.monsters.forEach((m, id) => {
        if (targets.length < 3 && Math.hypot(m.x - msg.x, m.y - msg.y) <= 140) targets.push({ id, m });
      });
      if (targets.length) {
        this.broadcast("chainfx", { points: [{ x: p.x, y: p.y }, ...targets.map((t) => ({ x: t.m.x, y: t.m.y }))] });
        targets.forEach((t) => {
          const m = this.state.monsters.get(t.id);
          if (m) this.damageMonster(t.id, m, this.outgoingDamage(p, [8, 14], 0.8), sessionId, false);
        });
      }
    }

    const dx = msg.x - p.x;
    const dy = msg.y - p.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const dirX = dx / len;
    const dirY = dy / len;

    if (atk.type === "melee") {
      this.broadcast("swing", { id: sessionId, x: p.x, y: p.y, dirX, dirY });
      const cosHalfArc = Math.cos(((atk.arcDeg / 2) * Math.PI) / 180);
      const hits: string[] = [];
      this.state.monsters.forEach((m, id) => {
        const def = MONSTERS[m.kind as MonsterKind];
        const mx = m.x - p.x;
        const my = m.y - p.y;
        const d = Math.hypot(mx, my);
        if (d > atk.range + def.radius) return;
        if (d > 1 && (mx / d) * dirX + (my / d) * dirY < cosHalfArc) return;
        hits.push(id);
      });
      hits.forEach((id) => {
        const m = this.state.monsters.get(id);
        if (m) this.damageMonster(id, m, this.outgoingDamage(p, atk.dmg), sessionId);
      });
    } else {
      this.spawnProjectile(p, sessionId, atk.kind, dirX, dirY, atk.speed);
    }
  }

  // one meteor drop — factored out so Twinned Meteor (a skill-power) can call it twice
  // one Volcano eruption — a burst + a lingering fire pool. Cataclysm calls this twice.
  private volcanoErupt(sessionId: string, cx: number, cy: number, mult: number) {
    const p = this.state.players.get(sessionId);
    if (!p) return;
    this.broadcast("classfx", { kind: "volcano", x: cx, y: cy, r: 90 });
    const hits: string[] = [];
    this.state.monsters.forEach((m, id) => {
      const def = MONSTERS[m.kind as MonsterKind];
      if (Math.hypot(m.x - cx, m.y - cy) <= 90 + def.radius) hits.push(id);
    });
    hits.forEach((id) => {
      const m = this.state.monsters.get(id);
      if (m) this.damageMonster(id, m, this.outgoingDamage(p, [9, 15], mult), sessionId);
    });
    this.hazards.push({ ax: cx, ay: cy, bx: cx, by: cy, width: 55, until: Date.now() + 3000, nextTick: Date.now(), owner: sessionId, mult: mult * 0.2 });
  }

  private meteorStrike(sessionId: string, cx: number, cy: number, mult: number) {
    this.broadcast("meteorwarn", { x: cx, y: cy, r: METEOR_RADIUS, ms: METEOR_DELAY_MS });
    this.clock.setTimeout(() => {
      const pl = this.state.players.get(sessionId);
      if (!pl) return;
      const atk = CLASS_ATTACKS[pl.cls as keyof typeof CLASS_ATTACKS];
      this.broadcast("meteorfall", { x: cx, y: cy, r: METEOR_RADIUS });
      const hits: string[] = [];
      this.state.monsters.forEach((m, id) => {
        const def = MONSTERS[m.kind as MonsterKind];
        if (Math.hypot(m.x - cx, m.y - cy) <= METEOR_RADIUS + def.radius) hits.push(id);
      });
      hits.forEach((id) => {
        const m = this.state.monsters.get(id);
        if (m) this.damageMonster(id, m, this.outgoingDamage(pl, atk.dmg, mult), sessionId);
      });
      this.hazards.push({
        ax: cx, ay: cy, bx: cx, by: cy, width: METEOR_RADIUS * 0.7,
        until: Date.now() + METEOR_BURN_MS, nextTick: Date.now(), owner: sessionId, mult: mult * 0.15,
      });
    }, METEOR_DELAY_MS);
  }

  private handleSkill(sessionId: string, msg: { key: string; x: number; y: number }) {
    const p = this.state.players.get(sessionId);
    if (!p || p.hp <= 0 || !this.validCoords(msg)) return;

    const key = String(msg.key).toUpperCase() as SkillKey;
    const skillId = p.binds[key];
    if (!skillId) return;
    const skill = skillById(p.cls as ClassName, skillId);
    if (!skill || skill.type === "passive") return;
    // +skills from gear boosts the ranks (and synergies) of skills you've learned
    const eff = effectiveSkills(p.skills, p.derived.plusSkills ?? 0);
    const rank = eff[skill.id] ?? 0;
    if (rank <= 0) return;

    const now = Date.now();
    if (now < (p.skillReady[skill.id] ?? 0)) return;
    if (p.mana < (skill.mana ?? 0)) return;

    const atk = CLASS_ATTACKS[p.cls as keyof typeof CLASS_ATTACKS];
    const mult = skillDamageMult(skill, eff); // rank + synergy scaling, +skills included
    const dx = msg.x - p.x;
    const dy = msg.y - p.y;
    const len = Math.hypot(dx, dy);
    const dirX = len < 1 ? 1 : dx / len;
    const dirY = len < 1 ? 0 : dy / len;

    let succeeded = true;

    switch (skill.id) {
      case "bash": {
        // heavy single strike: nearest monster in front, stunned cold
        let bestId = "";
        let bestM: Monster | null = null;
        let bestD = Infinity;
        this.state.monsters.forEach((m, id) => {
          const def = MONSTERS[m.kind as MonsterKind];
          const d = Math.hypot(m.x - p.x, m.y - p.y);
          if (d > BASH_RANGE + def.radius) return;
          const dd = d || 1;
          if (((m.x - p.x) / dd) * dirX + ((m.y - p.y) / dd) * dirY < 0.3 && d > 20) return;
          if (d < bestD) {
            bestD = d;
            bestId = id;
            bestM = m;
          }
        });
        if (!bestM) {
          succeeded = false;
          break;
        }
        const target: Monster = bestM;
        this.broadcast("swing", { id: sessionId, x: p.x, y: p.y, dirX, dirY });
        target.stunUntil = now + BASH_STUN_MS;
        this.damageMonster(bestId, target, this.outgoingDamage(p, atk.dmg, mult), sessionId);
        break;
      }

      case "warcry": {
        this.broadcast("warcryfx", { id: sessionId, x: p.x, y: p.y, r: WARCRY_RADIUS });
        const shred = p.powers.has("warcry_shred");
        const hits: string[] = [];
        this.state.monsters.forEach((m, id) => {
          const def = MONSTERS[m.kind as MonsterKind];
          if (Math.hypot(m.x - p.x, m.y - p.y) <= WARCRY_RADIUS + def.radius) hits.push(id);
        });
        hits.forEach((id) => {
          const m = this.state.monsters.get(id);
          if (!m) return;
          m.stunUntil = now + WARCRY_STUN_MS;
          // Sundering Roar: shred the guard (extra harm) and hurl the pack back
          if (shred) {
            m.vulnUntil = Math.max(m.vulnUntil, now + WARCRY_SHRED_MS);
            const kx = m.x - p.x;
            const ky = m.y - p.y;
            const kd = Math.hypot(kx, ky) || 1;
            const nx = m.x + (kx / kd) * WARCRY_KNOCKBACK;
            const ny = m.y + (ky / kd) * WARCRY_KNOCKBACK;
            if (canStand(this.map, nx, ny)) { m.x = nx; m.y = ny; }
          }
          this.damageMonster(id, m, this.outgoingDamage(p, atk.dmg, mult), sessionId);
        });
        break;
      }

      case "ancients": {
        this.broadcast("ancientsfx", { id: sessionId, x: p.x, y: p.y, r: ANCIENTS_RADIUS });
        const hits: string[] = [];
        this.state.monsters.forEach((m, id) => {
          const def = MONSTERS[m.kind as MonsterKind];
          if (Math.hypot(m.x - p.x, m.y - p.y) <= ANCIENTS_RADIUS + def.radius) hits.push(id);
        });
        hits.forEach((id) => {
          const m = this.state.monsters.get(id);
          if (!m) return;
          m.stunUntil = now + ANCIENTS_STUN_MS;
          this.damageMonster(id, m, this.outgoingDamage(p, atk.dmg, mult), sessionId);
        });
        break;
      }

      case "coldarrow": {
        const proj = new Projectile();
        proj.x = p.x;
        proj.y = p.y;
        proj.kind = "icearrow";
        proj.vx = dirX * COLDARROW_SPEED;
        proj.vy = dirY * COLDARROW_SPEED;
        proj.bornAt = now;
        proj.owner = sessionId;
        proj.mult = mult;
        proj.chillMs = COLDARROW_CHILL_MS + (rank - 1) * 300;
        this.state.projectiles.set(`proj_${this.nextId++}`, proj);
        break;
      }

      case "vengeance": {
        // arrows blot out the sky over the target area, in waves
        const cx = p.x + dirX * Math.min(len, 260);
        const cy = p.y + dirY * Math.min(len, 260);
        this.broadcast("vengeancefx", { x: cx, y: cy, r: VENGEANCE_RADIUS, waves: VENGEANCE_WAVES, waveMs: VENGEANCE_WAVE_MS });
        for (let w = 0; w < VENGEANCE_WAVES; w++) {
          this.clock.setTimeout(() => {
            const pl = this.state.players.get(sessionId);
            if (!pl) return;
            const hits: string[] = [];
            this.state.monsters.forEach((m, id) => {
              const def = MONSTERS[m.kind as MonsterKind];
              if (Math.hypot(m.x - cx, m.y - cy) <= VENGEANCE_RADIUS + def.radius) hits.push(id);
            });
            hits.forEach((id) => {
              const m = this.state.monsters.get(id);
              if (m) this.damageMonster(id, m, this.outgoingDamage(pl, atk.dmg, mult), sessionId);
            });
          }, w * VENGEANCE_WAVE_MS);
        }
        break;
      }

      case "firewall": {
        // a burning line perpendicular to the cast direction, at the cursor
        const cx = p.x + dirX * Math.min(len, 240);
        const cy = p.y + dirY * Math.min(len, 240);
        const px = -dirY; // perpendicular
        const py = dirX;
        this.hazards.push({
          ax: cx - px * FIREWALL_LENGTH / 2,
          ay: cy - py * FIREWALL_LENGTH / 2,
          bx: cx + px * FIREWALL_LENGTH / 2,
          by: cy + py * FIREWALL_LENGTH / 2,
          width: 26,
          until: now + FIREWALL_DURATION_MS,
          nextTick: now,
          owner: sessionId,
          mult,
        });
        this.broadcast("firewallfx", {
          ax: cx - px * FIREWALL_LENGTH / 2,
          ay: cy - py * FIREWALL_LENGTH / 2,
          bx: cx + px * FIREWALL_LENGTH / 2,
          by: cy + py * FIREWALL_LENGTH / 2,
          ms: FIREWALL_DURATION_MS,
        });
        break;
      }

      case "meteor": {
        const cx = p.x + dirX * Math.min(len, 280);
        const cy = p.y + dirY * Math.min(len, 280);
        this.meteorStrike(sessionId, cx, cy, mult);
        // Twinned Meteor (Starfall): a second stone falls a beat later, just off-center
        if (p.powers.has("meteor_twice")) {
          this.clock.setTimeout(() => this.meteorStrike(sessionId, cx + 42, cy + 26, mult), 260);
        }
        break;
      }

      case "smite": {
        // shield to the face — like Bash, but holier
        let bestId = "";
        let bestM: Monster | null = null;
        let bestD = Infinity;
        this.state.monsters.forEach((m, id) => {
          const def = MONSTERS[m.kind as MonsterKind];
          const d = Math.hypot(m.x - p.x, m.y - p.y);
          if (d > BASH_RANGE + def.radius) return;
          if (d < bestD) {
            bestD = d;
            bestId = id;
            bestM = m;
          }
        });
        if (!bestM) {
          succeeded = false;
          break;
        }
        const target: Monster = bestM;
        this.broadcast("swing", { id: sessionId, x: p.x, y: p.y, dirX, dirY });
        target.stunUntil = now + 800;
        this.damageMonster(bestId, target, this.outgoingDamage(p, atk.type === "melee" ? atk.dmg : [9, 15], mult), sessionId);
        break;
      }

      case "zeal": {
        // three strikes in one breath, walking down the nearest foes
        let struck = 0;
        for (let hit = 0; hit < ZEAL_HITS; hit++) {
          let bestId = "";
          let bestD = Infinity;
          this.state.monsters.forEach((m, id) => {
            const def = MONSTERS[m.kind as MonsterKind];
            const d = Math.hypot(m.x - p.x, m.y - p.y);
            if (d <= 60 + def.radius && d < bestD) {
              bestD = d;
              bestId = id;
            }
          });
          const m = bestId ? this.state.monsters.get(bestId) : undefined;
          if (!m) break;
          struck++;
          this.clock.setTimeout(() => {
            const mm = this.state.monsters.get(bestId);
            const pl = this.state.players.get(sessionId);
            if (mm && pl) {
              this.broadcast("swing", { id: sessionId, x: pl.x, y: pl.y, dirX, dirY });
              this.damageMonster(bestId, mm, this.outgoingDamage(pl, [9, 15], mult), sessionId);
            }
          }, hit * 130);
        }
        // Holy Fervor: every fifth Zeal detonates a nova of holy light
        if (struck > 0 && p.powers.has("zeal_nova") && ++p.zealCounter % ZEAL_NOVA_EVERY === 0) {
          this.broadcast("classfx", { kind: "prayer", x: p.x, y: p.y, r: ZEAL_NOVA_RADIUS });
          const novaHits: string[] = [];
          this.state.monsters.forEach((m, id) => {
            const def = MONSTERS[m.kind as MonsterKind];
            if (Math.hypot(m.x - p.x, m.y - p.y) <= ZEAL_NOVA_RADIUS + def.radius) novaHits.push(id);
          });
          novaHits.forEach((id) => {
            const m = this.state.monsters.get(id);
            if (m) this.damageMonster(id, m, this.outgoingDamage(p, [9, 15], ZEAL_NOVA_MULT), sessionId);
          });
        }
        if (struck === 0) succeeded = false;
        break;
      }

      case "hammers": {
        // blessed steel in every direction — Twin Hammers doubles the ring
        const count = HAMMER_COUNT * (p.powers.has("hammer_twin") ? 2 : 1);
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + Math.atan2(dirY, dirX);
          this.spawnProjectile(p, sessionId, "hammer", Math.cos(a), Math.sin(a), HAMMER_SPEED, mult);
        }
        break;
      }

      case "fistofheavens": {
        const cx = p.x + dirX * Math.min(len, 280);
        const cy = p.y + dirY * Math.min(len, 280);
        this.broadcast("classfx", { kind: "fist", x: cx, y: cy, r: FIST_RADIUS });
        const hits: string[] = [];
        this.state.monsters.forEach((m, id) => {
          const def = MONSTERS[m.kind as MonsterKind];
          if (Math.hypot(m.x - cx, m.y - cy) <= FIST_RADIUS + def.radius) hits.push(id);
        });
        hits.forEach((id) => {
          const m = this.state.monsters.get(id);
          if (m) this.damageMonster(id, m, this.outgoingDamage(p, [9, 15], mult), sessionId);
        });
        // holy bolts mend the faithful nearby
        this.state.players.forEach((ally, sid) => {
          if (ally.hp <= 0 || Math.hypot(ally.x - p.x, ally.y - p.y) > PRAYER_RADIUS) return;
          const heal = Math.round(ally.maxHp * 0.15);
          ally.hp = Math.min(ally.maxHp, ally.hp + heal);
          this.broadcast("heal", { id: sid, amount: heal, x: ally.x, y: ally.y });
        });
        break;
      }

      case "prayer": {
        // the whole party mends — the paladin's gift; Sanctuary also shields each ally
        this.broadcast("classfx", { kind: "prayer", x: p.x, y: p.y, r: PRAYER_RADIUS });
        const shield = p.powers.has("prayer_aegis");
        let didSomething = false;
        const healAmt = this.outgoingDamage(p, [10, 14], mult);
        this.state.players.forEach((ally, sid) => {
          if (ally.hp <= 0 || Math.hypot(ally.x - p.x, ally.y - p.y) > PRAYER_RADIUS) return;
          const healed = Math.min(healAmt, ally.maxHp - ally.hp);
          if (healed > 0) {
            ally.hp += healed;
            didSomething = true;
            this.broadcast("heal", { id: sid, amount: healed, x: ally.x, y: ally.y });
          }
          if (shield) {
            ally.shieldUntil = now + PRAYER_SHIELD_MS; // swallows the next blow
            didSomething = true;
            this.broadcast("aegisfx", { id: sid, x: ally.x, y: ally.y });
          }
        });
        if (!didSomething) succeeded = false; // no wounds and no shield to give, no cost
        break;
      }

      case "teeth": {
        const baseAngle = Math.atan2(dirY, dirX);
        for (let i = -(TEETH_COUNT - 1) / 2; i <= (TEETH_COUNT - 1) / 2; i++) {
          const a = baseAngle + i * 0.16;
          this.spawnProjectile(p, sessionId, "bone", Math.cos(a), Math.sin(a), 380, mult);
        }
        break;
      }

      case "decrepify": {
        const cx = p.x + dirX * Math.min(len, 240);
        const cy = p.y + dirY * Math.min(len, 240);
        this.broadcast("classfx", { kind: "curse", x: cx, y: cy, r: DECREPIFY_RADIUS });
        const hits: string[] = [];
        this.state.monsters.forEach((m, id) => {
          const def = MONSTERS[m.kind as MonsterKind];
          if (Math.hypot(m.x - cx, m.y - cy) <= DECREPIFY_RADIUS + def.radius) hits.push(id);
        });
        hits.forEach((id) => {
          const m = this.state.monsters.get(id);
          if (!m) return;
          m.vulnUntil = now + DECREPIFY_MS + (rank - 1) * 800;
          m.slowUntil = now + DECREPIFY_MS;
          // Plaguecarrier: this curse will leap to the pack when the host dies
          if (p.powers.has("wither_spread")) m.curseSpreadsUntil = now + DECREPIFY_MS + (rank - 1) * 800;
          this.damageMonster(id, m, this.outgoingDamage(p, [8, 14], mult), sessionId);
        });
        break;
      }

      case "poisonnova": {
        this.broadcast("classfx", { kind: "poison", x: p.x, y: p.y, r: POISONNOVA_RADIUS });
        const hits: string[] = [];
        this.state.monsters.forEach((m, id) => {
          const def = MONSTERS[m.kind as MonsterKind];
          if (Math.hypot(m.x - p.x, m.y - p.y) <= POISONNOVA_RADIUS + def.radius) hits.push(id);
        });
        hits.forEach((id) => {
          const m = this.state.monsters.get(id);
          if (m) this.damageMonster(id, m, this.outgoingDamage(p, [8, 14], mult), sessionId);
        });
        // Contagion: a plague pool lingers where the nova broke, eating the ground it covers
        if (p.powers.has("poison_lingering")) {
          this.hazards.push({ ax: p.x, ay: p.y, bx: p.x, by: p.y, width: POISONNOVA_RADIUS, until: now + POISON_POOL_MS, nextTick: now, owner: sessionId, mult: mult * POISON_POOL_MULT });
          this.broadcast("poolfx", { x: p.x, y: p.y, r: POISONNOVA_RADIUS, ms: POISON_POOL_MS, hue: 0x7ac850 });
        }
        break;
      }

      case "skeleton":
      case "army": {
        // Bone Legion (a skill-power) commands a larger host and raises an extra at a time
        const legion = p.powers.has("bone_legion");
        const cap = (skill.id === "army" ? 6 : petCapFor(rank)) + (legion ? 2 : 0);
        let mine = 0;
        this.state.pets.forEach((pet) => {
          if (pet.owner === sessionId) mine++;
        });
        const want = (skill.id === "army" ? 4 : 1) + (legion ? 1 : 0);
        let raised = 0;
        for (let i = 0; i < want && mine + raised < cap + (skill.id === "army" ? 3 : 0); i++) {
          const pet = new Pet();
          const pos = this.scatter(p.x, p.y);
          pet.x = pos.x;
          pet.y = pos.y;
          pet.owner = sessionId;
          pet.dmg = Math.max(1, this.outgoingDamage(p, [6, 10], mult));
          pet.until = now + PET_DURATION_MS;
          this.state.pets.set(`pet_${this.nextId++}`, pet);
          raised++;
        }
        if (raised === 0) {
          succeeded = false;
          break;
        }
        this.broadcast("classfx", { kind: "raise", x: p.x, y: p.y, r: 40 });
        break;
      }

      case "firestorm": {
        // ribbons of flame race toward the cursor
        const cx = p.x + dirX * Math.min(len, 200);
        const cy = p.y + dirY * Math.min(len, 200);
        this.hazards.push({
          ax: p.x + dirX * 30, ay: p.y + dirY * 30, bx: cx, by: cy,
          width: 22, until: now + 2200, nextTick: now, owner: sessionId, mult,
        });
        this.broadcast("firewallfx", { ax: p.x + dirX * 30, ay: p.y + dirY * 30, bx: cx, by: cy, ms: 2200 });
        break;
      }

      case "twister": {
        // a blade of wind that carves a path and scatters the pack — Tempest (a skill-power)
        // splits it into three fanned blades
        const baseA = Math.atan2(dirY, dirX);
        const angles = p.powers.has("twister_swarm") ? [-0.32, 0, 0.32] : [0];
        for (const off of angles) {
          const ax = Math.cos(baseA + off);
          const ay = Math.sin(baseA + off);
          const ex = p.x + ax * PIERCE_LENGTH;
          const ey = p.y + ay * PIERCE_LENGTH;
          this.broadcast("piercefx", { fromX: p.x, fromY: p.y, toX: ex, toY: ey });
          const hits: string[] = [];
          this.state.monsters.forEach((m, id) => {
            const def = MONSTERS[m.kind as MonsterKind];
            const t = (m.x - p.x) * ax + (m.y - p.y) * ay;
            if (t < 0 || t > PIERCE_LENGTH) return;
            const px = p.x + ax * t;
            const py = p.y + ay * t;
            if (Math.hypot(m.x - px, m.y - py) <= PIERCE_WIDTH / 2 + def.radius) hits.push(id);
          });
          hits.forEach((id) => {
            const m = this.state.monsters.get(id);
            if (!m) return;
            const nx = m.x + ax * 30;
            const ny = m.y + ay * 30;
            if (canStand(this.map, nx, ny)) {
              m.x = nx;
              m.y = ny;
            }
            this.damageMonster(id, m, this.outgoingDamage(p, [9, 15], mult), sessionId);
          });
        }
        break;
      }

      case "volcano": {
        const cx = p.x + dirX * Math.min(len, 240);
        const cy = p.y + dirY * Math.min(len, 240);
        this.volcanoErupt(sessionId, cx, cy, mult);
        // Cataclysm: a second mountain heaves up just off-center a beat later
        if (p.powers.has("volcano_twin")) {
          this.clock.setTimeout(() => this.volcanoErupt(sessionId, cx + 46, cy + 28, mult), VOLCANO_TWIN_DELAY_MS);
        }
        break;
      }

      case "hurricane": {
        // the storm follows its druid
        this.hazards.push({
          ax: p.x, ay: p.y, bx: p.x, by: p.y, width: HURRICANE_RADIUS,
          until: now + HURRICANE_MS + (rank - 1) * 1500, nextTick: now,
          owner: sessionId, mult, followSid: sessionId, chill: true,
        });
        this.broadcast("classfx", { kind: "hurricane", x: p.x, y: p.y, r: HURRICANE_RADIUS, ms: HURRICANE_MS + (rank - 1) * 1500, follow: sessionId });
        break;
      }

      case "werewolf": {
        p.wolfUntil = now + WOLF_DURATION_MS + (rank - 1) * WOLF_DURATION_PER_RANK_MS;
        this.broadcast("classfx", { kind: "wolf", x: p.x, y: p.y, r: 30 });
        // Pack Leader: the howl calls a spirit wolf to hunt beside you
        if (p.powers.has("werewolf_howl")) {
          const pet = new Pet();
          const pos = this.scatter(p.x, p.y);
          pet.x = pos.x;
          pet.y = pos.y;
          pet.owner = sessionId;
          pet.kind = "wolf";
          pet.dmg = Math.max(1, this.outgoingDamage(p, [8, 14], mult));
          pet.until = now + PET_DURATION_MS;
          this.state.pets.set(`pet_${this.nextId++}`, pet);
          this.broadcast("classfx", { kind: "raise", x: pos.x, y: pos.y, r: 40 });
        }
        break;
      }

      case "whirlwind": {
        this.broadcast("whirl", { id: sessionId, x: p.x, y: p.y });
        // Rending Storm (a skill-power): a wider reap that leaves the ground burning
        const rend = p.powers.has("whirl_rend");
        const radius = WHIRLWIND_RADIUS * (rend ? 1.5 : 1);
        const hits: string[] = [];
        this.state.monsters.forEach((m, id) => {
          const def = MONSTERS[m.kind as MonsterKind];
          if (Math.hypot(m.x - p.x, m.y - p.y) <= radius + def.radius) hits.push(id);
        });
        hits.forEach((id) => {
          const m = this.state.monsters.get(id);
          if (m) this.damageMonster(id, m, this.outgoingDamage(p, atk.dmg, mult), sessionId);
        });
        if (rend) {
          this.hazards.push({
            ax: p.x, ay: p.y, bx: p.x, by: p.y, width: radius,
            until: now + 1400, nextTick: now, owner: sessionId, mult: mult * 0.12,
          });
          this.broadcast("firewallfx", { ax: p.x - 4, ay: p.y, bx: p.x + 4, by: p.y, ms: 1400 });
        }
        break;
      }

      case "shout": {
        p.shoutUntil = now + SHOUT_DURATION_MS + (rank - 1) * SHOUT_RANK_MS;
        this.broadcast("shout", { id: sessionId, x: p.x, y: p.y });
        break;
      }

      case "multishot": {
        const baseAngle = Math.atan2(dirY, dirX);
        // Endless Quiver (a skill-power) fans out a far wider volley
        const arrows = MULTISHOT_COUNT + Math.floor((rank - 1) / 2) + (p.powers.has("multi_volley") ? 8 : 0);
        const half = Math.floor(arrows / 2);
        for (let i = -half; i <= half; i++) {
          const a = baseAngle + (i * MULTISHOT_SPREAD_DEG * Math.PI) / 180;
          if (atk.type === "projectile") {
            this.spawnProjectile(p, sessionId, "arrow", Math.cos(a), Math.sin(a), atk.speed, mult);
          }
        }
        break;
      }

      case "dash": {
        let bx = p.x;
        let by = p.y;
        const dashRange = DASH_RANGE + (rank - 1) * 20;
        for (let step = 10; step <= dashRange; step += 10) {
          const nx = p.x + dirX * step;
          const ny = p.y + dirY * step;
          if (!canStand(this.map, nx, ny)) break;
          bx = nx;
          by = ny;
        }
        if (Math.hypot(bx - p.x, by - p.y) < 20) {
          succeeded = false;
          break;
        }
        this.broadcast("dashfx", { id: sessionId, fromX: p.x, fromY: p.y, toX: bx, toY: by });
        p.x = p.targetX = bx;
        p.y = p.targetY = by;
        break;
      }

      case "chain": {
        const all: Array<{ id: string; m: Monster }> = [];
        this.state.monsters.forEach((m, id) => all.push({ id, m }));

        const inCastRange = all.filter(({ m }) => Math.hypot(m.x - p.x, m.y - p.y) <= CHAIN_CAST_RANGE);
        inCastRange.sort(
          (a, b) =>
            Math.hypot(a.m.x - msg.x, a.m.y - msg.y) - Math.hypot(b.m.x - msg.x, b.m.y - msg.y)
        );

        // Stormfork: the bolt forks to more foes, and every strike stuns
        const fork = p.powers.has("chain_fork");
        const maxJumps = CHAIN_FALLOFF.length + (fork ? CHAIN_FORK_JUMPS : 0);
        const targets: Array<{ id: string; m: Monster }> = [];
        let cur = inCastRange[0];
        while (cur && targets.length < maxJumps) {
          targets.push(cur);
          const from = cur.m;
          cur = all
            .filter(
              ({ id, m }) =>
                !targets.some((t) => t.id === id) &&
                Math.hypot(m.x - from.x, m.y - from.y) <= CHAIN_JUMP_RANGE
            )
            .sort(
              (a, b) =>
                Math.hypot(a.m.x - from.x, a.m.y - from.y) - Math.hypot(b.m.x - from.x, b.m.y - from.y)
            )[0];
        }

        const points = [{ x: p.x, y: p.y }, ...targets.map(({ m }) => ({ x: m.x, y: m.y }))];
        if (targets.length === 0) {
          const fx = p.x + dirX * Math.min(len, CHAIN_CAST_RANGE);
          const fy = p.y + dirY * Math.min(len, CHAIN_CAST_RANGE);
          points.push({ x: fx, y: fy });
        }
        this.broadcast("chainfx", { points });

        targets.forEach(({ id }, i) => {
          const m = this.state.monsters.get(id);
          if (!m) return;
          // extra fork jumps ride the weakest falloff step
          const falloff = CHAIN_FALLOFF[Math.min(i, CHAIN_FALLOFF.length - 1)];
          if (fork && !isBossKind(m.kind)) m.stunUntil = Math.max(m.stunUntil, now + CHAIN_FORK_STUN_MS);
          this.damageMonster(id, m, this.outgoingDamage(p, atk.dmg, falloff * mult), sessionId);
        });
        break;
      }

      case "leap": {
        const dist = Math.min(len, LEAP_RANGE);
        let landed = false;
        let lx = p.x;
        let ly = p.y;
        for (const frac of [1, 0.75, 0.5]) {
          const nx = p.x + dirX * dist * frac;
          const ny = p.y + dirY * dist * frac;
          if (canStand(this.map, nx, ny)) {
            lx = nx;
            ly = ny;
            landed = true;
            break;
          }
        }
        if (!landed) {
          succeeded = false;
          break;
        }
        this.broadcast("leapfx", { id: sessionId, fromX: p.x, fromY: p.y, toX: lx, toY: ly, r: LEAP_RADIUS });
        p.x = p.targetX = lx;
        p.y = p.targetY = ly;
        const hits: string[] = [];
        this.state.monsters.forEach((m, id) => {
          const def = MONSTERS[m.kind as MonsterKind];
          if (Math.hypot(m.x - lx, m.y - ly) <= LEAP_RADIUS + def.radius) hits.push(id);
        });
        hits.forEach((id) => {
          const m = this.state.monsters.get(id);
          if (!m) return;
          // knock the pack away from the impact
          const kx = m.x - lx;
          const ky = m.y - ly;
          const kd = Math.hypot(kx, ky) || 1;
          const nx = m.x + (kx / kd) * LEAP_KNOCKBACK;
          const ny = m.y + (ky / kd) * LEAP_KNOCKBACK;
          if (canStand(this.map, nx, ny)) {
            m.x = nx;
            m.y = ny;
          }
          this.damageMonster(id, m, this.outgoingDamage(p, atk.dmg, mult), sessionId);
        });
        // Aftershock: the ground where you landed keeps rupturing for a beat
        if (p.powers.has("leap_quake")) {
          this.hazards.push({ ax: lx, ay: ly, bx: lx, by: ly, width: LEAP_RADIUS, until: now + LEAP_QUAKE_MS, nextTick: now, owner: sessionId, mult: mult * LEAP_QUAKE_MULT });
          this.broadcast("poolfx", { x: lx, y: ly, r: LEAP_RADIUS, ms: LEAP_QUAKE_MS, hue: 0xd07a2a });
        }
        break;
      }

      case "pierce": {
        // Ricochet: a second bolt caroms off into a parallel lane
        const baseA = Math.atan2(dirY, dirX);
        const angles = p.powers.has("pierce_ricochet") ? [0, PIERCE_RICOCHET_ANGLE] : [0];
        for (const off of angles) {
          const ax = Math.cos(baseA + off);
          const ay = Math.sin(baseA + off);
          const ex = p.x + ax * PIERCE_LENGTH;
          const ey = p.y + ay * PIERCE_LENGTH;
          this.broadcast("piercefx", { fromX: p.x, fromY: p.y, toX: ex, toY: ey });
          const hits: string[] = [];
          this.state.monsters.forEach((m, id) => {
            const def = MONSTERS[m.kind as MonsterKind];
            const t = (m.x - p.x) * ax + (m.y - p.y) * ay; // project onto the shot line
            if (t < 0 || t > PIERCE_LENGTH) return;
            const px = p.x + ax * t;
            const py = p.y + ay * t;
            if (Math.hypot(m.x - px, m.y - py) <= PIERCE_WIDTH / 2 + def.radius) hits.push(id);
          });
          hits.forEach((id) => {
            const m = this.state.monsters.get(id);
            if (m) this.damageMonster(id, m, this.outgoingDamage(p, atk.dmg, mult), sessionId);
          });
        }
        break;
      }

      case "frostnova": {
        this.broadcast("frostfx", { x: p.x, y: p.y, r: FROSTNOVA_RADIUS });
        const hits: string[] = [];
        this.state.monsters.forEach((m, id) => {
          const def = MONSTERS[m.kind as MonsterKind];
          if (Math.hypot(m.x - p.x, m.y - p.y) <= FROSTNOVA_RADIUS + def.radius) hits.push(id);
        });
        hits.forEach((id) => {
          const m = this.state.monsters.get(id);
          if (!m) return;
          m.slowUntil = now + FROSTNOVA_SLOW_MS + (rank - 1) * 300;
          this.damageMonster(id, m, this.outgoingDamage(p, atk.dmg, mult), sessionId);
        });
        break;
      }

      case "teleport": {
        const fromX = p.x;
        const fromY = p.y;
        const dist = Math.min(len, TELEPORT_RANGE);
        let placed = false;
        for (const frac of [1, 0.75, 0.5, 0.25]) {
          const nx = p.x + dirX * dist * frac;
          const ny = p.y + dirY * dist * frac;
          if (canStand(this.map, nx, ny)) {
            this.broadcast("teleportfx", { id: sessionId, fromX, fromY, toX: nx, toY: ny });
            p.x = p.targetX = nx;
            p.y = p.targetY = ny;
            placed = true;
            // Riftwalk: tear a burning arcane rift at BOTH ends
            if (p.powers.has("teleport_rift")) {
              for (const [rx, ry] of [[fromX, fromY], [nx, ny]] as Array<[number, number]>) {
                this.hazards.push({ ax: rx, ay: ry, bx: rx, by: ry, width: RIFT_RADIUS, until: now + RIFT_DURATION_MS, nextTick: now, owner: sessionId, mult });
                this.broadcast("riftbloom", { x: rx, y: ry, r: RIFT_RADIUS, ms: RIFT_DURATION_MS });
              }
            }
            break;
          }
        }
        succeeded = placed;
        break;
      }

      default:
        succeeded = false;
    }

    if (succeeded) {
      p.mana -= skill.mana ?? 0;
      // Echo: sometimes the spell just... stays warm
      if (!(p.effects.has("echo") && Math.random() < ECHO_CHANCE)) {
        p.skillReady[skill.id] = now + (skill.cooldownMs ?? 0) * this.cdrMult(p);
      }
    }
  }

  private damageMonster(id: string, m: Monster, amount: number, attackerId: string, allowProcs = true) {
    const attacker = this.state.players.get(attackerId);
    const now = Date.now();

    // Warded packs refuse the blow entirely while the bubble holds. No hp change, no procs,
    // no leech — the persistent bubble on the client is the "why". Burst them in the gaps.
    if (now < m.wardUntil) return;

    let resisted = false;
    if (attacker) {
      // Executioner: bonus damage to wounded targets
      if (attacker.effects.has("executioner") && m.hp < m.maxHp * 0.5) {
        amount = Math.round(amount * 1.3);
      }
      // Giantslayer: the bigger they are
      if (attacker.effects.has("giantslayer") && (m.elite || m.modifier || isBossKind(m.kind))) {
        amount = Math.round(amount * GIANTSLAYER_MULT);
      }
      // monster elemental resistance eats the elemental slice of the blow; penetration claws
      // it back. Negative resist (a weakness) amplifies. Physical damage is never resisted.
      if (attacker.lastElem && attacker.lastElemFrac > 0) {
        const raw = monsterResistOf(m.kind, attacker.lastElem);
        if (raw !== 0) {
          const net = Math.max(-100, Math.min(100, raw - (attacker.derived.penetration ?? 0)));
          if (net !== 0) {
            const before = amount;
            amount = Math.max(1, Math.round(amount * (1 - attacker.lastElemFrac * (net / 100))));
            if (net > 0 && amount < before) resisted = true;
          }
        }
      }
    }
    // decrepified flesh remembers its age
    if (now < m.vulnUntil) amount = Math.round(amount * DECREPIFY_VULN);

    m.hp -= amount;
    this.broadcast("hit", { t: "m", id, amount, x: m.x, y: m.y, crit: attacker?.lastCrit ?? false, by: attackerId, kill: m.hp <= 0, resisted });

    // Spiked packs throw part of the blow back — big hits punish you, chip damage is safe.
    // gated on allowProcs so reflected/DoT/splash damage can't cascade into a loop.
    if (attacker && allowProcs && m.modifier) {
      const mod = CHAMPION_MODS.find((c) => c.id === m.modifier);
      if (mod?.reflect) {
        this.damagePlayer(attackerId, attacker, Math.max(1, Math.round(amount * mod.reflect)), `${m.name || this.monsterLabel(m)}'s spikes`);
      }
    }

    if (attacker && allowProcs) {
      const d = attacker.derived;
      // cold chills, leeches leech
      if (d.coldDmg) m.slowUntil = now + 1500;
      if (d.lifeSteal) attacker.hp = Math.min(attacker.maxHp, attacker.hp + (amount * d.lifeSteal) / 100);
      if (d.manaSteal) attacker.mana = Math.min(attacker.maxMana, attacker.mana + (amount * d.manaSteal) / 100);

      // Frostbite: chance to nova on hit
      if (attacker.effects.has("frostnova_on_hit") && Math.random() < FROSTBITE_CHANCE) {
        this.broadcast("frostfx", { x: m.x, y: m.y, r: 60 });
        const splash = Math.max(1, Math.round(amount * 0.4));
        const nearby: string[] = [];
        this.state.monsters.forEach((o, oid) => {
          if (Math.hypot(o.x - m.x, o.y - m.y) <= 60) nearby.push(oid);
        });
        nearby.forEach((oid) => {
          const o = this.state.monsters.get(oid);
          if (!o) return;
          o.slowUntil = now + FROSTNOVA_SLOW_MS;
          if (oid !== id) this.damageMonster(oid, o, splash, attackerId, false);
        });
      }

      // Bloodletter: the wound keeps working
      if (m.hp > 0 && attacker.effects.has("bleed")) {
        m.bleedDmg = Math.max(1, Math.round((amount * BLEED_FRACTION) / BLEED_TICKS));
        m.bleedTicksLeft = BLEED_TICKS;
        m.bleedNextAt = now + BLEED_TICK_MS;
        m.bleedBy = attackerId;
      }

      // Twin Strike: the echo of the blow
      if (m.hp > 0 && attacker.effects.has("twin_strike") && Math.random() < TWIN_STRIKE_CHANCE) {
        this.damageMonster(id, m, Math.max(1, Math.round(amount * TWIN_STRIKE_MULT)), attackerId, false);
      }

      // Storm Herald: crits call the sky down on someone else
      if (attacker.lastCrit && attacker.effects.has("lightning_storm")) {
        let otherId = "";
        let other: Monster | null = null;
        let bd = 160;
        this.state.monsters.forEach((o, oid) => {
          if (oid === id) return;
          const d = Math.hypot(o.x - m.x, o.y - m.y);
          if (d < bd) {
            bd = d;
            otherId = oid;
            other = o;
          }
        });
        if (other) {
          const o: Monster = other;
          this.broadcast("chainfx", { points: [{ x: m.x, y: m.y }, { x: o.x, y: o.y }] });
          this.damageMonster(otherId, o, Math.max(1, Math.round(amount * STORM_HERALD_MULT)), attackerId, false);
        }
      }

      // Culling Blade: the weak are simply finished
      const mAfter = this.state.monsters.get(id);
      if (
        mAfter &&
        mAfter.hp > 0 &&
        mAfter.hp < mAfter.maxHp * CULLING_THRESHOLD &&
        attacker.effects.has("culling") &&
        !isBossKind(mAfter.kind) &&
        !mAfter.elite &&
        mAfter.name !== "The Hollow Pilgrim"
      ) {
        this.broadcast("culledfx", { x: mAfter.x, y: mAfter.y });
        this.damageMonster(id, mAfter, mAfter.hp, attackerId, false);
      }

      // Gale Force: knockback on hit
      if (m.hp > 0 && attacker.effects.has("knockback_shot") && Math.random() < KNOCKBACK_CHANCE) {
        const kx = m.x - attacker.x;
        const ky = m.y - attacker.y;
        const kd = Math.hypot(kx, ky) || 1;
        const nx = m.x + (kx / kd) * 34;
        const ny = m.y + (ky / kd) * 34;
        if (canStand(this.map, nx, ny)) {
          m.x = nx;
          m.y = ny;
        }
      }
    }

    if (m.hp <= 0) {
      const def = MONSTERS[m.kind as MonsterKind];
      this.broadcast("death", { t: "m", id, kind: m.kind, x: m.x, y: m.y });
      this.state.monsters.delete(id);

      // Plaguecarrier: a withered host's death seeds the curse into everything around the corpse
      if (now < m.curseSpreadsUntil) {
        const spreadTo: Monster[] = [];
        this.state.monsters.forEach((o, oid) => {
          if (oid !== id && Math.hypot(o.x - m.x, o.y - m.y) <= WITHER_SPREAD_RADIUS) spreadTo.push(o);
        });
        if (spreadTo.length) {
          spreadTo.forEach((o) => {
            o.vulnUntil = Math.max(o.vulnUntil, now + DECREPIFY_MS);
            o.slowUntil = Math.max(o.slowUntil, now + DECREPIFY_MS);
            o.curseSpreadsUntil = Math.max(o.curseSpreadsUntil, now + DECREPIFY_MS); // the plague keeps leaping
          });
          this.broadcast("classfx", { kind: "curse", x: m.x, y: m.y, r: WITHER_SPREAD_RADIUS });
        }
      }

      // Fire Enchanted champions go out with a bang — respect the corpse
      if (m.explodeOnDeath) {
        this.broadcast("novafire", { x: m.x, y: m.y, r: FE_EXPLODE_RADIUS });
        this.state.players.forEach((p, sid) => {
          if (p.hp <= 0) return;
          if (Math.hypot(p.x - m.x, p.y - m.y) <= FE_EXPLODE_RADIUS) {
            this.damagePlayer(sid, p, Math.round(this.monsterDamage(m) * FE_EXPLODE_MULT), `${m.name}'s death blast`, "fire");
          }
        });
      }

      this.bountyOnKill(m);

      // quests advance on kills — the whole party gets the credit
      if (this.state.floor === 1 && !isBossKind(m.kind) && m.kind !== "goblin") {
        if (this.state.act === 1) this.questCredit("clear_forest");
        if (this.state.act === 2) this.questCredit("vultures");
        if (this.state.act === 3) this.questCredit("green_hell");
        if (this.state.act === 4) this.questCredit("the_breach");
      }
      if (m.kind === "flenser") this.questCredit("the_flenser");
      if (m.kind === "vessira") this.questCredit("thorned_maiden");
      if (m.kind === "vuruk") this.questCredit("white_maw");
      if (m.kind === "nyzat") this.questCredit("embalmed_queen");
      if (m.kind === "ssarim") this.questCredit("drowned_god");
      if (m.kind === "aldric") this.questCredit("oathbreaker");
      if (m.kind === "orvath") this.questCredit("spites_end");
      if (m.kind === "malgrim") this.questCredit("dread_itself");
      if (m.kind === "uldrath") this.questCredit("the_unmaking");
      if (m.kind === "bovax") this.questCredit("moo");
      if (m.name === "The Hollow Pilgrim") this.questCredit("hollow_pilgrim");

      // fallen nearby watched this happen — and want no part of it
      this.state.monsters.forEach((o) => {
        if (MONSTER_AI[o.kind] === "coward" && Math.hypot(o.x - m.x, o.y - m.y) <= IMP_FLEE_RADIUS) {
          o.fleeUntil = now + IMP_FLEE_MS;
        }
      });

      if (m.camp >= 0) {
        this.campAlive[m.camp]--;
        if (this.campAlive[m.camp] <= 0) {
          this.campRespawnAt[m.camp] = Date.now() + CAMP_RESPAWN_MS;
        }
      }

      this.awardXp(m.x, m.y, Math.round(def.xp * floorXpMult(this.danger()) * m.xpMult));

      const killer = this.state.players.get(attackerId);
      const mf = this.magicFindOf(killer);
      const ilvl = this.danger();

      // on-kill unique effects
      if (killer && allowProcs) {
        if (killer.effects.has("arcane_surge")) {
          killer.mana = Math.min(killer.maxMana, killer.mana + 10);
        }
        if (killer.effects.has("chain_on_kill")) {
          const targets: Array<{ id: string; m: Monster }> = [];
          this.state.monsters.forEach((o, oid) => {
            if (targets.length < 2 && Math.hypot(o.x - m.x, o.y - m.y) <= 120) targets.push({ id: oid, m: o });
          });
          if (targets.length) {
            this.broadcast("chainfx", { points: [{ x: m.x, y: m.y }, ...targets.map((t) => ({ x: t.m.x, y: t.m.y }))] });
            const zap = Math.max(1, Math.round(amount * 0.5));
            targets.forEach((t) => {
              const o = this.state.monsters.get(t.id);
              if (o) this.damageMonster(t.id, o, zap, attackerId, false);
            });
          }
        }
        if (killer.effects.has("corpse_explosion")) {
          this.broadcast("impact", { kind: "fireball", x: m.x, y: m.y });
          const boom = Math.max(1, Math.round(amount * 0.6));
          const nearby: Array<{ id: string; m: Monster }> = [];
          this.state.monsters.forEach((o, oid) => {
            if (Math.hypot(o.x - m.x, o.y - m.y) <= 60) nearby.push({ id: oid, m: o });
          });
          nearby.forEach((t) => {
            const o = this.state.monsters.get(t.id);
            if (o) this.damageMonster(t.id, o, boom, attackerId, false);
          });
        }
        if (killer.effects.has("gold_burst") && Math.random() < 0.25) {
          this.spawnGold(m.x, m.y, this.goldAmount(killer, goldRoll(this.danger()) * 3));
        }
        // Blood Rush: the kill quickens your step
        if (killer.effects.has("vampiric_rush")) {
          killer.buffSpeedUntil = Math.max(killer.buffSpeedUntil, now + RUSH_MS);
        }
        // Dread Presence: the survivors saw what you did
        if (killer.effects.has("terror")) {
          this.state.monsters.forEach((o) => {
            if (Math.hypot(o.x - m.x, o.y - m.y) <= TERROR_RADIUS) {
              o.slowUntil = Math.max(o.slowUntil, now + TERROR_MS);
            }
          });
        }
      }

      if (m.kind === "goblin") {
        // the payoff for catching it — a small explosion of treasure
        for (let i = 0; i < GOBLIN_DROPS; i++) {
          this.spawnGroundItem(generateItem(ilvl, mf, Math.random, BOSS_RARITY_WEIGHTS, undefined, this.mythicMult()), m.x, m.y);
        }
        this.spawnGroundItem(generateCharm(ilvl, mf), m.x, m.y);
        this.spawnGroundItem(generateRune(ilvl), m.x, m.y); // goblins hoard runes too
        if (Math.random() < PEG_LEG_GOBLIN_CHANCE) {
          this.spawnGroundItem(this.pegLeg(ilvl), m.x, m.y, true); // …and stranger things
        }
        for (let i = 0; i < GOBLIN_POTION_DROPS; i++) this.spawnPotion(m.x, m.y);
        for (let i = 0; i < GOBLIN_GOLD_PILES; i++) {
          this.spawnGold(m.x, m.y, goldRoll(this.danger()) * GOBLIN_GOLD_MULT);
        }
      } else if (isBossKind(m.kind)) {
        const bk = m.kind as BossKind | "bovax";
        // the Rift Warden's fall CLEARS the rift — no respawn, straight to the reward
        if (this.isRift && this.riftBossSpawned && !this.state.bountyDone) {
          this.broadcast("announce", { text: `${killer?.name || killer?.cls || "someone"} cleared Rift Tier ${this.riftTier}!` });
          this.completeRift(m.x, m.y);
        } else {
          this.bossRespawnAt = Date.now() + BOSS_RESPAWN_MS;
          // the whole party should know who landed the killing blow
          this.broadcast("announce", { text: `${killer?.name || killer?.cls || "someone"} slew ${BOSS_NAMES[bk]}!` });
        }
        // an act boss falls on its last floor: the road onward opens for everyone standing here
        if (!this.isCowLevel && this.state.act <= ACTS.length && this.state.floor >= ACT_FLOORS &&
            m.kind === ACTS[this.state.act - 1].actBoss) {
          let anyNew = false;
          this.state.players.forEach((pl) => {
            if (pl.actsUnlocked < this.state.act + 1) {
              pl.actsUnlocked = this.state.act + 1;
              anyNew = true;
            }
            this.persist(pl);
          });
          if (anyNew) {
            const nextName = this.state.act >= ACTS.length ? "the Endless Abyss" : ACTS[this.state.act].name;
            this.broadcast("announce", { text: `⚑ The road to ${nextName} lies open` });
          }
        }
        // the Unmaker, unmade in his own hall — the game is won, and the world sharpens
        if (m.kind === "uldrath" && this.state.act === VICTORY_ACT && this.state.floor >= ACT_FLOORS) {
          const nextDiff = Math.min(DIFFICULTIES.length, this.state.difficulty + 1);
          let sharpened = false;
          this.state.players.forEach((pl) => {
            if (pl.diffUnlocked < nextDiff) {
              pl.diffUnlocked = nextDiff;
              sharpened = true;
            }
            this.persist(pl);
          });
          if (sharpened && nextDiff > this.state.difficulty) {
            this.broadcast("announce", { text: `⚔ ${DIFFICULTIES[nextDiff - 1]} has been earned — forge a new game to face it` });
          }
        }
        if (m.kind === "uldrath" && this.state.act === VICTORY_ACT && this.state.floor >= ACT_FLOORS && !this.victoryAnnounced) {
          this.victoryAnnounced = true;
          this.broadcast("victory", { act: this.state.act, floor: this.state.floor, difficulty: this.state.difficulty });
          for (let i = 0; i < 6; i++) {
            this.spawnGold(m.x, m.y, goldRoll(this.danger()) * 20);
          }
        }
        let drops = BOSS_GUARANTEED_DROPS;
        if (Math.random() < BOSS_EXTRA_DROP_CHANCE) drops++;
        for (let i = 0; i < drops; i++) {
          // each boss favors its signature item — farm THE boss for THE drop
          if (i === 0 && Math.random() < SIGNATURE_DROP_CHANCE) {
            const sig = generateFixedItem(BOSS_SIGNATURES[m.kind as BossKind], ilvl);
            if (sig) {
              this.spawnGroundItem(sig, m.x, m.y);
              continue;
            }
          }
          this.spawnGroundItem(generateItem(ilvl, mf, Math.random, BOSS_RARITY_WEIGHTS, undefined, this.mythicMult()), m.x, m.y);
        }
        for (let i = 0; i < BOSS_POTION_DROPS; i++) this.spawnPotion(m.x, m.y);
        for (let i = 0; i < BOSS_MANA_POTION_DROPS; i++) this.spawnManaPotion(m.x, m.y);
        for (let i = 0; i < BOSS_GOLD_PILES; i++) {
          this.spawnGold(m.x, m.y, goldRoll(this.danger()) * BOSS_GOLD_MULT);
        }
      } else if (m.name === "The Hollow Pilgrim") {
        // the dark presence falls — and sometimes leaves the charm behind
        for (let i = 0; i < 2; i++) {
          this.spawnGroundItem(generateItem(ilvl, mf, Math.random, BOSS_RARITY_WEIGHTS, undefined, this.mythicMult()), m.x, m.y);
        }
        if (Math.random() < BURDEN_CHANCE) {
          this.spawnGroundItem(this.pilgrimsBurden(ilvl), m.x, m.y);
        }
        for (let i = 0; i < 3; i++) {
          this.spawnGold(m.x, m.y, this.goldAmount(killer, goldRoll(this.danger()) * 6));
        }
        this.broadcast("wandererdead", { x: m.x, y: m.y });
      } else {
        if (m.elite) {
          // named elites always pay out from the boosted table
          this.spawnGroundItem(generateItem(ilvl, mf, Math.random, BOSS_RARITY_WEIGHTS, undefined, this.mythicMult()), m.x, m.y);
        }
        if (m.modifier && Math.random() < CHAMPION_EXTRA_DROP) {
          this.spawnGroundItem(generateItem(ilvl, mf, Math.random, undefined, undefined, this.mythicMult()), m.x, m.y);
        }
        if (Math.random() < DROP_CHANCE) this.spawnGroundItem(generateItem(ilvl, mf, Math.random, undefined, undefined, this.mythicMult()), m.x, m.y);
        if (Math.random() < CHARM_DROP_CHANCE) this.spawnGroundItem(generateCharm(ilvl, mf), m.x, m.y);
        if (Math.random() < RUNE_DROP_CHANCE) this.spawnGroundItem(generateRune(ilvl), m.x, m.y);
        if (Math.random() < JEWEL_DROP_CHANCE) this.spawnGroundItem(generateJewel(ilvl, mf), m.x, m.y);
        if (Math.random() < POTION_DROP_CHANCE) this.spawnPotion(m.x, m.y);
        if (Math.random() < MANA_POTION_DROP_CHANCE) this.spawnManaPotion(m.x, m.y);
        if (Math.random() < GOLD_DROP_CHANCE) {
          const goldMult = m.elite ? ELITE_GOLD_MULT : m.modifier ? CHAMPION_GOLD_MULT : 1;
          this.spawnGold(m.x, m.y, this.goldAmount(killer, goldRoll(this.danger()) * goldMult));
        }
      }
    }
  }

  // --- bounties ---

  private bountyOnKill(m: Monster) {
    if (this.state.bountyDone) return;
    if (this.bountyKind === "kills") {
      this.state.bountyProgress++;
    } else if (this.bountyKind === "boss" && isBossKind(m.kind)) {
      this.state.bountyProgress = this.state.bountyGoal;
    } else {
      return;
    }
    if (this.state.bountyProgress >= this.state.bountyGoal) {
      if (this.isRift) {
        // the horde is culled — now the Rift Boss (completion comes when IT falls)
        if (!this.riftBossSpawned) this.spawnRiftBoss();
      } else {
        this.completeBounty(m.x, m.y);
      }
    }
  }

  // the Rift Boss: a boss chosen by tier, summoned once the horde is thinned
  private spawnRiftBoss() {
    this.riftBossSpawned = true;
    this.state.bountyText = `Rift Tier ${this.riftTier} — slay the Rift Warden`;
    const kind = BOSS_KIND_LIST[this.riftTier % BOSS_KIND_LIST.length];
    const m = new Monster();
    const def = MONSTERS[kind];
    m.kind = kind;
    m.name = `${BOSS_NAMES[kind]}, Rift Warden`;
    m.hp = m.maxHp = Math.round(def.maxHp * floorHpMult(this.danger()) * 1.3); // a touch beefier
    // drop it on a living player so it can't spawn walled-off
    let px = this.layout.boss.x;
    let py = this.layout.boss.y;
    this.state.players.forEach((p) => {
      if (p.hp > 0) { px = p.x; py = p.y; }
    });
    const pos = this.scatter(px, py, 120);
    m.x = pos.x;
    m.y = pos.y;
    this.state.monsters.set(`riftboss_${this.nextId++}`, m);
    this.broadcast("bossaggro", { kind, name: m.name, line: "The Rift will not let you leave." });
    this.broadcast("announce", { text: `The Rift Warden stirs — Tier ${this.riftTier}!` });
  }

  // the Rift is cleared: tiered loot, a bumped high-water mark, and a way home
  private completeRift(x: number, y: number) {
    this.state.bountyDone = true;
    this.state.bountyText = `Rift Tier ${this.riftTier} CLEARED`;
    const ilvl = this.danger();
    const drops = 3 + Math.floor(this.riftTier / 2);
    for (let i = 0; i < drops; i++) {
      this.spawnGroundItem(generateItem(ilvl, 80, Math.random, BOSS_RARITY_WEIGHTS, undefined, this.mythicMult()), x, y);
    }
    for (let i = 0; i < 3; i++) this.spawnGold(x, y, goldRoll(ilvl) * BOSS_GOLD_MULT);
    this.state.players.forEach((p, sid) => {
      if (p.hp > 0) this.grantXp(p, sid, BOUNTY_XP_PER_FLOOR * ilvl * 2);
      if (p.riftBest < this.riftTier) p.riftBest = this.riftTier; // a new endgame high-water mark
      this.persist(p);
    });
    // the portal home — a rift never has a caravan, so this is the only way out
    const exit = new Shrine();
    exit.x = x;
    exit.y = y + 34;
    exit.kind = "riftexit";
    exit.label = "Return to town";
    this.state.shrines.set(`riftexit_${this.nextId++}`, exit);
    this.broadcast("riftdone", { tier: this.riftTier, x, y });
  }

  private bountyOnChest(s: Shrine) {
    if (this.state.bountyDone || this.bountyKind !== "chest") return;
    this.state.bountyProgress = this.state.bountyGoal;
    this.completeBounty(s.x, s.y);
  }

  private completeBounty(x: number, y: number) {
    this.state.bountyDone = true;
    const floor = this.danger(); // bounty pay scales with true depth
    // everyone eats: xp + gold for the party, one boosted item where it happened
    this.state.players.forEach((p, sid) => {
      if (p.hp > 0) this.grantXp(p, sid, BOUNTY_XP_PER_FLOOR * floor);
    });
    this.spawnGold(x, y, BOUNTY_GOLD_PER_FLOOR * floor);
    this.spawnGroundItem(generateItem(floor, 50, Math.random, BOSS_RARITY_WEIGHTS, undefined, this.mythicMult()), x, y);
    this.broadcast("bountydone", { text: this.state.bountyText, x, y });
  }

  private grantXp(p: Player, sid: string, amount: number) {
    if (p.level >= MAX_LEVEL) {
      // past the ceiling, XP no longer vanishes — it banks into the endless paragon track
      this.grantParagonXp(p, sid, amount);
      return;
    }
    p.xp += amount;
    let leveled = false;
    while (p.xp >= xpForNext(p.level)) {
      p.xp -= xpForNext(p.level);
      p.level++;
      p.statPoints += STAT_POINTS_PER_LEVEL;
      p.skillPoints += SKILL_POINTS_PER_LEVEL;
      leveled = true;
      this.recompute(p);
      p.hp = p.maxHp;
      this.broadcast("levelup", { id: sid, level: p.level });
      if (p.level >= 10) this.questAdvance(p, sid, "seasoned"); // reward xp is 0 — no recursion spiral
      this.recomputeMerc(sid, p); // the Rogue grows with her employer
    }
    if (leveled) {
      const client = this.clients.find((c) => c.sessionId === sid);
      if (client) this.sendLoadout(client, p);
    }
  }

  private awardXp(x: number, y: number, amount: number) {
    this.state.players.forEach((p, sid) => {
      if (p.hp <= 0) return;
      if (Math.hypot(p.x - x, p.y - y) > XP_SHARE_RANGE) return;
      this.grantXp(p, sid, Math.round(amount * (1 + (p.derived.xpBonus ?? 0) / 100)));
    });
  }

  // paragon: overflow XP past 99 → an endless track; each level is a point to spend
  private grantParagonXp(p: Player, sid: string, amount: number) {
    p.paragonXp += amount;
    let gained = false;
    while (p.paragonXp >= paragonXpForNext(p.paragonLevel)) {
      p.paragonXp -= paragonXpForNext(p.paragonLevel);
      p.paragonLevel++;
      p.paragonPoints++;
      gained = true;
      this.broadcast("paragonup", { id: sid, level: p.paragonLevel });
    }
    if (gained) {
      const client = this.clients.find((c) => c.sessionId === sid);
      if (client) this.sendLoadout(client, p);
    }
  }

  private handleAllocParagon(client: Client, msg: { id: string }) {
    const p = this.state.players.get(client.sessionId);
    if (!p || p.paragonPoints <= 0) return;
    const perk = paragonPerkById(msg?.id);
    if (!perk) return;
    p.paragonPoints--;
    p.paragonAlloc[perk.id] = (p.paragonAlloc[perk.id] ?? 0) + 1;
    this.recompute(p);
    this.persist(p);
    this.sendLoadout(client, p);
  }

  // --- the merchants' stock ---

  private rollVendorItem(): { item: Item; price: number } {
    const item = generateItem(this.danger(), 0, Math.random, VENDOR_WEIGHTS);
    return { item, price: vendorPrice(item) };
  }

  private rollVendorStock() {
    this.vendorStock = Array.from({ length: VENDOR_STOCK_SIZE }, () => this.rollVendorItem());
  }

  private rollGambleSlot(): { id: string; base: string; name: string; price: number } {
    const eligible = Object.keys(BASE_ITEMS).filter((k) => BASE_ITEMS[k].minIlvl <= this.danger() + 4);
    const base = eligible[Math.floor(Math.random() * eligible.length)];
    return {
      id: `gmb_${this.nextId++}`,
      base,
      name: `Unidentified ${BASE_ITEMS[base].name}`,
      price: gamblePrice(base, this.danger()),
    };
  }

  private rollGambleStock() {
    this.gambleStock = Array.from({ length: GAMBLE_STOCK_SIZE }, () => this.rollGambleSlot());
  }

  private sendVendor(client: Client) {
    client.send("openvendor", { items: this.vendorStock });
  }

  private sendGamble(client: Client) {
    client.send("opengamble", { items: this.gambleStock });
  }

  private handleShrine(client: Client, msg: { id: string }) {
    const p = this.state.players.get(client.sessionId);
    const s = msg?.id ? this.state.shrines.get(msg.id) : undefined;
    if (!p || !s || s.used || p.hp <= 0) return;
    if (Math.hypot(s.x - p.x, s.y - p.y) > SHRINE_TOUCH_RANGE) return;

    // Fenwick: click the man, browse the spread
    if (s.kind === "gamble") {
      this.sendGamble(client);
      return;
    }

    // town furniture
    if (s.kind === "stash") {
      client.send("openstash", {});
      return;
    }
    if (s.kind === "vendor") {
      this.sendVendor(client); // the panel itself explains selling
      return;
    }
    if (s.kind === "waypoint") {
      // touching a stone claims it — and unrolls the map of everywhere you've been
      if (!this.isCowLevel) this.discoverWaypoint(p, this.state.act, this.state.floor);
      this.sendWaypoints(client, p, true);
      return;
    }
    if (s.kind === "caravan") {
      const here = this.state.act;
      const target = here >= ABYSS_ACT ? { act: ACTS.length, floor: 1 } : { act: here + 1, floor: 1 };
      if (target.act <= here || p.actsUnlocked >= target.act) {
        this.pendingTravel = target;
        this.broadcast("waypointfx", { x: s.x, y: s.y, by: client.sessionId });
      } else {
        const guard = BOSS_NAMES[ACTS[here - 1].actBoss];
        client.send("stairslocked", { text: `the caravan will not roll while ${guard} reigns` });
      }
      return;
    }
    if (s.kind === "transmute") {
      this.sendAltar(client); // opens the panel: recipes as buttons + the reforge list
      return;
    }
    if (s.kind === "cowportal") {
      s.used = true;
      this.pendingCow = true;
      return;
    }
    if (s.kind === "riftportal") {
      // push the next tier above your best clear — the whole party commits together
      let best = 0;
      this.state.players.forEach((pl) => (best = Math.max(best, pl.riftBest)));
      this.preRiftAct = this.state.act;
      this.pendingRift = best + 1;
      this.broadcast("waypointfx", { x: s.x, y: s.y, by: client.sessionId });
      return;
    }
    if (s.kind === "riftexit") {
      s.used = true;
      this.pendingTravel = { act: Math.min(this.preRiftAct, ACTS.length), floor: 1 }; // home to town
      this.broadcast("waypointfx", { x: s.x, y: s.y, by: client.sessionId });
      return;
    }
    // forest doorways: step through into the tower, the caves, and back
    if (s.kind === "areaportal") {
      const target = this.areaPortals.get(msg.id);
      if (!target) return;
      p.x = p.targetX = target.x;
      p.y = p.targetY = target.y;
      this.broadcast("portalfx", { id: client.sessionId, x: target.x, y: target.y });
      if (s.variant === "stairsup" && this.state.act === 1) this.questAdvance(p, client.sessionId, "watchtower");
      if (s.variant === "cavemouth") {
        if (this.state.act === 1) this.questAdvance(p, client.sessionId, "spelunker");
        if (this.state.act === 2) this.questAdvance(p, client.sessionId, "sunken_door");
        if (this.state.act === 3) this.questAdvance(p, client.sessionId, "flooded_steps");
      }
      return;
    }
    if (s.kind === "alchemist") {
      client.send("openshop", { health: POTION_PRICES.health, mana: POTION_PRICES.mana });
      return;
    }
    if (s.kind === "mercnpc") {
      this.sendMercOffers(client, p, s.variant || "rogue");
      return;
    }

    // chests: treasure, trap, or jackpot
    if (s.kind === "chest") {
      s.used = true;
      const roll = Math.random();
      const mf = this.magicFindOf(p);
      const ilvl = this.danger();
      if (roll < CHEST_TREASURE_CHANCE) {
        const count = 1 + (Math.random() < 0.5 ? 1 : 0);
        for (let i = 0; i < count; i++) this.spawnGroundItem(generateItem(ilvl, mf, Math.random, undefined, undefined, this.mythicMult()), s.x, s.y);
        this.spawnGold(s.x, s.y, goldRoll(ilvl) * 2);
        this.broadcast("chestfx", { x: s.x, y: s.y, outcome: "treasure" });
      } else if (roll < CHEST_TREASURE_CHANCE + CHEST_CURSED_CHANCE) {
        // it's a trap — ambush spawns around the chest
        const count = CHEST_AMBUSH[0] + Math.floor(Math.random() * (CHEST_AMBUSH[1] - CHEST_AMBUSH[0] + 1));
        for (let i = 0; i < count; i++) {
          const m = new Monster();
          const kind = this.isCowLevel ? "bovine" : pickMonsterKindFor(this.state.act, this.state.floor);
          const def = MONSTERS[kind];
          m.kind = kind;
          m.camp = -2;
          m.hp = m.maxHp = Math.round(def.maxHp * floorHpMult(ilvl));
          const pos = this.scatter(s.x, s.y);
          m.x = pos.x;
          m.y = pos.y;
          m.aggroed = true;
          m.aggroAt = Date.now();
          this.state.monsters.set(`ambush_${this.nextId++}`, m);
        }
        this.spawnGold(s.x, s.y, goldRoll(ilvl)); // consolation
        this.broadcast("chestfx", { x: s.x, y: s.y, outcome: "cursed" });
      } else {
        for (let i = 0; i < 2; i++) {
          this.spawnGroundItem(generateItem(ilvl, mf, Math.random, BOSS_RARITY_WEIGHTS, undefined, this.mythicMult()), s.x, s.y);
        }
        for (let i = 0; i < 3; i++) this.spawnGold(s.x, s.y, goldRoll(ilvl) * 4);
        if (Math.random() < PEG_LEG_JACKPOT_CHANCE) {
          this.spawnGroundItem(this.pegLeg(ilvl), s.x, s.y, true);
        }
        this.broadcast("chestfx", { x: s.x, y: s.y, outcome: "jackpot" });
      }
      this.bountyOnChest(s);
      return;
    }

    // lore tomes: a line of the world, and a scrap of insight
    if (s.kind === "tome") {
      s.used = true;
      const pool = LORE_LINES[loreBandFor(this.state.act)];
      const line = pool[Math.floor(Math.random() * pool.length)];
      this.grantXp(p, client.sessionId, TOME_XP_BASE * this.danger());
      this.broadcast("lore", { line, by: client.sessionId });
      return;
    }

    // storytellers are talked-to on the CLIENT (no server round-trip); this only
    // guards the case where a stale touch reaches us — nothing to do.
    if (s.kind === "storyteller") return;

    // dungeon narrative encounters: a vignette, an ambush, or a bargain
    if (s.kind === "encounter") {
      const enc = encounterById(s.variant);
      if (!enc) return;
      s.used = true;
      if (enc.kind === "vignette") {
        this.grantXp(p, client.sessionId, ENCOUNTER_XP_BASE * this.danger());
      } else if (enc.kind === "ambush") {
        this.spawnAmbush(s.x, s.y, enc.ambushKind, enc.ambushCount ?? 4);
      } else if (enc.kind === "boon" && enc.boon) {
        const now2 = Date.now();
        const ms = enc.boon.ms ?? 30000;
        switch (enc.boon.effect) {
          case "dmg": p.buffDmgUntil = Math.max(p.buffDmgUntil, now2 + ms); break;
          case "speed": p.buffSpeedUntil = Math.max(p.buffSpeedUntil, now2 + ms); break;
          case "mf": p.buffMfUntil = Math.max(p.buffMfUntil, now2 + ms); break;
          case "heal": p.hp = p.maxHp; break;
          case "vuln": p.curseVulnUntil = Math.max(p.curseVulnUntil, now2 + ms); break;
          case "slow": p.chilledUntil = Math.max(p.chilledUntil, now2 + ms); break;
        }
      }
      // the toucher reads the scene; everyone hears there was a story here
      this.broadcast("encounter", { id: enc.id, kind: enc.kind, by: client.sessionId });
      return;
    }

    const now = Date.now();
    switch (s.kind) {
      case "healing":
        p.hp = p.maxHp;
        break;
      case "mana":
        p.mana = p.maxMana;
        break;
      case "blessed":
        p.buffDmgUntil = now + SHRINE_DMG_MS;
        break;
      case "fortune":
        p.buffMfUntil = now + SHRINE_MF_MS;
        break;
      case "swift":
        p.buffSpeedUntil = now + SHRINE_SPEED_MS;
        break;
      case "knowledge":
        this.grantXp(p, client.sessionId, SHRINE_XP_BASE * this.danger());
        break;
      default:
        return;
    }

    s.used = true;
    const def = SHRINE_KINDS.find((k) => k.id === s.kind);
    this.broadcast("shrinefx", { id: msg.id, kind: s.kind, by: client.sessionId, x: s.x, y: s.y, msg: def?.msg ?? "" });
  }

  private damagePlayer(sessionId: string, p: Player, amount: number, by = "the dungeon", element?: Element) {
    if (p.hp <= 0) return;
    const nowPre = Date.now();
    if (nowPre < p.immuneUntil) return; // the Undying cannot be touched, briefly
    // Sanctuary (Prayer power): the party shield swallows one blow, then breaks
    if (nowPre < p.shieldUntil) {
      p.shieldUntil = 0;
      this.broadcast("aegisfx", { id: sessionId, x: p.x, y: p.y });
      return;
    }
    // Aegis: one hit, refused outright
    if (p.effects.has("aegis") && nowPre >= p.aegisReadyAt) {
      p.aegisReadyAt = nowPre + AEGIS_CD_MS;
      this.broadcast("aegisfx", { id: sessionId, x: p.x, y: p.y });
      return;
    }
    // Dexterity earns its keep: a clean miss
    const dodge = Math.min(DODGE_CAP, p.derived.dodge ?? 0);
    if (dodge > 0 && Math.random() < dodge / 100) {
      this.broadcast("dodge", { id: sessionId, x: p.x, y: p.y });
      return;
    }
    if (p.portalAt > 0) {
      // taking a hit interrupts the portal channel
      p.portalAt = 0;
      this.broadcast("portalcancel", { id: sessionId });
    }
    // armor stops steel; resistances stop the elements
    let reduced: number;
    if (element) {
      const res = this.resistFor(p, element);
      const elemPart = amount * MONSTER_ELEMENT_FRACTION * (1 - res / 100);
      const physPart = Math.max(0, amount * (1 - MONSTER_ELEMENT_FRACTION) - (p.derived.armor ?? 0));
      reduced = Math.max(1, Math.round(physPart + elemPart));
      if (element === "cold") {
        p.chilledUntil = Date.now() + PLAYER_CHILL_MS * (1 - res / 100);
      }
    } else {
      reduced = Math.max(1, amount - (p.derived.armor ?? 0));
    }
    // Mana Shield: the mind takes the blow the body was owed
    if (p.effects.has("mana_shield") && p.mana > 0) {
      const divert = Math.min(Math.round(reduced * MANA_SHIELD_FRACTION), Math.floor(p.mana));
      p.mana -= divert;
      reduced -= divert;
    }
    // a river's marking, or worse — the cursed take extra harm for a while
    if (Date.now() < p.curseVulnUntil) reduced = Math.max(1, Math.round(reduced * 1.25));
    p.hp = Math.max(0, p.hp - reduced);
    p.lastDamaged = Date.now();
    // Adrenaline: pain makes you fast
    if (p.hp > 0 && p.effects.has("adrenaline")) {
      p.buffSpeedUntil = Math.max(p.buffSpeedUntil, Date.now() + ADRENALINE_MS);
    }
    this.broadcast("hit", { t: "p", id: sessionId, amount: reduced, x: p.x, y: p.y });

    // Second Wind: emergency heal when struck low
    const now = Date.now();
    if (
      p.hp > 0 &&
      p.hp < p.maxHp * 0.25 &&
      p.effects.has("second_wind") &&
      now >= p.secondWindReadyAt
    ) {
      p.secondWindReadyAt = now + SECOND_WIND_CD_MS;
      const heal = Math.round(p.maxHp * 0.3);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      this.broadcast("heal", { id: sessionId, amount: heal, x: p.x, y: p.y });
      this.broadcast("secondwind", { id: sessionId, x: p.x, y: p.y });
    }

    if (p.hp <= 0) {
      // Undying: death, declined (once per 90 seconds)
      const nowD = Date.now();
      if (p.effects.has("deathless") && nowD >= p.deathlessReadyAt) {
        p.deathlessReadyAt = nowD + DEATHLESS_CD_MS;
        p.immuneUntil = nowD + DEATHLESS_IMMUNE_MS;
        p.hp = 1;
        this.broadcast("deathlessfx", { id: sessionId, x: p.x, y: p.y });
        return;
      }
      if (p.hardcore) {
        // one life. It just ended. The profile remembers; the roster mourns.
        p.fallen = true;
        p.diedTo = by;
        p.diedFloor = this.danger();
        p.diedAct = this.state.act;
        p.diedAt = Date.now();
        this.persist(p);
        this.broadcast("announce", { text: `☠ ${p.name || p.cls} the ${p.cls} has fallen forever in ${this.actLabel()} — slain by ${by}` });
        this.broadcast("grave", { x: p.x, y: p.y, name: p.name || p.cls, by });
        const client = this.clients.find((c) => c.sessionId === sessionId);
        client?.send("hardcoredeath", { name: p.name || p.cls, cls: p.cls, level: p.level, where: this.actLabel(), by });
        p.targetX = p.x;
        p.targetY = p.y;
        return; // no respawn timer — the dead stay where they fell until they leave
      }
      p.respawnAt = Date.now() + PLAYER_RESPAWN_MS;
      if (this.state.players.size > 1) {
        this.broadcast("announce", { text: `${p.name || p.cls} was slain by ${by}` });
      }
      this.broadcast("grave", { x: p.x, y: p.y, name: p.name || p.cls, by });
      p.targetX = p.x;
      p.targetY = p.y;
      // death has a price: part of your purse scatters where you fell (corpse run!)
      const scattered = Math.floor(p.gold * DEATH_GOLD_FRACTION);
      if (scattered > 0 && !isInTown(p.y)) {
        p.gold -= scattered;
        this.spawnGold(p.x, p.y, scattered);
        const client = this.clients.find((c) => c.sessionId === sessionId);
        client?.send("golddrop", { amount: scattered });
      }
      this.broadcast("death", { t: "p", id: sessionId, x: p.x, y: p.y, by });
    }
  }

  private monsterLabel(m: Monster): string {
    if (m.name) return m.name;
    if (m.kind === "archer") return "a skeleton archer";
    return /^[aeiou]/.test(m.kind) ? `an ${m.kind}` : `a ${m.kind}`;
  }

  // --- spawning ---

  private spawnCamp(campIndex: number) {
    const center = this.layout.camps[campIndex];
    const count = campPackSize(this.danger());
    const hpMult = floorHpMult(this.danger());

    // sometimes the whole camp is a champion pack sharing one modifier
    const champion =
      Math.random() < CHAMPION_CHANCE
        ? CHAMPION_MODS[Math.floor(Math.random() * CHAMPION_MODS.length)]
        : null;

    // bigger packs spread wider so they read as a horde, not a single stacked blob
    const spread = 26 + count * 2.4;
    for (let i = 0; i < count; i++) {
      const m = new Monster();
      const kind = this.isCowLevel ? "bovine" : pickMonsterKindFor(this.state.act, this.state.floor);
      const def = MONSTERS[kind];
      m.kind = kind;
      m.hp = m.maxHp = Math.round(def.maxHp * hpMult);
      m.camp = campIndex;
      const pos = this.scatter(center.x, center.y, spread);
      m.x = pos.x;
      m.y = pos.y;

      if (champion) {
        m.modifier = champion.id;
        m.name = `${champion.label} ${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
        m.hp = m.maxHp = Math.round(m.maxHp * champion.hpMult);
        m.dmgMult = champion.dmgMult;
        m.speedMult = champion.speedMult;
        m.cdMult = champion.cdMult;
        m.xpMult = CHAMPION_XP_MULT;
        m.element = champion.element ?? "";
        m.explodeOnDeath = !!champion.explode;
      } else if (
        // the pack leader may be a named elite — and a big horde can field a lieutenant too
        (i === 0 || (i === 4 && count >= 8)) &&
        Math.random() < eliteChanceFor(this.danger())
      ) {
        m.elite = true;
        m.name = eliteName();
        m.hp = m.maxHp = Math.round(m.maxHp * ELITE_HP_MULT);
        m.dmgMult = ELITE_DMG_MULT;
        m.speedMult = ELITE_SPEED_MULT;
        m.xpMult = ELITE_XP_MULT;
      }

      this.state.monsters.set(`mob_${this.nextId++}`, m);
      this.campAlive[campIndex]++;
    }
  }

  // an encounter that turns out to be teeth: a knot of monsters erupts at (x,y).
  // camp = -3 so they belong to no camp and never respawn (like the Pilgrim's -2).
  private spawnAmbush(x: number, y: number, kindHint: string | undefined, count: number) {
    const hpMult = floorHpMult(this.danger());
    const valid = kindHint && (MONSTERS as Record<string, unknown>)[kindHint] ? kindHint : null;
    for (let i = 0; i < count; i++) {
      const m = new Monster();
      const kind = valid ?? pickMonsterKindFor(this.state.act, this.state.floor);
      const def = MONSTERS[kind as MonsterKind];
      m.kind = kind;
      m.hp = m.maxHp = Math.round(def.maxHp * hpMult);
      m.camp = -3;
      const pos = this.scatter(x, y);
      m.x = pos.x;
      m.y = pos.y;
      this.state.monsters.set(`mob_${this.nextId++}`, m);
    }
  }

  // The Hollow Pilgrim: a roaming super-elite. Kill it before it kills you —
  // it may be carrying the charm every hero covets.
  private spawnPilgrim(x: number, y: number) {
    const m = new Monster();
    const def = MONSTERS.demon;
    m.kind = "demon";
    m.name = "The Hollow Pilgrim";
    m.elite = true;
    m.camp = -2;
    m.hp = m.maxHp = Math.round(def.maxHp * floorHpMult(this.danger()) * PILGRIM_HP_MULT);
    m.dmgMult = PILGRIM_DMG_MULT;
    m.xpMult = PILGRIM_XP_MULT;
    m.element = "fire";
    const pos = this.scatter(x, y);
    m.x = pos.x;
    m.y = pos.y;
    this.state.monsters.set(`pilgrim_${this.nextId++}`, m);
    this.broadcast("pilgrim", {});
  }

  // The Pilgrim's Burden: the Pilgrim's prize — a unique charm, scaled to the depth it fell on
  private pilgrimsBurden(ilvl: number): Item {
    const s = 1 + 0.12 * (ilvl - 1);
    return {
      id: `burden_${this.nextId++}`,
      base: "smallcharm",
      name: "The Pilgrim's Burden",
      slot: "charm",
      rarity: "unique",
      ilvl,
      stats: {
        dmgPct: Math.round(8 * s),
        maxHp: Math.round(12 * s),
        xpBonus: Math.round(6 * s),
        allRes: Math.round(6 * s),
      },
    };
  }

  // The Peg Leg: the key to a level that does not exist
  private pegLeg(ilvl: number): Item {
    return {
      id: `peg_${this.nextId++}`,
      base: "dagger",
      name: "The Peg Leg",
      slot: "weapon",
      rarity: "unique",
      ilvl,
      stats: { dmg: 3, moveSpd: 10 },
    };
  }

  private spawnGoblin(x: number, y: number) {
    const m = new Monster();
    const def = MONSTERS.goblin;
    m.kind = "goblin";
    m.name = "Treasure Goblin";
    m.hp = m.maxHp = Math.round(def.maxHp * floorHpMult(this.danger()));
    const pos = this.scatter(x, y);
    m.x = pos.x;
    m.y = pos.y;
    this.state.monsters.set(`gob_${this.nextId++}`, m);
  }

  private spawnBoss() {
    const kind = this.isCowLevel ? ("bovax" as const) : actBossKindFor(this.state.act, this.state.floor);
    const m = new Monster();
    const def = MONSTERS[kind];
    m.kind = kind;
    m.name = BOSS_NAMES[kind];
    m.hp = m.maxHp = Math.round(def.maxHp * floorHpMult(this.danger()));
    m.x = this.layout.boss.x;
    m.y = this.layout.boss.y;
    this.state.monsters.set(`boss_${this.nextId++}`, m);
  }

  // --- simulation ---

  private update(dtMs: number) {
    const dt = dtMs / 1000;
    const now = Date.now();

    this.updatePlayers(dt, now);
    // trades demand presence: drift apart or fall, and the deal is off
    if (this.trades.size) {
      const seen = new Set<TradeSession>();
      this.trades.forEach((tr) => {
        if (seen.has(tr)) return;
        seen.add(tr);
        const pa = this.state.players.get(tr.a);
        const pb = this.state.players.get(tr.b);
        if (!pa || !pb || pa.hp <= 0 || pb.hp <= 0 || Math.hypot(pa.x - pb.x, pa.y - pb.y) > TRADE_RANGE * 1.5) {
          this.cancelTrade(tr, "the partners parted");
        }
      });
    }
    this.autoPickupSweep();
    this.updateProjectiles(dt, now);
    this.updateMonsters(dt, now);
    this.updatePets(dt, now);
    this.updateMercs(dt, now);
    this.updateHazards(now);
    this.separateMonsters();

    this.campRespawnAt.forEach((at, i) => {
      if (at > 0 && now >= at) {
        this.campRespawnAt[i] = 0;
        this.campAlive[i] = 0;
        this.spawnCamp(i);
      }
    });

    if (this.bossRespawnAt > 0 && now >= this.bossRespawnAt) {
      this.bossRespawnAt = 0;
      this.spawnBoss();
    }

    this.state.loot.forEach((g, id) => {
      if (now - g.bornAt > LOOT_DESPAWN_MS) this.state.loot.delete(id);
    });

    if (this.pendingCow) {
      this.pendingCow = false;
      this.pendingTravel = null;
      this.pendingRift = 0;
      this.startFloor(this.state.act, this.state.floor, true); // moo
    } else if (this.pendingRift) {
      const tier = this.pendingRift;
      this.pendingRift = 0;
      this.pendingTravel = null;
      this.startFloor(RIFT_ACT, 1, false, true, tier); // into the Rift
    } else if (this.pendingTravel) {
      const target = this.pendingTravel;
      this.pendingTravel = null;
      this.startFloor(target.act, target.floor, false, false, 0, target.atWaypoint);
    }

    // checkpoint everyone's progress every 10s
    if (now - this.lastPersistAt > 10000) {
      this.lastPersistAt = now;
      this.state.players.forEach((p) => this.persist(p));
    }
  }

  // gold and potions are hoovered up by anyone who walks over them
  private autoPickupSweep() {
    this.state.loot.forEach((g, id) => {
      if (g.kind !== "gold" && g.kind !== "potion" && g.kind !== "manapotion") return;
      let taker: Player | null = null;
      let takerId = "";
      this.state.players.forEach((p, sid) => {
        if (taker || p.hp <= 0) return;
        if (g.kind === "potion" && p.potions >= p.maxPotions) return;
        if (g.kind === "manapotion" && p.manaPotions >= p.maxPotions) return;
        if (Math.hypot(g.x - p.x, g.y - p.y) <= AUTO_PICKUP_RANGE) {
          taker = p;
          takerId = sid;
        }
      });
      if (!taker) return;
      const t: Player = taker;
      if (g.kind === "gold") {
        t.gold += g.amount;
        this.hoarderHeal(takerId, t, g.amount);
        this.broadcast("pickedup", { id, by: takerId, gold: g.amount });
      } else if (g.kind === "manapotion") {
        t.manaPotions++;
        this.broadcast("pickedup", { id, by: takerId });
      } else {
        t.potions++;
        this.broadcast("pickedup", { id, by: takerId });
      }
      this.state.loot.delete(id);
    });
  }

  private updatePlayers(dt: number, now: number) {
    this.state.players.forEach((p, sid) => {
      if (p.hp <= 0) {
        if (p.fallen) return; // hardcore corpses do not get up
        if (now >= p.respawnAt) {
          // death sends you back — town on the surface, the floor's entrance below
          // (the deep camps are sealed; a corpse run must start on the field)
          const home = this.state.floor > 1 ? this.layout.spawn : TOWN.spawn;
          const pos = this.scatter(home.x, home.y);
          p.x = p.targetX = pos.x;
          p.y = p.targetY = pos.y;
          p.hp = p.maxHp;
          p.mana = p.maxMana;
          // a breath of invulnerability so a swarm can never spawn-camp you into a death loop
          p.immuneUntil = now + RESPAWN_IMMUNE_MS;
          this.broadcast("deathlessfx", { id: sid, x: p.x, y: p.y }); // the golden shimmer of protection
        }
        return;
      }

      if (p.mana < p.maxMana) {
        p.mana = Math.min(p.maxMana, p.mana + (MANA_REGEN_PER_S + (p.derived.manaRegen ?? 0)) * dt);
      }

      if (now - p.lastDamaged > REGEN_DELAY_MS && p.hp < p.maxHp) {
        p.hp = Math.min(p.maxHp, p.hp + (PLAYER_REGEN_PER_S + (p.derived.regen ?? 0)) * dt);
      }

      // Immolation: standing near you is a mistake
      if (p.effects.has("immolation") && !isInTown(p.y) && now - p.lastImmolationAt >= IMMOLATION_TICK_MS) {
        p.lastImmolationAt = now;
        const burnIds: string[] = [];
        this.state.monsters.forEach((m, mid) => {
          if (Math.hypot(m.x - p.x, m.y - p.y) <= IMMOLATION_RADIUS) burnIds.push(mid);
        });
        burnIds.forEach((mid) => {
          const m = this.state.monsters.get(mid);
          if (m) this.damageMonster(mid, m, this.outgoingDamage(p, [6, 10], IMMOLATION_MULT), sid, false);
        });
      }

      // town portal completes
      if (p.portalAt > 0 && now >= p.portalAt) {
        p.portalAt = 0;
        let tx: number;
        let ty: number;
        if (isInTown(p.y)) {
          tx = p.returnX || this.layout.spawn.x;
          ty = p.returnY || this.layout.spawn.y;
        } else {
          p.returnX = p.x;
          p.returnY = p.y;
          const pos = this.scatter(TOWN.spawn.x, TOWN.spawn.y);
          tx = pos.x;
          ty = pos.y;
        }
        p.x = p.targetX = tx;
        p.y = p.targetY = ty;
        this.broadcast("portalfx", { id: sid, x: tx, y: ty });
      }


      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) return;

      const haste = now < p.buffSpeedUntil ? SHRINE_SPEED_BONUS : 0;
      const lope = now < p.wolfUntil ? WOLF_SPEED_BONUS : 0;
      const chill = now < p.chilledUntil ? PLAYER_CHILL_FACTOR : 1;
      const speed = PLAYER_SPEED * (1 + (p.derived.moveSpd ?? 0) / 100 + haste + lope) * chill;
      const step = Math.min(dist, speed * dt);
      const nx = p.x + (dx / dist) * step;
      const ny = p.y + (dy / dist) * step;

      if (canStand(this.map, nx, ny)) {
        p.x = nx;
        p.y = ny;
      } else if (canStand(this.map, nx, p.y)) {
        p.x = nx;
        p.targetY = p.y;
      } else if (canStand(this.map, p.x, ny)) {
        p.y = ny;
        p.targetX = p.x;
      } else {
        p.targetX = p.x;
        p.targetY = p.y;
      }
    });
  }

  private updateProjectiles(dt: number, now: number) {
    this.state.projectiles.forEach((proj, id) => {
      const nx = proj.x + proj.vx * dt;
      const ny = proj.y + proj.vy * dt;

      if (now - proj.bornAt > PROJECTILE_LIFETIME_MS || !isWalkable(this.map, nx, ny)) {
        if (proj.hostile) {
          this.broadcast("impact", { kind: proj.kind, x: proj.x, y: proj.y });
          this.state.projectiles.delete(id);
        } else {
          this.explodeProjectile(id, proj, proj.x, proj.y);
        }
        return;
      }

      if (proj.hostile) {
        // monster projectiles hit players
        let hitSid: string | null = null;
        let hitP: Player | null = null;
        this.state.players.forEach((p, sid) => {
          if (hitSid || p.hp <= 0) return;
          if (Math.hypot(p.x - nx, p.y - ny) <= 10 + PLAYER_RADIUS) {
            hitSid = sid;
            hitP = p;
          }
        });
        if (hitSid && hitP) {
          this.damagePlayer(hitSid, hitP, proj.dmg, proj.byName || "an arrow", (proj.element || undefined) as Element | undefined);
          this.broadcast("impact", { kind: proj.kind, x: nx, y: ny });
          this.state.projectiles.delete(id);
          return;
        }
        // …or the hired help
        let hitMercSid: string | null = null;
        let hitMerc: Merc | null = null;
        this.state.mercs.forEach((mc, sid) => {
          if (hitMercSid) return;
          if (Math.hypot(mc.x - nx, mc.y - ny) <= 10 + PLAYER_RADIUS) {
            hitMercSid = sid;
            hitMerc = mc;
          }
        });
        if (hitMercSid && hitMerc) {
          this.damageMerc(hitMercSid, hitMerc, proj.dmg, proj.byName || "an arrow");
          this.broadcast("impact", { kind: proj.kind, x: nx, y: ny });
          this.state.projectiles.delete(id);
        } else {
          proj.x = nx;
          proj.y = ny;
        }
        return;
      }

      let hitId: string | null = null;
      this.state.monsters.forEach((m, mid) => {
        if (hitId) return;
        const def = MONSTERS[m.kind as MonsterKind];
        if (Math.hypot(m.x - nx, m.y - ny) <= 12 + def.radius) hitId = mid;
      });

      if (hitId) {
        this.explodeProjectile(id, proj, nx, ny, hitId);
      } else {
        proj.x = nx;
        proj.y = ny;
      }
    });
  }

  private explodeProjectile(id: string, proj: Projectile, x: number, y: number, directHitId?: string) {
    this.broadcast("impact", { kind: proj.kind, x, y });
    const owner = this.state.players.get(proj.owner);
    const atk = CLASS_ATTACKS[PROJECTILE_CLASS[proj.kind] ?? "rogue"];
    const mult = proj.mult || 1;

    const splash = atk.type === "projectile" ? atk.splash : undefined;
    if (owner) {
      if (splash) {
        const hits: string[] = [];
        this.state.monsters.forEach((m, mid) => {
          if (Math.hypot(m.x - x, m.y - y) <= splash) hits.push(mid);
        });
        hits.forEach((mid) => {
          const m = this.state.monsters.get(mid);
          if (m) this.damageMonster(mid, m, this.outgoingDamage(owner, atk.dmg, mult), proj.owner);
        });
      } else if (directHitId) {
        const m = this.state.monsters.get(directHitId);
        if (m) {
          if (proj.chillMs > 0) m.slowUntil = Date.now() + proj.chillMs; // frost arrows bite deep
          this.damageMonster(directHitId, m, this.outgoingDamage(owner, atk.dmg, mult), proj.owner);
        }
      }
      // Killing Frost: a Frost Arrow shatters into a nova of cold on impact
      if (proj.kind === "icearrow" && owner.powers.has("frost_shatter")) {
        this.broadcast("frostfx", { x, y, r: FROST_SHATTER_RADIUS });
        const near: string[] = [];
        this.state.monsters.forEach((m, mid) => {
          if (Math.hypot(m.x - x, m.y - y) <= FROST_SHATTER_RADIUS) near.push(mid);
        });
        near.forEach((mid) => {
          const m = this.state.monsters.get(mid);
          if (!m) return;
          m.slowUntil = Date.now() + FROST_SHATTER_CHILL_MS;
          if (mid !== directHitId) this.damageMonster(mid, m, this.outgoingDamage(owner, atk.dmg, FROST_SHATTER_MULT), proj.owner);
        });
      }
    }

    this.state.projectiles.delete(id);
  }

  // burning ground ticks anything standing in it
  private updateHazards(now: number) {
    this.hazards = this.hazards.filter((h) => now < h.until);
    for (const h of this.hazards) {
      // hurricanes ride on their summoner
      if (h.followSid) {
        const carrier = this.state.players.get(h.followSid);
        if (!carrier || carrier.hp <= 0) {
          h.until = 0;
          continue;
        }
        h.ax = h.bx = carrier.x;
        h.ay = h.by = carrier.y;
      }
      if (now < h.nextTick) continue;
      h.nextTick = now + FIREWALL_TICK_MS;
      const owner = this.state.players.get(h.owner);
      if (!owner) continue;
      const abx = h.bx - h.ax;
      const aby = h.by - h.ay;
      const abLen2 = abx * abx + aby * aby;
      const victims: string[] = [];
      this.state.monsters.forEach((m, id) => {
        const def = MONSTERS[m.kind as MonsterKind];
        // distance from monster to segment ab
        let t = 0;
        if (abLen2 > 0) {
          t = Math.max(0, Math.min(1, ((m.x - h.ax) * abx + (m.y - h.ay) * aby) / abLen2));
        }
        const cx = h.ax + abx * t;
        const cy = h.ay + aby * t;
        if (Math.hypot(m.x - cx, m.y - cy) <= h.width + def.radius) victims.push(id);
      });
      victims.forEach((id) => {
        const m = this.state.monsters.get(id);
        if (m) {
          if (h.chill) m.slowUntil = now + 1200;
          const atk = CLASS_ATTACKS[owner.cls as keyof typeof CLASS_ATTACKS];
          this.damageMonster(id, m, this.outgoingDamage(owner, atk.dmg, h.mult), h.owner, false);
        }
      });
    }
  }

  // necromancer servants: follow the master, bite whatever comes near
  private updatePets(dt: number, now: number) {
    this.state.pets.forEach((pet, id) => {
      if (now > pet.until) {
        this.state.pets.delete(id);
        return;
      }
      const owner = this.state.players.get(pet.owner);
      if (!owner) {
        this.state.pets.delete(id);
        return;
      }
      // nearest monster within reach of the pet
      let target: Monster | null = null;
      let targetId = "";
      let best = PET_SEEK_RANGE;
      this.state.monsters.forEach((m, mid) => {
        const d = Math.hypot(m.x - pet.x, m.y - pet.y);
        if (d < best) {
          best = d;
          target = m;
          targetId = mid;
        }
      });

      if (target) {
        const t: Monster = target;
        const def = MONSTERS[t.kind as MonsterKind];
        if (best <= PET_ATTACK_RANGE + def.radius) {
          if (now - pet.lastAttack >= PET_ATTACK_MS) {
            pet.lastAttack = now;
            this.damageMonster(targetId, t, pet.dmg, pet.owner, false);
          }
          return;
        }
        const d = best || 1;
        const nx = pet.x + ((t.x - pet.x) / d) * PET_SPEED * dt;
        const ny = pet.y + ((t.y - pet.y) / d) * PET_SPEED * dt;
        if (canStand(this.map, nx, ny)) {
          pet.x = nx;
          pet.y = ny;
        }
        return;
      }

      // no prey — heel
      const dHome = Math.hypot(owner.x - pet.x, owner.y - pet.y);
      if (dHome > PET_FOLLOW_DIST) {
        const nx = pet.x + ((owner.x - pet.x) / dHome) * PET_SPEED * dt;
        const ny = pet.y + ((owner.y - pet.y) / dHome) * PET_SPEED * dt;
        if (canStand(this.map, nx, ny)) {
          pet.x = nx;
          pet.y = ny;
        }
      }
    });
  }

  // --- mercenaries: Maren's rogues ---

  private mercStatsFor(p: Player) {
    const mcls = mercClassById(p.merc?.cls);
    const arch = mcls.archetypes.find((a) => a.id === p.merc?.archetype) ?? mcls.archetypes[0];
    const gear = p.merc?.gear ?? {};
    let flat = 0;
    let pct = 0;
    let crit = arch.crit;
    let armor = 0;
    let hp = mercBaseHp(p.level) * mcls.hpMult; // barbarians soak, mages are frail
    for (const slot of MERC_SLOTS) {
      const it = gear[slot];
      if (!it) continue;
      flat += (it.stats.dmg ?? 0) + (it.stats.fireDmg ?? 0) + (it.stats.coldDmg ?? 0) + (it.stats.lightDmg ?? 0);
      pct += it.stats.dmgPct ?? 0;
      crit += it.stats.crit ?? 0;
      armor += it.stats.armor ?? 0;
      hp += it.stats.maxHp ?? 0;
    }
    const [lo, hi] = mercBaseDmg(p.level);
    const mult = arch.dmgMult * (1 + pct / 100);
    return {
      arch,
      dmgMin: Math.max(1, Math.round((lo + flat) * mult)),
      dmgMax: Math.max(2, Math.round((hi + flat) * mult)),
      crit,
      armor,
      maxHp: Math.round(hp),
    };
  }

  private spawnMercFor(sid: string, p: Player) {
    if (!p.merc || p.merc.dead) return;
    const st = this.mercStatsFor(p);
    const mc = new Merc();
    mc.name = p.merc.name;
    mc.cls = p.merc.cls;
    mc.archetype = p.merc.archetype;
    mc.x = p.x + 26;
    mc.y = p.y + 10;
    mc.maxHp = st.maxHp;
    mc.hp = st.maxHp;
    mc.dmgMin = st.dmgMin;
    mc.dmgMax = st.dmgMax;
    mc.crit = st.crit;
    mc.armor = st.armor;
    mc.cooldownMs = st.arch.cooldownMs;
    mc.element = st.arch.element;
    mc.weaponBase = p.merc.gear.weapon?.base ?? "";
    mc.helmBase = p.merc.gear.helm?.base ?? "";
    mc.chestBase = p.merc.gear.chest?.base ?? "";
    this.state.mercs.set(sid, mc);
  }

  // gear or level changed — the living entity keeps up with the contract
  private recomputeMerc(sid: string, p: Player) {
    const mc = this.state.mercs.get(sid);
    if (!mc || !p.merc) return;
    const st = this.mercStatsFor(p);
    const frac = mc.maxHp > 0 ? mc.hp / mc.maxHp : 1;
    mc.maxHp = st.maxHp;
    mc.hp = Math.max(1, Math.round(st.maxHp * frac));
    mc.dmgMin = st.dmgMin;
    mc.dmgMax = st.dmgMax;
    mc.crit = st.crit;
    mc.armor = st.armor;
    mc.weaponBase = p.merc.gear.weapon?.base ?? "";
    mc.helmBase = p.merc.gear.helm?.base ?? "";
    mc.chestBase = p.merc.gear.chest?.base ?? "";
  }

  private sendMercOffers(client: Client, p: Player, classId: string) {
    const mcls = mercClassById(classId);
    // three recruits, schools distinct, price matched to your level
    const seed = mulberry32(this.mercOfferSeed);
    const names = [...mcls.names].sort(() => seed() - 0.5);
    // this act's recruiter hires their own school, but will raise ANY companion
    // you already march with — the revive row shows whoever you have.
    const mine = p.merc ?? null;
    client.send("openmercs", {
      classId: mcls.id,
      className: mcls.className,
      npcTitle: mcls.npcTitle,
      npcColor: mcls.npcColor,
      unlockAct: mcls.unlockAct,
      locked: false,
      offers: mcls.archetypes.map((a, i) => ({
        archetype: a.id,
        title: a.title,
        blurb: a.blurb,
        name: names[i % names.length],
        cost: mercHireCost(p.level),
      })),
      current: mine
        ? { name: mine.name, archetype: mine.archetype, dead: mine.dead, reviveCost: mercReviveCost(p.level) }
        : null,
    });
  }

  private sendMercLoadout(client: Client, p: Player) {
    const st = p.merc ? this.mercStatsFor(p) : null;
    client.send("mercloadout", {
      merc: p.merc
        ? {
            name: p.merc.name,
            cls: p.merc.cls,
            className: mercClassById(p.merc.cls).className,
            archetype: p.merc.archetype,
            dead: p.merc.dead,
            gear: p.merc.gear,
            dmgMin: st!.dmgMin,
            dmgMax: st!.dmgMax,
            crit: st!.crit,
            armor: st!.armor,
            maxHp: st!.maxHp,
          }
        : null,
    });
  }

  private damageMerc(sid: string, mc: Merc, amount: number, by: string) {
    const reduced = Math.max(1, Math.round(amount - mc.armor * 0.5));
    mc.hp -= reduced;
    mc.lastDamaged = Date.now();
    this.broadcast("hit", { t: "c", id: sid, amount: reduced, x: mc.x, y: mc.y, crit: false });
    if (mc.hp <= 0) {
      this.state.mercs.delete(sid);
      const p = this.state.players.get(sid);
      if (p?.merc) {
        p.merc.dead = true;
        this.persist(p);
        const client = this.clients.find((c) => c.sessionId === sid);
        client?.send("mercdead", { name: p.merc.name, by });
        if (client) this.sendMercLoadout(client, p);
        this.broadcast("grave", { x: mc.x, y: mc.y, name: mc.name, by });
        const cn = mercClassById(p.merc.cls).className.toLowerCase();
        this.broadcast("announce", { text: `${mc.name}, ${p.name || p.cls}'s ${cn}, was slain by ${by}` });
      }
    }
  }

  private updateMercs(dt: number, now: number) {
    this.state.mercs.forEach((mc, sid) => {
      const owner = this.state.players.get(sid);
      if (!owner) {
        this.state.mercs.delete(sid);
        return;
      }
      // she recovers between fights, like anyone
      if (now - mc.lastDamaged > MERC_REGEN_DELAY_MS && mc.hp < mc.maxHp) {
        mc.hp = Math.min(mc.maxHp, mc.hp + MERC_REGEN_PER_S * dt);
      }
      const dOwner = Math.hypot(owner.x - mc.x, owner.y - mc.y);
      if (dOwner > MERC_TELEPORT_DIST) {
        // portals, waypoints, long sprints — she always finds you
        mc.x = owner.x + 26;
        mc.y = owner.y + 10;
        return;
      }

      // nearest monster worth an arrow: near her, near her employer, and in her
      // sight — she does not loose through walls at things she cannot see.
      let target: Monster | null = null;
      let targetId = "";
      let best = MERC_ATTACK_RANGE + 60;
      this.state.monsters.forEach((m, mid) => {
        if (m.kind === "goblin") return; // not worth the arrows
        if (Math.hypot(m.x - owner.x, m.y - owner.y) > MERC_ENGAGE_RANGE + 200) return;
        const d = Math.hypot(m.x - mc.x, m.y - mc.y);
        if (d >= best) return;
        if (!hasLineOfSight(this.map, mc.x, mc.y, m.x, m.y)) return;
        best = d;
        target = m;
        targetId = mid;
      });

      const mcls = mercClassById(mc.cls);
      const melee = mcls.attackStyle === "melee";
      const reach = melee ? MERC_MELEE_RANGE : MERC_ATTACK_RANGE;
      if (target && !isInTown(mc.y)) {
        const t: Monster = target;
        if (best <= reach) {
          if (now - mc.lastAttack >= mc.cooldownMs) {
            mc.lastAttack = now;
            let dmg = Math.round(mc.dmgMin + Math.random() * (mc.dmgMax - mc.dmgMin));
            const crit = Math.random() * 100 < mc.crit;
            if (crit) dmg = Math.round(dmg * 1.6);
            if (mc.element === "cold") t.slowUntil = Math.max(t.slowUntil, now + MERC_CHILL_MS);
            // barbarians and paladins wade in; rogues and mages strike from afar
            if (melee) this.broadcast("mercmelee", { id: sid, tx: t.x, ty: t.y, element: mc.element, crit });
            else this.broadcast("mercshot", { id: sid, tx: t.x, ty: t.y, element: mc.element, kind: mcls.projKind, crit });
            this.damageMonster(targetId, t, dmg, sid, false); // kills credit the employer
          }
          return; // in range — hold and strike
        }
        // close the gap, but never abandon the employer
        if (Math.hypot(t.x - owner.x, t.y - owner.y) <= MERC_ENGAGE_RANGE + 150) {
          const d = best || 1;
          const nx = mc.x + ((t.x - mc.x) / d) * MERC_SPEED * dt;
          const ny = mc.y + ((t.y - mc.y) / d) * MERC_SPEED * dt;
          if (canStand(this.map, nx, ny)) {
            mc.x = nx;
            mc.y = ny;
          }
          return;
        }
      }

      // no prey — heel
      if (dOwner > MERC_FOLLOW_DIST) {
        const nx = mc.x + ((owner.x - mc.x) / dOwner) * MERC_SPEED * dt;
        const ny = mc.y + ((owner.y - mc.y) / dOwner) * MERC_SPEED * dt;
        if (canStand(this.map, nx, ny)) {
          mc.x = nx;
          mc.y = ny;
        } else if (canStand(this.map, nx, mc.y)) {
          mc.x = nx;
        } else if (canStand(this.map, mc.x, ny)) {
          mc.y = ny;
        }
      }
    });
  }

  private updateMonsters(dt: number, now: number) {
    this.state.monsters.forEach((m, id) => {
      const def = MONSTERS[m.kind as MonsterKind];
      // Bloodletter wounds keep bleeding, stunned or not
      if (m.bleedTicksLeft > 0 && now >= m.bleedNextAt) {
        m.bleedTicksLeft--;
        m.bleedNextAt = now + BLEED_TICK_MS;
        this.damageMonster(id, m, m.bleedDmg, m.bleedBy, false);
        if (!this.state.monsters.get(id)) return; // bled out
      }
      if (now < m.stunUntil) return; // staggered — can't move or fight

      // acquire only what the monster can actually SEE — nearest target within
      // aggro range AND unobstructed by walls. No more waking to a player two
      // rooms over and grinding face-first into the intervening wall.
      let target: Player | Merc | null = null;
      let targetId = "";
      let targetIsMerc = false;
      let best = Infinity;
      this.state.players.forEach((p, sid) => {
        if (p.hp <= 0 || isInTown(p.y)) return; // the town is sacred ground
        const d = Math.hypot(p.x - m.x, p.y - m.y);
        if (d >= best || d > def.aggroRange) return;
        if (!hasLineOfSight(this.map, m.x, m.y, p.x, p.y)) return;
        best = d;
        target = p;
        targetId = sid;
        targetIsMerc = false;
      });
      // hired rogues stand in the line of fire — that's the job
      this.state.mercs.forEach((mc, sid) => {
        if (isInTown(mc.y)) return;
        const d = Math.hypot(mc.x - m.x, mc.y - m.y);
        if (d >= best || d > def.aggroRange) return;
        if (!hasLineOfSight(this.map, m.x, m.y, mc.x, mc.y)) return;
        best = d;
        target = mc;
        targetId = sid;
        targetIsMerc = true;
      });

      // nothing in view: hunt the last-seen spot for a few seconds, then go quiet.
      // Movement toward a remembered point still slides along walls — but a monster
      // that has never seen you (or lost you long ago) simply holds its ground.
      if (!target) {
        if (m.aggroed && now - m.lastSeenAt < AGGRO_MEMORY_MS && (m.lastSeenX || m.lastSeenY)) {
          const dx = m.lastSeenX - m.x;
          const dy = m.lastSeenY - m.y;
          const d = Math.hypot(dx, dy);
          if (d > 6) {
            const step = this.monsterStep(m, dt, now);
            const nx = m.x + (dx / d) * step;
            const ny = m.y + (dy / d) * step;
            if (this.monsterCanStand(nx, ny)) { m.x = nx; m.y = ny; }
            else if (this.monsterCanStand(nx, m.y)) m.x = nx;
            else if (this.monsterCanStand(m.x, ny)) m.y = ny;
          }
        }
        return;
      }
      // TS quirk: closure-assigned union lets narrow to never after the guard — assert once
      const foe = target as unknown as Player | Merc;
      m.lastSeenX = foe.x; // fresh sighting — refresh the memory
      m.lastSeenY = foe.y;
      m.lastSeenAt = now;

      if (!m.aggroed) {
        m.aggroed = true;
        m.aggroAt = now;
        if (isBossKind(m.kind)) {
          const bk = m.kind as BossKind | "bovax";
          this.broadcast("bossaggro", { kind: bk, name: BOSS_NAMES[bk], line: BOSS_LINES[bk] });
          if (NOVA_BOSSES[m.kind]) m.novaAt = now + 2500;
          if (BROOD_BOSSES.includes(m.kind)) m.addAt = now + 2000;
          if (MONSTER_AI[m.kind] === "charger") m.chargeAt = now + 2000;
        }
        if (m.kind === "goblin") this.broadcast("goblinspotted", { x: m.x, y: m.y });
        // stagger the behavioral packs' first special so the whole camp doesn't fire as one
        if (m.modifier === "mortar") m.mortarAt = now + 800 + Math.random() * MORTAR_INTERVAL_MS;
        if (m.modifier === "warded") m.nextWardAt = now + 1500 + Math.random() * 2000;
      }

      // brood-mothers and nova lords work their horrors even while they kite
      if (BROOD_BOSSES.includes(m.kind)) this.updateQueenBrood(m, now);
      if (NOVA_BOSSES[m.kind]) this.updateNova(m, now);
      // behavioral champion packs: their tricks run while aggroed, alongside normal movement
      if (m.modifier === "mortar") this.updateMortar(m, foe, now);
      else if (m.modifier === "warded") this.updateWard(m, id, now);
      // ranged monsters: keep distance and shoot — data-driven, one table row per kind
      const ranged = RANGED_MONSTERS[m.kind];
      if (ranged) {
        this.updateRanged(m, foe, best, dt, now, ranged.keep, ranged.proj, ranged.speed);
        return;
      }
      // cowards: a dead packmate sends them scattering, shrieking
      if (MONSTER_AI[m.kind] === "coward" && now < m.fleeUntil) {
        const t = foe;
        const base = Math.atan2(m.y - t.y, m.x - t.x);
        const step = this.monsterStep(m, dt, now) * 1.2;
        for (const turn of [0, 0.7, -0.7, 1.4, -1.4]) {
          const nx = m.x + Math.cos(base + turn) * step;
          const ny = m.y + Math.sin(base + turn) * step;
          if (this.monsterCanStand(nx, ny)) {
            m.x = nx;
            m.y = ny;
            break;
          }
        }
        return;
      }
      // Vuruk charges: a burst of terrifying speed toward his prey — but he BRACES first,
      // planting his feet and telegraphing the line, so you get a beat to dodge
      if (MONSTER_AI[m.kind] === "charger") {
        if (now < m.chargeWindupUntil) return; // braced mid-windup — hold still, tell showing
        if (m.chargeWindupUntil > 0) {
          m.chargeWindupUntil = 0; // windup just ended — LAUNCH toward where they were
          m.chargeUntil = now + VURUK_CHARGE_MS;
        } else if (now >= m.chargeAt) {
          m.chargeAt = now + VURUK_CHARGE_INTERVAL_MS;
          m.chargeWindupUntil = now + CHARGE_WINDUP_MS;
          const ang = Math.atan2(foe.y - m.y, foe.x - m.x);
          this.broadcast("chargewarn", { id, x: m.x, y: m.y, ang, ms: CHARGE_WINDUP_MS });
          return; // plant the feet this tick
        }
      }

      // treasure goblins don't fight — they run, and eventually portal out
      if (m.kind === "goblin") {
        if (now - m.aggroAt > GOBLIN_ESCAPE_MS) {
          this.broadcast("goblinescape", { x: m.x, y: m.y });
          this.state.monsters.delete(id);
          return;
        }
        const t = foe;
        const fx = m.x - t.x;
        const fy = m.y - t.y;
        const step = this.monsterStep(m, dt, now);
        const base = Math.atan2(fy, fx);
        for (const turn of [0, 0.7, -0.7, 1.4, -1.4]) {
          const nx = m.x + Math.cos(base + turn) * step;
          const ny = m.y + Math.sin(base + turn) * step;
          if (this.monsterCanStand(nx, ny)) {
            m.x = nx;
            m.y = ny;
            break;
          }
        }
        return;
      }

      if (best <= def.attackRange) {
        if (now - m.lastAttack >= def.cooldownMs * m.cdMult) {
          m.lastAttack = now;
          this.broadcast("mswing", { id, tx: foe.x, ty: foe.y }); // the lunge, for the eyes
          const dealt = this.monsterDamage(m);
          if (targetIsMerc) {
            this.damageMerc(targetId, foe as Merc, dealt, this.monsterLabel(m));
          } else {
            const t = foe as Player;
            this.damagePlayer(targetId, t, dealt, this.monsterLabel(m), (m.element || MONSTER_ELEMENTS[m.kind]) as Element | undefined);
            // thorns bite back at melee attackers
            if ((t.derived.thorns ?? 0) > 0 && this.state.monsters.get(id)) {
              this.damageMonster(id, m, t.derived.thorns!, targetId, false);
            }
            // Frostplate: touching this one costs you your speed
            if (t.effects.has("frost_armor")) {
              m.slowUntil = Math.max(m.slowUntil, now + 1800);
            }
          }
          // Vampiric packs drink from the wound — the blow it just landed knits it back together
          if (m.modifier === "vampiric" && m.hp > 0 && m.hp < m.maxHp) {
            const healed = Math.min(m.maxHp, m.hp + dealt * VAMPIRIC_HEAL_FRAC);
            if (healed > m.hp) {
              m.hp = healed;
              this.broadcast("mheal", { id, x: m.x, y: m.y });
            }
          }
        }
        return;
      }

      const t = foe;
      const dx = t.x - m.x;
      const dy = t.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      const step = this.monsterStep(m, dt, now);
      const nx = m.x + (dx / d) * step;
      const ny = m.y + (dy / d) * step;

      if (this.monsterCanStand(nx, ny)) {
        m.x = nx;
        m.y = ny;
      } else if (this.monsterCanStand(nx, m.y)) {
        m.x = nx;
      } else if (this.monsterCanStand(m.x, ny)) {
        m.y = ny;
      }
    });
  }

  // ranged monsters keep their distance and shoot (Corvessa, the Carrion Bride, skeleton archers…)
  private updateRanged(
    m: Monster,
    target: { x: number; y: number },
    dist: number,
    dt: number,
    now: number,
    keepDistance: number,
    projKind: string,
    projSpeed: number
  ) {
    const def = MONSTERS[m.kind as MonsterKind];

    if (dist <= def.attackRange && now - m.lastAttack >= def.cooldownMs * m.cdMult) {
      m.lastAttack = now;
      const dx = target.x - m.x;
      const dy = target.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      const proj = new Projectile();
      proj.x = m.x;
      proj.y = m.y;
      proj.kind = projKind;
      proj.vx = (dx / d) * projSpeed;
      proj.vy = (dy / d) * projSpeed;
      proj.bornAt = now;
      proj.hostile = true;
      proj.dmg = this.monsterDamage(m);
      proj.byName = this.monsterLabel(m);
      proj.element = m.element || (MONSTER_ELEMENTS[m.kind] ?? "");
      this.state.projectiles.set(`proj_${this.nextId++}`, proj);
    }

    const step = this.monsterStep(m, dt, now);
    if (dist < keepDistance) {
      // kite away
      const base = Math.atan2(m.y - target.y, m.x - target.x);
      for (const turn of [0, 0.7, -0.7, 1.4, -1.4]) {
        const nx = m.x + Math.cos(base + turn) * step;
        const ny = m.y + Math.sin(base + turn) * step;
        if (this.monsterCanStand(nx, ny)) {
          m.x = nx;
          m.y = ny;
          break;
        }
      }
    } else if (dist > def.attackRange) {
      const dx = target.x - m.x;
      const dy = target.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = m.x + (dx / d) * step;
      const ny = m.y + (dy / d) * step;
      if (this.monsterCanStand(nx, ny)) {
        m.x = nx;
        m.y = ny;
      }
    }
  }

  // Maggot Queen: periodically births broodlings while in combat
  private updateQueenBrood(m: Monster, now: number) {
    if (!m.aggroed || now < m.addAt) return;
    m.addAt = now + QUEEN_SPAWN_MS;
    let adds = 0;
    this.state.monsters.forEach((o) => {
      if (o.camp === -2) adds++;
    });
    if (adds >= QUEEN_MAX_ADDS) return;
    for (let i = 0; i < 2; i++) {
      const b = new Monster();
      const addKind = BROOD_ADD_KIND[m.kind] ?? "zombie";
      const def = MONSTERS[addKind];
      b.kind = addKind;
      b.camp = -2;
      b.hp = b.maxHp = Math.round(def.maxHp * floorHpMult(this.danger()) * 0.6);
      const pos = this.scatter(m.x, m.y);
      b.x = pos.x;
      b.y = pos.y;
      this.state.monsters.set(`brood_${this.nextId++}`, b);
    }
    this.broadcast("queenspawn", { x: m.x, y: m.y });
  }

  // telegraphed boss novas — each lord flavors his own ruin
  private updateNova(m: Monster, now: number) {
    if (!m.aggroed) return;
    const flavor = NOVA_BOSSES[m.kind] ?? { hue: 0xff6a20, element: "fire" as Element, label: "a nova" };
    if (m.novaFireAt > 0 && now >= m.novaFireAt) {
      m.novaFireAt = 0;
      this.broadcast("novafire", { x: m.x, y: m.y, r: NOVA_RADIUS, hue: flavor.hue });
      this.state.players.forEach((p, sid) => {
        if (p.hp <= 0) return;
        if (Math.hypot(p.x - m.x, p.y - m.y) <= NOVA_RADIUS) {
          this.damagePlayer(
            sid,
            p,
            Math.round(rollDamage(NOVA_DMG) * floorDmgMult(this.danger())),
            flavor.label,
            flavor.element
          );
        }
      });
    } else if (m.novaFireAt === 0 && now >= m.novaAt) {
      m.novaFireAt = now + NOVA_TELEGRAPH_MS;
      m.novaAt = now + NOVA_INTERVAL_MS;
      this.broadcast("novacharge", { x: m.x, y: m.y, r: NOVA_RADIUS, ms: NOVA_TELEGRAPH_MS, hue: flavor.hue });
    }
  }

  // Mortar champions lob shells at where you're standing: a ring warns, then the ground erupts.
  // The target is locked when the shell launches, so keep moving and the blast lands on nothing.
  private updateMortar(m: Monster, foe: { x: number; y: number }, now: number) {
    if (m.mortarFireAt > 0) {
      if (now >= m.mortarFireAt) {
        m.mortarFireAt = 0;
        this.broadcast("mortarhit", { x: m.mortarTX, y: m.mortarTY, r: MORTAR_RADIUS });
        this.state.players.forEach((p, sid) => {
          if (p.hp <= 0) return;
          if (Math.hypot(p.x - m.mortarTX, p.y - m.mortarTY) <= MORTAR_RADIUS) {
            this.damagePlayer(
              sid,
              p,
              Math.round(rollDamage(MORTAR_DMG) * floorDmgMult(this.danger()) * m.dmgMult),
              `${m.name || "a mortar"} shell`
            );
          }
        });
      }
      return;
    }
    if (now >= m.mortarAt) {
      m.mortarTX = foe.x; // lock the aim now — dodgeable by design
      m.mortarTY = foe.y;
      m.mortarFireAt = now + MORTAR_TELEGRAPH_MS;
      m.mortarAt = now + MORTAR_INTERVAL_MS;
      this.broadcast("mortarwarn", { x: m.mortarTX, y: m.mortarTY, r: MORTAR_RADIUS, ms: MORTAR_TELEGRAPH_MS });
    }
  }

  // Warded champions raise a bubble that eats all damage for a beat, then drop it. The client
  // reads "wardup" (with its duration) and paints a shield that follows the monster.
  private updateWard(m: Monster, id: string, now: number) {
    if (now >= m.nextWardAt) {
      m.wardUntil = now + WARD_DURATION_MS;
      m.nextWardAt = now + WARD_INTERVAL_MS;
      this.broadcast("wardup", { id, x: m.x, y: m.y, ms: WARD_DURATION_MS });
    }
  }

  private separateMonsters() {
    const list: Monster[] = [];
    this.state.monsters.forEach((m) => list.push(m));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const minDist =
          MONSTERS[a.kind as MonsterKind].radius + MONSTERS[b.kind as MonsterKind].radius;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= minDist || d === 0) continue;
        const push = (minDist - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        if (canStand(this.map, a.x - ux * push, a.y - uy * push)) {
          a.x -= ux * push;
          a.y -= uy * push;
        }
        if (canStand(this.map, b.x + ux * push, b.y + uy * push)) {
          b.x += ux * push;
          b.y += uy * push;
        }
      }
    }
  }
}
