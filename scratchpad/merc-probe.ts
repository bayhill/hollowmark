import { Client } from "colyseus.js";
import { TOWN } from "@arpg/common";
async function main() {
  const c = new Client("ws://localhost:2567");
  const r = await c.create("dungeon", { key: `mp${Date.now().toString(36)}`, cls: "barbarian", name: "Probe" });
  let mercs: any = null;
  r.onMessage("openmercs", (m: any) => (mercs = m));
  r.onMessage("*", () => {});
  await new Promise((res) => setTimeout(res, 700));
  const st: any = r.state;
  let marenId = "";
  st.shrines.forEach((s: any, id: string) => { if (s.kind === "mercnpc") marenId = id; });
  console.log("maren shrine:", marenId || "MISSING");
  const me = () => st.players.get(r.sessionId);
  for (let i = 0; i < 20 && Math.hypot(me().x - TOWN.maren.x, me().y - TOWN.maren.y) > 40; i++) {
    r.send("move", { x: TOWN.maren.x, y: TOWN.maren.y });
    await new Promise((res) => setTimeout(res, 250));
  }
  console.log("dist to maren:", Math.hypot(me().x - TOWN.maren.x, me().y - TOWN.maren.y).toFixed(0));
  r.send("touchshrine", { id: marenId });
  await new Promise((res) => setTimeout(res, 800));
  console.log("openmercs:", mercs ? JSON.stringify(mercs.offers?.map((o: any) => `${o.name}/${o.archetype}/${o.cost}g`)) : "NOTHING");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
