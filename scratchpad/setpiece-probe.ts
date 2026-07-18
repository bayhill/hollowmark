// Stage 2 — environmental set-pieces. Pure battery + a live runtime pass.
//   pure:    every set-piece names a real fragment; the set-piece chapters are fully
//            completable from set-pieces; acts/variants/pages well-formed
//   runtime: smokesetpiece spawns a scene → touchshrine recovers its fragment, dedups on
//            re-touch, and finishing all of a chapter's set-pieces fires the chapter boon
// Run (needs dev server on :2567): npx tsx scratchpad/setpiece-probe.ts
import { Client } from "colyseus.js";
import {
  SETPIECES,
  setpieceById,
  rollSetpiece,
  SETPIECE_CHANCE,
  fragmentById,
  LORE_FRAGMENTS,
  CODEX_CHAPTERS,
  chapterFragments,
} from "@hollowmark/common";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (n: string, ok: boolean, d: string) => { if (!ok) fails++; console.log(`${ok ? "✔" : "✗"} ${n}: ${d}`); };

// ---------- pure battery ----------
const LOOKS = new Set(["altar", "cairn", "shroud", "ferry", "marker"]);
const badFrag = SETPIECES.filter((s) => !fragmentById(s.fragmentId));
check("every set-piece names a real fragment", badFrag.length === 0, badFrag.length ? `bad: ${badFrag.map((s) => s.id).join(", ")}` : `${SETPIECES.length} set-pieces`);
check("set-piece ids are unique", new Set(SETPIECES.map((s) => s.id)).size === SETPIECES.length, "no dup ids");
check("each fragment is granted by at most one set-piece", new Set(SETPIECES.map((s) => s.fragmentId)).size === SETPIECES.length, "no two scenes share a fragment");
const badAct = SETPIECES.filter((s) => !(s.act >= 0 && s.act <= 4));
check("every set-piece act is 0..4", badAct.length === 0, badAct.map((s) => s.id).join(", ") || "all valid");
const badLook = SETPIECES.filter((s) => !LOOKS.has(s.variant));
check("every set-piece variant is a known look", badLook.length === 0, badLook.map((s) => s.variant).join(", ") || [...LOOKS].join("/"));
const thinPages = SETPIECES.filter((s) => !s.pages?.length || s.pages.some((p) => !p));
check("every set-piece has real inscription pages", thinPages.length === 0, thinPages.map((s) => s.id).join(", ") || "all have pages");

// the set-piece-sourced chapters must be fully completable from set-pieces
const setpieceFragIds = new Set(SETPIECES.map((s) => s.fragmentId));
for (const chId of ["ch_ternion", "ch_folk"]) {
  const ch = CODEX_CHAPTERS.find((c) => c.id === chId);
  const frags = chapterFragments(chId);
  const covered = frags.every((f) => setpieceFragIds.has(f.id));
  check(`chapter '${chId}' is completable from set-pieces`, !!ch && frags.length > 0 && covered, ch ? `${frags.filter((f) => setpieceFragIds.has(f.id)).length}/${frags.length} fragments have a scene` : "chapter missing");
}
// set-piece fragments must not double as boss drops
const dualSourced = LORE_FRAGMENTS.filter((f) => setpieceFragIds.has(f.id) && f.bossKind);
check("set-piece fragments are not also boss-sourced", dualSourced.length === 0, dualSourced.map((f) => f.id).join(", ") || "clean split");
for (const act of [1, 2, 3, 4]) {
  const sp = rollSetpiece(act, () => 0);
  check(`rollSetpiece(act ${act}) returns a scene for that act`, !!sp && (sp.act === act || sp.act === 0), sp ? `${sp.id} (act ${sp.act})` : "none");
}
check("SETPIECE_CHANCE is sane", SETPIECE_CHANCE > 0 && SETPIECE_CHANCE <= 1, `${SETPIECE_CHANCE}`);

// ---------- runtime ----------
async function spawnAndTouch(room: any, spId: string) {
  let shrineId = "";
  const onId = (m: any) => { shrineId = m.id; };
  room.onMessage("smokechamp", onId);
  room.send("smokesetpiece", { id: spId });
  await sleep(300);
  room.send("touchshrine", { id: shrineId });
  await sleep(300);
  return shrineId;
}

(async () => {
  const c = new Client("ws://localhost:2567");
  const acct = `sprt${Date.now().toString(36)}`;
  const r: any = await c.create("dungeon", { key: `${acct}h`, account: acct, cls: "rogue", name: "SPProbe" });
  r.onMessage("*", () => {});
  let codex: any = null;
  const logs: string[] = [];
  r.onMessage("codex", (m: any) => { codex = m; });
  r.onMessage("codexlog", (m: any) => logs.push(m.text));
  let opened = 0;
  r.onMessage("setpiece", () => opened++);
  await sleep(800);

  // touch the three Ternion scenes — the third should finish the chapter
  const sid = await spawnAndTouch(r, "sp_ternion_a");
  await spawnAndTouch(r, "sp_ternion_b");
  await spawnAndTouch(r, "sp_ternion_c");
  await spawnAndTouch(r, "sp_folk_1");
  await sleep(400);

  const frags: string[] = codex?.fragments ?? [];
  check("touching a set-piece recovered its fragment", frags.includes("frag_ternion_a"), JSON.stringify(frags));
  check("all four scenes recovered their fragments", ["frag_ternion_a", "frag_ternion_b", "frag_ternion_c", "frag_folk_1"].every((f) => frags.includes(f)), `${frags.length} fragments`);
  check("each touch opened its inscription", opened >= 4, `${opened} readings opened`);
  check("fragment-recovered logged", logs.filter((t) => t.startsWith("Fragment recovered")).length >= 4, logs.filter((t) => t.startsWith("Fragment recovered")).length + " lines");
  check("finishing a chapter fired the boon", logs.some((t) => t.includes("Chapter complete: The Ternion Order")), logs.filter((t) => t.includes("Chapter complete")).join(" | ") || "(none)");

  // re-touch an already-read scene — dedup, no second copy, no crash
  const before = frags.length;
  await spawnAndTouch(r, "sp_ternion_a");
  await sleep(300);
  check("re-touching does not duplicate the fragment", (codex?.fragments?.length ?? 0) === before, `len ${codex?.fragments?.length} (was ${before})`);

  await r.leave();
  console.log(`\n${fails === 0 ? "✅ ALL GREEN" : `❌ ${fails} FAILURE(S)`} — Set-pieces (Stage 2)`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error("ERR", e?.stack || e?.message || e); process.exit(3); });
