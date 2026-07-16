// Headless end-to-end test: two clients, movement, combat, xp, boss, skills,
// loot (auto-equip), potions, and descending to floor 2 on a procedural map.
import { Client, Room } from "colyseus.js";
import { BASE_ITEMS, BOSS_SIGNATURES, CHAMPION_MODS, CLASSES, CLASS_ATTACKS, CLASS_BASE_ATTRS, EFFECTS, FIXED_ITEMS, FLOOR_THEMES, GAMBLE_WEIGHTS, GameMap, MERC_CLASSES, recruiterForAct, actTownNpcs, ACT_TOWN_NPCS, TOWN_NPCS, townNpcById, shrineNpcId, ENCOUNTERS, rollEncounter, encounterById, storytellerFor, MONSTER_ELEMENTS, MONSTERS, RANGED_MONSTERS, PORTAL_CAST_MS, PORTAL_RETURN_MS, QUESTS, TOWN_GATE_TX, TOWN_ROWS, RES_CAP, RUNES, RUNE_ORDER, RUNEWORDS, SETS, generateJewel, SKILL_TREES, SKILL_POWERS, TILE, TIER_LEVELS, TOWN, UNIDENTIFIED_RARITIES, attrBonus, bossKindForFloor, bountyGoalFor, bountyTextFor, canAllocSkill, canStand, hasLineOfSight, generateCharm, generateCowLevel, generateDungeon, generateFixedItem, generateItem, generateRune, identifyCost, isBossKind, isInTown, makeMap, matchRuneword, maxHpFor, pickMonsterKind, potionCapFor, resistOf, skillDamageMult, tileAt, visualThemeIndexForFloor, visualThemeFor, actBossKindFor, ACT_FLOORS, ABYSS_ACT } from "@hollowmark/common";

const ENDPOINT = "ws://localhost:2567";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseMap(room: Room): GameMap {
  return makeMap((room.state as any).mapData.split("\n"));
}

// BFS over floor tiles; returns tile waypoints (excluding start), or null
function bfs(
  map: GameMap,
  from: [number, number],
  to: [number, number],
  avoid?: { tx: number; ty: number; r: number }
): Array<[number, number]> | null {
  const key = (x: number, y: number) => y * map.w + x;
  const blocked = (x: number, y: number) =>
    tileAt(map, x, y) === 1 ||
    (avoid ? Math.abs(x - avoid.tx) <= avoid.r && Math.abs(y - avoid.ty) <= avoid.r : false);
  if (blocked(to[0], to[1])) return null;
  const prev = new Map<number, number>();
  const queue: Array<[number, number]> = [from];
  prev.set(key(from[0], from[1]), -1);
  while (queue.length) {
    const [x, y] = queue.shift()!;
    if (x === to[0] && y === to[1]) {
      const path: Array<[number, number]> = [];
      let k = key(x, y);
      while (k !== key(from[0], from[1])) {
        path.unshift([k % map.w, Math.floor(k / map.w)]);
        k = prev.get(k)!;
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
      if (blocked(nx, ny) || prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), key(x, y));
      queue.push([nx, ny]);
    }
  }
  return null;
}

const tileOf = (v: number) => Math.floor(v / TILE);

async function main() {
  const c1 = new Client(ENDPOINT);
  const c2 = new Client(ENDPOINT);

  const smokeKey = `smoketest${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  // r1 arrives through the character-creation flow: chosen class + name
  const r1 = await c1.create("dungeon", { key: smokeKey, cls: "barbarian", name: "Smokey" });
  const r2 = await c2.joinById(r1.roomId); // keyless guest — both flows must work
  console.log(`joined: r1=${r1.sessionId} r2=${r2.sessionId} room=${r1.roomId}`);

  let playerWasHit = false;
  let lastLoadout: any = null;
  for (const r of [r1, r2]) {
    for (const t of ["swing", "impact", "death", "pickedup", "levelup", "whirl", "shout", "chainfx", "teleportfx", "dashfx", "riftbloom", "poolfx", "bossaggro", "heal", "descend", "goblinspotted", "goblinescape", "shrinefx", "novacharge", "novafire", "queenspawn", "gamblefx", "chestfx", "lore", "portalcast", "portalfx", "portalcancel", "openstash", "vendorhint", "sold", "skilllearned", "dodge", "warcryfx", "ancientsfx", "vengeancefx", "firewallfx", "meteorwarn", "meteorfall", "socketed", "secondwind", "golddrop", "identified", "identifyfail", "waypointfx", "waypoints", "stairslocked", "transmutefx", "transmuted", "transmutehint", "reforgefx", "openaltar", "reforged", "victory", "bountydone", "pilgrim", "wandererdead", "manaheal", "cowopen", "chat", "mswing", "mheal", "mortarwarn", "mortarhit", "wardup", "classfx", "aegisfx", "deathlessfx", "culledfx", "questdone", "shopbought", "shopfail", "vendorbought", "ping", "announce", "grave", "hardcoredeath", "mercshot", "merchired", "mercdead", "encounter"]) {
      r.onMessage(t, () => {});
    }
    r.onMessage("hit", (msg: any) => {
      if (r === r1 && msg.t === "p" && msg.id === r1.sessionId) playerWasHit = true;
    });
  }
  r1.onMessage("loadout", (msg: any) => (lastLoadout = msg));
  r2.onMessage("loadout", () => {});
  r2.onMessage("gamblefail", () => {});
  let lastQuests: any = null;
  r1.onMessage("quests", (msg: any) => (lastQuests = msg));
  r2.onMessage("quests", () => {});
  let lastShop: any = null;
  r1.onMessage("openshop", (msg: any) => (lastShop = msg));
  r2.onMessage("openshop", () => {});
  let lastVendor: any = null;
  r1.onMessage("openvendor", (msg: any) => (lastVendor = msg));
  r2.onMessage("openvendor", () => {});
  let lastGamble: any = null;
  r1.onMessage("opengamble", (msg: any) => (lastGamble = msg));
  r2.onMessage("opengamble", () => {});
  let lastGambled: any = null;
  r1.onMessage("gambled", (msg: any) => (lastGambled = msg));
  r2.onMessage("gambled", () => {});
  let lastMercs: any = null;
  r1.onMessage("openmercs", (msg: any) => (lastMercs = msg));
  r2.onMessage("openmercs", () => {});
  let lastMercLoadout: any = null;
  r1.onMessage("mercloadout", (msg: any) => (lastMercLoadout = msg));
  r2.onMessage("mercloadout", () => {});
  let lastShopfail: any = null;
  r1.onMessage("shopfail", (msg: any) => (lastShopfail = msg)); // overrides the no-op above (re-registration replaces)
  let lastEncounter: any = null;
  r1.onMessage("encounter", (msg: any) => (lastEncounter = msg));
  r2.onMessage("encounter", () => {});
  let r1Trade: any = null;
  let r2Trade: any = null;
  let r1TradeDone: any = null;
  let r2TradeDone: any = null;
  let r2TradeInvite: any = null;
  let r1TradeOpen = false;
  let r2TradeOpen = false;
  let r2Loadout: any = null;
  r1.onMessage("tradeinvite", () => {});
  r2.onMessage("tradeinvite", (m: any) => (r2TradeInvite = m));
  r1.onMessage("tradeopen", () => (r1TradeOpen = true));
  r2.onMessage("tradeopen", () => (r2TradeOpen = true));
  r1.onMessage("tradeupdate", (m: any) => (r1Trade = m));
  r2.onMessage("tradeupdate", (m: any) => (r2Trade = m));
  r1.onMessage("tradedone", (m: any) => (r1TradeDone = m));
  r2.onMessage("tradedone", (m: any) => (r2TradeDone = m));
  r2.onMessage("loadout", (m: any) => (r2Loadout = m)); // overwrite the earlier noop — trades refresh it
  for (const r of [r1, r2]) {
    for (const tm of ["tradefail", "tradeclosed", "tradehint", "tradedecline"]) r.onMessage(tm, () => {});
  }

  await sleep(500);

  const state = () => r1.state as any;
  const me = () => state().players.get(r1.sessionId);
  const monsters = state().monsters;
  const loot = state().loot;

  if (state().players.size !== 2 || (r2.state as any).players.size !== 2) {
    throw new Error("both clients should see 2 players");
  }
  if (state().floor !== 1) throw new Error("should start on floor 1");
  if (!state().bountyText) throw new Error("floor rolled no bounty");
  console.log(`bounty rolled: "${state().bountyText}" (goal ${state().bountyGoal})`);
  let map = parseMap(r1);
  console.log(`floor 1: ${map.w}x${map.h} map, ${monsters.size} monsters, stairs at (${state().stairsX}, ${state().stairsY})`);

  // --- every hero starts in town now, even returning ones ---
  if (!isInTown(me().y)) throw new Error(`hero spawned outside town (y=${me().y.toFixed(0)})`);
  // the join-time copy races our handler registration — poll getquests until it lands
  {
    const dl = Date.now() + 8000;
    while (!lastQuests?.list?.length && Date.now() < dl) {
      r1.send("getquests", {});
      await sleep(400);
    }
  }
  if (!lastQuests?.list?.length) throw new Error("no quest log received on join (getquests unanswered in 8s)");
  if (lastQuests.list.length !== QUESTS.length || QUESTS.length < 15) {
    throw new Error(`quest log incomplete: ${lastQuests.list.length}/${QUESTS.length} (want 15+)`);
  }
  console.log(`starts in town with a quest log: ${lastQuests.list.length} quests known`);
  // …and floor 1 is the forest, cathedral included
  if (state().cathedralX < 0 || state().cathedralW <= 0) throw new Error("floor 1 has no cathedral rect");
  console.log(`the forest stands: cathedral at tiles (${state().cathedralX},${state().cathedralY}) ${state().cathedralW}x${state().cathedralH}`);
  if (!["clear", "rain", "mist"].includes(state().weather)) {
    throw new Error(`the moor's sky rolled nothing (weather="${state().weather}")`);
  }
  console.log(`the sky has a mood: ${state().weather}`);

  // stairs tile, to avoid stumbling into a descend mid-test
  const stairsAvoid = () => ({ tx: tileOf(state().stairsX), ty: tileOf(state().stairsY), r: 1 });

  async function waitAlive() {
    while (me().hp <= 0) await sleep(300);
  }

  // swing at anything close and quaff when low — survival instincts for the walker
  function fightBack() {
    let bx = 0;
    let by = 0;
    let bd = Infinity;
    monsters.forEach((m: any) => {
      const d = Math.hypot(m.x - me().x, m.y - me().y);
      if (d < bd) {
        bd = d;
        bx = m.x;
        by = m.y;
      }
    });
    if (bd < 70) r1.send("attack", { x: bx, y: by });
    if (me().hp < 35 && me().potions > 0) r1.send("drink", {});
  }

  async function walkTo(wx: number, wy: number, label: string, avoidStairs = true) {
    await waitAlive();
    const path = bfs(
      map,
      [tileOf(me().x), tileOf(me().y)],
      [tileOf(wx), tileOf(wy)],
      avoidStairs ? stairsAvoid() : undefined
    );
    if (!path) throw new Error(`no path to ${label}`);
    for (let i = 0; i < path.length; i += 2) {
      if (me().hp <= 0) throw new Error("died-while-walking"); // caller retries
      const [tx, ty] = path[Math.min(i + 1, path.length - 1)];
      const cx = (tx + 0.5) * TILE;
      const cy = (ty + 0.5) * TILE;
      r1.send("move", { x: cx, y: cy });
      const dl = Date.now() + 3000;
      let tick = 0;
      while (Date.now() < dl && me().hp > 0 && Math.hypot(me().x - cx, me().y - cy) > 26) {
        if (++tick % 4 === 0) {
          fightBack();
          r1.send("move", { x: cx, y: cy }); // resume walking after swinging
        }
        await sleep(80);
      }
    }
    // final approach
    r1.send("move", { x: wx, y: wy });
    await sleep(400);
  }

  // --- movement over the network ---
  const start = { x: me().x, y: me().y };
  let moveTarget: { x: number; y: number } | null = null;
  outer: for (let ring = 3; ring <= 5; ring++) {
    for (const [dx, dy] of [[ring, 0], [-ring, 0], [0, ring], [0, -ring]] as const) {
      const tx = tileOf(start.x) + dx;
      const ty = tileOf(start.y) + dy;
      const wx = (tx + 0.5) * TILE;
      const wy = (ty + 0.5) * TILE;
      if (canStand(map, wx, wy) && bfs(map, [tileOf(start.x), tileOf(start.y)], [tx, ty], stairsAvoid())) {
        moveTarget = { x: wx, y: wy };
        break outer;
      }
    }
  }
  if (!moveTarget) throw new Error("could not find a walkable move target near spawn");
  await walkTo(moveTarget.x, moveTarget.y, "move target");
  const seenByR2 = (r2.state as any).players.get(r1.sessionId);
  if (Math.hypot(seenByR2.x - moveTarget.x, seenByR2.y - moveTarget.y) > 30) {
    throw new Error("client 2 does not see client 1 at the move target");
  }
  console.log("movement + sync works");

  // --- chat: the party talks, names attached ---
  {
    let chatMsg: any = null;
    r2.onMessage("chat", (m: any) => (chatMsg = m));
    r1.send("chat", { text: "  Meat for the hooks!  " });
    await sleep(500);
    if (!chatMsg) throw new Error("chat message not received by the other client");
    if (chatMsg.name !== "Smokey" || chatMsg.text !== "Meat for the hooks!") {
      throw new Error(`chat garbled: ${JSON.stringify(chatMsg)}`);
    }
    console.log(`chat works: [${chatMsg.name}] ${chatMsg.text}`);

    // world pings reach the whole party
    let pingMsg: any = null;
    r2.onMessage("ping", (m: any) => (pingMsg = m));
    r1.send("ping", { x: me().x + 50, y: me().y + 50 });
    await sleep(500);
    if (!pingMsg || pingMsg.name !== "Smokey") throw new Error("ping did not reach the party");
    console.log(`ping works: ${pingMsg.name} marked (${pingMsg.x.toFixed(0)}, ${pingMsg.y.toFixed(0)})`);
  }

  // --- one hero, one body: the same key cannot join twice ---
  {
    const cDup = new Client(ENDPOINT);
    let rejected = false;
    try {
      await cDup.joinById(r1.roomId, { key: smokeKey });
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error("duplicate hero was allowed into the game");
    console.log("duplicate heroes rejected: one hero, one body");
  }

  // --- lobby listing: the /rooms endpoint sees this game ---
  {
    const res = await fetch("http://localhost:2567/rooms");
    const rooms: any[] = await res.json();
    const ours = rooms.find((r) => r.roomId === r1.roomId);
    if (!ours) throw new Error("our game is missing from the lobby list");
    if (ours.clients !== 2) throw new Error(`lobby shows ${ours.clients} clients, expected 2`);
    if ((ours.metadata?.floor ?? 0) !== 1) throw new Error("lobby metadata missing floor");
    if ((ours.metadata?.act ?? 0) !== 1) throw new Error("lobby metadata missing act");
    if ((ours.metadata?.difficulty ?? 0) !== 1) throw new Error("lobby metadata missing difficulty");
    console.log(`lobby works: game listed with ${ours.clients}/${ours.maxClients} heroes in act ${ours.metadata.act}, floor ${ours.metadata.floor} (${ours.metadata.zoneName})`);
  }

  // --- wall click rejected ---
  r1.send("move", { x: -50, y: -50 });
  await sleep(300);
  if (Math.hypot(me().x + 50, me().y + 50) < 100) throw new Error("server accepted an out-of-bounds move");
  console.log("wall/out-of-bounds click correctly rejected");

  // --- boss present & roster sane ---
  let bossName = "";
  monsters.forEach((m: any) => {
    if (m.kind === "flenser") bossName = m.name;
  });
  if (bossName !== "Hargol the Flenser") throw new Error(`floor 1 boss missing or unnamed (got "${bossName}")`);
  // every act climbs to its own finale; the Abyss rotates the whole roster
  const finales = [1, 2, 3, 4].map((a) => actBossKindFor(a, ACT_FLOORS));
  if (finales.join(",") !== "vessira,nyzat,ssarim,uldrath") {
    throw new Error(`act finales wrong: ${finales.join(",")}`);
  }
  if (actBossKindFor(1, 1) !== "flenser") throw new Error("the Flenser no longer prowls the Mournfield");
  if (actBossKindFor(4, 6) !== "malgrim") throw new Error("Malgrim is not guarding the Hollow Throne's penultimate floor");
  if (actBossKindFor(2, 4) !== "vuruk") throw new Error("the White Maw is not waiting in the middle tombs");
  if (actBossKindFor(3, 4) !== "orvath") throw new Error("the Grudge Eternal is not brooding mid-temple");
  if (actBossKindFor(4, 4) !== "aldric") throw new Error("the Forsworn is not holding the fourth floor of the Throne");
  const abyssSet = new Set<string>();
  for (let f = 1; f <= 11; f++) abyssSet.add(actBossKindFor(5, f));
  if (abyssSet.size !== 11) throw new Error(`the Abyss rotates ${abyssSet.size} bosses, expected 11`);
  console.log(`act finales: ${finales.join(" → ")} · the Abyss rotates all ${abyssSet.size}`);

  // --- the forest fields its own fauna ---
  {
    const forestKinds = new Set<string>();
    monsters.forEach((m: any) => forestKinds.add(m.kind));
    if (!forestKinds.has("imp") && !forestKinds.has("spineback")) {
      throw new Error(`the forest fields no fallen or quill rats (got: ${[...forestKinds].join(", ")})`);
    }
    console.log(`forest fauna: ${[...forestKinds].join(", ")}`);
  }

  // --- character creation honored ---
  if (me().cls !== "barbarian") throw new Error(`creation class ignored: got ${me().cls}`);
  if (me().name !== "Smokey") throw new Error(`creation name ignored: got "${me().name}"`);
  const base = CLASS_BASE_ATTRS.barbarian;
  if (me().str !== base.str || me().vit !== base.vit) {
    throw new Error(`base attributes wrong: str ${me().str}/${base.str}, vit ${me().vit}/${base.vit}`);
  }
  console.log(`character creation works: Smokey the barbarian (STR ${me().str} DEX ${me().dex} VIT ${me().vit} ENE ${me().ene})`);

  // --- skill tree: level 1 hero has 1 point; slot 1 does nothing until a skill is learned ---
  if (me().skillPoints !== 1) throw new Error(`level-1 hero should have 1 skill point, has ${me().skillPoints}`);
  const manaIdle = me().mana;
  r1.send("skill", { key: "1", x: me().x + 10, y: me().y });
  await sleep(400);
  if (me().mana < manaIdle - 1) throw new Error("unbound slot 1 consumed mana before any skill was learned");

  // ultimates and deep tiers must be rejected at level 1
  r1.send("allocskill", { id: "ancients" });
  await sleep(300);
  if ((lastLoadout?.skills?.ancients ?? 0) > 0) throw new Error("level-1 hero allocated an ultimate");

  // learn Battle Shout — auto-binds to the first free slot (1)
  r1.send("allocskill", { id: "shout" });
  await sleep(400);
  if (me().skillPoints !== 0) throw new Error("allocskill did not spend the point");
  if ((lastLoadout?.skills?.shout ?? 0) !== 1) throw new Error("shout not learned");
  if (lastLoadout?.binds?.["1"] !== "shout") throw new Error(`shout did not auto-bind to slot 1 (binds: ${JSON.stringify(lastLoadout?.binds)})`);
  console.log("skill tree works: ultimate rejected at lvl 1, Battle Shout learned + auto-bound to slot 1");

  // --- skills: casting the learned skill consumes mana ---
  const manaBefore = me().mana;
  r1.send("skill", { key: "1", x: me().x + 10, y: me().y });
  await sleep(500);
  if (me().mana >= manaBefore) throw new Error("bound skill consumed no mana");
  console.log(`skills work: mana ${manaBefore.toFixed(0)} -> ${me().mana.toFixed(0)}`);

  // slot 6 is unbound — must consume nothing
  const manaAfterWW = me().mana;
  r1.send("skill", { key: "6", x: me().x + 10, y: me().y });
  await sleep(500);
  if (me().mana < manaAfterWW - 1) throw new Error("unbound slot 6 consumed mana");
  console.log("binding gating works: unbound key does nothing");

  // rebind shout to slot 2, then back — bindskill round trip
  r1.send("bindskill", { id: "shout", key: "2" });
  await sleep(300);
  if (lastLoadout?.binds?.["2"] !== "shout" || lastLoadout?.binds?.["1"]) {
    throw new Error(`rebind failed (binds: ${JSON.stringify(lastLoadout?.binds)})`);
  }
  r1.send("bindskill", { id: "shout", key: "1" });
  await sleep(300);
  console.log("bindskill works: 1 -> 2 -> 1 round trip");

  // --- a necromancer joins and raises the dead (new class + pet system e2e) ---
  {
    const cN = new Client(ENDPOINT);
    const nKey = `smokenecro${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    const rN = await cN.joinById(r1.roomId, { key: nKey, cls: "necromancer", name: "Boney" });
    rN.onMessage("*", () => {});
    await sleep(600);
    const np = state().players.get(rN.sessionId);
    if (!np || np.cls !== "necromancer") throw new Error("necromancer did not join");
    rN.send("allocskill", { id: "skeleton" });
    await sleep(400);
    rN.send("skill", { key: "1", x: np.x + 20, y: np.y });
    await sleep(600);
    if (state().pets.size < 1) throw new Error("Raise Skeleton raised nothing");
    console.log(`necromancer works: Boney joined and raised ${state().pets.size} skeleton(s) from the floor`);
    await rN.leave();
    await sleep(400);
    if (state().pets.size !== 0) throw new Error("pets survived their master's departure");
    console.log("pets crumble when the master leaves");
  }

  // --- attributes: allocation rejected with 0 points ---
  if (me().statPoints !== 0) throw new Error(`level-1 hero should have 0 stat points, has ${me().statPoints}`);
  const strBefore = me().str;
  r1.send("allocstat", { attr: "str" });
  await sleep(300);
  if (me().str !== strBefore) throw new Error("allocstat worked with 0 points");
  console.log("stat gating works: no points, no gains");

  // --- hardcore: one life, and we keep the promise — end to end ---
  {
    const cHC = new Client(ENDPOINT);
    const hcKey = `smokehc${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    const rHC = await cHC.joinById(r1.roomId, { key: hcKey, cls: "sorcerer", name: "Doomed", hardcore: true });
    rHC.onMessage("*", () => {});
    let hcDeath: any = null;
    rHC.onMessage("hardcoredeath", (m: any) => (hcDeath = m));
    let hcAnnounce = "";
    r1.onMessage("announce", (m: any) => {
      if (String(m.text).includes("fallen forever")) hcAnnounce = m.text;
    });
    await sleep(600);
    const hcMe = () => state().players.get(rHC.sessionId);
    if (!hcMe()?.hardcore) throw new Error("hardcore flag not synced on join");

    // Death by combat is a DPS race a level-1 hero (~80 HP, +3/s regen) can WIN in Act I
    // for minutes — a single monster's occasional hits barely out-pace regen, so relying on
    // organic death here is inherently flaky. So: give real combat a brief crack (proving a
    // hardcore hero does take monster damage), then end it deterministically through the
    // server's own death pipeline (the dev-only `smokekill` hook). Either way the machinery
    // under test — permadeath, epitaph, corpse-stays-down, re-entry lockout, Hall of Legends —
    // is exactly what runs.
    const dl = Date.now() + 15000; // brief best-effort combat window
    while (Date.now() < dl && hcMe().hp > 0) {
      // bury himself POINT-BLANK in the densest MELEE cluster so several monsters strike each
      // tick (kiters ignored: they retreat and never close, so chasing one just wanders).
      const me = hcMe();
      let best: any = null, bestScore = -Infinity, nearestAny: any = null, nearestD = Infinity;
      monsters.forEach((m: any) => {
        if (m.kind === "goblin") return; // goblins flee, never fight
        const d = Math.hypot(m.x - me.x, m.y - me.y);
        if (d < nearestD) { nearestD = d; nearestAny = m; }
        if ((RANGED_MONSTERS as any)[m.kind]) return; // skip kiters when choosing a target
        let cluster = 0;
        monsters.forEach((o: any) => {
          if (o.kind === "goblin" || (RANGED_MONSTERS as any)[o.kind]) return;
          if (Math.hypot(o.x - m.x, o.y - m.y) < 130) cluster++;
        });
        const score = cluster - d / 400;
        if (score > bestScore) { bestScore = score; best = m; }
      });
      const primary = best ?? nearestAny;
      if (primary) {
        const path = bfs(map, [tileOf(me.x), tileOf(me.y)], [tileOf(primary.x), tileOf(primary.y)]);
        if (path && path.length) {
          const step = path[path.length - 1]; // walk all the way onto him, not near him
          rHC.send("move", { x: (step[0] + 0.5) * TILE, y: (step[1] + 0.5) * TILE });
        }
      }
      await sleep(300);
    }
    // combat didn't finish him in the window — keep the promise deterministically
    if (hcMe() && hcMe().hp > 0) {
      rHC.send("smokekill", {});
      const kdl = Date.now() + 8000;
      while (hcMe() && hcMe().hp > 0 && Date.now() < kdl) await sleep(200);
    }
    if (hcMe().hp > 0) throw new Error("hardcore hero refused to die (combat window + deterministic kill both failed)");
    if (!hcDeath || hcDeath.name !== "Doomed") throw new Error("no hardcoredeath epitaph arrived");
    await sleep(5500); // longer than any respawn timer
    if (hcMe().hp > 0) throw new Error("hardcore corpse got back up");
    if (!hcAnnounce.includes("☠")) throw new Error("the fall was not announced to the party");
    await rHC.leave();
    await sleep(400);

    // the fallen do not return
    const cHC2 = new Client(ENDPOINT);
    let rejected = false;
    try {
      await cHC2.joinById(r1.roomId, { key: hcKey });
    } catch (e: any) {
      rejected = String(e?.message ?? "").includes("hero_fallen");
    }
    if (!rejected) throw new Error("a fallen hardcore hero was allowed back into the world");

    // and the Hall of Legends remembers
    const legends: any[] = await (await fetch("http://localhost:2567/legends")).json();
    const doomed = legends.find((l) => l.name === "Doomed" && l.hardcore && l.dead);
    if (!doomed) throw new Error("the Hall of Legends forgot the fallen");
    console.log(`hardcore works: Doomed fell forever in ${hcDeath.where} (slain by ${hcDeath.by}); corpse stayed down, re-entry refused, Hall of Legends updated`);
  }

  // --- zone name + shrine ---
  if (!state().zoneName) throw new Error("floor has no zone name");
  let shrineId = "";
  let shrine: any = null;
  let altarId = "";
  let altar: any = null;
  let chestId = "";
  let chest: any = null;
  state().shrines.forEach((s: any, id: string) => {
    if (s.kind === "gamble") {
      altarId = id;
      altar = s;
    } else if (s.kind === "chest") {
      if (!chestId) {
        chestId = id;
        chest = s;
      }
    } else if (s.kind !== "tome" && !shrineId) {
      shrineId = id;
      shrine = s;
    }
  });

  // --- Fenwick: an NPC in town now, with a spread of unidentified bases ---
  if (!altarId) throw new Error("no Fenwick on this floor");
  if (!isInTown(altar.y)) throw new Error("Fenwick is not standing in town");
  let gambleFails = 0;
  r1.onMessage("gamblefail", () => gambleFails++);
  {
    const goldBefore = me().gold;
    if (!(await walkToRetry(altar.x, altar.y, "Fenwick"))) throw new Error("could not reach Fenwick");
    const dl = Date.now() + 6000;
    while (Date.now() < dl && !lastGamble) {
      const d = Math.hypot(me().x - altar.x, me().y - altar.y);
      if (d < 45) r1.send("touchshrine", { id: altarId });
      else r1.send("move", { x: altar.x, y: altar.y });
      await sleep(300);
    }
    if (!lastGamble?.items?.length) throw new Error("Fenwick did not open his spread");
    if (lastGamble.items.length !== 8) throw new Error(`Fenwick offers ${lastGamble.items.length} slots, expected 8`);
    for (const slot of lastGamble.items) {
      if (!slot.name.startsWith("Unidentified ")) throw new Error(`gamble slot "${slot.name}" is not unidentified`);
      if (!(slot.price > 0)) throw new Error("gamble slot has no price");
    }
    // a broke hero is refused, and pays nothing
    r1.send("gambleitem", { id: lastGamble.items[0].id });
    await sleep(600);
    if (gambleFails === 0) throw new Error("gamble with no gold did not send gamblefail");
    if (me().gold !== goldBefore) throw new Error("gamble with no gold changed gold balance");
    console.log(`Fenwick works: an NPC in town, ${lastGamble.items.length} unidentified slots, refused a broke barbarian`);
  }
  if (shrineId) {
    try {
      await walkTo(shrine.x, shrine.y, "shrine");
      // poll-and-retry: monsters may shove us around near the shrine
      const touchDl = Date.now() + 8000;
      while (Date.now() < touchDl && !state().shrines.get(shrineId)?.used) {
        if (me().hp <= 0) break;
        const d = Math.hypot(me().x - shrine.x, me().y - shrine.y);
        if (d < 45) r1.send("touchshrine", { id: shrineId });
        else r1.send("move", { x: shrine.x, y: shrine.y });
        await sleep(250);
      }
      if (state().shrines.get(shrineId)?.used) {
        console.log(`shrine works: ${shrine.label} consumed in "${state().zoneName}"`);
      } else if (me().hp <= 0) {
        console.log("shrine skipped (killed at the shrine — the dungeon is dangerous)");
      } else {
        throw new Error("shrine not consumed after repeated touches in range");
      }
    } catch (e: any) {
      if (e.message === "died-while-walking") console.log("shrine skipped (died en route — the dungeon is dangerous)");
      else if (e.message.startsWith("no path")) console.log("shrine skipped (tucked behind the stairs no-go zone)");
      else throw e;
    }
  } else {
    console.log(`no shrine rolled this floor (zone: "${state().zoneName}")`);
  }

  // --- ancient chest: open it, whatever happens happens ---
  if (!chestId) {
    console.log("no chest rolled this floor");
  } else {
    const lootBefore = loot.size;
    const mobsBefore = monsters.size;
    let opened = false;
    for (let attempt = 0; attempt < 3 && !opened; attempt++) {
      if (!(await walkToRetry(chest.x, chest.y, "chest"))) break;
      const dl = Date.now() + 6000;
      while (Date.now() < dl && !state().shrines.get(chestId)?.used) {
        if (me().hp <= 0) break;
        const d = Math.hypot(me().x - chest.x, me().y - chest.y);
        if (d < 45) r1.send("touchshrine", { id: chestId });
        else r1.send("move", { x: chest.x, y: chest.y });
        await sleep(250);
      }
      opened = !!state().shrines.get(chestId)?.used;
      if (!opened) await waitAlive();
    }
    if (opened) {
      await sleep(400);
      if (loot.size <= lootBefore && monsters.size <= mobsBefore) {
        throw new Error("opened chest produced neither loot nor ambush");
      }
      console.log(
        `chest works: opened — ${monsters.size > mobsBefore ? "IT WAS A TRAP" : "treasure"} (loot ${lootBefore} -> ${loot.size}, mobs ${mobsBefore} -> ${monsters.size})`
      );
    } else {
      console.log("chest skipped (could not survive the trip)");
    }
  }

  // --- grind camps until an item AND a potion have dropped ---
  const hasKind = (kind: string) => {
    let found = false;
    loot.forEach((g: any) => {
      if (g.kind === kind) found = true;
    });
    return found;
  };

  let kills = 0;
  let lastLog = Date.now();
  const grindStart = Date.now();
  const grindDeadline = Date.now() + 600000; // the Great Drought is by design — leave real room for dry spells
  // potions auto-pickup on walk-over now, so a held potion counts as "obtained"
  const havePotion = () => hasKind("potion") || me().potions > 0;
  while ((!hasKind("item") || !havePotion()) && Date.now() < grindDeadline) {
    await waitAlive();
    if (Date.now() - lastLog > 15000) {
      lastLog = Date.now();
      console.log(`  …grinding: ${kills} kills, hp ${me().hp.toFixed(0)}, loot on ground: ${loot.size}`);
    }
    // nearest killable monster — skip elites early on, unless we're desperate
    const desperate = Date.now() - grindStart > 30000; // hunt the guaranteed drop sooner if it's dragging
    const needItem = !hasKind("item");
    let targetId = "";
    let target: any = null;
    let bestD = Infinity;
    // elites ALWAYS drop from the boosted table and champions nearly always — when
    // we still owe the test a gear item, hunt one of those instead of trusting the
    // 15%-per-kill trash roll (that's the whole grind flake).
    let eliteId = "";
    let eliteM: any = null;
    let eliteD = Infinity;
    monsters.forEach((m: any, id: string) => {
      if (m.kind === "flenser" || m.kind === "goblin") return; // boss is scary, goblin runs away
      const d = Math.hypot(m.x - me().x, m.y - me().y);
      if ((m.elite || m.modifier) && (me().level >= 2 || desperate) && d < eliteD) {
        eliteD = d;
        eliteId = id;
        eliteM = m;
      }
      if (m.elite && me().level < 3 && !desperate) return; // named elites eat level-1 barbarians
      if (d < bestD) {
        bestD = d;
        targetId = id;
        target = m;
      }
    });
    if (needItem && eliteM) {
      target = eliteM;
      targetId = eliteId;
      bestD = eliteD;
    }
    if (!target) {
      await sleep(1000); // wait for camp respawn
      continue;
    }
    if (bestD > 60) {
      try {
        await walkTo(target.x, target.y, `monster ${targetId}`);
      } catch {
        await sleep(300);
        continue;
      }
    }
    // swing until it dies or we do — and CHASE: quill rats kite like archers
    const fightDl = Date.now() + 15000;
    while (monsters.get(targetId) && me().hp > 0 && Date.now() < fightDl) {
      const m = monsters.get(targetId);
      const nd = Math.hypot(m.x - me().x, m.y - me().y);
      if (nd > 55) r1.send("move", { x: m.x, y: m.y });
      else r1.send("attack", { x: m.x, y: m.y });
      if (me().hp < 35 && me().potions > 0) r1.send("drink", {});
      await sleep(250);
    }
    if (!monsters.get(targetId)) kills++;
  }
  // NOTE: we no longer hard-assert an item is on the ground HERE — the Great Drought
  // makes 15%-per-kill genuinely dry sometimes. The auto-equip section below owns the
  // item requirement, with a bounded elite-first re-grind (guaranteed drop) + a clear
  // guard, so "the drop system yields gear" is still proven, just more robustly.
  if (!havePotion()) console.log("(dry run: no potion seen in the grind — downstream potion asserts will take their fallbacks)");
  // kills also happen via fightBack() during walks/chests — xp is the real evidence of combat
  if (me().xp <= 0 && me().level === 1) throw new Error("no combat xp earned");
  console.log(`combat/xp/drops work: level ${me().level}, xp ${me().xp.toFixed(0)}, grind kills ${kills}, hit by monsters: ${playerWasHit}`);

  // --- quests advance on forest kills ---
  {
    const cf = lastQuests?.list?.find((q: any) => q.id === "clear_forest");
    if (!cf) throw new Error("The Overgrowth missing from the quest log");
    if (cf.progress <= 0 && !cf.done) throw new Error("forest kills did not advance The Overgrowth");
    console.log(`quests tick: The Overgrowth at ${cf.done ? "done" : `${cf.progress}/${cf.goal}`}`);
  }

  // --- attributes & skill points from leveling ---
  if (me().level > 1) {
    const expectStat = 5 * (me().level - 1);
    if (me().statPoints !== expectStat) {
      throw new Error(`level ${me().level} should have ${expectStat} stat points, has ${me().statPoints}`);
    }
    const hpBefore = me().maxHp;
    const vitBefore = me().vit;
    r1.send("allocstat", { attr: "vit" });
    await sleep(400);
    if (me().vit !== vitBefore + 1) throw new Error("allocstat vit did not increment");
    if (me().maxHp <= hpBefore) throw new Error("vitality point did not raise max life");
    console.log(`attributes work: VIT ${vitBefore} -> ${me().vit}, life ${hpBefore} -> ${me().maxHp}, ${me().statPoints} points left`);

    if (me().skillPoints > 0) {
      r1.send("allocskill", { id: "shout" });
      await sleep(400);
      if ((lastLoadout?.skills?.shout ?? 0) !== 2) throw new Error("shout rank 2 not learned");
      console.log("skill ranks work: Battle Shout at rank 2");
    }
  } else {
    console.log("attributes untested live (still level 1) — pure checks below cover the math");
  }

  // death-tolerant walk: respawn and try again
  async function walkToRetry(wx: number, wy: number, label: string, tries = 4, avoidStairs = true): Promise<boolean> {
    for (let i = 0; i < tries; i++) {
      try {
        await walkTo(wx, wy, label, avoidStairs);
        return true;
      } catch (e: any) {
        if (e.message === "died-while-walking" || e.message.startsWith("no path")) {
          await waitAlive();
          await sleep(300);
          continue;
        }
        throw e;
      }
    }
    return false;
  }

  // walk near, fight off harassers, grab the thing
  async function pickupLoop(id: string, gx: number, gy: number, label: string): Promise<boolean> {
    const dl = Date.now() + 20000;
    while (Date.now() < dl && loot.get(id)) {
      if (me().hp <= 0) {
        await waitAlive();
        continue;
      }
      const d = Math.hypot(me().x - gx, me().y - gy);
      if (d < 40) r1.send("pickup", { id });
      else if (d > 160) await walkToRetry(gx, gy, label, 2);
      else r1.send("move", { x: gx, y: gy });
      fightBack();
      await sleep(250);
    }
    return !loot.get(id);
  }

  // --- pickup with AUTO-EQUIP (gear is empty, so first item must equip itself) ---
  // take the NEWEST drops (map iterates in insertion order) — old ones may despawn mid-test.
  // The item the grind produced can despawn or get looted during the checks above, so we
  // (re)secure a FRESH gear item here rather than trusting one is still on the ground.
  let itemId = "";
  let itemG: any = null;
  let potionId = "";
  let potionG: any = null;
  const scanGround = () => {
    itemId = ""; itemG = null; potionId = ""; potionG = null;
    loot.forEach((g: any, id: string) => {
      if (g.kind === "item") { itemId = id; itemG = g; }
      if (g.kind === "potion") { potionId = id; potionG = g; }
    });
  };
  scanGround();
  {
    const redl = Date.now() + 120000;
    while (!itemG && Date.now() < redl) {
      await waitAlive();
      // kill the nearest monster, preferring an elite/champion whose drop is guaranteed
      let tId = "", t: any = null, bD = Infinity, eId = "", e: any = null, eD = Infinity;
      monsters.forEach((m: any, id: string) => {
        if (m.kind === "flenser" || m.kind === "goblin") return;
        const d = Math.hypot(m.x - me().x, m.y - me().y);
        if ((m.elite || m.modifier) && d < eD) { eD = d; eId = id; e = m; }
        if (d < bD) { bD = d; tId = id; t = m; }
      });
      if (e) { t = e; tId = eId; bD = eD; }
      if (!t) { await sleep(1000); scanGround(); continue; }
      if (bD > 60) { try { await walkTo(t.x, t.y, "re-drop hunt"); } catch { await sleep(300); scanGround(); continue; } }
      const fd = Date.now() + 12000;
      while (monsters.get(tId) && me().hp > 0 && Date.now() < fd) {
        const m = monsters.get(tId); const nd = Math.hypot(m.x - me().x, m.y - me().y);
        if (nd > 55) r1.send("move", { x: m.x, y: m.y }); else r1.send("attack", { x: m.x, y: m.y });
        if (me().hp < 35 && me().potions > 0) r1.send("drink", {});
        await sleep(250);
      }
      scanGround();
    }
  }
  if (!itemG) throw new Error("no gear item on the ground for the auto-equip test (re-grind timed out)");
  console.log(`dropped: [${itemG.rarity}] ${itemG.name}${potionId ? ` + ${potionG.name} on the ground` : " (potion already auto-collected)"}`);

  if (!(await walkToRetry(itemG.x, itemG.y, "item"))) throw new Error("could not reach the dropped item");
  if (!(await pickupLoop(itemId, itemG.x, itemG.y, "item"))) throw new Error("item pickup never succeeded");
  await sleep(300);
  if (!lastLoadout) throw new Error("no loadout received after pickup (item may have despawned)");
  const item = JSON.parse(itemG.data);
  if (item.unidentified) {
    // rare+ drops land shrouded: never auto-equipped, name hidden on the ground
    if (!String(itemG.name).startsWith("Unidentified")) {
      throw new Error(`unidentified ground item leaked its name: "${itemG.name}"`);
    }
    const bagged = lastLoadout.inventory?.find((it: any) => it.id === item.id);
    if (!bagged) throw new Error("unidentified item was not sent to the inventory");
    if (!bagged.unidentified) throw new Error("unidentified flag lost on pickup");
    let identifiedMsg: any = null;
    r1.onMessage("identified", (msg: any) => (identifiedMsg = msg));
    const idCost = identifyCost(item.ilvl);
    if (me().gold >= idCost) {
      r1.send("identify", { id: item.id });
      await sleep(500);
      if (!identifiedMsg) throw new Error("identify sent no reveal");
      const revealed = lastLoadout.inventory?.find((it: any) => it.id === item.id);
      if (revealed?.unidentified) throw new Error("identify did not clear the flag");
      console.log(`identify works: [${itemG.rarity}] "${itemG.name}" revealed as ${identifiedMsg.name} for ${identifiedMsg.cost}g`);
    } else {
      console.log(`unidentified drop works: [${itemG.rarity}] ${itemG.name} bagged (too broke to identify: ${me().gold}g < ${idCost}g)`);
    }
  } else if (item.slot === "charm") {
    // charms never equip — they work from the inventory
    if (!lastLoadout.inventory?.some((it: any) => it.id === item.id)) {
      throw new Error("picked-up charm is not in the inventory");
    }
    if (Object.keys(lastLoadout.derived ?? {}).length === 0) {
      throw new Error("charm in inventory contributed no derived stats");
    }
    console.log(`charm pickup works: ${item.name} in bag, gear stats ${JSON.stringify(lastLoadout.derived)}`);
  } else if (item.slot === "rune") {
    // runes never equip either — they wait in the bag for a socket
    if (!lastLoadout.inventory?.some((it: any) => it.id === item.id)) {
      throw new Error("picked-up rune is not in the inventory");
    }
    console.log(`rune pickup works: ${item.name} waiting in the bag for a socket`);
  } else {
    const expectedSlot = item.slot === "ring" ? "ring1" : item.slot;
    const equipped = lastLoadout.equipment?.[expectedSlot];
    if (!equipped || equipped.id !== item.id) {
      throw new Error(`item was not auto-equipped into ${expectedSlot} (inventory: ${lastLoadout.inventory?.length})`);
    }
    console.log(`auto-equip works: ${item.name} -> ${expectedSlot}, gear stats ${JSON.stringify(lastLoadout.derived)}`);
    if (["weapon", "offhand", "helm", "chest", "boots", "belt"].includes(item.slot)) {
      const synced = me()[`${item.slot}Base`];
      if (synced !== item.base) throw new Error(`gear visual sync broken: ${item.slot}Base="${synced}" expected "${item.base}"`);
      console.log(`gear visuals sync: ${item.slot}Base = ${synced}`);
    }
    // the decked-out aura: best equipped rarity is synced for all to see
    const expectTier = ["common", "magic", "rare", "set", "unique", "legendary", "epic"].indexOf(item.rarity);
    if (me().gearTier !== expectTier) {
      throw new Error(`gearTier not synced: ${me().gearTier} != ${expectTier} (${item.rarity})`);
    }
    console.log(`gear presence works: gearTier ${me().gearTier} (${item.rarity})`);
  }

  // --- potion pickup (walk-over auto-collect) + drink ---
  if (potionId) {
    const before = me().potions;
    if (!(await walkToRetry(potionG.x, potionG.y, "potion"))) throw new Error("could not reach the potion");
    await pickupLoop(potionId, potionG.x, potionG.y, "potion");
    if (me().potions <= before && loot.get(potionId)) throw new Error("potion pickup failed");
  } else {
    console.log("potion was auto-collected during the grind (walk-over pickup works)");
  }
  if (me().potions > 0) {
    // a monster hit landing inside the read window can eat the heal — allow retries
    let hpBefore = me().hp;
    let healed = false;
    for (let sip = 0; sip < 3 && me().potions > 0 && !healed; sip++) {
      hpBefore = me().hp;
      r1.send("drink", {});
      await sleep(400);
      healed = hpBefore >= me().maxHp || me().hp > hpBefore;
    }
    if (!healed) throw new Error("drink did not heal");
    console.log(`potions work: hp ${hpBefore.toFixed(0)} -> ${me().hp.toFixed(0)}`);
  } else {
    console.log("potions work: consumed mid-grind as a panic button");
  }

  // --- gold: find a pile from the grind and pick it up ---
  let goldId = "";
  let goldG: any = null;
  loot.forEach((g: any, id: string) => {
    if (g.kind === "gold") {
      goldId = id;
      goldG = g;
    }
  });
  if (goldId) {
    const goldBefore = me().gold;
    if (await walkToRetry(goldG.x, goldG.y, "gold pile")) {
      await pickupLoop(goldId, goldG.x, goldG.y, "gold pile");
      if (me().gold > goldBefore) {
        console.log(`gold works: walked over ${goldG.amount}g (total ${me().gold})`);
      } else if (me().gold > 0) {
        console.log(`gold works: target pile despawned, but ${me().gold}g auto-collected earlier`);
      } else {
        throw new Error("no gold obtained by any route");
      }
    } else {
      console.log("gold pile unreachable this run (skipped)");
    }
  } else if (me().gold > 0) {
    console.log(`gold works: auto-collected ${me().gold}g during the grind`);
  } else {
    console.log("no gold obtained this run (unlucky)");
  }

  // --- the watchtower: enter, climb both stories, come back down ---
  {
    let doorId = "";
    let doorS: any = null;
    state().shrines.forEach((s: any, id: string) => {
      if (s.kind === "areaportal" && s.variant === "towerdoor") {
        doorId = id;
        doorS = s;
      }
    });
    if (!doorId) throw new Error("no tower door in the forest");
    if (!(await walkToRetry(doorS.x, doorS.y, "tower door", 6))) throw new Error("could not reach the tower door");

    // interiors are small open rooms — direct moves suffice once inside
    const touchPortal = async (variant: string) => {
      let id = "";
      let s: any = null;
      state().shrines.forEach((sh: any, sid: string) => {
        if (sh.kind === "areaportal" && sh.variant === variant) {
          id = sid;
          s = sh;
        }
      });
      if (!id) throw new Error(`no ${variant} portal`);
      const dl = Date.now() + 10000;
      while (Date.now() < dl && Math.hypot(me().x - s.x, me().y - s.y) > 40) {
        await waitAlive();
        r1.send("move", { x: s.x, y: s.y });
        fightBack();
        await sleep(250);
      }
      r1.send("touchshrine", { id });
      await sleep(500);
    };

    r1.send("touchshrine", { id: doorId });
    await sleep(500);
    if (me().y < 50 * TILE) throw new Error("tower door did not teleport inside");
    await touchPortal("stairsup");
    if (me().x < 15 * TILE || me().y < 50 * TILE) throw new Error("stairs up did not reach the second story");
    console.log("watchtower works: entered off the forest floor, climbed to the second story");
    await touchPortal("stairsdown");
    if (me().x > 15 * TILE) throw new Error("stairs down did not return to the first story");
    await touchPortal("towerexit");
    if (me().y > 50 * TILE) throw new Error("tower exit did not return to the forest");
    console.log("…took the stairs back down and stepped out into the wood");

    // caves exist and their mouths stand in the field
    let mouths = 0;
    state().shrines.forEach((s: any) => {
      if (s.kind === "areaportal" && s.variant === "cavemouth") mouths++;
    });
    if (mouths < 2) throw new Error(`expected 2+ cave mouths, found ${mouths}`);
    console.log(`the forest hides ${mouths} caves`);
  }

  // --- descend to floor 2: standing on stairs must NOT descend; using them must ---
  if (!(await walkToRetry(state().stairsX, state().stairsY, "stairs", 6, false))) {
    throw new Error("could not reach the stairs");
  }
  // loiter on the stairs — the Flenser-fight-teleport bug must stay dead
  await sleep(1500);
  if (state().floor !== 1) throw new Error("standing on the stairs descended without a click");
  console.log("stairs are polite: standing on them does nothing");
  const descendDl = Date.now() + 12000;
  while (state().floor === 1 && Date.now() < descendDl) {
    await waitAlive();
    if (Math.hypot(me().x - state().stairsX, me().y - state().stairsY) > 45) {
      r1.send("move", { x: state().stairsX, y: state().stairsY });
    } else {
      r1.send("usestairs", {});
    }
    await sleep(300);
  }
  if (state().floor !== 2) throw new Error("party did not descend to floor 2");
  map = parseMap(r1);
  await sleep(600);
  {
    const ec = lastQuests?.list?.find((q: any) => q.id === "enter_cathedral");
    if (!ec?.done) throw new Error("descending did not complete The Cathedral quest");
    console.log("quest completes on descend: The Cathedral ✓");
  }
  if (state().weather !== "") throw new Error(`underground has no sky, yet weather="${state().weather}"`);
  let bossFound = "";
  monsters.forEach((m: any) => {
    if (isBossKind(m.kind) && m.maxHp > MONSTERS[m.kind as keyof typeof MONSTERS].maxHp * 1.2) bossFound = m.name;
  });
  if (!bossFound) throw new Error("floor 2 has no scaled-up boss");
  if (state().act !== 1) throw new Error(`stairs changed the act: ${state().act}`);
  console.log(`descend works: act ${state().act} floor ${state().floor}, ${monsters.size} monsters, ${bossFound} guards it (scaled)`);

  // --- the trade ring: the descent gathered both heroes at the entrance — shake hands ---
  {
    const waitFor = async (cond: () => boolean, what: string, ms = 4000) => {
      const dl = Date.now() + ms;
      while (Date.now() < dl && !cond()) await sleep(100);
      if (!cond()) throw new Error(`trade: timed out waiting for ${what}`);
    };
    const p2 = () => (r2.state as any).players.get(r2.sessionId);
    const goldBefore1 = me().gold;
    const goldBefore2 = p2().gold;
    const wares: any[] = lastLoadout?.inventory ?? [];
    const gift = wares.length ? wares[0] : null;

    // a confirm with no session on the table must do nothing
    r1.send("tradeconfirm", {});
    await sleep(200);
    if (r1TradeDone || r1Trade) throw new Error("a sessionless confirm conjured a trade");

    r1.send("tradeinvite", { target: r2.sessionId });
    await waitFor(() => !!r2TradeInvite, "the invitation");
    if (r2TradeInvite.name !== "Smokey") throw new Error(`invite came from "${r2TradeInvite.name}"`);
    r2.send("tradeaccept", {});
    await waitFor(() => r1TradeOpen && r2TradeOpen, "both trade windows");

    r1.send("tradeset", { itemIds: gift ? [gift.id] : [], gold: 25 });
    await waitFor(() => r2Trade?.theirs?.gold === 25, "the offer to reach the other side");
    if (gift && r2Trade.theirs.items?.[0]?.id !== gift.id) throw new Error("offered item did not appear across the table");

    // the anti-scam law: r1 signs, r2 changes the offer, r1's signature must burn
    r1.send("tradeconfirm", {});
    await waitFor(() => r1Trade?.myConfirmed === true, "the first signature");
    r2.send("tradeset", { itemIds: [], gold: 0 });
    await waitFor(() => r1Trade?.myConfirmed === false, "the signature to reset after a changed offer");

    r1.send("tradeconfirm", {});
    r2.send("tradeconfirm", {});
    await waitFor(() => !!r1TradeDone && !!r2TradeDone, "the handshake");
    await sleep(300);
    if (me().gold !== goldBefore1 - 25) throw new Error(`giver's gold ${me().gold} != ${goldBefore1 - 25}`);
    if (p2().gold !== goldBefore2 + 25) throw new Error(`taker's gold ${p2().gold} != ${goldBefore2 + 25}`);
    if (gift) {
      if (!(r2Loadout?.inventory ?? []).some((it: any) => it.id === gift.id)) throw new Error("the gift never reached the taker's bag");
      if ((lastLoadout?.inventory ?? []).some((it: any) => it.id === gift.id)) throw new Error("the gift is still in the giver's bag");
    }
    console.log(
      `trade works: Smokey handed over ${gift ? `"${gift.name}" + ` : ""}25g — offer crossed the table, a changed offer burned the signature, both hands shook`
    );
  }

  // --- a dungeon encounter, in the field (best-effort; runs AFTER trade so walking
  //     r1 to the shrine can't scatter the gathered party) ---
  {
    let encId = "";
    let encVariant = "";
    state().shrines.forEach((sh: any, id: string) => {
      if (sh.kind === "encounter" && !encId) { encId = id; encVariant = sh.variant; }
    });
    if (!encId) {
      console.log("encounter (field): none rolled on floor 2 — pure battery covers the mechanic");
    } else {
      const enc = encounterById(encVariant)!;
      const es = state().shrines.get(encId);
      // snapshot the monsters BEFORE the touch — the ambush's `camp = -3` marker is
      // server-only, so we verify the mechanic by the burst of NEW monsters at the spot.
      const before = new Set<string>();
      state().monsters.forEach((_m: any, id: string) => before.add(id));
      lastEncounter = null;
      const reached = await walkToRetry(es.x, es.y, `encounter "${enc.label}"`, 3);
      const edl = Date.now() + 5000;
      while (reached && Date.now() < edl && !lastEncounter && me().hp > 0) {
        if (Math.hypot(me().x - es.x, me().y - es.y) < 46) r1.send("touchshrine", { id: encId });
        await sleep(300);
      }
      if (lastEncounter) {
        if (lastEncounter.id !== encVariant) throw new Error(`encounter echo ${lastEncounter.id} != ${encVariant}`);
        if (lastEncounter.kind !== enc.kind) throw new Error(`encounter kind echo ${lastEncounter.kind} != ${enc.kind}`);
        if (!state().shrines.get(encId)?.used) throw new Error("encounter was not consumed on touch");
        if (enc.kind === "ambush") {
          await sleep(400); // let the spawn replicate to us
          let fresh = 0;
          state().monsters.forEach((m: any, id: string) => {
            if (!before.has(id) && Math.hypot(m.x - es.x, m.y - es.y) < 150) fresh++;
          });
          if (fresh < 1) throw new Error("the ambush spawned no new monsters at the encounter");
        }
        console.log(`encounter (field): touched a ${enc.kind} — "${enc.label}" — mechanic fired`);
      } else {
        console.log(`encounter (field): "${enc.label}" present but unreachable/interrupted this run — skipped`);
      }
    }
  }

  // --- randomized guest: forged at the party's level, geared for this depth ---
  {
    const cR = new Client(ENDPOINT);
    const rKey = `smokerand${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    const rr = await cR.joinById(r1.roomId, { key: rKey, cls: "sorcerer", randomize: true });
    rr.onMessage("*", () => {});
    await sleep(700);
    const rp = state().players.get(rr.sessionId);
    if (!rp) throw new Error("random hero did not appear");
    if (rp.cls !== "sorcerer") throw new Error(`random hero class ignored: ${rp.cls}`);
    let partyMax = 1;
    state().players.forEach((pp: any, psid: string) => {
      if (psid !== rr.sessionId) partyMax = Math.max(partyMax, pp.level);
    });
    if (rp.level !== partyMax) throw new Error(`random hero level ${rp.level} != party max ${partyMax}`);
    if (!rp.name) throw new Error("random hero has no name");
    if (rp.deepestFloor !== 2) throw new Error(`random hero deepestFloor ${rp.deepestFloor} != 2`);
    if (rp.gold !== 50 * rp.level) throw new Error(`random hero gold ${rp.gold} != ${50 * rp.level}`);
    if (rp.potions !== 4 || rp.manaPotions !== 2) throw new Error("random hero flasks wrong");
    if (rp.skillPoints !== 0) throw new Error(`random hero left ${rp.skillPoints} skill points unspent`);
    const visualGear = [rp.weaponBase, rp.offhandBase, rp.helmBase].filter(Boolean).length;
    if (visualGear < 2) throw new Error(`random hero under-geared: only ${visualGear}/3 visible slots`);
    console.log(`random hero works: ${rp.name} the ${rp.cls}, lvl ${rp.level}, ${visualGear}/3 visible gear slots, ${rp.gold}g, all skill points spent`);
    await rr.leave();
    await sleep(300);
  }

  // --- town: portal in, stash round-trip, sell to vendor, portal back ---
  async function moveNear(x: number, y: number, r: number) {
    const dl = Date.now() + 8000;
    while (Date.now() < dl && Math.hypot(me().x - x, me().y - y) > r) {
      r1.send("move", { x, y });
      await sleep(250);
    }
  }

  // clear the immediate area first — a hit interrupts the 2s channel
  async function disengage() {
    const dl = Date.now() + 25000;
    while (Date.now() < dl) {
      await waitAlive();
      let nearest: any = null;
      let nd = Infinity;
      monsters.forEach((m: any) => {
        const d = Math.hypot(m.x - me().x, m.y - me().y);
        if (d < nd) {
          nd = d;
          nearest = m;
        }
      });
      if (!nearest || nd > 300) return;
      // archers kite — close the distance instead of swinging at air
      if (nd > 55) r1.send("move", { x: nearest.x, y: nearest.y });
      else r1.send("attack", { x: nearest.x, y: nearest.y });
      if (me().hp < 35 && me().potions > 0) r1.send("drink", {});
      await sleep(250);
    }
  }

  let ported = false;
  for (let i = 0; i < 6 && !ported; i++) {
    await waitAlive();
    await disengage();
    r1.send("townportal", {});
    await sleep(PORTAL_CAST_MS + 900);
    ported = isInTown(me().y);
    if (!ported) {
      fightBack();
      await sleep(800);
    }
  }
  if (!ported) throw new Error("town portal never completed (channel kept getting interrupted?)");
  console.log("town portal works: standing in Hollowmere");

  // make sure something is in the inventory to stash/sell
  if ((lastLoadout?.inventory?.length ?? 0) === 0) {
    const wornSlots = Object.keys(lastLoadout?.equipment ?? {});
    if (wornSlots.length) {
      r1.send("unequip", { slot: wornSlots[0] });
      await sleep(500);
    }
  }
  const invItem = lastLoadout?.inventory?.[0];
  if (invItem) {
    await moveNear(TOWN.stash.x, TOWN.stash.y, 50);
    r1.send("stashput", { id: invItem.id });
    await sleep(500);
    if (!lastLoadout.stash?.some((it: any) => it.id === invItem.id)) throw new Error("stashput failed");
    r1.send("stashtake", { id: invItem.id });
    await sleep(500);
    if (!lastLoadout.inventory?.some((it: any) => it.id === invItem.id)) throw new Error("stashtake failed");
    console.log(`stash works: ${invItem.name} round-tripped`);

    const goldBefore2 = me().gold;
    await moveNear(TOWN.vendor.x, TOWN.vendor.y, 50);
    r1.send("sellitem", { id: invItem.id });
    await sleep(500);
    if (me().gold <= goldBefore2) throw new Error("selling to the vendor did not pay");
    console.log(`vendor works: sold ${invItem.name} (gold ${goldBefore2} -> ${me().gold})`);
  } else {
    console.log("town stash/vendor untested (no inventory item available)");
  }

  // --- waypoint & transmute altar: town furniture of the new era ---
  {
    let wpId = "";
    let horId = "";
    state().shrines.forEach((s: any, id: string) => {
      if (s.kind === "waypoint") wpId = id;
      if (s.kind === "transmute") horId = id;
    });
    if (!wpId) throw new Error("no waypoint in town");
    if (!horId) throw new Error("no Ternion Altar in town");
    if (me().deepestFloor !== 2) throw new Error(`deepestFloor should be 2, is ${me().deepestFloor}`);

    // the network answers: touching the stone opens the list; jumps are gated by discovery and act locks
    let wpMsg: any = null;
    r1.onMessage("waypoints", (m: any) => (wpMsg = m));
    await moveNear(TOWN.waypoint.x, TOWN.waypoint.y, 45);
    const floorNow = state().floor;
    r1.send("touchshrine", { id: wpId });
    await sleep(600);
    if (!wpMsg) throw new Error("touching the waypoint sent no network list");
    if (!wpMsg.list?.includes("1:1")) throw new Error(`town stone undiscovered: ${JSON.stringify(wpMsg.list)}`);
    if (wpMsg.actsUnlocked !== 1) throw new Error(`fresh hero has actsUnlocked ${wpMsg.actsUnlocked}`);
    r1.send("waypointjump", { act: 1, floor: 3 }); // undiscovered — must refuse
    r1.send("waypointjump", { act: 2, floor: 1 }); // locked act — must refuse
    await sleep(600);
    if (state().floor !== floorNow || state().act !== 1) throw new Error("waypoint jumped without discovery/unlock");
    console.log("waypoint network works: stone discovered, list delivered, undiscovered + locked jumps refused");

    // the altar opens a panel: reforge-eligible items + recipe buttons. Reforge re-rolls an item's
    // affixes for gold (same base/rarity/ilvl). Give the hero a rare + funds so the path is exercised.
    let altarPanel: any = null;
    let reforged: any = null;
    let gave: any = null;
    r1.onMessage("openaltar", (m: any) => (altarPanel = m));
    r1.onMessage("reforged", (msg: any) => (reforged = msg));
    r1.onMessage("smokegave", (msg: any) => (gave = msg));
    await moveNear(TOWN.transmute.x, TOWN.transmute.y, 45);
    r1.send("smokegive", { rarity: "rare" });
    await sleep(300);
    if (!gave) throw new Error("smokegive did not hand over a rare");
    r1.send("touchshrine", { id: horId });
    await sleep(500);
    if (!altarPanel) throw new Error("Ternion Altar did not open its panel");
    if (!Array.isArray(altarPanel.reforge) || !altarPanel.recipes) throw new Error("altar panel missing reforge list / recipes");
    const cand = (altarPanel.reforge as any[]).find((r) => r.id === gave.id);
    if (!cand) throw new Error("the granted rare was not offered as reforgeable");
    const beforeStats = JSON.stringify(lastLoadout?.inventory?.find((it: any) => it.id === cand.id)?.stats ?? {});
    r1.send("reforge", { id: cand.id });
    await sleep(500);
    if (!reforged) throw new Error("reforge produced no result");
    // the server's charge is authoritative (a raw gold-delta races the +gold from smokegive's sync)
    if (reforged.cost !== cand.price) throw new Error(`reforge cost ${reforged.cost} != panel price ${cand.price}`);
    const after = lastLoadout?.inventory?.find((it: any) => it.id === cand.id);
    if (!after) throw new Error("reforged item vanished (id not preserved)");
    if (after.base !== cand.base || after.rarity !== cand.rarity) throw new Error("reforge changed base/rarity");
    console.log(
      `Ternion Altar works: reforged ${cand.name} for ${reforged.cost}g — same base/rarity/id, affixes ${beforeStats === JSON.stringify(after.stats) ? "held" : "re-rolled"} (panel: ${altarPanel.reforge.length} reforgeable, recipes ${JSON.stringify(altarPanel.recipes)})`
    );

    // --- Maren: three rogues for hire, level-priced, gear-capable ---
    let marenId = "";
    state().shrines.forEach((sh: any, id: string) => {
      if (sh.kind === "mercnpc" && sh.variant === "rogue") marenId = id;
    });
    if (!marenId) throw new Error("no Maren in town");
    lastMercs = null;
    await moveNear(TOWN.maren.x, TOWN.maren.y, 45);
    {
      const kDl = Date.now() + 8000;
      while (Date.now() < kDl && !lastMercs) {
        const d = Math.hypot(me().x - TOWN.maren.x, me().y - TOWN.maren.y);
        if (d < 45) r1.send("touchshrine", { id: marenId });
        else r1.send("move", { x: TOWN.maren.x, y: TOWN.maren.y });
        await sleep(300);
      }
    }
    if (!lastMercs?.offers?.length) throw new Error("Maren offered no rogues");
    if (lastMercs.offers.length !== 3) throw new Error(`Maren offers ${lastMercs.offers.length} rogues, expected 3`);
    const archIds = new Set(lastMercs.offers.map((o: any) => o.archetype));
    if (archIds.size !== 3) throw new Error("Maren's rogues are not distinctly skilled");
    for (const o of lastMercs.offers) {
      if (o.cost !== 100 + 60 * (me().level - 1)) throw new Error(`merc cost ${o.cost} not matched to level ${me().level}`);
      if (!o.name) throw new Error("a nameless rogue");
    }
    const offer = lastMercs.offers[0];
    const mGold = me().gold;
    if (mGold >= offer.cost) {
      r1.send("hiremerc", { archetype: offer.archetype, name: offer.name });
      await sleep(900);
      if (me().gold !== mGold - offer.cost) throw new Error("hire charged the wrong gold");
      const mc = state().mercs.get(r1.sessionId);
      if (!mc) throw new Error("hired rogue did not appear in the world");
      if (mc.name !== offer.name) throw new Error(`rogue name mismatch: ${mc.name} != ${offer.name}`);
      if (!(mc.maxHp > 0 && mc.hp > 0)) throw new Error("rogue has no life in her");
      // outfit her, if the bag holds anything she can wear
      const wearable = (lastLoadout?.inventory ?? []).find(
        (it: any) => ["weapon", "helm", "chest"].includes(it.slot) && !it.unidentified
      );
      if (wearable) {
        const bagBefore2 = (lastLoadout?.inventory ?? []).length;
        r1.send("mercequip", { id: wearable.id });
        await sleep(700);
        const gear = lastMercLoadout?.merc?.gear ?? {};
        if (!gear[wearable.slot] || gear[wearable.slot].id !== wearable.id) {
          throw new Error("handed-over item did not reach the rogue's gear");
        }
        if ((lastLoadout?.inventory ?? []).length !== bagBefore2 - 1) throw new Error("bag did not shrink on merc equip");
        console.log(`Maren works: hired ${offer.name} the ${offer.archetype} rogue for ${offer.cost}g; she wears the ${wearable.name}`);
      } else {
        console.log(`Maren works: hired ${offer.name} the ${offer.archetype} rogue for ${offer.cost}g (nothing in the bag she can wear)`);
      }
    } else {
      r1.send("hiremerc", { archetype: offer.archetype, name: offer.name });
      await sleep(500);
      if (state().mercs.get(r1.sessionId)) throw new Error("Maren hired out a rogue on credit");
      console.log(`Maren works: 3 distinct rogues at ${offer.cost}g, refused the under-funded (${mGold}g)`);
    }

    // --- one recruiter per act: the contract, and act-scoped presence (pure + e2e) ---
    {
      // pure: four schools, one per act, each mustering three distinct recruits
      if (MERC_CLASSES.length !== 4) throw new Error(`expected 4 merc classes, got ${MERC_CLASSES.length}`);
      const acts = MERC_CLASSES.map((c) => c.unlockAct).sort();
      if (JSON.stringify(acts) !== JSON.stringify([1, 2, 3, 4])) throw new Error(`merc unlock acts wrong: ${acts}`);
      const styles = new Map(MERC_CLASSES.map((c) => [c.id, c.attackStyle]));
      if (styles.get("rogue") !== "arrow" || styles.get("mage") !== "spell")
        throw new Error("rogue must loose arrows, mage must sling spells");
      if (styles.get("barbarian") !== "melee" || styles.get("paladin") !== "melee")
        throw new Error("barbarian and paladin must fight in melee");
      for (const c of MERC_CLASSES) {
        if (c.archetypes.length !== 3) throw new Error(`${c.id} musters ${c.archetypes.length} recruits, expected 3`);
        // ids must be distinct — hiremerc resolves the archetype by id
        if (new Set(c.archetypes.map((a) => a.id)).size !== 3) throw new Error(`${c.id} has duplicate archetype ids`);
      }
      // recruiterForAct pins one school to each act (Abyss borrows the last)
      const pin: Record<number, string> = { 1: "rogue", 2: "mage", 3: "barbarian", 4: "paladin", 5: "paladin" };
      for (const a of [1, 2, 3, 4, 5]) {
        if (recruiterForAct(a).id !== pin[a]) throw new Error(`act ${a} recruiter is ${recruiterForAct(a).id}, expected ${pin[a]}`);
      }

      // e2e: only THIS act's recruiter stands at the muster post (r1 is in Act 1)
      let recruiters: string[] = [];
      state().shrines.forEach((sh: any) => { if (sh.kind === "mercnpc") recruiters.push(sh.variant); });
      if (recruiters.length !== 1) throw new Error(`act ${state().act} town shows ${recruiters.length} recruiters, expected 1`);
      if (recruiters[0] !== recruiterForAct(state().act).id)
        throw new Error(`act ${state().act} recruiter is ${recruiters[0]}, expected ${recruiterForAct(state().act).id}`);
      console.log(`recruiters: act-scoped — act ${state().act} musters only ${recruiters[0]}s, no other school in town`);
    }

    // --- storytelling: town dialogue tables + dungeon encounters (pure + e2e) ---
    {
      // pure: every functional NPC resolves and every storyteller is talk-only
      const functionalShrines: Array<[string, string, string]> = [
        ["vendor", "", "torvald"], ["gamble", "", "fenwick"], ["alchemist", "", "lysa"],
        ["mercnpc", "rogue", "maren"], ["mercnpc", "mage", "orsavio"],
        ["mercnpc", "barbarian", "hrothgar"], ["mercnpc", "paladin", "iseult"],
      ];
      for (const [kind, variant, expectId] of functionalShrines) {
        if (shrineNpcId(kind, variant) !== expectId) throw new Error(`shrineNpcId(${kind},${variant}) != ${expectId}`);
        const npc = townNpcById(expectId);
        if (!npc) throw new Error(`no dialogue for ${expectId}`);
        if (!npc.shopKind) throw new Error(`${expectId} should carry a shop`);
        if (!npc.topics.length) throw new Error(`${expectId} has nothing to say`);
        for (const t of npc.topics) if (!t.pages.length && !t.pagesByAct) throw new Error(`${expectId}/${t.id} is mute`);
      }
      // four storytellers, one per act, talk-only
      const tellers = [1, 2, 3, 4].map((a) => storytellerFor(a));
      if (new Set(tellers).size !== 4) throw new Error(`storytellers not distinct per act: ${tellers}`);
      for (const id of tellers) {
        const npc = townNpcById(id);
        if (!npc) throw new Error(`no storyteller ${id}`);
        if (npc.shopKind) throw new Error(`storyteller ${id} must be talk-only`);
        if (!npc.storytellerAct) throw new Error(`storyteller ${id} missing act`);
        if (npc.topics.length < 2) throw new Error(`storyteller ${id} is thin`);
      }
      // each act keeps its own townsfolk: the elder plus at least two locals, all
      // talk-only, each seated at a distinct town slot
      const allSlots = new Set<string>();
      for (const a of [1, 2, 3, 4]) {
        const roster = actTownNpcs(a);
        if (roster.length < 3) throw new Error(`act ${a} has only ${roster.length} townsfolk (elder + 2 wanted)`);
        if (roster[0].id !== storytellerFor(a)) throw new Error(`act ${a} roster must lead with its elder`);
        const tiles = new Set(roster.map((r) => r.tile));
        if (tiles.size !== roster.length) throw new Error(`act ${a} townsfolk share a slot`);
        for (const spec of roster) {
          if (!(TOWN as any)[spec.tile]) throw new Error(`act ${a} npc ${spec.id} has no tile ${spec.tile}`);
          const npc = townNpcById(spec.id);
          if (!npc) throw new Error(`act ${a} names an unknown npc ${spec.id}`);
          if (npc.shopKind) throw new Error(`act townsperson ${spec.id} must be talk-only`);
          if (!npc.topics.length) throw new Error(`${spec.id} has nothing to say`);
          allSlots.add(`${a}:${spec.id}`);
        }
      }
      // the two-new-per-act promise: 12 act townsfolk across 4 acts (4 elders + 8 locals)
      if (allSlots.size !== 12) throw new Error(`expected 12 act townsfolk, got ${allSlots.size}`);
      if (ACT_TOWN_NPCS[1].some((r) => r.id === "senna") === false) throw new Error("Act I lost Senna");
      // encounters: valid kinds, act tags, ambush kinds real, boons well-formed
      if (!ENCOUNTERS.length) throw new Error("no encounters authored");
      for (const e of ENCOUNTERS) {
        if (!["vignette", "ambush", "boon"].includes(e.kind)) throw new Error(`bad encounter kind ${e.kind}`);
        if (!e.pages.length) throw new Error(`encounter ${e.id} has no pages`);
        if (e.ambushKind && !(MONSTERS as any)[e.ambushKind]) throw new Error(`encounter ${e.id} names a phantom monster ${e.ambushKind}`);
        if (e.kind === "boon" && !e.boon) throw new Error(`boon ${e.id} has no effect`);
        if (encounterById(e.id) !== e) throw new Error(`encounterById lost ${e.id}`);
      }
      // each act (1..4) can roll all three kinds
      for (let a = 1; a <= 4; a++) {
        for (const k of ["vignette", "ambush", "boon"]) {
          if (!ENCOUNTERS.some((e) => e.kind === k && (e.act === a || e.act === 0)))
            throw new Error(`act ${a} has no ${k} encounter`);
        }
      }
      // rollEncounter is deterministic under a fixed rng and always in-act
      const seq = [0.1, 0.5, 0.8, 0.95, 0.3, 0.6];
      let si = 0;
      const rng = () => seq[si++ % seq.length];
      for (let n = 0; n < 12; n++) {
        const e = rollEncounter(2, rng);
        if (e && e.act !== 2 && e.act !== 0) throw new Error(`rollEncounter(2) returned an act-${e.act} story`);
      }
      console.log(`storytelling: ${TOWN_NPCS.length} speakers (12 act townsfolk: 4 elders + 8 locals), ${ENCOUNTERS.length} encounters, all kinds per act`);

      // e2e: this act's whole talk-only roster stands in town (elder + 2 locals)
      const present = new Set<string>();
      let elderId = "";
      state().shrines.forEach((sh: any, id: string) => {
        if (sh.kind === "storyteller") {
          present.add(sh.variant);
          if (sh.variant === storytellerFor(state().act)) elderId = id;
        }
      });
      for (const spec of actTownNpcs(state().act)) {
        if (!present.has(spec.id)) throw new Error(`act ${state().act} town is missing ${spec.id}`);
      }
      if (present.size !== actTownNpcs(state().act).length)
        throw new Error(`act ${state().act} shows ${present.size} townsfolk, expected ${actTownNpcs(state().act).length}`);
      if (!elderId) throw new Error("the act's elder is not in town");
      // touching a storyteller is client-side talk — the server must NOT consume it as a shrine
      if (state().shrines.get(elderId)?.used) throw new Error("storyteller arrived already consumed");
      r1.send("touchshrine", { id: elderId });
      await sleep(300);
      if (state().shrines.get(elderId)?.used) throw new Error("storyteller was consumed like a one-shot shrine");
      console.log(`storytelling: act ${state().act} keeps ${[...present].join(", ")} — a talk-only townsfolk each`);

      // presence: if a dungeon encounter rolled this floor, its shrine must carry
      // a real, resolvable variant (we don't walk r1 into the dangerous field mid-
      // town-section; the server mechanic is exercised by the field e2e below).
      let encVariant = "";
      state().shrines.forEach((sh: any) => {
        if (sh.kind === "encounter" && !encVariant) encVariant = sh.variant;
      });
      if (encVariant) {
        if (!encounterById(encVariant)) throw new Error(`encounter shrine carries an unknown variant ${encVariant}`);
        console.log(`storytelling: a "${encounterById(encVariant)?.label}" (${encounterById(encVariant)?.kind}) waits out in the dark on floor ${state().floor}`);
      } else {
        console.log(`storytelling: no encounter rolled this floor (chance) — pure battery covers the mechanics`);
      }
    }

    // --- Fenwick, funded this time: buy a mystery, get the promised base back ---
    let ghId = "";
    state().shrines.forEach((s: any, id: string) => {
      if (s.kind === "gamble") ghId = id;
    });
    lastGamble = null;
    await moveNear(TOWN.fenwick.x, TOWN.fenwick.y, 45);
    r1.send("touchshrine", { id: ghId });
    await sleep(600);
    if (!lastGamble?.items?.length) throw new Error("Fenwick did not open his spread on floor 2");
    const slot0 = [...lastGamble.items].sort((a: any, b: any) => a.price - b.price)[0];
    const gGold = me().gold;
    const gBag = (lastLoadout?.inventory ?? []).length;
    // first gamble also completes "A Fool and His Gold" — its reward lands instantly
    const gamblerQ = lastQuests?.list?.find((q: any) => q.id === "gambler");
    const questBonus = gamblerQ && !gamblerQ.done ? gamblerQ.rewardGold : 0;
    r1.send("gambleitem", { id: slot0.id });
    await sleep(800);
    if (gGold >= slot0.price && gBag < 20) {
      if (!lastGambled) throw new Error("gamble bought but no 'gambled' reveal arrived");
      if (me().gold !== gGold - slot0.price + questBonus) throw new Error("gamble charged the wrong gold");
      if ((lastLoadout?.inventory ?? []).length !== gBag + 1) throw new Error("gambled item did not land in the bag");
      const won = (lastLoadout?.inventory ?? []).find((it: any) => it.base === slot0.base && it.rarity === lastGambled.rarity);
      if (!won) throw new Error(`gambled roll is not the promised base (${slot0.base})`);
      console.log(`Fenwick pays out: ${slot0.name} for ${slot0.price}g became a ${lastGambled.rarity} (ilvl ${lastGambled.ilvl}${lastGambled.unidentified ? ", unidentified" : ""})`);
    } else {
      console.log(`Fenwick skipped the funded buy (gold ${gGold} < ${slot0.price} or bag full) — refusal path already covered`);
    }

    // --- Lysa the Alchemist: click her, browse, buy a flask ---
    let alchId = "";
    state().shrines.forEach((s: any, id: string) => {
      if (s.kind === "alchemist") alchId = id;
    });
    if (!alchId) throw new Error("no alchemist in town");
    await moveNear(TOWN.alchemist.x, TOWN.alchemist.y, 45);
    r1.send("touchshrine", { id: alchId });
    await sleep(600);
    if (!lastShop || typeof lastShop.health !== "number") throw new Error("alchemist did not open her shop");
    const goldBefore = me().gold;
    const flasksBefore = me().potions;
    r1.send("buypotion", { kind: "health" });
    await sleep(700);
    if (goldBefore >= lastShop.health && flasksBefore < me().maxPotions) {
      if (me().potions !== flasksBefore + 1) throw new Error("bought flask did not appear on the belt");
      if (me().gold !== goldBefore - lastShop.health) throw new Error("flask purchase charged the wrong gold");
      console.log(`alchemist works: bought a health flask for ${lastShop.health}g (${goldBefore} -> ${me().gold}g)`);
    } else {
      if (me().potions !== flasksBefore || me().gold !== goldBefore) throw new Error("shop sold to a customer it should refuse");
      console.log(`alchemist works: shop opened, refused the ${goldBefore < lastShop.health ? "broke" : "full-belted"} customer`);
    }

    // --- Torvald: click the man, browse the shelves, buy the cheapest thing ---
    let venId = "";
    state().shrines.forEach((s: any, id: string) => {
      if (s.kind === "vendor") venId = id;
    });
    if (!venId) throw new Error("no Torvald in town");
    lastVendor = null;
    await moveNear(TOWN.vendor.x, TOWN.vendor.y, 45);
    r1.send("touchshrine", { id: venId });
    await sleep(600);
    if (!lastVendor?.items?.length) throw new Error("Torvald did not open his wares");
    if (lastVendor.items.length !== 7) throw new Error(`Torvald stocks ${lastVendor.items.length} items, expected 7`);
    for (const e of lastVendor.items) {
      if (e.item.rarity === "common") throw new Error("Torvald is selling junk (common item in stock)");
      if (e.item.unidentified) throw new Error("Torvald sells identified goods only");
      if (!(e.price > 0)) throw new Error("Torvald priced an item at nothing");
    }
    const cheapest = [...lastVendor.items].sort((a: any, b: any) => a.price - b.price)[0];
    const vGold = me().gold;
    const bagBefore = (lastLoadout?.inventory ?? []).length;
    r1.send("buyitem", { id: cheapest.item.id });
    await sleep(800);
    if (vGold >= cheapest.price && bagBefore < 20) {
      if (me().gold !== vGold - cheapest.price) throw new Error("vendor purchase charged the wrong gold");
      if ((lastLoadout?.inventory ?? []).length !== bagBefore + 1) throw new Error("bought item did not land in the bag");
      if (lastVendor.items.length !== 7) throw new Error("Torvald's shelf did not restock");
      console.log(`Torvald works: 7 wares on the shelf, bought "${cheapest.item.name}" [${cheapest.item.rarity}] for ${cheapest.price}g`);
    } else {
      if (me().gold !== vGold) throw new Error("vendor sold to a customer it should refuse");
      console.log("Torvald works: 7 wares on the shelf, refused the under-funded customer");
    }

  }

  r1.send("townportal", {});
  await sleep(PORTAL_RETURN_MS + 900);
  if (isInTown(me().y)) throw new Error("return portal did not leave town");
  console.log("return portal works: back in the dungeon");

  // --- advanced item system sanity (pure functions) ---
  {
    // deep rolls should surface the new attribute types
    const seen = new Set<string>();
    let classItems = 0;
    for (let i = 0; i < 8000; i++) {
      const it = generateItem(8, 150);
      Object.keys(it.stats).forEach((k) => seen.add(k));
      if (it.classBonus) {
        classItems++;
        if (!(CLASSES as readonly string[]).includes(it.classBonus.cls)) {
          throw new Error(`bad classBonus cls: ${it.classBonus.cls}`);
        }
        if (Object.keys(it.classBonus.stats).length === 0) throw new Error("empty classBonus");
      }
    }
    const wantNew = ["crit", "lifeSteal", "thorns", "fireDmg", "coldDmg", "lightDmg", "xpBonus", "goldFind", "cdr"];
    const missing = wantNew.filter((k) => !seen.has(k));
    if (missing.length > 2) throw new Error(`new stats not rolling: missing ${missing.join(",")}`);
    if (classItems === 0) throw new Error("no class-locked affixes rolled in 8000 items");
    console.log(`advanced affixes: ${seen.size} distinct stats seen, ${classItems} class-locked items in 8000 rolls`);

    // low-level MAGIC/RARE rolls must not contain deep-tier affixes (fixed items bypass tiers by design)
    for (let i = 0; i < 2000; i++) {
      const it = generateItem(1, 100);
      if (it.rarity !== "magic" && it.rarity !== "rare") continue;
      if (it.stats.lifeSteal || it.stats.cdr || (it.stats.dmgPct ?? 0) > 45) {
        throw new Error(`ilvl-1 ${it.rarity} rolled deep-tier stats: ${JSON.stringify(it.stats)}`);
      }
    }
    console.log("affix tier gating holds at ilvl 1");

    // unique effects present and wired
    const effectChecks: Array<[string, string]> = [
      ["Hargol's Cleaver", "executioner"],
      ["Skysplitter", "chain_on_kill"],
      ["The First Dawn", "second_wind"],
      ["The Bloodline", "patriarch"],
      ["The Last Argument", "corpse_explosion"],
      ["The Howling Yew", "knockback_shot"],
      ["The Miser's Sash", "gold_burst"],
      ["Hoarfang", "frostnova_on_hit"],
      ["The Orphan Star", "arcane_surge"],
    ];
    for (const [name, effect] of effectChecks) {
      const it = generateFixedItem(name, 5);
      if (!it || it.effect !== effect) throw new Error(`${name} should carry effect ${effect}, got ${it?.effect}`);
    }
    if (potionCapFor({ belt: { base: "girdle" } }) !== 8) throw new Error("girdle should carry 8 potions");
    // the new law: EVERY unique+ item carries a gameplay-altering perk
    const perkless = FIXED_ITEMS.filter((f) => !f.effect);
    if (perkless.length > 0) {
      throw new Error(`perkless unique+ items: ${perkless.map((f) => f.name).join(", ")}`);
    }
    if (Object.keys(EFFECTS).length < 27) throw new Error(`expected 27+ effects, got ${Object.keys(EFFECTS).length}`);
    console.log(`unique effects: ${Object.keys(EFFECTS).length} distinct perks; all ${FIXED_ITEMS.length} unique+ items carry one`);
  }

  // --- loot systems sanity (pure functions) ---
  let setItem: any = null;
  for (let i = 0; i < 20000 && !setItem; i++) {
    const it = generateItem(3, 200);
    if (it.rarity === "set") setItem = it;
  }
  if (!setItem) throw new Error("no set item in 20000 rolls");
  if (!setItem.setId || !SETS[setItem.setId]) throw new Error("set item missing a valid setId");
  const charm = generateCharm(2, 0);
  if (charm.slot !== "charm" || Object.keys(charm.stats).length === 0) throw new Error("charm generation broken");
  console.log(`loot systems: rolled ${setItem.name} [${SETS[setItem.setId].name}], charm "${charm.name}"`);

  // --- belts & signature drops (pure functions) ---
  if (potionCapFor({}) !== 4) throw new Error("base potion cap should be 4");
  if (potionCapFor({ belt: { base: "sash" } }) !== 6) throw new Error("sash should carry 6 potions");
  if (potionCapFor({ belt: { base: "warbelt" } }) !== 8) throw new Error("war belt should carry 8 potions");
  for (const [boss, sigName] of Object.entries(BOSS_SIGNATURES)) {
    const sig = generateFixedItem(sigName, 3);
    if (!sig || sig.name !== sigName) throw new Error(`signature item for ${boss} failed to generate`);
  }
  if (me().maxPotions !== 4 && me().maxPotions !== 6 && me().maxPotions !== 8) {
    throw new Error(`unexpected live potion cap: ${me().maxPotions}`);
  }
  console.log(`belts & signatures: caps 4/6/8, all ${Object.keys(BOSS_SIGNATURES).length} boss signatures generate (live cap ${me().maxPotions})`);

  // --- monster roster sanity: floor 4 should field all four trash kinds ---
  const kinds = new Set<string>();
  for (let i = 0; i < 1000; i++) kinds.add(pickMonsterKind(4));
  for (const k of ["skeleton", "archer", "demon"]) {
    if (!kinds.has(k)) throw new Error(`floor 4 roster missing ${k}`);
  }
  console.log(`monster roster: floor 4 fields ${[...kinds].join(", ")}`);
  const deepKinds = new Set<string>();
  for (let i = 0; i < 1000; i++) deepKinds.add(pickMonsterKind(10));
  for (const k of ["hellion", "gargoyle", "succubus", "wraith"]) {
    if (!deepKinds.has(k)) throw new Error(`floor 10 roster missing ${k}`);
  }
  console.log(`monster roster: floor 10 fields ${[...deepKinds].join(", ")}`);

  // --- the final goal batch (pure): 6 classes, 80+ fixed items, 8 palettes ---
  {
    if (CLASSES.length !== 6) throw new Error(`expected 6 classes, got ${CLASSES.length}`);
    for (const cls of CLASSES) {
      if (!CLASS_ATTACKS[cls] || !CLASS_BASE_ATTRS[cls] || !SKILL_TREES[cls]) {
        throw new Error(`class ${cls} missing definitions`);
      }
      if (SKILL_TREES[cls].length < 8) throw new Error(`class ${cls} tree too small`);
    }
    if (FIXED_ITEMS.length < 80) throw new Error(`expected 80+ fixed items, got ${FIXED_ITEMS.length}`);
    const names = new Set<string>();
    for (const f of FIXED_ITEMS) {
      if (!BASE_ITEMS[f.base]) throw new Error(`fixed item "${f.name}" has unknown base ${f.base}`);
      if (f.effect && !EFFECTS[f.effect]) throw new Error(`fixed item "${f.name}" has unknown effect ${f.effect}`);
      if (names.has(f.name)) throw new Error(`duplicate fixed item name: ${f.name}`);
      names.add(f.name);
    }
    // legendary skill-powers: every item power must be a real SKILL_POWERS entry pointing at a real skill
    const skillIds = new Set(Object.values(SKILL_TREES).flat().map((s: any) => s.id));
    for (const f of FIXED_ITEMS) {
      if (!f.power) continue;
      const pw = (SKILL_POWERS as any)[f.power];
      if (!pw) throw new Error(`fixed item "${f.name}" has unknown power ${f.power}`);
      if (!skillIds.has(pw.skill)) throw new Error(`power ${f.power} rewrites unknown skill ${pw.skill}`);
    }
    for (const [id, pw] of Object.entries(SKILL_POWERS as any)) {
      if (!skillIds.has((pw as any).skill)) throw new Error(`SKILL_POWERS.${id} rewrites unknown skill ${(pw as any).skill}`);
    }
    const byRarity = { unique: 0, legendary: 0, epic: 0 } as Record<string, number>;
    FIXED_ITEMS.forEach((f) => byRarity[f.rarity]++);
    // Fenwick's contract (pure): the promised base survives every rarity roll
    {
      const baseKeys = Object.keys(BASE_ITEMS);
      for (let i = 0; i < 600; i++) {
        const want = baseKeys[i % baseKeys.length];
        const it = generateItem(1 + (i % 12), 0, Math.random, GAMBLE_WEIGHTS, want);
        if (it.base !== want) throw new Error(`base override broken: asked ${want}, got ${it.base}`);
        if (it.rarity === "common") throw new Error("gamble weights rolled common");
      }
    }
    // palettes: every act surfaces on floor 1 and cycles its own order below
    if (FLOOR_THEMES.length !== 15) throw new Error(`expected 15 themes, got ${FLOOR_THEMES.length}`);
    if (FLOOR_THEMES[visualThemeFor(1, 1)].id !== "forest") throw new Error("act 1 floor 1 is not the forest");
    if (FLOOR_THEMES[visualThemeFor(1, 2)].id !== "cathedral") throw new Error("act 1 floor 2 is not the cathedral");
    const act1Below = new Set<number>();
    for (let f = 2; f <= 7; f++) act1Below.add(visualThemeFor(1, f));
    if (act1Below.size !== 6) throw new Error(`act 1 palettes repeat: ${act1Below.size} distinct in 6 floors`);
    const abyssSeen = new Set<number>();
    for (let f = 1; f <= 9; f++) abyssSeen.add(visualThemeFor(5, f));
    if (abyssSeen.size !== 9) throw new Error(`the Abyss cycles ${abyssSeen.size} palettes, expected 9`);
    if (visualThemeFor(5, 1) === visualThemeFor(1, 1)) throw new Error("the Abyss has no world above — floor 1 must not be a surface");
    console.log(
      `final goal: 6 classes (${Object.values(SKILL_TREES).flat().length} skill nodes), ${FIXED_ITEMS.length} fixed items (${byRarity.unique}u/${byRarity.legendary}l/${byRarity.epic}e), forest + 9 palettes cycling, 9 bosses`
    );
  }

  // --- dungeon generator sanity (pure function): every act, every style, plus the Abyss ---
  for (const [act, floor] of [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [2, 1], [2, 4], [3, 1], [3, 5], [4, 1], [4, 7], [5, 1], [5, 3]] as Array<[number, number]>) {
    const d = generateDungeon(act, floor, 424242 + act * 100 + floor);
    const m = makeMap(d.rows);
    if (!canStand(m, d.spawn.x, d.spawn.y)) throw new Error(`floor ${floor}: spawn not standable`);
    if (!canStand(m, d.stairs.x, d.stairs.y)) throw new Error(`floor ${floor}: stairs not standable`);
    if (!canStand(m, d.boss.x, d.boss.y)) throw new Error(`floor ${floor}: boss spot not standable`);
    for (const c of d.camps) {
      if (!canStand(m, c.x, c.y)) throw new Error(`floor ${floor}: camp not standable`);
    }
    for (const c of d.chests) {
      if (!canStand(m, c.x, c.y)) throw new Error(`floor ${floor}: chest not standable`);
    }
    if (d.tome && !canStand(m, d.tome.x, d.tome.y)) throw new Error(`floor ${floor}: tome not standable`);
    for (const spot of [TOWN.spawn, TOWN.stash, TOWN.vendor, TOWN.waypoint, TOWN.transmute, TOWN.campfire]) {
      if (!canStand(m, spot.x, spot.y)) throw new Error(`floor ${floor}: town spot not standable`);
    }
    if (!bfs(m, [tileOf(d.spawn.x), tileOf(d.spawn.y)], [tileOf(d.stairs.x), tileOf(d.stairs.y)])) {
      throw new Error(`floor ${floor}: stairs unreachable from spawn`);
    }
    // the surface town has its gate; the deep camps are SEALED — portal-only
    const townPath = bfs(m, [tileOf(TOWN.spawn.x), tileOf(TOWN.spawn.y)], [tileOf(d.spawn.x), tileOf(d.spawn.y)]);
    const isSurface = floor === 1 && act < ABYSS_ACT;
    if (isSurface && !townPath) throw new Error(`act ${act} surface: no path from town through the gate`);
    if (!isSurface && townPath) throw new Error(`act ${act} floor ${floor}: the sealed camp has a hole in its wall`);
    const wantWp = act >= ABYSS_ACT ? floor % 3 === 0 : floor === 3 || floor === 5 || floor === 7;
    if (wantWp) {
      if (!d.waypoint) throw new Error(`act ${act} floor ${floor}: no waypoint where one is owed`);
      if (!canStand(m, d.waypoint.x, d.waypoint.y)) throw new Error(`act ${act} floor ${floor}: waypoint not standable`);
    } else if (d.waypoint) {
      throw new Error(`act ${act} floor ${floor}: unexpected waypoint`);
    }
    if (floor === 1 && act < ABYSS_ACT) {
      if (!d.cathedral) throw new Error(`act ${act} surface has no descent structure`);
      const inside =
        d.stairs.x >= d.cathedral.x * TILE && d.stairs.x <= (d.cathedral.x + d.cathedral.w) * TILE &&
        d.stairs.y >= d.cathedral.y * TILE && d.stairs.y <= (d.cathedral.y + d.cathedral.h) * TILE;
      if (!inside) throw new Error("floor 1 stairs are not inside the cathedral");
      // the world above: act 1 keeps its watchtower; every act digs 2-3 hollows
      const caves = d.areas.filter((a) => a.kind === "cave").length;
      const towers = d.areas.filter((a) => a.kind === "tower").length;
      if (act === 1 && towers !== 2) throw new Error("forest lacks its two tower stories");
      if (act > 1 && towers !== 0) throw new Error(`act ${act} surface grew a watchtower`);
      if (caves < 2 || caves > 3) throw new Error(`act ${act} surface has ${caves} hollows, expected 2-3`);
      if (d.portals.length !== (act === 1 ? 4 : 0) + caves * 2) throw new Error(`act ${act} portal count off: ${d.portals.length}`);
      for (const ap of d.portals) {
        if (!canStand(m, ap.x, ap.y)) throw new Error(`portal "${ap.label}" not standable`);
        if (!canStand(m, ap.tx, ap.ty)) throw new Error(`portal "${ap.label}" target not standable`);
      }
    } else if (d.cathedral) {
      throw new Error(`floor ${floor} unexpectedly has a cathedral`);
    } else if (d.portals.length || d.areas.length) {
      throw new Error(`floor ${floor} unexpectedly has forest areas`);
    }
  }
  console.log("dungeon generator: every act's surface + all five styles + the Abyss standable, town gate connected, waypoints every ≤2 floors, deep camps sealed");

  // --- line of sight (pure): monsters & mercs must not see through walls ---
  {
    // a room split by a solid vertical wall at column 5
    const los = makeMap([
      "..........",
      "..........",
      "..........",
      "..........",
      "..........",
    ].map((r) => r.split("").map((c, i) => (i === 5 ? "#" : c)).join("")));
    const T = TILE;
    const west = { x: 2 * T + 16, y: 2 * T + 16 };
    const east = { x: 8 * T + 16, y: 2 * T + 16 };
    if (hasLineOfSight(los, west.x, west.y, east.x, east.y)) throw new Error("LOS pierced a solid wall");
    // same side of the wall, unobstructed
    const west2 = { x: 3 * T + 16, y: 2 * T + 16 };
    if (!hasLineOfSight(los, west.x, west.y, west2.x, west2.y)) throw new Error("LOS blocked in open floor");
    // a monster far away but with a clear open corridor still sees
    const open = makeMap(Array.from({ length: 5 }, () => ".".repeat(20)));
    if (!hasLineOfSight(open, 16, 16, 19 * T, 2 * T)) throw new Error("LOS lost across open ground");
    console.log("line of sight: walls block the sightline, open ground does not — monsters & mercs can only strike what they can see");
  }

  // --- runes, sockets & runewords (pure) ---
  {
    for (let i = 0; i < 200; i++) {
      const rune = generateRune(1);
      if (rune.slot !== "rune") throw new Error("rune has wrong slot");
      const runeKey = rune.base.slice(5);
      if (!RUNES[runeKey]) throw new Error(`unknown rune ${rune.base}`);
      if (RUNES[runeKey].minIlvl > 1) throw new Error(`ilvl-1 rune drop rolled deep rune ${runeKey}`);
    }
    let socketed = 0;
    for (let i = 0; i < 3000; i++) {
      const it = generateItem(5, 0);
      if (it.sockets) {
        socketed++;
        if (it.sockets > 4) throw new Error(`too many sockets: ${it.sockets}`);
        if (!["weapon", "offhand", "helm", "chest"].includes(it.slot as string)) {
          throw new Error(`sockets on unsocketable slot ${it.slot}`);
        }
      }
    }
    if (socketed === 0) throw new Error("no sockets rolled in 3000 items");

    const steel = matchRuneword({ rarity: "common", slot: "weapon", sockets: 2, runes: ["ond", "vek"] });
    if (matchRuneword({ rarity: "magic", slot: "weapon", sockets: 2, runes: ["ond", "vek"] })) {
      throw new Error("a runeword formed in colored gear — the word only takes in plain steel");
    }
    if (RUNE_ORDER.length !== 20) throw new Error(`the alphabet holds ${RUNE_ORDER.length} runes, expected 20`);
    if (RUNEWORDS.length < 20) throw new Error(`the book holds ${RUNEWORDS.length} words, expected 20+`);
    for (const rw of RUNEWORDS) {
      for (const r of rw.runes) if (!RUNES[r]) throw new Error(`runeword ${rw.name} uses unknown rune ${r}`);
      if (rw.runes.length < 2 || rw.runes.length > 4) throw new Error(`runeword ${rw.name} has ${rw.runes.length} runes`);
    }
    if (steel?.name !== "Warbrand") throw new Error("Warbrand runeword did not match");
    if (matchRuneword({ rarity: "common", slot: "weapon", sockets: 2, runes: ["vek", "ond"] })) throw new Error("runeword order should matter");
    if (matchRuneword({ rarity: "common", slot: "boots", sockets: 2, runes: ["ond", "vek"] })) throw new Error("runeword slot gate failed");
    if (matchRuneword({ rarity: "common", slot: "weapon", sockets: 3, runes: ["ond", "vek"] })) throw new Error("partially-filled sockets formed a runeword");
    // the same runes can spell different words in different slots (Ghoststep armor / Kindling weapon)
    if (matchRuneword({ rarity: "common", slot: "chest", sockets: 2, runes: ["ond", "fyr"] })?.name !== "Ghoststep") throw new Error("Ghoststep did not match on chest");
    if (matchRuneword({ rarity: "common", slot: "weapon", sockets: 2, runes: ["ond", "fyr"] })?.name !== "Kindling") throw new Error("Kindling did not match on weapon");
    // the four-socket grail
    if (matchRuneword({ rarity: "common", slot: "offhand", sockets: 4, runes: ["ond", "hym", "zel", "vor"] })?.name !== "Anima") {
      throw new Error("Anima did not match on a 4-socket offhand");
    }
    console.log(`runes & runewords: ${socketed} socketed items in 3000 rolls (up to 4 sockets), Ghoststep/Kindling slot split + Anima verified`);
  }

  // --- jewels (pure): cut stones for any socket, never part of a word ---
  {
    let rares = 0;
    for (let i = 0; i < 400; i++) {
      const j = generateJewel(8, 0);
      if (j.slot !== "jewel" || j.base !== "jewel") throw new Error("jewel with wrong slot/base");
      if (j.rarity !== "magic" && j.rarity !== "rare") throw new Error(`jewel rolled ${j.rarity}`);
      const facets = Object.keys(j.stats).length;
      if (facets < 1 || facets > 4) throw new Error(`jewel rolled ${facets} stat facets`);
      if (j.rarity === "rare") rares++;
    }
    if (rares === 0 || rares === 400) throw new Error(`jewel rarity split broken: ${rares}/400 rare`);
    const deep = generateJewel(40, 0, () => 0.1);
    const shallow = generateJewel(1, 0, () => 0.1);
    const sum = (s: any) => Object.values(s).reduce((a: number, b: any) => a + Math.abs(b), 0);
    if (sum(deep.stats) <= sum(shallow.stats)) throw new Error("jewels do not scale with depth");
    console.log(`jewels: ${rares}/400 rare, facets 1-3, depth-scaled — and a seated stone bars the word by design`);
  }

  // --- the difficulty ladder's mythic thumb (pure) ---
  {
    const count = (mult: number) => {
      let mythic = 0;
      for (let i = 0; i < 60000; i++) {
        const r = generateItem(5, 0, Math.random, undefined, undefined, mult).rarity;
        if (r === "set" || r === "unique" || r === "legendary" || r === "epic") mythic++;
      }
      return mythic;
    };
    const n1 = count(1);
    const n2 = count(1.6);
    const n3 = count(2.5);
    if (!(n1 < n2 && n2 < n3)) throw new Error(`mythic odds not monotone across difficulties: ${n1}/${n2}/${n3}`);
    console.log(`difficulty mythics: set+ per 60k rolls — Normal ${n1}, Nightmare ${n2}, Hell ${n3}`);
  }

  // --- set expansion (pure) ---
  {
    if (Object.keys(SETS).length !== 5) throw new Error(`expected 5 sets, got ${Object.keys(SETS).length}`);
    for (const sid of ["conclave", "creed", "colossus"]) {
      if (!SETS[sid]) throw new Error(`missing set ${sid}`);
      if (!SETS[sid].partial) throw new Error(`set ${sid} missing partial bonus`);
    }
    console.log("set expansion: 5 sets, class sets carry partial bonuses");
  }

  // --- skill trees & attributes (pure) ---
  {
    for (const [cls, nodes] of Object.entries(SKILL_TREES)) {
      const ids = new Set(nodes.map((n) => n.id));
      const ultimates = nodes.filter((n) => n.type === "ultimate");
      if (ultimates.length !== 1) throw new Error(`${cls} should have exactly 1 ultimate, has ${ultimates.length}`);
      for (const n of nodes) {
        if (n.req && !ids.has(n.req)) throw new Error(`${cls}/${n.id} requires unknown skill ${n.req}`);
        if (n.synergy && !ids.has(n.synergy.from)) throw new Error(`${cls}/${n.id} synergizes with unknown skill ${n.synergy.from}`);
        if (n.type !== "passive" && (n.mana === undefined || n.cooldownMs === undefined)) {
          throw new Error(`${cls}/${n.id} is an active without mana/cooldown`);
        }
        if (n.type === "passive" && !n.passive) throw new Error(`${cls}/${n.id} is a passive without stats`);
      }
      // gating: tier levels, prereqs, points, max rank
      const ult = ultimates[0];
      if (canAllocSkill(ult, {}, TIER_LEVELS[4] - 1, 5)) throw new Error(`${cls} ultimate allocatable below level ${TIER_LEVELS[4]}`);
      if (ult.req && canAllocSkill(ult, {}, 99, 5)) throw new Error(`${cls} ultimate allocatable without prereq`);
      const t1 = nodes.find((n) => n.tier === 1 && !n.req)!;
      if (!canAllocSkill(t1, {}, 1, 1)) throw new Error(`${cls} tier-1 skill not allocatable at level 1`);
      if (canAllocSkill(t1, {}, 1, 0)) throw new Error(`${cls} skill allocatable with 0 points`);
      if (canAllocSkill(t1, { [t1.id]: t1.maxRank }, 99, 5)) throw new Error(`${cls} skill allocatable past max rank`);
    }
    // the level-99 endgame: every class can sink all 99 points somewhere
    for (const [cls, nodes] of Object.entries(SKILL_TREES)) {
      const cap = nodes.reduce((s, n) => s + n.maxRank, 0);
      if (cap < 99) throw new Error(`${cls} tree capacity ${cap} < 99 — points would go homeless`);
      const t5 = nodes.filter((n) => n.tier === 5);
      if (t5.length < 4) throw new Error(`${cls} has ${t5.length} Transcendence nodes, expected 4`);
      if (t5.some((n) => n.type !== "passive")) throw new Error(`${cls} tier-5 must be passives`);
      if (canAllocSkill(t5[0], {}, 29, 5)) throw new Error(`${cls} Transcendence allocatable below level 30`);
      if (!canAllocSkill(t5[0], {}, 30, 5)) throw new Error(`${cls} Transcendence locked at level 30`);
    }
    // synergy math: whirlwind gains 8%/pt from bash
    const ww = SKILL_TREES.barbarian.find((n) => n.id === "whirlwind")!;
    const solo = skillDamageMult(ww, { whirlwind: 1 });
    const boosted = skillDamageMult(ww, { whirlwind: 1, bash: 5 });
    if (Math.abs(boosted / solo - 1.4) > 0.001) throw new Error(`synergy math off: ${solo} -> ${boosted}`);
    // attribute math
    const barb = attrBonus(CLASS_BASE_ATTRS.barbarian, "barbarian");
    if ((barb.dmgPct ?? 0) <= 0 || (barb.crit ?? 0) <= 0) throw new Error("attrBonus produced no offense");
    if (maxHpFor(30, 5, 0) !== 20 + 90 + 24) throw new Error(`maxHpFor math off: ${maxHpFor(30, 5, 0)}`);
    console.log(`skill trees: ${Object.values(SKILL_TREES).flat().length} nodes across 3 classes validated — gates, prereqs, ranks, synergy math (+40% ww from maxed bash), attribute formulas`);
  }

  // --- resistances, identify & transmute math (pure) ---
  {
    if (resistOf({ fireRes: 50, allRes: 10 }, "fire") !== 60) throw new Error("resistOf addition wrong");
    if (resistOf({ fireRes: 90 }, "fire") !== RES_CAP) throw new Error("resist cap not enforced");
    if (resistOf({}, "cold") !== 0) throw new Error("bare resist should be 0");
    for (const kind of Object.keys(MONSTER_ELEMENTS)) {
      if (!(kind in MONSTERS)) throw new Error(`MONSTER_ELEMENTS references unknown kind ${kind}`);
    }
    // resist affixes must actually roll on deep gear
    let resRolls = 0;
    for (let i = 0; i < 4000; i++) {
      const it = generateItem(8, 150);
      if (it.stats.fireRes || it.stats.coldRes || it.stats.lightRes || it.stats.allRes) resRolls++;
    }
    if (resRolls === 0) throw new Error("no resist affixes in 4000 deep rolls");
    if (identifyCost(1) !== 20 || identifyCost(5) !== 80) throw new Error("identifyCost math off");
    for (const r of UNIDENTIFIED_RARITIES) {
      if (["common", "magic"].includes(r)) throw new Error("commons/magics should identify themselves");
    }
    // rune ladder must be sorted by depth so 3× upgrades climb
    for (let i = 1; i < RUNE_ORDER.length; i++) {
      if (RUNES[RUNE_ORDER[i]].minIlvl < RUNES[RUNE_ORDER[i - 1]].minIlvl) {
        throw new Error("RUNE_ORDER is not depth-ascending");
      }
    }
    console.log(`resist/identify/transmute math holds: ${resRolls} resist items in 4000 rolls, cap ${RES_CAP}%, rune ladder ${RUNE_ORDER.join("→")}`);
  }

  // --- the final hours batch (pure): enchanted champions, the meadow, bounty math ---
  {
    const enchanted = CHAMPION_MODS.filter((m) => m.element);
    if (enchanted.length !== 3) throw new Error(`expected 3 enchanted champion mods, got ${enchanted.length}`);
    const fe = CHAMPION_MODS.find((m) => m.id === "fire");
    if (!fe?.explode) throw new Error("Fire Enchanted must explode on death");
    if (!MONSTERS.bovine || !MONSTERS.bovax) throw new Error("hell bovines missing from the roster");
    if (!isBossKind("bovax")) throw new Error("Bovax is not royalty");
    for (const floor of [2, 6]) {
      const d = generateCowLevel(floor, 777 + floor);
      const m = makeMap(d.rows);
      if (!canStand(m, d.spawn.x, d.spawn.y)) throw new Error("cow spawn not standable");
      if (!canStand(m, d.stairs.x, d.stairs.y)) throw new Error("cow stairs not standable");
      if (!canStand(m, d.boss.x, d.boss.y)) throw new Error("Bovax spot not standable");
      if (!bfs(m, [tileOf(d.spawn.x), tileOf(d.spawn.y)], [tileOf(d.stairs.x), tileOf(d.stairs.y)])) {
        throw new Error("meadow stairs unreachable");
      }
      for (const spot of [TOWN.spawn, TOWN.stash, TOWN.vendor, TOWN.waypoint, TOWN.transmute]) {
        if (!canStand(m, spot.x, spot.y)) throw new Error("meadow town spot not standable");
      }
    }
    if (bountyGoalFor("kills", 3) !== 14) throw new Error("bounty kill goal math off");
    if (!bountyTextFor("boss", 1, "Hargol the Flenser").includes("Hargol the Flenser")) throw new Error("bounty text broken");
    console.log(`final hours: 3 enchanted champion mods (FE explodes), the meadow generates + connects, bounty math holds`);
  }

  // --- persistence: leave, reconnect with the same key, hero survives ---
  const snapshot = {
    cls: me().cls,
    name: me().name,
    level: me().level,
    gold: me().gold,
    potions: me().potions,
    inv: (lastLoadout?.inventory ?? []).length,
    str: me().str,
    vit: me().vit,
    statPoints: me().statPoints,
    shoutRank: lastLoadout?.skills?.shout ?? 0,
    bind1: lastLoadout?.binds?.["1"] ?? "",
  };
  await r1.leave();
  await sleep(500);

  // the roster screen's data source: /heroes knows this hero by key
  {
    const res = await fetch(`http://localhost:2567/heroes?keys=${smokeKey}`);
    const heroes: any[] = await res.json();
    const hero = heroes.find((h) => h.key === smokeKey);
    if (!hero || hero.name !== snapshot.name || hero.level !== snapshot.level) {
      throw new Error(`/heroes wrong: ${JSON.stringify(hero)}`);
    }
    console.log(`/heroes endpoint works: ${hero.name}, level ${hero.level}, floor ${hero.deepestFloor}`);
  }

  const c3 = new Client(ENDPOINT);
  const r3 = await c3.create("dungeon", { key: smokeKey }); // brand-new room, same identity
  let reload: any = null;
  r3.onMessage("loadout", (msg: any) => (reload = msg));
  for (const t of ["swing", "impact", "death", "pickedup", "levelup", "whirl", "shout", "chainfx", "teleportfx", "dashfx", "riftbloom", "poolfx", "bossaggro", "heal", "descend", "goblinspotted", "goblinescape", "shrinefx", "novacharge", "novafire", "queenspawn", "gamblefx", "gamblefail", "chestfx", "lore", "portalcast", "portalfx", "portalcancel", "openstash", "vendorhint", "sold", "socketed", "secondwind", "skilllearned", "dodge", "golddrop", "identified", "identifyfail", "waypointfx", "waypoints", "stairslocked", "transmutefx", "transmuted", "transmutehint", "reforgefx", "openaltar", "reforged", "victory", "warcryfx", "ancientsfx", "vengeancefx", "firewallfx", "meteorwarn", "meteorfall", "bountydone", "pilgrim", "wandererdead", "manaheal", "cowopen", "chat", "mswing", "mheal", "mortarwarn", "mortarhit", "wardup", "classfx", "aegisfx", "deathlessfx", "culledfx", "quests", "questdone", "openshop", "shopbought", "shopfail", "openvendor", "vendorbought", "opengamble", "gambled", "ping", "announce", "grave", "hardcoredeath", "mercshot", "merchired", "mercdead", "encounter"]) {
    r3.onMessage(t, () => {});
  }
  await sleep(700);
  const revived = (r3.state as any).players.get(r3.sessionId);
  if (!revived) throw new Error("reconnect produced no player");
  if (revived.cls !== snapshot.cls) throw new Error(`class not persisted: ${revived.cls} != ${snapshot.cls}`);
  if (revived.level !== snapshot.level) throw new Error(`level not persisted: ${revived.level} != ${snapshot.level}`);
  if (revived.gold !== snapshot.gold) throw new Error(`gold not persisted: ${revived.gold} != ${snapshot.gold}`);
  if (revived.potions !== snapshot.potions) throw new Error(`potions not persisted`);
  if ((reload?.inventory ?? []).length !== snapshot.inv) {
    throw new Error(`inventory not persisted: ${(reload?.inventory ?? []).length} != ${snapshot.inv}`);
  }
  if (revived.name !== snapshot.name) throw new Error(`name not persisted: "${revived.name}" != "${snapshot.name}"`);
  if (revived.str !== snapshot.str || revived.vit !== snapshot.vit) {
    throw new Error(`attributes not persisted: str ${revived.str}/${snapshot.str} vit ${revived.vit}/${snapshot.vit}`);
  }
  if (revived.statPoints !== snapshot.statPoints) throw new Error(`stat points not persisted`);
  if ((reload?.skills?.shout ?? 0) !== snapshot.shoutRank) {
    throw new Error(`skills not persisted: shout ${reload?.skills?.shout} != ${snapshot.shoutRank}`);
  }
  if ((reload?.binds?.["1"] ?? "") !== snapshot.bind1) throw new Error(`bindings not persisted`);
  if (revived.deepestFloor !== 2) throw new Error(`deepestFloor not persisted: ${revived.deepestFloor}`);
  console.log(
    `persistence works: ${snapshot.name} the ${snapshot.cls} lvl ${snapshot.level} (VIT ${snapshot.vit}, shout rank ${snapshot.shoutRank}, slot 1 bound, waypoint floor ${revived.deepestFloor}) survived a full reconnect into a new room`
  );

  // --- the veteran returns: town start, network intact, gates still gated ---
  {
    const st3 = () => r3.state as any;
    if (st3().floor !== 1 || st3().act !== 1) throw new Error("fresh room should start in act 1, floor 1");
    const me3 = () => st3().players.get(r3.sessionId);
    if (!isInTown(me3().y)) throw new Error("returning veteran did not start in town");
    console.log("returning veteran starts in town, as everyone does now");
    if (me3().actsUnlocked !== 1) throw new Error(`veteran actsUnlocked ${me3().actsUnlocked}, expected 1`);
    // the caravan refuses while the Thorned Maiden reigns
    let locked = 0;
    r3.onMessage("stairslocked", () => locked++);
    let caravanId = "";
    st3().shrines.forEach((s: any, id: string) => {
      if (s.kind === "caravan") caravanId = id;
    });
    if (!caravanId) throw new Error("no caravan in town");
    const dl = Date.now() + 10000;
    while (Date.now() < dl && locked === 0) {
      const d = Math.hypot(me3().x - TOWN.caravan.x, me3().y - TOWN.caravan.y);
      if (d < 60) r3.send("touchshrine", { id: caravanId });
      else r3.send("move", { x: TOWN.caravan.x, y: TOWN.caravan.y });
      await sleep(300);
    }
    if (st3().act !== 1) throw new Error("the caravan rolled through a locked gate");
    if (locked === 0) throw new Error("the locked caravan sent no refusal");
    console.log("act gating works: the caravan stands in town and refuses while the act boss reigns");
  }

  // --- the rush: a veteran with opened roads jumps the party across acts ---
  {
    const fs = await import("fs");
    const vKey = `smokevet${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    const vetProf = {
      cls: "barbarian", name: "Roadmaker", level: 12, xp: 0, gold: 1000, potions: 4,
      gear: {}, inventory: [], stash: [],
      attrs: { str: 40, dex: 25, vit: 35, ene: 10 }, statPoints: 0, skillPoints: 13, skills: {}, binds: {},
      deepestFloor: 10, actsUnlocked: 2, diffUnlocked: 2, waypoints: ["1:1", "1:3", "2:1"], abyssDeepest: 0,
      updatedAt: Date.now(),
    };
    fs.writeFileSync(`server/data/profiles/${vKey}.json`, JSON.stringify(vetProf));
    const cV = new Client(ENDPOINT);
    // he asks for HELL — the server clamps him to the Nightmare he actually earned
    const rV = await cV.create("dungeon", { key: vKey, cls: "barbarian", name: "Roadmaker", difficulty: 3 });
    rV.onMessage("*", () => {});
    let vWp: any = null;
    rV.onMessage("waypoints", (m: any) => (vWp = m));
    await sleep(600);
    const stV = () => rV.state as any;
    const meV = () => stV().players.get(rV.sessionId);
    if (meV().actsUnlocked !== 2) throw new Error(`rusher actsUnlocked ${meV().actsUnlocked}, expected 2`);
    if (stV().difficulty !== 2) throw new Error(`asked for Hell with Nightmare earned — got difficulty ${stV().difficulty}`);
    // an unproven guest must be turned away at the door of a Nightmare game
    let gateHeld = false;
    try {
      const cG = new Client(ENDPOINT);
      await cG.joinById(rV.roomId);
    } catch (e: any) {
      gateHeld = String(e?.message ?? "").includes("difficulty_locked");
    }
    if (!gateHeld) throw new Error("an unproven guest walked into a Nightmare game");
    console.log("difficulty works: forge clamped Hell→Nightmare for its earner, and the door refused an unproven guest");
    // stand at the town stone and ride to Act II
    let wpIdV = "";
    stV().shrines.forEach((s: any, id: string) => {
      if (s.kind === "waypoint" && isInTown(s.y)) wpIdV = id;
    });
    let dlV = Date.now() + 12000;
    while (Date.now() < dlV && !vWp) {
      const d = Math.hypot(meV().x - TOWN.waypoint.x, meV().y - TOWN.waypoint.y);
      if (d < 45) rV.send("touchshrine", { id: wpIdV });
      else rV.send("move", { x: TOWN.waypoint.x, y: TOWN.waypoint.y });
      await sleep(300);
    }
    if (!vWp?.list?.includes("2:1")) throw new Error(`veteran network missing 2:1: ${JSON.stringify(vWp?.list)}`);
    rV.send("waypointjump", { act: 2, floor: 1 });
    dlV = Date.now() + 8000;
    while (Date.now() < dlV && stV().act !== 2) await sleep(200);
    if (stV().act !== 2 || stV().floor !== 1) throw new Error(`jump to Act II failed: act ${stV().act} floor ${stV().floor}`);
    // ...and back through the dark to a mid-act stone
    dlV = Date.now() + 20000;
    let jumped = false;
    const gateX = (TOWN_GATE_TX + 0.5) * TILE;
    while (Date.now() < dlV && !jumped) {
      const d = Math.hypot(meV().x - TOWN.waypoint.x, meV().y - TOWN.waypoint.y);
      if (d < 45) {
        rV.send("waypointjump", { act: 1, floor: 3 });
        await sleep(400);
        jumped = stV().act === 1 && stV().floor === 3;
      } else if (meV().y > TOWN_ROWS * TILE) {
        rV.send("move", { x: gateX, y: 8.5 * TILE }); // straight-line walker: through the gate first
        await sleep(300);
      } else {
        rV.send("move", { x: TOWN.waypoint.x, y: TOWN.waypoint.y });
        await sleep(300);
      }
    }
    if (!jumped) throw new Error(`jump to Act I level 3 failed: act ${stV().act} floor ${stV().floor}`);
    let fieldWps = 0;
    stV().shrines.forEach((s: any) => {
      if (s.kind === "waypoint" && !isInTown(s.y)) fieldWps++;
    });
    if (fieldWps !== 1) throw new Error(`floor 3 should hold one field waypoint, found ${fieldWps}`);
    console.log("the rush works: Roadmaker rode the network to Act II and back to a mid-act stone (field waypoint present)");
    await rV.leave();
    fs.unlinkSync(`server/data/profiles/${vKey}.json`);
  }

  await r3.leave();
  await r2.leave();
  console.log("SMOKE TEST PASSED ✔");
  process.exit(0);
}

main().catch((err) => {
  console.error("SMOKE TEST FAILED:", err.message ?? err);
  process.exit(1);
});
