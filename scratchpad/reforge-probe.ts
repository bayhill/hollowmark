// Verifies the Ternion Altar reforge + recipe panel end-to-end against a live dev server:
//   - the panel opens with a reforge list + recipe availability
//   - reforging re-rolls an item's affixes (same base/rarity/id) and charges gold — and across
//     several reforges the affixes actually VARY (a single reroll could coincidentally match)
//   - a recipe button (3 magic items → an unidentified rare) fires and consumes its reagents
// Requires the dev server (NODE_ENV != production) for smokegive/smokegave hooks.
import { Client } from "colyseus.js";
import { TOWN, TOWN_INTERACT_RANGE } from "@hollowmark/common";

const ENDPOINT = "ws://localhost:2567";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const c = new Client(ENDPOINT);
  const r = await c.create("dungeon", { key: `rf${Date.now().toString(36)}`, cls: "barbarian", name: "Smith" });
  r.onMessage("*", () => {});
  let panel: any = null, gave: any = null, reforged: any = null, transmuted: any = null, loadout: any = null;
  r.onMessage("openaltar", (m: any) => (panel = m));
  r.onMessage("smokegave", (m: any) => (gave = m));
  r.onMessage("reforged", (m: any) => (reforged = m));
  r.onMessage("transmuted", (m: any) => (transmuted = m));
  r.onMessage("loadout", (m: any) => (loadout = m));
  await sleep(700);
  const st: any = r.state;
  const me = () => st.players.get(r.sessionId);
  const invItem = (id: string) => (loadout?.inventory ?? []).find((it: any) => it.id === id);

  let failures = 0;
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "✔" : "✗"} ${name}: ${detail}`);
    if (!ok) failures++;
  };

  // stand at the altar (reforge/recipes are gated on proximity)
  for (let i = 0; i < 40 && me() && Math.hypot(me().x - TOWN.transmute.x, me().y - TOWN.transmute.y) > TOWN_INTERACT_RANGE - 10; i++) {
    r.send("move", { x: TOWN.transmute.x, y: TOWN.transmute.y });
    await sleep(200);
  }
  check("reached the altar", Math.hypot(me().x - TOWN.transmute.x, me().y - TOWN.transmute.y) <= TOWN_INTERACT_RANGE, `dist ${Math.hypot(me().x - TOWN.transmute.x, me().y - TOWN.transmute.y).toFixed(0)}`);

  // --- reforge: give a rare, open the panel, re-roll it several times ---
  gave = null;
  r.send("smokegive", { rarity: "rare" });
  await sleep(300);
  if (!gave) { console.error("smokegive failed"); process.exit(1); }
  const id = gave.id;

  panel = null;
  r.send("openaltar", {});
  await sleep(300);
  check("altar panel opens", !!panel && Array.isArray(panel.reforge) && !!panel.recipes, `reforge rows ${panel?.reforge?.length ?? 0}`);
  const row = (panel?.reforge ?? []).find((x: any) => x.id === id);
  check("granted rare is reforgeable", !!row, row ? `${row.name} @ ${row.price}g` : "not offered");

  const seen = new Set<string>();
  let charged = 0;
  const base0 = invItem(id)?.base, rarity0 = invItem(id)?.rarity;
  for (let i = 0; i < 6; i++) {
    seen.add(JSON.stringify(invItem(id)?.stats ?? {}));
    const goldBefore = me().gold;
    reforged = null;
    r.send("reforge", { id });
    await sleep(350);
    if (reforged) charged += goldBefore - me().gold;
  }
  seen.add(JSON.stringify(invItem(id)?.stats ?? {}));
  check("reforge re-rolls affixes (they vary)", seen.size >= 2, `${seen.size} distinct affix sets across 6 reforges`);
  check("reforge keeps base/rarity/id", invItem(id)?.base === base0 && invItem(id)?.rarity === rarity0 && !!invItem(id), `base ${invItem(id)?.base}, rarity ${invItem(id)?.rarity}`);
  check("reforge charges gold", charged > 0, `spent ${charged}g total`);

  // --- recipe button: 3 magic items → an unidentified rare ---
  for (let i = 0; i < 3; i++) { r.send("smokegive", { rarity: "magic" }); await sleep(200); }
  panel = null;
  r.send("openaltar", {});
  await sleep(300);
  check("recipe availability reported", panel?.recipes?.magics === true, `recipes ${JSON.stringify(panel?.recipes)}`);
  transmuted = null;
  const bagBefore = (loadout?.inventory ?? []).length;
  r.send("altarrecipe", { recipe: "magics" });
  await sleep(400);
  check("recipe button fires (3 magic → rare)", !!transmuted, transmuted ? `${transmuted.recipe} → ${transmuted.result}` : "no transmute");
  check("recipe consumed its reagents", (loadout?.inventory ?? []).length === bagBefore - 3 + 1, `bag ${bagBefore} → ${(loadout?.inventory ?? []).length} (−3 magics +1 rare)`);

  console.log(failures === 0 ? "\nREFORGE PROBE PASSED ✔" : `\nREFORGE PROBE FAILED (${failures}) ✗`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
