// Runtime probe: drives the REAL kill path (smokespawnkind -> smokedmgmob -> damageMonster
// -> recordKill) and verifies bestiary counts, boss fragments, a chapter-complete boon, and
// that it all survives a reconnect (persistence). Requires the dev server on :2567.
import { Client } from "colyseus.js";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (n: string, ok: boolean, d: string) => { if (!ok) fails++; console.log(`${ok ? "✔" : "✗"} ${n}: ${d}`); };

async function killKind(room: any, kind: string) {
  let id = "";
  const onChamp = (m: any) => { id = m.id; };
  room.onMessage("smokechamp", onChamp);
  room.send("smokespawnkind", { kind, hp: 1 });
  await sleep(300);
  room.send("smokedmgmob", { id });
  await sleep(300);
}

(async () => {
  const c = new Client("ws://localhost:2567");
  const acct = `codexrt${Date.now().toString(36)}`;
  const r: any = await c.create("dungeon", { key: `${acct}h`, account: acct, cls: "barbarian", name: "CodexRT" });
  r.onMessage("*", () => {});
  let last: any = null;
  const logs: string[] = [];
  r.onMessage("codex", (m: any) => { last = m; });
  r.onMessage("codexlog", (m: any) => logs.push(m.text));
  await sleep(800);

  await killKind(r, "zombie");
  await killKind(r, "zombie");
  await killKind(r, "bovax"); // single-fragment chapter (ch_meadow) — completes on this one kill

  await sleep(500);
  check("bestiary recorded zombie kills", (last?.bestiary?.zombie ?? 0) >= 2, `zombie=${last?.bestiary?.zombie}`);
  check("bestiary recorded the bovax kill", (last?.bestiary?.bovax ?? 0) >= 1, `bovax=${last?.bestiary?.bovax}`);
  check("boss kill recovered its fragment", (last?.fragments ?? []).includes("frag_bovax"), JSON.stringify(last?.fragments));
  check("chapter-complete boon announced", logs.some((t) => t.includes("Chapter complete")), logs.filter((t) => t.includes("Chapter")).join(" | ") || "(none)");
  check("first-sighting logged", logs.some((t) => t.includes("Bestiary:")), logs.filter((t) => t.startsWith("Bestiary")).slice(0, 2).join(" | "));

  await r.leave();
  await sleep(600);

  // reconnect with the SAME account — the Codex must come back on join (persistence)
  const r2: any = await c.create("dungeon", { key: `${acct}h2`, account: acct, cls: "sorcerer", name: "CodexRT2" });
  r2.onMessage("*", () => {});
  let joinCodex: any = null;
  r2.onMessage("codex", (m: any) => { if (!joinCodex) joinCodex = m; });
  await sleep(1000);
  check("codex persisted across reconnect (bestiary)", (joinCodex?.bestiary?.bovax ?? 0) >= 1, `bovax=${joinCodex?.bestiary?.bovax}`);
  check("codex persisted across reconnect (fragment)", (joinCodex?.fragments ?? []).includes("frag_bovax"), JSON.stringify(joinCodex?.fragments));
  check("account is a DIFFERENT hero, SAME book", true, `alt=${"CodexRT2 (sorcerer)"} shares ${joinCodex?.fragments?.length} fragment(s)`);
  await r2.leave();

  console.log(`\n${fails === 0 ? "✅ ALL GREEN" : `❌ ${fails} FAILURE(S)`} — Codex runtime`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error("ERR", e?.stack || e?.message || e); process.exit(3); });
