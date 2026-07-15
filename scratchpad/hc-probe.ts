import { Client } from "colyseus.js";
import { TILE, TOWN, makeMap, isInTown } from "@arpg/common";

const tileOf = (w: number) => Math.floor(w / TILE);
function bfs(map: any, from: [number, number], to: [number, number]): Array<[number, number]> | null {
  const key = (x: number, y: number) => `${x},${y}`;
  const prev = new Map<string, string>();
  prev.set(key(...from), "");
  const q: Array<[number, number]> = [from];
  while (q.length) {
    const [x, y] = q.shift()!;
    if (x === to[0] && y === to[1]) {
      const path: Array<[number, number]> = [];
      let cur = key(x, y);
      while (cur) {
        const [cx, cy] = cur.split(",").map(Number);
        path.push([cx, cy]);
        cur = prev.get(cur)!;
      }
      return path.reverse();
    }
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
      const k = key(nx, ny);
      if (prev.has(k) || map.rows[ny].charAt(nx) === "#") continue;
      prev.set(k, key(x, y));
      q.push([nx, ny]);
    }
  }
  return null;
}

async function main() {
  const c1 = new Client("ws://localhost:2567");
  const r1 = await c1.create("dungeon", { key: `probe${Date.now().toString(36)}`, cls: "barbarian", name: "Watcher" });
  r1.onMessage("*", () => {});
  const cHC = new Client("ws://localhost:2567");
  const rHC = await cHC.joinById(r1.roomId, { key: `doom${Date.now().toString(36)}`, cls: "sorcerer", name: "Doomed", hardcore: true });
  rHC.onMessage("*", () => {});
  await new Promise((r) => setTimeout(r, 800));
  const st: any = r1.state;
  const map = makeMap(String(st.mapData).split("\n"));
  const me = () => st.players.get(rHC.sessionId);
  console.log("joined:", me().hardcore, "at", me().x, me().y, "hp", me().hp);
  for (let i = 0; i < 90; i++) {
    let target: any = null, bd = Infinity;
    st.monsters.forEach((m: any) => {
      const d = Math.hypot(m.x - me().x, m.y - me().y);
      if (d < bd) { bd = d; target = m; }
    });
    if (target && bd > 40) {
      const path = bfs(map, [tileOf(me().x), tileOf(me().y)], [tileOf(target.x), tileOf(target.y)]);
      if (path && path.length > 1) {
        const step = path[Math.min(3, path.length - 1)];
        rHC.send("move", { x: (step[0] + 0.5) * TILE, y: (step[1] + 0.5) * TILE });
      } else {
        rHC.send("move", { x: target.x, y: target.y });
        if (i % 5 === 0) console.log("  no path!", tileOf(me().x), tileOf(me().y), "->", tileOf(target.x), tileOf(target.y));
      }
    }
    if (i % 5 === 0) console.log(`t=${i * 0.4}s pos=(${me().x.toFixed(0)},${me().y.toFixed(0)}) tile=(${tileOf(me().x)},${tileOf(me().y)}) hp=${me().hp.toFixed(0)} inTown=${isInTown(me().y)} nearest=${bd.toFixed(0)}`);
    if (me().hp <= 0) { console.log("DIED at t=", i * 0.4); break; }
    await new Promise((r) => setTimeout(r, 400));
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
