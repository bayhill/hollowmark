// Stage 3 — authored story spine + ending. Pure battery + a live pass.
//   pure:    every beat keys a real quest; exactly one ending; the capstone chapter is
//            completable from the ending fragment; titles/pages well-formed
//   runtime: kill Vessira (act-boss beat) and Uldrath (the finale) through the real death
//            path → the right storybeat fires, and Uldrath seals the Codex capstone
// Run (needs dev server on :2567): npx tsx scratchpad/story-probe.ts
import { Client } from "colyseus.js";
import {
  STORY_BEATS,
  storyBeatFor,
  ENDING_FRAGMENT,
  QUESTS,
  CODEX_CHAPTERS,
  chapterFragments,
  chapterComplete,
  fragmentById,
} from "@hollowmark/common";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (n: string, ok: boolean, d: string) => { if (!ok) fails++; console.log(`${ok ? "✔" : "✗"} ${n}: ${d}`); };

// ---------- pure battery ----------
const questIds = new Set(QUESTS.map((q) => q.id));
const badQuest = STORY_BEATS.filter((b) => !questIds.has(b.quest));
check("every beat keys a real quest", badQuest.length === 0, badQuest.map((b) => b.quest).join(", ") || `${STORY_BEATS.length} beats`);
check("beat quest keys are unique", new Set(STORY_BEATS.map((b) => b.quest)).size === STORY_BEATS.length, "no two beats share a quest");
const endings = STORY_BEATS.filter((b) => b.ending);
check("exactly one beat is the ending", endings.length === 1, endings.map((b) => b.quest).join(", ") || "(none)");
check("the ending is the_unmaking", endings[0]?.quest === "the_unmaking", endings[0]?.quest ?? "undefined");
const thin = STORY_BEATS.filter((b) => !b.title || !b.pages?.length || b.pages.some((p) => !p));
check("every beat is well-formed", thin.length === 0, thin.map((b) => b.quest).join(", ") || "titles + pages");
check("storyBeatFor resolves a real quest", storyBeatFor("the_unmaking")?.ending === true, storyBeatFor("the_unmaking")?.title ?? "undefined");
check("storyBeatFor rejects a non-beat quest", storyBeatFor("gambler") === undefined, "safe on non-beat");

// the capstone chapter must exist and be completable from the ending fragment
const cap = CODEX_CHAPTERS.find((c) => c.id === "ch_ending");
const capFrags = chapterFragments("ch_ending");
check("capstone chapter ch_ending exists", !!cap, cap?.name ?? "missing");
check("ENDING_FRAGMENT is a real fragment", !!fragmentById(ENDING_FRAGMENT), ENDING_FRAGMENT);
check("capstone completes from the ending fragment", capFrags.length === 1 && capFrags[0].id === ENDING_FRAGMENT && chapterComplete("ch_ending", [ENDING_FRAGMENT]), `${capFrags.length} frag(s), complete=${chapterComplete("ch_ending", [ENDING_FRAGMENT])}`);

// ---------- runtime ----------
async function killKind(room: any, kind: string) {
  let id = "";
  const onId = (m: any) => { id = m.id; };
  room.onMessage("smokechamp", onId);
  room.send("smokespawnkind", { kind, hp: 1 });
  await sleep(300);
  room.send("smokedmgmob", { id });
  await sleep(350);
}

(async () => {
  const c = new Client("ws://localhost:2567");
  const acct = `story${Date.now().toString(36)}`;
  const r: any = await c.create("dungeon", { key: `${acct}h`, account: acct, cls: "paladin", name: "StoryProbe" });
  r.onMessage("*", () => {});
  const beats: string[] = [];
  const endings: string[] = [];
  const logs: string[] = [];
  let codex: any = null;
  r.onMessage("storybeat", (m: any) => { beats.push(m.quest); if (storyBeatFor(m.quest)?.ending) endings.push(m.quest); });
  r.onMessage("codex", (m: any) => { codex = m; });
  r.onMessage("codexlog", (m: any) => logs.push(m.text));
  await sleep(800);

  await killKind(r, "vessira"); // Act I boss → non-ending beat
  await killKind(r, "uldrath"); // the Unmaker → the finale
  await sleep(500);

  check("act-boss kill fired its beat", beats.includes("thorned_maiden"), beats.join(", ") || "(none)");
  check("felling Uldrath fired the ending beat", endings.includes("the_unmaking"), endings.join(", ") || "(none)");
  check("the ending fired exactly once", endings.length === 1, `${endings.length} time(s)`);
  check("the ending sealed the Codex capstone fragment", (codex?.fragments ?? []).includes(ENDING_FRAGMENT), JSON.stringify(codex?.fragments));
  check("capstone chapter announced complete", logs.some((t) => t.includes("Chapter complete: The Unmaking Undone")), logs.filter((t) => t.includes("Chapter complete")).join(" | ") || "(none)");

  // re-kill Uldrath — the quest is done, so the beat must NOT replay (farm kills stay quiet)
  await killKind(r, "uldrath");
  await sleep(300);
  check("farm kills do not replay the ending", endings.length === 1, `${endings.length} time(s) after a re-kill`);

  await r.leave();
  console.log(`\n${fails === 0 ? "✅ ALL GREEN" : `❌ ${fails} FAILURE(S)`} — Story spine + ending (Stage 3)`);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error("ERR", e?.stack || e?.message || e); process.exit(3); });
