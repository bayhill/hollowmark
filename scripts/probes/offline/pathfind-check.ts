// Validates the movement fix's premise against REAL generated maps: town and field are walled
// apart except at the single gate, a straight line between them is blocked (so old ground-clicks
// jammed), and the client BFS (findPath) routes through the gate. Mirrors GameScene's findPath /
// lineClear / nearestStandable exactly. No server, no browser.  npx tsx scripts/probes/offline/pathfind-check.ts
import {
  generateDungeon, makeMap, TOWN, TILE, TOWN_GATE_TX, TOWN_ROWS,
  tileAt, canStand, isInTown, GameMap,
} from "@hollowmark/common";

// --- copies of the client's pure helpers (same algorithms as GameScene) ---
function findPath(map: GameMap, sx0: number, sy0: number, wx: number, wy: number) {
  const sx = Math.floor(sx0 / TILE), sy = Math.floor(sy0 / TILE);
  const gx = Math.floor(wx / TILE), gy = Math.floor(wy / TILE);
  const W = map.w, H = map.h;
  const prev = new Int32Array(W * H).fill(-1);
  prev[sy * W + sx] = sy * W + sx;
  const queue = [sy * W + sx];
  let found = sx === gx && sy === gy;
  for (let qi = 0; qi < queue.length && !found; qi++) {
    const cur = queue[qi], cx = cur % W, cy = Math.floor(cur / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const idx = ny * W + nx;
      if (prev[idx] !== -1 || tileAt(map, nx, ny) !== 0) continue;
      prev[idx] = cur;
      if (nx === gx && ny === gy) { found = true; break; }
      queue.push(idx);
    }
  }
  if (!found) return null;
  const path: Array<{ tx: number; ty: number }> = [];
  let cur = gy * W + gx;
  while (cur !== prev[cur]) { path.push({ tx: cur % W, ty: Math.floor(cur / W) }); cur = prev[cur]; }
  path.push({ tx: sx, ty: sy });
  return path.reverse();
}
function lineClear(map: GameMap, x0: number, y0: number, x1: number, y1: number) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / (TILE * 0.5)));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!canStand(map, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}
function nearestStandable(map: GameMap, wx: number, wy: number) {
  const gx = Math.floor(wx / TILE), gy = Math.floor(wy / TILE);
  for (let r = 1; r <= 10; r++) {
    let best: { x: number; y: number } | null = null, bestD = Infinity;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const cx = (gx + dx + 0.5) * TILE, cy = (gy + dy + 0.5) * TILE;
      if (!canStand(map, cx, cy)) continue;
      const d = Math.hypot(cx - wx, cy - wy);
      if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
    }
    if (best) return best;
  }
  return null;
}

let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  console.log(`${ok ? "✔" : "✗"} ${name}: ${detail}`);
  if (!ok) failures++;
};

// exercise several surface seeds — the field is procedural, the town/gate is fixed
for (const seed of [1, 7, 42, 1000, 99999]) {
  const layout = generateDungeon(1, 1, seed); // act 1 surface = town + field
  const map = makeMap(layout.rows);
  const townPt = TOWN.spawn;                    // up in the plaza
  const fieldPt = layout.stairs;                // deep in the field, past the gate
  if (isInTown(townPt.y) === false) { check(`seed ${seed} town point`, false, "TOWN.spawn not in town?!"); continue; }
  if (isInTown(fieldPt.y)) { check(`seed ${seed} field point`, false, "stairs not in field?!"); continue; }

  const straight = lineClear(map, townPt.x, townPt.y, fieldPt.x, fieldPt.y);
  const path = findPath(map, townPt.x, townPt.y, fieldPt.x, fieldPt.y);
  const throughGate = !!path && path.some((p) => p.ty === TOWN_ROWS && Math.abs(p.tx - TOWN_GATE_TX) <= 1);

  check(`seed ${seed}: straight town→field is blocked`, straight === false, `lineClear=${straight} (this is why old ground-clicks jammed)`);
  check(`seed ${seed}: BFS finds a route`, !!path, path ? `${path.length} tiles` : "NO PATH");
  check(`seed ${seed}: route passes through the gate`, throughGate, throughGate ? `crosses gate col ${TOWN_GATE_TX} at row ${TOWN_ROWS}` : "route avoids the gate?!");
}

// clicking a wall snaps to a nearby standable tile instead of dropping the click
{
  const layout = generateDungeon(1, 1, 7);
  const map = makeMap(layout.rows);
  // a guaranteed wall tile: (0,0) is always border "#"
  const snap = nearestStandable(map, 0.5 * TILE, 0.5 * TILE);
  check("clicking a wall snaps to a standable tile", !!snap && canStand(map, snap.x, snap.y), snap ? `snapped to (${snap.x.toFixed(0)},${snap.y.toFixed(0)})` : "no standable tile found");
}

console.log(failures === 0 ? "\nPATHFIND CHECK PASSED ✔" : `\nPATHFIND CHECK FAILED (${failures}) ✗`);
process.exit(failures === 0 ? 0 : 1);
