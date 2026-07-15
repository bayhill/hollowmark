import http from "http";
import { Server, matchMaker } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { DungeonRoom } from "./rooms/DungeonRoom";
import { listProfiles, loadProfile, validKey } from "./persistence";
import { CURRENT_SEASON } from "@arpg/common";

const port = Number(process.env.PORT || 2567);

// tiny HTTP layer: the lobby asks /rooms which games are open,
// the hero-select screen asks /heroes who its keys belong to
const httpServer = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.url?.startsWith("/heroes")) {
    const url = new URL(req.url, `http://localhost:${port}`);
    const keys = (url.searchParams.get("keys") ?? "").split(",").filter(validKey).slice(0, 20);
    const heroes = keys.map((key) => {
      const prof = loadProfile(key);
      return prof
        ? {
            key, name: prof.name ?? "", cls: prof.cls, level: prof.level, deepestFloor: prof.deepestFloor ?? 1,
            actsUnlocked: prof.actsUnlocked ?? 1, diffUnlocked: prof.diffUnlocked ?? 1, abyssDeepest: prof.abyssDeepest ?? 0,
            hardcore: !!prof.hardcore, dead: !!prof.dead, diedFloor: prof.diedFloor ?? 0, diedAct: prof.diedAct ?? 0, diedTo: prof.diedTo ?? "",
          }
        : { key, name: "", cls: "", level: 0, deepestFloor: 0, actsUnlocked: 0, diffUnlocked: 0, abyssDeepest: 0, hardcore: false, dead: false, diedFloor: 0, diedAct: 0, diedTo: "" }; // never joined yet
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(heroes));
    return;
  }
  if (req.url === "/legends") {
    // the Hall of Legends: the deepest heroes this server remembers — and its
    // most recent hardcore dead, honored regardless of how far they got
    // only THIS season's heroes contend on the ladder (a reset bumps CURRENT_SEASON)
    const all = listProfiles().filter((p) => p.name && (p.season ?? 1) === CURRENT_SEASON);
    // the endgame ladder: Rift Tier crowns it, then how far east / deep / high
    const ranked = [...all].sort(
      (a, b) =>
        (b.riftTier ?? 0) - (a.riftTier ?? 0) ||
        (b.diffUnlocked ?? 1) - (a.diffUnlocked ?? 1) ||
        (b.actsUnlocked ?? 1) - (a.actsUnlocked ?? 1) ||
        (b.abyssDeepest ?? 0) - (a.abyssDeepest ?? 0) ||
        b.level - a.level ||
        (b.deepestFloor ?? 1) - (a.deepestFloor ?? 1)
    );
    const top = ranked.slice(0, 15);
    const memorial = all
      .filter((p) => p.dead && p.hardcore && !top.includes(p))
      .sort((a, b) => (b.diedAt ?? 0) - (a.diedAt ?? 0))
      .slice(0, 5);
    const profs = [...top, ...memorial].map((p) => ({
      name: p.name, cls: p.cls, level: p.level, deepestFloor: p.deepestFloor ?? 1,
      actsUnlocked: p.actsUnlocked ?? 1, diffUnlocked: p.diffUnlocked ?? 1, abyssDeepest: p.abyssDeepest ?? 0,
      riftTier: p.riftTier ?? 0,
      hardcore: !!p.hardcore, dead: !!p.dead, diedFloor: p.diedFloor ?? 0, diedAct: p.diedAct ?? 0, diedTo: p.diedTo ?? "",
    }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(profs)); // array contract preserved; season is applied as a filter
    return;
  }
  if (req.url === "/rooms") {
    try {
      const rooms = await matchMaker.query({ name: "dungeon", locked: false });
      const list = rooms.map((r) => ({
        roomId: r.roomId,
        clients: r.clients,
        maxClients: r.maxClients,
        metadata: r.metadata ?? {},
      }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(list));
    } catch {
      res.writeHead(500);
      res.end("[]");
    }
    return;
  }
  res.writeHead(404);
  res.end();
});

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});
gameServer.define("dungeon", DungeonRoom);

gameServer.listen(port).then(() => {
  console.log(`[server] listening on ws://localhost:${port} (lobby list at /rooms)`);
});
