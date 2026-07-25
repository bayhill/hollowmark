// LOAD TEST: N real clients in ONE room, walking into the field and fighting, so the
// server's tick cost can be measured against party size rather than guessed at.
//
// Not part of `npm run probes` — it is a measurement tool, not a pass/fail gate.
//
//   PARTY=5 npx tsx scripts/probes/loadtest.ts
//
// Pair it with the [TICKSTAT] logging the server prints when instrumented.
import { Client, Room } from "colyseus.js";
import { TILE, TOWN, TOWN_GATE_TX, TOWN_ROWS, canStand, makeMap, isInTown, type GameMap } from "@hollowmark/common";

const ENDPOINT = process.env.PROBE_ENDPOINT || "ws://localhost:2567";
const PARTY = Number(process.env.PARTY || 5);
const SECONDS = Number(process.env.SECONDS || 30);
const CLASSES = ["barbarian", "sorcerer", "necromancer", "rogue", "druid", "paladin"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Member {
  room: Room;
  idx: number;
}

async function main() {
  const stamp = Date.now().toString(36);
  const members: Member[] = [];
  let roomId = "";

  for (let i = 0; i < PARTY; i++) {
    const c = new Client(ENDPOINT);
    // each hero needs its own key — one hero, one body
    const opts = { key: `load${stamp}p${i}`, cls: CLASSES[i % CLASSES.length], name: `Load${i}` };
    const room = i === 0 ? await c.create("dungeon", opts) : await c.joinById(roomId, opts);
    if (i === 0) roomId = room.roomId;
    room.onMessage("*", () => {});
    members.push({ room, idx: i });
    await sleep(150);
  }
  console.log(`${PARTY} heroes in room ${roomId}`);
  await sleep(800);

  const st = (m: Member) => m.room.state as any;
  const me = (m: Member) => st(m).players.get(m.room.sessionId);

  // Level them, make them unkillable, and teach each class its most EXPENSIVE skills —
  // the point is to load the simulation (pets, projectiles, hazards), not to watch five
  // heroes die to the first pack. A necromancer alone can field 6-8 skeletons.
  const LOADOUT: Record<string, string[]> = {
    barbarian: ["bash", "whirlwind"],
    sorcerer: ["chain", "frostnova"],
    necromancer: ["teeth", "skeleton"], // the pet farm — the real entity multiplier
    rogue: ["multishot", "coldarrow"],
    druid: ["firestorm", "twister"],
    paladin: ["smite", "zeal"],
  };
  for (const m of members) {
    m.room.send("smokelevel", { level: 40, points: 60 });
    await sleep(80);
    m.room.send("smokegod");
    await sleep(80);
    const cls = CLASSES[m.idx % CLASSES.length];
    for (const id of LOADOUT[cls] ?? []) {
      for (let r = 0; r < 5; r++) {
        m.room.send("allocskill", { id });
        await sleep(40);
      }
    }
  }
  await sleep(800);
  for (const m of members) {
    const p = me(m);
    console.log(`  ${CLASSES[m.idx % CLASSES.length]} lvl ${p?.level} binds=${JSON.stringify(p?.binds ?? {})}`);
  }

  // The server REJECTS a move to a non-standable tile outright, so aim at real ground:
  // the gate column first (the only way out of the plaza), then into the field.
  const map: GameMap = makeMap((st(members[0]) as any).mapData.split("\n"));
  const gateX = (TOWN_GATE_TX + 0.5) * TILE;
  const standableNear = (x: number, y: number): { x: number; y: number } => {
    for (let r = 0; r < 12; r++) {
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]] as const) {
        const nx = x + dx * r * TILE, ny = y + dy * r * TILE;
        if (canStand(map, nx, ny)) return { x: nx, y: ny };
      }
    }
    return { x, y };
  };
  const deadline = Date.now() + SECONDS * 1000;
  let tick = 0;

  while (Date.now() < deadline) {
    tick++;
    for (const m of members) {
      const p = me(m);
      if (!p) continue;
      if (isInTown(p.y)) {
        // head for the gate column, then straight through it
        const t = p.y < (TOWN_ROWS - 2) * TILE ? { x: gateX, y: (TOWN_ROWS - 1.5) * TILE } : { x: gateX, y: (TOWN_ROWS + 4) * TILE };
        m.room.send("move", standableNear(t.x, t.y));
        continue;
      }
      // find the nearest monster and go hit it
      let bx = 0, by = 0, best = Infinity;
      st(m).monsters.forEach((mo: any) => {
        const d = Math.hypot(mo.x - p.x, mo.y - p.y);
        if (d < best) { best = d; bx = mo.x; by = mo.y; }
      });
      if (best < Infinity) {
        // CHURN=1 keeps everyone in constant motion — the realistic worst case for state
        // sync, since a hero standing still costs Colyseus almost nothing to replicate.
        const t = process.env.CHURN
          ? standableNear(p.x + (Math.random() * 2 - 1) * 220, p.y + (Math.random() * 2 - 1) * 220)
          : { x: bx, y: by };
        m.room.send("move", t);
        m.room.send("attack", { x: bx, y: by });
        if (tick % 3 === 0) m.room.send("skill", { key: "1", x: bx, y: by });
        if (tick % 5 === 0) m.room.send("skill", { key: "2", x: bx, y: by });
      } else {
        // nothing in sight — wander so the floor keeps feeding us fights
        m.room.send("move", { x: p.x + (Math.random() * 2 - 1) * 300, y: p.y + (Math.random() * 2 - 1) * 300 });
      }
    }
    if (tick % 20 === 0) {
      const p = me(members[0]);
      let mobs = 0, pets = 0, proj = 0;
      st(members[0]).monsters.forEach(() => mobs++);
      st(members[0]).pets.forEach(() => pets++);
      st(members[0]).projectiles.forEach(() => proj++);
      const inTown = p ? isInTown(p.y) : true;
      console.log(`  t+${(tick * 0.25).toFixed(0)}s  p0 at (${p?.x?.toFixed(0)},${p?.y?.toFixed(0)}) ${inTown ? "IN TOWN" : "in field"} · mobs=${mobs} pets=${pets} proj=${proj}`);
    }
    await sleep(250);
  }

  const s0 = st(members[0]);
  let mobs = 0, pets = 0, mercs = 0;
  s0.monsters.forEach(() => mobs++);
  s0.pets.forEach(() => pets++);
  s0.mercs.forEach(() => mercs++);
  console.log(`final: players=${s0.players.size} monsters=${mobs} pets=${pets} mercs=${mercs}`);

  for (const m of members) await m.room.leave();
  await sleep(400);
  process.exit(0);
}

main().catch((e) => {
  console.error("loadtest failed:", e?.message ?? e);
  process.exit(1);
});
