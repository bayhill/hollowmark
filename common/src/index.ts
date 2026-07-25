// Shared game logic — imported by both server (authoritative) and client (rendering/prediction).

export const TICK_RATE = 20; // server simulation ticks per second
export const PLAYER_SPEED = 170; // world units per second
export const PLAYER_RADIUS = 8; // collision radius in world units

// World space is flat top-down 2D; one tile = TILE x TILE world units.
// The client projects world space to isometric screen space (TILE_W x TILE_H diamonds).

// ── extracted modules ──
// index.ts stays the single public entry point: everything below is re-exported, so
// `import { ... } from "@hollowmark/common"` keeps working exactly as before.
// These are imported (not just re-exported) where index.ts still uses them itself.
import { BOSS_BANDS, BOSS_KIND_LIST, type BossKind } from "./bosses";
import { addStats, type ItemStats } from "./stats";
import { AFFIXES, BASE_ITEMS, FIXED_ITEMS, RARE_NAME_A, RARE_NAME_B, type AffixDef } from "./effects";
export * from "./stats";
export * from "./bosses";
export * from "./lore";
export * from "./skills";
export * from "./effects";
export * from "./mercs";
export * from "./quests";

export const TILE = 32;
export const TILE_W = 64;
export const TILE_H = 32;
export const WALL_H = 28; // visual wall height in screen px

// --- dynamic maps ---
// Maps are generated per floor and synced to clients as newline-joined rows.
// '#' = wall, '.' = floor

export interface GameMap {
  rows: string[];
  w: number;
  h: number;
}

export function makeMap(rows: string[]): GameMap {
  return { rows, w: rows[0]?.length ?? 0, h: rows.length };
}

export function tileAt(map: GameMap, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return 1;
  return map.rows[ty].charAt(tx) === "#" ? 1 : 0;
}

export function isWalkable(map: GameMap, wx: number, wy: number): boolean {
  return tileAt(map, Math.floor(wx / TILE), Math.floor(wy / TILE)) === 0;
}

export function canStand(map: GameMap, wx: number, wy: number): boolean {
  const r = PLAYER_RADIUS;
  return (
    isWalkable(map, wx - r, wy - r) &&
    isWalkable(map, wx + r, wy - r) &&
    isWalkable(map, wx - r, wy + r) &&
    isWalkable(map, wx + r, wy + r)
  );
}

// a straight sight-line between two points, sampled every half tile — walls block it
export function hasLineOfSight(map: GameMap, x0: number, y0: number, x1: number, y1: number): boolean {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / (TILE / 2)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (!isWalkable(map, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}

// how long a monster hunts the last place it saw you before the trail goes cold
export const AGGRO_MEMORY_MS = 4000;

// --- dungeon generation ---

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// forest sub-areas: interiors you step into through a portal (tower floors, caves)
export interface AreaRect {
  kind: "tower" | "cave" | "towerbase";
  x: number; y: number; w: number; h: number; // tile rect, walls included
}
export interface AreaPortal {
  x: number; y: number; // where the portal stands (world coords)
  tx: number; ty: number; // where it takes you (world coords)
  label: string;
  variant: "towerdoor" | "stairsup" | "stairsdown" | "cavemouth" | "caveexit" | "towerexit";
}

export interface DungeonLayout {
  rows: string[];
  spawn: { x: number; y: number };
  stairs: { x: number; y: number };
  camps: Array<{ x: number; y: number }>;
  boss: { x: number; y: number };
  shrines: Array<{ x: number; y: number }>;
  chests: Array<{ x: number; y: number }>;
  tome: { x: number; y: number } | null;
  // floors 3 and 5 of each act: a waypoint stands here, waiting to be found
  waypoint: { x: number; y: number } | null;
  // floor 1 only: the stone cathedral standing in the forest (tile rect, walls included)
  cathedral: { x: number; y: number; w: number; h: number } | null;
  // floor 1 only: tower/cave interiors and the portals that reach them
  areas: AreaRect[];
  portals: AreaPortal[];
}

const DUNGEON_W = 36;
const DUNGEON_H = 36;

// The town ("Hollowmere") occupies rows 0..TOWN_ROWS-1 on every floor, walled off
// from the dungeon below — only the town portal gets you in or out.
export const TOWN_ROWS = 11;
const GRID_H = TOWN_ROWS + 1 + DUNGEON_H;

const townTile = (tx: number, ty: number) => ({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE });
export const TOWN = {
  spawn: townTile(7, 7),
  stash: townTile(4, 4),
  vendor: townTile(17, 5), // Torvald works in front of his smithy now
  campfire: townTile(7, 5),
  waypoint: townTile(12, 7),
  transmute: townTile(3, 7),
  well: townTile(13, 4),
  tavernDoor: townTile(24, 4),
  smithyDoor: townTile(17, 4),
  alchemist: townTile(20, 5),
  fenwick: townTile(23, 6), // in the tavern's shadow, where he belongs
  maren: townTile(10, 4), // the Warden captain (rogues), by Edric's house
  loremaster: townTile(6, 6), // the exiled magus (mages), unlocks in Act 2
  warband: townTile(14, 6), // the northern chieftain (barbarians), unlocks in Act 3
  sanctum: townTile(19, 7), // the fallen knight (paladins), unlocks in Act 4
  caravan: townTile(26, 5), // the road to the next act begins at the east edge
  elder: townTile(9, 7), // the act's storyteller sits by the campfire — a new face each land
  bar: townTile(24, 2), // behind the tavern counter — the barkeep's post, indoors
  hearth: townTile(3, 2), // inside Senna's hut — a resident by the fire, indoors
  rift: townTile(17, 8), // the Rift obelisk — a doorway into the endless endgame
  reliquary: townTile(21, 8), // the Archive — the Codex of everything this account remembers
};

// the alchemist sells flasks — click her to browse
export const POTION_PRICES = { health: 40, mana: 60 } as const;

// the plaza: rows 1..9, columns 2..27 — a real settlement, not a broom closet
export const TOWN_PLAZA = { x0: 2, y0: 1, x1: 27, y1: 9 };
// the gate: the only way out of town on foot, straight into the current floor
export const TOWN_GATE_TX = 7;

export interface TownBuilding {
  kind: "hut" | "house" | "smithy" | "tavern" | "well";
  name: string;
  x: number; y: number; w: number; h: number; // tile rect, blocked in the grid
  enterable?: boolean;      // if set, the footprint is hollowed to a walkable room
  door?: { x: number; y: number }; // the threshold tile carved through the front wall
}
// The tavern and one hut are hollow — you walk in. The rest stay solid. Enterable
// footprints are enlarged so there's a real room inside once the 1-tile walls are
// subtracted (a 2×2 hut has no interior). None may overlap a TOWN POI tile or the
// gate column (7), or the smoke suite's plaza pathing silently breaks.
export const TOWN_BUILDINGS: TownBuilding[] = [
  { kind: "hut", name: "Senna's Hut", x: 2, y: 1, w: 4, h: 3, enterable: true, door: { x: 3, y: 3 } },
  { kind: "house", name: "Edric's House", x: 9, y: 1, w: 3, h: 2 },
  { kind: "well", name: "The Old Well", x: 13, y: 4, w: 1, h: 1 },
  { kind: "smithy", name: "The Smithy", x: 16, y: 1, w: 4, h: 3 },
  { kind: "tavern", name: "The Crooked Lantern", x: 21, y: 1, w: 6, h: 4, enterable: true, door: { x: 24, y: 4 } },
  { kind: "hut", name: "Pip's Shack", x: 25, y: 7, w: 2, h: 2 },
];
export const TOWN_BOUNDARY_Y = TOWN_ROWS * TILE;
export function isInTown(y: number): boolean {
  return y < TOWN_BOUNDARY_Y;
}
export const TOWN_INTERACT_RANGE = 80;

// Every act's town is the same plaza, but it should never LOOK the same. Each land has
// its own building material, palette, ground, and crowd — Hollowmere's rain-blacked timber,
// Zerath's sun-bleached adobe, Mirefall's moss-slick stilts, the Last Vigil's ash-choked
// stone. The client reads these to dress the identical footprint as four different places.
export type TownMaterial = "timber" | "adobe" | "stilt" | "stone";
export interface TownStyle {
  name: string;         // the land's own word for "home"
  tavernName: string;   // painted on the tavern's sign
  material: TownMaterial;
  ground: number;       // plaza floor
  groundAlt: number;    // the checker that keeps it from reading flat
  wallL: number;        // building faces, lit and shadowed
  wallR: number;
  roof: number;
  roofRidge: number;    // the darker line along the roof's spine
  timber: number;       // framing / seams
  accent: number;       // banners, door-frames, trim
  window: number;       // the warm light behind shutters
  smoke: number;        // chimney smoke / haze
  haze: number;         // a faint town-wide tint (dusk, dust, ash, damp)
  hazeAlpha: number;
  crowd: number;        // villager-density multiplier — some towns cling to life harder
  cobbles: boolean;     // laid stone underfoot vs bare earth/sand
}
export const TOWN_STYLES: TownStyle[] = [
  { // Act I — HOLLOWMERE: a rain-soaked timber hamlet at the forest's grieving edge
    name: "Hollowmere", tavernName: "THE CROOKED LANTERN", material: "timber",
    ground: 0x3a3428, groundAlt: 0x332e24, wallL: 0x4a3826, wallR: 0x3a2c1e,
    roof: 0x5c3226, roofRidge: 0x2c1810, timber: 0x241c12, accent: 0x7a5a2e,
    window: 0xffb84a, smoke: 0x8a8a92, haze: 0x2a3038, hazeAlpha: 0.05,
    crowd: 1.0, cobbles: true,
  },
  { // Act II — ZERATH OASIS: sun-bleached adobe and canvas around a failing well
    name: "Zerath Oasis", tavernName: "THE DRY WELL", material: "adobe",
    ground: 0x6a5a3c, groundAlt: 0x60502f, wallL: 0xa88a52, wallR: 0x7e623a,
    roof: 0x8a6a3a, roofRidge: 0x5a4022, timber: 0x4a3418, accent: 0xc89a4a,
    window: 0xffcf6a, smoke: 0xcabfa0, haze: 0xd8b060, hazeAlpha: 0.08,
    crowd: 0.85, cobbles: false,
  },
  { // Act III — MIREFALL LANDING: stilt shacks over black water, green with rot
    name: "Mirefall Landing", tavernName: "THE STILT & LANTERN", material: "stilt",
    ground: 0x2e3a30, groundAlt: 0x26322a, wallL: 0x4a4a34, wallR: 0x36361f,
    roof: 0x3e4a2c, roofRidge: 0x202a16, timber: 0x1c2414, accent: 0x6a7a3a,
    window: 0xd8e060, smoke: 0x7a8a72, haze: 0x2c4038, hazeAlpha: 0.10,
    crowd: 0.7, cobbles: false,
  },
  { // Act IV — THE LAST VIGIL: a besieged stone keep under falling ash, half in ruin
    name: "The Last Vigil", tavernName: "THE LAST POUR", material: "stone",
    ground: 0x33313a, groundAlt: 0x2b2a32, wallL: 0x4c4a54, wallR: 0x36343d,
    roof: 0x3a2c30, roofRidge: 0x1e1618, timber: 0x24222a, accent: 0x8a3a34,
    window: 0xff7a4a, smoke: 0x6a6068, haze: 0x40383a, hazeAlpha: 0.12,
    crowd: 0.55, cobbles: true,
  },
];
export function townStyle(act: number): TownStyle {
  return TOWN_STYLES[Math.min(Math.max(act, 1), TOWN_STYLES.length) - 1];
}

export const PORTAL_CAST_MS = 2000;
export const PORTAL_RETURN_MS = 800;

// the town: plaza, buildings — and, on the surface only, the gate through the south wall.
// Below ground the strip is a sealed camp: reachable by town portal, never on foot.
function carveTownPlaza(grid: string[][], gate = true) {
  for (let ty = TOWN_PLAZA.y0; ty <= TOWN_PLAZA.y1; ty++)
    for (let tx = TOWN_PLAZA.x0; tx <= TOWN_PLAZA.x1; tx++) grid[ty][tx] = ".";
  for (const b of TOWN_BUILDINGS) {
    for (let ty = b.y; ty < b.y + b.h; ty++)
      for (let tx = b.x; tx < b.x + b.w; tx++) {
        // enterable buildings keep only their perimeter as wall; the inside is floor
        const perimeter = tx === b.x || tx === b.x + b.w - 1 || ty === b.y || ty === b.y + b.h - 1;
        grid[ty][tx] = b.enterable && !perimeter ? "." : "#";
      }
    if (b.enterable && b.door) grid[b.door.y][b.door.x] = "."; // the threshold, cut through the wall
  }
  if (!gate) return;
  for (let ty = TOWN_PLAZA.y1 + 1; ty <= TOWN_ROWS + 1; ty++) grid[ty][TOWN_GATE_TX] = ".";
}

export function generateDungeon(act: number, floor: number, seed: number): DungeonLayout {
  // every act has a world above — except the Abyss, which is all below
  if (floor === 1 && act < ABYSS_ACT) {
    return (SURFACE_GENERATORS[act - 1] ?? generateForest)(seed);
  }

  const danger = dangerFor(act, floor);
  const rng = mulberry32(seed + danger * 7919);
  const grid: string[][] = Array.from({ length: GRID_H }, () => Array(DUNGEON_W).fill("#"));

  const carve = (tx: number, ty: number) => {
    if (tx >= 1 && ty >= 1 && tx < DUNGEON_W - 1 && ty < GRID_H - 1) grid[ty][tx] = ".";
  };

  // the camp above: same strip, but sealed — no walking into town from the deep
  carveTownPlaza(grid, false);

  interface Rm { x: number; y: number; w: number; h: number; cx: number; cy: number }
  const rooms: Rm[] = [];

  // every floor is built differently: halls, warrens, grand vaults, caverns — or rings
  const style = (danger - 1) % 5;

  if (style === 4) {
    // RINGS: concentric circles of corridor joined by four spokes — a sealed
    // arena of a floor, corridors that always curve away from your torchlight
    const ccx = Math.floor(DUNGEON_W / 2);
    const ccy = TOWN_ROWS + 2 + Math.floor(DUNGEON_H / 2);
    const radii = [4.5, 8.5, 12.5, 16.5];
    for (let ty = TOWN_ROWS + 2; ty < GRID_H - 1; ty++) {
      for (let tx = 1; tx < DUNGEON_W - 1; tx++) {
        const d = Math.hypot(tx - ccx, ty - ccy);
        if (radii.some((r) => Math.abs(d - r) < 1.1)) carve(tx, ty);
      }
    }
    // spokes at the cardinals stitch the rings together
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let i = 0; i <= 17; i++) carve(ccx + dx * i, ccy + dy * i);
    }
    // the heart, and eight chambers where spokes meet rings
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) carve(ccx + dx, ccy + dy);
    rooms.push({ x: ccx - 1, y: ccy - 1, w: 3, h: 3, cx: ccx, cy: ccy });
    for (const r of [8, 15]) { // chambers stay inside carvable bounds — the outer arc may clip, they may not
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const tx = Math.round(ccx + dx * r);
        const ty = Math.round(ccy + dy * r);
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) carve(tx + ox, ty + oy);
        rooms.push({ x: tx - 1, y: ty - 1, w: 3, h: 3, cx: tx, cy: ty });
      }
    }
  } else if (style === 3) {
    // CAVERN: a drunkard's walk gnaws organic tunnels out of the rock
    let wx = Math.floor(DUNGEON_W / 2);
    let wy = TOWN_ROWS + 2 + Math.floor(DUNGEON_H / 2);
    for (let step = 0; step < 2600; step++) {
      carve(wx, wy);
      if (rng() < 0.3) carve(wx + 1, wy); // widen unevenly
      const dir = Math.floor(rng() * 4);
      wx = Math.max(2, Math.min(DUNGEON_W - 3, wx + [1, -1, 0, 0][dir]));
      wy = Math.max(TOWN_ROWS + 2, Math.min(GRID_H - 3, wy + [0, 0, 1, -1][dir]));
    }
    // pockets: guaranteed-standable clearings that act as the floor's "rooms"
    for (let i = 0; i < 7; i++) {
      const tx = 3 + Math.floor(rng() * (DUNGEON_W - 6));
      const ty = TOWN_ROWS + 3 + Math.floor(rng() * (DUNGEON_H - 6));
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) carve(tx + dx, ty + dy);
      rooms.push({ x: tx - 1, y: ty - 1, w: 3, h: 3, cx: tx, cy: ty });
    }
  } else {
    // room-and-corridor, tuned per style
    const params = [
      { target: 7, min: 5, span: 5, corridor: 2 }, // classic halls
      { target: 12, min: 3, span: 3, corridor: 1 }, // warrens: cramped, mazey
      { target: 4, min: 9, span: 6, corridor: 3 }, // grand vaults: cathedral scale
    ][style];
    for (let tries = 0; tries < 90 && rooms.length < params.target; tries++) {
      const w = params.min + Math.floor(rng() * params.span);
      const h = params.min + Math.floor(rng() * params.span);
      const x = 1 + Math.floor(rng() * (DUNGEON_W - w - 2));
      const y = TOWN_ROWS + 2 + Math.floor(rng() * (DUNGEON_H - h - 3));
      const overlaps = rooms.some(
        (r) => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y
      );
      if (overlaps) continue;
      for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) carve(tx, ty);
      rooms.push({ x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) });
    }
  }

  // connect consecutive rooms/pockets with L corridors (width by style)
  const cw = style === 3 ? 1 : [2, 1, 3][style];
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1];
    const b = rooms[i];
    for (let tx = Math.min(a.cx, b.cx); tx <= Math.max(a.cx, b.cx); tx++) {
      for (let w = 0; w < cw; w++) carve(tx, a.cy + w);
    }
    for (let ty = Math.min(a.cy, b.cy); ty <= Math.max(a.cy, b.cy); ty++) {
      for (let w = 0; w < cw; w++) carve(b.cx + w, ty);
    }
  }


  const world = (tx: number, ty: number) => ({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE });

  const spawnRoom = rooms[0];
  let stairsRoom = rooms[rooms.length - 1];
  let bestD = -1;
  for (const r of rooms) {
    const d = Math.hypot(r.cx - spawnRoom.cx, r.cy - spawnRoom.cy);
    if (d > bestD) {
      bestD = d;
      stairsRoom = r;
    }
  }

  // stairs sit OFF room center so corridors (which pass through centers)
  // don't walk the party onto them by accident; boss guards the center
  const sx = Math.min(stairsRoom.x + stairsRoom.w - 2, stairsRoom.cx + 2);
  const sy = Math.min(stairsRoom.y + stairsRoom.h - 2, stairsRoom.cy + 2);

  const camps = rooms
    .filter((r) => r !== spawnRoom && r !== stairsRoom)
    .map((r) => world(r.cx, r.cy));

  // corner spot inside a room, clamped to its interior
  const cornerSpot = (r: Rm) => {
    const tx = Math.max(r.x + 1, Math.min(r.x + r.w - 2, r.cx + (rng() < 0.5 ? -2 : 2)));
    const ty = Math.max(r.y + 1, Math.min(r.y + r.h - 2, r.cy + (rng() < 0.5 ? -2 : 2)));
    return world(tx, ty);
  };

  // 1-2 shrines tucked into corners of non-spawn rooms
  const shrines: Array<{ x: number; y: number }> = [];
  const shrineRooms = rooms.filter((r) => r !== spawnRoom);
  const shrineCount = Math.min(shrineRooms.length, 1 + (rng() < 0.5 ? 1 : 0));
  for (let i = 0; i < shrineCount; i++) {
    const idx = Math.floor(rng() * shrineRooms.length);
    shrines.push(cornerSpot(shrineRooms.splice(idx, 1)[0]));
  }

  // 1-3 chests anywhere but the spawn room
  const chests: Array<{ x: number; y: number }> = [];
  const chestRooms = rooms.filter((r) => r !== spawnRoom);
  const chestCount = Math.min(chestRooms.length, 1 + Math.floor(rng() * 3));
  for (let i = 0; i < chestCount; i++) {
    const idx = Math.floor(rng() * chestRooms.length);
    chests.push(cornerSpot(chestRooms.splice(idx, 1)[0]));
  }

  // sometimes, a tome of forgotten lore
  let tome: { x: number; y: number } | null = null;
  if (rng() < 0.5 && rooms.length > 1) {
    const r = rooms[1 + Math.floor(rng() * (rooms.length - 1))];
    tome = cornerSpot(r);
  }

  // floors 3, 5, and 7 hide a waypoint (the Abyss: every third floor) —
  // with the deep camps sealed, the network is how you get home
  let waypoint: { x: number; y: number } | null = null;
  const wantWaypoint = act >= ABYSS_ACT ? floor % 3 === 0 : floor === 3 || floor === 5 || floor === 7;
  if (wantWaypoint) {
    const wpRooms = rooms.filter((r) => r !== spawnRoom);
    const r = wpRooms.length ? wpRooms[Math.floor(rng() * wpRooms.length)] : spawnRoom;
    waypoint = cornerSpot(r);
  }

  return {
    rows: grid.map((row) => row.join("")),
    spawn: world(spawnRoom.cx, spawnRoom.cy),
    stairs: world(sx, sy),
    camps,
    boss: world(stairsRoom.cx, stairsRoom.cy),
    shrines,
    chests,
    tome,
    waypoint,
    cathedral: null,
    areas: [],
    portals: [],
  };
}

// --- floor 1: the forest above the labyrinth ---
// A large open wood outside the town gate, with places worth leaving the trail
// for: a two-story watchtower, dark little caves — and, at the end, the stone
// cathedral whose stairs begin the real delve.

const FOREST_W = 48;
const FOREST_H = 70;

export interface SurfaceOpts {
  scatter: number; // chance a field tile grows an obstacle (trees, rocks, roots, slag)
  pair: number; // chance the obstacle brings a neighbor
  tower: boolean; // act 1 keeps its watchtower; the other lands have their own troubles
  caveLabel: string;
  caveExitLabel: string;
}

export function generateForest(seed: number): DungeonLayout {
  return generateSurface(seed, { scatter: 0.13, pair: 0.4, tower: true, caveLabel: "A dark cave", caveExitLabel: "Back to daylight" });
}
export function generateDesert(seed: number): DungeonLayout {
  return generateSurface(seed, { scatter: 0.055, pair: 0.25, tower: false, caveLabel: "A sunken tomb", caveExitLabel: "Back to the sun" });
}
export function generateJungle(seed: number): DungeonLayout {
  return generateSurface(seed, { scatter: 0.19, pair: 0.5, tower: false, caveLabel: "A flooded ruin", caveExitLabel: "Back to the canopy" });
}
export function generateHellscape(seed: number): DungeonLayout {
  return generateSurface(seed, { scatter: 0.09, pair: 0.3, tower: false, caveLabel: "A burning fissure", caveExitLabel: "Out of the fire" });
}
export const SURFACE_GENERATORS = [generateForest, generateDesert, generateJungle, generateHellscape];

function generateSurface(seed: number, opts: SurfaceOpts): DungeonLayout {
  const rng = mulberry32(seed + 7919);
  const grid: string[][] = Array.from({ length: FOREST_H }, () => Array(FOREST_W).fill("#"));
  carveTownPlaza(grid);

  const top = TOWN_ROWS + 1;
  const fieldBottom = 49; // rows below are the walled-off interiors (reached by portals)
  for (let ty = top; ty <= fieldBottom; ty++)
    for (let tx = 1; tx <= FOREST_W - 2; tx++) grid[ty][tx] = ".";

  const world = (tx: number, ty: number) => ({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE });
  const areas: AreaRect[] = [];
  const portals: AreaPortal[] = [];

  // the cathedral: a stone shell in the deep wood, doors facing north
  const CW = 11;
  const CH = 7;
  const cx0 = FOREST_W - 2 - CW;
  const cy0 = fieldBottom + 1 - CH;
  for (let ty = cy0; ty < cy0 + CH; ty++)
    for (let tx = cx0; tx < cx0 + CW; tx++)
      grid[ty][tx] = ty === cy0 || ty === cy0 + CH - 1 || tx === cx0 || tx === cx0 + CW - 1 ? "#" : ".";
  const doorX = cx0 + Math.floor(CW / 2);
  grid[cy0][doorX - 1] = ".";
  grid[cy0][doorX] = "."; // a two-tile doorway

  // protected ground: a winding trail from the gate to the doors, plus the door apron
  const protect = new Set<string>();
  const mark = (tx: number, ty: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) protect.add(`${tx + dx},${ty + dy}`);
  };
  const steps = 34;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = Math.round(TOWN_GATE_TX + (doorX - TOWN_GATE_TX) * t + Math.sin(t * Math.PI * 2.3) * 4);
    const py = Math.round(top + 1 + (cy0 - 2 - top) * t);
    mark(px, py, 1);
  }
  for (let ty = cy0 - 3; ty <= cy0; ty++) for (let tx = doorX - 3; tx <= doorX + 2; tx++) protect.add(`${tx},${ty}`);
  mark(TOWN_GATE_TX, top + 1, 2); // breathing room just outside the gate

  // the watchtower: a stone footprint in the wood, kept OFF the trail so the
  // way to the cathedral survives whatever the forest grows
  let twX = 0;
  let twY = 0;
  if (opts.tower) {
    let placed = false;
    for (let tries = 0; tries < 200 && !placed; tries++) {
      const x = 6 + Math.floor(rng() * (FOREST_W - 16));
      const y = top + 6 + Math.floor(rng() * (fieldBottom - top - 18));
      let clear = true;
      for (let dy = -2; dy <= 5 && clear; dy++)
        for (let dx = -2; dx <= 6 && clear; dx++)
          if (protect.has(`${x + dx},${y + dy}`)) clear = false;
      if (x + 6 >= cx0 - 1 && y + 6 >= cy0 - 4) clear = false; // stay off the cathedral grounds
      if (!clear) continue;
      twX = x;
      twY = y;
      placed = true;
    }
    if (!placed) {
      twX = 30;
      twY = top + 3; // deterministic fallback, far east of the trail's start
    }
    for (let ty = twY; ty < twY + 4; ty++)
      for (let tx = twX; tx < twX + 5; tx++) grid[ty][tx] = "#";
    // no trees hugging the tower anywhere — the ring around it must always be walkable
    for (let dy = -1; dy <= 5; dy++) for (let dx = -1; dx <= 5; dx++) protect.add(`${twX + dx},${twY + dy}`);
    areas.push({ kind: "towerbase", x: twX, y: twY, w: 5, h: 4 });
  }

  // the wood itself: clumped trees wherever the trail doesn't run
  const nearCathedral = (tx: number, ty: number) => ty >= cy0 - 1 && tx >= cx0 - 1;
  for (let ty = top; ty <= fieldBottom; ty++) {
    for (let tx = 1; tx <= FOREST_W - 2; tx++) {
      if (grid[ty][tx] !== "." || protect.has(`${tx},${ty}`) || nearCathedral(tx, ty)) continue;
      if (rng() < opts.scatter) {
        grid[ty][tx] = "#";
        const nx = tx + 1;
        if (rng() < opts.pair && nx <= FOREST_W - 2 && grid[ty][nx] === "." && !protect.has(`${nx},${ty}`) && !nearCathedral(nx, ty)) {
          grid[ty][nx] = "#";
        }
      }
    }
  }

  // --- the interiors: rooms below the world, reached only by portals ---
  const camps: Array<{ x: number; y: number }> = [];
  const chests: Array<{ x: number; y: number }> = [];
  const shrines: Array<{ x: number; y: number }> = [];

  const carveRoom = (rx: number, ry: number, rw: number, rh: number) => {
    for (let ty = ry + 1; ty < ry + rh - 1; ty++)
      for (let tx = rx + 1; tx < rx + rw - 1; tx++) grid[ty][tx] = ".";
  };

  // watchtower floors: two stone stories (act 1 only)
  if (opts.tower) {
    const T1 = { x: 2, y: 52, w: 11, h: 9 };
    const T2 = { x: 15, y: 52, w: 11, h: 9 };
    carveRoom(T1.x, T1.y, T1.w, T1.h);
    carveRoom(T2.x, T2.y, T2.w, T2.h);
    areas.push({ kind: "tower", ...T1 }, { kind: "tower", ...T2 });
    const t1Entry = world(T1.x + 4, T1.y + 6);
    const t2Entry = world(T2.x + 5, T2.y + 6);
    const towerDoor = world(twX + 2, twY + 4); // just outside the south face
    portals.push(
      { ...towerDoor, tx: t1Entry.x, ty: t1Entry.y, label: "The Watchtower", variant: "towerdoor" },
      { ...world(T1.x + 6, T1.y + 6), tx: towerDoor.x, ty: towerDoor.y, label: "Leave the tower", variant: "towerexit" },
      { ...world(T1.x + 8, T1.y + 2), tx: t2Entry.x, ty: t2Entry.y, label: "Stairs up", variant: "stairsup" },
      { ...world(T2.x + 8, T2.y + 6), tx: (T1.x + 7 + 0.5) * TILE, ty: (T1.y + 2 + 0.5) * TILE, label: "Stairs down", variant: "stairsdown" }
    );
    camps.push(world(T1.x + 3, T1.y + 3)); // something moved in downstairs
    camps.push(world(T2.x + 5, T2.y + 3)); // and worse lives above…
    chests.push(world(T2.x + 2, T2.y + 2)); // …guarding the tower's cache
  }

  // caves: 2-3 dank little pockets, drunkard-carved
  const caveSlots = [
    { x: 28, y: 52, w: 9, h: 8 },
    { x: 38, y: 52, w: 9, h: 8 },
    { x: 28, y: 61, w: 9, h: 8 },
  ];
  const nCaves = 2 + (rng() < 0.5 ? 1 : 0);
  const caveEntries: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < nCaves; i++) {
    const c = caveSlots[i];
    areas.push({ kind: "cave", ...c });
    // organic pocket: walk from the center, never touching the border
    let wx = c.x + Math.floor(c.w / 2);
    let wy = c.y + Math.floor(c.h / 2);
    const cCx = wx;
    const cCy = wy;
    for (let step = 0; step < 60; step++) {
      grid[wy][wx] = ".";
      const dir = Math.floor(rng() * 4);
      wx = Math.max(c.x + 1, Math.min(c.x + c.w - 2, wx + [1, -1, 0, 0][dir]));
      wy = Math.max(c.y + 1, Math.min(c.y + c.h - 2, wy + [0, 0, 1, -1][dir]));
    }
    // a guaranteed standable heart, connected to the entry
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) grid[cCy + dy][cCx + dx] = ".";
    const entry = { tx: cCx, ty: c.y + c.h - 2 };
    for (let ty = entry.ty; ty >= cCy; ty--) grid[ty][cCx] = "."; // entry shaft to the heart
    caveEntries.push(world(entry.tx, entry.ty));
    camps.push(world(cCx, cCy)); // something lairs here
    if (rng() < 0.6) chests.push(world(cCx + (rng() < 0.5 ? -1 : 1), cCy - 1));
    if (rng() < 0.35) shrines.push(world(cCx + (rng() < 0.5 ? -1 : 1), cCy + 1));
  }

  // everything in the FIELD is placed only on ground you can walk to from the gate
  const reach = new Uint8Array(FOREST_W * FOREST_H);
  const queue: Array<[number, number]> = [[TOWN_GATE_TX, top]];
  reach[top * FOREST_W + TOWN_GATE_TX] = 1;
  while (queue.length) {
    const [qx, qy] = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = qx + dx;
      const ny = qy + dy;
      if (nx < 1 || ny < top || nx > FOREST_W - 2 || ny > FOREST_H - 2) continue;
      const idx = ny * FOREST_W + nx;
      if (reach[idx] || grid[ny][nx] !== ".") continue;
      reach[idx] = 1;
      queue.push([nx, ny]);
    }
  }
  const reached: Array<[number, number]> = [];
  for (let ty = top + 2; ty <= cy0 - 2; ty++)
    for (let tx = 2; tx <= FOREST_W - 3; tx++)
      if (reach[ty * FOREST_W + tx]) reached.push([tx, ty]);

  // cave mouths: rocky doorways scattered off the trail
  const mouths: Array<[number, number]> = [];
  for (let i = 0; i < caveEntries.length; i++) {
    let mx = TOWN_GATE_TX;
    let my = top + 3;
    for (let tries = 0; tries < 300; tries++) {
      const [tx, ty] = reached[Math.floor(rng() * reached.length)];
      if (Math.hypot(tx - TOWN_GATE_TX, ty - top) < 8) continue;
      if (opts.tower && Math.hypot(tx - (twX + 2), ty - (twY + 4)) < 6) continue; // not on the tower's doorstep
      if (mouths.some(([ox, oy]) => Math.hypot(tx - ox, ty - oy) < 8)) continue;
      mx = tx;
      my = ty;
      break;
    }
    mouths.push([mx, my]);
    const mouth = world(mx, my);
    portals.push(
      { ...mouth, tx: caveEntries[i].x, ty: caveEntries[i].y, label: opts.caveLabel, variant: "cavemouth" },
      { ...caveEntries[i], tx: mouth.x, ty: mouth.y, label: opts.caveExitLabel, variant: "caveexit" }
    );
  }

  // monster camps: clearings stamped into the reachable wood
  const campTiles: Array<[number, number]> = [];
  for (let tries = 0; tries < 400 && campTiles.length < 7; tries++) {
    const [tx, ty] = reached[Math.floor(rng() * reached.length)];
    if (Math.hypot(tx - TOWN_GATE_TX, ty - top) < 7) continue; // not on the town's doorstep
    if (campTiles.some(([ox, oy]) => Math.hypot(tx - ox, ty - oy) < 7)) continue;
    if (mouths.some(([ox, oy]) => Math.hypot(tx - ox, ty - oy) < 3)) continue;
    campTiles.push([tx, ty]);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx >= 1 && nx <= FOREST_W - 2 && ny >= top && ny <= fieldBottom && !nearCathedral(nx, ny)) grid[ny][nx] = ".";
      }
    camps.push(world(tx, ty));
  }

  const pickReached = () => {
    const [tx, ty] = reached[Math.floor(rng() * reached.length)];
    return world(tx, ty);
  };
  shrines.push(pickReached(), pickReached());
  chests.push(pickReached(), pickReached());
  const tome = rng() < 0.5 ? pickReached() : null;

  return {
    rows: grid.map((row) => row.join("")),
    spawn: world(TOWN_GATE_TX, top + 1),
    stairs: world(cx0 + Math.floor(CW / 2), cy0 + 3),
    camps,
    boss: world(doorX, cy0 - 2), // the guardian prowls before the cathedral doors
    shrines,
    chests,
    tome,
    waypoint: null,
    cathedral: { x: cx0, y: cy0, w: CW, h: CH },
    areas,
    portals,
  };
}

// descending is a CHOICE: click the stairs like an item, walk over, and use them.
// (Standing on them does nothing — no more accidental descents mid-boss-fight.)
export const STAIRS_USE_RANGE = 60;
export const STAIRS_TRIGGER_RANGE = 26; // legacy proximity radius, kept for reference

// --- floor themes & zones (D1-style depth bands) ---

export interface FloorTheme {
  id: string;
  floorA: number;
  floorB: number;
  stroke: number;
  wallTop: number;
  wallLeft: number;
  wallRight: number;
  accent: number;
  zoneNames: string[];
}

export const FLOOR_THEMES: FloorTheme[] = [
  {
    id: "cathedral",
    floorA: 0x23232c, floorB: 0x26262f, stroke: 0x30303c,
    wallTop: 0x3d3d4c, wallLeft: 0x2a2a36, wallRight: 0x1d1d25,
    accent: 0x8a8ab0,
    zoneNames: ["The Desecrated Chapel", "Halls of the Faithful", "The Silent Cloister"],
  },
  {
    id: "catacombs",
    floorA: 0x1f2a22, floorB: 0x222e25, stroke: 0x2e3d30,
    wallTop: 0x37493a, wallLeft: 0x263329, wallRight: 0x1a231c,
    accent: 0x6fae7c,
    zoneNames: ["The Festering Warrens", "Bonegrinder Crypts", "The Weeping Ossuary"],
  },
  {
    id: "caves",
    floorA: 0x2c231a, floorB: 0x2f261c, stroke: 0x3d3226,
    wallTop: 0x4a3c2b, wallLeft: 0x33291d, wallRight: 0x241c14,
    accent: 0xc08a4a,
    zoneNames: ["The Maggot Burrows", "Chasm of Echoes", "The Sunless Deep"],
  },
  {
    id: "hell",
    floorA: 0x2a1616, floorB: 0x2e1818, stroke: 0x3d2020,
    wallTop: 0x4a2424, wallLeft: 0x331818, wallRight: 0x241010,
    accent: 0xe05840,
    zoneNames: ["The Burning Threshold", "Fields of Despair", "The Throne of Flame"],
  },
  {
    id: "frozen",
    floorA: 0x1a2430, floorB: 0x1d2835, stroke: 0x2a3a4a,
    wallTop: 0x3a5468, wallLeft: 0x263846, wallRight: 0x18242e,
    accent: 0x8ad0ff,
    zoneNames: ["The Frozen Tundra", "Halls of Winter", "The Glacial Rift"],
  },
  {
    id: "sanguine",
    floorA: 0x261420, floorB: 0x2a1624, stroke: 0x3a1e30,
    wallTop: 0x4c2440, wallLeft: 0x341a2c, wallRight: 0x22101c,
    accent: 0xd84a7a,
    zoneNames: ["The Sanguine Chapel", "Veins of the Deep", "The Bleeding Vault"],
  },
  {
    id: "swamp",
    floorA: 0x1c2620, floorB: 0x1e2a22, stroke: 0x2a3a2e,
    wallTop: 0x364a3c, wallLeft: 0x24342a, wallRight: 0x18241c,
    accent: 0x7fae5f,
    zoneNames: ["The Drowned Fen", "Rotting Hollows", "The Mire of Souls"],
  },
  {
    id: "void",
    floorA: 0x181428, floorB: 0x1a162c, stroke: 0x261e3e,
    wallTop: 0x362a58, wallLeft: 0x261e42, wallRight: 0x161028,
    accent: 0xa878e8,
    zoneNames: ["The Starless Gulf", "Echoes of Nothing", "The Umbral Court"],
  },
  {
    id: "abyss",
    floorA: 0x120e16, floorB: 0x14101a, stroke: 0x201826,
    wallTop: 0x2c2036, wallLeft: 0x1e1626, wallRight: 0x120c18,
    accent: 0xb03858,
    zoneNames: ["The Abyssal Stair", "Where Light Forgets", "The Last Cartography"],
  },
  {
    id: "forest",
    floorA: 0x1c2618, floorB: 0x1f2a1a, stroke: 0x2a3824,
    wallTop: 0x2e4426, wallLeft: 0x22331c, wallRight: 0x182412,
    accent: 0x7fc860,
    zoneNames: ["The Mournfield", "The Blackbough", "The Forgotten Glade"],
  },
  {
    id: "sunscar", // act 2 surface: hardpan, dead scrub, vulture light
    floorA: 0x3e3522, floorB: 0x423824, stroke: 0x4e422a,
    wallTop: 0x5e4e32, wallLeft: 0x463a26, wallRight: 0x32291a,
    accent: 0xe8c87a,
    zoneNames: ["The Sunscar Wastes", "The Vulture Roads", "The Glass Flats"],
  },
  {
    id: "tombs", // act 2 depths: dry sandstone, dust, old kings
    floorA: 0x2e2618, floorB: 0x322a1a, stroke: 0x403622,
    wallTop: 0x564830, wallLeft: 0x3a3020, wallRight: 0x282010,
    accent: 0xd8a850,
    zoneNames: ["The Sunken Necropolis", "Halls of the Embalmed", "The Dust-Choked Deep"],
  },
  {
    id: "jungle", // act 3 surface: strangler green, river light
    floorA: 0x18301c, floorB: 0x1a341e, stroke: 0x244426,
    wallTop: 0x2e5430, wallLeft: 0x223e24, wallRight: 0x162c18,
    accent: 0x60d888,
    zoneNames: ["The Drowned Green", "The Strangler Paths", "The Weeping Canopy"],
  },
  {
    id: "ziggurat", // act 3 depths: flooded mossy stone
    floorA: 0x1a2a28, floorB: 0x1c2e2c, stroke: 0x28403c,
    wallTop: 0x36544e, wallLeft: 0x263e3a, wallRight: 0x182a28,
    accent: 0x50c8b0,
    zoneNames: ["The Ziggurat of Ssarim", "The Flooded Steps", "The Silt Throne"],
  },
  {
    id: "ashland", // act 4 surface: cinder, char, the breach
    floorA: 0x241a16, floorB: 0x281c18, stroke: 0x362520,
    wallTop: 0x44302a, wallLeft: 0x30221e, wallRight: 0x201614,
    accent: 0xe86840,
    zoneNames: ["The Hollow Throne", "The Ashfall Road", "The Last Vigil's Shadow"],
  },
];
export const FOREST_THEME_INDEX = 9; // pinned — new act palettes append after the forest

// progression BANDS (bosses, lore, difficulty flavor) stay in fours…
export function themeIndexForFloor(floor: number): number {
  return Math.min(3, Math.floor((floor - 1) / 3));
}

// …but every floor LOOKS different: the surface is forest, then palettes cycle
export function visualThemeIndexForFloor(floor: number): number {
  if (floor <= 1) return FOREST_THEME_INDEX; // the world above
  const ORDER = [0, 1, 4, 2, 6, 5, 3, 8, 7]; // cathedral → catacombs → frozen → caves → swamp → sanguine → hell → ABYSS → void
  return ORDER[(floor - 2) % ORDER.length];
}

export function zoneNameFor(act: number, floor: number, rng: () => number = Math.random): string {
  const t = FLOOR_THEMES[visualThemeFor(act, floor)];
  return t.zoneNames[Math.floor(rng() * t.zoneNames.length)];
}

// --- shrines ---

export const SHRINE_KINDS = [
  { id: "healing", label: "Shrine of Healing", msg: "You feel renewed" },
  { id: "mana", label: "Shrine of Mana", msg: "Your mind clears" },
  { id: "blessed", label: "Blessed Shrine", msg: "Righteous fury fills you" },
  { id: "fortune", label: "Shrine of Fortune", msg: "Fortune smiles upon you" },
  { id: "swift", label: "Shrine of Haste", msg: "Your feet feel light" },
  { id: "knowledge", label: "Shrine of Knowledge", msg: "Ancient secrets flood your mind" },
] as const;
export type ShrineKind = (typeof SHRINE_KINDS)[number]["id"];

export const SHRINE_TOUCH_RANGE = 52;
export const SHRINE_DMG_MULT = 1.4;
export const SHRINE_DMG_MS = 30000;
export const SHRINE_MF_BONUS = 50;
export const SHRINE_MF_MS = 60000;
export const SHRINE_SPEED_BONUS = 0.25;
export const SHRINE_SPEED_MS = 30000;
export const SHRINE_XP_BASE = 40; // × floor

// --- classes & combat ---

export const CLASSES = ["barbarian", "rogue", "sorcerer", "paladin", "necromancer", "druid"] as const;
export type ClassName = (typeof CLASSES)[number];

export interface MeleeAttack {
  type: "melee";
  range: number;
  arcDeg: number;
  dmg: [number, number];
  cooldownMs: number;
}
export interface ProjectileAttack {
  type: "projectile";
  kind: "arrow" | "fireball" | "bone" | "thorn";
  speed: number;
  radius: number;
  splash?: number;
  dmg: [number, number];
  cooldownMs: number;
}
export type Attack = MeleeAttack | ProjectileAttack;

export const CLASS_ATTACKS: Record<ClassName, Attack> = {
  barbarian: { type: "melee", range: 48, arcDeg: 110, dmg: [10, 16], cooldownMs: 500 },
  rogue: { type: "projectile", kind: "arrow", speed: 460, radius: 10, dmg: [7, 12], cooldownMs: 400 },
  sorcerer: { type: "projectile", kind: "fireball", speed: 300, radius: 12, splash: 56, dmg: [12, 20], cooldownMs: 700 },
  paladin: { type: "melee", range: 46, arcDeg: 100, dmg: [9, 15], cooldownMs: 520 },
  necromancer: { type: "projectile", kind: "bone", speed: 360, radius: 10, dmg: [8, 14], cooldownMs: 550 },
  druid: { type: "projectile", kind: "thorn", speed: 320, radius: 11, splash: 40, dmg: [9, 15], cooldownMs: 620 },
};

// which class a player projectile belongs to (for damage resolution)
export const PROJECTILE_CLASS: Record<string, ClassName> = {
  arrow: "rogue",
  icearrow: "rogue",
  fireball: "sorcerer",
  frostbolt: "sorcerer",
  bone: "necromancer",
  thorn: "druid",
  hammer: "paladin",
};

export const PLAYER_MAX_HP = 80;
export const PLAYER_REGEN_PER_S = 3;
export const REGEN_DELAY_MS = 4000;
export const PLAYER_RESPAWN_MS = 3000;
export const RESPAWN_IMMUNE_MS = 3000; // a breath of invulnerability on respawn — no spawn-camping
export const PROJECTILE_LIFETIME_MS = 1500;

export function rollDamage(range: [number, number]): number {
  return Math.round(range[0] + Math.random() * (range[1] - range[0]));
}

// --- experience ---

export const XP_SHARE_RANGE = 500;
// levels grant a little life on their own — the real gains come from Vitality
export const HP_PER_LEVEL = 6;

export function xpForNext(level: number): number {
  return Math.round(60 * Math.pow(level, 1.7));
}

// --- resistances & elemental damage ---

export type Element = "fire" | "cold" | "light";
export const RES_CAP = 75;
export const MONSTER_ELEMENT_FRACTION = 0.5; // elemental attackers deal half their damage as their element
export const PLAYER_CHILL_MS = 1800;
export const PLAYER_CHILL_FACTOR = 0.65;

// which element (if any) each monster kind fights with
export const MONSTER_ELEMENTS: Partial<Record<string, Element>> = {
  demon: "fire",
  cultist: "light",
  wraith: "cold",
  succubus: "fire",
  hellion: "fire",
  flenser: "fire",
  malgrim: "fire",
  corvessa: "cold",
  vessira: "fire",
  vuruk: "cold", // the holy freeze — his hits chill
  orvath: "light",
  aldric: "cold",
  uldrath: "fire",
  nyzat: "fire",
  ssarim: "cold",
  bogwitch: "light",
  flamecaller: "fire",
};

export function resistOf(stats: ItemStats, element: Element): number {
  const key = `${element}Res` as keyof ItemStats;
  return Math.min(RES_CAP, (stats[key] ?? 0) + (stats.allRes ?? 0));
}

// what a monster shrugs off — the other side of the elements. Negative = a weakness (takes
// MORE of that element). Most kinds resist nothing; the thematic ones resist their own
// element and often hate the opposite, so "fire build vs cold build" finally matters, and
// penetration (which subtracts from these) becomes a real gearing goal against the immune.
export const MONSTER_RESIST: Partial<Record<string, Partial<Record<Element, number>>>> = {
  // born of fire: shrug it off, and hate the cold
  demon: { fire: 50, cold: -20 },
  imp: { fire: 40 },
  hellion: { fire: 60, cold: -20 },
  succubus: { fire: 40, light: 20 },
  flamecaller: { fire: 90 },
  ashfiend: { fire: 75, cold: -30 },
  flenser: { fire: 40 },
  doomguard: { fire: 45, light: 30 },
  // the cold-touched
  wraith: { cold: 60, light: 30 },
  entombed: { cold: 60, fire: -20 },
  riverfang: { cold: 50 },
  corvessa: { cold: 50 },
  // the arcane and the hexed
  cultist: { light: 50 },
  bogwitch: { light: 40, cold: 30 },
  gargoyle: { fire: 30, cold: 30, light: 30 },
  // act bosses guard against the elements — bring penetration, or bring the right one
  nyzat: { fire: 40, cold: 40, light: 40 },
  ssarim: { cold: 60, fire: 30 },
  malgrim: { fire: 60 },
  aldric: { cold: 55 },
  uldrath: { fire: 50, cold: 50, light: 50 },
};
export function monsterResistOf(kind: string, element: Element): number {
  return MONSTER_RESIST[kind]?.[element] ?? 0;
}

// death is not free: a share of your purse scatters at the corpse
export const DEATH_GOLD_FRACTION = 0.15;

// --- monsters & floor scaling ---

export const MONSTERS = {
  imp: {
    maxHp: 16, speed: 135, dmg: [3, 6] as [number, number],
    aggroRange: 240, attackRange: 26, cooldownMs: 700, radius: 7, xp: 10,
  },
  spineback: {
    maxHp: 14, speed: 90, dmg: [4, 7] as [number, number],
    aggroRange: 240, attackRange: 150, cooldownMs: 1500, radius: 7, xp: 12,
  },
  zombie: {
    maxHp: 30, speed: 75, dmg: [4, 8] as [number, number],
    aggroRange: 230, attackRange: 30, cooldownMs: 1000, radius: 9, xp: 14,
  },
  skeleton: {
    maxHp: 22, speed: 115, dmg: [5, 9] as [number, number],
    aggroRange: 250, attackRange: 28, cooldownMs: 800, radius: 8, xp: 16,
  },
  archer: {
    maxHp: 18, speed: 95, dmg: [6, 10] as [number, number],
    aggroRange: 260, attackRange: 190, cooldownMs: 1600, radius: 8, xp: 20,
  },
  demon: {
    maxHp: 60, speed: 90, dmg: [9, 15] as [number, number],
    aggroRange: 260, attackRange: 34, cooldownMs: 1100, radius: 12, xp: 30,
  },
  cultist: {
    maxHp: 26, speed: 85, dmg: [7, 11] as [number, number],
    aggroRange: 270, attackRange: 200, cooldownMs: 1800, radius: 8, xp: 24,
  },
  goatman: {
    maxHp: 44, speed: 125, dmg: [7, 12] as [number, number],
    aggroRange: 260, attackRange: 32, cooldownMs: 850, radius: 10, xp: 26,
  },
  wraith: {
    maxHp: 38, speed: 140, dmg: [8, 13] as [number, number],
    aggroRange: 280, attackRange: 30, cooldownMs: 900, radius: 9, xp: 32,
  },
  gargoyle: {
    maxHp: 95, speed: 70, dmg: [11, 18] as [number, number],
    aggroRange: 240, attackRange: 36, cooldownMs: 1300, radius: 13, xp: 40,
  },
  succubus: {
    maxHp: 42, speed: 100, dmg: [9, 14] as [number, number],
    aggroRange: 280, attackRange: 210, cooldownMs: 1600, radius: 9, xp: 38,
  },
  hellion: {
    maxHp: 130, speed: 85, dmg: [14, 22] as [number, number],
    aggroRange: 270, attackRange: 38, cooldownMs: 1100, radius: 14, xp: 55,
  },
  flenser: {
    maxHp: 400, speed: 95, dmg: [12, 20] as [number, number],
    aggroRange: 260, attackRange: 40, cooldownMs: 900, radius: 16, xp: 150,
  },
  corvessa: {
    maxHp: 320, speed: 105, dmg: [10, 16] as [number, number],
    aggroRange: 300, attackRange: 220, cooldownMs: 1200, radius: 10, xp: 200,
  },
  maggotqueen: {
    maxHp: 550, speed: 60, dmg: [10, 18] as [number, number],
    aggroRange: 260, attackRange: 36, cooldownMs: 1200, radius: 18, xp: 260,
  },
  malgrim: {
    maxHp: 800, speed: 100, dmg: [18, 30] as [number, number],
    aggroRange: 300, attackRange: 44, cooldownMs: 900, radius: 18, xp: 400,
  },
  goblin: {
    maxHp: 70, speed: 150, dmg: [1, 2] as [number, number],
    aggroRange: 240, attackRange: 0, cooldownMs: 99999, radius: 8, xp: 40,
  },
  scarab: {
    maxHp: 18, speed: 148, dmg: [4, 7] as [number, number],
    aggroRange: 250, attackRange: 24, cooldownMs: 650, radius: 6, xp: 14,
  },
  sandserpent: {
    maxHp: 28, speed: 80, dmg: [6, 10] as [number, number],
    aggroRange: 260, attackRange: 170, cooldownMs: 1500, radius: 8, xp: 22,
  },
  entombed: {
    maxHp: 44, speed: 68, dmg: [7, 12] as [number, number],
    aggroRange: 240, attackRange: 30, cooldownMs: 1050, radius: 9, xp: 24,
  },
  duneprowler: {
    maxHp: 36, speed: 150, dmg: [7, 12] as [number, number],
    aggroRange: 290, attackRange: 30, cooldownMs: 800, radius: 9, xp: 28,
  },
  carrionbird: {
    maxHp: 16, speed: 165, dmg: [3, 6] as [number, number],
    aggroRange: 260, attackRange: 26, cooldownMs: 700, radius: 6, xp: 12,
  },
  nyzat: {
    maxHp: 800, speed: 88, dmg: [13, 22] as [number, number],
    aggroRange: 310, attackRange: 40, cooldownMs: 1000, radius: 16, xp: 400,
  },
  mudling: {
    maxHp: 15, speed: 140, dmg: [3, 6] as [number, number],
    aggroRange: 240, attackRange: 24, cooldownMs: 700, radius: 6, xp: 13,
  },
  blowreed: {
    maxHp: 24, speed: 90, dmg: [6, 10] as [number, number],
    aggroRange: 270, attackRange: 190, cooldownMs: 1600, radius: 7, xp: 24,
  },
  riverfang: {
    maxHp: 42, speed: 145, dmg: [8, 13] as [number, number],
    aggroRange: 290, attackRange: 32, cooldownMs: 900, radius: 10, xp: 30,
  },
  vinehorror: {
    maxHp: 85, speed: 62, dmg: [10, 16] as [number, number],
    aggroRange: 230, attackRange: 36, cooldownMs: 1300, radius: 12, xp: 38,
  },
  bogwitch: {
    maxHp: 34, speed: 82, dmg: [9, 14] as [number, number],
    aggroRange: 280, attackRange: 210, cooldownMs: 1700, radius: 8, xp: 34,
  },
  ashfiend: {
    maxHp: 48, speed: 120, dmg: [9, 15] as [number, number],
    aggroRange: 270, attackRange: 30, cooldownMs: 850, radius: 9, xp: 36,
  },
  doomguard: {
    maxHp: 120, speed: 78, dmg: [13, 20] as [number, number],
    aggroRange: 250, attackRange: 38, cooldownMs: 1200, radius: 13, xp: 52,
  },
  flamecaller: {
    maxHp: 40, speed: 85, dmg: [10, 16] as [number, number],
    aggroRange: 290, attackRange: 220, cooldownMs: 1700, radius: 8, xp: 42,
  },
  flayed: {
    maxHp: 22, speed: 158, dmg: [5, 9] as [number, number],
    aggroRange: 270, attackRange: 26, cooldownMs: 650, radius: 7, xp: 18,
  },
  ssarim: {
    maxHp: 850, speed: 85, dmg: [14, 24] as [number, number],
    aggroRange: 320, attackRange: 230, cooldownMs: 1400, radius: 16, xp: 430,
  },
  bovine: {
    maxHp: 48, speed: 105, dmg: [8, 14] as [number, number],
    aggroRange: 320, attackRange: 34, cooldownMs: 900, radius: 10, xp: 35,
  },
  vessira: {
    maxHp: 520, speed: 95, dmg: [11, 18] as [number, number],
    aggroRange: 300, attackRange: 38, cooldownMs: 1000, radius: 14, xp: 220,
  },
  vuruk: {
    maxHp: 700, speed: 115, dmg: [14, 24] as [number, number],
    aggroRange: 320, attackRange: 40, cooldownMs: 900, radius: 16, xp: 300,
  },
  orvath: {
    maxHp: 650, speed: 90, dmg: [12, 20] as [number, number],
    aggroRange: 320, attackRange: 230, cooldownMs: 1400, radius: 14, xp: 330,
  },
  aldric: {
    maxHp: 750, speed: 95, dmg: [14, 22] as [number, number],
    aggroRange: 300, attackRange: 42, cooldownMs: 1000, radius: 16, xp: 360,
  },
  uldrath: {
    maxHp: 900, speed: 95, dmg: [16, 26] as [number, number],
    aggroRange: 320, attackRange: 44, cooldownMs: 950, radius: 17, xp: 450,
  },
  bovax: {
    maxHp: 700, speed: 110, dmg: [14, 24] as [number, number],
    aggroRange: 320, attackRange: 40, cooldownMs: 800, radius: 16, xp: 350,
  },
};
export type MonsterKind = keyof typeof MONSTERS;

export const BOSS_RESPAWN_MS = 180000; // 3 min — farmable, not a conveyor belt
export const CAMP_RESPAWN_MS = 90000; // cleared camps stay cleared long enough to breathe

// --- boss roster: one per depth band ---


export function bossKindForFloor(floor: number): BossKind {
  const band = BOSS_BANDS[themeIndexForFloor(floor)];
  return band[(floor - 1) % band.length];
}


export const BOSS_LINES: Record<BossKind | "bovax", string> = {
  flenser: "Meat for the hooks!",
  corvessa: "My dead are never done serving.",
  maggotqueen: "The brood hungers!",
  malgrim: "Your fear arrived long before you did.",
  vessira: "Every wound you carry, I planted.",
  vuruk: "The cold keeps what it catches.",
  orvath: "Spite outlives the spine.",
  aldric: "I remember the light. I chose this.",
  uldrath: "I am what remains when all else is finished.",
  bovax: "MOO.",
  nyzat: "I have worn this sand for a thousand years. You, it will wear by morning.",
  ssarim: "The river only ever asks once.",
};

// new boss mechanics tuning
export const VURUK_CHARGE_INTERVAL_MS = 5000;
export const VURUK_CHARGE_MS = 700;
export const VURUK_CHARGE_SPEED_MULT = 3.6;
export const ORVATH_KEEP_DISTANCE = 170;
export const ORVATH_ORB_SPEED = 300;
// which bosses cast the telegraphed nova, and how it flavors
export const NOVA_BOSSES: Partial<Record<string, { hue: number; element: Element; label: string }>> = {
  malgrim: { hue: 0xff6a20, element: "fire", label: "Malgrim's dread-fire nova" },
  vessira: { hue: 0x5fae3f, element: "fire", label: "Vessira's venom nova" },
  aldric: { hue: 0x8ad0ff, element: "cold", label: "Aldric's frozen nova" },
  uldrath: { hue: 0xd83a2a, element: "fire", label: "Uldrath's unmaking wave" },
  nyzat: { hue: 0x9fae3f, element: "fire", label: "Nyzat's embalming nova" },
  ssarim: { hue: 0x50c8b0, element: "cold", label: "Ssarim's drowning nova" },
};
export const BROOD_BOSSES = ["maggotqueen", "uldrath", "nyzat"];
// what each brood-mother calls up from the ground
export const BROOD_ADD_KIND: Record<string, MonsterKind> = {
  maggotqueen: "zombie",
  uldrath: "zombie",
  nyzat: "scarab",
};

// boss mechanics
export const CORVESSA_KEEP_DISTANCE = 140; // she kites if you get closer
export const CORVESSA_ARROW_SPEED = 380;
export const QUEEN_SPAWN_MS = 6000;
export const QUEEN_MAX_ADDS = 6;
export const NOVA_INTERVAL_MS = 5000;
export const NOVA_TELEGRAPH_MS = 1200;
export const NOVA_RADIUS = 110;
export const NOVA_DMG: [number, number] = [15, 25];

// behavioral champion packs — the telegraph-based pair
// Mortar: lobs a shell at where you're standing; a ring warns, then the ground erupts. Keep moving.
export const MORTAR_INTERVAL_MS = 3400; // between shells, per Mortar champion
export const MORTAR_TELEGRAPH_MS = 950; // warning-ring lead time before it lands
export const MORTAR_RADIUS = 52; // blast radius — small enough to sidestep
export const MORTAR_DMG: [number, number] = [8, 14]; // per shell, before floor scaling
// Warded: raises a periodic bubble that eats ALL damage. Burst it in the gaps, or wait it out.
export const WARD_INTERVAL_MS = 6200; // between wards (measured ward-start to ward-start)
export const WARD_DURATION_MS = 2100; // how long each bubble holds
// Hexer: from range, lays a telegraphed curse-circle on your position; step out before it seals or
// your own blows go feeble for a spell. Doesn't hurt you — it declaws you. Burst the caster or reposition.
export const HEX_INTERVAL_MS = 5200; // between hexes, per Hexer champion
export const HEX_TELEGRAPH_MS = 850; // the curse gathers this long before it seals — time to step out
export const HEX_RADIUS = 60; // seal radius — dodgeable, but it follows where you WERE
export const HEX_RANGE = 300; // a Hexer won't reach for you from further than this
export const HEX_DURATION_MS = 4000; // how long a sealed curse saps your damage
export const HEX_DMG_MULT = 0.6; // a hexed hero deals 60% damage until it lifts

// Depth scaling eases past a full campaign's worth of danger. Through the base 4-act game monster
// HP/damage climb steeply — players are still gaining levels and gear. In the endless deep (past
// danger 28), where base player growth has largely stopped and only paragon trickles in, the slope
// gentles so the Abyss stays a fight instead of ballooning into a 30× bullet-sponge that also
// one-shots you. Continuous at the knee — no cliff. (danger = (act-1)*7 + floor + difficulty offset.)
export const DEPTH_TAPER_DANGER = 28; // one full 4-act campaign
export function floorHpMult(danger: number): number {
  if (danger <= DEPTH_TAPER_DANGER) return 1 + 0.35 * (danger - 1);
  return 1 + 0.35 * (DEPTH_TAPER_DANGER - 1) + 0.22 * (danger - DEPTH_TAPER_DANGER);
}
export function floorDmgMult(danger: number): number {
  if (danger <= DEPTH_TAPER_DANGER) return 1 + 0.3 * (danger - 1);
  return 1 + 0.3 * (DEPTH_TAPER_DANGER - 1) + 0.2 * (danger - DEPTH_TAPER_DANGER);
}
export function floorXpMult(floor: number): number {
  return 1 + 0.25 * (floor - 1);
}

// pack size per camp grows with depth — big enough to gather and detonate, the
// Diablo way (danger, not raw floor: nightmare/hell packs swell too)
export function campPackSize(danger: number): number {
  return Math.min(12, 3 + Math.floor(danger * 0.75));
}

// which trash monsters roam each depth
export function pickMonsterKind(floor: number, rng: () => number = Math.random): MonsterKind {
  const roll = rng();
  // the forest: imp camps, spinebacks in the brush, the shambling dead
  if (floor <= 1) return roll < 0.45 ? "imp" : roll < 0.75 ? "spineback" : "zombie";
  if (floor === 2) return roll < 0.4 ? "zombie" : roll < 0.7 ? "skeleton" : roll < 0.9 ? "archer" : "imp";
  if (floor === 3) return roll < 0.15 ? "zombie" : roll < 0.4 ? "skeleton" : roll < 0.6 ? "archer" : roll < 0.8 ? "goatman" : "cultist";
  if (floor === 4) {
    // the old guard plus the new blood — the crossing point
    return roll < 0.08 ? "zombie" : roll < 0.3 ? "skeleton" : roll < 0.48 ? "archer" : roll < 0.62 ? "demon" : roll < 0.82 ? "goatman" : "cultist";
  }
  if (floor <= 6) return roll < 0.15 ? "skeleton" : roll < 0.3 ? "archer" : roll < 0.5 ? "demon" : roll < 0.65 ? "goatman" : roll < 0.8 ? "cultist" : "wraith";
  if (floor <= 9) return roll < 0.2 ? "demon" : roll < 0.4 ? "wraith" : roll < 0.65 ? "gargoyle" : roll < 0.8 ? "cultist" : "succubus";
  // floor 10+: the abyss fields its own army
  return roll < 0.15 ? "demon" : roll < 0.35 ? "gargoyle" : roll < 0.55 ? "succubus" : roll < 0.8 ? "hellion" : "wraith";
}

// which trash roams each ACT, floor by floor (falls back to the global danger bands)
export function pickMonsterKindFor(act: number, floor: number, rng: () => number = Math.random): MonsterKind {
  const roll = rng();
  if (act === 2) {
    if (floor <= 1) return roll < 0.35 ? "scarab" : roll < 0.6 ? "carrionbird" : roll < 0.8 ? "spineback" : "entombed";
    return roll < 0.28 ? "entombed" : roll < 0.48 ? "scarab" : roll < 0.68 ? "sandserpent" : roll < 0.84 ? "duneprowler" : "skeleton";
  }
  if (act === 3) {
    if (floor <= 1) return roll < 0.35 ? "mudling" : roll < 0.58 ? "blowreed" : roll < 0.78 ? "riverfang" : "spineback";
    return roll < 0.22 ? "vinehorror" : roll < 0.42 ? "bogwitch" : roll < 0.62 ? "mudling" : roll < 0.78 ? "riverfang" : roll < 0.92 ? "blowreed" : "zombie";
  }
  if (act === 4) {
    if (floor <= 1) return roll < 0.35 ? "flayed" : roll < 0.6 ? "ashfiend" : roll < 0.8 ? "imp" : "hellion";
    return roll < 0.2 ? "doomguard" : roll < 0.4 ? "flamecaller" : roll < 0.62 ? "ashfiend" : roll < 0.78 ? "flayed" : roll < 0.9 ? "hellion" : "succubus";
  }
  return pickMonsterKind(dangerFor(act, floor), rng);
}

export const ARCHER_KEEP_DISTANCE = 120;
export const ARCHER_ARROW_SPEED = 330;

// spinebacks spit their spines from the brush
export const SPINEBACK_KEEP_DISTANCE = 110;
export const SPINEBACK_SPEED = 300;
// dark cultists hurl hex bolts; succubi cast blood stars
export const CULTIST_KEEP_DISTANCE = 140;
export const CULTIST_BOLT_SPEED = 330;
export const SUCCUBUS_KEEP_DISTANCE = 160;
export const SUCCUBUS_STAR_SPEED = 350;
// fallen are cowards: when one of their own dies nearby, they scatter shrieking
export const IMP_FLEE_MS = 1600;
export const IMP_FLEE_RADIUS = 140;

// --- the acts: four campaigns, and the abyss beneath them ---

// --- the difficulty ladder: beat the Unmaker, and the world sharpens its knives ---
export const DIFFICULTIES = ["Normal", "Nightmare", "Hell"] as const;
export type DifficultyNum = 1 | 2 | 3;
export const DIFF_DANGER_OFFSET = [0, 28, 56]; // a whole world's depth added per tier
export const DIFF_RES_PENALTY = [0, -40, -100]; // your resistances, taxed D2-style
export const DIFF_MYTHIC_MULT = [1, 1.6, 2.5]; // set/unique/legendary/epic weights, multiplied
export const MAX_LEVEL = 99; // the ladder's ceiling — 99 levels, 99 skill points

// PARAGON: past 99, XP no longer vanishes — it banks into an endless paragon track. Each
// paragon level grants ONE point to spend on a small permanent bonus, so a maxed hero keeps
// growing forever (the D3/D4 engine, here per-character). The cost climbs so it's a long grind.
export const PARAGON_XP_BASE = 60_000;
export const PARAGON_XP_STEP = 4_000;
export function paragonXpForNext(plvl: number): number {
  return PARAGON_XP_BASE + plvl * PARAGON_XP_STEP;
}
export interface ParagonPerk {
  id: string;
  name: string;
  desc: string;
  stat: keyof ItemStats; // the derived stat each point feeds
  per: number; // amount granted per point
}
export const PARAGON_PERKS: ParagonPerk[] = [
  { id: "might", name: "Might", desc: "+2 damage", stat: "dmg", per: 2 },
  { id: "vigor", name: "Vigor", desc: "+6 life", stat: "maxHp", per: 6 },
  { id: "guard", name: "Guard", desc: "+2 armor", stat: "armor", per: 2 },
  { id: "ward", name: "Ward", desc: "+1 all resistances", stat: "allRes", per: 1 },
  { id: "greed", name: "Greed", desc: "+1% magic find", stat: "magicFind", per: 1 },
  { id: "celerity", name: "Celerity", desc: "+1% attack speed", stat: "atkSpd", per: 1 },
];
export function paragonPerkById(id: string): ParagonPerk | undefined {
  return PARAGON_PERKS.find((p) => p.id === id);
}

export const ACT_FLOORS = 7; // surface + six dungeon floors; the act boss holds the last
export const ABYSS_ACT = 5; // the pseudo-act after victory: endless, nameless, down
export const ABYSS_PALETTE_ORDER = [8, 7, 3, 5, 4, 2, 6, 1, 0]; // darkest first, then everything

// the seasonal ladder: bump this to reset the leaderboard with fresh characters
export const CURRENT_SEASON = 1;

// RIFTS: a self-contained, pushable endgame run. A sentinel "act" keeps rifts off the
// normal ladder, and a rift's danger climbs with its tier — the D3 Greater Rift knob.
export const RIFT_ACT = 90;
export const RIFT_KILL_GOAL = 60; // monsters to slay before the Rift Boss is summoned
export function riftDangerFor(tier: number): number {
  return 12 + tier * 4; // tier 1 ≈ deep Act II; each tier is a real step up
}

// one scalar to rule difficulty, ilvl, and loot: how deep into the world you really are
export function dangerFor(act: number, floor: number): number {
  return (act - 1) * ACT_FLOORS + floor;
}
// lore/lighting band: each act reads one band deeper (the abyss reads the deepest)
export function loreBandFor(act: number): number {
  return Math.min(3, act - 1);
}

export interface ActDef {
  num: number;
  name: string;
  townName: string; // painted on the campfire banner
  surfaceThemeIndex: number; // the palette of floor 1, the world above
  paletteOrder: number[]; // palettes cycling through floors 2..7
  bossLadder: (BossKind | null)[]; // index floor-1; null slots draw from `rotation`
  rotation: BossKind[];
  actBoss: BossKind; // guards floor 7 — felling it opens the road onward
  weathers: string[]; // the surface rolls its sky from this pool
  arcQuestId: string; // the quest the act boss completes
}

export const ACTS: ActDef[] = [
  {
    num: 1, name: "The Mournfield", townName: "HOLLOWMERE",
    surfaceThemeIndex: FOREST_THEME_INDEX,
    paletteOrder: [0, 1, 4, 2, 6, 5], // cathedral, catacombs, frozen, caves, swamp, sanguine
    bossLadder: ["flenser", null, null, null, null, null, "vessira"],
    rotation: ["corvessa", "maggotqueen"],
    actBoss: "vessira",
    weathers: ["clear", "rain", "mist"],
    arcQuestId: "thorned_maiden",
  },
  {
    num: 2, name: "The Sunscar Wastes", townName: "ZERATH OASIS",
    surfaceThemeIndex: 10, // sunscar hardpan
    paletteOrder: [11, 2, 11, 1, 11, 2], // tombs, with caves and catacombs between
    bossLadder: [null, null, null, "vuruk", null, null, "nyzat"], // the White Maw waits mid-tomb
    rotation: ["maggotqueen", "corvessa"],
    actBoss: "nyzat",
    weathers: ["clear", "sandstorm", "sandstorm"],
    arcQuestId: "embalmed_queen",
  },
  {
    num: 3, name: "The Drowned Green", townName: "MIREFALL LANDING",
    surfaceThemeIndex: 12, // the Drowned Green
    paletteOrder: [13, 6, 13, 2, 13, 6], // the ziggurat, with swamp and caves between
    bossLadder: [null, null, null, "orvath", null, null, "ssarim"], // the Grudge Eternal broods mid-temple
    rotation: ["corvessa", "maggotqueen"],
    actBoss: "ssarim",
    weathers: ["rain", "rain", "mist"],
    arcQuestId: "drowned_god",
  },
  {
    num: 4, name: "The Hollow Throne", townName: "THE LAST VIGIL",
    surfaceThemeIndex: 14, // the ashfall road
    paletteOrder: [3, 8, 7, 3, 8, 7], // hell, abyss, void — the Hollow Throne's own colors
    bossLadder: [null, null, null, "aldric", null, "malgrim", "uldrath"], // the Forsworn, then the King of Dread, then the end
    rotation: ["aldric", "malgrim"],
    actBoss: "uldrath",
    weathers: ["ashfall", "ashfall", "clear"],
    arcQuestId: "the_unmaking",
  },
];

export function actBossKindFor(act: number, floor: number): BossKind {
  if (act >= ABYSS_ACT) return BOSS_KIND_LIST[(floor - 1) % BOSS_KIND_LIST.length];
  const def = ACTS[Math.min(act, ACTS.length) - 1];
  if (floor >= ACT_FLOORS) return def.actBoss;
  return def.bossLadder[floor - 1] ?? def.rotation[(floor - 1) % def.rotation.length];
}

export function visualThemeFor(act: number, floor: number): number {
  if (act >= ABYSS_ACT) return ABYSS_PALETTE_ORDER[(floor - 1) % ABYSS_PALETTE_ORDER.length];
  const def = ACTS[Math.min(act, ACTS.length) - 1];
  if (floor <= 1) return def.surfaceThemeIndex;
  return def.paletteOrder[(floor - 2) % def.paletteOrder.length];
}

// data-driven trash AI: new kinds are table rows, not new server branches
export const RANGED_MONSTERS: Partial<Record<string, { keep: number; proj: string; speed: number }>> = {
  archer: { keep: ARCHER_KEEP_DISTANCE, proj: "mobarrow", speed: ARCHER_ARROW_SPEED },
  spineback: { keep: SPINEBACK_KEEP_DISTANCE, proj: "quill", speed: SPINEBACK_SPEED },
  cultist: { keep: CULTIST_KEEP_DISTANCE, proj: "hexbolt", speed: CULTIST_BOLT_SPEED },
  succubus: { keep: SUCCUBUS_KEEP_DISTANCE, proj: "bloodstar", speed: SUCCUBUS_STAR_SPEED },
  corvessa: { keep: CORVESSA_KEEP_DISTANCE, proj: "bossarrow", speed: CORVESSA_ARROW_SPEED },
  orvath: { keep: ORVATH_KEEP_DISTANCE, proj: "orb", speed: ORVATH_ORB_SPEED },
  sandserpent: { keep: 130, proj: "quill", speed: 330 },
  blowreed: { keep: 150, proj: "quill", speed: 340 },
  bogwitch: { keep: 160, proj: "hexbolt", speed: 330 },
  flamecaller: { keep: 165, proj: "bloodstar", speed: 350 },
  ssarim: { keep: 180, proj: "orb", speed: 320 },
};
export const MONSTER_AI: Partial<Record<string, "coward" | "charger">> = {
  imp: "coward",
  carrionbird: "coward", // they feast on the dead, not the living
  mudling: "coward",
  flayed: "coward", // they remember what was done to them
  vuruk: "charger",
  duneprowler: "charger",
  riverfang: "charger",
};


// --- trading: two heroes, one handshake, no take-backs ---

export const TRADE_RANGE = 160; // partners must stand this close — and stay close
export const TRADE_MAX_ITEMS = 6; // offered items per side, per deal
export const TRADE_INVITE_TTL_MS = 30000; // unanswered invites expire

// --- mana ---

export const PLAYER_MAX_MANA = 50; // pre-recompute placeholder; real pools come from Energy
export const MANA_REGEN_PER_S = 4;

// --- attributes (D2-style: your build starts at the stat screen) ---

export const ATTRS = ["str", "dex", "vit", "ene"] as const;
export type AttrName = (typeof ATTRS)[number];
export interface Attributes {
  str: number;
  dex: number;
  vit: number;
  ene: number;
}

export const ATTR_LABELS: Record<AttrName, string> = {
  str: "Strength",
  dex: "Dexterity",
  vit: "Vitality",
  ene: "Energy",
};

export const STAT_POINTS_PER_LEVEL = 5;

export const CLASS_BASE_ATTRS: Record<ClassName, Attributes> = {
  barbarian: { str: 30, dex: 20, vit: 25, ene: 10 },
  rogue: { str: 20, dex: 30, vit: 20, ene: 15 },
  sorcerer: { str: 15, dex: 15, vit: 20, ene: 35 },
  paladin: { str: 25, dex: 20, vit: 25, ene: 15 },
  necromancer: { str: 15, dex: 20, vit: 20, ene: 30 },
  druid: { str: 20, dex: 15, vit: 25, ene: 25 },
};

// each class turns its signature attribute into raw killing power
export const CLASS_OFFENSIVE_ATTR: Record<ClassName, AttrName> = {
  barbarian: "str",
  rogue: "dex",
  sorcerer: "ene",
  paladin: "str",
  necromancer: "ene",
  druid: "ene",
};

export const HP_BASE = 20;
export const HP_PER_VIT = 3;
export const MANA_BASE = 10;
export const MANA_PER_ENE = 2;
export const DMG_PCT_PER_STR = 0.4; // every hero benefits a little from muscle
export const DMG_PCT_PER_OFFENSIVE = 0.6; // …and a lot from their signature attribute
export const CRIT_PER_DEX = 0.1;
export const DODGE_PER_DEX = 0.1;
export const MANA_REGEN_PER_ENE = 0.04;
export const DODGE_CAP = 50;

// stat bonuses granted by raw attributes (gear adds on top)
export function attrBonus(a: Attributes, cls: ClassName): ItemStats {
  const off = CLASS_OFFENSIVE_ATTR[cls];
  const dmgPct = a.str * DMG_PCT_PER_STR + a[off] * DMG_PCT_PER_OFFENSIVE;
  return {
    dmgPct: Math.round(dmgPct * 10) / 10,
    crit: Math.round(a.dex * CRIT_PER_DEX * 10) / 10,
    dodge: Math.round(a.dex * DODGE_PER_DEX * 10) / 10,
    manaRegen: Math.round(a.ene * MANA_REGEN_PER_ENE * 100) / 100,
  };
}

export function maxHpFor(vit: number, level: number, gearMaxHp: number): number {
  return HP_BASE + vit * HP_PER_VIT + (level - 1) * HP_PER_LEVEL + gearMaxHp;
}
export function maxManaFor(ene: number, gearMaxMana: number): number {
  return MANA_BASE + ene * MANA_PER_ENE + gearMaxMana;
}


// --- items ---

export type Slot = "weapon" | "offhand" | "helm" | "chest" | "gloves" | "ring" | "amulet" | "belt" | "boots";

export type EquipSlot = Exclude<Slot, "ring"> | "ring1" | "ring2";
export const EQUIP_SLOTS: EquipSlot[] = [
  "weapon", "offhand", "helm", "chest", "gloves", "ring1", "ring2", "amulet", "belt", "boots",
];

export function equipSlotFor(
  item: { slot: Slot | "charm" | "rune" | "jewel" },
  gear: Partial<Record<EquipSlot, unknown>>
): EquipSlot | null {
  if (item.slot === "charm" || item.slot === "rune" || item.slot === "jewel") return null;
  if (item.slot !== "ring") return item.slot;
  if (!gear.ring1) return "ring1";
  if (!gear.ring2) return "ring2";
  return "ring1";
}

export type Rarity = "common" | "magic" | "rare" | "set" | "unique" | "legendary" | "epic";

export const RARITY_ORDER: Rarity[] = ["common", "magic", "rare", "set", "unique", "legendary", "epic"];

export const RARITY_COLORS: Record<Rarity, number> = {
  common: 0xd0d0d0,
  magic: 0x6a8cff,
  rare: 0xffd24a,
  set: 0x40c060,
  unique: 0xc7883a,
  legendary: 0xff8033,
  epic: 0xb048d8,
};

// Tuned with the drop chance below so legendary/epic keep their exact old
// per-kill odds while the low tiers get slashed: commons ~3× rarer, magic ~2×,
// rare ~1.3×. The flood becomes a trickle; the trickle stays worth watching.
export const RARITY_WEIGHTS: Array<[Rarity, number]> = [
  ["common", 42],
  ["magic", 33],
  ["rare", 16.5],
  ["set", 2.6],
  ["unique", 3.6],
  ["legendary", 1.7],
  ["epic", 0.6],
];

export const DROP_CHANCE = 0.11; // true scarcity — most kills drop NOTHING. trimmed from 0.15 once packs
// grew from 5 to 12 (that ~2.4×'d per-floor loot); 0.11 holds the "Great Drought" feel with denser packs
export const LOOT_DESPAWN_MS = 90000;
export const PICKUP_RANGE = 48;
export const AUTO_PICKUP_RANGE = 28; // gold & potions hoover up when walked over
export const CLICK_LOOT_RADIUS = 30; // clicking this close to a ground item loots it
export const INVENTORY_SIZE = 20;

// Bosses never drop common — but they are also not a unique fountain: 13% of a
// boss drop is unique-or-better (was 23%, which made every 3-minute respawn a jackpot).
// The 20% signature roll on the first drop stays — farm THE boss for THE drop.
export const BOSS_RARITY_WEIGHTS: Array<[Rarity, number]> = [
  ["magic", 40],
  ["rare", 40],
  ["set", 6],
  ["unique", 8],
  ["legendary", 3.5],
  ["epic", 1.5],
];
export const BOSS_GUARANTEED_DROPS = 2;
export const BOSS_EXTRA_DROP_CHANCE = 0.3;


// +skills boosts the ranks of skills you've ALREADY learned (≥1 hard point) — it never
// conjures an unlearned skill. Returns an augmented rank map for damage/behavior math.
export function effectiveSkills(skills: Record<string, number>, plus: number): Record<string, number> {
  if (!plus) return skills;
  const out: Record<string, number> = {};
  for (const [id, r] of Object.entries(skills)) out[id] = r > 0 ? r + plus : r;
  return out;
}

export interface Item {
  id: string;
  base: string;
  name: string;
  slot: Slot | "charm" | "rune" | "jewel"; // charms/runes/jewels live in the inventory, never equipped
  rarity: Rarity;
  ilvl: number;
  stats: ItemStats;
  setId?: string; // set pieces only
  classBonus?: { cls: ClassName; stats: ItemStats }; // only counts for that class
  effect?: string; // unique effect id (legendaries/epics) — see EFFECTS
  power?: string; // legendary skill-power id — REWRITES a skill (see SKILL_POWERS)
  sockets?: number; // socket count (weapon/offhand/helm/chest)
  runes?: string[]; // inserted rune ids, in insertion order
  runeword?: string; // formed runeword name, if any
  jewels?: Array<{ name: string; stats: ItemStats; rarity: Rarity }>; // cut stones seated in sockets
  unidentified?: boolean; // stats hidden and unequippable until identified
}

// --- runes, sockets & runewords ---

export const RUNE_DROP_CHANCE = 0.035;
export const SOCKET_CHANCE = 0.25;
export const FIXED_SOCKET_CHANCE = 0.15;
export const SOCKETABLE_SLOTS: Slot[] = ["weapon", "offhand", "helm", "chest"];

export interface RuneDef {
  id: string;
  name: string;
  stats: ItemStats;
  minIlvl: number;
}

export const RUNES: Record<string, RuneDef> = {
  vek: { id: "vek", name: "Vek", stats: { armor: 2 }, minIlvl: 1 },
  ond: { id: "ond", name: "Ond", stats: { maxMana: 5 }, minIlvl: 1 },
  rok: { id: "rok", name: "Rok", stats: { dmg: 3 }, minIlvl: 2 },
  fyr: { id: "fyr", name: "Fyr", stats: { fireDmg: 3 }, minIlvl: 3 },
  zel: { id: "zel", name: "Zel", stats: { lightDmg: 4 }, minIlvl: 3 },
  hym: { id: "hym", name: "Hym", stats: { coldDmg: 3 }, minIlvl: 3 },
  mur: { id: "mur", name: "Mur", stats: { maxMana: 10 }, minIlvl: 4 },
  vor: { id: "vor", name: "Vor", stats: { lifeSteal: 2 }, minIlvl: 5 },
  kel: { id: "kel", name: "Kel", stats: { dmg: 4 }, minIlvl: 5 },
  ash: { id: "ash", name: "Ash", stats: { crit: 3 }, minIlvl: 6 },
  tor: { id: "tor", name: "Tor", stats: { dmgPct: 8 }, minIlvl: 7 },
  karn: { id: "karn", name: "Karn", stats: { crit: 5 }, minIlvl: 8 },
  ghal: { id: "ghal", name: "Ghal", stats: { allRes: 8 }, minIlvl: 8 },
  // the deep alphabet: runes that only the sharpened worlds surrender
  bren: { id: "bren", name: "Bren", stats: { fireDmg: 8 }, minIlvl: 10 },
  skol: { id: "skol", name: "Skol", stats: { coldDmg: 8 }, minIlvl: 12 },
  zhar: { id: "zhar", name: "Zhar", stats: { lightDmg: 10 }, minIlvl: 14 },
  vael: { id: "vael", name: "Vael", stats: { lifeSteal: 3, manaSteal: 2 }, minIlvl: 17 },
  drov: { id: "drov", name: "Drov", stats: { dmgPct: 14 }, minIlvl: 20 },
  thurn: { id: "thurn", name: "Thurn", stats: { armor: 10 }, minIlvl: 24 },
  ulth: { id: "ulth", name: "Ulth", stats: { allRes: 12 }, minIlvl: 28 },
};

// Runes read as a rarity ladder on the ground, just like any other drop: the cheap
// early runes are white/blue, and the deep alphabet burns rare → epic. This is a
// DISPLAY tier only — a rune item's stored rarity stays "magic" (see generateRune),
// so nothing downstream (sell value, altar recipes) changes.
export function runeRarity(runeId: string): Rarity {
  const minIlvl = RUNES[runeId]?.minIlvl ?? 1;
  if (minIlvl <= 2) return "common";
  if (minIlvl <= 5) return "magic";
  if (minIlvl <= 8) return "rare";
  if (minIlvl <= 17) return "legendary";
  return "epic";
}

export interface Runeword {
  name: string;
  runes: string[]; // exact order, must fill every socket
  slots: Slot[];
  bonus: ItemStats;
  effect?: string; // a proc from EFFECTS
  power?: string; // a build-defining skill rewrite from SKILL_POWERS (the grails only)
}

// Runeword bonuses are applied FLAT (unlike epic/unique gear, which scales its stats
// with item level). So the words that are meant to rival end-game legends carry big,
// deliberate flat numbers — and the four-socket grails at the bottom pair an epic-tier
// stat package with a signature effect and, for two of them, a build-defining skill power.
export const RUNEWORDS: Runeword[] = [
  // ── early words: cheap, shallow runes — honest power for the first act or two ──
  { name: "Warbrand", runes: ["ond", "vek"], slots: ["weapon"], bonus: { dmg: 6, atkSpd: 15, crit: 3 } },
  { name: "Ghoststep", runes: ["ond", "fyr"], slots: ["chest", "helm"], bonus: { moveSpd: 15, atkSpd: 10, cdr: 5 } },
  { name: "Kindling", runes: ["ond", "fyr"], slots: ["weapon"], bonus: { fireDmg: 10, maxMana: 10 } },
  { name: "Scholar", runes: ["zel", "kel"], slots: ["helm"], bonus: { maxMana: 15, lightDmg: 5, xpBonus: 5 } },
  { name: "Oathward", runes: ["fyr", "zel", "vek"], slots: ["offhand"], bonus: { allRes: 13, armor: 6 } },
  { name: "King's Purse", runes: ["mur", "ash"], slots: ["chest"], bonus: { goldFind: 40, magicFind: 10 } },
  { name: "Clarity", runes: ["fyr", "kel", "vor"], slots: ["weapon", "offhand"], bonus: { maxMana: 30, regen: 3 }, effect: "arcane_surge" },
  { name: "Ruin", runes: ["vor", "karn"], slots: ["weapon"], bonus: { dmgPct: 30, fireDmg: 8 }, effect: "corpse_explosion" },
  // the accessible four-socket workhorse — strong, but every rune in it is shallow
  { name: "Anima", runes: ["ond", "hym", "zel", "vor"], slots: ["weapon", "offhand"], bonus: { dmgPct: 30, maxMana: 45, cdr: 15, moveSpd: 12 }, effect: "arcane_surge" },
  // ── the deep book: words for the sharpened worlds, three sockets of real power ──
  { name: "Mournfield", runes: ["vek", "hym", "vek"], slots: ["chest"], bonus: { armor: 8, coldRes: 15, maxHp: 20 } },
  { name: "Sunscar", runes: ["fyr", "fyr", "tor"], slots: ["weapon"], bonus: { fireDmg: 14, dmgPct: 15 }, effect: "immolation" },
  { name: "Undertow", runes: ["hym", "mur", "vor"], slots: ["weapon"], bonus: { coldDmg: 10, maxMana: 15, lifeSteal: 2 }, effect: "frostnova_on_hit" },
  { name: "Gravemeal", runes: ["vor", "vor", "kel"], slots: ["weapon"], bonus: { lifeSteal: 4, dmg: 8 }, effect: "bleed" },
  { name: "Stormlaw", runes: ["zel", "zel", "karn"], slots: ["weapon"], bonus: { lightDmg: 30, crit: 9 }, effect: "lightning_storm" },
  { name: "Hearthlight", runes: ["fyr", "vek", "mur"], slots: ["helm"], bonus: { maxHp: 15, maxMana: 15, fireRes: 15 } },
  { name: "Bulwark", runes: ["vek", "vek", "ghal"], slots: ["offhand"], bonus: { armor: 12, allRes: 8, thorns: 4 }, effect: "frost_armor" },
  { name: "Winterking", runes: ["hym", "ghal", "skol"], slots: ["weapon"], bonus: { coldDmg: 34, dmgPct: 24 }, effect: "frostnova_on_hit" },
  { name: "The Drought", runes: ["bren", "tor", "fyr"], slots: ["weapon"], bonus: { fireDmg: 34, dmgPct: 30, atkSpd: 12 }, effect: "immolation" },
  { name: "Nightparish", runes: ["ghal", "vael", "hym"], slots: ["chest"], bonus: { allRes: 22, lifeSteal: 4, maxHp: 45 }, effect: "second_wind" },
  { name: "Stonewill", runes: ["thurn", "vek", "ghal"], slots: ["helm"], bonus: { armor: 18, allRes: 12, maxHp: 35 }, effect: "mana_shield" },
  { name: "Sanctum", runes: ["ulth", "ghal", "thurn"], slots: ["offhand"], bonus: { armor: 30, allRes: 24, maxHp: 40 }, effect: "aegis" },
  { name: "Thornparade", runes: ["thurn", "vael", "drov"], slots: ["chest"], bonus: { armor: 22, thorns: 16, dmgPct: 20 }, effect: "adrenaline" },
  // ── the second book: armor's due, and the strongest three-socket words ──
  { name: "Wardvigil", runes: ["zel", "hym", "ghal"], slots: ["helm"], bonus: { allRes: 10, maxMana: 20, dodge: 4 } },
  { name: "Mindspire", runes: ["kel", "zel", "mur"], slots: ["helm"], bonus: { maxMana: 30, manaRegen: 4, cdr: 8 }, effect: "arcane_surge" },
  { name: "Ironbark", runes: ["thurn", "ghal", "vek"], slots: ["chest"], bonus: { armor: 28, maxHp: 55, thorns: 12 }, effect: "frost_armor" },
  { name: "Tidecaller", runes: ["hym", "mur", "kel"], slots: ["offhand"], bonus: { coldDmg: 12, maxMana: 20, allRes: 8 }, effect: "frostnova_on_hit" },
  { name: "Lightward", runes: ["zel", "ghal", "vek"], slots: ["offhand"], bonus: { lightRes: 20, armor: 8, cdr: 6 } },
  { name: "Wyrmtongue", runes: ["fyr", "tor", "bren"], slots: ["weapon"], bonus: { fireDmg: 32, dmgPct: 28 }, effect: "immolation" },
  { name: "Soulcinder", runes: ["vor", "kel", "zhar"], slots: ["weapon"], bonus: { dmg: 26, lifeSteal: 6, dmgPct: 26 }, effect: "corpse_explosion" },
  // ── THE GRAILS: four deep sockets, epic-tier — the equal of any legend in the slot ──
  { name: "Kingslayer", runes: ["drov", "karn", "kel", "rok"], slots: ["weapon"], bonus: { dmgPct: 55, crit: 16, dmg: 30 }, effect: "giantslayer" },
  { name: "Doomsayer", runes: ["karn", "drov", "thurn", "kel"], slots: ["weapon"], bonus: { dmgPct: 60, crit: 12, lifeSteal: 6, dmg: 34 }, effect: "twin_strike" },
  { name: "Everstorm", runes: ["zel", "zhar", "karn", "vor"], slots: ["weapon"], bonus: { lightDmg: 46, dmgPct: 42, crit: 12 }, effect: "stormlord", power: "chain_fork" },
  { name: "Worldsedge", runes: ["thurn", "drov", "ulth", "karn"], slots: ["weapon"], bonus: { dmgPct: 70, crit: 14, dmg: 40, allRes: 12 }, effect: "culling", power: "whirl_rend" },
  { name: "Sanctuary", runes: ["ghal", "thurn", "ulth", "vek"], slots: ["chest"], bonus: { armor: 40, allRes: 30, maxHp: 80 }, effect: "deathless" },
];

export function matchRuneword(item: Pick<Item, "slot" | "sockets" | "runes" | "rarity">): Runeword | null {
  if (item.rarity !== "common") return null; // the word only takes in plain steel
  if (!item.runes || !item.sockets || item.runes.length !== item.sockets) return null;
  return (
    RUNEWORDS.find(
      (rw) =>
        rw.slots.includes(item.slot as Slot) &&
        rw.runes.length === item.runes!.length &&
        rw.runes.every((r, i) => item.runes![i] === r)
    ) ?? null
  );
}

export function runewordByName(name: string): Runeword | null {
  return RUNEWORDS.find((rw) => rw.name === name) ?? null;
}

// --- item sets (green, D2-style: bonus for wearing the full set) ---

export interface ItemSet {
  name: string;
  pieces: number;
  bonus: ItemStats; // full-set bonus
  partial?: { count: number; stats: ItemStats }; // smaller bonus at fewer pieces
  effect?: string; // full sets can grant a unique effect
}

export const SETS: Record<string, ItemSet> = {
  vargans: {
    name: "Vargan's Warplate",
    pieces: 3,
    partial: { count: 2, stats: { armor: 5, maxHp: 10 } },
    bonus: { dmgPct: 25, maxHp: 20, magicFind: 25 },
  },
  pallbearer: {
    name: "The Pallbearer's Garb",
    pieces: 2,
    bonus: { dmgPct: 15, magicFind: 10 },
  },
  conclave: {
    name: "The Arcane Conclave",
    pieces: 3,
    partial: { count: 2, stats: { maxMana: 15, cdr: 4 } },
    bonus: { maxMana: 40, cdr: 10, dmgPct: 20 },
    effect: "arcane_surge",
  },
  creed: {
    name: "Hunter's Creed",
    pieces: 3,
    partial: { count: 2, stats: { atkSpd: 8, moveSpd: 5 } },
    bonus: { atkSpd: 15, crit: 8, moveSpd: 10 },
  },
  colossus: {
    name: "The Colossus",
    pieces: 3,
    partial: { count: 2, stats: { maxHp: 20, armor: 4 } },
    bonus: { dmg: 10, maxHp: 50, thorns: 8 },
    effect: "executioner",
  },
  reaver: {
    name: "The Reaver's Rally",
    pieces: 3,
    partial: { count: 2, stats: { atkSpd: 8, crit: 3 } },
    bonus: { atkSpd: 18, crit: 10, dmgPct: 22 },
    effect: "adrenaline",
  },
};

export const SET_ITEMS: Array<{ setId: string; base: string; name: string; stats: ItemStats }> = [
  { setId: "vargans", base: "greathelm", name: "Vargan's Visor", stats: { armor: 3, atkSpd: 5 } },
  { setId: "vargans", base: "chainmail", name: "Vargan's Hauberk", stats: { armor: 5, maxHp: 10 } },
  { setId: "vargans", base: "warbelt", name: "Vargan's Girdle", stats: { armor: 3, maxHp: 10 } },
  { setId: "pallbearer", base: "shortsword", name: "Pallbearer's Blade", stats: { dmg: 4, atkSpd: 10 } },
  { setId: "pallbearer", base: "sash", name: "Pallbearer's Sash", stats: { armor: 2, maxHp: 8 } },
  { setId: "conclave", base: "orb", name: "Conclave Focus", stats: { maxMana: 15, dmgPct: 10 } },
  { setId: "conclave", base: "robe", name: "Conclave Vestments", stats: { maxMana: 10, armor: 2, regen: 1 } },
  { setId: "conclave", base: "crown", name: "Conclave Diadem", stats: { maxMana: 10, cdr: 4, magicFind: 10 } },
  { setId: "creed", base: "bow", name: "Creed Longshot", stats: { dmg: 5, atkSpd: 8, crit: 3 } },
  { setId: "creed", base: "quiver", name: "Creed Quiver", stats: { atkSpd: 8, moveSpd: 5 } },
  { setId: "creed", base: "boots", name: "Creed Treads", stats: { moveSpd: 10, armor: 2 } },
  { setId: "colossus", base: "maul", name: "Colossus Crusher", stats: { dmg: 9, maxHp: 15 } },
  { setId: "colossus", base: "plate", name: "Colossus Bulwark", stats: { armor: 8, maxHp: 20 } },
  { setId: "colossus", base: "warbelt", name: "Colossus Chain", stats: { armor: 4, maxHp: 15, thorns: 3 } },
  { setId: "reaver", base: "gauntlets", name: "Reaver's Grip", stats: { atkSpd: 10, crit: 4 } },
  { setId: "reaver", base: "waraxe", name: "Reaver's Edge", stats: { dmg: 6, atkSpd: 8 } },
  { setId: "reaver", base: "cap", name: "Reaver's Snarl", stats: { crit: 4, moveSpd: 5 } },
];

// --- charms (grant their stats while sitting in your inventory) ---

export const CHARM_DROP_CHANCE = 0.03;

const CHARM_BASES = [
  { key: "smallcharm", name: "Small Charm", affixes: 1, power: 0.6 },
  { key: "largecharm", name: "Large Charm", affixes: 2, power: 0.85 },
  { key: "grandcharm", name: "Grand Charm", affixes: 3, power: 1.1 },
];

// --- chests & lore ---

export const CHEST_TREASURE_CHANCE = 0.55;
export const CHEST_CURSED_CHANCE = 0.3; // remainder is a jackpot
export const CHEST_AMBUSH: [number, number] = [3, 5];
export const TOME_XP_BASE = 10; // × floor

// original flavor, one pool per depth band
export const LORE_LINES: string[][] = [
  [
    "The candles here burn without wicks. The faithful never left.",
    "\"We sealed the crypt door. It did not stay sealed.\" — Brother Malc",
    "The altar stone is warm. It should not be warm.",
  ],
  [
    "Bones stacked like firewood. Someone was counting.",
    "\"The dead walk in ranks. Who drills them?\" — a captain's journal",
    "A child's toy, here, among the ossuaries.",
  ],
  [
    "The tunnels breathe. In, and out. Slow.",
    "\"We dug too greedily. The maggots came for the sweetness.\" — miner's mark",
    "Claw marks on the ceiling. The ceiling.",
  ],
  [
    "The stone bleeds where you step. It remembers.",
    "\"Not even death can save you.\" Carved a thousand times.",
    "The heat here is not fire. It is hunger.",
  ],
];


// --- identify: the suspense between the beam and the name ---

export function identifyCost(ilvl: number): number {
  return 20 + 15 * (ilvl - 1);
}

// rarities that drop unidentified — the beam tells you the tier, not the truth
export const UNIDENTIFIED_RARITIES: Rarity[] = ["rare", "set", "unique", "legendary", "epic"];

// --- the Ternion Altar: transmute the worthless into the wanted ---

export const RUNE_ORDER = ["vek", "ond", "rok", "fyr", "zel", "hym", "mur", "vor", "kel", "ash", "tor", "karn", "ghal", "bren", "skol", "zhar", "vael", "drov", "thurn", "ulth"];
export const TRANSMUTE_RUNES_NEEDED = 3; // 3 identical runes → 1 of the next tier
export const TRANSMUTE_MAGICS_NEEDED = 3; // 3 magic items → 1 rare

// --- victory: the Lord of Terror must fall where he is strongest ---

export const VICTORY_ACT = 4; // Uldrath falls at the bottom of the Hollow Throne

// --- floor bounties: every floor asks something of you ---

export type BountyKind = "boss" | "kills" | "chest";
export const BOUNTY_XP_PER_FLOOR = 75;
export const BOUNTY_GOLD_PER_FLOOR = 30;

export function bountyGoalFor(kind: BountyKind, floor: number): number {
  return kind === "kills" ? Math.min(24, 8 + 2 * floor) : 1;
}

export function bountyTextFor(kind: BountyKind, floor: number, bossName: string): string {
  switch (kind) {
    case "boss": return `Slay ${bossName}`;
    case "kills": return `Slay ${bountyGoalFor("kills", floor)} monsters`;
    case "chest": return "Open an Ancient Chest";
  }
}

// --- the Dark Pilgrim: a dark presence, and the charm every hero covets ---

export const PILGRIM_CHANCE = 0.1; // per floor
export const PILGRIM_HP_MULT = 6;
export const PILGRIM_DMG_MULT = 1.8;
export const PILGRIM_XP_MULT = 10;
export const BURDEN_CHANCE = 0.25; // per Pilgrim kill

// --- the Hidden Meadow (there is no meadow) ---

export const PEG_LEG_GOBLIN_CHANCE = 0.3;
export const PEG_LEG_JACKPOT_CHANCE = 0.25;
export const COW_ZONE_NAME = "The Hidden Meadow";

export function generateCowLevel(floor: number, seed: number): DungeonLayout {
  const rng = mulberry32(seed + floor * 31337);
  const grid: string[][] = Array.from({ length: GRID_H }, () => Array(DUNGEON_W).fill("#"));
  const carve = (tx: number, ty: number) => {
    if (tx >= 1 && ty >= 1 && tx < DUNGEON_W - 1 && ty < GRID_H - 1) grid[ty][tx] = ".";
  };
  // the same town, floating above a very wrong pasture
  carveTownPlaza(grid);
  // one huge open field
  const top = TOWN_ROWS + 2;
  for (let ty = TOWN_PLAZA.y1 + 1; ty <= top; ty++) carve(TOWN_GATE_TX, ty); // gate into the pasture
  const bottom = GRID_H - 3;
  for (let ty = top; ty <= bottom; ty++) for (let tx = 2; tx <= DUNGEON_W - 3; tx++) carve(tx, ty);
  // scattered fence-post clumps so it isn't a featureless plain
  for (let i = 0; i < 26; i++) {
    const tx = 4 + Math.floor(rng() * (DUNGEON_W - 8));
    const ty = top + 3 + Math.floor(rng() * (bottom - top - 6));
    grid[ty][tx] = "#";
    if (rng() < 0.5) grid[ty][Math.min(DUNGEON_W - 2, tx + 1)] = "#";
  }
  const world = (tx: number, ty: number) => ({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE });
  const spawn = world(4, top + 2);
  const stairs = world(DUNGEON_W - 5, bottom - 2);
  const boss = world(Math.floor(DUNGEON_W / 2), bottom - 4);
  const camps: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 9; i++) {
    const tx = 5 + Math.floor(rng() * (DUNGEON_W - 10));
    const ty = top + 4 + Math.floor(rng() * (bottom - top - 8));
    camps.push(world(tx, ty));
  }
  const chests = [world(8, bottom - 2), world(DUNGEON_W - 8, top + 3)];
  return { rows: grid.map((r) => r.join("")), spawn, stairs, camps, boss, shrines: [], chests, tome: null, waypoint: null, cathedral: null, areas: [], portals: [] };
}

// --- stash & vendor ---

export const STASH_SIZE = 30;

export const SELL_VALUES: Record<Rarity, number> = {
  common: 5,
  magic: 25,
  rare: 75,
  set: 150,
  unique: 200,
  legendary: 350,
  epic: 600,
};

export function sellValue(item: Item): number {
  return Math.max(1, Math.round(SELL_VALUES[item.rarity] * (1 + 0.15 * (item.ilvl - 1))));
}

// --- gold & gambling ---

export const GOLD_DROP_CHANCE = 0.5;
export const ELITE_GOLD_MULT = 4;
export const BOSS_GOLD_PILES = 3;
export const BOSS_GOLD_MULT = 8;
export const GOBLIN_GOLD_PILES = 4;
export const GOBLIN_GOLD_MULT = 5;

export function goldRoll(floor: number, rng: () => number = Math.random): number {
  return Math.max(1, Math.round((4 + rng() * 8) * (1 + 0.4 * (floor - 1))));
}

export function gambleCost(floor: number): number {
  return 200 + 100 * (floor - 1);
}

// gambling never rolls common — that's the whole point of the vice
export const GAMBLE_WEIGHTS: Array<[Rarity, number]> = [
  ["magic", 55],
  ["rare", 30],
  ["set", 6],
  ["unique", 6],
  ["legendary", 2],
  ["epic", 1],
];

// Fenwick's stall: a finite spread of unidentified bases, refreshed as they sell
export const GAMBLE_STOCK_SIZE = 8;
// the roll can reach far past your depth — that's the whole pitch
export function gambleIlvl(floor: number, rng: () => number = Math.random): number {
  return floor + Math.floor(Math.pow(rng(), 2.5) * 9);
}
export function gamblePrice(base: string, floor: number): number {
  const slot = BASE_ITEMS[base]?.slot;
  const mult = slot === "ring" || slot === "amulet" ? 1.5 : 1;
  return Math.round(gambleCost(floor) * mult);
}

// Torvald's shelves: honest goods at dishonest markups
export const VENDOR_STOCK_SIZE = 7;
export const VENDOR_WEIGHTS: Array<[Rarity, number]> = [
  ["magic", 58],
  ["rare", 34],
  ["set", 3],
  ["unique", 3.4],
  ["legendary", 1.2],
  ["epic", 0.4],
];
export function vendorPrice(item: Item): number {
  return sellValue(item) * 5;
}

// --- potions & belts ---

export const POTION_DROP_CHANCE = 0.14;
export const POTION_HEAL = 40;
export const POTION_HEAL_PER_FLOOR = 10;
export const BOSS_POTION_DROPS = 2;

// mana potions — the caster's lifeline (blue flask, W to drink)
export const MANA_POTION_DROP_CHANCE = 0.09;
export const MANA_POTION_RESTORE_FRACTION = 0.5; // of max mana
export const BOSS_MANA_POTION_DROPS = 1;

// your belt determines how many potions you can carry, D2-style
export const BASE_POTION_CAP = 4;
export const BELT_POTION_CAP: Record<string, number> = {
  sash: 6,
  warbelt: 8,
  girdle: 8,
};

export function potionCapFor(gear: Partial<Record<EquipSlot, { base: string } | undefined>>): number {
  const belt = gear.belt;
  if (!belt) return BASE_POTION_CAP;
  return BELT_POTION_CAP[belt.base] ?? 6;
}

// --- boss signature drops (farm THE boss for THE item) ---

export const SIGNATURE_DROP_CHANCE = 0.2;
export const BOSS_SIGNATURES: Record<BossKind, string> = {
  flenser: "Hargol's Cleaver",
  corvessa: "Raven's Talon",
  maggotqueen: "Broodmother's Carapace",
  malgrim: "The Bloodline",
  vessira: "Vessira's Visage",
  vuruk: "Vuruk's Carapace",
  orvath: "The Grudgestone",
  aldric: "The Sleetbrand",
  uldrath: "The Unmaker's Edge",
  nyzat: "Nyzat's Lid",
  ssarim: "Ssarim's Riverspine",
};

export function generateFixedItem(name: string, ilvl: number, rng: () => number = Math.random): Item | null {
  const fixed = FIXED_ITEMS.find((f) => f.name === name);
  if (!fixed) return null;
  const base = BASE_ITEMS[fixed.base];
  const stats: ItemStats = {};
  addStats(stats, scaleStats(base.implicit, ilvlScale(ilvl)));
  addStats(stats, scaleStats(fixed.stats, 1 + 0.12 * (ilvl - 1)));
  return {
    id: `item_${itemSeq++}_${Math.floor(rng() * 1e6)}`,
    base: fixed.base,
    name: fixed.name,
    slot: base.slot,
    rarity: fixed.rarity,
    ilvl,
    stats,
    effect: fixed.effect,
    power: fixed.power,
  };
}

// --- item generation ---


// deeper floors roll bigger numbers
export function ilvlScale(ilvl: number): number {
  return 1 + 0.15 * (ilvl - 1);
}

function scaleStats(stats: ItemStats, mult: number): ItemStats {
  const out: ItemStats = {};
  for (const [k, v] of Object.entries(stats) as Array<[keyof ItemStats, number]>) {
    out[k] = Math.round(v * mult);
  }
  return out;
}

let itemSeq = 0;

// Magic Find saturates: each tier has a constant K and the effective MF for
// that tier is mf·K/(mf+K). K GROWS with tier depth so a deep tier's multiplier
// is always ≥ a shallow one's — magic can never outgrow unique and crowd it out
// of the table, and every tier's odds rise monotonically (but sublinearly) with
// MF. 89 MF is worth ~56 on magic and ~73 on a unique; 600 MF is worth ~120 on
// magic and ~240 on a unique. Linear MF was flattening the whole pyramid.
export const MF_SATURATION: Partial<Record<Rarity, number>> = {
  magic: 150,
  rare: 250,
  set: 350,
  unique: 400,
  legendary: 450,
  epic: 500,
};

export function effectiveMagicFind(magicFind: number, rarity: Rarity): number {
  const k = MF_SATURATION[rarity];
  if (!k || magicFind <= 0) return Math.max(0, magicFind);
  return (magicFind * k) / (magicFind + k);
}

const MYTHIC_TIERS: ReadonlySet<Rarity> = new Set(["set", "unique", "legendary", "epic"]);

export function generateItem(
  ilvl: number,
  magicFind = 0,
  rng: () => number = Math.random,
  weightTable: Array<[Rarity, number]> = RARITY_WEIGHTS,
  baseOverride?: string, // gambling: the base is promised, the rest is the roll
  mythicMult = 1 // the difficulty ladder's thumb on the scale for set+ tiers
): Item {
  const weights = weightTable.map(
    ([r, w]) =>
      [r, r === "common" ? w : w * (1 + effectiveMagicFind(magicFind, r) / 100) * (MYTHIC_TIERS.has(r) ? mythicMult : 1)] as [Rarity, number]
  );
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  let rarity: Rarity = "common";
  for (const [r, w] of weights) {
    roll -= w;
    if (roll <= 0) {
      rarity = r;
      break;
    }
  }

  if (baseOverride && !BASE_ITEMS[baseOverride]) baseOverride = undefined;

  const id = `item_${itemSeq++}_${Math.floor(rng() * 1e6)}`;
  const scale = ilvlScale(ilvl);

  if (rarity === "set") {
    const setPool = baseOverride ? SET_ITEMS.filter((piece) => piece.base === baseOverride) : SET_ITEMS;
    if (setPool.length) {
      const piece = setPool[Math.floor(rng() * setPool.length)];
      const base = BASE_ITEMS[piece.base];
      const stats: ItemStats = {};
      addStats(stats, scaleStats(base.implicit, scale));
      addStats(stats, scaleStats(piece.stats, 1 + 0.12 * (ilvl - 1)));
      return { id, base: piece.base, name: piece.name, slot: base.slot, rarity, ilvl, stats, setId: piece.setId };
    }
    rarity = "rare"; // no set piece wears this base — a rare consolation
  }

  if (rarity === "unique" || rarity === "legendary" || rarity === "epic") {
    const pool = FIXED_ITEMS.filter((f) => f.rarity === rarity && (!baseOverride || f.base === baseOverride));
    if (pool.length) {
      const fixed = pool[Math.floor(rng() * pool.length)];
      const base = BASE_ITEMS[fixed.base];
      const stats: ItemStats = {};
      addStats(stats, scaleStats(base.implicit, scale));
      addStats(stats, scaleStats(fixed.stats, 1 + 0.12 * (ilvl - 1)));
      const item: Item = { id, base: fixed.base, name: fixed.name, slot: base.slot, rarity, ilvl, stats, effect: fixed.effect, power: fixed.power };
      maybeSocket(item, ilvl, rng, true);
      return item;
    }
    rarity = "rare"; // no legend wears this base — a rare consolation
  }

  const eligible = Object.keys(BASE_ITEMS).filter((k) => BASE_ITEMS[k].minIlvl <= ilvl);
  const baseKey = baseOverride ?? eligible[Math.floor(rng() * eligible.length)];
  const base = BASE_ITEMS[baseKey];
  const stats: ItemStats = {};
  addStats(stats, scaleStats(base.implicit, scale));

  if (rarity === "common") {
    const item: Item = { id, base: baseKey, name: base.name, slot: base.slot, rarity, ilvl, stats };
    maybeSocket(item, ilvl, rng, false);
    return item;
  }

  // affix pool gated by item level — deeper floors roll stronger tiers
  const rollAffix = (pool: AffixDef[]): AffixDef => pool[Math.floor(rng() * pool.length)];
  const applied: AffixDef[] = [];
  const affixPool = AFFIXES.filter((a) => (a.minIlvl ?? 1) <= ilvl);

  if (rarity === "magic") {
    const wantPrefix = rng() < 0.65;
    const wantSuffix = !wantPrefix || rng() < 0.5;
    if (wantPrefix) applied.push(rollAffix(affixPool.filter((a) => a.kind === "prefix")));
    if (wantSuffix) applied.push(rollAffix(affixPool.filter((a) => a.kind === "suffix")));
  } else {
    const count = 3 + (rng() < 0.5 ? 1 : 0);
    const pool = [...affixPool];
    for (let i = 0; i < count && pool.length; i++) {
      const idx = Math.floor(rng() * pool.length);
      const picked = pool.splice(idx, 1)[0];
      applied.push(picked);
      if (picked.cls) {
        // at most one class-locked affix per item
        for (let j = pool.length - 1; j >= 0; j--) if (pool[j].cls) pool.splice(j, 1);
      }
    }
  }

  let classBonus: Item["classBonus"];
  for (const a of applied) {
    // some affixes (+skills, penetration) are deliberately FLAT — never ilvl-inflated
    const sc = a.flat ? 1 : scale;
    const value = Math.max(1, Math.round((a.min + rng() * (a.max - a.min)) * sc));
    const rolled: ItemStats = { [a.stat]: value };
    if (a.stat2 && a.min2 !== undefined && a.max2 !== undefined) {
      rolled[a.stat2] = Math.max(1, Math.round((a.min2 + rng() * (a.max2 - a.min2)) * sc));
    }
    if (a.cls) {
      classBonus = classBonus?.cls === a.cls ? classBonus : { cls: a.cls, stats: {} };
      addStats(classBonus.stats, rolled);
    } else {
      addStats(stats, rolled);
    }
  }

  let name: string;
  if (rarity === "magic") {
    const prefix = applied.find((a) => a.kind === "prefix");
    const suffix = applied.find((a) => a.kind === "suffix");
    name = `${prefix ? prefix.name + " " : ""}${base.name}${suffix ? " " + suffix.name : ""}`;
  } else {
    name = `${RARE_NAME_A[Math.floor(rng() * RARE_NAME_A.length)]}${RARE_NAME_B[Math.floor(rng() * RARE_NAME_B.length)]} ${base.name}`;
  }

  const item: Item = { id, base: baseKey, name, slot: base.slot, rarity, ilvl, stats, classBonus };
  maybeSocket(item, ilvl, rng, false);
  return item;
}

// runes drop whole — no affixes, their power comes from being socketed
export function generateRune(ilvl: number, rng: () => number = Math.random): Item {
  const eligible = Object.values(RUNES).filter((r) => r.minIlvl <= ilvl);
  // higher-tier runes are rarer
  const weights = eligible.map((r) => 1 / r.minIlvl);
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = rng() * total;
  let def = eligible[0];
  for (let i = 0; i < eligible.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      def = eligible[i];
      break;
    }
  }
  return {
    id: `rune_${itemSeq++}_${Math.floor(rng() * 1e6)}`,
    base: `rune_${def.id}`,
    name: `${def.name} Rune`,
    slot: "rune",
    rarity: "magic",
    ilvl,
    stats: { ...def.stats }, // display only — inert until socketed
  };
}

// jewels: cut stones for any socket — pure stats, no words. A jewel in a socket
// is a choice AGAINST a runeword: flexible power instead of the book's recipes.
export const JEWEL_DROP_CHANCE = 0.02;
const JEWEL_STATS: Array<{ name: string; roll: (s: number) => ItemStats }> = [
  { name: "Searing", roll: (s) => ({ fireDmg: Math.round(3 * s) }) },
  { name: "Glacial", roll: (s) => ({ coldDmg: Math.round(3 * s) }) },
  { name: "Charged", roll: (s) => ({ lightDmg: Math.round(4 * s) }) },
  { name: "Brutal", roll: (s) => ({ dmg: Math.round(3 * s) }) },
  { name: "Cruel", roll: (s) => ({ dmgPct: Math.round(6 * s) }) },
  { name: "Keen", roll: (s) => ({ crit: Math.round(2 * s) }) },
  { name: "Stalwart", roll: (s) => ({ maxHp: Math.round(10 * s) }) },
  { name: "Warded", roll: (s) => ({ armor: Math.round(3 * s) }) },
  { name: "Prismatic", roll: (s) => ({ allRes: Math.round(4 * s) }) },
  { name: "Thirsty", roll: (s) => ({ lifeSteal: Math.max(1, Math.round(1.5 * s)) }) },
  { name: "Quick", roll: (s) => ({ atkSpd: Math.round(4 * s) }) },
  { name: "Deep", roll: (s) => ({ maxMana: Math.round(8 * s) }) },
];

export function generateJewel(ilvl: number, magicFind = 0, rng: () => number = Math.random): Item {
  const s = 1 + 0.1 * (Math.max(1, ilvl) - 1);
  const rareChance = Math.min(0.6, 0.25 * (1 + magicFind / 100));
  const rarity: Rarity = rng() < rareChance ? "rare" : "magic";
  const facets = rarity === "rare" ? 2 + (rng() < 0.5 ? 1 : 0) : 1 + (rng() < 0.35 ? 1 : 0);
  const pool = [...JEWEL_STATS];
  const stats: ItemStats = {};
  let firstName = "";
  for (let i = 0; i < facets && pool.length; i++) {
    const pick = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    if (!firstName) firstName = pick.name;
    addStats(stats, pick.roll(s));
  }
  return {
    id: `jewel_${itemSeq++}_${Math.floor(rng() * 1e6)}`,
    base: "jewel",
    name: `${firstName} Jewel${facets > 2 ? " of Many Facets" : facets === 2 ? " of Facets" : ""}`,
    slot: "jewel",
    rarity,
    ilvl,
    stats,
  };
}

// the most sockets an item can take at a given ilvl — deep floors reach the coveted 4
export function maxSockets(ilvl: number): number {
  return Math.min(4, 1 + Math.floor(ilvl / 3));
}

// roll sockets onto eligible gear
function maybeSocket(item: Item, ilvl: number, rng: () => number, fixed: boolean) {
  if (!SOCKETABLE_SLOTS.includes(item.slot as Slot)) return;
  if (fixed) {
    if (rng() < FIXED_SOCKET_CHANCE) item.sockets = 1;
    return;
  }
  // plain steel is the runeword economy: commons socket at nearly triple the rate
  const chance = item.rarity === "common" ? SOCKET_CHANCE * 2.8 : SOCKET_CHANCE;
  if (rng() < chance) {
    // deep floors can roll the coveted 4-socket base (Anima and Worldsedge await)
    item.sockets = 1 + Math.floor(rng() * maxSockets(ilvl));
  }
}

// Torvald's forge: he punches sockets into bare gear (the reliable counterpart to
// the drop-table gamble). Only identified, socketable, still-unsocketed steel qualifies.
export function canPunchSockets(item: Pick<Item, "slot" | "sockets" | "unidentified">): boolean {
  return SOCKETABLE_SLOTS.includes(item.slot as Slot) && !item.sockets && !item.unidentified;
}

// the smith's fee to fill an item to its maximum sockets — a steep, ilvl-scaled gold sink
export function socketPunchCost(ilvl: number): number {
  return 200 + 90 * Math.max(0, ilvl - 1);
}

// the fee to pull every stone back out — cheaper than punching; the sockets stay empty
export function unsocketCost(ilvl: number): number {
  return 60 + 30 * Math.max(0, ilvl - 1);
}

// does this item have any seated stones to pull? (the unsocket half of the forge)
export function hasSeatedStones(item: Pick<Item, "runes" | "jewels">): boolean {
  return (item.runes?.length ?? 0) + (item.jewels?.length ?? 0) > 0;
}

// the Ternion Altar's reforge: gamble an item's affixes for a fresh roll at the same base/rarity/ilvl.
// only rolled gear qualifies — identified magic or rare, with no seated stones to lose. (Set/unique+
// are hand-designed and can't be rerolled; commons have nothing to roll; runes/charms/jewels aren't gear.)
export function canReforge(item: Pick<Item, "rarity" | "slot" | "unidentified" | "runes" | "jewels">): boolean {
  if (item.rarity !== "magic" && item.rarity !== "rare") return false;
  if (item.unidentified) return false;
  if (item.slot === "rune" || item.slot === "charm" || item.slot === "jewel") return false;
  return !hasSeatedStones(item);
}

// reforge fee: a steep, ilvl-scaled gold sink — rares cost far more than magics to re-roll
export function reforgeCost(ilvl: number, rarity: Rarity): number {
  const flat = rarity === "rare" ? 400 : 150;
  const per = rarity === "rare" ? 120 : 60;
  return flat + per * Math.max(0, ilvl - 1);
}

// charms roll magic (70%) or rare (30%); magic find nudges toward rare
export function generateCharm(ilvl: number, magicFind = 0, rng: () => number = Math.random): Item {
  const base = CHARM_BASES[Math.floor(rng() * CHARM_BASES.length)];
  const rareChance = Math.min(0.7, 0.3 * (1 + magicFind / 100));
  const rarity: Rarity = rng() < rareChance ? "rare" : "magic";
  const id = `charm_${itemSeq++}_${Math.floor(rng() * 1e6)}`;
  const scale = ilvlScale(ilvl) * base.power;

  const stats: ItemStats = {};
  const pool = AFFIXES.filter((a) => !a.cls && (a.minIlvl ?? 1) <= ilvl); // charms skip class affixes
  const applied: AffixDef[] = [];
  for (let i = 0; i < base.affixes && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    const a = pool.splice(idx, 1)[0];
    applied.push(a);
    const value = Math.max(1, Math.round((a.min + rng() * (a.max - a.min)) * scale));
    addStats(stats, { [a.stat]: value });
  }

  const first = applied[0];
  const name =
    rarity === "rare"
      ? `${RARE_NAME_A[Math.floor(rng() * RARE_NAME_A.length)]}${RARE_NAME_B[Math.floor(rng() * RARE_NAME_B.length)]} ${base.name}`
      : first.kind === "prefix"
        ? `${first.name} ${base.name}`
        : `${base.name} ${first.name}`;

  return { id, base: base.key, name, slot: "charm", rarity, ilvl, stats };
}
