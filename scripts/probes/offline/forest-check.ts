import { generateDungeon, makeMap, canStand, TILE, TOWN, generateCowLevel } from "@hollowmark/common";

const tileOf = (w: number) => Math.floor(w / TILE);

function bfs(map: { rows: string[]; w: number; h: number }, from: [number, number], to: [number, number]): boolean {
  const seen = new Set<string>([from.join(",")]);
  const q: Array<[number, number]> = [from];
  while (q.length) {
    const [x, y] = q.shift()!;
    if (x === to[0] && y === to[1]) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
      const k = `${nx},${ny}`;
      if (seen.has(k) || map.rows[ny].charAt(nx) === "#") continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return false;
}

let treeCounts: number[] = [];
for (let seed = 0; seed < 500; seed++) {
  const d = generateDungeon(1, 1, seed * 7717 + 13); // act 1 floor 1 = the Mournfield surface
  const m = makeMap(d.rows);
  const fail = (msg: string) => { console.error(`seed ${seed}: ${msg}`); process.exit(1); };
  if (!d.cathedral) fail("no cathedral");
  if (!canStand(m, d.spawn.x, d.spawn.y)) fail("spawn not standable");
  if (!canStand(m, d.stairs.x, d.stairs.y)) fail("stairs not standable");
  if (!canStand(m, d.boss.x, d.boss.y)) fail("boss not standable");
  for (const c of d.camps) if (!canStand(m, c.x, c.y)) fail("camp not standable");
  for (const c of d.chests) if (!canStand(m, c.x, c.y)) fail("chest not standable");
  for (const s of d.shrines) if (!canStand(m, s.x, s.y)) fail("shrine not standable");
  if (d.tome && !canStand(m, d.tome.x, d.tome.y)) fail("tome not standable");
  if (d.camps.length < 4) fail(`only ${d.camps.length} camps`);
  if (!bfs(m, [tileOf(TOWN.spawn.x), tileOf(TOWN.spawn.y)], [tileOf(d.stairs.x), tileOf(d.stairs.y)])) fail("stairs unreachable from town");
  if (!bfs(m, [tileOf(TOWN.spawn.x), tileOf(TOWN.spawn.y)], [tileOf(d.boss.x), tileOf(d.boss.y)])) fail("boss unreachable from town");
  for (const c of d.camps) {
    if (c.y >= 50 * TILE) continue; // interior camps are reached by portal, not on foot
    if (!bfs(m, [tileOf(d.spawn.x), tileOf(d.spawn.y)], [tileOf(c.x), tileOf(c.y)])) fail("field camp unreachable");
  }
  // the world above: tower + caves
  const towers = d.areas.filter((a) => a.kind === "tower");
  const caves = d.areas.filter((a) => a.kind === "cave");
  const base = d.areas.filter((a) => a.kind === "towerbase");
  if (towers.length !== 2) fail("expected 2 tower stories");
  if (base.length !== 1) fail("expected 1 tower footprint");
  if (caves.length < 2 || caves.length > 3) fail(`expected 2-3 caves, got ${caves.length}`);
  if (d.portals.length !== 4 + caves.length * 2) fail(`portal count ${d.portals.length} wrong for ${caves.length} caves`);
  for (const ap of d.portals) {
    if (!canStand(m, ap.x, ap.y)) fail(`portal "${ap.label}" (${ap.variant}) not standable`);
    if (!canStand(m, ap.tx, ap.ty)) fail(`portal "${ap.label}" (${ap.variant}) target not standable`);
  }
  // field-side doorways must be reachable from town on foot
  for (const ap of d.portals) {
    if (ap.variant !== "towerdoor" && ap.variant !== "cavemouth") continue;
    if (!bfs(m, [tileOf(TOWN.spawn.x), tileOf(TOWN.spawn.y)], [tileOf(ap.x), tileOf(ap.y)])) {
      fail(`portal "${ap.label}" unreachable from town`);
    }
  }
  // inside each interior, entry must reach its return portal
  for (const ap of d.portals) {
    if (ap.variant !== "towerdoor" && ap.variant !== "cavemouth") continue;
    const back = d.portals.find((b) => b !== ap && Math.hypot(b.tx - ap.x, b.ty - ap.y) < TILE * 1.5);
    if (!back) { fail(`portal "${ap.label}" has no way back`); continue; }
    if (!bfs(m, [tileOf(ap.tx), tileOf(ap.ty)], [tileOf(back.x), tileOf(back.y)])) {
      fail(`no path from "${ap.label}" landing to its exit`);
    }
  }
  treeCounts.push(d.rows.slice(12).join("").split("#").length - 1);
}
// deeper floors: the stairs must be walkable from the floor's OWN entrance. Not from
// town — below the surface the town strip is carved sealed (carveTownPlaza(grid, false)),
// so there is deliberately no path from the plaza into the deep.
for (const floor of [2, 3, 4, 5, 7, 8, 10]) {
  for (let seed = 0; seed < 60; seed++) {
    const d = generateDungeon(1, floor, seed * 3331 + 7);
    const m = makeMap(d.rows);
    if (!bfs(m, [tileOf(d.spawn.x), tileOf(d.spawn.y)], [tileOf(d.stairs.x), tileOf(d.stairs.y)])) {
      console.error(`floor ${floor} seed ${seed}: stairs unreachable from the floor entrance`);
      process.exit(1);
    }
    if (bfs(m, [tileOf(TOWN.spawn.x), tileOf(TOWN.spawn.y)], [tileOf(d.stairs.x), tileOf(d.stairs.y)])) {
      console.error(`floor ${floor} seed ${seed}: the deep camp leaks into town — the strip must stay sealed`);
      process.exit(1);
    }
  }
}
for (let seed = 0; seed < 60; seed++) {
  const d = generateCowLevel(3, seed * 991 + 3);
  const m = makeMap(d.rows);
  if (!bfs(m, [tileOf(TOWN.spawn.x), tileOf(TOWN.spawn.y)], [tileOf(d.stairs.x), tileOf(d.stairs.y)])) {
    console.error(`cow seed ${seed}: stairs unreachable from town`);
    process.exit(1);
  }
}
console.log(`OK: 500 forests + 7 depth floors ×60 + cow ×60 all connected; trees per forest ~${Math.round(treeCounts.reduce((a, b) => a + b, 0) / treeCounts.length)}`);
