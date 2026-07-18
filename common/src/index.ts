// Shared game logic — imported by both server (authoritative) and client (rendering/prediction).

export const TICK_RATE = 20; // server simulation ticks per second
export const PLAYER_SPEED = 170; // world units per second
export const PLAYER_RADIUS = 8; // collision radius in world units

// World space is flat top-down 2D; one tile = TILE x TILE world units.
// The client projects world space to isometric screen space (TILE_W x TILE_H diamonds).
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

export const BOSS_KIND_LIST = [
  "flenser", "corvessa", "maggotqueen", "malgrim",
  "vessira", "vuruk", "orvath", "aldric", "uldrath", "nyzat", "ssarim",
] as const;
export type BossKind = (typeof BOSS_KIND_LIST)[number];

export function isBossKind(kind: string): boolean {
  return (BOSS_KIND_LIST as readonly string[]).includes(kind) || kind === "bovax";
}

// each depth band rotates its guardians floor by floor — every descent meets a different evil
export const BOSS_BANDS: BossKind[][] = [
  ["flenser", "vessira"],
  ["corvessa", "vuruk"],
  ["maggotqueen", "orvath"],
  ["malgrim", "aldric", "uldrath"],
];

export function bossKindForFloor(floor: number): BossKind {
  const band = BOSS_BANDS[themeIndexForFloor(floor)];
  return band[(floor - 1) % band.length];
}

export const BOSS_NAMES: Record<BossKind | "bovax", string> = {
  flenser: "Hargol the Flenser",
  corvessa: "Corvessa, the Carrion Bride",
  maggotqueen: "The Maggot Queen",
  malgrim: "Malgrim, the King of Dread",
  vessira: "Vessira, the Thorned Maiden",
  vuruk: "Vuruk, the White Maw",
  orvath: "Orvath, the Grudge Eternal",
  aldric: "Aldric the Forsworn",
  uldrath: "Uldrath, the Unmaker",
  bovax: "Bovax, Tyrant of the Meadow",
  nyzat: "Queen Nyzat, the Embalmed",
  ssarim: "Ssarim, the Drowned God",
};

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

// --- trading: two heroes, one handshake, no take-backs ---

export const TRADE_RANGE = 160; // partners must stand this close — and stay close
export const TRADE_MAX_ITEMS = 6; // offered items per side, per deal
export const TRADE_INVITE_TTL_MS = 30000; // unanswered invites expire

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

// --- items ---

export type Slot = "weapon" | "offhand" | "helm" | "chest" | "ring" | "amulet" | "belt" | "boots";

export type EquipSlot = Exclude<Slot, "ring"> | "ring1" | "ring2";
export const EQUIP_SLOTS: EquipSlot[] = [
  "weapon", "offhand", "helm", "chest", "ring1", "ring2", "amulet", "belt", "boots",
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

export interface ItemStats {
  dmg?: number;
  dmgPct?: number;
  armor?: number;
  maxHp?: number;
  maxMana?: number;
  atkSpd?: number;
  moveSpd?: number;
  regen?: number;
  magicFind?: number;
  // advanced attributes
  crit?: number; // % chance to deal double damage
  lifeSteal?: number; // % of damage dealt returned as life
  manaSteal?: number; // % of damage dealt returned as mana
  thorns?: number; // flat damage reflected to melee attackers
  fireDmg?: number; // flat fire damage added to attacks
  coldDmg?: number; // flat cold damage — also chills targets
  lightDmg?: number; // lightning: adds 0..2N random damage (swingy, D2-style)
  xpBonus?: number; // % bonus experience
  goldFind?: number; // % more gold from kills
  cdr?: number; // % cooldown reduction (attacks + skills, capped 40%)
  potionPower?: number; // % stronger health potions
  dodge?: number; // % chance to avoid a hit entirely (capped)
  manaRegen?: number; // bonus mana per second
  fireRes?: number; // % fire damage reduction (capped)
  coldRes?: number; // % cold damage reduction — also shortens chills
  lightRes?: number; // % lightning damage reduction
  allRes?: number; // adds to all three
  plusSkills?: number; // +N ranks to every skill you've learned (never enables an unlearned one)
  penetration?: number; // % of a monster's elemental resistance your attacks ignore
}

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

export interface Runeword {
  name: string;
  runes: string[]; // exact order, must fill every socket
  slots: Slot[];
  bonus: ItemStats;
  effect?: string;
}

export const RUNEWORDS: Runeword[] = [
  { name: "Warbrand", runes: ["ond", "vek"], slots: ["weapon"], bonus: { dmg: 6, atkSpd: 15, crit: 3 } },
  { name: "Ghoststep", runes: ["ond", "fyr"], slots: ["chest", "helm"], bonus: { moveSpd: 15, atkSpd: 10, cdr: 5 } },
  { name: "Kindling", runes: ["ond", "fyr"], slots: ["weapon"], bonus: { fireDmg: 10, maxMana: 10 } },
  { name: "Scholar", runes: ["zel", "kel"], slots: ["helm"], bonus: { maxMana: 15, lightDmg: 5, xpBonus: 5 } },
  { name: "Oathward", runes: ["fyr", "zel", "vek"], slots: ["offhand"], bonus: { allRes: 13, armor: 6 } },
  { name: "King's Purse", runes: ["mur", "ash"], slots: ["chest"], bonus: { goldFind: 40, magicFind: 10 } },
  { name: "Clarity", runes: ["fyr", "kel", "vor"], slots: ["weapon", "offhand"], bonus: { maxMana: 30, regen: 3 }, effect: "arcane_surge" },
  { name: "Ruin", runes: ["vor", "karn"], slots: ["weapon"], bonus: { dmgPct: 30, fireDmg: 8 }, effect: "corpse_explosion" },
  // the one everyone farms four sockets for
  { name: "Anima", runes: ["ond", "hym", "zel", "vor"], slots: ["weapon", "offhand"], bonus: { dmgPct: 20, maxMana: 25, cdr: 10, moveSpd: 10 }, effect: "arcane_surge" },
  // the deep book: words for the sharpened worlds
  { name: "Mournfield", runes: ["vek", "hym", "vek"], slots: ["chest"], bonus: { armor: 8, coldRes: 15, maxHp: 20 } },
  { name: "Sunscar", runes: ["fyr", "fyr", "tor"], slots: ["weapon"], bonus: { fireDmg: 14, dmgPct: 15 }, effect: "immolation" },
  { name: "Undertow", runes: ["hym", "mur", "vor"], slots: ["weapon"], bonus: { coldDmg: 10, maxMana: 15, lifeSteal: 2 }, effect: "frostnova_on_hit" },
  { name: "Gravemeal", runes: ["vor", "vor", "kel"], slots: ["weapon"], bonus: { lifeSteal: 4, dmg: 8 }, effect: "bleed" },
  { name: "Stormlaw", runes: ["zel", "zel", "karn"], slots: ["weapon"], bonus: { lightDmg: 16, crit: 5 }, effect: "lightning_storm" },
  { name: "Hearthlight", runes: ["fyr", "vek", "mur"], slots: ["helm"], bonus: { maxHp: 15, maxMana: 15, fireRes: 15 } },
  { name: "Bulwark", runes: ["vek", "vek", "ghal"], slots: ["offhand"], bonus: { armor: 12, allRes: 8, thorns: 4 }, effect: "frost_armor" },
  { name: "Winterking", runes: ["hym", "ghal", "skol"], slots: ["weapon"], bonus: { coldDmg: 18, dmgPct: 12 }, effect: "frostnova_on_hit" },
  { name: "The Drought", runes: ["bren", "tor", "fyr"], slots: ["weapon"], bonus: { fireDmg: 20, dmgPct: 18, atkSpd: 8 }, effect: "corpse_explosion" },
  { name: "Nightparish", runes: ["ghal", "vael", "hym"], slots: ["chest"], bonus: { allRes: 12, lifeSteal: 2, maxHp: 25 }, effect: "second_wind" },
  { name: "Stonewill", runes: ["thurn", "vek", "ghal"], slots: ["helm"], bonus: { armor: 8, allRes: 6, maxHp: 18 }, effect: "mana_shield" },
  { name: "Sanctum", runes: ["ulth", "ghal", "thurn"], slots: ["offhand"], bonus: { armor: 14, allRes: 14, maxHp: 20 }, effect: "aegis" },
  { name: "Kingslayer", runes: ["drov", "karn", "kel", "rok"], slots: ["weapon"], bonus: { dmgPct: 30, crit: 8, dmg: 10 }, effect: "giantslayer" },
  { name: "Thornparade", runes: ["thurn", "vael", "drov"], slots: ["chest"], bonus: { armor: 10, thorns: 8, dmgPct: 10 }, effect: "adrenaline" },
  { name: "Worldsedge", runes: ["thurn", "drov", "ulth", "karn"], slots: ["weapon"], bonus: { dmgPct: 35, crit: 6, allRes: 8, dmg: 12 }, effect: "executioner" },
  // the second book — armor gets its due, and two more four-socket grails for the deep
  { name: "Wardvigil", runes: ["zel", "hym", "ghal"], slots: ["helm"], bonus: { allRes: 10, maxMana: 20, dodge: 4 } },
  { name: "Mindspire", runes: ["kel", "zel", "mur"], slots: ["helm"], bonus: { maxMana: 30, manaRegen: 4, cdr: 8 }, effect: "arcane_surge" },
  { name: "Ironbark", runes: ["thurn", "ghal", "vek"], slots: ["chest"], bonus: { armor: 14, maxHp: 30, thorns: 6 }, effect: "frost_armor" },
  { name: "Tidecaller", runes: ["hym", "mur", "kel"], slots: ["offhand"], bonus: { coldDmg: 12, maxMana: 20, allRes: 8 }, effect: "frostnova_on_hit" },
  { name: "Lightward", runes: ["zel", "ghal", "vek"], slots: ["offhand"], bonus: { lightRes: 20, armor: 8, cdr: 6 } },
  { name: "Wyrmtongue", runes: ["fyr", "tor", "bren"], slots: ["weapon"], bonus: { fireDmg: 18, dmgPct: 16 }, effect: "immolation" },
  { name: "Soulcinder", runes: ["vor", "kel", "zhar"], slots: ["weapon"], bonus: { dmg: 10, lifeSteal: 4, dmgPct: 14 }, effect: "corpse_explosion" },
  { name: "Doomsayer", runes: ["karn", "drov", "thurn", "kel"], slots: ["weapon"], bonus: { dmgPct: 32, crit: 7, lifeSteal: 3, dmg: 12 }, effect: "executioner" },
  { name: "Everstorm", runes: ["zel", "zhar", "karn", "vor"], slots: ["weapon"], bonus: { lightDmg: 22, dmgPct: 18, crit: 6 }, effect: "lightning_storm" },
  { name: "Sanctuary", runes: ["ghal", "thurn", "ulth", "vek"], slots: ["chest"], bonus: { armor: 16, allRes: 16, maxHp: 30 }, effect: "aegis" },
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
};

interface AffixDef {
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

const RARE_NAME_A = ["Storm", "Blood", "Grim", "Doom", "Shadow", "Iron", "Raven", "Bone"];
const RARE_NAME_B = ["fang", "ward", "song", "grip", "bane", "veil", "howl", "brand"];

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
];

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

// ============================================================
// --- storytelling: town dialogue windows + dungeon encounters ---
// The world's grim arc, told in the D1/D2 way: a talking-head window,
// paged text, and a few topics per speaker. Content is client-rendered
// from these tables (the client knows the NPC, the act, and your progress).
// ============================================================

// one subject an NPC will speak on; pages are shown one at a time.
// pagesByAct lets a townsperson's mood darken as you travel east.
export interface DialogueTopic {
  id: string;
  label: string; // the menu button
  pages: string[]; // default script
  pagesByAct?: Record<number, string[]>; // act-specific override
}

// a person you can talk to in town. Functional NPCs carry a shop button;
// storytellers are talk-only and appear ONLY in their own act's town.
export interface TownNpc {
  id: string; // resolved from the shrine (see shrineNpcId)
  name: string; // header of the dialogue window
  shopKind?: "vendor" | "gamble" | "alchemist" | "mercnpc"; // absent → talk-only
  shopLabel?: string; // the shop button text
  smith?: boolean; // offers the socket-punching forge (a second service button)
  storytellerAct?: number; // set for the act-scoped elders
  figure?: string; // client silhouette hint for talk-only townsfolk (elder|witch|child|priest|fisher|warden|keeper|squire)
  topics: DialogueTopic[];
}

// resolve a topic's script for the current act
export function topicPages(t: DialogueTopic, act: number): string[] {
  return t.pagesByAct?.[act] ?? t.pages;
}

// map a town shrine to the person standing on it
export function shrineNpcId(kind: string, variant: string): string {
  if (kind === "vendor") return "torvald";
  if (kind === "gamble") return "fenwick";
  if (kind === "alchemist") return "lysa";
  if (kind === "mercnpc")
    return ({ rogue: "maren", mage: "orsavio", barbarian: "hrothgar", paladin: "iseult" } as Record<string, string>)[variant] ?? "maren";
  if (kind === "storyteller") return variant;
  if (kind === "barkeep") return variant; // the bartender / hut resident carries its own id
  return "";
}

// the folk who keep the indoors warm: a barkeep behind every tavern's counter and a
// resident by every hut's fire — a different pair in each act's town, talk-only.
export const TAVERN_KEEPERS = ["brannoch", "sedira", "gullimon", "old_hesk"]; // act 1..4
export const HUT_RESIDENTS = ["mabel", "amara", "wickem", "greta"]; // act 1..4
export function tavernKeeperFor(act: number): string {
  return TAVERN_KEEPERS[Math.min(Math.max(act, 1), TAVERN_KEEPERS.length) - 1];
}
export function hutResidentFor(act: number): string {
  return HUT_RESIDENTS[Math.min(Math.max(act, 1), HUT_RESIDENTS.length) - 1];
}

// the act's storyteller — a new face in every land, sat by the campfire
export const STORYTELLERS = ["edric", "halqa", "vaol", "cael"]; // act 1..4 (abyss borrows the last)
export function storytellerFor(act: number): string {
  return STORYTELLERS[Math.min(Math.max(act, 1), STORYTELLERS.length) - 1];
}

// every act keeps its own talk-only townsfolk — the elder plus two locals — each
// standing at a fixed town slot, present ONLY while you walk that act. The three
// slots (elder / loremaster / warband tiles) are reused act to act.
export type ActNpcTile = "elder" | "loremaster" | "warband";
export const ACT_TOWN_NPCS: Record<number, Array<{ id: string; tile: ActNpcTile }>> = {
  1: [{ id: "edric", tile: "elder" }, { id: "senna", tile: "loremaster" }, { id: "pip", tile: "warband" }],
  2: [{ id: "halqa", tile: "elder" }, { id: "jenda", tile: "loremaster" }, { id: "ashk", tile: "warband" }],
  3: [{ id: "vaol", tile: "elder" }, { id: "oona", tile: "loremaster" }, { id: "deel", tile: "warband" }],
  4: [{ id: "cael", tile: "elder" }, { id: "adelheid", tile: "loremaster" }, { id: "tomas", tile: "warband" }],
};
export function actTownNpcs(act: number): Array<{ id: string; tile: ActNpcTile }> {
  return ACT_TOWN_NPCS[Math.min(Math.max(act, 1), 4)];
}

export const TOWN_NPCS: TownNpc[] = [
  // ---- the smith ----
  {
    id: "torvald", name: "Torvald", shopKind: "vendor", shopLabel: "Browse his wares", smith: true,
    topics: [
      { id: "steel", label: "Your steel", pages: [
        "\"You bring me the dead's leavings and call it shopping. Fine. Fine. It all sharpens the same.\"",
        "\"Steel remembers the hand that swung it. I hammer that out before I sell it to you. Mostly.\"",
        "\"Bring me runes and a clean blade and I'll tell you what word wants to live in it. Some words are hungry.\"",
      ]},
      { id: "town", label: "Hollowmere", pages: ["placeholder"], pagesByAct: {
        1: [
          "\"Hollowmere held when the cathedral fell. We built the wall in a night and a day. It held.\"",
          "\"Every soul east of here came through my gate first. Fewer come back through it. You will, though. You've the look.\"",
        ],
        2: [
          "\"Word came up the road — Zerath's wells are running black. My cousin drew water there. Drew it, and screamed.\"",
          "\"The forge stays lit. It's the only honest light left between here and the sand. Keep it at your back as long as you can.\"",
        ],
        3: [
          "\"They say the green country is drowning now. A whole land, going under, slow. I don't sleep much, hearing that.\"",
          "\"I put an extra bar on the gate last night. Old habit. As if a bar keeps out water. As if it keeps out him.\"",
        ],
        4: [
          "\"You've been to the Throne's doorstep and come back to buy a belt. There's something wrong with you. Good. Stay wrong.\"",
          "\"When you go down for the last of them — take the best steel I have. Don't haggle. Not for this one.\"",
        ],
      }},
    ],
  },
  // ---- the alchemist ----
  {
    id: "lysa", name: "Lysa", shopKind: "alchemist", shopLabel: "Buy flasks",
    topics: [
      { id: "flasks", label: "Her flasks", pages: [
        "\"Red for the body, blue for the mind. Drink the wrong one at the wrong time and you'll wish you'd bled out instead.\"",
        "\"I brewed these from marsh-root and worse. Don't ask what worse. You'd stop buying, and then you'd die, and then where would we be.\"",
      ]},
      { id: "dead", label: "The green ones", pages: [
        "\"You've seen the ones that don't stay down. The green ones. The bloated ones. It isn't sickness. Sickness ends.\"",
        "\"I cut one open once, to learn it. There was nothing inside that wanted to be a body. It just... insisted. That's the whole of it. It insists.\"",
        "\"So I make my flasks stronger every season. It isn't enough. It's never quite enough. Buy two.\"",
      ]},
    ],
  },
  // ---- the peddler / gamble ----
  {
    id: "fenwick", name: "Fenwick", shopKind: "gamble", shopLabel: "Try his gamble",
    topics: [
      { id: "gamble", label: "The gamble", pages: [
        "\"Pay, and pray. That's the whole arrangement. I sell you the wrapping; the dark inside is between you and your luck.\"",
        "\"I've handed a beggar a king's blade and a king a beggar's rag, same afternoon, same price. The road's fair like that. Fair and cruel.\"",
      ]},
      { id: "past", label: "Where he's from", pages: [
        "\"Where am I from? East. Always east of wherever you catch me. I keep one town ahead of the rot, and one behind the questions.\"",
        "\"I had a stall in Zerath, before the wells turned. And a table in the green country, before it went under. I do not go back for the merchandise. You understand.\"",
      ]},
    ],
  },
  // ---- the four hiring captains ----
  {
    id: "maren", name: "Captain Maren", shopKind: "mercnpc", shopLabel: "Recruit a Warden",
    topics: [
      { id: "wardens", label: "The Wardens", pages: [
        "\"The Wardens of the Sightless Eye. We were a hundred and twelve. You could hire any of the ones who are left. There are twelve.\"",
        "\"They shoot straight and they die quiet. Pay their bond, treat them well, and if they fall — come back to me. I'll raise them. It costs. Grief always does.\"",
      ]},
      { id: "corvessa", label: "Corvessa", pages: [
        "\"You'll meet a pale woman with a bow in the Mournfield. Corvessa. She was one of ours, once. The best of us.\"",
        "\"Then she went down into the cathedral to bring back the dead sisters, and she brought them back, and now she leads them. Cold arrows. She sings while she looses. Don't listen to the song.\"",
        "\"If you put her down — and you won't, but if — you tell her Maren remembers who she was. Then you burn her. Promise me the burning.\"",
      ]},
    ],
  },
  {
    id: "orsavio", name: "Orsavio, the Exiled Magus", shopKind: "mercnpc", shopLabel: "Recruit an acolyte",
    topics: [
      { id: "ternion", label: "The Ternion", pages: [
        "\"You've used the Altar in the square? Three runes, one greater. Three trinkets, one truth. That is Ternion work — the old order of threes.\"",
        "\"They transmuted the world in careful sets, and asked what the world would give in exchange. The world answered. The order is gone. The altar remains. Draw your own moral.\"",
      ]},
      { id: "exile", label: "His exile", pages: [
        "\"I am called exiled. Correct. I taught my acolytes to feel the shape of what is under the floors — to listen down. My tower listened back.\"",
        "\"They cast me out before it could open. So now I sell you children with candle-fire in their hands and I sleep in a town like everyone else, and I do not listen down. I do not. Some nights I nearly don't.\"",
      ]},
    ],
  },
  {
    id: "hrothgar", name: "Hrothgar, Chief of the Fells", shopKind: "mercnpc", shopLabel: "Recruit a warrior",
    topics: [
      { id: "kragmar", label: "Mount Kragmar", pages: [
        "\"My people swear by the Mountain. Kragmar. It stood before the Hollow Kings and it will stand after — that is the oath, and I have started to doubt it, and doubt is a new thing for me.\"",
        "\"I lead a warband down off the high fells because the cold that comes up out of these floors is not honest cold. It hates. Mountain cold does not hate. This does.\"",
      ]},
      { id: "warriors", label: "His warriors", pages: [
        "\"You want a big man with an axe at your shoulder. Sensible. Mine wade in where your archers won't. They soak the blow so you don't.\"",
        "\"They fight to the death and past it, and they do not thank you for the wage. Feed them, point them at something worth killing, and stay out of the arc.\"",
      ]},
    ],
  },
  {
    id: "iseult", name: "Dame Iseult, the Last Vigil", shopKind: "mercnpc", shopLabel: "Recruit a knight",
    topics: [
      { id: "vigil", label: "The Vigil", pages: [
        "\"The Last Vigil is the garrison at the foot of the Hollow Throne. We were the wall between the Kings and the rest of the world. Were.\"",
        "\"I keep a stall in a warm town and hire out knights because the wall has already fallen and someone has to make it mean something. So: take a knight. Make it mean something.\"",
      ]},
      { id: "aldric", label: "Aldric", pages: [
        "\"Below the Throne you'll find a knight in blackened plate. Aldric. He commanded the Vigil before me. He was the best of us — devout, unbending, kind, even.\"",
        "\"He went down to parley with the Kings and win us terms. He won terms. The terms were: kneel. He kneeled. 'I remember the light,' he'll tell you. 'I chose this.' Kill him gently, if you can. He was better than any of us.\"",
      ]},
    ],
  },

  // ==================================================================
  // ---- the storytellers: one elder per act (talk-only, act-scoped) ----
  // ==================================================================
  {
    id: "edric", name: "Edric the Elder", storytellerAct: 1, figure: "elder",
    topics: [
      { id: "land", label: "This land", pages: [
        "\"Sit. My legs are older than the wall. The Mournfield, you want to know about. It was only a forest, boy. Only a wood, with only wolves in it.\"",
        "\"Then the cathedral on the hill went quiet in the space of one winter. The bells stopped. The candles kept burning — you'll see, they burn without wicks now — and the wood began to weep.\"",
        "\"We named it the Mournfield after that. A whole country renamed for its grief. That is how far along we were before anyone thought to fight.\"",
      ]},
      { id: "boss", label: "The one below", pages: [
        "\"On the cathedral steps there is a thing with a butcher's apron and too many hooks. Hargol. The Flenser. He was the sexton, once — the man who kept the dead decent.\"",
        "\"Now he keeps them on hooks. 'Meat for the hooks,' he says, and he means you. Go around him if you're wise. You are not wise; you're a hero. So sharpen up.\"",
        "\"And deeper still, past the nave, the Thorned Maiden waits. Vessira. 'Every wound you carry, I planted.' She ends this act, and everything she says is true, which is the worst of her.\"",
      ]},
      { id: "dark", label: "The dark below", pages: [
        "\"You want the whole of it. All right. Three kings — brothers — went down into the deep floors an age ago and gave away their names to what lives there. Malgrim. Aldric. Uldrath.\"",
        "\"Nameless now, and crowned, they are unmaking the world from underneath. Slowly. Land by land. First the Mournfield. Then the wastes. Then the green. Each land is the rot a little further gone.\"",
        "\"You go down to cut it at the root. But every root you cut, the road opens deeper — toward the last of them. Toward Uldrath, who is what remains when all else is finished. I am too old to see the end of you. Go be seen.\"",
      ]},
    ],
  },
  {
    id: "halqa", name: "Halqa, the Sand-Blind", storytellerAct: 2, figure: "witch",
    topics: [
      { id: "land", label: "This land", pages: [
        "\"You smell the salt under the sand? Good nose. Zerath was green, traveler. A garden-country, wells like blue coins in every square. I saw it. Then I stopped seeing anything, which is its own mercy.\"",
        "\"The sand came up from below, not down from the sky. It drank the wells from underneath. Now the oasis is one green thumbnail pressed on a dead hand, and we call it home because the alternative is admitting it.\"",
        "\"I read the past in the grains now. It runs through my fingers, all of it, everyone who drowned in dry sand. There are a great many. Careful where you kneel out there. You'll be kneeling on people.\"",
      ]},
      { id: "boss", label: "The one below", pages: [
        "\"Under the Necropolis sits Queen Nyzat. The Embalmed. She ruled Zerath in the green days and she would not let it die, so she wore it — wore the whole drowning garden as a burial shroud, and lay down in the tombs, and waited.\"",
        "\"'I have worn this sand for a thousand years,' she'll tell you. She is not lying. She is never quite dead and never quite alive, and her children hatch out of the walls. Bring fire and patience.\"",
      ]},
      { id: "dark", label: "The dark below", pages: [
        "\"The old man in Hollowmere told you about the Kings, yes? Then you know the shape. Let me tell you the weight of it. The Mournfield grieved. Here, we are past grief. Here it is thirst.\"",
        "\"The rot does not conquer a land. It convinces it. It whispers to the ground until the ground agrees to stop being green. Zerath agreed. That is the horror — not that it was taken, but that it consented.\"",
        "\"Go down. Cut the root. But do not listen too long to anything down there. The wells listened. The gardens listened. Look what listening bought them.\"",
      ]},
    ],
  },
  {
    id: "vaol", name: "Vaol the Ferryman", storytellerAct: 3, figure: "fisher",
    topics: [
      { id: "land", label: "This land", pages: [
        "\"Mind the plank. The whole Landing floats now — Mirefall, they call it, because it fell into the mire and had the decency to keep its porch above water. Barely.\"",
        "\"The Drowned Green was the richest country in the world. Too much water, too much life. It could not hold all that living, so the ground gave way and it all poured downward, into the dark, still growing as it went.\"",
        "\"I pole the dead across the shallows for coin, when there is coin. When there is not, I pole them anyway. Someone has to. They get so lonely, drifting.\"",
      ]},
      { id: "boss", label: "The one below", pages: [
        "\"At the heart of the Ziggurat sits Ssarim. They call him the Drowned God, and I will not tell you he isn't one. He was the river's spirit, back when the river was only a river.\"",
        "\"'The river only ever asks once,' he says. It's true. It asked the green country for everything, once, and the country said yes without hearing the question. He'll ask you too. Keep your mouth shut and your blade wet.\"",
      ]},
      { id: "dark", label: "The dark below", pages: [
        "\"Three lands now you've watched go under, if you've eyes. Grief, then thirst, then the drowning. You feel the pattern tightening? It's a throat, closing. And we are the last of the swallow.\"",
        "\"The Kings do not hurry. That's what no one tells you. They have all the time there is, because they are what's left when time is finished. Every year you don't stop them is a year cheaper to them than to you.\"",
        "\"West of here the last garrison still stands — the Vigil, at the foot of the Throne itself. If you're going to matter, matter there. I'll keep a place on the boat for you. I keep a place for everyone. That's the trouble.\"",
      ]},
    ],
  },
  {
    id: "cael", name: "Brother Cael, the Last Watch", storytellerAct: 4, figure: "warden",
    topics: [
      { id: "land", label: "This land", pages: [
        "\"Keep your voice down. The Throne hears far, this close. You've reached the Last Vigil — the final warm stone before the seat of the Hollow Kings. There is no land past this. Only the descent, and the end of it.\"",
        "\"I am the last of the watch. The others went down the stair, one by one, to hold the line a little lower, and none came back up it. I stayed to ring the bell if the end came. I have my hand on the rope most nights.\"",
      ]},
      { id: "boss", label: "The ones below", pages: [
        "\"Three wait for you now, and they are the whole of the sickness. Aldric first — our own commander, in blackened plate. 'I remember the light. I chose this.' Grant him the mercy of a clean death.\"",
        "\"Then Malgrim, King of Dread, first of the brothers to give his name away. His fear comes off him like heat. And at the very bottom — Uldrath. The Unmaker. The last brother. The last thing.\"",
        "\"'I am what remains when all else is finished.' That's Uldrath. Kill the other two and the road opens to him, and past him there is nothing but the Abyss, which has no bottom and no boss and no mercy. Win here, or there is no here.\"",
      ]},
      { id: "dark", label: "The end of it", pages: [
        "\"You've walked the whole throat of it now — the grieving wood, the thirsting waste, the drowning green — and it all narrows to this stair. Everything the rot has eaten, it ate to reach this. To reach the making of the world, and unmake it.\"",
        "\"I have watched a hundred heroes take this stair. I rang no bell for any of them, because the end never came — only their ends. Maybe that is a kind of hope. Maybe the bell is meant to stay silent, one hero at a time, forever.\"",
        "\"Go down, then. Unmake the Unmaker. And if the world is still here in the morning — do not thank me. Thank the stair, and everyone already on it.\"",
      ]},
    ],
  },

  // ==================================================================
  // ---- two more townsfolk per act (talk-only, act-scoped) ----
  // Each land keeps its own faces, met only while you walk that act.
  // ==================================================================

  // ---- Act I: the Mournfield / Hollowmere ----
  {
    id: "senna", name: "Senna the Herb-Witch", storytellerAct: 1, figure: "witch",
    topics: [
      { id: "wood", label: "The wood", pages: [
        "\"You've been out under the boughs. Good. Then you've felt it — the wood watching, the way a sickroom watches the door. It wasn't always so. I gathered nightbell out there as a girl and the worst I met was a fox.\"",
        "\"Now I hang rowan on every lintel in Hollowmere and it does nothing, and I hang it anyway. That's what faith is, out here. Doing the nothing that's left to do.\"",
      ]},
      { id: "remedy", label: "A remedy", pages: [
        "\"You want something for the dreams. Everyone wants something for the dreams. I'll tell you what I tell them: the dreams aren't yours. They're the land's, and you're only sleeping in it.\"",
        "\"Boil marrowroot if you must sleep. But not too deep. The ones who sleep deep down here don't always trouble to come back up.\"",
      ]},
    ],
  },
  {
    id: "pip", name: "Pip, the Gravedigger's Boy", storytellerAct: 1, figure: "child",
    topics: [
      { id: "graves", label: "The graves", pages: [
        "\"I dig 'em. Somebody's got to and it's me, on account of I'm small and quick and don't ask much. Old Corliss taught me before he went in one himself. I dug his. Made it nice.\"",
        "\"Here's the thing nobody likes when I say it: I dig 'em twice now. Once to put 'em in. Once when they've climbed back out and I have to go and put 'em in again. The second hole is always deeper. You learn.\"",
      ]},
      { id: "quiet", label: "Being quiet", pages: [
        "\"You get good at being quiet, this work. Quiet enough the dead forget you're there. I could stand in your own shadow and you'd not know it.\"",
        "\"That's how I know things. I'm quiet, and I listen, and the grown folk talk over my head like I'm a fencepost. So I know Hargol was the sexton. I know what a sexton is. I know I'm the sexton now, really. Somebody's got to be.\"",
      ]},
    ],
  },

  // ---- Act II: the Sunscar Wastes / Zerath Oasis ----
  {
    id: "jenda", name: "Jenda, the Water-Warden", storytellerAct: 2, figure: "warden",
    topics: [
      { id: "ration", label: "The ration", pages: [
        "\"One cup, one soul, one sundown. That's the law of the last well, and I am the law, and I have turned away children with it. Don't look at me like that. A cup for a crying child today is two dead of thirst tomorrow. I have done that arithmetic more than any person should.\"",
        "\"You've coin and a strong arm, so you'll not go dry. But mark the ones who ration. We're not cruel. We're just the last ones still counting.\"",
      ]},
      { id: "wells", label: "The black wells", pages: [
        "\"There were forty wells in Zerath when I was small. Blue as promises, every one. They didn't dry, understand — drying is honest, drying is the sun. These went black. From the bottom. As if something below had a thirst of its own, and better arithmetic than mine.\"",
        "\"I keep the last one because it's still blue. Every morning I look down it first thing, before I let anyone drink. To be sure it's still blue. One morning it won't be. I try not to think about that morning.\"",
      ]},
    ],
  },
  {
    id: "ashk", name: "Brother Ashk, the Cinder-Priest", storytellerAct: 2, figure: "priest",
    topics: [
      { id: "sermon", label: "His sermon", pages: [
        "\"Come to be preached at? Sit, then, sinner, and let me tell you the good news, which is that there is none. The garden is dead. The Queen wears it. We are the compost of a kinder age. Rejoice — the pressure's off. Nothing you do now can make it worse.\"",
        "\"I used to keep a proper flame in a proper temple. Now I keep a handful of cinders in a clay cup and I call it holy, because holiness is just whatever warmth you refuse to let go out. Warm your hands. Go on. It's free, unlike Jenda's water.\"",
      ]},
      { id: "queen", label: "The Embalmed", pages: [
        "\"You'll go down to her. They all go down to her. Nyzat, who loved Zerath so much she would not let it die and so it cannot, and neither can she, and neither — this is the sermon's cruel middle — can any of the gardeners she wrapped to keep it company.\"",
        "\"When you cut her, and you'll try, remember she is not evil. She is grief that outlived its object and kept on loving anyway. That is the most dangerous thing in this world. More than dread. Ask the man in Act Four about dread. I'll take grief every time.\"",
      ]},
    ],
  },

  // ---- Act III: the Drowned Green / Mirefall Landing ----
  {
    id: "oona", name: "Marsh-Mother Oona", storytellerAct: 3, figure: "witch",
    topics: [
      { id: "trade", label: "Her trade", pages: [
        "\"Leeches, love. That's the trade. I bleed the fever out of the drowned-sick and I bleed the truth out of the ones too proud to weep. Same worm does both jobs. It's not fussy where the poison lives.\"",
        "\"You've a poison in you too — I can smell it from here, under the blood and the road-dust. The wanting kind. The go-deeper kind. I've no leech for that one. Nobody has. It's the only sickness in the world that thinks it's a virtue.\"",
      ]},
      { id: "river", label: "The river", pages: [
        "\"The green country didn't flood, whatever the ferryman tells you in his sad-boat voice. It was drunk. Swallowed. There's a difference and the difference is appetite. Water that rises can fall. This won't fall. This is full and still hungry.\"",
        "\"Ssarim's down in the Ziggurat being a god about it. 'The river only ever asks once.' Faugh. It asks constantly, dear. It's asking you right now — feel it, that little tug toward the deep water? That's the question. The trick is to keep not answering.\"",
      ]},
    ],
  },
  {
    id: "deel", name: "Deel, the Stilt-Walker", storytellerAct: 3, figure: "fisher",
    topics: [
      { id: "stilts", label: "The stilts", pages: [
        "\"Up here on the poles you learn to read the water by its skin. Where it's smooth, it's deep and it's thinking. Where it chops, there's something under, feeding. You want the chop. The smooth water is where the drowned come up to say hello.\"",
        "\"I've walked these floods eleven years. Longer than the floods have been floods, if you can credit it. I built the first stilts to reach the high fruit. Now I build them to stay above my neighbors. Everything you make to reach up, you end up using to keep from going under. There's a lesson there. I try not to learn it.\"",
      ]},
      { id: "family", label: "His family", pages: [
        "\"You'll want to mind your manners and not ask, so I'll say it plain and spare us both. I had four. The water has them now. It didn't take them — that's the part I can't make anyone understand — it kept them. They're down there. Kept nice. Waiting.\"",
        "\"I don't come down off the stilts. Not for anything. Because on a smooth-water night I've seen the little one's face turn up under the surface, patient as the rest, and it smiled to see me, and I very nearly stepped down. So. Up here I stay. Buy a fish. Don't look at the water.\"",
      ]},
    ],
  },

  // ---- Act IV: the Hollow Throne / The Last Vigil ----
  {
    id: "adelheid", name: "Sister Adelheid, the Bell-Keeper", storytellerAct: 4, figure: "keeper",
    topics: [
      { id: "bell", label: "The bell", pages: [
        "\"You've seen Cael with his hand on the rope? He rings for the end. I keep the bell that end is rung on. We are a two-person religion, he and I, and our only sacrament is a sound we pray never to make.\"",
        "\"I oil the yoke. I file the crack that's been spreading in the bronze for a year — from the cold coming up, not from ringing; it's never been rung. Some nights I think the crack is the point. That the world ends not with the bell but with the bell finally too broken to ring. That we'll all just look up at the silence and understand.\"",
      ]},
      { id: "watch", label: "The Vigil", pages: [
        "\"Everyone here is the last of something. Cael, the last watch. Me, the last bell. Iseult sells the last knights out of a warm stall. Even young Tomas is the last of a thing that isn't finished dying yet, which is the worst last to be.\"",
        "\"We are a whole town of endings, wintering at the foot of the stair. And then you arrive, dripping the road behind you, wanting to buy a belt. A beginning. It's obscene. It's the only hope any of us has left. Don't waste it on the belt.\"",
      ]},
    ],
  },
  {
    id: "tomas", name: "Tomas, Aldric's Squire", storytellerAct: 4, figure: "squire",
    topics: [
      { id: "master", label: "His master", pages: [
        "\"I keep his armor bright. His second set — the light plate, the ceremonial. He wore the black plate down the stair to win us terms and I've kept the bright plate ready for his return every day since, because a squire keeps his master's armor ready. That is the whole of the job. That is the whole of me.\"",
        "\"They tell me what he is now. Aldric the Forsworn. 'I chose this.' I hear the words. I polish the greaves. Both things are true at once and I live in the space between them, and I have got quite good at living there. You can get good at anything, it turns out. Even this.\"",
      ]},
      { id: "stair", label: "The stair", pages: [
        "\"You're going down. To him, eventually, among the others. I won't ask you to spare him — I'm not a fool, whatever I look like, kneeling here with a rag and a good man's shin-guard.\"",
        "\"I'll ask you one thing. When it's done — when you've given him the clean death everybody keeps promising him — bring me back the black plate. Not the man. I know better than to ask for the man. Just the plate. I'll polish it. I'll set it beside the bright set. And the pair of them can stand the last watch together, the way he always meant to.\"",
      ]},
    ],
  },

  // ==================================================================
  // ---- the indoor folk: a barkeep per tavern, a resident per hut ----
  //   (talk-only, one pair per act — the warm rooms you can walk into)
  // ==================================================================
  {
    id: "brannoch", name: "Brannoch, of the Crooked Lantern", figure: "barkeep",
    topics: [
      { id: "house", label: "The Lantern", pages: [
        "\"Sit anywhere the floor's dry. That's most of it, tonight. Ale's watered but honest — same as the rest of Hollowmere.\"",
        "\"My grandfather hung that lantern crooked on purpose. Said a light that hangs true, folk walk past. A light that hangs wrong, they stop, and wonder, and come in out of the dark. Forty years I've kept it lit. Longest anyone's managed.\"",
      ]},
      { id: "trade", label: "The talk tonight", pages: [
        "\"You want the talk? Sit at my bar long enough, you hear all of it. Wardens drinking themselves brave before the cathedral road. Peddlers who won't say what they're fleeing.\"",
        "\"And lately — folk who order one ale, drink half, and stare at the door like they're expecting it to open on its own. It hasn't. Not yet. I keep the bar between me and it, all the same. A bar's a good thing to keep between you and a door.\"",
      ]},
    ],
  },
  {
    id: "sedira", name: "Sedira, the Oasis Pourer", figure: "barkeep",
    topics: [
      { id: "house", label: "This tavern", pages: [
        "\"Water's dearer than wine here, so I pour wine. Cheaper to drown a thirst than to slake it in Zerath these days.\"",
        "\"This was the last building in the square to keep its roof when the sand came. People come here to sit under something. Doesn't matter what I'm pouring. They came in for the ceiling.\"",
      ]},
      { id: "trade", label: "The talk tonight", pages: [
        "\"You hear a lot, pouring. The diggers say the necropolis has more doors than it did last month. Doors nobody cut. The Queen's making room.\"",
        "\"I don't repeat it past the bar. Bad for custom, and worse for sleeping. Have your wine. Watch the door if it makes you feel better — everyone does, first night in Zerath. You stop, after a while. That's not the comfort it sounds like.\"",
      ]},
    ],
  },
  {
    id: "gullimon", name: "Gullimon, Keeper of the Stilt-House", figure: "barkeep",
    topics: [
      { id: "house", label: "The stilt-house", pages: [
        "\"Mind the third plank, it's rotted through — no, the OTHER third plank. Whole Landing's held up on stilts and stubbornness. I keep the bar dry. Mostly.\"",
        "\"Water's come up two hands since spring. I've moved the good barrels to the loft twice. When it comes up past the taps, I'll pour from the loft. When it comes up past the loft — well. I'll pour somewhere. A man keeps pouring. It's what I'm for.\"",
      ]},
      { id: "trade", label: "The talk tonight", pages: [
        "\"Vaol the ferryman drinks here, when he's not poling the dead. He says the water's warmer down deep than it ought to be. Says something's breathing in it.\"",
        "\"I told him to stop drinking and stop saying that, in that order. He did neither. Now I hear it too, some nights, under the floor — a long slow tide-breath that isn't the tide. So I pour myself one, and I don't say it past the bar. You'd do the same.\"",
      ]},
    ],
  },
  {
    id: "old_hesk", name: "Old Hesk, the Last Pour", figure: "barkeep",
    topics: [
      { id: "house", label: "The last tavern", pages: [
        "\"Last tavern with a lit hearth this side of the Throne. When mine goes cold, that's the whole world gone cold behind you. So I don't let it go cold. Simple duty. I'm good at simple.\"",
        "\"Ash gets in the ale. I strain it. Ash gets in the ale again. I strain it again. That's the Vigil, friend — you strain the ash out, and you strain it out, and you do not stop straining, because the day you stop is the day you agree.\"",
      ]},
      { id: "trade", label: "The talk tonight", pages: [
        "\"Knights come in off the wall grey as the ash and they don't talk. I pour, they drink, they go back up. That's our whole conversation and it's the best one I have.\"",
        "\"You're going down past the wall, to the Throne itself. I'll have a cup poured when you come back. I'll keep it poured. I keep a lot of cups poured for folk who went down that stair. They line the shelf. I dust them. One of them's going to be drunk one day, and I'd be honored if it were yours.\"",
      ]},
    ],
  },
  {
    id: "mabel", name: "Old Mabel", figure: "homesteader",
    topics: [
      { id: "home", label: "Her home", pages: [
        "\"Come in, come in, mind the cat — no cat anymore, force of habit. Sit by the fire. It's a small fire in a small house and it's mine and it's warm, which is three things more than most folk have east of here.\"",
        "\"Senna next door frets over the whole town. I keep the one hearth. You keep the fire, the fire keeps the dark off the walls, the walls keep the roof up. That's the whole of housekeeping and the whole of soldiering too, if you think on it. Which I do. I've a lot of evenings.\"",
      ]},
      { id: "worry", label: "What troubles her", pages: [
        "\"My boy went east with a Warden's bow three winters back. I keep his chair. I keep the fire high enough he'd see it from the road, if he came up the road. He'd see it a long way, a fire like that.\"",
        "\"You're going where he went. If you pass a tall lad, quiet, left-handed on the string — no. Don't answer that. Don't tell me. Some hopes you keep by not letting anyone put them down. Warm yourself. Go on. Leave an old woman her fire and her fool's chair.\"",
      ]},
    ],
  },
  {
    id: "amara", name: "Amara, the Well-Widow", figure: "homesteader",
    topics: [
      { id: "home", label: "Her home", pages: [
        "\"Mud brick keeps the heat out by day and the cold out by night. My husband laid every brick. Then he went to sound the deep well, to see why it ran black, and the well kept him. So now the walls keep me. Fair's fair, I suppose. Bricks for a bricklayer.\"",
        "\"Sit. There's shade and there's date-wine and there's an hour before the sand starts moving again. In Zerath that's a feast. Don't waste it being somewhere else in your head.\"",
      ]},
      { id: "worry", label: "What troubles her", pages: [
        "\"I hear him, some nights. Down the dry well. Calling up, friendly as market-day, in his own dear voice. 'Amara. Amara. Come see what I found.'\"",
        "\"I filled the well with sand to the brim. He calls up through the sand now, patient as ever. That's the thing nobody warns you — it doesn't stop wearing their face just because you stop listening. But you stop listening. You must. Sit with me till it's light, and don't look at the well.\"",
      ]},
    ],
  },
  {
    id: "wickem", name: "Wickem, the Reed-Cutter", figure: "homesteader",
    topics: [
      { id: "home", label: "His home", pages: [
        "\"Built her myself, out of reed and pitch and spite, up on the good stilts. She sways in the flood and she doesn't fall. That's more than the church managed, and the church had God and stone. I had reeds and a bad temper.\"",
        "\"Sit where it's dry. Everything here is a little wet and a little green and a little alive that shouldn't be. You get used to the smell. That's the frightening part, when you think on it — that you get used to it. So I try not to think on it. Reed-cutting helps. Keeps the hands busy and the head empty.\"",
      ]},
      { id: "worry", label: "What troubles him", pages: [
        "\"The reeds grow where the dead go under. Best cutting's over the drowned graves — tall, green, singing when the wind's up. I cut there because the reeds are best there. I tell myself that's why.\"",
        "\"Last week I cut a stand and it bled. Not sap. I've stopped cutting the tall ones. I've stopped going out past the third channel. Soon I'll have stopped going out at all, and then I'll just be a man in a reed house not going out, listening to it grow. Have you noticed how much of surviving is just — stopping? Stopping doing this, stopping going there. One day you've stopped everything. They call that safe.\"",
      ]},
    ],
  },
  {
    id: "greta", name: "Greta, Who Would Not Leave", figure: "homesteader",
    topics: [
      { id: "home", label: "Her home", pages: [
        "\"Everyone with sense went west a year ago. I stayed. This is my house. My mother's house, her mother's. You don't hand a house to the dark because the dark asked politely with an army.\"",
        "\"So I sweep the ash off the step every morning and every morning there's more, and I sweep it anyway, because the morning I don't sweep is the morning the Throne wins a thing it can't take by force — my saying that today is like any other day, and worth keeping tidy. Sit. The kettle's on. It's always on. Small defiance. It's the size I can manage.\"",
      ]},
      { id: "worry", label: "What troubles her", pages: [
        "\"I'm not afraid of dying, understand. I'm old and I've buried better. I'm afraid of the other thing. The kneeling. They don't kill this town — they invite it. Every night, a little louder: lay down the broom, come below, be at peace.\"",
        "\"Peace. As if I don't know the word for what they're selling. You go down there and you tell the crowned thing at the bottom that there was one house in the Last Vigil that kept its kettle on and its step swept and never once considered the offer. Tell him Greta says the answer is no, and it was always going to be no, and he wasted a very grand voice on a woman with a broom.\"",
      ]},
    ],
  },
];

const TOWN_NPC_BY_ID = new Map(TOWN_NPCS.map((n) => [n.id, n]));
export function townNpcById(id: string): TownNpc | undefined {
  return TOWN_NPC_BY_ID.get(id);
}

// ---- dungeon narrative encounters: vignette / ambush / boon ----
export type EncounterKind = "vignette" | "ambush" | "boon";
export interface EncounterBoon {
  effect: "dmg" | "speed" | "mf" | "heal" | "vuln" | "slow"; // heal is instant; the rest last `ms`
  ms?: number;
  cursed?: boolean; // for the flavor/telemetry — vuln/slow are curses
  note: string; // floated when it lands
}
export interface Encounter {
  id: string;
  kind: EncounterKind;
  act: number; // 1..4; 0 = any land
  label: string; // the shrine's world-label
  pages: string[]; // the dialogue window
  ambushKind?: string; // MonsterKind; server falls back to the floor's own roll if unknown
  ambushCount?: number;
  boon?: EncounterBoon;
}

export const ENCOUNTER_CHANCE = 0.55; // a story waits on most floors
export const ENCOUNTER_XP_BASE = 8; // × danger, for surviving a vignette (like a tome)

export const ENCOUNTERS: Encounter[] = [
  // ---------- Act I — the Mournfield ----------
  { id: "warden_dying", kind: "vignette", act: 1, label: "A fallen Warden", pages: [
    "A woman in Warden leather is folded against the roots, an arrow — one of her own kind — through her side.",
    "\"You're not... one of them. Good. Listen. Corvessa took the others down the nave. They went singing.\"",
    "\"Don't let her sing at you. Whatever you do. Cover your—\" She stops covering anything. The wood is quiet again.",
  ]},
  { id: "confession_stone", kind: "vignette", act: 1, label: "A carved confession", pages: [
    "Someone has cut small, patient letters into the trunk of a dead oak, hundreds of them, a monk's whole guilt in bark.",
    "\"I SEALED THE CRYPT DOOR AS I WAS TOLD. I HEARD THEM ASKING TO BE LET OUT. I TOLD MYSELF THEY WERE ALREADY DEAD.\"",
    "\"THEY WERE NOT ALREADY DEAD. THEY ARE NOT DEAD NOW. FORGIVE THE SEXTON. — BR. MALC\"",
  ]},
  { id: "childs_shoe", kind: "vignette", act: 1, label: "A small shoe", pages: [
    "A child's shoe sits in the middle of the trail, upright, laced, waiting to be stepped back into.",
    "There is no child. There is no second shoe. There is only the very careful way it has been placed, facing home.",
  ]},
  { id: "possessed_survivor", kind: "ambush", act: 1, label: "A survivor, waving", ambushKind: "imp", ambushCount: 4, pages: [
    "A man stumbles from the treeline, both arms up, weeping with relief. \"Thank the light — thank the light, I thought I was the last, I—\"",
    "His jaw keeps opening. Past where a jaw should stop. Something small and pale is already climbing out of the man who is no longer using him.",
  ]},
  { id: "warm_hand", kind: "boon", act: 1, label: "A pale figure", boon: { effect: "speed", ms: 30000, note: "the cold lends you its quickness (+haste)" }, pages: [
    "A figure the color of pond-ice stands very still between two trees, one hand held out, palm up, patient.",
    "\"Warmth,\" it says, without a mouth moving. \"For a memory. You have so many. You'll hardly miss the one I take.\"",
    "You take the hand before you decide to. It is done before you feel the cold. You are faster now. You cannot recall why you came this way.",
  ]},

  // ---------- Act II — the Sunscar Wastes ----------
  { id: "buried_caravan", kind: "vignette", act: 2, label: "A buried wagon", pages: [
    "A merchant wagon stands nose-down in the dune, swallowed to the axles, its cargo still roped and neat under a skin of sand.",
    "The driver is roped in too, still upright, still holding the reins, patient as everything is patient out here. He has been waiting a thousand years for the sand to let go of the wheels.",
  ]},
  { id: "dry_well", kind: "vignette", act: 2, label: "A black well", pages: [
    "A wellhead juts from the sand, its stones green-stained from a time when there was anything to stain them.",
    "You look down. The dark looks back, unhurried. Very far below, something shifts, and the shifting sounds like a word, and the word sounds like your name mispronounced by something learning it.",
  ]},
  { id: "embalmers_note", kind: "vignette", act: 2, label: "An embalmer's slab", pages: [
    "A stone slab, gutters cut for fluids long dry, and a work-order pinned under a jar of blue salt.",
    "\"THE QUEEN'S INSTRUCTION: WE DO NOT BURY ZERATH. WE PRESERVE IT. THE GARDENS ARE TO BE WRAPPED, NOT MOURNED.\"",
    "\"WHOEVER READS THIS: SHE MEANS TO WEAR IT ALL. EVERY GREEN THING. INCLUDING, I NOW UNDERSTAND, US.\"",
  ]},
  { id: "false_pilgrim", kind: "ambush", act: 2, label: "A robed pilgrim", ambushKind: "entombed", ambushCount: 4, pages: [
    "A robed pilgrim kneels at a shrine of piled stones, rocking, murmuring thanks that you've come, that the Queen sent you, that it is time.",
    "The robe is wrapped a great many times. When it turns to greet you, it keeps turning — nothing under the wrappings has a front — and the piled stones stand up to help.",
  ]},
  { id: "salt_offering", kind: "boon", act: 2, label: "A dish of blue salt", boon: { effect: "mf", ms: 45000, note: "the old fortune of Zerath favors you (+magic find)" }, pages: [
    "A brass dish of blue embalmer's salt rests on a cairn, the last offering of a people who believed offerings still bought anything.",
    "You press a pinch to your tongue out of some instinct older than sense. It tastes of gardens. For a little while the wastes decide to be generous with you. It has been a long time since they were generous with anyone.",
  ]},

  // ---------- Act III — the Drowned Green ----------
  { id: "hanged_boats", kind: "vignette", act: 3, label: "Boats in the trees", pages: [
    "Fishing boats hang in the canopy overhead, lifted there by a flood that came and did not go, and stayed instead, and is staying.",
    "One still has its lantern lit, green flame under green water-light. Nobody lit it. Nobody has climbed up to it. It simply has not agreed to go out.",
  ]},
  { id: "ferry_toll", kind: "vignette", act: 3, label: "A drowned ferry", pages: [
    "A flat-bottomed ferry lies half-sunk in the shallows, its toll-box nailed to the rail, still expecting custom.",
    "The passengers are still aboard, seated, orderly, waiting for a shore the ferry will never reach. One has a coin already held out for the box. You could take it. You do not take it.",
  ]},
  { id: "riverfang_bait", kind: "ambush", act: 3, label: "A crying child", ambushKind: "riverfang", ambushCount: 3, pages: [
    "A child stands waist-deep in the black water, back to you, shoulders hitching with sobs, hair drifting on the current.",
    "You call out. The sobbing stops. The child does not turn — the water turns it — and its face is all the river's teeth, and the sobbing was only ever the bait moving.",
  ]},
  { id: "green_bargain", kind: "boon", act: 3, label: "A drowned suitor", boon: { effect: "vuln", ms: 25000, cursed: true, note: "the river marks you — you take more harm (25s)" }, pages: [
    "A drowned man rises to standing in the shallows, courteous, dripping, offering you a ring of woven reed as though at a wedding.",
    "\"The river only ever asks once,\" he says, and slips the reed over your wrist before you can decline the honor.",
    "It tightens. It will not come off. For a while the water knows exactly where you are, and so does everything in it.",
  ]},

  // ---------- Act IV — the Hollow Throne ----------
  { id: "vigil_bell", kind: "vignette", act: 4, label: "A watch-bell", pages: [
    "A great bronze alarm-bell hangs from a broken arch, its rope frayed to a thread, its lip green with the breath of the deep.",
    "A tag is wired to the rope in a soldier's hand: \"RING ONLY WHEN THE END COMES. — THE WATCH.\" Below it, smaller: \"IT HAS NOT COME. IT HAS NOT COME. IT HAS NOT—\" and then the writing stops.",
  ]},
  { id: "forsworn_plate", kind: "vignette", act: 4, label: "Empty black plate", pages: [
    "A suit of blackened knight's plate stands upright and empty in a shaft of grey light, arranged as if to be put on.",
    "It is Vigil-work — you can read the maker's mark under the corruption. Someone stood here and undressed out of the light and dressed into the dark on purpose, piece by piece, and walked down. 'I chose this,' the arrangement says. It is very neat about it.",
  ]},
  { id: "kings_herald", kind: "ambush", act: 4, label: "A kneeling knight", ambushKind: "doomguard", ambushCount: 4, pages: [
    "A knight in Vigil colors kneels facing the descent, head bowed, sword planted, the very picture of a man keeping faith at his post.",
    "\"You came,\" he says, not lifting his head. \"He said a hero would. He said to make you welcome.\" When he stands, the colors are only paint, and what wore them was never keeping faith with you.",
  ]},
  { id: "unmakers_gift", kind: "boon", act: 4, label: "A crown of ash", boon: { effect: "dmg", ms: 30000, note: "dread sharpens your arm (+damage)" }, pages: [
    "A small crown of grey ash sits on a stone at the head of the stair, holding its shape though nothing holds it.",
    "A voice with no source, very patient, very tired: \"Take it up. Strike harder. Finish what you came to finish. I am, after all, what remains when all else is finished — and I do so want to see you hurry.\"",
    "You feel your grip tighten past your own strength. The stair is suddenly very inviting. That, more than anything, is what should frighten you.",
  ]},

  // ---------- any land ----------
  { id: "old_campfire", kind: "vignette", act: 0, label: "A cold campfire", pages: [
    "The ashes of another hero's fire, gone grey and rained-in. A bedroll. A whetstone. A journal, its last page still legible.",
    "\"Day I forget. Deeper than I meant. It gets easier to go down and harder to want up. I'll turn back tomorrow.\" There is no next entry. There is no tomorrow written anywhere in the book.",
  ]},
  { id: "wandering_boon", kind: "boon", act: 0, label: "A flicker of warmth", boon: { effect: "heal", note: "a stranger's mercy closes your wounds" }, pages: [
    "A lantern hangs on nothing at all, burning steady, throwing a small ring of ordinary golden light — the first honest light in a long descent.",
    "Nobody tends it. Nobody claims it. You stand in the warm ring a moment, and your hurts feel suddenly smaller, and then the lantern is simply gone, having done its one kind thing.",
  ]},
];

const ENCOUNTER_BY_ID = new Map(ENCOUNTERS.map((e) => [e.id, e]));
export function encounterById(id: string): Encounter | undefined {
  return ENCOUNTER_BY_ID.get(id);
}

// pick a story for this floor: mostly vignettes, some ambushes, rare bargains
export function rollEncounter(act: number, rng: () => number): Encounter | null {
  const r = rng();
  const kind: EncounterKind = r < 0.7 ? "vignette" : r < 0.9 ? "ambush" : "boon";
  const pool = ENCOUNTERS.filter((e) => e.kind === kind && (e.act === act || e.act === 0));
  const fallback = ENCOUNTERS.filter((e) => e.kind === "vignette" && (e.act === act || e.act === 0));
  const from = pool.length ? pool : fallback;
  if (!from.length) return null;
  return from[Math.floor(rng() * from.length)];
}

// --- The Codex: the world remembers what you have seen, slain, and carried ---
//
// Three books, kept in the Reliquary in every town and shared across all a
// player's heroes (account-wide, like the shared stash):
//   • the Bestiary   — every kind you kill records an entry; a kill-count
//                       milestone unlocks a deeper insight into the thing.
//   • the Chronicle  — lore fragments recovered in the dark, grouped into
//                       chapters; completing a chapter is a permanent boon.
//   • the Reliquary  — the in-world story of each signature relic you find.

export interface BestiaryEntry {
  kind: string; // matches Monster.kind (a MonsterKind or a boss kind)
  name: string; // display name
  lore: string; // unlocked on the first kill
  insightAt: number; // kills needed to unlock the insight
  insight: string; // the deeper truth — read once the count is met
}

export interface LoreFragment {
  id: string;
  chapter: string; // the CodexChapter.id it belongs to
  title: string;
  text: string;
  bossKind?: string; // Stage 1 source: felling this boss recovers the fragment
  // (Stage 2 will add set-piece sources; a fragment with no source simply waits)
}

export interface CodexChapter {
  id: string;
  name: string;
  blurb: string;
  reward: { stats: ItemStats; desc: string }; // account-wide, granted while complete
}

export interface RelicLore {
  name: string; // matches a unique/set Item.name exactly
  lore: string;
}

// the account-wide save shape (mirrored in the server's Account.codex)
export interface CodexState {
  bestiary?: Record<string, number>; // kind → total kills
  fragments?: string[]; // recovered fragment ids
  relics?: string[]; // discovered relic (item) names
}

// ---- the Bestiary: one entry per living (and unliving) kind ----
export const BESTIARY: BestiaryEntry[] = [
  // Act I — the Mournfield
  { kind: "imp", name: "Imp", lore: "Small, pale, and quick — they travel in shrieking packs and lose their nerve the instant a packmate falls.", insightAt: 25, insight: "Kill one and the rest may scatter: break their morale and the swarm breaks with it." },
  { kind: "spineback", name: "Spineback", lore: "A hunched thing bristling with barbed quills, which it spits from range and then skitters away to spit again.", insightAt: 20, insight: "It kites by design — close the gap or corner it; standing at mid-range is exactly what it wants." },
  { kind: "zombie", name: "The Shambling Dead", lore: "Hollowmere's own, dug up and set walking. Slow, patient, and endless.", insightAt: 30, insight: "Their camps refill if left alone — clear a nest fully or don't bother." },
  { kind: "skeleton", name: "Risen Bones", lore: "Marrow-dry soldiers of a war nobody living remembers, drilled into ranks by something below.", insightAt: 30, insight: "Something down here still gives them orders. The Chronicle asks who." },
  { kind: "archer", name: "Bonebow Archer", lore: "Skeletal marksmen that hang at the back of a pack and punish anyone who charges the front.", insightAt: 20, insight: "Deal with the archers first; the melee is only bait to hold you in their line of fire." },
  { kind: "cultist", name: "Hollow Cultist", lore: "Robed devotees who chose the dark on purpose, and are proud of the choosing.", insightAt: 20, insight: "They died believing the brothers would remember them. The brothers did not." },
  { kind: "goatman", name: "Goatman Reaver", lore: "Horned brutes of the deep wood, all muscle and bad temper, that hit far harder than their size warns.", insightAt: 15, insight: "A single reaver can spike your health bar in two blows — never facetank a pack of them." },
  { kind: "goblin", name: "Treasure Goblin", lore: "It does not fight. It flees, sack clutched to its chest, and vanishes through a rip in the air if you dawdle.", insightAt: 3, insight: "Nine seconds and it portals out. Commit to the chase the instant you see it — hesitation is a lost hoard." },

  // Act I — the Cathedral floors
  { kind: "wraith", name: "Cathedral Wraith", lore: "A smear of cold grief that drifts the nave, harmless-looking until it is upon you.", insightAt: 20, insight: "They ignore walls and terrain. Line of sight is no safety." },
  { kind: "gargoyle", name: "Roost Gargoyle", lore: "Stone until you are close, then not stone at all.", insightAt: 15, insight: "They wake in groups. Waking one usually means waking the whole ledge." },

  // Act I / Hell — demons
  { kind: "demon", name: "Lesser Demon", lore: "Squat, red, and full of fire — the rank and file of everything worse below.", insightAt: 20, insight: "Their blows carry fire; fire resistance blunts them far more than armor does." },
  { kind: "succubus", name: "Succubus", lore: "Beautiful at a distance, and the distance is the trap — she calls fire down from across the room.", insightAt: 15, insight: "A ranged burner. Break line of sight or close fast; trading shots is a losing trade." },
  { kind: "hellion", name: "Hellion", lore: "A four-legged furnace that closes distance in a heartbeat and burns what it catches.", insightAt: 15, insight: "It's faster than you. Save a movement skill or a slow for the moment it commits." },

  // Act II — the Sunscar Wastes
  { kind: "scarab", name: "Tomb Scarab", lore: "Fist-sized, iridescent, and never alone — they boil up out of the sand in numbers.", insightAt: 30, insight: "Individually nothing; in a swarm, a wall of chip damage. Area attacks earn their keep here." },
  { kind: "sandserpent", name: "Sand Serpent", lore: "It swims the dunes and surfaces beneath your feet, all jaw and no warning.", insightAt: 20, insight: "It surfaces where you stand. Keep moving and its lunge finds empty sand." },
  { kind: "entombed", name: "The Entombed", lore: "Zerath's wrapped dead, preserved rather than buried, walking because the Queen was thorough.", insightAt: 25, insight: "\"She means to wear it all. Every green thing. Including us.\" — an embalmer's last note." },
  { kind: "duneprowler", name: "Dune Prowler", lore: "A lean desert hunter that circles the edge of your vision and rushes the moment you turn your back.", insightAt: 20, insight: "It waits for you to commit elsewhere. Don't give it your back in an open room." },
  { kind: "carrionbird", name: "Carrion Bird", lore: "They wheel over the wastes wherever something is dying, and are not above hastening it.", insightAt: 20, insight: "Fast and evasive — a good test of whether your ranged option can actually connect." },

  // Act III — the Drowned Green
  { kind: "mudling", name: "Mudling", lore: "A gob of animate silt that pulls itself out of the bog and reaches for the warm.", insightAt: 30, insight: "They come from the water endlessly. The ground itself is the spawner." },
  { kind: "blowreed", name: "Blowreed Stalker", lore: "It hides among the reeds and blows a dart of bog-toxin before you ever see it.", insightAt: 20, insight: "First hit often comes from cover. Poison ticks after — clear the reeds, don't wade blind." },
  { kind: "riverfang", name: "Riverfang", lore: "The river's teeth. It sobs like a lost child to draw you to the water's edge.", insightAt: 15, insight: "The crying is bait. Anything weeping in the black water is already the trap." },
  { kind: "vinehorror", name: "Vine Horror", lore: "The drowned green given a will — a knot of thorned vine that lashes and grabs.", insightAt: 15, insight: "It roots and reaches; its range is longer than it looks. Respect the lash." },
  { kind: "bogwitch", name: "Bogwitch", lore: "A hag of the Mirefall shallows who curses from afar and cackles while you rot.", insightAt: 15, insight: "A caster — her hexes outrange her cackle. Silence her first or eat the curse." },

  // Act IV — the Hollow Throne
  { kind: "ashfiend", name: "Ashfiend", lore: "Born of the ashfall over the Last Vigil, it leaves cinders where it steps.", insightAt: 20, insight: "The ground it walks stays hot. Fire resistance is not optional this deep." },
  { kind: "doomguard", name: "Doomguard", lore: "Armored dead of Uldrath's last garrison, still standing the watch they died standing.", insightAt: 15, insight: "Heavy armor, heavy blows. A slow, patient fight — or a swift death if you rush it." },
  { kind: "flamecaller", name: "Flamecaller", lore: "A robed adept who trades its own burning for the privilege of burning you.", insightAt: 15, insight: "It calls fire from range and never closes. Hunt it down; it will not come to you." },
  { kind: "flayed", name: "The Flayed", lore: "What Malgrim's mercy looks like — the skinned faithful, kept alive past all reason.", insightAt: 15, insight: "\"I remember the light. I chose this.\" They did not all get a choice." },
  { kind: "bovine", name: "Hell Bovine", lore: "It should not be here. It is here. It is furious, and it is not alone.", insightAt: 10, insight: "There is no meadow. There has never been a meadow. Moo." },

  // Bosses
  { kind: "flenser", name: BOSS_NAMES.flenser, lore: "Butcher of the cathedral steps, who kept his hooks and lost everything else.", insightAt: 3, insight: "\"Meat for the hooks!\" — fast, brutal, and never subtle. Bring life on hit or bring a fast exit." },
  { kind: "corvessa", name: BOSS_NAMES.corvessa, lore: "The Carrion Bride, pale and singing, who took the Wardens down the nave one by one.", insightAt: 3, insight: "She kites and her arrows chill. Corner her — a bride who can keep her distance never stops singing." },
  { kind: "maggotqueen", name: BOSS_NAMES.maggotqueen, lore: "Mother of the brood, vast and patient, birthing the writhing dark of the deep caves.", insightAt: 3, insight: "Kill the broodlings or drown in them. The Queen is the least of your problems while they live." },
  { kind: "vessira", name: BOSS_NAMES.vessira, lore: "The Thorned Maiden, who plants a wound in everything she meets and waits for it to bloom.", insightAt: 3, insight: "\"Every wound you carry, I planted.\" Her venom nova rewards standing still — so don't." },
  { kind: "vuruk", name: BOSS_NAMES.vuruk, lore: "The White Maw, a charging cold that carries the winter in every blow.", insightAt: 3, insight: "His hits chill and his charge closes range instantly. Cold resistance turns a death into a fight." },
  { kind: "orvath", name: BOSS_NAMES.orvath, lore: "The Grudge Eternal, who keeps his distance and lets his spite do the walking.", insightAt: 3, insight: "\"Spite outlives the spine.\" He orbits and hurls lightning — chase him down or be chipped to nothing." },
  { kind: "nyzat", name: BOSS_NAMES.nyzat, lore: "The Embalmed Queen of Zerath, who wore the sand a thousand years and means to wear the rest.", insightAt: 3, insight: "Ruler beneath the Necropolis. Everything wrapped in the wastes rose at her word." },
  { kind: "ssarim", name: BOSS_NAMES.ssarim, lore: "The Drowned God at the heart of the Ziggurat, to whom the river only ever asks once.", insightAt: 3, insight: "Act III's ruler. The flood that came and stayed came for him." },
  { kind: "malgrim", name: BOSS_NAMES.malgrim, lore: "The King of Dread, first of the three brother-kings, who trades in fear the way misers trade in gold.", insightAt: 3, insight: "His dread-fire nova telegraphs — a ring, a breath, then ruin. Leave the ring." },
  { kind: "aldric", name: BOSS_NAMES.aldric, lore: "The Forsworn, the knight who saw the light clearly and turned from it anyway.", insightAt: 3, insight: "\"I remember the light. I chose this.\" A guilt that fights like a saint gone wrong." },
  { kind: "uldrath", name: BOSS_NAMES.uldrath, lore: "The Unmaker, last of the Hollow Kings, waiting at the bottom of everything.", insightAt: 3, insight: "\"I am what remains when all else is finished.\" Fell him and the caravan road opens — and the Abyss beneath it." },
  { kind: "bovax", name: BOSS_NAMES.bovax, lore: "Tyrant of a meadow that does not exist, king of a herd that should not be.", insightAt: 1, insight: "MOO." },
];

const BESTIARY_BY_KIND = new Map(BESTIARY.map((b) => [b.kind, b]));
export function bestiaryEntry(kind: string): BestiaryEntry | undefined {
  return BESTIARY_BY_KIND.get(kind);
}

// ---- the Chronicle: fragments grouped into chapters, each a permanent boon ----
export const CODEX_CHAPTERS: CodexChapter[] = [
  { id: "ch_mournfield", name: "Grief of the Mournfield", blurb: "How Act I fell: the butcher, the bride, and the maiden who plants wounds.", reward: { stats: { dmgPct: 3 }, desc: "+3% damage" } },
  { id: "ch_deepcourts", name: "The Drowned Courts", blurb: "The rulers of the wastes and the green, and the brood between them.", reward: { stats: { allRes: 2 }, desc: "+2 all resistance" } },
  { id: "ch_hollowkings", name: "The Hollow Kings", blurb: "Three brothers who traded their names to the dark and unmade the world from underneath.", reward: { stats: { maxHp: 15 }, desc: "+15 life" } },
  { id: "ch_meadow", name: "The Hidden Meadow", blurb: "There is no meadow.", reward: { stats: { goldFind: 5 }, desc: "+5% gold find" } },
  // Stage 2 — chapters filled by environmental set-pieces found in the floors, not by bosses
  { id: "ch_ternion", name: "The Ternion Order", blurb: "The vanished alchemist-scholars who worked transmutation in threes — pieced together from what they left in the dark.", reward: { stats: { magicFind: 5 }, desc: "+5% magic find" } },
  { id: "ch_folk", name: "The Fallen Folk", blurb: "Not kings, not monsters — the ordinary dead of each land, and the small things they left behind.", reward: { stats: { maxHp: 10 }, desc: "+10 life" } },
  // the capstone — sealed until the Unmaker is unmade
  { id: "ch_ending", name: "The Unmaking Undone", blurb: "What was written when the last of the Hollow Kings fell at the bottom of his own hall.", reward: { stats: { dmgPct: 3, allRes: 2 }, desc: "+3% damage, +2 all resistance" } },
];

export const LORE_FRAGMENTS: LoreFragment[] = [
  // ch_mournfield
  { id: "frag_flenser", chapter: "ch_mournfield", bossKind: "flenser", title: "The Butcher's Ledger", text: "Hargol kept a tally on the cathedral wall, one cut per name. He ran out of wall long before he ran out of names." },
  { id: "frag_corvessa", chapter: "ch_mournfield", bossKind: "corvessa", title: "The Bride's Song", text: "The Wardens who went down the nave went singing, because she asked them to, and they could not remember how to refuse." },
  { id: "frag_vessira", chapter: "ch_mournfield", bossKind: "vessira", title: "The Maiden's Garden", text: "Every wound she opens is a seed. Given time and a warm host, it flowers. She is very patient about the flowering." },
  // ch_deepcourts
  { id: "frag_vuruk", chapter: "ch_deepcourts", bossKind: "vuruk", title: "The White Maw", text: "The cold that fills the Sunken Necropolis is not weather. It is Vuruk, breathing, somewhere below the sand." },
  { id: "frag_nyzat", chapter: "ch_deepcourts", bossKind: "nyzat", title: "The Embalmer's Queen", text: "\"We do not bury Zerath. We preserve it. The gardens are to be wrapped, not mourned.\" She meant to wear it all." },
  { id: "frag_orvath", chapter: "ch_deepcourts", bossKind: "orvath", title: "The Grudge Eternal", text: "Ask Orvath what he wants and he will not answer. He wanted something once. Now he only wants you to stop." },
  { id: "frag_ssarim", chapter: "ch_deepcourts", bossKind: "ssarim", title: "The River's Question", text: "The flood that took Mirefall came, and stayed, and is staying. It only ever asked once, and Ssarim was the asking." },
  { id: "frag_maggot", chapter: "ch_deepcourts", bossKind: "maggotqueen", title: "The Brood Hungers", text: "She does not fight so much as multiply. Every heartbeat down in the caves is another mouth she has made for you." },
  // ch_hollowkings
  { id: "frag_malgrim", chapter: "ch_hollowkings", bossKind: "malgrim", title: "Dread Itself", text: "Malgrim was the first to trade his name. He got dread in return, and gave it away freely ever after, to everyone." },
  { id: "frag_aldric", chapter: "ch_hollowkings", bossKind: "aldric", title: "The Forsworn", text: "Aldric was no fool and no puppet. He saw the light clearly, weighed it, and set it down. That is the worst of it." },
  { id: "frag_uldrath", chapter: "ch_hollowkings", bossKind: "uldrath", title: "The Unmaker", text: "\"I am what remains when all else is finished.\" The last brother does not rule the dark. He is what the dark is for." },
  // ch_meadow
  { id: "frag_bovax", chapter: "ch_meadow", bossKind: "bovax", title: "MOO", text: "There is no meadow. There is no herd. There is no peg-legged king of a kingdom that does not exist. Moo." },
  // ch_ternion — recovered from set-pieces (no bossKind; a SETPIECE grants each)
  { id: "frag_ternion_a", chapter: "ch_ternion", title: "The Rule of Threes", text: "\"Nothing is made from one thing, nor from two. Three El-runes become an Ond. Three failures become a proof. Three of us became the Order.\" The altar-stone still hums, faintly, waiting for a fourth thing to complete." },
  { id: "frag_ternion_b", chapter: "ch_ternion", title: "The Cost Ledger", text: "A scholar's ledger, every transmutation double-entered — what went in, what came out, and a third column headed only 'PAID'. The entries in that column are not runes or gold. They are names. Some of them are the scholars' own." },
  { id: "frag_ternion_c", chapter: "ch_ternion", title: "The Last Transmutation", text: "\"We have run out of lesser things to turn into greater ones. There is only one transmutation left that we have not dared. We will each become a third of it. If you are reading this, it worked, and you should run.\"" },
  // ch_folk — one per act, the ordinary dead
  { id: "frag_folk_1", chapter: "ch_folk", title: "The Token Cairn", text: "A cairn beside the trail, and on it the small things the fleeing left so the dead would have company: a wooden horse, a wedding ring, a milk-tooth in a twist of cloth. Nobody came back for any of it. Nobody came back at all." },
  { id: "frag_folk_2", chapter: "ch_folk", title: "The Wrapped Family", text: "Three shapes seated together under the sand, wrapped with a care that outlived whoever did the wrapping — tallest to smallest, hands still joined down the row. The Queen preserves everything. She does not ask whether it wished to be kept." },
  { id: "frag_folk_3", chapter: "ch_folk", title: "The Ferryman's Ledger", text: "A toll-ledger nailed to a drowned post, every passage marked paid, every passenger marked delivered. The last line reads: 'All aboard. None ashore. The far bank has moved again.' The ink under the water has not run in a hundred years." },
  { id: "frag_folk_4", chapter: "ch_folk", title: "The Unsent Letter", text: "Tucked in a dead sentry's breastplate, a letter home: '—holding the wall, tell mother the ash is only ash, tell her we—' It stops there. The wall did not hold. The ash was never only ash. The letter never left the Vigil." },
  // ch_ending — recovered the moment Uldrath falls (granted by the ending flow, not found)
  { id: "frag_ending", chapter: "ch_ending", title: "What Remains", text: "\"I am what remains when all else is finished,\" the Unmaker said, and was wrong, because you remained. The Hollow Throne is empty. The three names traded to the dark are unspoken now, and stay unspoken. The world does not thank you — it has forgotten how — but it goes on, which is the only thanks a dying road has left to give. And far below the empty throne, in the dark under the dark, something that is not a brother begins, very slowly, to wake." },
];

const FRAGMENT_BY_ID = new Map(LORE_FRAGMENTS.map((f) => [f.id, f]));
export function fragmentById(id: string): LoreFragment | undefined {
  return FRAGMENT_BY_ID.get(id);
}
export function fragmentsForBoss(kind: string): LoreFragment[] {
  return LORE_FRAGMENTS.filter((f) => f.bossKind === kind);
}
export function chapterFragments(chapterId: string): LoreFragment[] {
  return LORE_FRAGMENTS.filter((f) => f.chapter === chapterId);
}
// a chapter is complete once every one of its fragments has been recovered
export function chapterComplete(chapterId: string, have: readonly string[]): boolean {
  const frags = chapterFragments(chapterId);
  if (!frags.length) return false;
  const set = new Set(have);
  return frags.every((f) => set.has(f.id));
}
// the account-wide boon: sum the reward of every completed chapter
export function codexChapterBonuses(have: readonly string[]): ItemStats {
  const out: ItemStats = {};
  for (const ch of CODEX_CHAPTERS) {
    if (chapterComplete(ch.id, have)) addStats(out, ch.reward.stats);
  }
  return out;
}

// ---- the Reliquary: the story of each signature relic (curated, not exhaustive) ----
export const RELIC_LORE: RelicLore[] = [
  { name: "Hargol's Cleaver", lore: "The blade that made the cathedral steps famous. It still swings itself, a little, if you let your grip go loose." },
  { name: "The Mummer's Crown", lore: "A jester's cap of the old court, worn by the last man to make a Hollow King laugh. He was not thanked for it." },
  { name: "Winterclaw", lore: "A ring of frozen bone, taken from the finger of someone who reached for warmth in the wrong place." },
  { name: "The Orphan Star", lore: "A gem with no setting and no maker's mark, older than the settings men later built for it. It remembers being a star." },
  { name: "Kragmar's Face", lore: "Cast from the death-mask of a clan-father of the sacred peak. Wear it and the mountain looks out through your eyes." },
  { name: "Vessira's Visage", lore: "Her face, or a mask of it — the difference stopped mattering the day she planted the first seed. It smiles when you bleed." },
  { name: "Vuruk's Carapace", lore: "The White Maw's shed shell, still cold to the touch a hundred years on. The winter in it never agreed to leave." },
  { name: "The Grudgestone", lore: "Orvath's spite, pressed into a single dark stone. It keeps a tally of everyone who ever wronged its bearer, and adds you." },
  { name: "Nyzat's Lid", lore: "The lid of the Embalmed Queen's own jar. She does not need it anymore; she is wearing the world instead." },
  { name: "Ssarim's Riverspine", lore: "A length of the Drowned God's spine, cool and wet and never drying. Hold it to your ear for the sound of the flood that stayed." },
  { name: "The Unmaker's Edge", lore: "A sliver of whatever Uldrath became. It does not cut so much as end — the wound simply decides it was always there." },
  { name: "The First Dawn", lore: "Forged in a light that has not been seen since Act IV began. It is warm. Down here, that alone is worth a war." },
  { name: "The Bloodline", lore: "A greatsword passed hand to hand down a line that ended badly. Every owner is in it now, and they all want another turn." },
  { name: "Bovax's Hide?", lore: "The hide of a tyrant of a meadow that does not exist. The question mark is part of the name. Do not ask. Moo." },
];

const RELIC_LORE_BY_NAME = new Map(RELIC_LORE.map((r) => [r.name, r]));
export function relicLore(name: string): RelicLore | undefined {
  return RELIC_LORE_BY_NAME.get(name);
}

// ---- Set-pieces: hand-authored scenes placed into procedural floors ----
//
// Where encounters are a fleeting shrine (read once, gone), a set-piece is a
// standing monument you walk past — a wrecked wagon, a cairn of tokens, a
// scholar's ruined altar — that tells a beat AND leaves a lore fragment behind
// for the Codex. Act-scoped; the floor roll drops one that fits the land. Each
// grants exactly one fragment (dedup is per-account, so a party all read freely).
export interface SetPiece {
  id: string;
  act: number; // 1..4; 0 = any land
  label: string; // the world-label above the scene
  variant: "altar" | "cairn" | "shroud" | "ferry" | "marker"; // which drawing the client uses
  fragmentId: string; // the lore fragment this scene recovers
  pages: string[]; // the inscription, read in the dialogue window
}

export const SETPIECES: SetPiece[] = [
  // the Ternion Order — their ruin spans the first three lands
  { id: "sp_ternion_a", act: 1, label: "A scholar's altar-stone", variant: "altar", fragmentId: "frag_ternion_a", pages: [
    "A low stone altar stands where no chapel ever was, its face cut with a ring of interlocking threes worn shallow by patient thumbs.",
    "\"Nothing is made from one thing, nor from two,\" the inscription begins — the creed of the Ternion Order, who worked their transmutations in threes and vanished doing it.",
  ]},
  { id: "sp_ternion_b", act: 2, label: "An abandoned work-table", variant: "altar", fragmentId: "frag_ternion_b", pages: [
    "Glass vessels, most shattered, a few still holding a finger of something that has not evaporated in a century. A ledger lies open, weighted with a cracked crucible.",
    "Every transmutation is double-entered — what went in, what came out — and a third column, headed only 'PAID', that you wish you had not read.",
  ]},
  { id: "sp_ternion_c", act: 3, label: "The Order's last altar", variant: "altar", fragmentId: "frag_ternion_c", pages: [
    "The third and last of the Ternion altars, sunk to its rim in bog-water, its ring of threes finally closed by a fourth mark scratched hastily across them all.",
    "A final note is pinned beneath a jar of blue salt. It does not read like the others. It reads like a warning left by people who had run out of time to leave warnings.",
  ]},
  // the Fallen Folk — one memorial per land
  { id: "sp_folk_1", act: 1, label: "A cairn of small things", variant: "cairn", fragmentId: "frag_folk_1", pages: [
    "A cairn of grey stones beside the trail, and heaped upon it the small things the fleeing left behind — a wooden horse, a ring, a twist of cloth.",
    "They are placed, not dropped. Someone meant the dead to have company. Someone had time for that, and then did not have time for anything else.",
  ]},
  { id: "sp_folk_2", act: 2, label: "A wrapped family", variant: "shroud", fragmentId: "frag_folk_2", pages: [
    "Three wrapped shapes seated together under the lee of a dune, tallest to smallest, bound with a care that has outlasted the hands that bound them.",
    "Their wrapped hands are still joined, down the row. Zerath preserves everything. It was never asked whether it wished to be kept.",
  ]},
  { id: "sp_folk_3", act: 3, label: "A drowned mooring", variant: "ferry", fragmentId: "frag_folk_3", pages: [
    "A mooring post juts from the black shallows, a toll-ledger still nailed to it, a dead lantern still hung from its hook, patient for a ferry that is never putting in.",
    "Every passage marked paid. Every passenger marked delivered. The last line: 'All aboard. None ashore. The far bank has moved again.'",
  ]},
  { id: "sp_folk_4", act: 4, label: "A sentry's rest", variant: "marker", fragmentId: "frag_folk_4", pages: [
    "A sword planted point-down through a fallen sentry's shield, the only grave-marker the Vigil had time to give, ash drifting into the seams of the plate.",
    "There is a letter tucked in the breastplate, half-written, telling someone at home that the ash is only ash. It is not only ash. It never was.",
  ]},
];

const SETPIECE_BY_ID = new Map(SETPIECES.map((s) => [s.id, s]));
export function setpieceById(id: string): SetPiece | undefined {
  return SETPIECE_BY_ID.get(id);
}
// pick a set-piece that belongs to this land (or anywhere)
export function rollSetpiece(act: number, rng: () => number): SetPiece | null {
  const pool = SETPIECES.filter((s) => s.act === act || s.act === 0);
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}
export const SETPIECE_CHANCE = 0.4; // a monument stands on many, not all, floors

// ---- Story beats: the authored spine, fired once when a milestone quest first completes ----
//
// Keyed by quest id. Felling an act boss (or a Hollow King) plays a paged beat the FIRST
// time that hero does it — questsDone already guarantees once-only + persistence, so farm
// kills stay quiet. The_unmaking is the ending: it carries `ending: true`, which the client
// renders as a full-screen cinematic (and the server also seals the Codex capstone chapter).
export interface StoryBeat {
  quest: string; // the quest id whose completion fires this beat
  title: string;
  pages: string[];
  ending?: boolean; // the finale — Uldrath unmade
}

export const STORY_BEATS: StoryBeat[] = [
  { quest: "thorned_maiden", title: "The road east opens", pages: [
    "Vessira's thorns go slack. The wound she planted in the Mournfield — in all of it — stops spreading, for the first time since the grieving began.",
    "Beyond the wood the caravan-road runs east, into the Sunscar Wastes, where Zerath Oasis waits and something older than thirst has learned to wear the sand.",
  ]},
  { quest: "embalmed_queen", title: "The wastes let go", pages: [
    "Queen Nyzat, who wore the desert a thousand years, is unwrapped at last. The gardens she meant to keep can finish dying now — the kindest thing left to offer them.",
    "The road runs on, into the Drowned Green, where a flood came and did not leave, and a god sits patient at the bottom of it.",
  ]},
  { quest: "drowned_god", title: "The river recedes", pages: [
    "Ssarim, the Drowned God, sinks a final time, and the flood that stayed a hundred years remembers, all at once, how to leave. The far bank stops moving.",
    "Only the Hollow Throne remains now — under ashfall, at the end of the road — and the three brother-kings who traded their names for it.",
  ]},
  { quest: "oathbreaker", title: "The Forsworn falls", pages: [
    "Aldric the Forsworn goes down still remembering the light he turned from. \"I chose this,\" he says one last time — not a boast now, only the truth, and the worst of it.",
    "Two brothers remain between you and the empty throne.",
  ]},
  { quest: "dread_itself", title: "Dread goes out", pages: [
    "Malgrim, the King of Dread — first of the three to trade his name — has nothing left to trade. The fear he gave away so freely finds no more takers, and goes out like a blown lamp.",
    "One brother remains. The oldest. The last. The Unmaker, at the bottom of everything.",
  ]},
  { quest: "the_unmaking", title: "THE UNMAKING UNDONE", ending: true, pages: [
    "Uldrath, the Unmaker, last of the Hollow Kings, kneels in the hall he emptied of everything but himself.",
    "\"I am what remains when all else is finished,\" he says — and is wrong, because you are still standing, and standing is a kind of remaining he never accounted for.",
    "The Hollow Throne goes cold, and stays cold. The three traded names are unspoken, and will not be spoken again. The dying road, for the first time in a long age, is only a road.",
    "It is over. The world does not know how to thank you, so it simply goes on. But far below the empty throne, in the dark beneath the dark, the Endless Abyss draws its first breath — and it has been waiting for someone exactly like you.",
  ]},
];

const STORY_BEAT_BY_QUEST = new Map(STORY_BEATS.map((b) => [b.quest, b]));
export function storyBeatFor(questId: string): StoryBeat | undefined {
  return STORY_BEAT_BY_QUEST.get(questId);
}
export const ENDING_FRAGMENT = "frag_ending"; // sealed into the Codex when the finale plays

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

export function addStats(into: ItemStats, from: ItemStats) {
  for (const [k, v] of Object.entries(from) as Array<[keyof ItemStats, number]>) {
    into[k] = (into[k] ?? 0) + v;
  }
}

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
