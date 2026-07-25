// Pure battery for The Codex (Stage 1). No server needed — validates the data model
// and the account-wide reward math end to end.
//   • Bestiary is a bijection with the live monster/boss roster (nothing uncatalogued)
//   • every lore fragment belongs to a real chapter and (if boss-sourced) a real boss
//   • chapterComplete / codexChapterBonuses behave (partial → nothing, full → the boon)
//   • every curated relic names a real unique/set item
// Run: npx tsx scripts/probes/offline/codex-probe.ts
import {
  MONSTERS,
  isBossKind,
  BESTIARY,
  bestiaryEntry,
  LORE_FRAGMENTS,
  CODEX_CHAPTERS,
  chapterFragments,
  chapterComplete,
  codexChapterBonuses,
  RELIC_LORE,
  FIXED_ITEMS,
  SET_ITEMS,
  SETS,
  addStats,
  type ItemStats,
} from "@hollowmark/common";

let failures = 0;
const check = (name: string, ok: boolean, detail: string) => {
  if (!ok) failures++;
  console.log(`${ok ? "✔" : "✗"} ${name}: ${detail}`);
};

// ---- 1. Bestiary ↔ monster roster is a bijection ----
const monsterKinds = new Set(Object.keys(MONSTERS));
const bestiaryKinds = new Set(BESTIARY.map((b) => b.kind));
const uncatalogued = [...monsterKinds].filter((k) => !bestiaryKinds.has(k));
const orphanEntries = [...bestiaryKinds].filter((k) => !monsterKinds.has(k));
check("every monster kind has a bestiary entry", uncatalogued.length === 0, uncatalogued.length ? `missing: ${uncatalogued.join(", ")}` : `all ${monsterKinds.size} covered`);
check("no orphan bestiary entries", orphanEntries.length === 0, orphanEntries.length ? `orphans: ${orphanEntries.join(", ")}` : "every entry maps to a real kind");
check("no duplicate bestiary kinds", bestiaryKinds.size === BESTIARY.length, `${bestiaryKinds.size} unique of ${BESTIARY.length}`);
check("bestiaryEntry() resolves a known kind", bestiaryEntry("uldrath")?.name === "Uldrath, the Unmaker", bestiaryEntry("uldrath")?.name ?? "undefined");
check("bestiaryEntry() rejects an unknown kind", bestiaryEntry("not_a_real_kind") === undefined, "unknown → undefined");
const badInsight = BESTIARY.filter((b) => !(b.insightAt >= 1) || !b.lore || !b.insight);
check("every bestiary entry is well-formed", badInsight.length === 0, badInsight.length ? `bad: ${badInsight.map((b) => b.kind).join(", ")}` : "lore + insight + insightAt≥1");

// ---- 2. Fragments belong to real chapters and real bosses ----
const chapterIds = new Set(CODEX_CHAPTERS.map((c) => c.id));
const fragIds = LORE_FRAGMENTS.map((f) => f.id);
const badChapterRef = LORE_FRAGMENTS.filter((f) => !chapterIds.has(f.chapter));
check("every fragment belongs to a real chapter", badChapterRef.length === 0, badChapterRef.length ? `bad: ${badChapterRef.map((f) => f.id).join(", ")}` : `${LORE_FRAGMENTS.length} fragments`);
check("fragment ids are unique", new Set(fragIds).size === fragIds.length, `${new Set(fragIds).size} unique of ${fragIds.length}`);
const badBossRef = LORE_FRAGMENTS.filter((f) => f.bossKind && !isBossKind(f.bossKind));
check("every boss-sourced fragment names a real boss", badBossRef.length === 0, badBossRef.length ? `bad: ${badBossRef.map((f) => f.bossKind).join(", ")}` : "all boss sources valid");
const emptyChapters = CODEX_CHAPTERS.filter((c) => chapterFragments(c.id).length === 0);
check("every chapter has at least one fragment", emptyChapters.length === 0, emptyChapters.length ? `empty: ${emptyChapters.map((c) => c.id).join(", ")}` : `${CODEX_CHAPTERS.length} chapters`);

// ---- 3. chapterComplete behaves ----
{
  const ch = CODEX_CHAPTERS[0];
  const frags = chapterFragments(ch.id).map((f) => f.id);
  check("empty progress → chapter not complete", chapterComplete(ch.id, []) === false, `${ch.id} with []`);
  check("full progress → chapter complete", chapterComplete(ch.id, frags) === true, `${ch.id} with all ${frags.length}`);
  if (frags.length > 1) {
    check("one missing → chapter not complete", chapterComplete(ch.id, frags.slice(0, -1)) === false, `${ch.id} missing 1`);
  }
  check("unknown chapter id → not complete", chapterComplete("no_such_chapter", fragIds) === false, "safe on bad id");
}

// ---- 4. codexChapterBonuses sums only completed chapters ----
{
  const none = codexChapterBonuses([]);
  check("no chapters complete → empty bonus", Object.keys(none).length === 0, JSON.stringify(none));

  const first = CODEX_CHAPTERS[0];
  const firstFrags = chapterFragments(first.id).map((f) => f.id);
  const oneBonus = codexChapterBonuses(firstFrags);
  const expectOne = first.reward.stats;
  const oneMatches = JSON.stringify(oneBonus) === JSON.stringify(expectOne);
  check("one chapter complete → exactly its reward", oneMatches, `got ${JSON.stringify(oneBonus)} want ${JSON.stringify(expectOne)}`);

  const all = codexChapterBonuses(fragIds);
  const expectAll: ItemStats = {};
  for (const c of CODEX_CHAPTERS) addStats(expectAll, c.reward.stats);
  const allMatches = JSON.stringify(all) === JSON.stringify(expectAll);
  check("all chapters complete → summed reward", allMatches, `got ${JSON.stringify(all)} want ${JSON.stringify(expectAll)}`);
}

// ---- 5. Every curated relic names a real item ----
const itemNames = new Set<string>([
  ...FIXED_ITEMS.map((i) => i.name),
  ...SET_ITEMS.map((i) => i.name),
  ...Object.values(SETS).map((s) => s.name),
]);
const badRelics = RELIC_LORE.filter((r) => !itemNames.has(r.name));
check("every relic names a real item", badRelics.length === 0, badRelics.length ? `unknown: ${badRelics.map((r) => r.name).join(", ")}` : `${RELIC_LORE.length} relics`);
check("relic names are unique", new Set(RELIC_LORE.map((r) => r.name)).size === RELIC_LORE.length, "no dup relic pages");
const emptyRelicLore = RELIC_LORE.filter((r) => !r.lore || r.lore.length < 10);
check("every relic has real lore", emptyRelicLore.length === 0, emptyRelicLore.length ? `thin: ${emptyRelicLore.map((r) => r.name).join(", ")}` : "all have prose");

console.log(`\n${failures === 0 ? "✅ ALL GREEN" : `❌ ${failures} FAILURE(S)`} — Codex data battery`);
process.exit(failures === 0 ? 0 : 1);
