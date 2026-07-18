import Phaser from "phaser";
import { Client, Room, getStateCallbacks } from "colyseus.js";
import { Atmosphere } from "./atmosphere";
import { SERVER_WS } from "./config";
import {
  TILE,
  TILE_W,
  TILE_H,
  WALL_H,
  tileAt,
  canStand,
  makeMap,
  GameMap,
  CLASS_ATTACKS,
  ClassName,
  skillById,
  SkillKey,
  STAIRS_USE_RANGE,
  MONSTERS,
  MonsterKind,
  RARITY_COLORS,
  RARITY_ORDER,
  FLOOR_THEMES,
  FOREST_THEME_INDEX,
  visualThemeFor,
  dangerFor,
  ACTS,
  ABYSS_ACT,
  isBossKind,
  CHAMPION_MODS,
  TOWN,
  TOWN_ROWS,
  TOWN_GATE_TX,
  TOWN_BUILDINGS,
  townStyle,
  isInTown,
  mercClassById,
  encounterById,
  setpieceById,
  townNpcById,
} from "@hollowmark/common";
import type { TownBuilding, TownStyle } from "@hollowmark/common";
import { Sfx } from "./sfx";
import { ensureItemIcons } from "./icons";
import { buildMonsterFigure } from "./mobArt";
import { generateThemeTextures } from "./materials";
import { rarityColorStr, Loadout } from "./ui";
import type { UIScene } from "./UIScene";

const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;

const CLASS_COLORS: Record<string, number> = {
  barbarian: 0xc0392b,
  rogue: 0x27ae60,
  sorcerer: 0x2f80c9,
  paladin: 0xc9a227,
  necromancer: 0x6a8f7a,
  druid: 0x9a6a3a,
};
// per-kind monster art lives in mobArt.ts

const WORLD_ZOOM = 1.5;

// world (flat 2D) -> isometric screen
function worldToScreen(wx: number, wy: number) {
  return { x: ((wx - wy) * HALF_W) / TILE, y: ((wx + wy) * HALF_H) / TILE };
}

// isometric screen -> world
function screenToWorld(sx: number, sy: number) {
  const tx = sx / HALF_W;
  const ty = sy / HALF_H;
  return { x: ((ty + tx) * TILE) / 2, y: ((ty - tx) * TILE) / 2 };
}

interface Entity {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Shape; // torso (players) or blob (monsters) — target of hit flash/pop
  baseColor: number;
  hpFg: Phaser.GameObjects.Rectangle;
  schema: any; // live Colyseus schema ref — read x/y/hp from it each frame
  label?: Phaser.GameObjects.Text;
  lastLevel?: number;
  lastStepAt?: number;
  prevX?: number;
  prevY?: number;
  // layered player figure + visible gear
  figure?: Phaser.GameObjects.Container;
  hairShape?: Phaser.GameObjects.Shape;
  weaponImg?: Phaser.GameObjects.Image;
  offhandImg?: Phaser.GameObjects.Image;
  helmImg?: Phaser.GameObjects.Image;
  gearSig?: string;
  // limbs, for the walk cycle
  legL?: Phaser.GameObjects.Rectangle;
  legR?: Phaser.GameObjects.Rectangle;
  armF?: Phaser.GameObjects.Rectangle;
  armB?: Phaser.GameObjects.Rectangle;
  torsoShape?: Phaser.GameObjects.Rectangle;
  beltShape?: Phaser.GameObjects.GameObject[];
  pauldrons?: Phaser.GameObjects.GameObject[];
  swingTween?: Phaser.Tweens.Tween;
  // monster idle animations, killed on death
  anims?: Phaser.Tweens.Tween[];
  // druid wolf form overlay
  wolfOn?: boolean;
  wolfParts?: Phaser.GameObjects.GameObject[];
  // decked-out presence: rarity underglow, helm flair, drifting embers
  aura?: Phaser.GameObjects.Ellipse;
  helmFlair?: Phaser.GameObjects.GameObject[];
  lastEmberAt?: number;
}

interface ProjectileEntity {
  container: Phaser.GameObjects.Container;
  schema: any;
  lastX: number;
  lastY: number;
  rotatable?: Phaser.GameObjects.Rectangle;
  trailColor?: number; // the streak it leaves behind
}

// the glow a projectile smears through the air, by kind
const PROJ_TRAIL: Record<string, number> = {
  fireball: 0xff8a33, orb: 0x8ad0ff, thorn: 0x5fce7f, hammer: 0xffe08a,
  bossarrow: 0xff7070, mobarrow: 0xd8a080, quill: 0x9a7a4a, hexbolt: 0xb87aff,
  bloodstar: 0xff7090, bone: 0xe8e4d4, frostbolt: 0x8ec8f0,
};

interface LootEntity {
  container: Phaser.GameObjects.Container;
  schema: any;
  label?: Phaser.GameObjects.Text;
  labelBaseY?: number; // the label's home row before declutter lifts it
}

export class GameScene extends Phaser.Scene {
  // read by UIScene
  room?: Room;
  players = new Map<string, Entity>();
  myCls = "";
  myAtkSpd = 0;
  attackReadyAt = 0;
  skillReadyAt = new Map<string, number>();
  lastLoadout: Loadout | null = null;
  loadoutRev = 0;
  connectionStatus = "connecting…";
  lastDeathBy = "";

  private monsters = new Map<string, Entity>();
  private pets = new Map<string, { container: Phaser.GameObjects.Container; schema: any }>();
  private mercs = new Map<string, { container: Phaser.GameObjects.Container; figure: Phaser.GameObjects.Container; hpFg: Phaser.GameObjects.Rectangle; schema: any }>();
  private projectiles = new Map<string, ProjectileEntity>();
  private loot = new Map<string, LootEntity>();
  private corpses: Phaser.GameObjects.GameObject[] = [];

  private sfx = new Sfx();
  private lastMoveSend = 0;
  private pendingPickup: string | null = null;
  private pendingPickupSince = 0;
  private lastPickupSend = 0;
  private gore: Phaser.GameObjects.GameObject[] = []; // blood remembers, for a while
  private lootClickAt = 0; // a label click just chose a target — scene click must not override it
  private descendSeen = false; // the first descend message is just arrival
  // the watchtower politely steps aside when you walk behind it
  private towerFade?: { objs: Array<{ setAlpha: (a: number) => unknown }>; zone: { x0: number; y0: number; x1: number; y1: number } };
  private lootDirty = false; // loot changed — relayout the label rows
  private lastLootLayoutAt = 0;
  private portalCasts = new Map<string, Phaser.GameObjects.Container>();
  clientMap: GameMap | null = null; // read by UIScene for the minimap
  explored: Uint8Array | null = null; // fog-of-war memory, indexed ty * w + tx
  exploredRev = 0; // bumped when new tiles are revealed (minimap redraw signal)
  gs_lastPing: { x: number; y: number; at: number } | null = null; // the party's latest ping — the minimap blinks it

  private mapTiles: Phaser.GameObjects.GameObject[] = [];
  private decorTweens: Phaser.Tweens.Tween[] = [];
  private hitStopUntil = 0; // brief world-freeze on your big hits — the "crunch" of impact
  // enterable buildings whose roof lifts away when someone steps inside (a Diablo cutaway)
  private cutaways: Array<{ b: TownBuilding; roof: Phaser.GameObjects.GameObject[]; alpha: number }> = [];
  private fogTiles: Array<{ tx: number; ty: number; x: number; y: number }> = [];
  private fogG?: Phaser.GameObjects.Graphics;
  private fogDirty = false;
  private lastRevealAt = 0;
  private lastGloomTx = -1; // the gloom follows you: repaint when you cross a tile
  private fidgetAt = new Map<string, number>(); // sessionId → next idle fidget time
  private lastGloomTy = -1;

  // atmosphere: weather over the moor, motes in the deep
  private rainG?: Phaser.GameObjects.Graphics;
  private weatherKind = "";
  private rainDrops: Array<{ x: number; y: number; len: number; spd: number }> = [];
  private mistBlobs: Phaser.GameObjects.Image[] = []; // soft mistpuff banks
  private moteCount = 0;
  private lastMoteAt = 0;
  private lightImg?: Phaser.GameObjects.Image;
  private torchGlow?: Phaser.GameObjects.Image;
  private atmosphere?: Atmosphere;
  private lightScaleCur = 3;
  private stairsFx?: Phaser.GameObjects.Container;
  private pendingStairs = false; // clicked the stairs — walk over and descend
  private pendingStairsSince = 0;
  private lastStairsSend = 0;
  private shiftKey?: Phaser.Input.Keyboard.Key;
  private themesGenerated = new Set<number>();
  private shrineEnts = new Map<string, { container: Phaser.GameObjects.Container; schema: any; label?: Phaser.GameObjects.Text }>();
  private pendingShrine: string | null = null;
  private walkPath: Array<{ x: number; y: number }> | null = null; // BFS waypoints for walk-to interactions
  private walkPathSentAt = 0;

  constructor() {
    super("game");
  }

  private get ui(): UIScene | undefined {
    return this.scene.get("ui") as UIScene | undefined;
  }

  targetLoot(id: string) {
    const ent = this.loot.get(id);
    if (!ent || !this.room) return;
    this.pendingPickup = id;
    this.pendingPickupSince = this.time.now;
    this.lastPickupSend = 0;
    this.lootClickAt = this.time.now; // this choice is final — no second-guessing by the scene click
    this.room.send("move", { x: ent.schema.x, y: ent.schema.y });
  }

  // D2-style label declutter: labels in a pile stack upward into free rows,
  // so every item in the heap has its own clickable name
  private relayoutLootLabels() {
    const rects: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const ents = [...this.loot.values()].filter((e) => e.label);
    // resolve top-of-screen items first so piles grow upward deterministically
    ents.sort((a, b) => a.container.y - b.container.y || a.container.x - b.container.x);
    for (const e of ents) {
      const label = e.label!;
      const lw = label.width + 4;
      const lh = label.height + 2;
      const cx = e.container.x;
      let ly = e.labelBaseY ?? -26;
      for (let guard = 0; guard < 40; guard++) {
        const y = e.container.y + ly;
        const overlaps = rects.some(
          (r) => cx - lw / 2 < r.x2 && cx + lw / 2 > r.x1 && y - lh / 2 < r.y2 && y + lh / 2 > r.y1
        );
        if (!overlaps) break;
        ly -= lh; // take the next row up
      }
      label.y = e.container.y + ly; // labels live on their own layer, in world coords
      rects.push({
        x1: cx - lw / 2,
        y1: e.container.y + ly - lh / 2,
        x2: cx + lw / 2,
        y2: e.container.y + ly + lh / 2,
      });
    }
  }

  nearShrineKind(kind: string, range: number): boolean {
    const me = this.room ? this.players.get(this.room.sessionId) : undefined;
    if (!me) return false;
    let near = false;
    this.shrineEnts.forEach((ent) => {
      if (!near && ent.schema.kind === kind && Math.hypot(ent.schema.x - me.schema.x, ent.schema.y - me.schema.y) <= range) {
        near = true;
      }
    });
    return near;
  }

  create() {
    ensureItemIcons(this);
    this.ensureLightTexture();
    this.ensureTorchTexture();
    this.ensureGlowDot();
    this.lightImg = this.add.image(0, 0, "lightmask").setDepth(849_000); // under the fog shroud, over the world
    // warm firelight over the cold vision mask — breathes with the hero
    this.torchGlow = this.add.image(0, 0, "torchglow").setDepth(849_500).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.launch("ui");
    this.shiftKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT, false);
    this.input.keyboard?.on("keydown-L", () => {
      if (this.ui?.chatActive) return;
      if (this.lightImg) this.lightImg.setVisible(!this.lightImg.visible);
      if (this.torchGlow) this.torchGlow.setVisible(this.lightImg?.visible ?? true);
    });

    // atmosphere: bloom + vignette + per-zone color wash & ambient motes
    this.atmosphere = new Atmosphere(this);
    this.atmosphere.setup();

    // that iconic close-up dungeon feel; mouse wheel adjusts
    this.cameras.main.setZoom(WORLD_ZOOM);
    this.input.on(
      "wheel",
      (_p: unknown, _o: unknown, _dx: number, dy: number) => {
        const cam = this.cameras.main;
        cam.setZoom(Phaser.Math.Clamp(cam.zoom - dy * 0.001, 1.1, 2.2));
      }
    );

    // skills live on the number row (1-6); potions sit right below on Q (life) / W (mana)
    const NUM_KEYS: Array<[string, SkillKey]> = [
      ["keydown-ONE", "1"], ["keydown-TWO", "2"], ["keydown-THREE", "3"],
      ["keydown-FOUR", "4"], ["keydown-FIVE", "5"], ["keydown-SIX", "6"],
    ];
    for (const [ev, key] of NUM_KEYS) this.input.keyboard?.on(ev, () => this.castSkill(key));
    this.input.keyboard?.on("keydown-Q", () => {
      if (this.ui?.chatActive) return;
      this.sfx.ensure();
      this.room?.send("drink");
    });
    this.input.keyboard?.on("keydown-W", () => {
      if (this.ui?.chatActive) return;
      this.sfx.ensure();
      this.room?.send("drinkmana");
    });
    this.input.keyboard?.on("keydown-T", () => {
      if (this.ui?.chatActive) return;
      this.sfx.ensure();
      this.room?.send("townportal");
    });
    this.input.keyboard?.on("keydown-N", () => {
      if (this.ui?.chatActive) return;
      this.sfx.ensure();
      const on = this.sfx.toggleAmbient();
      const me = this.room ? this.players.get(this.room.sessionId) : undefined;
      if (me) this.floatText(me.schema.x, me.schema.y, on ? "ambience on" : "ambience off", "#8a8a96");
    });
    // G pings the spot under the cursor — the party sees the pulse
    this.input.keyboard?.on("keydown-G", () => {
      if (this.ui?.chatActive || !this.room) return;
      const pointer = this.input.activePointer;
      pointer.updateWorldPoint(this.cameras.main);
      const w = screenToWorld(pointer.worldX, pointer.worldY);
      this.room.send("ping", { x: w.x, y: w.y });
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.sfx.ensure();
      if (!this.room) return;
      if (this.ui?.blocksPoint(pointer.x, pointer.y)) return; // click belongs to the UI
      const shiftHeld = (pointer.event as MouseEvent)?.shiftKey || this.shiftKey?.isDown;
      if (pointer.rightButtonDown() || shiftHeld) {
        this.tryAttack(pointer);
      } else {
        // a label's own click handler already fired this frame and chose the target —
        // the scene click must neither override nor cancel it (THE multi-click bug)
        if (this.time.now - this.lootClickAt < 100) return;

        // left-clicking on or near a ground item loots it. Hit-test in SCREEN space
        // against both the glyph and the item's (decluttered) name label.
        pointer.updateWorldPoint(this.cameras.main);
        let lootId: string | null = null;
        let bestD = 36;
        this.loot.forEach((ent, id) => {
          const dGlyph = Math.hypot(pointer.worldX - ent.container.x, pointer.worldY - (ent.container.y - 8));
          const lx = ent.label ? ent.label.x : ent.container.x;
          const ly = ent.label ? ent.label.y : ent.container.y - 14;
          const dLabel = Math.hypot(pointer.worldX - lx, pointer.worldY - ly);
          const d = Math.min(dGlyph, dLabel);
          if (d < bestD) {
            bestD = d;
            lootId = id;
          }
        });
        if (lootId) {
          this.targetLoot(lootId);
          this.showClickMarker(pointer.worldX, pointer.worldY);
          return;
        }

        this.pendingPickup = null; // a genuine ground click cancels walk-to-item
        this.pendingStairs = false; // …and walk-to-stairs
        this.pendingShrine = null; // …and walk-to-shrine
        this.sendMove(pointer, true);
      }
    });

    this.connect();
  }

  private async connect() {
    try {
      // persistent identity: this browser owns this hero
      let key = localStorage.getItem("arpg_key");
      if (!key) {
        key = typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `k${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
        localStorage.setItem("arpg_key", key);
      }
      // account identity: spans ALL of this browser's heroes — keys the shared stash
      let account = localStorage.getItem("arpg_account");
      if (!account) {
        account = typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `a${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
        localStorage.setItem("arpg_account", account);
      }

      // a freshly created hero carries its class & name from the creation screen
      let created: { cls?: string; name?: string; hardcore?: boolean } = {};
      try {
        created = JSON.parse(localStorage.getItem("arpg_new") ?? "{}");
      } catch { /* stale value — ignore */ }

      const client = new Client(SERVER_WS);
      const randomize = localStorage.getItem("arpg_random") === "1";
      const intent = (window as any).__arpgIntent as { mode: string; roomId?: string; difficulty?: number } | undefined;
      const options = {
        key, account, cls: created.cls, name: created.name, randomize,
        hardcore: created.hardcore === true,
        difficulty: intent?.difficulty ?? 1, // the server clamps to what this hero has earned
      };
      let room: Room;
      try {
        if (intent?.mode === "join" && intent.roomId) {
          room = await client.joinById(intent.roomId, options);
        } else if (intent?.mode === "create") {
          room = await client.create("dungeon", options);
        } else {
          room = await client.joinOrCreate("dungeon", options);
        }
      } catch (err: any) {
        if (String(err?.message ?? "").includes("hero_already_here")) {
          alert("That hero is already fighting in this game — choose another.");
          location.reload();
          return;
        }
        if (String(err?.message ?? "").includes("hero_fallen")) {
          alert("That hardcore hero has fallen forever. Honor them — and forge another.");
          location.reload();
          return;
        }
        if (String(err?.message ?? "").includes("difficulty_locked")) {
          alert("That game runs at a difficulty this hero has not yet earned. Unmake Uldrath first.");
          location.reload();
          return;
        }
        if (intent?.mode === "join") {
          // the game filled or closed — find another
          room = await client.joinOrCreate("dungeon", options);
        } else {
          throw err;
        }
      }
      localStorage.removeItem("arpg_new"); // the profile owns it now
      localStorage.removeItem("arpg_random");
      document.getElementById("arpg-loading")?.remove(); // the descent is complete
      this.room = room;

      const $ = getStateCallbacks(room);

      $(room.state).listen("mapData", (value: string) => this.rebuildMap(value));
      $(room.state).listen("weather", (value: string) => this.applyWeather(value));

      $(room.state).players.onAdd((player: any, sessionId: string) => this.addPlayer(player, sessionId));
      $(room.state).players.onRemove((_p: any, sessionId: string) => {
        this.players.get(sessionId)?.container.destroy();
        this.players.delete(sessionId);
      });

      $(room.state).monsters.onAdd((monster: any, id: string) => this.addMonster(monster, id));
      $(room.state).monsters.onRemove((_m: any, id: string) => {
        const ent = this.monsters.get(id);
        ent?.anims?.forEach((t) => t.remove()); // stop the idle life with the body
        ent?.container.destroy();
        this.monsters.delete(id);
      });

      $(room.state).mercs.onAdd((mc: any, id: string) => {
        const container = this.add.container(0, 0);
        const shadow = this.add.ellipse(0, 0, 24, 12, 0x000000, 0.35);
        const figure = this.add.container(0, 0);
        const cn = mercClassById(mc.cls);
        // element tint on the school-mark (sash, orb, rune…)
        const tint = mc.archetype === "fire" ? 0xd8703a : mc.archetype === "cold" ? 0x6a9ad8 : 0xd8b13a;
        const legL = this.add.rectangle(-2.5, -9, 3.5, 8, 0x39332b).setOrigin(0.5, 0);
        const legR = this.add.rectangle(2.5, -9, 3.5, 8, 0x39332b).setOrigin(0.5, 0);
        const head = this.add.circle(0, -25, 5, 0xd8b090).setStrokeStyle(1, 0x000000, 0.35);
        if (mc.cls === "mage") {
          const robe = this.add.rectangle(0, -15, 11, 13, 0x2c2e6a).setStrokeStyle(1, 0x000000, 0.55);
          const hood = this.add.triangle(0, -28, 0, 6, 5, -3, -5, -3, 0x24265a);
          const staff = this.add.rectangle(8, -16, 2, 24, 0x5a4632);
          const orb = this.add.circle(8, -29, 3, tint).setStrokeStyle(1, 0x000000, 0.4);
          figure.add([legL, legR, robe, staff, head, hood, orb]);
        } else if (mc.cls === "barbarian") {
          const torso = this.add.rectangle(0, -15, 14, 13, 0x6a4326).setStrokeStyle(1, 0x000000, 0.55);
          const fur = this.add.rectangle(0, -20, 16, 4, 0x8a6a44);
          const hair = this.add.ellipse(0, -28, 11, 5, 0x2a1a10);
          const haft = this.add.rectangle(-9, -16, 2, 24, 0x4a3420);
          const blade = this.add.triangle(-9, -27, 0, -6, 9, 0, 0, 6, 0x9aa0aa).setStrokeStyle(1, 0x50545c);
          const mark = this.add.rectangle(0, -16, 14, 2.5, tint).setRotation(0.5);
          figure.add([legL, legR, haft, blade, torso, fur, mark, head, hair]);
        } else if (mc.cls === "paladin") {
          const torso = this.add.rectangle(0, -15, 12, 13, 0x8a8f9a).setStrokeStyle(1, 0x000000, 0.55);
          const tabard = this.add.rectangle(0, -15, 5, 12, 0xd8c46a);
          const helm = this.add.rectangle(0, -27, 9, 4, 0xb0b4bc).setStrokeStyle(1, 0x50545c);
          const shield = this.add.ellipse(-8, -16, 7, 11, tint).setStrokeStyle(1.2, 0x6a5a20);
          const mace = this.add.rectangle(9, -17, 2, 16, 0x5a4632);
          const maceHead = this.add.circle(9, -26, 2.4, 0xb0b4bc);
          figure.add([legL, legR, mace, maceHead, torso, tabard, shield, head, helm]);
        } else {
          // Rogue of the sisterhood: hooded archer, sash tinted by her school
          const torso = this.add.rectangle(0, -15, 11, 12, 0x2a5138).setStrokeStyle(1, 0x000000, 0.55);
          const sash = this.add.rectangle(0, -16, 11, 2.5, tint).setRotation(0.5);
          const hood = this.add.triangle(0, -28, 0, 6, 5, -3, -5, -3, 0x1e4a2a);
          const bow = this.add.arc(8, -17, 8, -80, 80, false, 0x000000, 0).setStrokeStyle(2, 0x7a5a34, 0.95);
          const quiver = this.add.rectangle(-6, -18, 3, 9, 0x5f482e).setRotation(-0.35);
          figure.add([legL, legR, quiver, torso, sash, head, hood, bow]);
        }
        const label = this.add
          .text(0, -40, `${mc.name} ⟨${cn.className.toLowerCase()}⟩`, {
            fontFamily: "monospace", fontSize: "10px", color: "#" + cn.npcColor.toString(16).padStart(6, "0"),
          })
          .setOrigin(0.5);
        const hpBg = this.add.rectangle(-13, -34, 26, 3.5, 0x000000, 0.6).setOrigin(0, 0.5);
        const hpFg = this.add.rectangle(-12.5, -34, 25, 2, 0x3fbf5f).setOrigin(0, 0.5);
        container.add([shadow, figure, label, hpBg, hpFg]);
        const s = worldToScreen(mc.x, mc.y);
        container.setPosition(s.x, s.y).setDepth(s.y);
        this.mercs.set(id, { container, figure, hpFg, schema: mc });
      });
      $(room.state).mercs.onRemove((_m: any, id: string) => {
        const ent = this.mercs.get(id);
        if (ent) {
          ent.container.destroy();
          this.mercs.delete(id);
        }
      });
      $(room.state).pets.onAdd((pet: any, id: string) => {
        // a raised servant: skeleton bones with a necrotic glow — the druid's spirit wolf runs amber
        const isWolf = pet.kind === "wolf";
        const container = this.add.container(0, 0);
        const glow = this.add.ellipse(0, 0, isWolf ? 24 : 20, isWolf ? 12 : 10, isWolf ? 0xc8903a : 0x5fae7f, isWolf ? 0.3 : 0.25);
        const { figure } = buildMonsterFigure(this, isWolf ? "goatman" : "skeleton");
        figure.setScale(isWolf ? 0.8 : 0.85);
        container.add([glow, figure]);
        const s = worldToScreen(pet.x, pet.y);
        container.setPosition(s.x, s.y).setDepth(s.y);
        this.pets.set(id, { container, schema: pet });
      });
      $(room.state).pets.onRemove((_p: any, id: string) => {
        const ent = this.pets.get(id);
        if (ent) {
          const puff = this.add.circle(ent.container.x, ent.container.y - 8, 8, 0xd8d4c0, 0.6).setDepth(ent.container.depth);
          this.tweens.add({ targets: puff, scale: 1.8, alpha: 0, duration: 300, onComplete: () => puff.destroy() });
          ent.container.destroy();
        }
        this.pets.delete(id);
      });

      $(room.state).projectiles.onAdd((proj: any, id: string) => this.addProjectile(proj, id));
      $(room.state).projectiles.onRemove((_p: any, id: string) => {
        this.projectiles.get(id)?.container.destroy();
        this.projectiles.delete(id);
      });

      $(room.state).shrines.onAdd((s: any, id: string) => this.addShrine(s, id));
      $(room.state).shrines.onRemove((_s: any, id: string) => {
        this.shrineEnts.get(id)?.label?.destroy();
        this.shrineEnts.get(id)?.container.destroy();
        this.shrineEnts.delete(id);
        if (this.pendingShrine === id) this.pendingShrine = null;
      });

      $(room.state).loot.onAdd((g: any, id: string) => this.addLoot(g, id));
      $(room.state).loot.onRemove((_g: any, id: string) => {
        this.loot.get(id)?.label?.destroy();
        this.loot.get(id)?.container.destroy();
        this.loot.delete(id);
        if (this.pendingPickup === id) this.pendingPickup = null;
        this.lootDirty = true; // a pile shrank — labels can settle back down
      });

      room.onMessage("hit", (msg: any) => this.onHit(msg));
      room.onMessage("death", (msg: any) => this.onDeath(msg));
      room.onMessage("swing", (msg: any) => this.onSwing(msg));
      room.onMessage("impact", (msg: any) => this.onImpact(msg));
      room.onMessage("levelup", (msg: any) => this.onLevelUp(msg));
      room.onMessage("riftdone", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        const burst = this.add.ellipse(s.x, s.y - 10, 40, 24, 0xb060ff, 0.5).setDepth(900_000).setScale(0.3);
        this.tweens.add({ targets: burst, scale: 3, alpha: 0, duration: 700, ease: "quad.out", onComplete: () => burst.destroy() });
        this.cameras.main.flash(300, 120, 60, 200);
        this.floatText(msg.x, msg.y - 24, `RIFT TIER ${msg.tier} CLEARED!`, "#d0a0ff");
        this.sfx.levelup();
      });
      room.onMessage("paragonup", (msg: any) => {
        const ent = this.players.get(msg.id);
        if (!ent) return;
        this.floatText(ent.schema.x, ent.schema.y - 10, `✦ PARAGON ${msg.level}`, "#c98aff");
        // a violet burst — glory past the ceiling
        const s = worldToScreen(ent.schema.x, ent.schema.y);
        const ring = this.add.circle(s.x, s.y - 16, 8, 0xc98aff, 0).setStrokeStyle(2.5, 0xd0a0ff, 0.9).setDepth(900_000);
        this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 620, ease: "quad.out", onComplete: () => ring.destroy() });
        if (msg.id === this.room?.sessionId) this.sfx.levelup();
      });
      room.onMessage("pickedup", (msg: any) => {
        const ent = this.loot.get(msg.id);
        if (ent) {
          // little sparkle where it was scooped up
          for (let i = 0; i < 3; i++) {
            const spark = this.add
              .circle(ent.container.x + (i - 1) * 5, ent.container.y - 8, 2, 0xffe8a0, 0.9)
              .setDepth(ent.container.depth + 2);
            this.tweens.add({
              targets: spark, y: spark.y - 14 - i * 4, alpha: 0, duration: 300 + i * 60,
              onComplete: () => spark.destroy(),
            });
          }
        }
        if (msg.by === this.room?.sessionId) {
          if (msg.gold) this.sfx.coin();
          else this.sfx.pickup();
        }
      });
      room.onMessage("gamblefx", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        const flash = this.add.circle(s.x, s.y - 16, 14, 0xd8b13a, 0.8).setDepth(s.y + 2);
        this.tweens.add({ targets: flash, scale: 2.2, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
        this.sfx.coin();
      });
      room.onMessage("chestfx", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        if (msg.outcome === "cursed") {
          const ring = this.add.circle(s.x, s.y - 10, 20, 0xd02020, 0.5).setDepth(s.y + 2);
          this.tweens.add({ targets: ring, scale: 2.5, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
          this.floatText(msg.x, msg.y, "A trap!", "#ff5544");
          this.cameras.main.shake(200, 0.006);
          this.sfx.squelch();
          this.sfx.hurt();
        } else if (msg.outcome === "jackpot") {
          const burst = this.add.circle(s.x, s.y - 10, 18, 0xffd54a, 0.8).setDepth(s.y + 2);
          this.tweens.add({ targets: burst, scale: 3, alpha: 0, duration: 600, onComplete: () => burst.destroy() });
          this.floatText(msg.x, msg.y, "JACKPOT!", "#ffd54a");
          this.cameras.main.shake(150, 0.004);
          this.sfx.drop("epic");
        } else {
          const burst = this.add.circle(s.x, s.y - 10, 12, 0xd8b13a, 0.6).setDepth(s.y + 2);
          this.tweens.add({ targets: burst, scale: 2, alpha: 0, duration: 400, onComplete: () => burst.destroy() });
          this.sfx.coin();
        }
      });
      room.onMessage("lore", (msg: any) => {
        const text = this.add
          .text(this.scale.width / 2, this.scale.height - 120, `“${msg.line}”`, {
            fontFamily: "monospace",
            fontSize: "14px",
            color: "#d8c9a0",
            fontStyle: "italic",
            wordWrap: { width: Math.min(560, this.scale.width - 80) },
            align: "center",
          })
          .setOrigin(0.5, 1)
          .setScrollFactor(0)
          .setDepth(990_000)
          .setAlpha(0);
        this.tweens.add({ targets: text, alpha: 1, duration: 600, yoyo: true, hold: 5000, onComplete: () => text.destroy() });
        this.sfx.page();
      });
      room.onMessage("encounter", (msg: any) => {
        const enc = encounterById(msg.id);
        if (!enc) return;
        // only the one who touched it reads the scene
        if (msg.by === this.room?.sessionId) {
          this.ui?.openEncounterDialogue(msg.id);
          if (enc.kind === "boon" && enc.boon) {
            const me = this.players.get(this.room?.sessionId ?? "");
            if (me) this.floatText(me.schema.x, me.schema.y - 20, enc.boon.note, enc.boon.cursed ? "#c05050" : "#8fd8a0");
          }
          if (enc.kind === "ambush") this.sfx.fireball();
          else this.sfx.page();
        }
      });
      room.onMessage("portalcast", (msg: any) => {
        this.portalCasts.get(msg.id)?.destroy();
        const s = worldToScreen(msg.x, msg.y);
        const c = this.add.container(s.x, s.y - 10).setDepth(940_000);
        const ring = this.add.ellipse(0, 0, 14, 8, 0x4a7ae8, 0).setStrokeStyle(3, 0x6a9aff, 0.9);
        const inner = this.add.ellipse(0, 0, 6, 3, 0x9ac8ff, 0.5);
        c.add([ring, inner]);
        this.tweens.add({ targets: [ring, inner], scaleX: 4.5, scaleY: 4.5, duration: msg.ms, ease: "sine.in" });
        this.portalCasts.set(msg.id, c);
        if (msg.id === this.room?.sessionId) this.sfx.portalCast(msg.ms / 1000);
      });
      room.onMessage("portalcancel", (msg: any) => {
        this.portalCasts.get(msg.id)?.destroy();
        this.portalCasts.delete(msg.id);
        const ent = this.players.get(msg.id);
        if (ent) this.floatText(ent.schema.x, ent.schema.y, "portal interrupted!", "#ff5544");
      });
      room.onMessage("portalfx", (msg: any) => {
        const cast = this.portalCasts.get(msg.id);
        if (cast) {
          const burst = this.add.circle(cast.x, cast.y, 18, 0x6a9aff, 0.7).setDepth(940_000);
          this.tweens.add({ targets: burst, scale: 2.2, alpha: 0, duration: 450, onComplete: () => burst.destroy() });
          cast.destroy();
          this.portalCasts.delete(msg.id);
        }
        const ent = this.players.get(msg.id);
        if (ent) {
          const s = worldToScreen(msg.x, msg.y);
          ent.container.setPosition(s.x, s.y).setDepth(s.y);
          const arrive = this.add.ellipse(s.x, s.y - 10, 40, 22, 0x6a9aff, 0.45).setDepth(s.y + 2);
          this.tweens.add({ targets: arrive, scaleY: 2.4, alpha: 0, duration: 500, onComplete: () => arrive.destroy() });
        }
        this.sfx.portalOpen();
      });
      room.onMessage("openstash", () => this.ui?.panel.openStash());
      room.onMessage("vendorhint", () => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) this.floatText(me.schema.x, me.schema.y, "Open your bag [I] — right-click items to sell", "#d8b13a");
      });
      room.onMessage("sold", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) this.floatText(me.schema.x, me.schema.y, `+${msg.value}g — ${msg.name}`, "#d8b13a");
        this.sfx.coin();
      });
      room.onMessage("gamblefail", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) this.floatText(me.schema.x, me.schema.y, `Need ${msg.cost} gold`, "#ff5544");
        this.sfx.hurt();
      });
      room.onMessage("loadout", (msg: any) => {
        this.myAtkSpd = msg.derived?.atkSpd ?? 0;
        this.lastLoadout = msg;
        this.loadoutRev++;
      });

      // a set-piece: open its inscription for the reader (the fragment grant is codexlog'd separately)
      room.onMessage("setpiece", (msg: any) => this.ui?.openSetpieceDialogue(msg.id));
      // a story beat: an authored milestone (act-boss / Hollow King), or the finale cinematic
      room.onMessage("storybeat", (msg: any) => this.ui?.openStoryBeat(msg.quest));
      // the Codex: account-wide bestiary/chronicle/relics, pushed on join, on change, and on open
      room.onMessage("codex", (msg: any) => this.ui?.setCodex(msg));
      room.onMessage("codexlog", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) this.floatText(me.schema.x, me.schema.y - 26, msg.text, "#c9b8e8");
        this.sfx.page();
      });

      room.onMessage("heal", (msg: any) => {
        this.floatText(msg.x, msg.y, `+${msg.amount}`, "#5fdf5f");
        if (msg.id === this.room?.sessionId) this.sfx.gulp();
      });
      room.onMessage("whirl", (msg: any) => this.onWhirl(msg));
      room.onMessage("shout", (msg: any) => this.onShout(msg));
      room.onMessage("chainfx", (msg: any) => this.onChainFx(msg));
      room.onMessage("teleportfx", (msg: any) => this.onTeleportFx(msg));
      room.onMessage("leapfx", (msg: any) => {
        const a = worldToScreen(msg.fromX, msg.fromY);
        const b = worldToScreen(msg.toX, msg.toY);
        const g = this.add.graphics().setDepth(950_000);
        g.lineStyle(4, 0xffb060, 0.6);
        g.lineBetween(a.x, a.y - 20, b.x, b.y - 20);
        this.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
        const ring = this.add.ellipse(b.x, b.y, msg.r * 2, msg.r, 0xffb060, 0.4).setDepth(b.y + 1).setScale(0.3);
        this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 350, onComplete: () => ring.destroy() });
        this.cameras.main.shake(150, 0.005);
        this.sfx.whirl();
        this.sfx.hit();
      });
      room.onMessage("piercefx", (msg: any) => {
        const a = worldToScreen(msg.fromX, msg.fromY);
        const b = worldToScreen(msg.toX, msg.toY);
        const g = this.add.graphics().setDepth(950_000);
        g.lineStyle(5, 0xffe8a0, 0.35);
        g.lineBetween(a.x, a.y - 12, b.x, b.y - 12);
        g.lineStyle(2, 0xfff4d0, 0.9);
        g.lineBetween(a.x, a.y - 12, b.x, b.y - 12);
        this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
        this.sfx.arrow();
        this.sfx.swing();
      });
      room.onMessage("frostfx", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        const ring = this.add
          .ellipse(s.x, s.y, msg.r * 2, msg.r, 0x9adfff, 0.35)
          .setStrokeStyle(2, 0xcdefff, 0.9)
          .setDepth(s.y + 2)
          .setScale(0.2);
        this.tweens.add({ targets: ring, scale: 1.1, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
        this.sfx.ice();
      });
      room.onMessage("mheal", (msg: any) => {
        // a Vampiric pack drinks the wound — a brief green upward drain
        const s = worldToScreen(msg.x, msg.y);
        for (let i = 0; i < 3; i++) {
          const mote = this.add
            .circle(s.x + (Math.random() - 0.5) * 14, s.y, 2.5, 0x7ad66a, 0.9)
            .setDepth(s.y + 3);
          this.tweens.add({
            targets: mote,
            y: s.y - 20 - Math.random() * 10,
            alpha: 0,
            duration: 380 + Math.random() * 160,
            onComplete: () => mote.destroy(),
          });
        }
      });
      room.onMessage("riftbloom", (msg: any) => {
        // Riftwalk: a torn arcane rift that lingers and pulses where a Sorcerer blinked
        const s = worldToScreen(msg.x, msg.y);
        const rift = this.add
          .ellipse(s.x, s.y, msg.r * 2, msg.r, 0xb060ff, 0.28)
          .setStrokeStyle(2, 0xd8a8ff, 0.9)
          .setDepth(s.y - 1);
        const core = this.add.ellipse(s.x, s.y, msg.r, msg.r * 0.5, 0xe0c0ff, 0.5).setDepth(s.y - 1);
        this.tweens.add({ targets: [rift, core], scaleX: 1.18, scaleY: 1.18, alpha: 0.5, duration: 320, yoyo: true, repeat: Math.ceil(msg.ms / 640) });
        this.time.delayedCall(msg.ms, () => { rift.destroy(); core.destroy(); });
        this.sfx.ice();
      });
      room.onMessage("poolfx", (msg: any) => {
        // a lingering ground pool (Aftershock quake, Contagion plague) — tinted, pulsing, for `ms`
        const s = worldToScreen(msg.x, msg.y);
        const pool = this.add
          .ellipse(s.x, s.y, msg.r * 2, msg.r, msg.hue ?? 0x9a7050, 0.26)
          .setStrokeStyle(2, msg.hue ?? 0xb08060, 0.7)
          .setDepth(s.y - 2);
        this.tweens.add({ targets: pool, alpha: 0.42, scaleX: 1.06, scaleY: 1.06, duration: 460, yoyo: true, repeat: Math.ceil((msg.ms ?? 1600) / 920) });
        this.time.delayedCall(msg.ms ?? 1600, () => pool.destroy());
      });
      room.onMessage("dashfx", (msg: any) => this.onDashFx(msg));
      room.onMessage("socketed", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (msg.runeword) {
          if (me) this.floatText(me.schema.x, me.schema.y, `RUNEWORD: "${msg.runeword}"!`, "#ff8033");
          this.cameras.main.flash(300, 90, 45, 10);
          this.sfx.drop("epic");
        } else {
          if (me) this.floatText(me.schema.x, me.schema.y, `${msg.rune} socketed into ${msg.item}`, "#ffb066");
          this.sfx.shrine();
        }
      });
      room.onMessage("secondwind", (msg: any) => {
        const ent = this.players.get(msg.id);
        if (ent) {
          const ring = this.add.circle(ent.container.x, ent.container.y - 12, 14, 0xffd54a, 0)
            .setStrokeStyle(3, 0xffe08a, 0.9)
            .setDepth(ent.container.depth + 1);
          this.tweens.add({ targets: ring, scale: 2.6, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
          this.floatText(msg.x, msg.y, "SECOND WIND", "#ffe08a");
        }
        if (msg.id === this.room?.sessionId) this.sfx.shrine();
      });
      room.onMessage("bossaggro", (msg: any) => this.onBossAggro(msg));
      room.onMessage("descend", (msg: any) => this.onDescend(msg));
      room.onMessage("novacharge", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        const hue = msg.hue ?? 0xff3020;
        const warn = this.add
          .ellipse(s.x, s.y, msg.r * 2, msg.r, hue, 0.12)
          .setStrokeStyle(2, hue, 0.8)
          .setDepth(s.y - 1);
        this.tweens.add({ targets: warn, alpha: 0.45, duration: 200, yoyo: true, repeat: Math.ceil(msg.ms / 400) });
        this.time.delayedCall(msg.ms, () => warn.destroy());
        this.sfx.novaWarn();
      });
      room.onMessage("novafire", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        const blast = this.add.ellipse(s.x, s.y, msg.r * 2, msg.r, msg.hue ?? 0xff6a20, 0.65).setDepth(s.y + 2).setScale(0.2);
        this.tweens.add({ targets: blast, scale: 1.15, alpha: 0, duration: 420, onComplete: () => blast.destroy() });
        this.cameras.main.shake(200, 0.006);
        this.sfx.fireball();
        this.sfx.hit();
      });
      room.onMessage("queenspawn", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        const burst = this.add.circle(s.x, s.y - 8, 14, 0x8faa4e, 0.7).setDepth(s.y + 2);
        this.tweens.add({ targets: burst, scale: 2, alpha: 0, duration: 400, onComplete: () => burst.destroy() });
        this.floatText(msg.x, msg.y, "the brood stirs…", "#9fbf6f");
        this.sfx.squelch();
      });
      room.onMessage("mortarwarn", (msg: any) => {
        // a Mortar shell is inbound — a ground ring that fills toward the moment it lands
        const s = worldToScreen(msg.x, msg.y);
        const hue = 0xffa030;
        const ring = this.add
          .ellipse(s.x, s.y, msg.r * 2, msg.r, hue, 0.1)
          .setStrokeStyle(2, hue, 0.85)
          .setDepth(s.y - 1);
        const fill = this.add.ellipse(s.x, s.y, 2, 1, hue, 0.3).setDepth(s.y - 1);
        this.tweens.add({ targets: fill, width: msg.r * 2, height: msg.r, duration: msg.ms, ease: "quad.in" });
        this.tweens.add({ targets: ring, alpha: 0.5, duration: 180, yoyo: true, repeat: Math.ceil(msg.ms / 360) });
        this.time.delayedCall(msg.ms, () => { ring.destroy(); fill.destroy(); });
        this.sfx.novaWarn();
      });
      room.onMessage("mortarhit", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        const blast = this.add.ellipse(s.x, s.y, msg.r * 2, msg.r, 0xd07a2a, 0.7).setDepth(s.y + 2).setScale(0.25);
        this.tweens.add({ targets: blast, scale: 1.1, alpha: 0, duration: 360, onComplete: () => blast.destroy() });
        for (let i = 0; i < 6; i++) {
          const clod = this.add
            .rectangle(s.x + (Math.random() - 0.5) * msg.r, s.y + (Math.random() - 0.5) * msg.r * 0.6, 3, 2, 0x6b4a2a, 0.9)
            .setDepth(s.y + 3);
          this.tweens.add({ targets: clod, y: clod.y - 14 - Math.random() * 12, alpha: 0, duration: 380, onComplete: () => clod.destroy() });
        }
        this.cameras.main.shake(140, 0.005);
        this.sfx.hit();
      });
      room.onMessage("rendfx", (msg: any) => {
        // a Rend wound — a spray of blood that lingers as the bleed ticks
        const s = worldToScreen(msg.x, msg.y);
        for (let i = 0; i < 7; i++) {
          const a = Math.random() * Math.PI * 2;
          const drop = this.add
            .circle(s.x, s.y - 6, 2 + Math.random() * 2, 0xb01824, 0.9)
            .setDepth(s.y + 3);
          this.tweens.add({
            targets: drop,
            x: s.x + Math.cos(a) * (10 + Math.random() * 16),
            y: s.y - 6 + Math.sin(a) * (8 + Math.random() * 12) + 10,
            alpha: 0,
            duration: 400 + Math.random() * 250,
            onComplete: () => drop.destroy(),
          });
        }
        this.sfx.hit();
      });
      room.onMessage("hexwarn", (msg: any) => {
        // a Hexer is sealing a curse-circle where you stand — a purple ring that closes toward the seal
        const s = worldToScreen(msg.x, msg.y);
        const hue = 0x9a5fd0;
        const ring = this.add
          .ellipse(s.x, s.y, msg.r * 2, msg.r, hue, 0.08)
          .setStrokeStyle(2, hue, 0.85)
          .setDepth(s.y - 1);
        const seal = this.add.ellipse(s.x, s.y, msg.r * 2, msg.r, hue, 0.22).setDepth(s.y - 1).setScale(1);
        // the seal shrinks inward as it gathers — get OUT of the ring before it closes
        this.tweens.add({ targets: seal, scaleX: 0.05, scaleY: 0.05, duration: msg.ms, ease: "quad.in" });
        this.tweens.add({ targets: ring, alpha: 0.5, duration: 200, yoyo: true, repeat: Math.ceil(msg.ms / 400) });
        this.time.delayedCall(msg.ms, () => { ring.destroy(); seal.destroy(); });
        this.sfx.novaWarn();
      });
      room.onMessage("hexhit", (msg: any) => {
        // the curse sealed — a purple implosion; anyone caught is sapped (server-authoritative)
        const s = worldToScreen(msg.x, msg.y);
        const burst = this.add.ellipse(s.x, s.y, msg.r * 2, msg.r, 0x8a2ad0, 0.6).setDepth(s.y + 2).setScale(1.1);
        this.tweens.add({ targets: burst, scale: 0.2, alpha: 0, duration: 340, onComplete: () => burst.destroy() });
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me && Math.hypot(me.schema.x - msg.x, me.schema.y - msg.y) <= msg.r) {
          this.floatText(me.schema.x, me.schema.y - 22, "Cursed!", "#c58ae8");
        }
        this.sfx.novaWarn();
      });
      room.onMessage("wardup", (msg: any) => {
        // a Warded champion raised its bubble — a shield that follows it for the duration
        const ent = this.monsters.get(msg.id);
        if (!ent) return;
        const bubble = this.add.circle(0, -8, 17, 0xf0e07a, 0.16).setStrokeStyle(2, 0xf7ee9a, 0.85);
        ent.container.add(bubble);
        this.tweens.add({ targets: bubble, alpha: 0.32, scale: 1.08, duration: 500, yoyo: true, repeat: Math.ceil(msg.ms / 1000) });
        this.time.delayedCall(msg.ms, () => bubble.destroy());
        this.sfx.shrine();
      });
      room.onMessage("shrinefx", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        const theme = FLOOR_THEMES[visualThemeFor(this.room?.state.act ?? 1, this.room?.state.floor ?? 1)];
        const burst = this.add.circle(s.x, s.y - 16, 18, theme.accent, 0.7).setDepth(s.y + 2);
        this.tweens.add({ targets: burst, scale: 2.4, alpha: 0, duration: 500, onComplete: () => burst.destroy() });
        this.floatText(msg.x, msg.y, msg.msg, "#9fdc9f");
        this.sfx.shrine();
      });
      room.onMessage("dodge", (msg: any) => {
        this.floatText(msg.x, msg.y, "dodge!", "#8ad0ff");
      });
      room.onMessage("chat", (msg: any) => {
        this.ui?.addChat(msg.name, msg.cls, msg.text);
      });
      room.onMessage("classfx", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        switch (msg.kind) {
          case "fist": {
            const bolt = this.add.rectangle(s.x, s.y - 120, 6, 240, 0xfff0c0, 0.9).setDepth(950_000);
            const ring = this.add.ellipse(s.x, s.y, msg.r * 2, msg.r, 0xffe08a, 0.4).setDepth(s.y + 2).setScale(0.2);
            this.tweens.add({ targets: bolt, alpha: 0, scaleX: 0.2, duration: 250, onComplete: () => bolt.destroy() });
            this.tweens.add({ targets: ring, scale: 1.1, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
            this.cameras.main.shake(180, 0.006);
            this.sfx.zap();
            break;
          }
          case "prayer": {
            const ring = this.add.ellipse(s.x, s.y, msg.r, msg.r / 2, 0xffe8b0, 0)
              .setStrokeStyle(2, 0xffe8b0, 0.8).setDepth(s.y + 2).setScale(0.3);
            this.tweens.add({ targets: ring, scale: 2, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
            this.sfx.shrine();
            break;
          }
          case "curse": {
            const ring = this.add.ellipse(s.x, s.y, msg.r * 2, msg.r, 0x8a2a4a, 0.3)
              .setStrokeStyle(2, 0xb04a6a, 0.9).setDepth(s.y + 2).setScale(0.2);
            this.tweens.add({ targets: ring, scale: 1.1, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
            this.sfx.novaWarn();
            break;
          }
          case "poison": {
            const nova = this.add.ellipse(s.x, s.y, msg.r * 2, msg.r, 0x5fae3f, 0.4).setDepth(s.y + 2).setScale(0.2);
            this.tweens.add({ targets: nova, scale: 1.15, alpha: 0, duration: 500, onComplete: () => nova.destroy() });
            this.sfx.squelch();
            break;
          }
          case "raise": {
            const puff = this.add.circle(s.x, s.y - 6, 12, 0xd8d4c0, 0.7).setDepth(s.y + 2);
            this.tweens.add({ targets: puff, scale: 2, alpha: 0, duration: 450, onComplete: () => puff.destroy() });
            this.sfx.squelch();
            break;
          }
          case "volcano": {
            const blast = this.add.ellipse(s.x, s.y, msg.r * 2, msg.r, 0xff7a20, 0.65).setDepth(s.y + 2).setScale(0.2);
            this.tweens.add({ targets: blast, scale: 1.2, alpha: 0, duration: 480, onComplete: () => blast.destroy() });
            for (let i = 0; i < 6; i++) {
              const rock = this.add.circle(s.x, s.y - 4, 2.5, 0x6a4a2c).setDepth(950_000);
              this.tweens.add({
                targets: rock,
                x: s.x + (Math.random() * 2 - 1) * msg.r,
                y: s.y - 40 - Math.random() * 40,
                alpha: 0,
                duration: 420,
                ease: "quad.out",
                onComplete: () => rock.destroy(),
              });
            }
            this.cameras.main.shake(200, 0.007);
            this.sfx.fireball();
            break;
          }
          case "hurricane": {
            // the storm rides its druid: a spinning ring attached to the player
            const carrier = this.players.get(msg.follow ?? "");
            if (!carrier) break;
            const ring = this.add.ellipse(0, -6, msg.r * 2, msg.r, 0x8ad0ff, 0.12)
              .setStrokeStyle(2, 0xcdefff, 0.5);
            carrier.container.add(ring);
            const spin = this.tweens.add({ targets: ring, rotation: Math.PI * 2, duration: 900, repeat: -1 });
            this.time.delayedCall(msg.ms ?? 6000, () => {
              spin.remove();
              ring.destroy();
            });
            this.sfx.ice();
            break;
          }
          case "wolf": {
            const burst = this.add.circle(s.x, s.y - 10, 14, 0x8a7a5a, 0.6).setDepth(s.y + 2);
            this.tweens.add({ targets: burst, scale: 2.2, alpha: 0, duration: 400, onComplete: () => burst.destroy() });
            this.sfx.roar();
            break;
          }
        }
      });
      room.onMessage("aegisfx", (msg: any) => {
        const ent = this.players.get(msg.id);
        if (ent) {
          const shield = this.add.circle(ent.container.x, ent.container.y - 14, 18, 0x8ad0ff, 0)
            .setStrokeStyle(3, 0xcdefff, 0.95)
            .setDepth(ent.container.depth + 1);
          this.tweens.add({ targets: shield, scale: 1.6, alpha: 0, duration: 350, onComplete: () => shield.destroy() });
          this.floatText(msg.x, msg.y, "BLOCKED", "#8ad0ff");
        }
        if (msg.id === this.room?.sessionId) this.sfx.shrine();
      });
      room.onMessage("deathlessfx", (msg: any) => {
        const ent = this.players.get(msg.id);
        if (ent) {
          const halo = this.add.circle(ent.container.x, ent.container.y - 16, 12, 0xffd54a, 0)
            .setStrokeStyle(4, 0xffe8a0, 1)
            .setDepth(ent.container.depth + 1);
          this.tweens.add({ targets: halo, scale: 3.4, alpha: 0, duration: 700, onComplete: () => halo.destroy() });
          this.floatText(msg.x, msg.y, "UNDYING", "#ffe8a0");
        }
        if (msg.id === this.room?.sessionId) {
          this.cameras.main.flash(400, 120, 100, 30);
          this.sfx.levelup();
        }
      });
      room.onMessage("culledfx", (msg: any) => {
        this.floatText(msg.x, msg.y, "CULLED", "#e05050");
        const s = worldToScreen(msg.x, msg.y);
        const slash = this.add.rectangle(s.x, s.y - 10, 24, 2.5, 0xff6a6a, 0.95).setRotation(-0.6).setDepth(950_000);
        this.tweens.add({ targets: slash, scaleX: 1.6, alpha: 0, duration: 220, onComplete: () => slash.destroy() });
        this.sfx.crit();
      });
      room.onMessage("mswing", (msg: any) => {
        // the monster lunges at its victim — a quick jab toward the target
        const ent = this.monsters.get(msg.id);
        if (!ent?.figure || !ent.schema) return;
        const from = worldToScreen(ent.schema.x, ent.schema.y);
        const to = worldToScreen(msg.tx, msg.ty);
        const d = Math.hypot(to.x - from.x, to.y - from.y) || 1;
        const jx = ((to.x - from.x) / d) * 7;
        const jy = ((to.y - from.y) / d) * 7;
        this.tweens.add({
          targets: ent.figure,
          x: jx,
          y: jy,
          duration: 90,
          yoyo: true,
          ease: "quad.out",
          onComplete: () => {
            if (ent.figure) {
              ent.figure.x = 0;
            }
          },
        });
      });
      room.onMessage("manaheal", (msg: any) => {
        this.floatText(msg.x, msg.y, `+${msg.amount} mana`, "#6a9aef");
        if (msg.id === this.room?.sessionId) this.sfx.gulp();
      });
      room.onMessage("bountydone", (msg: any) => {
        this.floatText(msg.x, msg.y, "BOUNTY COMPLETE!", "#ffd54a");
        const toast = this.add
          .text(this.scale.width / 2, 96, `Bounty complete: ${msg.text}`, {
            fontFamily: "monospace", fontSize: "15px", color: "#ffd54a", fontStyle: "bold",
            backgroundColor: "#12101acc", padding: { x: 10, y: 6 },
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(2_000_000)
          .setAlpha(0);
        this.tweens.add({ targets: toast, alpha: 1, duration: 300, yoyo: true, hold: 2600, onComplete: () => toast.destroy() });
        this.sfx.levelup();
      });
      room.onMessage("quests", (msg: any) => {
        this.ui?.setQuests(msg.list ?? []);
      });
      room.send("getquests", {}); // the join-time copy raced our handler registration
      room.onMessage("openshop", (msg: any) => {
        this.ui?.openShop(msg.health ?? 40, msg.mana ?? 60);
        this.sfx.pickup?.();
      });
      room.onMessage("shopbought", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        const n = msg.count ?? 1;
        if (me) {
          this.floatText(me.schema.x, me.schema.y, `+${n} ${msg.kind === "mana" ? "mana" : "health"} flask${n > 1 ? "s" : ""}`, msg.kind === "mana" ? "#6a9aef" : "#e05858");
        }
        this.sfx.gulp?.();
        this.ui?.refreshShop();
      });
      room.onMessage("ping", (msg: any) => {
        // an expanding pulse in the world, a note of who called it
        const s = worldToScreen(msg.x, msg.y);
        const ring1 = this.add.ellipse(s.x, s.y, 14, 7, 0xffd54a, 0).setStrokeStyle(2.5, 0xffd54a, 0.95).setDepth(s.y + 40);
        const ring2 = this.add.ellipse(s.x, s.y, 8, 4, 0xffd54a, 0.25).setDepth(s.y + 39);
        const who = this.add
          .text(s.x, s.y - 30, msg.name ?? "", { fontFamily: "monospace", fontSize: "10px", color: "#ffd54a", backgroundColor: "#0c0a12bb", padding: { x: 3, y: 1 } })
          .setOrigin(0.5)
          .setDepth(s.y + 41);
        this.tweens.add({ targets: [ring1, ring2], scaleX: 4.5, scaleY: 4.5, alpha: 0, duration: 900, ease: "quad.out", onComplete: () => { ring1.destroy(); ring2.destroy(); } });
        this.tweens.add({ targets: who, alpha: 0, y: "-=12", duration: 1400, onComplete: () => who.destroy() });
        this.gs_lastPing = { x: msg.x, y: msg.y, at: this.time.now };
        this.sfx.pickup();
      });
      room.onMessage("announce", (msg: any) => {
        this.ui?.addSystemLine(msg.text ?? "");
      });
      room.onMessage("mercshot", (msg: any) => {
        const ent = this.mercs.get(msg.id);
        if (!ent) return;
        const from = { x: ent.container.x, y: ent.container.y - 14 };
        const to = worldToScreen(msg.tx, msg.ty);
        const color = msg.element === "fire" ? 0xff7030 : msg.element === "cold" ? 0x8ad0ff : msg.element === "light" ? 0xc8b4ff : 0xe8d9a0;
        const depth = Math.max(from.y, to.y) + 30;
        if (msg.kind === "bolt") {
          // a mage's missile: a glowing mote with a soft halo
          const halo = this.add.circle(from.x, from.y, 6, color, 0.3).setDepth(depth);
          const orb = this.add.circle(from.x, from.y, 3.2, color).setStrokeStyle(1, 0xffffff, 0.5).setDepth(depth);
          this.tweens.add({
            targets: [orb, halo], x: to.x, y: to.y - 14, duration: 170, ease: "linear",
            onComplete: () => { orb.destroy(); halo.destroy(); },
          });
          if (msg.element === "fire") this.sfx.fireball();
          else if (msg.element === "light") this.sfx.zap();
          else this.sfx.arrow();
        } else {
          const arrow = this.add.rectangle(from.x, from.y, 12, 2, color).setDepth(depth);
          arrow.setRotation(Math.atan2(to.y - 14 - from.y, to.x - from.x));
          this.tweens.add({
            targets: arrow, x: to.x, y: to.y - 14, duration: 140, ease: "linear",
            onComplete: () => arrow.destroy(),
          });
          this.sfx.arrow();
        }
      });
      room.onMessage("mercmelee", (msg: any) => {
        const ent = this.mercs.get(msg.id);
        if (!ent) return;
        const to = worldToScreen(msg.tx, msg.ty);
        // lunge the fighter toward the blow, then settle back
        if (ent.figure) {
          const dx = Phaser.Math.Clamp((to.x - ent.container.x) * 0.12, -10, 10);
          const dy = Phaser.Math.Clamp((to.y - 14 - (ent.container.y - 14)) * 0.12, -8, 8);
          this.tweens.add({ targets: ent.figure, x: dx, y: dy, duration: 90, yoyo: true, ease: "quad.out" });
        }
        // a slash where the steel lands
        const color = msg.element === "fire" ? 0xff7030 : msg.element === "cold" ? 0x8ad0ff : msg.element === "light" ? 0xffe8a0 : 0xdadade;
        const slash = this.add.arc(to.x, to.y - 14, 13, -60, 60, false, 0x000000, 0).setStrokeStyle(3, color, 0.9).setDepth(to.y + 30);
        slash.setRotation(Math.atan2(to.y - 14 - (ent.container.y - 14), to.x - ent.container.x));
        this.tweens.add({ targets: slash, alpha: 0, scale: 1.3, duration: 160, onComplete: () => slash.destroy() });
        this.sfx.swing();
      });
      room.onMessage("merchired", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) this.floatText(me.schema.x, me.schema.y, msg.revived ? `${msg.name} stands again` : `${msg.name} joins you`, "#8fbf9f");
        this.sfx.levelup();
      });
      room.onMessage("mercdead", (msg: any) => {
        const toast = this.add
          .text(this.scale.width / 2, this.scale.height * 0.3, `${msg.name} has fallen — raise them at their hall, for a price`, {
            fontFamily: "monospace", fontSize: "15px", color: "#c05050", fontStyle: "italic",
            backgroundColor: "#0c0a12cc", padding: { x: 12, y: 6 },
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(2_000_000)
          .setAlpha(0);
        this.tweens.add({ targets: toast, alpha: 1, duration: 300, yoyo: true, hold: 3200, onComplete: () => toast.destroy() });
        this.sfx.descend();
      });
      room.onMessage("openmercs", (msg: any) => {
        this.ui?.openMercHire(msg);
      });
      // the trade ring: invitations, live offers, the handshake
      room.onMessage("tradeinvite", (msg: any) => {
        this.ui?.showTradeInvite(msg.from ?? "", msg.name ?? "someone");
      });
      room.onMessage("tradeopen", (msg: any) => {
        this.ui?.openTrade(msg.name ?? "partner");
      });
      room.onMessage("tradeupdate", (msg: any) => {
        this.ui?.updateTrade(msg);
      });
      room.onMessage("tradedone", (msg: any) => {
        this.ui?.closeTrade();
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) {
          const got = (msg.items ?? []).length;
          const gold = msg.gold ?? 0;
          const parts = [got ? `${got} item${got > 1 ? "s" : ""}` : "", gold ? `${gold}g` : ""].filter(Boolean);
          this.floatText(me.schema.x, me.schema.y, `🤝 deal struck${parts.length ? ` — ${parts.join(" + ")}` : ""}`, "#d8b13a");
        }
        this.sfx.pickup();
      });
      room.onMessage("tradefail", (msg: any) => {
        this.ui?.tradeNote(msg.reason ?? "the deal fell through");
      });
      room.onMessage("tradeclosed", (msg: any) => {
        this.ui?.closeTrade();
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) this.floatText(me.schema.x, me.schema.y, `trade ${msg.reason ?? "closed"}`, "#8a8a96");
      });
      room.onMessage("tradehint", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) this.floatText(me.schema.x, me.schema.y, msg.text ?? "", "#8a8a96");
      });
      room.onMessage("mercloadout", (msg: any) => {
        this.ui?.setMercLoadout(msg.merc ?? null);
      });
      room.send("getmercloadout", {}); // join-time copy races handler registration, as ever
      room.onMessage("grave", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        const stone = this.add.container(s.x, s.y).setDepth(s.y - 1);
        const mound = this.add.ellipse(0, 1, 22, 9, 0x2a2622, 0.9);
        const slab = this.add.rectangle(0, -8, 12, 14, 0x5a5a64).setStrokeStyle(1, 0x33333c);
        const top = this.add.ellipse(0, -15, 12, 8, 0x5a5a64).setStrokeStyle(1, 0x33333c);
        const etch = this.add.rectangle(0, -8, 6, 1.5, 0x3a3a44);
        const etch2 = this.add.rectangle(0, -5, 6, 1.5, 0x3a3a44);
        const name = this.add
          .text(0, -26, `✝ ${msg.name}`, { fontFamily: "monospace", fontSize: "9px", color: "#8a8a96", backgroundColor: "#0c0a12aa", padding: { x: 3, y: 1 } })
          .setOrigin(0.5);
        stone.add([mound, top, slab, etch, etch2, name]);
        this.mapTiles.push(stone); // the graveyard resets with the floor
      });
      room.onMessage("hardcoredeath", (msg: any) => {
        // the epitaph: a full-screen farewell, then back to the lobby
        const w = this.scale.width;
        const hgt = this.scale.height;
        const shade = this.add.rectangle(w / 2, hgt / 2, w * 2, hgt * 2, 0x050508, 0.88).setScrollFactor(0).setDepth(3_000_000);
        const t1 = this.add.text(w / 2, hgt * 0.32, "YOU HAVE FALLEN", { fontFamily: "monospace", fontSize: "44px", color: "#b03030", fontStyle: "bold" }).setOrigin(0.5).setScrollFactor(0).setDepth(3_000_001);
        const t2 = this.add.text(w / 2, hgt * 0.44, `${msg.name} the ${msg.cls} — level ${msg.level}`, { fontFamily: "monospace", fontSize: "18px", color: "#c9c9d4" }).setOrigin(0.5).setScrollFactor(0).setDepth(3_000_001);
        const t3 = this.add.text(w / 2, hgt * 0.51, `slain by ${msg.by} in ${msg.where ?? "the dark"}`, { fontFamily: "monospace", fontSize: "13px", color: "#8a5050", fontStyle: "italic" }).setOrigin(0.5).setScrollFactor(0).setDepth(3_000_001);
        const t4 = this.add.text(w / 2, hgt * 0.62, "this hero is gone forever — their name enters the Hall of Legends", { fontFamily: "monospace", fontSize: "12px", color: "#6a6a76" }).setOrigin(0.5).setScrollFactor(0).setDepth(3_000_001);
        const t5 = this.add.text(w / 2, hgt * 0.74, "returning to Hollowmere…", { fontFamily: "monospace", fontSize: "11px", color: "#54402a" }).setOrigin(0.5).setScrollFactor(0).setDepth(3_000_001);
        [shade, t1, t2, t3, t4, t5].forEach((o) => o.setAlpha(0));
        this.tweens.add({ targets: [shade, t1, t2, t3, t4, t5], alpha: 1, duration: 1200, ease: "quad.out" });
        this.cameras.main.shake(600, 0.012);
        this.sfx.descend();
        this.time.delayedCall(7000, () => {
          this.room?.leave();
          location.reload();
        });
      });
      room.onMessage("shopfail", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) {
          const text = msg.reason === "full" ? "belt is full" : msg.reason === "bag" ? "bag is full" : "not enough gold";
          this.floatText(me.schema.x, me.schema.y, text, "#c9c9d4");
        }
      });
      room.onMessage("openvendor", (msg: any) => {
        this.ui?.openVendorShop(msg.items ?? []);
      });
      room.onMessage("vendorbought", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) this.floatText(me.schema.x, me.schema.y, msg.name, rarityColorStr(msg.rarity));
        this.sfx.pickup();
      });
      room.onMessage("opengamble", (msg: any) => {
        this.ui?.openGamble(msg.items ?? []);
      });
      room.onMessage("opensmith", (msg: any) => {
        this.ui?.openSmith(msg.items ?? []);
      });
      room.onMessage("openaltar", (msg: any) => {
        this.ui?.openAltar(msg ?? {});
      });
      room.onMessage("reforged", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) this.floatText(me.schema.x, me.schema.y, `reforged: ${msg.name} (-${msg.cost}g)`, rarityColorStr(msg.rarity));
        this.sfx.drop(msg.rarity);
      });
      room.onMessage("reforgefail", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) this.floatText(me.schema.x, me.schema.y, `need ${msg.cost}g to reforge`, "#e05050");
      });
      room.onMessage("reforgefx", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        const ring = this.add.circle(s.x, s.y - 10, 10, 0xc88ad8, 0.7).setDepth(s.y + 3);
        this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
        this.sfx.shrine();
      });
      room.onMessage("socketpunched", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) this.floatText(me.schema.x, me.schema.y, `${msg.name}: ◈${msg.sockets} punched (-${msg.cost}g)`, "#ffb066");
        this.sfx.pickup();
      });
      room.onMessage("unsocketed", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) {
          const tail = msg.dropped ? ` (${msg.dropped} dropped — bag full)` : "";
          this.floatText(me.schema.x, me.schema.y, `${msg.name}: ${msg.count} stones recovered${tail}`, "#c88ad8");
        }
        this.sfx.pickup();
      });
      room.onMessage("smithfail", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) this.floatText(me.schema.x, me.schema.y, `need ${msg.cost}g for the forge`, "#e05050");
      });
      room.onMessage("gambled", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) {
          // the beam-colored tease: tier shown, truth withheld
          this.floatText(me.schema.x, me.schema.y, msg.unidentified ? `${msg.name}… (${msg.rarity})` : msg.name, rarityColorStr(msg.rarity));
        }
        this.sfx.drop(msg.rarity);
      });
      room.onMessage("questdone", (msg: any) => {
        const toast = this.add
          .text(this.scale.width / 2, 128, `QUEST COMPLETE: ${msg.name}  (+${msg.gold}g, +${msg.xp}xp)`, {
            fontFamily: "monospace", fontSize: "15px", color: "#8ad07f", fontStyle: "bold",
            backgroundColor: "#12101acc", padding: { x: 10, y: 6 },
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(2_000_000)
          .setAlpha(0);
        this.tweens.add({ targets: toast, alpha: 1, duration: 300, yoyo: true, hold: 3000, onComplete: () => toast.destroy() });
        this.sfx.levelup();
      });
      room.onMessage("pilgrim", () => {
        const toast = this.add
          .text(this.scale.width / 2, this.scale.height * 0.3, "A dark presence walks this floor…", {
            fontFamily: "monospace", fontSize: "17px", color: "#c05050", fontStyle: "italic",
            backgroundColor: "#0c0a12cc", padding: { x: 12, y: 6 },
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(2_000_000)
          .setAlpha(0);
        this.tweens.add({ targets: toast, alpha: 1, duration: 800, yoyo: true, hold: 2800, onComplete: () => toast.destroy() });
        this.sfx.roar();
      });
      room.onMessage("wandererdead", (msg: any) => {
        this.floatText(msg.x, msg.y, "The dark presence fades…", "#c08a8a");
        this.sfx.drop("epic");
      });
      room.onMessage("cowopen", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        const ring = this.add.circle(s.x, s.y - 8, 16, 0xd83a3a, 0.6).setDepth(s.y + 2);
        this.tweens.add({ targets: ring, scale: 2.6, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
        const toast = this.add
          .text(this.scale.width / 2, this.scale.height * 0.3, "A portal tears open… you hear distant mooing.", {
            fontFamily: "monospace", fontSize: "16px", color: "#e05050", fontStyle: "italic",
            backgroundColor: "#0c0a12cc", padding: { x: 12, y: 6 },
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(2_000_000)
          .setAlpha(0);
        this.tweens.add({ targets: toast, alpha: 1, duration: 500, yoyo: true, hold: 3000, onComplete: () => toast.destroy() });
        this.sfx.portalOpen();
        this.sfx.roar();
      });
      room.onMessage("golddrop", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) this.floatText(me.schema.x, me.schema.y - 10, `your purse tears — ${msg.amount}g scatters!`, "#d8b13a");
      });
      room.onMessage("identified", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) {
          this.floatText(me.schema.x, me.schema.y, `${msg.name}!`, rarityColorStr(msg.rarity));
          if (msg.cost > 0) this.floatText(me.schema.x, me.schema.y + 20, `-${msg.cost}g`, "#8a8a96");
        }
        this.sfx.drop(msg.rarity); // the reveal deserves the drop fanfare
      });
      room.onMessage("identifyfail", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) this.floatText(me.schema.x, me.schema.y, `Need ${msg.cost} gold to identify`, "#ff5544");
      });
      room.onMessage("waypointfx", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        const ring = this.add.circle(s.x, s.y - 8, 18, 0x6a8cff, 0.5).setDepth(s.y + 2);
        this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
        this.floatText(msg.x, msg.y, "the world folds — the party travels", "#8ab0ff");
        this.sfx.portalOpen();
      });
      room.onMessage("waypoints", (msg: any) => {
        this.ui?.openWaypoints(msg);
      });
      room.onMessage("stairslocked", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) this.floatText(me.schema.x, me.schema.y, msg.text ?? "the way is sealed", "#c08a4a");
      });
      room.onMessage("transmutefx", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        const burst = this.add.circle(s.x, s.y - 12, 16, 0xd8b13a, 0.7).setDepth(s.y + 2);
        this.tweens.add({ targets: burst, scale: 2.2, alpha: 0, duration: 500, onComplete: () => burst.destroy() });
        this.sfx.shrine();
      });
      room.onMessage("transmuted", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) this.floatText(me.schema.x, me.schema.y, `${msg.recipe} → ${msg.result}`, "#ffd54a");
      });
      room.onMessage("transmutehint", () => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) this.floatText(me.schema.x, me.schema.y, "the altar wants 3 identical runes, or 3 magic items", "#8a8a96");
      });
      room.onMessage("victory", (msg: any) => {
        this.cameras.main.flash(600, 120, 40, 20);
        this.cameras.main.shake(500, 0.008);
        const banner = this.add
          .text(this.scale.width / 2, this.scale.height * 0.35, "THE LORD OF TERROR IS VANQUISHED", {
            fontFamily: "monospace", fontSize: "30px", color: "#ffd54a", fontStyle: "bold",
            stroke: "#3a1010", strokeThickness: 6,
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(2_000_000)
          .setAlpha(0);
        const sub = this.add
          .text(this.scale.width / 2, this.scale.height * 0.35 + 40, `the Unmaker is unmade — the Endless Abyss lies open`, {
            fontFamily: "monospace", fontSize: "13px", color: "#c9a86a", fontStyle: "italic",
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(2_000_000)
          .setAlpha(0);
        this.tweens.add({ targets: [banner, sub], alpha: 1, duration: 600, yoyo: true, hold: 4200, onComplete: () => { banner.destroy(); sub.destroy(); } });
        this.sfx.levelup();
        this.sfx.roar();
      });
      room.onMessage("skilllearned", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) this.floatText(me.schema.x, me.schema.y, `${msg.name} rank ${msg.rank}`, "#9fdc9f");
        this.sfx.shrine();
      });
      room.onMessage("respecdone", (msg: any) => {
        const me = this.players.get(this.room?.sessionId ?? "");
        if (me) this.floatText(me.schema.x, me.schema.y, `respec — ${msg.skillPoints} skill, ${msg.statPoints} stat points returned`, "#ffd54a");
        this.sfx.shrine();
      });
      room.onMessage("warcryfx", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        const ring = this.add
          .ellipse(s.x, s.y, msg.r * 2, msg.r, 0xffc060, 0.25)
          .setStrokeStyle(3, 0xffe0a0, 0.9)
          .setDepth(s.y + 2)
          .setScale(0.2);
        this.tweens.add({ targets: ring, scale: 1.15, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
        this.cameras.main.shake(120, 0.004);
        this.sfx.shout();
      });
      room.onMessage("ancientsfx", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        for (let i = 0; i < 3; i++) {
          const ring = this.add
            .ellipse(s.x, s.y, msg.r * 2, msg.r, 0xffb060, 0.3 - i * 0.08)
            .setStrokeStyle(3, 0xffd0a0, 0.9)
            .setDepth(s.y + 2)
            .setScale(0.15 + i * 0.1);
          this.tweens.add({
            targets: ring, scale: 1.2, alpha: 0, duration: 450 + i * 130, delay: i * 90,
            onComplete: () => ring.destroy(),
          });
        }
        this.cameras.main.shake(320, 0.011);
        this.sfx.whirl();
        this.sfx.hit();
      });
      room.onMessage("vengeancefx", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        for (let w = 0; w < (msg.waves ?? 3); w++) {
          this.time.delayedCall(w * (msg.waveMs ?? 500), () => {
            for (let i = 0; i < 9; i++) {
              const ox = (Math.random() * 2 - 1) * msg.r * 0.9;
              const oy = (Math.random() * 2 - 1) * msg.r * 0.45;
              const arrow = this.add
                .rectangle(s.x + ox, s.y + oy - 90, 2, 14, 0xfff4d0, 0.95)
                .setDepth(950_000);
              this.tweens.add({
                targets: arrow, y: s.y + oy, alpha: 0.2, duration: 190, ease: "quad.in",
                onComplete: () => arrow.destroy(),
              });
            }
            this.sfx.arrow();
          });
        }
      });
      room.onMessage("firewallfx", (msg: any) => {
        const a = worldToScreen(msg.ax, msg.ay);
        const b = worldToScreen(msg.bx, msg.by);
        const flames: Phaser.GameObjects.GameObject[] = [];
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          const fx = a.x + (b.x - a.x) * t;
          const fy = a.y + (b.y - a.y) * t;
          const flame = this.add
            .ellipse(fx, fy - 6, 10 + Math.random() * 8, 16 + Math.random() * 10, 0xff7020, 0.75)
            .setDepth(fy + 4);
          flames.push(flame);
          this.tweens.add({
            targets: flame, scaleY: 1.35, scaleX: 0.85, alpha: 0.5,
            duration: 220 + Math.random() * 160, yoyo: true, repeat: Math.floor(msg.ms / 400),
          });
        }
        this.time.delayedCall(msg.ms, () => flames.forEach((f) => f.destroy()));
        this.sfx.fireball();
      });
      room.onMessage("meteorwarn", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        const warn = this.add
          .ellipse(s.x, s.y, msg.r * 2, msg.r, 0xff3020, 0.1)
          .setStrokeStyle(2, 0xff6a40, 0.9)
          .setDepth(s.y - 1);
        this.tweens.add({ targets: warn, alpha: 0.5, duration: 160, yoyo: true, repeat: Math.ceil(msg.ms / 320) });
        this.time.delayedCall(msg.ms, () => warn.destroy());
        this.sfx.novaWarn();
      });
      room.onMessage("chargewarn", (msg: any) => {
        // a charger plants its feet and a red lane flashes where it's about to barrel through
        const s = worldToScreen(msg.x, msg.y);
        const len = 160;
        const end = worldToScreen(msg.x + Math.cos(msg.ang) * len, msg.y + Math.sin(msg.ang) * len);
        const g = this.add.graphics().setDepth(s.y - 1);
        g.lineStyle(5, 0xff2a18, 0.55);
        g.lineBetween(s.x, s.y - 10, end.x, end.y - 10);
        const ah = Math.atan2(end.y - s.y, end.x - s.x);
        const head = this.add.triangle(end.x, end.y - 10, 12, 0, -8, -7, -8, 7, 0xff5030, 0.9).setRotation(ah).setDepth(s.y - 1);
        this.tweens.add({ targets: [g, head], alpha: 0.15, duration: 150, yoyo: true, repeat: Math.ceil(msg.ms / 300) });
        this.time.delayedCall(msg.ms, () => { g.destroy(); head.destroy(); });
        this.sfx.novaWarn();
      });
      room.onMessage("meteorfall", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        const rock = this.add.circle(s.x + 60, s.y - 240, 12, 0xff9040, 1).setDepth(950_000);
        this.tweens.add({
          targets: rock, x: s.x, y: s.y, duration: 160, ease: "quad.in",
          onComplete: () => {
            rock.destroy();
            const blast = this.add.ellipse(s.x, s.y, msg.r * 2, msg.r, 0xff7a20, 0.7).setDepth(s.y + 2).setScale(0.2);
            this.tweens.add({ targets: blast, scale: 1.2, alpha: 0, duration: 480, onComplete: () => blast.destroy() });
            this.cameras.main.shake(300, 0.012);
            this.sfx.fireball();
            this.sfx.hit();
          },
        });
      });
      room.onMessage("goblinspotted", (msg: any) => {
        this.floatText(msg.x, msg.y, "A Treasure Goblin!", "#ffd54a");
        this.sfx.drop("rare");
      });
      room.onMessage("goblinescape", (msg: any) => {
        const s = worldToScreen(msg.x, msg.y);
        const portal = this.add.circle(s.x, s.y - 10, 16, 0x9a5ae8, 0.7).setDepth(s.y + 2);
        this.tweens.add({ targets: portal, scale: 2.2, alpha: 0, duration: 450, onComplete: () => portal.destroy() });
        this.floatText(msg.x, msg.y, "The goblin escapes!", "#b48ae8");
        this.sfx.teleport();
      });

      room.onLeave(() => (this.connectionStatus = "disconnected — refresh to rejoin"));
    } catch (err) {
      console.error("[client] connection failed", err);
      document.getElementById("arpg-loading")?.remove();
      this.connectionStatus = `connection failed — is the server reachable at ${SERVER_WS}?`;
    }
  }

  // --- map ---

  private rebuildMap(data: string) {
    if (!data) return;
    const rows = data.split("\n");
    this.clientMap = makeMap(rows);

    this.decorTweens.forEach((t) => t.remove());
    this.decorTweens = [];
    this.mapTiles.forEach((t) => t.destroy());
    this.mapTiles = [];
    this.cutaways = []; // roof objects live in mapTiles; just drop the tracking list
    this.corpses.forEach((c) => c.destroy());
    this.corpses = [];
    this.stairsFx?.destroy();
    this.gore.forEach((g) => g.destroy()); // a new floor starts clean (briefly)
    this.gore = [];

    const rmAct = this.room?.state.act ?? 1;
    const rmFloor = this.room?.state.floor ?? 1;
    const themeIdx = visualThemeFor(rmAct, rmFloor);
    this.ensureThemeTextures(themeIdx);
    this.atmosphere?.applyTheme(themeIdx);
    const rmCreep = Math.max(0, Math.min(1, (dangerFor(rmAct, rmFloor) - 1) / 27));
    this.sfx.setAmbient(themeIdx, rmCreep);
    // updateAmbientLocation only overrides these when you cross the town boundary
    this.lastAmbientTheme = themeIdx;
    this.lastCreep = rmCreep;

    // deterministic per-tile randomness so decor doesn't reshuffle
    const hash = (tx: number, ty: number, salt: number) => {
      const v = Math.sin(tx * 127.1 + ty * 311.7 + salt * 74.7) * 43758.5453;
      return v - Math.floor(v);
    };

    const actNum = this.room?.state.act ?? 1;
    const floorNum = this.room?.state.floor ?? 1;
    const isForest = floorNum === 1 && actNum < ABYSS_ACT; // the world above: trees instead of walls
    const stc: any = this.room?.state;
    const cath =
      stc && stc.cathedralX >= 0
        ? { x: stc.cathedralX as number, y: stc.cathedralY as number, w: stc.cathedralW as number, h: stc.cathedralH as number }
        : null;
    if (isForest) {
      this.ensureThemeTextures(0); // the cathedral & tower wear stone, not leaves
      this.ensureThemeTextures(2); // and the caves wear earth
      this.ensureThemeTextures(actNum === 2 ? 11 : actNum === 3 ? 13 : actNum === 4 ? 3 : 2); // each act's hollows wear their own
    }
    const inCathedral = (tx: number, ty: number) =>
      !!cath && tx >= cath.x && tx < cath.x + cath.w && ty >= cath.y && ty < cath.y + cath.h;
    // tower/cave interiors (and the tower's footprint in the field)
    let areas: Array<{ kind: string; x: number; y: number; w: number; h: number }> = [];
    try {
      areas = stc?.areasData ? JSON.parse(stc.areasData) : [];
    } catch {
      areas = [];
    }
    const areaAt = (tx: number, ty: number) =>
      areas.find((a) => tx >= a.x && tx < a.x + a.w && ty >= a.y && ty < a.y + a.h);
    const buildingAt = (tx: number, ty: number) =>
      ty < TOWN_ROWS ? TOWN_BUILDINGS.find((b) => tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) : undefined;

    const map = this.clientMap;
    this.fogTiles = [];
    for (let ty = 0; ty < map.h; ty++) {
      for (let tx = 0; tx < map.w; tx++) {
        const s = worldToScreen((tx + 0.5) * TILE, (ty + 0.5) * TILE);
        const area = isForest ? areaAt(tx, ty) : undefined;
        const interior = area && area.kind !== "towerbase" ? area : undefined;
        // interiors trade the forest palette for stone (tower) or earth (cave)
        const floorTheme = interior ? (interior.kind === "tower" ? 0 : 2) : themeIdx;
        if (tileAt(map, tx, ty) === 0) {
          this.mapTiles.push(
            this.add
              .image(s.x, s.y, (tx + ty) % 2 === 0 ? `floor0_t${floorTheme}` : `floor1_t${floorTheme}`)
              .setDepth(-1_000_000 + s.y)
          );
          this.fogTiles.push({ tx, ty, x: s.x, y: s.y });
          // no wild grass indoors — the plank floor is laid over these tiles
          if (!interior && !buildingAt(tx, ty)?.enterable) this.addFloorDressing(tx, ty, s.x, s.y, themeIdx, hash);
        } else {
          // only draw walls that touch a floor tile — the void stays dark
          let nearFloor = false;
          for (let oy = -1; oy <= 1 && !nearFloor; oy++)
            for (let ox = -1; ox <= 1 && !nearFloor; ox++)
              if (tileAt(map, tx + ox, ty + oy) === 0) nearFloor = true;
          if (!nearFloor) continue;
          this.fogTiles.push({ tx, ty, x: s.x, y: s.y });
          // town buildings are drawn whole (roofs, signs, smoke) after the loop,
          // and so is the watchtower standing in the field
          if (buildingAt(tx, ty) || area?.kind === "towerbase") {
            // ground first — buildings and the tower stand ON something (the well showed the void)
            this.mapTiles.push(
              this.add
                .image(s.x, s.y, (tx + ty) % 2 === 0 ? `floor0_t${themeIdx}` : `floor1_t${themeIdx}`)
                .setDepth(-1_000_000 + s.y)
            );
            continue;
          }
          // the forest: every blocking tile outside stone walls is a tree — on grass
          if (isForest && ty >= TOWN_ROWS && !inCathedral(tx, ty) && !interior) {
            this.mapTiles.push(
              this.add
                .image(s.x, s.y, (tx + ty) % 2 === 0 ? `floor0_t${themeIdx}` : `floor1_t${themeIdx}`)
                .setDepth(-1_000_000 + s.y)
            );
            this.addTree(tx, ty, s.x, s.y, hash);
            continue;
          }
          const caveTheme = actNum === 2 ? 11 : actNum === 3 ? 13 : actNum === 4 ? 3 : 2;
          const wallTheme = isForest ? (interior && interior.kind === "cave" ? caveTheme : 0) : themeIdx;
          const texH = TILE_H + WALL_H;
          this.mapTiles.push(
            this.add
              .image(s.x, s.y, `wall_t${wallTheme}`)
              .setOrigin(0.5, (HALF_H + WALL_H) / texH)
              .setDepth(s.y + 0.1)
          );
          // torches on walls whose front face borders open floor (caves stay dark)
          const torchOk = !isForest || inCathedral(tx, ty) || interior?.kind === "tower";
          if (tileAt(map, tx, ty + 1) === 0 && hash(tx, ty, 7) < 0.13 && torchOk) {
            this.addTorch(s.x - 10, s.y - WALL_H * 0.35, s.y);
          }
        }
      }
    }

    this.towerFade = undefined; // the old tower died with mapTiles
    // the watchtower rises over the wood
    for (const a of areas) {
      if (a.kind === "towerbase") this.drawTower(a);
    }

    // the settlement: roofs, smoke, the well, the forge, the tavern's warm windows
    this.drawTownBuildings();
    this.addVillagers(hash);
    if (isForest && actNum === 1) this.addCritters();
    // the gate out of town — flanked by braziers so you can't miss the way to the war
    // (underground the camp is sealed: no gate, no braziers)
    if (isForest) {
      const gateS = worldToScreen((TOWN_GATE_TX + 0.5) * TILE, (TOWN_ROWS + 0.2) * TILE);
      this.addTorch(gateS.x - 26, gateS.y - 14, gateS.y);
      this.addTorch(gateS.x + 26, gateS.y - 14, gateS.y);
    }

    // the cathedral facade: a doorway that promises nothing good
    if (cath) this.drawCathedralFacade(cath);

    // town furnishings (same spot every floor): campfire + banner
    const fireS = worldToScreen(TOWN.campfire.x, TOWN.campfire.y);
    const fireGlow = this.add.ellipse(fireS.x, fireS.y, 44, 20, 0xff8830, 0.16).setDepth(fireS.y - 1);
    const fire = this.add.circle(fireS.x, fireS.y - 6, 5, 0xffaa40).setDepth(fireS.y);
    this.tweens.add({ targets: [fire, fireGlow], alpha: 0.55, duration: 260, yoyo: true, repeat: -1 });
    const banner = this.add
      .text(fireS.x, fireS.y - 58, `· ${(ACTS[(this.room?.state.act ?? 1) - 1]?.townName ?? "HOLLOWMERE")} ·`, { fontFamily: "monospace", fontSize: "12px", color: "#8a8a96" })
      .setOrigin(0.5)
      .setDepth(fireS.y + 1);
    this.mapTiles.push(fireGlow, fire, banner);

    // fresh fog for the new floor
    this.explored = new Uint8Array(map.w * map.h);
    this.exploredRev++;
    this.fogG?.destroy();
    this.fogG = this.add.graphics().setDepth(850_000);
    this.fogDirty = true;
    this.lastRevealAt = 0;

    // stairs down — pulsing purple portal; DESCENDING IS A CLICK, not an accident
    this.pendingStairs = false;
    const st = this.room?.state;
    if (st) {
      const s = worldToScreen(st.stairsX, st.stairsY);
      const container = this.add.container(s.x, s.y).setDepth(s.y);
      const outer = this.add.polygon(0, 0, [0, -14, 26, 0, 0, 14, -26, 0], 0x5a2a8f, 0.5);
      const inner = this.add.polygon(0, 0, [0, -8, 15, 0, 0, 8, -15, 0], 0x9a5ae8, 0.8);
      const label = this.add
        .text(0, -26, "stairs down (click)", {
          fontFamily: "monospace", fontSize: "10px", color: "#b48ae8",
          backgroundColor: "#0c0c12cc", padding: { x: 3, y: 2 },
        })
        .setOrigin(0.5);
      container.add([outer, inner, label]);
      this.tweens.add({ targets: [outer, inner], alpha: 0.25, duration: 800, yoyo: true, repeat: -1 });
      for (const obj of [outer, label]) {
        obj.setInteractive({ useHandCursor: true });
        obj.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          if (pointer.rightButtonDown()) return; // right-click is for fighting
          this.lootClickAt = this.time.now; // grace: the scene click must not cancel this (THE bug)
          this.pendingStairs = true;
          this.pendingStairsSince = this.time.now;
          this.lastStairsSend = 0;
          this.startAutoWalk(st.stairsX, st.stairsY);
        });
      }
      this.stairsFx = container;
    }

    this.walkPath = null; // a new floor voids old breadcrumbs
    this.applyWeather(this.room?.state.weather ?? "");

    // teleports happened server-side; snap everyone to their new position
    const snap = (ent: Entity) => {
      const s = worldToScreen(ent.schema.x, ent.schema.y);
      ent.container.setPosition(s.x, s.y).setDepth(s.y);
    };
    this.players.forEach(snap);
    this.monsters.forEach(snap);
    this.mercs.forEach((ent) => {
      const s = worldToScreen(ent.schema.x, ent.schema.y);
      ent.container.setPosition(s.x, s.y).setDepth(s.y);
    });
  }

  // torch-light: radial darkness with a clear circle around the hero
  private ensureLightTexture() {
    if (this.textures.exists("lightmask")) return;
    const size = 1024;
    const cv = this.textures.createCanvas("lightmask", size, size);
    if (!cv) return;
    const ctx = cv.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 80, size / 2, size / 2, size * 0.48);
    grad.addColorStop(0, "rgba(8,8,14,0)");
    grad.addColorStop(0.3, "rgba(8,8,14,0.14)");
    grad.addColorStop(0.6, "rgba(8,8,14,0.55)");
    grad.addColorStop(0.9, "rgba(8,8,14,0.84)");
    grad.addColorStop(1, "rgba(8,8,14,0.84)"); // hold to the texture edge — no bright corners
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    cv.refresh();
  }

  // a warm amber torch pool, added over the cold vision mask for firelit coziness
  private ensureTorchTexture() {
    if (this.textures.exists("torchglow")) return;
    const size = 512;
    const cv = this.textures.createCanvas("torchglow", size, size);
    if (!cv) return;
    const ctx = cv.getContext();
    // deliberately faint — additive glow centered on the hero blows him out fast
    const grad = ctx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, size * 0.5);
    grad.addColorStop(0, "rgba(255,196,120,0.14)");
    grad.addColorStop(0.4, "rgba(255,168,86,0.07)");
    grad.addColorStop(0.75, "rgba(212,124,56,0.022)");
    grad.addColorStop(1, "rgba(212,124,56,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    cv.refresh();
  }

  private updateLight() {
    if (!this.lightImg?.visible || !this.room) return;
    const me = this.players.get(this.room.sessionId);
    const cam = this.cameras.main;
    if (me) this.lightImg.setPosition(me.container.x, me.container.y - 10);
    else this.lightImg.setPosition(cam.midPoint.x, cam.midPoint.y);

    // cover the viewport at any zoom; Hollowmere is brighter; flames breathe —
    // and the deeper you go, the closer the darkness leans in
    const base = (Math.max(cam.displayWidth, cam.displayHeight) * 1.55) / 1024;
    const townMult = me && isInTown(me.schema.y) ? 1.5 : 1;
    const band = Math.min(3, (this.room.state.act ?? 1) - 1);
    // the surface sees a grim grey daylight; underground the dark leans in with depth
    const surfaceMult = (this.room.state.floor ?? 1) === 1 && (this.room.state.act ?? 1) < ABYSS_ACT ? 1.35 : 1;
    const depthMult = 1 - band * 0.07;
    this.lightScaleCur += (base * townMult * surfaceMult * depthMult - this.lightScaleCur) * 0.06;
    const flicker = 1 + 0.016 * Math.sin(this.time.now / 132) + 0.007 * Math.sin(this.time.now / 47);
    this.lightImg.setScale(this.lightScaleCur * flicker);

    // the warm torch pool rides with the vision mask, breathing a touch more freely
    if (this.torchGlow) {
      this.torchGlow.setPosition(this.lightImg.x, this.lightImg.y);
      const tFlicker = 1 + 0.05 * Math.sin(this.time.now / 90) + 0.03 * Math.sin(this.time.now / 37);
      this.torchGlow.setScale(((cam.displayWidth * 0.34) / 512) * tFlicker);
    }
  }

  // --- dungeon dressing ---

  private addTorch(x: number, y: number, depthBase: number) {
    const bracket = this.add.rectangle(x, y + 5, 2.5, 7, 0x3d2c14).setDepth(depthBase + 0.2);
    const flame = this.add.circle(x, y, 3.2, 0xffa040).setDepth(depthBase + 0.3);
    const core = this.add.circle(x, y - 1, 1.5, 0xffe080).setDepth(depthBase + 0.31);
    const glow = this.add.ellipse(x, y + WALL_H * 0.5 + 8, 40, 18, 0xff9030, 0.1).setDepth(depthBase + 0.15);
    this.mapTiles.push(bracket, flame, core, glow);
    this.decorTweens.push(
      this.tweens.add({
        targets: [flame, core],
        scaleX: 0.75,
        scaleY: 1.25,
        alpha: 0.75,
        duration: 130 + Math.abs(x % 70),
        yoyo: true,
        repeat: -1,
      }),
      this.tweens.add({ targets: glow, alpha: 0.18, duration: 300, yoyo: true, repeat: -1 })
    );
  }

  // --- the forest ---

  private addTree(tx: number, ty: number, sx: number, sy: number, hash: (tx: number, ty: number, salt: number) => number) {
    const j = hash(tx, ty, 21);
    const ox = (hash(tx, ty, 22) - 0.5) * 10;
    const shadow = this.add.ellipse(sx + ox, sy + 2, 26, 10, 0x000000, 0.25).setDepth(-900_000 + sy);
    const c = this.add.container(sx + ox, sy).setDepth(sy + 0.1);
    const act = this.room?.state.act ?? 1;
    if (act === 2) {
      // the wastes: wind-carved rocks and sun-bleached scrub
      if (j < 0.5) {
        const rock = this.add.ellipse(0, -5, 18 + j * 10, 13 + j * 6, 0x6a5a3c).setStrokeStyle(1.5, 0x453a26);
        const cap = this.add.ellipse(-2, -10, 10, 6, 0x7a6a48);
        c.add([rock, cap]);
      } else if (j < 0.72) {
        const trunk = this.add.rectangle(0, -8, 2.6, 16, 0x5a4a30).setStrokeStyle(1, 0x38301e);
        const b1 = this.add.rectangle(-4, -14, 8, 1.6, 0x5a4a30).setRotation(-0.5);
        const b2 = this.add.rectangle(4, -11, 7, 1.6, 0x5a4a30).setRotation(0.4);
        c.add([trunk, b1, b2]); // dead scrub, all thorn and no leaf
      } else {
        const spine = this.add.rectangle(0, -9, 5, 18, 0x4e6a3a).setStrokeStyle(1, 0x2e4422);
        const armL = this.add.rectangle(-5, -12, 4, 9, 0x4e6a3a).setStrokeStyle(1, 0x2e4422);
        c.add([spine, armL]); // something like a cactus grips the hardpan
      }
      this.mapTiles.push(shadow, c);
      return;
    }
    if (act === 3) {
      // the drowned green: strangler trunks under fat canopies, dripping vines
      const trunk = this.add.rectangle(0, -9, 4.5, 20, 0x2e4426).setStrokeStyle(1, 0x1a2c16);
      const canopy = this.add.ellipse(0, -24, 26 + j * 8, 17 + j * 5, 0x2a5c30).setStrokeStyle(1.5, 0x18341c);
      const canopy2 = this.add.ellipse(5 - j * 10, -30, 15, 9, 0x35703a);
      const vine = this.add.rectangle(6 - j * 12, -14, 1.4, 13, 0x244a28);
      c.add([trunk, vine, canopy, canopy2]);
      this.decorTweens.push(this.tweens.add({ targets: [canopy, canopy2], x: "+=1.5", duration: 2100 + j * 600, yoyo: true, repeat: -1, ease: "sine.inout" }));
      this.mapTiles.push(shadow, c);
      return;
    }
    if (act >= 4) {
      // the ashfall road: charred spires and slag heaps, some still glowing
      if (j < 0.6) {
        const spire = this.add.triangle(0, -10, -6, 12, 6, 12, 1, -14, 0x2c1e1a).setStrokeStyle(1, 0x180e0c);
        const crack = this.add.rectangle(0, -4, 1.6, 8, 0xe86840, 0.8);
        c.add([spire, crack]);
        this.decorTweens.push(this.tweens.add({ targets: crack, alpha: 0.3, duration: 800 + j * 700, yoyo: true, repeat: -1 }));
      } else {
        const heap = this.add.ellipse(0, -5, 17, 11, 0x241a16).setStrokeStyle(1.5, 0x140c0a);
        const ember = this.add.circle(3 - j * 6, -7, 1.6, 0xff8830, 0.9);
        c.add([heap, ember]);
        this.decorTweens.push(this.tweens.add({ targets: ember, alpha: 0.25, duration: 600 + j * 500, yoyo: true, repeat: -1 }));
      }
      this.mapTiles.push(shadow, c);
      return;
    }
    if (j < 0.16) {
      // a dead tree — this is not a friendly wood
      const trunk = this.add.rectangle(0, -10, 3.2, 22, 0x2c2018).setStrokeStyle(1, 0x191210);
      const b1 = this.add.rectangle(-4.5, -19, 9, 1.8, 0x2c2018).setRotation(-0.55);
      const b2 = this.add.rectangle(4, -15, 8, 1.6, 0x271c14).setRotation(0.5);
      c.add([trunk, b1, b2]);
    } else {
      const size = 8 + j * 5;
      const trunk = this.add.rectangle(0, -6, 3.5, 13, 0x33261a).setStrokeStyle(1, 0x201810);
      const c1 = this.add.circle(0, -17 - j * 4, size, 0x1e3a1a);
      const c2 = this.add.circle(-size * 0.6, -13 - j * 3, size * 0.62, 0x24451e);
      const c3 = this.add.circle(size * 0.6, -14 - j * 3, size * 0.66, 0x1a3418);
      const hi = this.add.circle(size * 0.25, -19 - j * 4, size * 0.4, 0x2c5224, 0.8);
      c.add([trunk, c2, c3, c1, hi]);
      if (j > 0.62) {
        // half the wood sways in a wind nobody feels
        this.decorTweens.push(
          this.tweens.add({ targets: [c1, c2, c3, hi], x: "+=1.6", duration: 1400 + j * 900, yoyo: true, repeat: -1, ease: "sine.inOut" })
        );
      }
    }
    this.mapTiles.push(shadow, c);
  }

  // the watchtower: two stone stories over the treetops, windows lit by nobody
  private drawTower(a: { x: number; y: number; w: number; h: number }) {
    const T = TILE;
    const p0 = worldToScreen(a.x * T, a.y * T);
    const p1 = worldToScreen((a.x + a.w) * T, a.y * T);
    const p2 = worldToScreen((a.x + a.w) * T, (a.y + a.h) * T);
    const p3 = worldToScreen(a.x * T, (a.y + a.h) * T);
    const H = 82; // two stories of stone
    const depth = p2.y + 0.2;
    const g = this.add.graphics().setDepth(depth);
    // faces
    g.fillStyle(0x4a4a56, 1);
    g.beginPath();
    g.moveTo(p3.x, p3.y - H);
    g.lineTo(p2.x, p2.y - H);
    g.lineTo(p2.x, p2.y);
    g.lineTo(p3.x, p3.y);
    g.closePath();
    g.fillPath();
    g.fillStyle(0x38383f, 1);
    g.beginPath();
    g.moveTo(p2.x, p2.y - H);
    g.lineTo(p1.x, p1.y - H);
    g.lineTo(p1.x, p1.y);
    g.lineTo(p2.x, p2.y);
    g.closePath();
    g.fillPath();
    // a story line where the second floor begins
    g.lineStyle(1.5, 0x26262e, 0.9);
    g.beginPath();
    g.moveTo(p3.x, p3.y - H / 2);
    g.lineTo(p2.x, p2.y - H / 2);
    g.lineTo(p1.x, p1.y - H / 2);
    g.strokePath();
    // roof + crenellations
    g.fillStyle(0x2e2e36, 1);
    g.beginPath();
    g.moveTo(p0.x, p0.y - H);
    g.lineTo(p1.x, p1.y - H);
    g.lineTo(p2.x, p2.y - H);
    g.lineTo(p3.x, p3.y - H);
    g.closePath();
    g.fillPath();
    g.lineStyle(1.5, 0x1c1c22, 0.9);
    g.strokePath();
    g.fillStyle(0x4a4a56, 1);
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      const mx = p3.x + (p2.x - p3.x) * t;
      const my = p3.y + (p2.y - p3.y) * t - H;
      g.fillRect(mx - 2, my - 6, 4, 6);
    }
    this.mapTiles.push(g);
    // two lit windows, one per story — and the doorway below
    const frontX = (p3.x + p2.x) / 2;
    const frontY = (p3.y + p2.y) / 2;
    for (const [wy, alpha] of [[-H * 0.7, 0.9], [-H * 0.24, 0.75]] as const) {
      const win = this.add.rectangle(frontX, frontY + wy, 5, 8, 0xffb84a, alpha).setDepth(depth + 0.1);
      this.mapTiles.push(win);
      this.decorTweens.push(this.tweens.add({ targets: win, alpha: alpha * 0.5, duration: 620 + Math.random() * 300, yoyo: true, repeat: -1 }));
    }
    const door = this.add.rectangle(frontX, frontY - 7, 10, 14, 0x0a0a10, 0.95).setDepth(depth + 0.1);
    const lintel = this.add.rectangle(frontX, frontY - 15, 14, 3, 0x5a5a66).setDepth(depth + 0.1);
    // the big drawn door forwards clicks to the real doorway portal below it
    door.setInteractive({ useHandCursor: true });
    door.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      let doorId = "";
      let doorS: any = null;
      this.room?.state.shrines?.forEach((sh: any, sid: string) => {
        if (sh.kind === "areaportal" && sh.variant === "towerdoor") {
          doorId = sid;
          doorS = sh;
        }
      });
      if (!doorId) return;
      this.lootClickAt = this.time.now; // same grace as any interact click
      this.pendingShrine = doorId;
      this.startAutoWalk(doorS.x, doorS.y);
    });
    this.mapTiles.push(door, lintel);
    const label = this.add
      .text(p0.x, p0.y - H - 14, "· THE WATCHTOWER ·", { fontFamily: "monospace", fontSize: "10px", color: "#9aa0b8" })
      .setOrigin(0.5)
      .setDepth(depth + 0.2);
    this.mapTiles.push(label);
    // remember what to fade when a hero stands in the tower's visual shadow
    this.towerFade = {
      objs: [g, door, lintel],
      zone: { x0: (a.x - 1) * T, y0: (a.y - 3) * T, x1: (a.x + a.w + 1) * T, y1: (a.y + 1) * T },
    };
  }

  // --- the town, dressed like somewhere people actually live ---

  private drawTownBuildings() {
    const style = townStyle(this.room?.state.act ?? 1);
    for (const b of TOWN_BUILDINGS) {
      if (b.kind === "well") {
        this.drawWell(b.x, b.y);
        continue;
      }
      const p0 = worldToScreen(b.x * TILE, b.y * TILE);
      const p1 = worldToScreen((b.x + b.w) * TILE, b.y * TILE);
      const p2 = worldToScreen((b.x + b.w) * TILE, (b.y + b.h) * TILE);
      const p3 = worldToScreen(b.x * TILE, (b.y + b.h) * TILE);
      // enterable buildings get low parapet walls so the open roof reveals the room inside
      const H = b.enterable ? 18 : b.kind === "tavern" ? 42 : b.kind === "smithy" ? 36 : 28;
      // every land dresses its walls in its own material and palette
      const wallL = style.wallL;
      const wallR = style.wallR;
      const roof = style.roof;
      const ridge = style.roofRidge;
      const depth = p2.y + 0.2;

      // walls + framing: always opaque, they frame the building (and the room, if open)
      const wallG = this.add.graphics().setDepth(depth);
      wallG.fillStyle(wallL, 1);
      wallG.beginPath();
      wallG.moveTo(p3.x, p3.y - H);
      wallG.lineTo(p2.x, p2.y - H);
      wallG.lineTo(p2.x, p2.y);
      wallG.lineTo(p3.x, p3.y);
      wallG.closePath();
      wallG.fillPath();
      wallG.fillStyle(wallR, 1);
      wallG.beginPath();
      wallG.moveTo(p2.x, p2.y - H);
      wallG.lineTo(p1.x, p1.y - H);
      wallG.lineTo(p1.x, p1.y);
      wallG.lineTo(p2.x, p2.y);
      wallG.closePath();
      wallG.fillPath();
      wallG.lineStyle(1.5, style.timber, 0.9);
      wallG.strokePoints([{ x: p3.x, y: p3.y - H }, { x: p2.x, y: p2.y - H }, { x: p2.x, y: p2.y }], false);
      wallG.strokePoints([{ x: p2.x, y: p2.y - H }, { x: p1.x, y: p1.y - H }, { x: p1.x, y: p1.y }], false);
      this.mapTiles.push(wallG);

      // the interior — drawn UNDER the roof, so it's hidden until the roof lifts away
      if (b.enterable) this.furnishInterior(b, style, H);

      // roof: its OWN object, so it can fade to reveal the room when you step inside
      const peak = b.enterable ? 14 : 8;
      const roofG = this.add.graphics().setDepth(depth + 0.3);
      roofG.fillStyle(roof, 1);
      roofG.beginPath();
      roofG.moveTo(p0.x, p0.y - H - peak);
      roofG.lineTo(p1.x, p1.y - H);
      roofG.lineTo(p2.x, p2.y - H);
      roofG.lineTo(p3.x, p3.y - H);
      roofG.closePath();
      roofG.fillPath();
      roofG.lineStyle(1.5, ridge, 0.9);
      roofG.beginPath();
      roofG.moveTo(p0.x, p0.y - H - peak);
      roofG.lineTo(p1.x, p1.y - H);
      roofG.lineTo(p2.x, p2.y - H);
      roofG.lineTo(p3.x, p3.y - H);
      roofG.closePath();
      roofG.strokePath();
      // a ridge beam down the spine
      roofG.lineStyle(1.5, ridge, 0.7);
      roofG.strokePoints([{ x: p0.x, y: p0.y - H - peak }, { x: p2.x, y: p2.y - H }], false);
      this.mapTiles.push(roofG);
      if (b.enterable) this.cutaways.push({ b, roof: [roofG], alpha: 1 });

      const frontX = (p3.x + p2.x) / 2;
      const frontY = (p3.y + p2.y) / 2;

      // the doorway: an open dark threshold for enterable homes, a solid door otherwise
      if (b.enterable && b.door) {
        const d = worldToScreen((b.door.x + 0.5) * TILE, (b.door.y + 0.5) * TILE);
        const opening = this.add.ellipse(d.x, d.y - 6, 13, 16, 0x0c0a08, 0.9).setDepth(depth + 0.05);
        const warm = this.add.ellipse(d.x, d.y - 4, 20, 10, style.window, 0.16).setDepth(depth + 0.04);
        const stepStone = this.add.ellipse(d.x, d.y + 3, 15, 6, 0x4a4a52, 0.7).setDepth(depth + 0.02);
        this.mapTiles.push(opening, warm, stepStone);
        this.decorTweens.push(this.tweens.add({ targets: warm, alpha: 0.08, duration: 1400, yoyo: true, repeat: -1, ease: "sine.inout" }));
      } else {
        const doorH = Math.min(15, H - 10);
        const door = this.add
          .rectangle(frontX, frontY - doorH / 2 - 1, 9, doorH, b.kind === "smithy" ? 0x14100a : 0x2e2212)
          .setStrokeStyle(1.5, 0x1a1208)
          .setDepth(depth + 0.08);
        const lintel = this.add.rectangle(frontX, frontY - doorH - 2, 12, 2.5, 0x241a0e).setDepth(depth + 0.09);
        const handle = this.add.circle(frontX + 2.8, frontY - doorH / 2 - 1, 1, 0xb8952a).setDepth(depth + 0.09);
        const step = this.add.rectangle(frontX, frontY + 1.5, 13, 3, 0x4a4a52, 0.85).setDepth(depth + 0.07);
        this.mapTiles.push(door, lintel, handle, step);
      }

      if (b.kind === "tavern") {
        const sign = this.add
          .text(p2.x, p2.y - H - peak - 8, style.tavernName, { fontFamily: "monospace", fontSize: "9px", color: "#e8c87a", backgroundColor: "#1a120acc", padding: { x: 3, y: 1 } })
          .setOrigin(0.5)
          .setDepth(depth + 0.4);
        this.mapTiles.push(sign);
      } else if (b.kind === "smithy") {
        // the forge never goes cold
        const glow = this.add.ellipse(frontX, frontY + 6, 40, 16, 0xff7020, 0.22).setDepth(depth + 0.05);
        const coals = this.add.rectangle(frontX, frontY + 2, 14, 6, 0xff5810, 0.9).setDepth(depth + 0.1);
        const anvil = this.add.rectangle(frontX + 16, frontY + 4, 10, 5, 0x606068).setStrokeStyle(1, 0x2c2c32).setDepth(depth + 0.1);
        this.mapTiles.push(glow, coals, anvil);
        this.decorTweens.push(
          this.tweens.add({ targets: [glow, coals], alpha: 0.5, duration: 220, yoyo: true, repeat: -1 })
        );
        const sign = this.add
          .text(p2.x, p2.y - H - 14, "SMITHY", { fontFamily: "monospace", fontSize: "9px", color: "#c8c8d4", backgroundColor: "#1a120acc", padding: { x: 3, y: 1 } })
          .setOrigin(0.5)
          .setDepth(depth + 0.2);
        this.mapTiles.push(sign);
      } else if (!b.enterable) {
        // solid homes breathe: a chimney and slow smoke (open homes vent through the roof)
        const chimX = p0.x + (p2.x - p0.x) * 0.3;
        const chimY = p0.y - H - 4 + (p2.y - p0.y) * 0.3;
        const chim = this.add.rectangle(chimX, chimY, 5, 10, 0x50443a).setStrokeStyle(1, 0x2c241c).setDepth(depth + 0.1);
        this.mapTiles.push(chim);
        for (let i = 0; i < 2; i++) {
          const puff = this.add.circle(chimX, chimY - 8, 3, style.smoke, 0.35).setDepth(depth + 0.1);
          this.mapTiles.push(puff);
          this.decorTweens.push(
            this.tweens.add({
              targets: puff,
              y: chimY - 30,
              alpha: 0,
              scale: 2.2,
              duration: 2600,
              delay: i * 1300,
              repeat: -1,
              onRepeat: () => puff.setPosition(chimX, chimY - 8).setAlpha(0.35).setScale(1),
            })
          );
        }
      }
    }
  }

  // the warm room inside an enterable building — a plank floor and its furnishings,
  // all drawn UNDER the roof so they stay hidden until you cross the threshold
  private furnishInterior(b: TownBuilding, style: TownStyle, _H: number) {
    const ix0 = b.x + 1, ix1 = b.x + b.w - 2, iy0 = b.y + 1, iy1 = b.y + b.h - 2;
    const cx = (ix0 + ix1 + 1) / 2, cy = (iy0 + iy1 + 1) / 2; // interior center, in tiles
    const at = (txf: number, tyf: number) => worldToScreen(txf * TILE, tyf * TILE);

    // plank floor: a filled iso diamond per interior tile, warmer than the plaza outside
    const floorG = this.add.graphics().setDepth(-700_000);
    const plank = b.kind === "tavern" ? 0x4a3623 : 0x453322;
    for (let ty = iy0; ty <= iy1; ty++) {
      for (let tx = ix0; tx <= ix1; tx++) {
        const a = at(tx, ty), c = at(tx + 1, ty), d = at(tx + 1, ty + 1), e = at(tx, ty + 1);
        floorG.fillStyle((tx + ty) % 2 ? plank : plank - 0x060402, 1);
        floorG.beginPath();
        floorG.moveTo(a.x, a.y); floorG.lineTo(c.x, c.y); floorG.lineTo(d.x, d.y); floorG.lineTo(e.x, e.y);
        floorG.closePath(); floorG.fillPath();
      }
    }
    this.mapTiles.push(floorG);

    if (b.kind === "tavern") {
      // a long counter across the back, the barkeep's side (the NPC stands behind it)
      const bl = at(ix0, iy0 + 0.65), br = at(ix1 + 1, iy0 + 0.65);
      const counter = this.add.rectangle((bl.x + br.x) / 2, (bl.y + br.y) / 2 - 6, Math.hypot(br.x - bl.x, br.y - bl.y), 8, 0x5a3f28)
        .setStrokeStyle(1.5, 0x2e1e10).setDepth((bl.y + br.y) / 2);
      const top = this.add.rectangle((bl.x + br.x) / 2, (bl.y + br.y) / 2 - 10, Math.hypot(br.x - bl.x, br.y - bl.y), 3, 0x6a4a2e).setDepth((bl.y + br.y) / 2 + 0.1);
      this.mapTiles.push(counter, top);

      // the crooked lantern itself, swinging over the room
      const lc = at(cx, cy - 0.2);
      const lantern = this.add.circle(lc.x, lc.y - 34, 4, style.window, 0.95).setStrokeStyle(1, 0x6a4a1a).setDepth(880_000);
      const lglow = this.add.ellipse(lc.x, lc.y - 6, 60, 34, style.window, 0.12).setDepth(-690_000);
      this.mapTiles.push(lantern, lglow);
      this.decorTweens.push(
        this.tweens.add({ targets: lantern, angle: 6, x: lc.x + 2, duration: 1700, yoyo: true, repeat: -1, ease: "sine.inout" }),
        this.tweens.add({ targets: lglow, alpha: 0.06, duration: 1700, yoyo: true, repeat: -1, ease: "sine.inout" })
      );

      // a hearth in the corner, barrels in the other, stools along the counter
      const hearth = at(ix1 + 0.6, iy1 + 0.5);
      const fire = this.add.ellipse(hearth.x, hearth.y - 6, 12, 8, 0xff7a2a, 0.9).setDepth(hearth.y);
      const fireGlow = this.add.ellipse(hearth.x, hearth.y - 4, 34, 20, 0xff7a2a, 0.18).setDepth(hearth.y - 0.1);
      this.mapTiles.push(fire, fireGlow);
      this.decorTweens.push(this.tweens.add({ targets: [fire, fireGlow], scaleY: 1.3, alpha: 0.6, duration: 260, yoyo: true, repeat: -1 }));

      const bx = at(ix0 + 0.4, iy1 + 0.4);
      for (const [dx, dy, r] of [[0, 0, 6], [7, -1, 5], [3, -8, 5]] as const) {
        const barrel = this.add.ellipse(bx.x + dx, bx.y + dy - 6, r * 2, r * 2.4, 0x5a4028).setStrokeStyle(1.5, 0x2e1e10).setDepth(bx.y + dy);
        const hoop = this.add.ellipse(bx.x + dx, bx.y + dy - 6, r * 2, 2.4, 0x8a6a3a).setDepth(bx.y + dy + 0.1);
        this.mapTiles.push(barrel, hoop);
      }
      // two patrons nursing drinks at the counter — the room is never quite empty
      for (const px of [ix0 + 0.7, ix1 + 0.1]) {
        const s = at(px, iy0 + 1.15);
        const stool = this.add.ellipse(s.x, s.y, 7, 4, 0x3a2a1a).setDepth(s.y - 0.2);
        const body = this.add.rectangle(s.x, s.y - 9, 9, 12, 0x4a4450).setStrokeStyle(1, 0x241c24).setDepth(s.y);
        const head = this.add.circle(s.x, s.y - 17, 3.6, 0xc8a888).setStrokeStyle(1, 0x5a4632, 0.7).setDepth(s.y + 0.1);
        this.mapTiles.push(stool, body, head);
        this.decorTweens.push(this.tweens.add({ targets: [body, head], y: "-=1", duration: 1600 + Math.random() * 500, yoyo: true, repeat: -1, ease: "sine.inout" }));
      }
    } else {
      // a hut: a fire, a cot, a stool — small and lived-in
      const hearth = at(ix1 + 0.6, iy0 + 0.5);
      const fire = this.add.ellipse(hearth.x, hearth.y - 5, 9, 6, 0xff8a3a, 0.9).setDepth(hearth.y);
      const fireGlow = this.add.ellipse(hearth.x, hearth.y - 3, 26, 16, 0xff8a3a, 0.16).setDepth(hearth.y - 0.1);
      const pot = this.add.ellipse(hearth.x, hearth.y - 8, 6, 4, 0x2a2420).setStrokeStyle(1, 0x14100a).setDepth(hearth.y + 0.1);
      this.mapTiles.push(fire, fireGlow, pot);
      this.decorTweens.push(this.tweens.add({ targets: [fire, fireGlow], scaleY: 1.3, alpha: 0.6, duration: 300, yoyo: true, repeat: -1 }));

      const cot = at(ix0 + 0.5, iy1 + 0.5);
      const bed = this.add.rectangle(cot.x, cot.y - 4, 16, 7, 0x5a4a3a).setStrokeStyle(1, 0x2e2018).setDepth(cot.y);
      const blanket = this.add.rectangle(cot.x + 2, cot.y - 6, 11, 4, style.accent, 0.8).setDepth(cot.y + 0.1);
      this.mapTiles.push(bed, blanket);
    }
  }

  private drawWell(tx: number, ty: number) {
    const s = worldToScreen((tx + 0.5) * TILE, (ty + 0.5) * TILE);
    const c = this.add.container(s.x, s.y).setDepth(s.y + 0.1);
    const water = this.add.ellipse(0, -2, 18, 9, 0x1a2c3a, 1);
    const ring = this.add.ellipse(0, -2, 24, 12, 0x5a5a64, 1).setStrokeStyle(2, 0x3a3a42);
    const post1 = this.add.rectangle(-9, -14, 2.5, 20, 0x4a3826);
    const post2 = this.add.rectangle(9, -14, 2.5, 20, 0x4a3826);
    const beam = this.add.rectangle(0, -23, 22, 3, 0x3a2c1e);
    const rope = this.add.rectangle(0, -16, 1, 12, 0x8a7a5a);
    const bucket = this.add.rectangle(0, -9, 6, 5, 0x5a4632).setStrokeStyle(1, 0x33261a);
    c.add([ring, water, post1, post2, beam, rope, bucket]);
    this.mapTiles.push(c);
    this.decorTweens.push(this.tweens.add({ targets: [rope, bucket], y: "+=3", duration: 2200, yoyo: true, repeat: -1, ease: "sine.inOut" }));
  }

  // small wild things in the undergrowth — they want nothing to do with you
  private addCritters() {
    const map = this.clientMap;
    if (!map) return;
    const spots: Array<{ x: number; y: number }> = [];
    for (let tries = 0; tries < 200 && spots.length < 4; tries++) {
      const tx = 3 + Math.floor(Math.random() * (map.w - 6));
      const ty = 14 + Math.floor(Math.random() * 32);
      if (tileAt(map, tx, ty) === 0) spots.push({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE });
    }
    for (const spot of spots) {
      const rabbit = Math.random() < 0.5;
      const cw = worldToScreen(spot.x, spot.y);
      const c = this.add.container(cw.x, cw.y).setDepth(cw.y);
      const body = this.add.ellipse(0, -3, rabbit ? 8 : 9, rabbit ? 6 : 4.5, rabbit ? 0x9a8a72 : 0x4f4438);
      body.setStrokeStyle(1, 0x2c2418, 0.7);
      const head = this.add.circle(4, -5, rabbit ? 2.6 : 2, rabbit ? 0xa89880 : 0x5a4e40);
      const detail = rabbit
        ? this.add.rectangle(4.5, -9, 1.4, 4, 0x9a8a72).setRotation(0.2) // the ear
        : this.add.rectangle(-7, -2, 6, 1, 0x4f4438).setRotation(-0.2); // the tail
      c.add([body, head, detail]);
      this.mapTiles.push(c);
      let wx = spot.x;
      let wy = spot.y;

      const hop = () => {
        if (!c.active || !this.clientMap) return;
        // players nearby? bolt AWAY. Otherwise, amble.
        let fleeAngle: number | null = null;
        this.players.forEach((p) => {
          const d = Math.hypot(p.schema.x - wx, p.schema.y - wy);
          if (d < 90) fleeAngle = Math.atan2(wy - p.schema.y, wx - p.schema.x);
        });
        const a = fleeAngle ?? Math.random() * Math.PI * 2;
        const dist = fleeAngle !== null ? 70 : 26 + Math.random() * 26;
        const nx = wx + Math.cos(a) * dist;
        const ny = wy + Math.sin(a) * dist;
        if (canStand(this.clientMap, nx, ny) && ny > 13 * TILE) {
          wx = nx;
          wy = ny;
          const to = worldToScreen(nx, ny);
          c.setScale(to.x < c.x ? -1 : 1, 1);
          this.decorTweens.push(
            this.tweens.add({
              targets: c,
              x: to.x,
              y: to.y,
              duration: fleeAngle !== null ? 260 : 420,
              ease: "quad.out",
              onUpdate: () => c.setDepth(c.y),
            }),
            this.tweens.add({ targets: body, scaleY: 0.75, duration: fleeAngle !== null ? 130 : 210, yoyo: true })
          );
        }
        this.time.delayedCall(fleeAngle !== null ? 300 : 900 + Math.random() * 2200, hop);
      };
      this.time.delayedCall(600 + Math.random() * 1500, hop);
    }
  }

  // townsfolk who wander the plaza and remind you what you're fighting for
  private addVillagers(hash: (tx: number, ty: number, salt: number) => number) {
    const style = townStyle(this.room?.state.act ?? 1);
    const spots = [
      [5, 6], [7, 4], [10, 6], [13, 6], [15, 6], [18, 6], [20, 6], [26, 7],
    ].map(([tx, ty]) => worldToScreen((tx + 0.5) * TILE, (ty + 0.5) * TILE));
    const palettes = [
      { tunic: 0x6a5a3a, head: 0xc8a882 }, // farmer
      { tunic: 0x4a3a5a, head: 0xbc9878 }, // widow in mourning purple
      { tunic: 0x5a3a2a, head: 0xd0b088 }, // barkeep's boy
      { tunic: style.accent, head: 0xc0a078 }, // a local in the land's own cloth
    ];
    // busy Hollowmere teems; the ash-choked Last Vigil is nearly deserted
    const count = Math.max(2, Math.round(4 * style.crowd));
    for (let i = 0; i < count; i++) {
      const pal = palettes[i];
      const start = spots[(i * 3) % spots.length];
      const c = this.add.container(start.x, start.y).setDepth(start.y);
      const shadow = this.add.ellipse(0, 1, 12, 5, 0x000000, 0.3);
      const body = this.add.rectangle(0, -7, 5.5, 10, pal.tunic).setStrokeStyle(1, 0x1a140e);
      const head = this.add.circle(0, -14, 3, pal.head).setStrokeStyle(1, 0x2c2018);
      c.add([shadow, body, head]);
      this.mapTiles.push(c);
      this.decorTweens.push(this.tweens.add({ targets: [body, head], y: "-=0.8", duration: 900 + i * 140, yoyo: true, repeat: -1, ease: "sine.inOut" }));

      const wander = () => {
        if (!c.active) return;
        const next = spots[Math.floor(Math.random() * spots.length)];
        const d = Math.hypot(next.x - c.x, next.y - c.y);
        if (d < 4) {
          this.time.delayedCall(1200 + Math.random() * 2600, wander);
          return;
        }
        c.setScale(next.x < c.x ? -1 : 1, 1);
        this.decorTweens.push(
          this.tweens.add({
            targets: c,
            x: next.x,
            y: next.y,
            duration: d * 34,
            ease: "linear",
            onUpdate: () => c.setDepth(c.y),
            onComplete: () => this.time.delayedCall(800 + Math.random() * 3200, wander),
          })
        );
      };
      this.time.delayedCall(600 + i * 900, wander);
    }
  }

  // the cathedral doors: an arch, braziers, and a bad feeling
  private drawCathedralFacade(cath: { x: number; y: number; w: number; h: number }) {
    const doorTx = cath.x + Math.floor(cath.w / 2);
    const s = worldToScreen(doorTx * TILE, (cath.y + 0.5) * TILE);
    // the arch over the doorway
    const arch = this.add.container(s.x, s.y - WALL_H).setDepth(s.y + 0.5);
    const act = this.room?.state.act ?? 1;
    const stone = act === 2 ? 0x8a744a : act === 3 ? 0x3e6a58 : act === 4 ? 0x4a2c24 : 0x4a4a58;
    const stoneDark = act === 2 ? 0x5a4a2e : act === 3 ? 0x26443a : act === 4 ? 0x2c1812 : 0x2c2c36;
    const gem = act === 2 ? 0xd8a850 : act === 3 ? 0x50c8b0 : act === 4 ? 0xff5830 : 0x7a3040;
    const frameL = this.add.rectangle(-14, 2, 4, 26, stone).setStrokeStyle(1, stoneDark);
    const frameR = this.add.rectangle(14, 2, 4, 26, stone).setStrokeStyle(1, stoneDark);
    const peak = this.add.triangle(0, -14, -18, 6, 18, 6, 0, -12, stone).setStrokeStyle(1, stoneDark);
    const rose = this.add.circle(0, -10, 3.5, gem).setStrokeStyle(1, stoneDark); // the eye above the door
    const dark = this.add.rectangle(0, 6, 22, 18, 0x08080c, 0.92); // the doorway swallows light
    arch.add([dark, frameL, frameR, peak, rose]);
    this.mapTiles.push(arch);
    this.decorTweens.push(this.tweens.add({ targets: rose, alpha: 0.5, duration: 1600, yoyo: true, repeat: -1 }));
    // braziers flanking the doors
    this.addTorch(s.x - 30, s.y - 10, s.y + 0.4);
    this.addTorch(s.x + 30, s.y - 10, s.y + 0.4);
    const label = this.add
      .text(s.x, s.y - WALL_H - 34, "· THE CATHEDRAL ·", { fontFamily: "monospace", fontSize: "11px", color: "#9a8ab0" })
      .setOrigin(0.5)
      .setDepth(s.y + 0.6);
    this.mapTiles.push(label);
  }

  private addFloorDressing(
    tx: number,
    ty: number,
    sx: number,
    sy: number,
    themeIdx: number,
    hash: (tx: number, ty: number, salt: number) => number
  ) {
    const r = hash(tx, ty, 3);
    if (themeIdx === FOREST_THEME_INDEX) {
      // the forest floor: tufts, mushrooms, stones — no lava up here
      if (r < 0.1) {
        const g = this.add.graphics({ x: sx, y: sy }).setDepth(-900_000 + sy);
        g.lineStyle(1.2, 0x3a5a2c, 0.8);
        for (let i = 0; i < 3; i++) {
          const gx = (hash(tx, ty, 30 + i) - 0.5) * 16;
          g.beginPath();
          g.moveTo(gx, 2);
          g.lineTo(gx + (hash(tx, ty, 33 + i) - 0.5) * 3, -4);
          g.strokePath();
        }
        this.mapTiles.push(g);
      } else if (r < 0.125) {
        const cap = this.add.circle(sx + (hash(tx, ty, 36) - 0.5) * 14, sy - 2, 2.4, 0x8a4a3a).setDepth(-900_000 + sy);
        const stem = this.add.rectangle(cap.x, sy, 1.4, 3.5, 0xc8b89a).setDepth(-900_000 + sy - 0.1);
        this.mapTiles.push(cap, stem);
      } else if (r < 0.15) {
        const rock = this.add
          .ellipse(sx + (hash(tx, ty, 38) - 0.5) * 16, sy, 8, 5, 0x4a4a48)
          .setStrokeStyle(1, 0x2e2e2c)
          .setDepth(-900_000 + sy);
        this.mapTiles.push(rock);
      }
      return;
    }
    if (r < 0.045) {
      // stain
      const stain = this.add
        .ellipse(sx + (hash(tx, ty, 4) - 0.5) * 18, sy, 22, 9, themeIdx === 3 ? 0x501010 : 0x0a0a0e, 0.22)
        .setDepth(-900_000 + sy);
      this.mapTiles.push(stain);
    } else if (r < 0.08) {
      // rubble
      for (let i = 0; i < 3; i++) {
        const rb = this.add
          .rectangle(sx + (hash(tx, ty, 5 + i) - 0.5) * 20, sy + (hash(tx, ty, 8 + i) - 0.5) * 8, 3, 2, 0x55555f, 0.8)
          .setRotation(hash(tx, ty, 11 + i) * 3)
          .setDepth(-900_000 + sy);
        this.mapTiles.push(rb);
      }
    } else if (r < 0.105) {
      // theme centerpiece — depth-sorted with entities
      const c = this.add.container(sx, sy).setDepth(sy);
      if (themeIdx === 0) {
        // broken pillar
        c.add(this.add.rectangle(0, -9, 9, 18, 0x55555f).setStrokeStyle(1, 0x33333c));
        c.add(this.add.rectangle(0, -19, 13, 4, 0x62626e));
        c.add(this.add.triangle(0, -23, -6, 2, 6, 2, -2, -5, 0x55555f)); // jagged break
      } else if (themeIdx === 1) {
        // bone pile
        c.add(this.add.rectangle(-3, -2, 9, 2, 0xd8d4c0).setRotation(0.5));
        c.add(this.add.rectangle(3, -3, 9, 2, 0xcac6b2).setRotation(-0.4));
        c.add(this.add.circle(4, -6, 3, 0xe8e4d4));
        c.add(this.add.circle(3.2, -6.4, 0.8, 0x22242a));
      } else if (themeIdx === 2) {
        // stalagmite
        c.add(this.add.triangle(0, -8, -6, 8, 6, 8, 0, -10, 0x6a5a44).setStrokeStyle(1, 0x4a3f30));
        c.add(this.add.triangle(5, -4, -3, 4, 3, 4, 0, -6, 0x5f5040));
      } else {
        // lava crack
        const lg = this.add.graphics({ x: 0, y: 0 });
        lg.lineStyle(2, 0xff5020, 0.85);
        lg.beginPath();
        lg.moveTo(-10, 2);
        lg.lineTo(-4, -2);
        lg.lineTo(1, 1);
        lg.lineTo(7, -3);
        lg.strokePath();
        const under = this.add.ellipse(0, 0, 26, 10, 0xff5020, 0.12);
        c.add([under, lg]);
        this.decorTweens.push(
          this.tweens.add({ targets: under, alpha: 0.24, duration: 500 + hash(tx, ty, 13) * 400, yoyo: true, repeat: -1 })
        );
        c.setDepth(-900_000 + sy); // cracks lie flat on the floor
      }
      this.mapTiles.push(c);
    }
  }

  private onDescend(msg: { act?: number; floor: number; zoneName?: string; actName?: string }) {
    if (!this.descendSeen) {
      this.descendSeen = true; // arrival needs no fanfare
      return;
    }
    const act = msg.act ?? 1;
    const roman = ["I", "II", "III", "IV"][act - 1] ?? "";
    const heading =
      act >= ABYSS_ACT ? `ABYSS ${msg.floor}` : msg.floor === 1 ? `ACT ${roman}` : `ACT ${roman} — FLOOR ${msg.floor}`;
    const cx = this.scale.width / 2;
    const cy = this.scale.height * 0.33;
    const title = this.add
      .text(cx, cy, heading, {
        fontFamily: "monospace", fontSize: "40px", color: "#b48ae8", fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(990_000);
    const sub = this.add
      .text(cx, cy + 34, msg.floor === 1 && msg.actName ? `${msg.actName} — ${msg.zoneName ?? ""}` : msg.zoneName ?? "", {
        fontFamily: "monospace", fontSize: "16px", color: "#8a8a96", fontStyle: "italic",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(990_000);
    this.tweens.add({ targets: [title, sub], alpha: 0, y: "-=26", duration: 2400, onComplete: () => { title.destroy(); sub.destroy(); } });
    this.cameras.main.flash(500, 40, 10, 70);
    this.sfx.descend();
  }

  private addShrine(s: any, id: string) {
    const sc = worldToScreen(s.x, s.y);
    const theme = FLOOR_THEMES[visualThemeFor(this.room?.state.act ?? 1, this.room?.state.floor ?? 1)];
    const accent =
      s.kind === "gamble" ? 0xd8b13a // gold for Fenwick
      : s.kind === "riftportal" ? 0xb060ff // the Rift's violet pull
      : s.kind === "riftexit" ? 0x60d0a0 // the way home glows green
      : s.kind === "cowportal" ? 0xd83a3a // an ominous red glow
      : s.kind === "waypoint" ? 0x6a8cff
      : s.kind === "caravan" ? 0xc08a4a
      : s.kind === "alchemist" ? 0x7fdc9f // herb-green for Lysa
      : s.kind === "vendor" ? 0xd8a868 // forge-warm for Torvald
      : s.kind === "mercnpc" ? mercClassById(s.variant).npcColor // each hall its own hue
      : s.kind === "storyteller" ? 0xc9a44a // warm lantern-gold for the elder
      : s.kind === "barkeep" ? 0xe0a850 // hearth-amber for the indoor folk
      : s.kind === "encounter" ? 0x8a7ab0 // a wan, uncertain glow
      : s.kind === "setpiece" ? 0xb0a07a // a monument's weathered, dusty light
      : s.kind === "areaportal" ? 0xc8a860 // lantern-gold doorways
      : s.kind === "reliquary" ? 0x9a7ad8 // the Archive's violet lamplight
      : theme.accent;
    const container = this.add.container(sc.x, sc.y).setDepth(sc.y);

    // people cast shadows; shrines glow
    const isNpc = s.kind === "vendor" || s.kind === "gamble" || s.kind === "alchemist" || s.kind === "mercnpc" || s.kind === "caravan" || s.kind === "storyteller" || s.kind === "barkeep";
    const glow = isNpc
      ? this.add.ellipse(0, 1, 24, 11, 0x000000, 0.3)
      : this.add.ellipse(0, 0, 34, 16, accent, 0.18);
    let clickable: Phaser.GameObjects.Shape;
    const parts: Phaser.GameObjects.GameObject[] = [glow];

    if (s.kind === "chest" || s.kind === "stash") {
      const wood = s.kind === "stash" ? 0x5a4a7a : 0x7a5a2c;
      const body = this.add.rectangle(0, -8, 20, 13, wood).setStrokeStyle(1, 0x3d2c14);
      const lid = this.add.rectangle(0, -16, 20, 6, s.kind === "stash" ? 0x6a5a8f : 0x8f6a34).setStrokeStyle(1, 0x3d2c14);
      const lock = this.add.circle(0, -11, 2, 0xd8b13a);
      parts.push(body, lid, lock);
      clickable = body;
    } else if (s.kind === "vendor") {
      // Torvald: broad shoulders, smith's apron, hammer resting on the shoulder
      const legs = this.add.rectangle(0, -3, 9, 6, 0x2c2420);
      const body = this.add.rectangle(0, -12, 13, 13, 0x6a4a2a).setStrokeStyle(1.5, 0x3d2c14, 0.9);
      const apron = this.add.rectangle(0, -10, 8, 11, 0x4a4038).setStrokeStyle(1, 0x2c2620);
      const head = this.add.circle(0, -23, 5, 0xc8b090).setStrokeStyle(1, 0x5a4632, 0.8);
      const beard = this.add.triangle(0, -19, -4, -2, 4, -2, 0, 5, 0x8a8078);
      const haft = this.add.rectangle(8, -20, 2.5, 14, 0x5a4428).setRotation(0.5);
      const hammerHead = this.add.rectangle(12, -25, 7, 5, 0x70707c).setStrokeStyle(1, 0x3a3a44);
      parts.push(legs, haft, hammerHead, body, apron, head, beard);
      this.tweens.add({ targets: [head, beard], y: "-=1", duration: 1100, yoyo: true, repeat: -1, ease: "sine.inout" });
      clickable = body;
    } else if (s.kind === "gamble") {
      // Fenwick: a portly man in a loud coat, forever counting your money
      const legs = this.add.rectangle(0, -3, 8, 6, 0x2c2028);
      const belly = this.add.ellipse(0, -12, 15, 14, 0x6a2a4a).setStrokeStyle(1.5, 0x3d1830, 0.9);
      const sash = this.add.rectangle(0, -10, 15, 3, 0xb8912a).setRotation(0.12);
      const head = this.add.circle(0, -23, 4.8, 0xd8b090).setStrokeStyle(1, 0x5a4632, 0.8);
      const hat = this.add.rectangle(0, -27.5, 9, 3.5, 0x3a2438).setStrokeStyle(1, 0x201018);
      const purse = this.add.circle(8, -8, 3.4, 0x8a6a1a).setStrokeStyle(1, 0x4a3a0e);
      const coin = this.add.circle(8, -8, 1.2, 0xffd54a);
      parts.push(legs, belly, sash, head, hat, purse, coin);
      // the purse jingles; the man sways like a sales pitch
      this.tweens.add({ targets: [purse, coin], y: "+=1.6", duration: 460, yoyo: true, repeat: -1, ease: "sine.inout" });
      this.tweens.add({ targets: [belly, sash], x: "+=1", duration: 1300, yoyo: true, repeat: -1, ease: "sine.inout" });
      clickable = belly;
    } else if (s.kind === "caravan") {
      // a covered wagon waiting at the east road: bed, canopy, two wheels, a lantern
      const bed = this.add.rectangle(0, -8, 34, 10, 0x5a4630).setStrokeStyle(1, 0x33291d);
      const canopy = this.add.ellipse(0, -18, 34, 16, 0xb0a890).setStrokeStyle(1, 0x6a6252);
      const wheelL = this.add.circle(-10, -2, 6, 0x3a2f22).setStrokeStyle(1.5, 0x241c14);
      const wheelR = this.add.circle(10, -2, 6, 0x3a2f22).setStrokeStyle(1.5, 0x241c14);
      const hubL = this.add.circle(-10, -2, 1.5, 0x8a7a5a);
      const hubR = this.add.circle(10, -2, 1.5, 0x8a7a5a);
      const lantern = this.add.circle(19, -14, 2.5, 0xe8c87a, 0.95);
      parts.push(wheelL, wheelR, bed, canopy, hubL, hubR, lantern);
      this.tweens.add({ targets: lantern, alpha: 0.5, duration: 900, yoyo: true, repeat: -1, ease: "sine.inout" });
      clickable = canopy;
    } else if (s.kind === "mercnpc") {
      // a recruiter per act — each hall its own silhouette
      const variant = s.variant || "rogue";
      const legs = this.add.rectangle(0, -3, 8, 6, 0x2c2420);
      let body: Phaser.GameObjects.Shape;
      const bob: Phaser.GameObjects.GameObject[] = [];
      if (variant === "mage") {
        // Orsavio: deep-blue robe, tall staff crowned with a glowing orb
        body = this.add.rectangle(0, -12, 11, 15, 0x2c2e6a).setStrokeStyle(1.5, 0x15163a, 0.9);
        const hood = this.add.triangle(0, -25, 0, 7, 6, -4, -6, -4, 0x2c2e6a);
        const head = this.add.circle(0, -22, 4.4, 0xc89878).setStrokeStyle(1, 0x5a4632, 0.8);
        const staff = this.add.rectangle(8, -14, 2, 26, 0x5a4632);
        const orb = this.add.circle(8, -27, 3.2, 0x8a8aff).setStrokeStyle(1, 0x4a4ac0, 0.9);
        parts.push(legs, staff, body, head, hood, orb);
        bob.push(head, hood);
        this.tweens.add({ targets: orb, alpha: 0.5, scale: 1.25, duration: 900, yoyo: true, repeat: -1, ease: "sine.inout" });
      } else if (variant === "barbarian") {
        // Hrothgar: broad, fur-cloaked, a great axe planted at his side
        body = this.add.rectangle(0, -13, 15, 15, 0x6a4326).setStrokeStyle(1.5, 0x3a2410, 0.9);
        const fur = this.add.rectangle(0, -18, 17, 5, 0x8a6a44).setStrokeStyle(1, 0x4a3420);
        const head = this.add.circle(0, -25, 5, 0xc89878).setStrokeStyle(1, 0x5a4632, 0.8);
        const hair = this.add.ellipse(0, -28, 11, 5, 0x2a1a10);
        const haft = this.add.rectangle(-10, -14, 2.2, 26, 0x4a3420);
        const blade = this.add.triangle(-10, -25, 0, -6, 9, 0, 0, 6, 0x9aa0aa).setStrokeStyle(1, 0x50545c);
        parts.push(legs, haft, blade, body, fur, head, hair);
        bob.push(head, hair);
      } else if (variant === "paladin") {
        // Iseult: plate and tabard, a kite shield and a resting mace
        body = this.add.rectangle(0, -13, 12, 15, 0x8a8f9a).setStrokeStyle(1.5, 0x4a4e58, 0.9);
        const tabard = this.add.rectangle(0, -12, 5, 13, 0xd8c46a);
        const head = this.add.circle(0, -25, 4.6, 0xc89878).setStrokeStyle(1, 0x5a4632, 0.8);
        const helm = this.add.rectangle(0, -27, 9, 4, 0xb0b4bc).setStrokeStyle(1, 0x50545c);
        const shield = this.add.ellipse(-9, -14, 8, 12, 0xc0a840).setStrokeStyle(1.5, 0x6a5a20);
        const mace = this.add.rectangle(9, -15, 2, 18, 0x5a4632);
        const maceHead = this.add.circle(9, -25, 2.6, 0xb0b4bc).setStrokeStyle(1, 0x50545c);
        parts.push(legs, mace, maceHead, body, tabard, shield, head, helm);
        bob.push(head, helm);
      } else {
        // Maren: rogue captain — leather, red sash, bow on the back
        body = this.add.rectangle(0, -13, 11, 13, 0x2a5138).setStrokeStyle(1.5, 0x16301e, 0.9);
        const sashK = this.add.rectangle(0, -14, 12, 3, 0xc03848).setRotation(0.5);
        const head = this.add.circle(0, -23, 4.6, 0xc89878).setStrokeStyle(1, 0x5a4632, 0.8);
        const hair = this.add.ellipse(0, -26, 9, 4.5, 0x3a1c14);
        const bowK = this.add.arc(-7, -15, 9, 100, 260, false, 0x000000, 0).setStrokeStyle(2, 0x7a5a34, 0.95);
        parts.push(legs, bowK, body, sashK, head, hair);
        bob.push(head, hair);
      }
      this.tweens.add({ targets: bob, y: "-=1", duration: 1000, yoyo: true, repeat: -1, ease: "sine.inout" });
      clickable = body;
    } else if (s.kind === "alchemist") {
      // Lysa: green robes, a table of bottles, faint herb-smoke
      const robe = this.add.circle(0, -12, 8, 0x2e5a3a).setStrokeStyle(2, 0x1c3824, 0.9);
      const head = this.add.circle(0, -23, 4.5, 0xd0b090);
      const hood = this.add.triangle(0, -26, 0, 5, 5, -3, -5, -3, 0x2e5a3a);
      const table = this.add.rectangle(14, -5, 16, 4, 0x5a4632).setStrokeStyle(1, 0x33261a);
      const legT = this.add.rectangle(9, -1, 2, 5, 0x4a3826);
      const legT2 = this.add.rectangle(19, -1, 2, 5, 0x4a3826);
      const redFlask = this.add.rectangle(11, -9, 3.5, 5, 0xc03838).setStrokeStyle(1, 0x601818);
      const blueFlask = this.add.rectangle(16, -9, 3.5, 5, 0x3858c0).setStrokeStyle(1, 0x182860);
      parts.push(legT, legT2, table, redFlask, blueFlask, robe, head, hood);
      this.tweens.add({ targets: [redFlask, blueFlask], alpha: 0.7, duration: 700, yoyo: true, repeat: -1 });
      clickable = robe;
    } else if (s.kind === "areaportal") {
      if (s.variant === "towerdoor" || s.variant === "towerexit") {
        // a heavy wooden door in a stone frame
        const frame = this.add.rectangle(0, -12, 16, 22, 0x50505c).setStrokeStyle(1, 0x2c2c34);
        const door = this.add.rectangle(0, -11, 11, 18, s.variant === "towerdoor" ? 0x3a2c18 : 0x241c10);
        door.setStrokeStyle(1, 0x1a1208);
        const band1 = this.add.rectangle(0, -16, 11, 1.6, 0x6a5a2c);
        const band2 = this.add.rectangle(0, -7, 11, 1.6, 0x6a5a2c);
        const knob = this.add.circle(3.4, -11, 1.2, 0xd8b13a);
        parts.push(frame, door, band1, band2, knob);
        clickable = door;
      } else if (s.variant === "stairsup" || s.variant === "stairsdown") {
        const up = s.variant === "stairsup";
        const c1 = this.add.rectangle(-6, -4, 8, 4, 0x62626e).setStrokeStyle(1, 0x3a3a44);
        const c2 = this.add.rectangle(0, -9, 8, 4, 0x6a6a76).setStrokeStyle(1, 0x3a3a44);
        const c3 = this.add.rectangle(6, -14, 8, 4, 0x72727e).setStrokeStyle(1, 0x3a3a44);
        const arrow = this.add.triangle(10, up ? -22 : -2, -4, up ? 4 : -4, 4, up ? 4 : -4, 0, up ? -4 : 4, 0xffd54a);
        parts.push(c1, c2, c3, arrow);
        this.tweens.add({ targets: arrow, y: up ? -26 : 2, duration: 700, yoyo: true, repeat: -1, ease: "sine.inout" });
        clickable = c2;
      } else if (s.variant === "cavemouth") {
        // a hole in the earth, ringed with rocks — it exhales cold air
        const dark = this.add.ellipse(0, -6, 22, 14, 0x08080c, 0.96);
        const rim = this.add.ellipse(0, -6, 26, 17, 0x4a4a48, 0).setStrokeStyle(2.5, 0x55554e, 0.9);
        const rock1 = this.add.ellipse(-11, -2, 7, 5, 0x5a5a54).setStrokeStyle(1, 0x383832);
        const rock2 = this.add.ellipse(10, -10, 6, 4, 0x525248).setStrokeStyle(1, 0x383832);
        parts.push(dark, rim, rock1, rock2);
        clickable = dark;
      } else {
        // caveexit: the way back to daylight
        const glowUp = this.add.ellipse(0, -8, 18, 12, 0xc8e8a0, 0.35);
        const arch = this.add.ellipse(0, -8, 22, 15, 0x000000, 0).setStrokeStyle(2.5, 0x8a8a7a, 0.9);
        parts.push(glowUp, arch);
        this.tweens.add({ targets: glowUp, alpha: 0.15, duration: 900, yoyo: true, repeat: -1 });
        clickable = glowUp;
      }
    } else if (s.kind === "storyteller") {
      // an act's townsfolk — figure drawn from the NPC's silhouette hint
      const figure = townNpcById(s.variant)?.figure ?? "elder";
      const tints: Record<string, number> = {
        edric: 0x5a4a38, halqa: 0x8a7a4a, vaol: 0x3a5a54, cael: 0x4a4a58,
        senna: 0x3e5a3a, pip: 0x4a4038, jenda: 0x7a6a3a, ashk: 0x6a3a2a,
        oona: 0x3a5a4a, deel: 0x4a5a6a, adelheid: 0x4a4652, tomas: 0x5a5560,
      };
      const robeCol = tints[s.variant] ?? 0x5a4a44;
      const skin = 0xc8a888;
      const legs = this.add.rectangle(0, -3, 9, 6, 0x2c2420);
      const bobbers: Phaser.GameObjects.GameObject[] = [];
      if (figure === "child") {
        // Pip — small, a cap and a little spade
        const body = this.add.rectangle(0, -9, 9, 10, robeCol).setStrokeStyle(1, 0x201810, 0.9);
        const head = this.add.circle(0, -16, 3.6, skin).setStrokeStyle(1, 0x5a4632, 0.8);
        const cap = this.add.rectangle(0, -18, 8, 2.5, 0x2a2420);
        const handle = this.add.rectangle(8, -11, 1.6, 16, 0x5a4632);
        const blade = this.add.rectangle(8, -3, 4, 4, 0x8a8f9a).setStrokeStyle(1, 0x50545c);
        parts.push(legs, handle, blade, body, head, cap);
        bobbers.push(head, cap); clickable = body;
      } else if (figure === "fisher") {
        // Vaol / Deel — a tall pole, a hunched worker
        const body = this.add.rectangle(0, -12, 12, 15, robeCol).setStrokeStyle(1.5, 0x201810, 0.9);
        const head = this.add.circle(0, -22, 4.2, skin).setStrokeStyle(1, 0x5a4632, 0.8);
        const hat = this.add.triangle(0, -25, 0, 4, 8, 0, -8, 0, 0x3a2e20);
        const pole = this.add.rectangle(10, -18, 1.8, 34, 0x6a5230).setRotation(0.12);
        parts.push(legs, pole, body, head, hat);
        bobbers.push(head, hat); clickable = body;
      } else if (figure === "priest") {
        // Ashk — hooded, a cupped cinder-glow at the hands
        const robe = this.add.rectangle(0, -13, 13, 15, robeCol).setStrokeStyle(1.5, 0x201810, 0.9);
        const hood = this.add.triangle(0, -25, 0, 9, 7, -4, -7, -4, robeCol).setStrokeStyle(1, 0x201810, 0.8);
        const head = this.add.circle(0, -22, 4.2, skin).setStrokeStyle(1, 0x5a4632, 0.8);
        const cup = this.add.ellipse(0, -8, 7, 3, 0x2a2018);
        const cinder = this.add.circle(0, -9, 2.6, 0xff7a3a, 0.9);
        parts.push(legs, robe, head, hood, cup, cinder);
        bobbers.push(head, hood);
        this.tweens.add({ targets: cinder, alpha: 0.4, scale: 1.3, duration: 700, yoyo: true, repeat: -1 });
        clickable = robe;
      } else if (figure === "keeper") {
        // Adelheid — a small hand-bell
        const robe = this.add.rectangle(0, -13, 12, 15, robeCol).setStrokeStyle(1.5, 0x201810, 0.9);
        const veil = this.add.triangle(0, -24, 0, 7, 7, -3, -7, -3, robeCol);
        const head = this.add.circle(0, -22, 4.2, skin).setStrokeStyle(1, 0x5a4632, 0.8);
        const bellBody = this.add.triangle(9, -12, 0, 4, 4, -4, -4, -4, 0xb08a3a).setStrokeStyle(1, 0x6a5020);
        const clapper = this.add.circle(9, -8, 1, 0x6a5020);
        parts.push(legs, robe, head, veil, bellBody, clapper);
        bobbers.push(head, veil);
        this.tweens.add({ targets: [bellBody, clapper], angle: 8, duration: 900, yoyo: true, repeat: -1, ease: "sine.inout" });
        clickable = robe;
      } else if (figure === "squire") {
        // Tomas — kneeling, polishing a piece of plate
        const body = this.add.rectangle(0, -9, 11, 11, robeCol).setStrokeStyle(1.5, 0x201810, 0.9);
        const head = this.add.circle(-1, -18, 4, skin).setStrokeStyle(1, 0x5a4632, 0.8);
        const plate = this.add.rectangle(9, -6, 6, 9, 0x8a8f9a).setStrokeStyle(1, 0x50545c);
        const gleam = this.add.rectangle(9, -7, 2, 6, 0xd8dce4, 0.7);
        parts.push(legs, body, head, plate, gleam);
        bobbers.push(head);
        this.tweens.add({ targets: gleam, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
        clickable = body;
      } else if (figure === "warden") {
        // Cael / Jenda — a spear-staff and a watchful stance
        const body = this.add.rectangle(0, -13, 12, 15, robeCol).setStrokeStyle(1.5, 0x201810, 0.9);
        const cloak = this.add.rectangle(-1, -14, 9, 13, robeCol).setStrokeStyle(1, 0x14100a, 0.5);
        const head = this.add.circle(0, -23, 4.4, skin).setStrokeStyle(1, 0x5a4632, 0.8);
        const hood = this.add.triangle(0, -26, 0, 6, 6, -3, -6, -3, robeCol);
        const spear = this.add.rectangle(9, -16, 1.8, 30, 0x4a3826);
        const tip = this.add.triangle(9, -30, 0, -5, 3, 1, -3, 1, 0x9aa0aa).setStrokeStyle(1, 0x50545c);
        parts.push(legs, spear, tip, cloak, body, head, hood);
        bobbers.push(head, hood); clickable = body;
      } else {
        // elder / witch — a hooded robe; the elder keeps a glowing staff
        const robe = this.add.rectangle(0, -13, 13, 15, robeCol).setStrokeStyle(1.5, 0x201810, 0.9);
        const hood = this.add.triangle(0, -25, 0, 8, 7, -4, -7, -4, robeCol).setStrokeStyle(1, 0x201810, 0.8);
        const head = this.add.circle(0, -22, 4.4, skin).setStrokeStyle(1, 0x5a4632, 0.8);
        parts.push(legs, robe, head, hood);
        bobbers.push(head, hood);
        if (figure === "elder") {
          const beard = this.add.triangle(0, -18, 0, 7, 4, -2, -4, -2, 0xcfc6b8);
          const staff = this.add.rectangle(9, -14, 2, 26, 0x4a3420);
          const knob = this.add.circle(9, -27, 2.4, 0xc9a44a).setStrokeStyle(1, 0x6a5020, 0.9);
          parts.push(beard, staff, knob);
          bobbers.push(beard);
          this.tweens.add({ targets: knob, alpha: 0.55, duration: 1100, yoyo: true, repeat: -1, ease: "sine.inout" });
        } else {
          // witch — a hanging charm instead of a staff
          const charm = this.add.circle(-8, -12, 2, 0xb0d090, 0.8).setStrokeStyle(1, 0x6a8a4a);
          parts.push(charm);
          this.tweens.add({ targets: charm, alpha: 0.4, duration: 1000, yoyo: true, repeat: -1 });
        }
        clickable = robe;
      }
      this.tweens.add({ targets: bobbers, y: "-=1", duration: 1300, yoyo: true, repeat: -1, ease: "sine.inout" });
    } else if (s.kind === "barkeep") {
      // the indoor folk: a barkeep behind an implied counter, or a hut resident by the fire
      const homesteader = townNpcById(s.variant)?.figure === "homesteader";
      const legs = this.add.rectangle(0, -3, 9, 6, 0x2c2420);
      const bobbers: Phaser.GameObjects.GameObject[] = [];
      if (homesteader) {
        // a shawled figure, small and still, warming their hands
        const robe = this.add.rectangle(0, -12, 12, 15, 0x5a4a4a).setStrokeStyle(1.5, 0x2a2018, 0.9);
        const shawl = this.add.triangle(0, -16, 0, -6, 8, 4, -8, 4, 0x6a5a54).setStrokeStyle(1, 0x352a24, 0.8);
        const head = this.add.circle(0, -22, 4.4, 0xd0b090).setStrokeStyle(1, 0x5a4632, 0.8);
        const bun = this.add.circle(0, -25, 3, 0xb0a090);
        const emberGlow = this.add.circle(0, -8, 3, 0xff8a3a, 0.55);
        parts.push(legs, robe, shawl, head, bun, emberGlow);
        bobbers.push(head, bun);
        this.tweens.add({ targets: emberGlow, alpha: 0.25, duration: 900, yoyo: true, repeat: -1, ease: "sine.inout" });
        clickable = robe;
      } else {
        // a barkeep: rolled sleeves, a long apron, a tankard in one hand
        const body = this.add.rectangle(0, -12, 13, 14, 0x5a3a2a).setStrokeStyle(1.5, 0x2e1c12, 0.9);
        const apron = this.add.rectangle(0, -9, 9, 12, 0xb8a882).setStrokeStyle(1, 0x6a5a3a);
        const head = this.add.circle(0, -23, 4.8, 0xd0b090).setStrokeStyle(1, 0x5a4632, 0.8);
        const hair = this.add.ellipse(0, -26, 9, 4, 0x3a2a1c);
        const stache = this.add.rectangle(0, -20, 6, 1.6, 0x3a2a1c);
        const tankard = this.add.rectangle(9, -12, 4, 6, 0x8a7a4a).setStrokeStyle(1, 0x4a3a1e);
        const foam = this.add.ellipse(9, -15, 5, 2.4, 0xf0e8d0);
        parts.push(legs, body, apron, head, hair, stache, tankard, foam);
        bobbers.push(head, hair, stache);
        // he lifts the tankard now and then — pouring, wiping, pouring
        this.tweens.add({ targets: [tankard, foam], y: "-=2", duration: 1400, yoyo: true, repeat: -1, ease: "sine.inout" });
        clickable = body;
      }
      this.tweens.add({ targets: bobbers, y: "-=1", duration: 1200, yoyo: true, repeat: -1, ease: "sine.inout" });
    } else if (s.kind === "encounter") {
      const enc = encounterById(s.variant);
      if (enc?.kind === "boon") {
        // a pale figure — a wan standing wisp, hand held out
        const wisp = this.add.ellipse(0, -14, 12, 22, 0xb0a0d0, 0.5).setStrokeStyle(1.5, 0xd8cff0, 0.6);
        const head = this.add.circle(0, -24, 3.6, 0xd8cff0, 0.7);
        parts.push(wisp, head);
        this.tweens.add({ targets: [wisp, head], alpha: 0.35, y: "-=2", duration: 1200, yoyo: true, repeat: -1, ease: "sine.inout" });
        clickable = wisp;
      } else {
        // vignette AND ambush look the same — a huddled shape you can't quite read
        const body = this.add.ellipse(0, -8, 16, 12, 0x2a2630).setStrokeStyle(1.5, 0x4a4458, 0.8);
        const head = this.add.circle(-2, -15, 4, 0x3a3444).setStrokeStyle(1, 0x5a5468, 0.7);
        const mark = this.add.circle(0, -8, 15, 0x8a7ab0, 0).setStrokeStyle(1, 0x8a7ab0, 0.25);
        parts.push(mark, body, head);
        this.tweens.add({ targets: mark, alpha: 0.15, scale: 1.12, duration: 1400, yoyo: true, repeat: -1, ease: "sine.inout" });
        clickable = body;
      }
    } else if (s.kind === "riftportal" || s.kind === "riftexit") {
      // a standing obelisk wreathed in a swirling vortex — violet to push, green to leave
      const swirl = s.kind === "riftexit" ? 0x60d0a0 : 0xb060ff;
      const base = this.add.ellipse(0, -2, 26, 12, 0x000000, 0.5);
      const vortex = this.add.ellipse(0, -18, 20, 30, swirl, 0.28).setStrokeStyle(2, swirl, 0.9);
      const core = this.add.ellipse(0, -18, 8, 18, swirl, 0.55);
      parts.push(base, vortex, core);
      this.tweens.add({ targets: vortex, angle: 360, duration: 2600, repeat: -1 });
      this.tweens.add({ targets: core, scaleX: 0.4, alpha: 0.9, duration: 700, yoyo: true, repeat: -1, ease: "sine.inOut" });
      clickable = vortex;
    } else if (s.kind === "tome") {
      const book = this.add.rectangle(0, -7, 14, 10, 0xcfc2a0).setStrokeStyle(1, 0x6a5a3a);
      const spine = this.add.rectangle(-6, -7, 3, 10, 0x8a6a3a);
      parts.push(book, spine);
      clickable = book;
    } else if (s.kind === "reliquary") {
      // the Archive: a stone lectern holding an open tome, lit from within
      const post = this.add.rectangle(0, -8, 4, 14, 0x4a4256).setStrokeStyle(1, 0x2a2436);
      const foot = this.add.ellipse(0, -1, 14, 5, 0x3a3446).setStrokeStyle(1, 0x241f30);
      const slope = this.add.rectangle(0, -17, 18, 4, 0x5a5068).setStrokeStyle(1, 0x2a2436).setRotation(-0.12);
      const pageL = this.add.rectangle(-4, -19, 8, 9, 0xe8e0f4).setStrokeStyle(1, 0x9a8fb0).setRotation(-0.12);
      const pageR = this.add.rectangle(4, -18, 8, 9, 0xd8cfec).setStrokeStyle(1, 0x9a8fb0).setRotation(-0.12);
      const glow = this.add.ellipse(0, -20, 12, 9, 0xb49ae8, 0.5);
      parts.push(foot, post, slope, pageL, pageR, glow);
      this.tweens.add({ targets: glow, alpha: 0.2, duration: 1200, yoyo: true, repeat: -1, ease: "sine.inout" });
      clickable = slope;
    } else if (s.kind === "setpiece") {
      // a standing scene you walk past and read — drawn per the set-piece's look
      const look = setpieceById(s.variant)?.variant ?? "cairn";
      if (look === "altar") {
        // a Ternion altar-stone: a low block crowned with a faint ring of threes
        const block = this.add.rectangle(0, -7, 20, 12, 0x4a4842).setStrokeStyle(1.5, 0x2a2824);
        const top = this.add.ellipse(0, -13, 20, 7, 0x585650).setStrokeStyle(1, 0x2a2824);
        const r1 = this.add.circle(-5, -14, 1.8, 0xb49ae8, 0.9);
        const r2 = this.add.circle(5, -14, 1.8, 0xb49ae8, 0.9);
        const r3 = this.add.circle(0, -11, 1.8, 0xb49ae8, 0.9);
        parts.push(block, top, r1, r2, r3);
        this.tweens.add({ targets: [r1, r2, r3], alpha: 0.35, duration: 1100, yoyo: true, repeat: -1, ease: "sine.inout" });
        clickable = block;
      } else if (look === "shroud") {
        // a wrapped family: three seated bound shapes, tallest to smallest
        const a = this.add.ellipse(-7, -9, 8, 16, 0xa89a7c).setStrokeStyle(1, 0x6a5e46);
        const b2 = this.add.ellipse(0, -8, 7, 14, 0x9c8e70).setStrokeStyle(1, 0x6a5e46);
        const cc = this.add.ellipse(6, -7, 6, 11, 0x90826a).setStrokeStyle(1, 0x6a5e46);
        parts.push(a, b2, cc);
        clickable = b2;
      } else if (look === "ferry") {
        // a drowned mooring: a leaning post, a crossarm, a dead lantern
        const post = this.add.rectangle(0, -12, 3, 24, 0x4a3826).setStrokeStyle(1, 0x2a1e12).setRotation(0.08);
        const arm = this.add.rectangle(4, -20, 12, 2.5, 0x4a3826).setRotation(0.08);
        const rope = this.add.rectangle(9, -14, 1, 10, 0x6a5a3a);
        const lantern = this.add.circle(9, -20, 2.6, 0x8a7a4a).setStrokeStyle(1, 0x3a2f18);
        const water = this.add.ellipse(0, 0, 26, 8, 0x24303a, 0.5);
        parts.push(water, post, arm, rope, lantern);
        clickable = post;
      } else if (look === "marker") {
        // a sentry's grave: a sword planted through a shield, ash at its base
        const ash = this.add.ellipse(0, -1, 20, 7, 0x3a3630, 0.6);
        const shield = this.add.ellipse(0, -9, 12, 15, 0x5a5560).setStrokeStyle(1.5, 0x33303a);
        const blade = this.add.rectangle(0, -16, 2.4, 22, 0xaab0b8).setStrokeStyle(1, 0x585e66);
        const guard = this.add.rectangle(0, -22, 9, 2.2, 0x6a6a74);
        const grip = this.add.rectangle(0, -27, 2.2, 5, 0x4a3826);
        parts.push(ash, shield, blade, guard, grip);
        clickable = shield;
      } else {
        // cairn: a stack of memorial stones with a small token on top
        const s1 = this.add.ellipse(0, -3, 16, 7, 0x5a5650).setStrokeStyle(1, 0x33302a);
        const s2 = this.add.ellipse(0, -9, 12, 6, 0x625e56).setStrokeStyle(1, 0x33302a);
        const s3 = this.add.ellipse(0, -14, 8, 5, 0x6a665c).setStrokeStyle(1, 0x33302a);
        const token = this.add.circle(0, -19, 2, 0xc8a860, 0.95);
        parts.push(s1, s2, s3, token);
        this.tweens.add({ targets: token, alpha: 0.5, duration: 1300, yoyo: true, repeat: -1, ease: "sine.inout" });
        clickable = s2;
      }
    } else {
      const pillar = this.add.rectangle(0, -16, 8, 28, 0x3a3a46).setStrokeStyle(1, accent, 0.8);
      const orb = this.add.circle(0, -32, 5, accent, 0.95);
      parts.push(pillar, orb);
      this.tweens.add({ targets: orb, y: -36, duration: 900, yoyo: true, repeat: -1, ease: "sine.inout" });
      clickable = pillar;
    }

    const label = this.add
      .text(0, -46, s.label, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#" + accent.toString(16).padStart(6, "0"),
        backgroundColor: "#0c0c12cc",
        padding: { x: 3, y: 2 },
      })
      .setOrigin(0.5);
    container.add([...parts]);
    // magical interactables (portals, waypoint, altar, shrines) bleed their own
    // light — a true per-object glow in their hue, not a flat colored disc
    if (!isNpc && s.kind !== "chest" && s.kind !== "stash") {
      container.postFX?.addGlow(accent, 2.6, 0, false, 0.08, 14);
    }
    label.setPosition(container.x, container.y - 46).setDepth(885_000);

    for (const obj of [clickable, label]) {
      obj.setInteractive({ useHandCursor: true });
      obj.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (pointer.rightButtonDown()) return; // right-click is for fighting
        if (s.used) return;
        this.lootClickAt = this.time.now; // grace: the scene click must not cancel this (THE bug)
        this.pendingShrine = id;
        this.startAutoWalk(s.x, s.y);
      });
    }

    this.shrineEnts.set(id, { container, schema: s, label });
  }

  // --- entities ---

  private addHpBar(container: Phaser.GameObjects.Container, y: number, color: number, width = 24) {
    const bg = this.add.rectangle(-(width / 2) - 1, y, width + 2, 4, 0x000000, 0.6).setOrigin(0, 0.5);
    const fg = this.add.rectangle(-(width / 2), y, width, 2, color).setOrigin(0, 0.5);
    container.add([bg, fg]);
    return fg;
  }

  private addPlayer(player: any, sessionId: string) {
    const isSelf = sessionId === this.room?.sessionId;
    const color = CLASS_COLORS[player.cls] ?? 0xaaaaaa;
    if (isSelf) this.myCls = player.cls;

    const container = this.add.container(0, 0);
    const shadow = this.add.ellipse(0, 0, 26, 13, 0x000000, 0.35);

    // layered figure: legs / arms / tunic / head / hair — class-flavored proportions
    const figure = this.add.container(0, 0);
    const torsoW = player.cls === "barbarian" ? 14 : player.cls === "paladin" ? 13 : 11;
    const tallRobe = player.cls === "sorcerer" || player.cls === "necromancer";
    const torsoH = tallRobe ? 17 : 12;
    const torsoY = tallRobe ? -14 : -15;
    // limbs pivot at their tops so the walk cycle swings from hip and shoulder
    const legL = this.add.rectangle(-2.5, -9, 3.5, 8, 0x39332b).setOrigin(0.5, 0);
    const legR = this.add.rectangle(2.5, -9, 3.5, 8, 0x39332b).setOrigin(0.5, 0);
    const armColor = Phaser.Display.Color.IntegerToColor(color).darken(20).color;
    const armB = this.add.rectangle(-torsoW / 2 - 1, -20, 3, 9, armColor).setOrigin(0.5, 0);
    const armF = this.add.rectangle(torsoW / 2 + 1, -20, 3, 9, armColor).setOrigin(0.5, 0);
    const torso = this.add.rectangle(0, torsoY, torsoW, torsoH, color);
    torso.setStrokeStyle(1, 0x000000, 0.55);
    const head = this.add.circle(0, -25, 5, 0xd8b090);
    head.setStrokeStyle(1, 0x000000, 0.35);
    const HAIR: Record<string, number> = {
      barbarian: 0x6b3a24, rogue: 0x1e4a2a, sorcerer: 0x2a2a4a,
      paladin: 0xd8c890, necromancer: 0x2a3a34, druid: 0x4a3a1e,
    };
    const hairColor = HAIR[player.cls] ?? 0x2a2a4a;
    const hooded = player.cls === "rogue" || player.cls === "necromancer";
    const hair: Phaser.GameObjects.Shape = hooded
      ? this.add.triangle(0, -28, 0, 6, 5, -3, -5, -3, hairColor) // hood peak
      : this.add.rectangle(0, -29, 9, 4, hairColor);
    figure.add([legL, legR, armB, torso, head, hair, armF]);

    container.add([shadow, figure]);

    if (isSelf) {
      const ring = this.add.ellipse(0, 0, 30, 15, 0xffffff, 0);
      ring.setStrokeStyle(2, 0xffffff, 0.7);
      container.add(ring);
    }
    const body = torso;

    const label = this.add
      .text(0, -40, `${player.hardcore ? "☠ " : ""}${player.name || player.cls} · ${player.level}`, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: player.hardcore ? (isSelf ? "#ffb8c0" : "#c08a92") : isSelf ? "#ffffff" : "#9a9aa8",
      })
      .setOrigin(0.5);
    container.add(label);

    const hpFg = this.addHpBar(container, -30, 0x3fbf5f);

    const s = worldToScreen(player.x, player.y);
    container.setPosition(s.x, s.y).setDepth(s.y);

    const ent: Entity = {
      container, body, baseColor: color, hpFg, schema: player, label,
      lastLevel: player.level, figure, hairShape: hair, gearSig: "",
      legL, legR, armF, armB, torsoShape: torso,
    };
    this.players.set(sessionId, ent);
    this.refreshGear(ent);

    if (isSelf) this.cameras.main.startFollow(container, false, 0.08, 0.08);
  }

  // draw equipped gear on the figure, from synced base keys —
  // your armor is your silhouette: robes drape, plate gleams, boots march
  private refreshGear(ent: Entity) {
    const fig = ent.figure;
    if (!fig) return;
    const sig = `${ent.schema.weaponBase}|${ent.schema.offhandBase}|${ent.schema.helmBase}|${ent.schema.chestBase}|${ent.schema.bootsBase}|${ent.schema.beltBase}|${ent.schema.gearTier ?? 0}`;
    if (sig === ent.gearSig) return;
    ent.gearSig = sig;

    ent.weaponImg?.destroy();
    ent.offhandImg?.destroy();
    ent.helmImg?.destroy();
    ent.weaponImg = ent.offhandImg = ent.helmImg = undefined;
    ent.beltShape?.forEach((o) => o.destroy());
    ent.pauldrons?.forEach((o) => o.destroy());
    ent.helmFlair?.forEach((o) => o.destroy());
    ent.beltShape = ent.pauldrons = ent.helmFlair = undefined;
    ent.aura?.destroy();
    ent.aura = undefined;

    // your best rarity is visible from across the room — the decked-out glow
    const tier = ent.schema.gearTier ?? 0;
    if (tier >= 3) {
      const color = RARITY_COLORS[RARITY_ORDER[tier]] ?? 0xffffff;
      const aura = this.add.ellipse(0, 1, 34, 16, color, 0.16);
      aura.setStrokeStyle(1.5, color, 0.5);
      ent.container.addAt(aura, 0); // beneath the shadow and figure
      this.tweens.add({
        targets: aura,
        alpha: 0.55,
        scaleX: 1.12,
        scaleY: 1.12,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "sine.inout",
      });
      ent.aura = aura;
    }

    // chest armor recolors the torso and arms
    const CHEST_STYLES: Record<string, { color: number; stroke: number; pauldrons?: boolean }> = {
      robe: { color: 0x4a3d6a, stroke: 0x2a2340 },
      leather: { color: 0x6a4a2c, stroke: 0x3d2a18 },
      studded: { color: 0x5a3f26, stroke: 0x33241a },
      chainmail: { color: 0x8a8f9a, stroke: 0xb8bcc8 },
      plate: { color: 0xb0b4c0, stroke: 0xd8dce4, pauldrons: true },
    };
    const chest = CHEST_STYLES[ent.schema.chestBase];
    const torsoColor = chest?.color ?? ent.baseColor;
    ent.torsoShape?.setFillStyle(torsoColor).setStrokeStyle(1, chest?.stroke ?? 0x000000, 0.7);
    const armColor = Phaser.Display.Color.IntegerToColor(torsoColor).darken(20).color;
    ent.armF?.setFillStyle(armColor);
    ent.armB?.setFillStyle(armColor);
    if (chest?.pauldrons && ent.torsoShape) {
      const w = ent.torsoShape.width;
      const y = ent.torsoShape.y - ent.torsoShape.height / 2 + 1;
      const pl = this.add.rectangle(-w / 2 - 1, y, 5, 4, 0xd0d4dc).setStrokeStyle(1, 0x6a6e78);
      const pr = this.add.rectangle(w / 2 + 1, y, 5, 4, 0xd0d4dc).setStrokeStyle(1, 0x6a6e78);
      fig.add([pl, pr]);
      ent.pauldrons = [pl, pr];
    }

    // boots recolor the legs
    const BOOT_COLORS: Record<string, number> = { boots: 0x5a4632, greaves: 0x9aa0ae };
    const legColor = BOOT_COLORS[ent.schema.bootsBase] ?? 0x39332b;
    ent.legL?.setFillStyle(legColor);
    ent.legR?.setFillStyle(legColor);

    // a belt is a waist-wrap with a buckle
    const BELT_COLORS: Record<string, number> = { sash: 0x7a2a34, warbelt: 0x54402a, girdle: 0x8a8f9a };
    const beltColor = BELT_COLORS[ent.schema.beltBase];
    if (beltColor !== undefined && ent.torsoShape) {
      const by = ent.torsoShape.y + ent.torsoShape.height / 2 - 2;
      const strap = this.add.rectangle(0, by, ent.torsoShape.width + 1, 2.5, beltColor);
      const buckle = this.add.rectangle(0, by, 3, 3, 0xd8b13a);
      fig.add([strap, buckle]);
      ent.beltShape = [strap, buckle];
    }

    const ob = ent.schema.offhandBase;
    if (ob && this.textures.exists(`icon_${ob}`)) {
      ent.offhandImg = this.add.image(-8, -14, `icon_${ob}`).setScale(0.5);
      fig.add(ent.offhandImg);
    }
    const wb = ent.schema.weaponBase;
    if (wb && this.textures.exists(`icon_${wb}`)) {
      // heft: a Grandfather should LOOK like a Grandfather
      const WEAPON_SCALE: Record<string, number> = {
        dagger: 0.5, wand: 0.52, club: 0.55, shortsword: 0.56, scepter: 0.58,
        bow: 0.62, waraxe: 0.64, morningstar: 0.64,
        warstaff: 0.74, maul: 0.76, greatsword: 0.78, scythe: 0.78, greataxe: 0.8,
      };
      ent.weaponImg = this.add
        .image(9, -13, `icon_${wb}`)
        .setOrigin(0.5, 0.72)
        .setScale(WEAPON_SCALE[wb] ?? 0.6)
        .setRotation(-0.7);
      fig.add(ent.weaponImg);
    }
    const hb = ent.schema.helmBase;
    if (hb && this.textures.exists(`icon_${hb}`)) {
      ent.helmImg = this.add.image(0, -27, `icon_${hb}`).setScale(0.48);
      fig.add(ent.helmImg);
      // headgear silhouettes you can read at a glance
      if (hb === "crown" || hb === "circlet") {
        const gold = this.add.rectangle(0, -32, hb === "crown" ? 10 : 8, 1.8, 0xd8b13a);
        const gem = this.add.circle(0, -32, 1.3, hb === "crown" ? 0xb04858 : 0x8ad0ff);
        fig.add([gold, gem]);
        ent.helmFlair = [gold, gem];
      } else if (hb === "greathelm") {
        const hornL = this.add.triangle(-5, -31, 0, 5, -3, -5, 2, 1, 0xd8d4c0);
        const hornR = this.add.triangle(5, -31, 0, 5, 3, -5, -2, 1, 0xd8d4c0);
        fig.add([hornL, hornR]);
        ent.helmFlair = [hornL, hornR];
      }
    }
    ent.hairShape?.setVisible(!ent.helmImg);
  }

  private addMonster(monster: any, id: string) {
    const def = MONSTERS[monster.kind as MonsterKind] ?? MONSTERS.zombie;
    const isBoss = isBossKind(monster.kind);

    const container = this.add.container(0, 0);
    const shadow = this.add.ellipse(0, 0, def.radius * 2.6, def.radius * 1.3, 0x000000, 0.35);
    const { figure, body, baseColor, anims } = buildMonsterFigure(this, monster.kind);

    // bosses stand on a slow-burning sigil
    if (isBoss) {
      const ring = this.add.ellipse(0, 2, def.radius * 3.4, def.radius * 1.7, 0xd83a2a, 0);
      ring.setStrokeStyle(2, monster.kind === "bovax" ? 0xd8b13a : 0xd83a2a, 0.55);
      container.add(ring);
      anims.push(this.tweens.add({ targets: ring, scaleX: 1.15, scaleY: 1.15, alpha: 0.25, duration: 1100, yoyo: true, repeat: -1, ease: "sine.inout" }));
    }

    container.add([shadow, figure]);

    const isChampion = !!monster.modifier && !monster.elite;
    if (monster.elite || isChampion) {
      const champMod = CHAMPION_MODS.find((c) => c.id === monster.modifier);
      const auraColor = monster.elite ? 0xffd54a : champMod?.aura ?? 0x6a8cff;
      const aura = this.add.circle(0, -def.radius - 2, def.radius + 4, auraColor, 0);
      aura.setStrokeStyle(2, auraColor, 0.85);
      container.add(aura);
      this.tweens.add({ targets: aura, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    }

    // ghostly champions render translucent
    const mod = CHAMPION_MODS.find((c) => c.id === monster.modifier);
    if (mod?.alpha) container.setAlpha(mod.alpha + 0.15);

    const displayName = monster.name;
    if (displayName) {
      const label = this.add
        .text(0, -def.radius * 2 - 22, displayName, {
          fontFamily: "monospace",
          fontSize: monster.kind === "goblin" || isChampion ? "10px" : "12px",
          color: isBoss ? "#ff6655" : isChampion ? "#6a8cff" : "#ffd54a",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      container.add(label);
    }

    const hpFg = this.addHpBar(container, -def.radius * 2 - 8, 0xd04040, isBoss ? 44 : 24);

    const s = worldToScreen(monster.x, monster.y);
    container.setPosition(s.x, s.y).setDepth(s.y);

    // the restless dead don't walk in — they climb OUT
    if (["zombie", "skeleton", "archer", "wraith", "entombed"].includes(monster.kind)) {
      figure.setAlpha(0);
      figure.y = 16;
      figure.scaleY = 0.25;
      this.tweens.add({ targets: figure, alpha: 1, y: 0, scaleY: 1, duration: 520, ease: "back.out" });
      for (let i = 0; i < 5; i++) {
        const dirt = this.add
          .rectangle(s.x + (Math.random() - 0.5) * 18, s.y, 3, 2, 0x4a3a26, 0.9)
          .setDepth(s.y + 1);
        this.tweens.add({
          targets: dirt,
          x: dirt.x + (Math.random() - 0.5) * 26,
          y: s.y - 10 - Math.random() * 14,
          alpha: 0,
          duration: 380 + Math.random() * 200,
          ease: "quad.out",
          onComplete: () => dirt.destroy(),
        });
      }
    }

    this.monsters.set(id, { container, body, baseColor, hpFg, schema: monster, figure, anims });
  }

  private addProjectile(proj: any, id: string) {
    const container = this.add.container(0, 0);
    let rotatable: Phaser.GameObjects.Rectangle | undefined;

    if (proj.kind === "fireball") {
      container.add(this.add.circle(0, -12, 9, 0xff6622, 0.35));
      container.add(this.add.circle(0, -12, 5, 0xffaa33));
      this.sfx.fireball();
    } else if (proj.kind === "bone") {
      rotatable = this.add.rectangle(0, -12, 13, 4, 0xe8e4d4);
      rotatable.setStrokeStyle(1, 0x8a8578, 0.8);
      container.add(rotatable);
      this.sfx.arrow();
    } else if (proj.kind === "thorn") {
      container.add(this.add.circle(0, -12, 7, 0x3fae5f, 0.3));
      rotatable = this.add.rectangle(0, -12, 11, 3, 0x5fce7f);
      container.add(rotatable);
      this.sfx.arrow();
    } else if (proj.kind === "hammer") {
      const h = this.add.rectangle(0, -12, 8, 8, 0xffe08a);
      h.setStrokeStyle(1, 0xb8912a);
      container.add(h);
      this.tweens.add({ targets: h, rotation: Math.PI * 2, duration: 500, repeat: -1 });
      this.sfx.swing();
    } else if (proj.kind === "orb") {
      container.add(this.add.circle(0, -12, 8, 0x8ad0ff, 0.35));
      container.add(this.add.circle(0, -12, 4, 0xcdefff));
      this.sfx.zap();
    } else if (proj.kind === "bossarrow") {
      rotatable = this.add.rectangle(0, -12, 15, 3, 0xff7070);
      container.add(rotatable);
      this.sfx.arrow();
    } else if (proj.kind === "mobarrow") {
      rotatable = this.add.rectangle(0, -12, 12, 2, 0xd8a080);
      container.add(rotatable);
      this.sfx.arrow();
    } else if (proj.kind === "quill") {
      // a spat spine, barbed and unpleasant
      rotatable = this.add.rectangle(0, -12, 9, 1.8, 0x9a7a4a);
      rotatable.setStrokeStyle(1, 0x5a4428, 0.9);
      container.add(rotatable);
      this.sfx.arrow();
    } else if (proj.kind === "hexbolt") {
      // cultist hex: a wobbling knot of wrong light
      container.add(this.add.circle(0, -12, 6, 0x8a3ae8, 0.3));
      container.add(this.add.circle(0, -12, 3, 0xd88aff));
      this.sfx.zap();
    } else if (proj.kind === "bloodstar") {
      container.add(this.add.circle(0, -12, 7, 0xd82848, 0.35));
      container.add(this.add.circle(0, -12, 3.5, 0xff7090));
      this.sfx.fireball();
    } else if (proj.kind === "frostbolt") {
      // a splinter of deep cold — pale blue crystal with a frosty halo
      container.add(this.add.circle(0, -12, 6, 0x8ec8f0, 0.3));
      rotatable = this.add.rectangle(0, -12, 11, 3, 0xdff2ff).setStrokeStyle(1, 0x8ec8f0, 0.9);
      container.add(rotatable);
      this.sfx.zap();
    } else {
      rotatable = this.add.rectangle(0, -12, 14, 3, 0xe8d9a0);
      container.add(rotatable);
      this.sfx.arrow();
    }

    const s = worldToScreen(proj.x, proj.y);
    container.setPosition(s.x, s.y).setDepth(s.y);
    this.projectiles.set(id, { container, schema: proj, lastX: s.x, lastY: s.y, rotatable, trailColor: PROJ_TRAIL[proj.kind] ?? 0xe8d9a0 });
  }

  private addLoot(g: any, id: string) {
    const s = worldToScreen(g.x, g.y);
    const container = this.add.container(s.x, s.y).setDepth(s.y);

    if (g.kind === "gold") {
      container.add(this.add.ellipse(2, -2, 10, 5, 0xa8842a));
      container.add(this.add.ellipse(-3, -4, 12, 6, 0xd8b13a).setStrokeStyle(1, 0x6b5518));
      const label = this.add
        .text(0, -20, g.name, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: "#d8b13a",
          backgroundColor: "#0c0c12cc",
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5);
      label.setInteractive({ useHandCursor: true });
      label.on("pointerdown", () => this.targetLoot(id));
      label.setPosition(container.x, container.y - 20).setDepth(880_000);
      this.loot.set(id, { container, schema: g, label, labelBaseY: -20 });
      this.lootDirty = true;
      return;
    }

    if (g.kind === "potion" || g.kind === "manapotion") {
      // little flask — red for life, blue for mind
      const blue = g.kind === "manapotion";
      const img = this.add.image(0, -8, "icon_potion").setScale(0.62);
      if (blue) img.setTint(0x5a8cff);
      container.add(img);
      const label = this.add
        .text(0, -26, g.name, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: blue ? "#6a9aef" : "#e06868",
          backgroundColor: "#0c0c12dd",
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5);
      label.setInteractive({ useHandCursor: true });
      label.on("pointerdown", () => this.targetLoot(id));
      label.setPosition(container.x, container.y - 26).setDepth(880_000);
      this.loot.set(id, { container, schema: g, label, labelBaseY: -26 });
      this.lootDirty = true;
      return;
    }

    const color = RARITY_COLORS[g.rarity as keyof typeof RARITY_COLORS] ?? 0xd0d0d0;

    // beam of light for rare and above — the moment that matters
    const isBig = g.rarity !== "common" && g.rarity !== "magic";

    // every drop rests in a soft pool of its rarity's light (bloom makes it glow)
    const pool = this.add
      .ellipse(0, 3, isBig ? 46 : 30, isBig ? 22 : 15, color, isBig ? 0.3 : 0.17)
      .setBlendMode(Phaser.BlendModes.ADD);
    container.add(pool);
    this.tweens.add({ targets: pool, scaleX: 1.16, scaleY: 1.16, alpha: isBig ? 0.5 : 0.28, duration: 950, yoyo: true, repeat: -1 });

    if (isBig) {
      const beamOuter = this.add.rectangle(0, -54, 13, 104, color, 0.16).setOrigin(0.5, 0.5);
      const beamInner = this.add.rectangle(0, -54, 5, 104, color, 0.45).setOrigin(0.5, 0.5);
      const beamCore = this.add.rectangle(0, -54, 1.6, 104, 0xffffff, 0.55).setOrigin(0.5, 0.5); // bright core
      beamInner.preFX?.addGlow(color, 3, 0, false, 0.1, 10); // the beam bleeds its rarity's light
      container.add([beamOuter, beamInner, beamCore]);
      this.tweens.add({ targets: [beamOuter, beamInner, beamCore], alpha: 0.6, duration: 700, yoyo: true, repeat: -1 });
    }

    // the item itself, drawn as its icon when we have one
    let base = "";
    try {
      base = JSON.parse(g.data)?.base ?? "";
    } catch {
      /* legacy/unknown item payload */
    }
    if (base.startsWith("rune_")) {
      container.add(this.add.image(0, -10, "icon_runestone").setScale(0.65));
      container.add(
        this.add
          .text(0, -11, g.name.split(" ")[0], {
            fontFamily: "monospace", fontSize: "8px", color: "#ffb066", fontStyle: "bold",
          })
          .setOrigin(0.5)
      );
    } else if (base && this.textures.exists(`icon_${base}`)) {
      container.add(this.add.image(0, -10, `icon_${base}`).setScale(0.7));
    } else {
      const glyph = this.add.polygon(0, -6, [0, -7, 7, 0, 0, 7, -7, 0], color, 1);
      glyph.setStrokeStyle(1, 0x000000, 0.5);
      container.add(glyph);
    }

    const label = this.add
      .text(0, -26, g.name, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: base.startsWith("rune_") ? "#ff8033" : rarityColorStr(g.rarity),
        backgroundColor: "#0c0c12dd",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5);
    label.setInteractive({ useHandCursor: true });
    label.on("pointerdown", () => this.targetLoot(id));
    label.setPosition(container.x, container.y - 26).setDepth(880_000);

    this.loot.set(id, { container, schema: g, label, labelBaseY: -26 });
    this.lootDirty = true;

    const me = this.room ? this.players.get(this.room.sessionId) : undefined;
    if (me && Math.hypot(me.schema.x - g.x, me.schema.y - g.y) < 700) {
      this.sfx.drop(g.rarity);
    }
  }

  // --- skill / combat events ---

  private onLevelUp(msg: { id: string; level: number }) {
    const ent = this.players.get(msg.id);
    if (ent) {
      const cx = ent.container.x;
      const cy = ent.container.y;
      const depth = ent.container.depth;
      // the DING: a pillar of light, triple shockwave, and a rain of sparks
      const pillar = this.add.rectangle(cx, cy - 60, 26, 130, 0xffe9a0, 0.55).setDepth(depth + 2);
      const pillarCore = this.add.rectangle(cx, cy - 60, 10, 130, 0xffffff, 0.75).setDepth(depth + 3);
      this.tweens.add({ targets: [pillar, pillarCore], scaleX: 0.1, alpha: 0, duration: 850, ease: "quad.in", onComplete: () => { pillar.destroy(); pillarCore.destroy(); } });
      for (let i = 0; i < 3; i++) {
        const ring = this.add.ellipse(cx, cy, 26, 13, 0xffd54a, 0)
          .setStrokeStyle(3.5 - i, 0xffd54a, 0.9)
          .setDepth(depth + 1);
        this.tweens.add({ targets: ring, scaleX: 4 + i * 1.6, scaleY: 4 + i * 1.6, alpha: 0, duration: 700 + i * 220, delay: i * 110, onComplete: () => ring.destroy() });
      }
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const spark = this.add.circle(cx, cy - 14, 2.2, i % 3 === 0 ? 0xffffff : 0xffd54a, 0.95).setDepth(depth + 4);
        this.tweens.add({
          targets: spark,
          x: cx + Math.cos(a) * (46 + Math.random() * 26),
          y: cy - 14 + Math.sin(a) * (24 + Math.random() * 14) - 34,
          alpha: 0, scale: 0.3, duration: 700 + Math.random() * 300, ease: "quad.out",
          onComplete: () => spark.destroy(),
        });
      }
      this.floatText(ent.schema.x, ent.schema.y, `LEVEL ${msg.level}!`, "#ffd54a");
    }
    if (msg.id === this.room?.sessionId) {
      // your own ding gets the full ceremony
      this.sfx.ding();
      this.cameras.main.flash(320, 60, 48, 10);
      const w = this.scale.width;
      const big = this.add
        .text(w / 2, this.scale.height * 0.24, `⬆ LEVEL ${msg.level}`, {
          fontFamily: "monospace", fontSize: "40px", color: "#ffd54a", fontStyle: "bold",
          stroke: "#3a2a08", strokeThickness: 6,
        })
        .setOrigin(0.5).setScrollFactor(0).setDepth(2_000_000).setScale(0.3).setAlpha(0);
      const sub = this.add
        .text(w / 2, this.scale.height * 0.24 + 36, "+5 stat points [C]  ·  +1 skill point [S]", {
          fontFamily: "monospace", fontSize: "13px", color: "#c9b988",
        })
        .setOrigin(0.5).setScrollFactor(0).setDepth(2_000_000).setAlpha(0);
      this.tweens.add({ targets: big, scale: 1, alpha: 1, duration: 260, ease: "back.out" });
      this.tweens.add({ targets: sub, alpha: 1, duration: 300, delay: 200 });
      this.tweens.add({ targets: [big, sub], alpha: 0, y: "-=24", duration: 700, delay: 1900, onComplete: () => { big.destroy(); sub.destroy(); } });
    } else {
      this.sfx.levelup();
    }
  }

  private onWhirl(msg: { id: string; x: number; y: number }) {
    const s = worldToScreen(msg.x, msg.y);
    const g = this.add.graphics({ x: s.x, y: s.y - 12 });
    g.lineStyle(3, 0xffe08a, 0.85);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      g.beginPath();
      g.arc(0, 0, 30, a, a + 1.4);
      g.strokePath();
    }
    g.setDepth(s.y + 1);
    this.tweens.add({
      targets: g, rotation: 2.6, alpha: 0, scaleX: 1.5, scaleY: 1.5, duration: 380,
      onComplete: () => g.destroy(),
    });
    this.sfx.whirl();
  }

  private onShout(msg: { id: string; x: number; y: number }) {
    const s = worldToScreen(msg.x, msg.y);
    const ring = this.add.circle(s.x, s.y - 12, 16, 0xffaa33, 0).setStrokeStyle(4, 0xffaa33, 0.8).setDepth(s.y + 1);
    this.tweens.add({ targets: ring, scale: 3.5, alpha: 0, duration: 500, onComplete: () => ring.destroy() });
    this.sfx.shout();
  }

  private onChainFx(msg: { points: Array<{ x: number; y: number }> }) {
    if (!msg.points || msg.points.length < 2) return;
    const g = this.add.graphics().setDepth(950_000);
    for (let i = 0; i < msg.points.length - 1; i++) {
      const a = worldToScreen(msg.points[i].x, msg.points[i].y);
      const b = worldToScreen(msg.points[i + 1].x, msg.points[i + 1].y);
      this.jaggedLine(g, a.x, a.y - 12, b.x, b.y - 12, 0x9ad8ff, 3, 0.9);
      this.jaggedLine(g, a.x, a.y - 12, b.x, b.y - 12, 0xdff2ff, 1, 1);
    }
    this.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() });
    this.sfx.zap();
  }

  private jaggedLine(
    g: Phaser.GameObjects.Graphics,
    x1: number, y1: number, x2: number, y2: number,
    color: number, width: number, alpha: number
  ) {
    const segs = 5;
    const nx = -(y2 - y1);
    const ny = x2 - x1;
    const nlen = Math.hypot(nx, ny) || 1;
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.moveTo(x1, y1);
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const off = (Math.random() * 2 - 1) * 7;
      g.lineTo(x1 + (x2 - x1) * t + (nx / nlen) * off, y1 + (y2 - y1) * t + (ny / nlen) * off);
    }
    g.lineTo(x2, y2);
    g.strokePath();
  }

  private onTeleportFx(msg: { id: string; fromX: number; fromY: number; toX: number; toY: number }) {
    for (const [wx, wy] of [[msg.fromX, msg.fromY], [msg.toX, msg.toY]] as Array<[number, number]>) {
      const s = worldToScreen(wx, wy);
      const burst = this.add.circle(s.x, s.y - 12, 14, 0x7a5ce8, 0.6).setDepth(s.y + 2);
      this.tweens.add({ targets: burst, scale: 2, alpha: 0, duration: 280, onComplete: () => burst.destroy() });
    }
    this.sfx.teleport();
  }

  private onDashFx(msg: { id: string; fromX: number; fromY: number; toX: number; toY: number }) {
    const a = worldToScreen(msg.fromX, msg.fromY);
    const b = worldToScreen(msg.toX, msg.toY);
    const g = this.add.graphics().setDepth(950_000);
    g.lineStyle(4, 0x9fdc9f, 0.6);
    g.lineBetween(a.x, a.y - 12, b.x, b.y - 12);
    this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
    this.sfx.dash();
  }

  private onBossAggro(msg: { kind?: string; name?: string; line?: string }) {
    const line = msg?.line ?? "Meat for the hooks!";
    const name = msg?.name ?? "";
    const cx = this.scale.width / 2;
    const cy = this.scale.height * 0.3;
    const text = this.add
      .text(cx, cy, line.toUpperCase(), {
        fontFamily: "monospace", fontSize: "32px", color: "#ff4433", fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(990_000);
    const sub = this.add
      .text(cx, cy + 28, `— ${name}`, { fontFamily: "monospace", fontSize: "13px", color: "#b06060", fontStyle: "italic" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(990_000);
    this.tweens.add({ targets: [text, sub], alpha: 0, y: "-=22", duration: 2000, onComplete: () => { text.destroy(); sub.destroy(); } });
    this.cameras.main.shake(250, 0.005);
    this.sfx.roar();
  }

  // blood on the stones: splatter decals that linger, then soak away
  private spillBlood(wx: number, wy: number, count: number, big = false) {
    const s = worldToScreen(wx, wy);
    for (let i = 0; i < count; i++) {
      const off = big ? 22 : 12;
      const splat = this.add
        .ellipse(
          s.x + (Math.random() * 2 - 1) * off,
          s.y + (Math.random() * 2 - 1) * off * 0.5,
          (big ? 8 : 4) + Math.random() * (big ? 8 : 5),
          (big ? 4 : 2) + Math.random() * (big ? 4 : 2.5),
          Math.random() < 0.5 ? 0x5a0e0e : 0x430a0a,
          0.75
        )
        .setDepth(s.y - 28); // on the floor, under everything that walks
      this.gore.push(splat);
      this.tweens.add({ targets: splat, alpha: 0, duration: big ? 26000 : 14000, ease: "quad.in", onComplete: () => splat.destroy() });
    }
    // keep the abattoir performant
    while (this.gore.length > 110) {
      const old = this.gore.shift();
      old?.destroy();
    }
  }

  // chunks of whatever that was, briefly airborne
  private spillGibs(wx: number, wy: number, color: number, count = 5) {
    const s = worldToScreen(wx, wy);
    for (let i = 0; i < count; i++) {
      const gib = this.add
        .circle(s.x, s.y - 8, 1.6 + Math.random() * 1.8, Math.random() < 0.4 ? color : 0x6a1010)
        .setDepth(s.y + 3);
      const a = Math.random() * Math.PI * 2;
      const d = 12 + Math.random() * 20;
      this.tweens.add({
        targets: gib,
        x: s.x + Math.cos(a) * d,
        y: s.y - 8 + Math.sin(a) * d * 0.5 + 10, // out, then down
        alpha: 0,
        duration: 380 + Math.random() * 180,
        ease: "quad.out",
        onComplete: () => gib.destroy(),
      });
    }
  }

  // a fountain of light out of a fallen elite/boss — sells the guaranteed-loot payoff
  private lootBurst(wx: number, wy: number, color: number, count: number) {
    const s = worldToScreen(wx, wy);
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() * 2 - 1) * 1.15; // fan upward
      const spd = 34 + Math.random() * 66;
      const spark = this.add.circle(s.x, s.y - 10, 1.8 + Math.random() * 1.8, color, 0.95).setDepth(881_000);
      this.tweens.add({
        targets: spark,
        x: s.x + Math.cos(a) * spd,
        y: s.y - 10 + Math.sin(a) * spd + 22, // arc up and out, gravity pulls it back down
        alpha: 0,
        scale: 0.3,
        duration: 460 + Math.random() * 220,
        ease: "quad.out",
        onComplete: () => spark.destroy(),
      });
    }
  }

  private onHit(msg: { t: string; id: string; amount: number; x: number; y: number; crit?: boolean; by?: string; kill?: boolean; resisted?: boolean }) {
    // monsters bleed where they're struck
    if (msg.t === "m" && Math.random() < 0.55) this.spillBlood(msg.x, msg.y, msg.crit ? 3 : 1);
    if (msg.t === "p" && Math.random() < 0.4) this.spillBlood(msg.x, msg.y, 1);
    if (msg.t === "c") {
      // the Rogue takes a hit — flinch and bleed a little
      if (Math.random() < 0.4) this.spillBlood(msg.x, msg.y, 1);
      const mEnt = this.mercs.get(msg.id);
      if (mEnt) {
        this.tweens.killTweensOf(mEnt.figure);
        mEnt.figure.setScale(mEnt.figure.scaleX, 0.88);
        this.tweens.add({ targets: mEnt.figure, scaleY: 1, duration: 130, ease: "back.out" });
      }
      return;
    }
    const ent = msg.t === "m" ? this.monsters.get(msg.id) : this.players.get(msg.id);
    if (ent) {
      ent.body.setFillStyle(0xffffff);
      this.time.delayedCall(90, () => {
        if (ent.body.active) ent.body.setFillStyle(ent.baseColor);
      });
      // impact pop
      this.tweens.killTweensOf(ent.body);
      ent.body.setScale(1.28);
      this.tweens.add({ targets: ent.body, scale: 1, duration: 130, ease: "back.out" });
    }
    const isSelf = msg.t === "p" && msg.id === this.room?.sessionId;
    const mine = msg.t === "m" && msg.by === this.room?.sessionId; // I dealt this blow
    if (msg.crit && msg.t === "m") {
      // critical strike — big, gold, unmissable, and it grows with the number
      const s = worldToScreen(msg.x, msg.y);
      this.combatFlash(s.x, s.y, 0xffdf80, 84); // a golden spark of light on the crunch

      const big = Math.min(30, 18 + Math.floor(msg.amount / 40));
      const t = this.add
        .text(s.x + (Math.random() * 2 - 1) * 10, s.y - 40, `${msg.amount}!`, {
          fontFamily: "monospace", fontSize: `${big}px`, color: "#ffd54a", fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setDepth(900_000)
        .setScale(0.5);
      this.tweens.add({ targets: t, scale: 1.15, y: s.y - 66, duration: 160, ease: "back.out" });
      this.tweens.add({ targets: t, alpha: 0, duration: 300, delay: 380, onComplete: () => t.destroy() });
      this.sfx.crit();
    } else {
      // trash numbers jitter sideways so a detonating pack doesn't stack them into a blur;
      // a resisted elemental hit greys out (and says so now and then) — bring penetration
      const jitter = msg.t === "m" ? (Math.random() * 2 - 1) * 12 : 0;
      const color = msg.resisted ? "#8fa0c0" : isSelf || msg.t === "p" ? "#ff5544" : "#ffffff";
      const label = msg.resisted && Math.random() < 0.3 ? `${msg.amount} resist` : `${msg.amount}`;
      this.floatText(msg.x + jitter, msg.y, label, color);
    }
    if (isSelf) {
      this.cameras.main.shake(120, 0.004);
      this.sfx.hurt();
    } else if (msg.t === "m") {
      this.sfx.hit();
      // your own blows land with weight: a camera kick on every connect, a beat of hit-stop
      // on the crunching ones (crits). Trash kills stay freeze-free so pack-clearing flows.
      if (mine) {
        if (msg.crit) {
          this.hitStop(55);
          this.cameras.main.shake(90, 0.0046);
        } else if (msg.kill) {
          this.cameras.main.shake(70, 0.003);
        } else {
          this.cameras.main.shake(40, 0.0016);
        }
      }
    }
  }

  // freeze world motion for a beat — the crunch of a big hit. Stacks by taking the later of
  // the two so back-to-back crits don't over-freeze.
  private hitStop(ms: number) {
    this.hitStopUntil = Math.max(this.hitStopUntil, this.time.now + ms);
  }

  private onDeath(msg: { t: string; id: string; kind?: string; x: number; y: number; by?: string }) {
    if (msg.t === "m") {
      const boss = isBossKind(msg.kind ?? "");
      this.spawnCorpse(msg.x, msg.y, boss);
      // death is wet work
      const ent = this.monsters.get(msg.id);
      const special = !!(ent?.schema.elite || ent?.schema.modifier);
      this.spillBlood(msg.x, msg.y, boss ? 7 : 3, boss);
      this.spillGibs(msg.x, msg.y, ent?.baseColor ?? 0x6a1010, boss ? 9 : special ? 7 : 5);
      if (boss) {
        this.hitStop(120); // the world stops when a boss falls
        this.cameras.main.shake(400, 0.008);
        this.sfx.roar();
        this.sfx.drop("epic");
        this.lootBurst(msg.x, msg.y, 0xffd54a, 16);
      } else if (special) {
        // an elite or champion drops guaranteed gear — sell the payoff with a burst
        this.hitStop(45);
        this.cameras.main.shake(120, 0.004);
        this.lootBurst(msg.x, msg.y, ent?.schema.elite ? 0xffd54a : 0x6a9cff, 9);
        this.sfx.monsterDie();
      } else {
        this.sfx.monsterDie();
      }
    } else {
      this.spillBlood(msg.x, msg.y, 4, true); // heroes bleed too
      if (msg.id === this.room?.sessionId) {
        this.lastDeathBy = msg.by ?? "";
        this.cameras.main.flash(400, 100, 0, 0);
      }
    }
  }

  private onSwing(msg: { id: string; x: number; y: number; dirX: number; dirY: number }) {
    const s = worldToScreen(msg.x, msg.y);
    const tip = worldToScreen(msg.x + msg.dirX * 40, msg.y + msg.dirY * 40);
    const angle = Math.atan2(tip.y - s.y, tip.x - s.x);

    // the arc takes the color of your weapon tier — rare swings glow gold, epics violet
    const swinger = this.players.get(msg.id);
    const tier = swinger?.schema.gearTier ?? 0;
    const arcColor = tier >= 2 ? (RARITY_COLORS[RARITY_ORDER[tier]] ?? 0xffe08a) : 0xffe08a;
    const g = this.add.graphics({ x: s.x, y: s.y - 12 });
    g.lineStyle(3, arcColor, 0.9);
    g.beginPath();
    g.arc(0, 0, 27, angle - 0.85, angle + 0.85);
    g.strokePath();
    g.setDepth(s.y + 1);
    this.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });

    // the weapon itself swings — wind up, cut through, return to guard
    const ent = this.players.get(msg.id);
    if (ent?.weaponImg) {
      ent.swingTween?.remove();
      ent.weaponImg.setRotation(-1.9);
      ent.swingTween = this.tweens.add({
        targets: ent.weaponImg,
        rotation: 0.6,
        duration: 120,
        ease: "quad.in",
        onComplete: () => {
          if (ent.weaponImg) {
            ent.swingTween = this.tweens.add({ targets: ent.weaponImg, rotation: -0.7, duration: 180, ease: "sine.out" });
          }
        },
      });
    }
    if (ent?.armF) {
      ent.armF.setRotation(-1.2); // the arm follows the blow (walk cycle eases it back)
    }
    this.sfx.swing();
  }

  // a soft white radial we can tint any color for combat light
  private ensureGlowDot() {
    if (this.textures.exists("glowdot")) return;
    const size = 128;
    const cv = this.textures.createCanvas("glowdot", size, size);
    if (!cv) return;
    const ctx = cv.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.5)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    cv.refresh();
  }

  // a brief pool of colored light — spells and crits throw light on the dark ground
  private combatFlash(sx: number, sy: number, color: number, size = 90) {
    const light = this.add
      .image(sx, sy - 8, "glowdot")
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(sy + 3)
      .setScale((size / 128) * 0.5)
      .setAlpha(0.8);
    this.tweens.add({
      targets: light, scale: (size / 128) * 1.3, alpha: 0, duration: 240, ease: "quad.out",
      onComplete: () => light.destroy(),
    });
  }

  private onImpact(msg: { kind: string; x: number; y: number }) {
    const s = worldToScreen(msg.x, msg.y);
    // every impact throws a brief pool of its element's light
    const lightColor = msg.kind === "fireball" ? 0xff8848 : PROJ_TRAIL[msg.kind] ?? 0xd0d0d8;
    this.combatFlash(s.x, s.y, lightColor, msg.kind === "fireball" ? 140 : 74);
    if (msg.kind === "fireball") {
      const blast = this.add.circle(s.x, s.y - 10, 22, 0xff8844, 0.7).setDepth(s.y + 2).setScale(0.3);
      this.tweens.add({ targets: blast, scale: 1.7, alpha: 0, duration: 260, onComplete: () => blast.destroy() });
      this.sfx.hit();
    } else {
      const puff = this.add.circle(s.x, s.y - 10, 4, 0xbbbbbb, 0.7).setDepth(s.y + 2);
      this.tweens.add({ targets: puff, scale: 2, alpha: 0, duration: 160, onComplete: () => puff.destroy() });
    }
  }

  // --- fx helpers ---

  private floatText(wx: number, wy: number, text: string, color: string) {
    const s = worldToScreen(wx, wy);
    const t = this.add
      .text(s.x, s.y - 34, text, { fontFamily: "monospace", fontSize: "14px", color, fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(900_000);
    this.tweens.add({ targets: t, y: s.y - 58, alpha: 0, duration: 600, onComplete: () => t.destroy() });
  }

  private spawnCorpse(wx: number, wy: number, big = false) {
    const s = worldToScreen(wx, wy);
    const corpse = this.add
      .ellipse(s.x, s.y, big ? 40 : 24, big ? 18 : 11, big ? 0x4a1a16 : 0x39482c, 0.8)
      .setDepth(-500_000 + s.y);
    this.corpses.push(corpse);
    if (this.corpses.length > 80) this.corpses.shift()?.destroy();
  }

  private showClickMarker(sx: number, sy: number) {
    const marker = this.add.polygon(sx, sy, [0, -8, 16, 0, 0, 8, -16, 0], 0xffd54a, 0);
    marker.setStrokeStyle(2, 0xffd54a, 0.9);
    marker.setDepth(sy + 0.5);
    this.tweens.add({
      targets: marker, alpha: 0, scaleX: 1.6, scaleY: 1.6, duration: 350,
      onComplete: () => marker.destroy(),
    });
  }

  // --- input ---

  private sendMove(pointer: Phaser.Input.Pointer, marker: boolean) {
    if (!this.room || !this.clientMap) return;
    const me = this.players.get(this.room.sessionId);
    if (!me) return;
    pointer.updateWorldPoint(this.cameras.main);
    const w = screenToWorld(pointer.worldX, pointer.worldY);
    // clicking a wall / tree / the void no longer does nothing — head for the nearest spot you CAN
    // stand, so a slightly-off click still moves you instead of dropping silently.
    const target = canStand(this.clientMap, w.x, w.y) ? w : this.nearestStandable(w.x, w.y);
    if (!target) return;
    if (marker) this.showClickMarker(pointer.worldX, pointer.worldY);
    // a clear straight shot is sent as-is (responsive). Anything with a wall in the way — trees,
    // cathedral corners, and above all the ONE town gate — routes with BFS so the walk never jams
    // against the wall and dead-stops (the "stuck in town next to the gate" bug).
    if (this.lineClear(me.schema.x, me.schema.y, target.x, target.y)) {
      this.walkPath = null; // steering by hand overrides any auto-walk
      this.room.send("move", { x: target.x, y: target.y });
    } else {
      this.startAutoWalk(target.x, target.y);
    }
    this.lastMoveSend = this.time.now;
  }

  // the nearest tile whose centre a player can actually stand on, spiralling out from a clicked point
  private nearestStandable(wx: number, wy: number): { x: number; y: number } | null {
    const map = this.clientMap;
    if (!map) return null;
    const gx = Math.floor(wx / TILE);
    const gy = Math.floor(wy / TILE);
    for (let r = 1; r <= 10; r++) {
      let best: { x: number; y: number } | null = null;
      let bestD = Infinity;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // just the ring at this radius
          const cx = (gx + dx + 0.5) * TILE;
          const cy = (gy + dy + 0.5) * TILE;
          if (!canStand(map, cx, cy)) continue;
          const d = Math.hypot(cx - wx, cy - wy);
          if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  // is the straight segment between two points standable the whole way? (sampled every half tile)
  private lineClear(x0: number, y0: number, x1: number, y1: number): boolean {
    const map = this.clientMap;
    if (!map) return false;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / (TILE * 0.5)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (!canStand(map, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }

  // click-to-interact from anywhere: BFS a tile path so the walk survives
  // trees, cathedral walls, and everything else a straight line jams on
  private startAutoWalk(wx: number, wy: number) {
    this.walkPath = this.findPath(wx, wy);
    this.walkPathSentAt = 0;
    if (!this.walkPath) this.room?.send("move", { x: wx, y: wy }); // no path? try the old straight walk
  }

  private findPath(wx: number, wy: number): Array<{ x: number; y: number }> | null {
    const map = this.clientMap;
    const me = this.room ? this.players.get(this.room.sessionId) : undefined;
    if (!map || !me) return null;
    const sx = Math.floor(me.schema.x / TILE);
    const sy = Math.floor(me.schema.y / TILE);
    const gx = Math.floor(wx / TILE);
    const gy = Math.floor(wy / TILE);
    if (sx === gx && sy === gy) return [{ x: wx, y: wy }];
    const W = map.w;
    const H = map.h;
    const prev = new Int32Array(W * H).fill(-1);
    prev[sy * W + sx] = sy * W + sx;
    const queue = [sy * W + sx];
    let found = false;
    for (let qi = 0; qi < queue.length && !found; qi++) {
      const cur = queue[qi];
      const cx = cur % W;
      const cy = Math.floor(cur / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const idx = ny * W + nx;
        if (prev[idx] !== -1 || tileAt(map, nx, ny) !== 0) continue;
        prev[idx] = cur;
        if (nx === gx && ny === gy) {
          found = true;
          break;
        }
        queue.push(idx);
      }
    }
    if (!found) return null;
    const path: Array<{ x: number; y: number }> = [{ x: wx, y: wy }]; // end exactly at the target
    let cur = gy * W + gx;
    while (cur !== prev[cur]) {
      const cx = cur % W;
      const cy = Math.floor(cur / W);
      path.push({ x: (cx + 0.5) * TILE, y: (cy + 0.5) * TILE });
      cur = prev[cur];
    }
    return path.reverse(); // [first step … goal tile, exact target]
  }

  private tryAttack(pointer: Phaser.Input.Pointer) {
    if (!this.room || !this.myCls) return;
    if (this.time.now < this.attackReadyAt) return;
    const atk = CLASS_ATTACKS[this.myCls as keyof typeof CLASS_ATTACKS];
    const cooldown = Math.max(150, atk.cooldownMs * (1 - this.myAtkSpd / 100));
    this.attackReadyAt = this.time.now + cooldown;
    pointer.updateWorldPoint(this.cameras.main);
    const w = screenToWorld(pointer.worldX, pointer.worldY);
    this.room.send("attack", { x: w.x, y: w.y });
  }

  private castSkill(key: SkillKey) {
    if (!this.room || !this.myCls) return;
    if (this.ui?.chatActive) return; // the keys belong to the message
    // if the skill panel is waiting for a bind key, the press belongs to it
    if (this.ui?.skillPanel?.tryBind(key)) return;
    this.sfx.ensure();
    const id = this.lastLoadout?.binds?.[key];
    if (!id) return;
    const skill = skillById(this.myCls as ClassName, id);
    if (!skill || (this.lastLoadout?.skills?.[id] ?? 0) <= 0) return;
    if (this.time.now < (this.skillReadyAt.get(skill.id) ?? 0)) return;

    const me = this.players.get(this.room.sessionId);
    if (me && me.schema.mana < (skill.mana ?? 0)) return;

    const pointer = this.input.activePointer;
    pointer.updateWorldPoint(this.cameras.main);
    const w = screenToWorld(pointer.worldX, pointer.worldY);
    this.room.send("skill", { key, x: w.x, y: w.y });
    this.skillReadyAt.set(skill.id, this.time.now + (skill.cooldownMs ?? 0));
  }

  // --- frame loop ---

  update(_time: number, delta: number) {
    // hit-stop: for a few frames after a crunching blow, the WORLD holds still (entities
    // and projectiles stop advancing) while the impact pops keep playing — the crunch of a
    // landed hit. Scale pops/tweens/camera still run; only interpolation freezes.
    const frozen = this.time.now < this.hitStopUntil;
    const k = frozen ? 0 : Math.min(1, (delta / 1000) * 12);
    const kFast = frozen ? 0 : Math.min(1, (delta / 1000) * 25);

    const lerpEnt = (ent: Entity, rate: number) => {
      const t = worldToScreen(ent.schema.x, ent.schema.y);
      ent.container.x += (t.x - ent.container.x) * rate;
      ent.container.y += (t.y - ent.container.y) * rate;
      ent.container.setDepth(ent.container.y);
      ent.hpFg.scaleX = Math.max(0, ent.schema.hp / ent.schema.maxHp);
    };

    this.players.forEach((ent) => {
      lerpEnt(ent, k);
      ent.container.setAlpha(ent.schema.hp <= 0 ? 0.3 : 1);
      if (ent.label && ent.lastLevel !== ent.schema.level) {
        ent.lastLevel = ent.schema.level;
        ent.label.setText(`${ent.schema.hardcore ? "☠ " : ""}${ent.schema.name || ent.schema.cls} · ${ent.schema.level}`);
      }
      // gear changes, facing flip, walk cycle
      this.refreshGear(ent);
      const dxMove = ent.container.x - (ent.prevX ?? ent.container.x);
      const dyMove = ent.container.y - (ent.prevY ?? ent.container.y);
      const movedNow = Math.hypot(dxMove, dyMove);
      const dead = ent.schema.hp <= 0;

      // limbs: swing while walking, settle when still, breathe always
      if (ent.legL && ent.legR && ent.armF && ent.armB) {
        const swing = !dead && movedNow > 0.6 ? Math.sin(this.time.now / 85) * 0.6 : 0;
        ent.legL.rotation += (swing - ent.legL.rotation) * 0.5;
        ent.legR.rotation += (-swing - ent.legR.rotation) * 0.5;
        ent.armB.rotation += (swing * 0.7 - ent.armB.rotation) * 0.5;
        if (!ent.swingTween?.isPlaying()) {
          ent.armF.rotation += (-swing * 0.7 - ent.armF.rotation) * 0.5;
        }
      }
      if (ent.torsoShape && !dead) {
        ent.torsoShape.scaleY = 1 + Math.sin(this.time.now / 420 + ent.container.x) * 0.025; // idle breath
      }
      // standing still, a hero checks their grip now and then
      if (!dead && movedNow <= 0.6 && ent.armF && !ent.swingTween?.isPlaying()) {
        const sid = ent.schema.name ?? "";
        const nextAt = this.fidgetAt.get(sid) ?? 0;
        if (this.time.now > nextAt) {
          this.fidgetAt.set(sid, this.time.now + 5200 + Math.random() * 4200);
          ent.swingTween = this.tweens.add({ targets: ent.armF, rotation: -0.45, duration: 240, yoyo: true, ease: "sine.inOut" });
        }
      }
      // the fallen topple sideways
      if (ent.figure) {
        const targetRot = dead ? 1.45 : 0;
        ent.figure.rotation += (targetRot - ent.figure.rotation) * 0.18;
      }

      // legendary+ gear sheds embers as you walk the dark
      const tier = ent.schema.gearTier ?? 0;
      if (tier >= 5 && ent.schema.hp > 0 && this.time.now - (ent.lastEmberAt ?? 0) > 340) {
        ent.lastEmberAt = this.time.now;
        const color = RARITY_COLORS[RARITY_ORDER[tier]] ?? 0xff8033;
        const ember = this.add
          .circle(ent.container.x + (Math.random() * 2 - 1) * 10, ent.container.y - 6 - Math.random() * 14, 1.6, color, 0.85)
          .setDepth(ent.container.depth + 1);
        this.tweens.add({
          targets: ember,
          y: ember.y - 16 - Math.random() * 10,
          alpha: 0,
          duration: 700 + Math.random() * 300,
          onComplete: () => ember.destroy(),
        });
      }

      // druid wolf form: fur, ears, and a snout while the timer runs
      const isWolf = (ent.schema.wolfUntil ?? 0) > Date.now();
      if (isWolf && !ent.wolfOn && ent.figure) {
        ent.wolfOn = true;
        const earL = this.add.triangle(-3, -31, 0, 5, -3, -4, 3, 0, 0x5a4a3a);
        const earR = this.add.triangle(3, -31, 0, 5, 3, -4, -3, 0, 0x5a4a3a);
        const snout = this.add.rectangle(5, -24, 6, 3.5, 0x6a5a4a).setStrokeStyle(1, 0x3a2f24);
        ent.figure.add([earL, earR, snout]);
        ent.wolfParts = [earL, earR, snout];
        ent.torsoShape?.setFillStyle(0x5a4a3a);
        ent.armF?.setFillStyle(0x4a3c2e);
        ent.armB?.setFillStyle(0x4a3c2e);
      } else if (!isWolf && ent.wolfOn) {
        ent.wolfOn = false;
        ent.wolfParts?.forEach((o) => o.destroy());
        ent.wolfParts = undefined;
        ent.gearSig = ""; // force refreshGear to restore armor colors
      }
      const moved = Math.hypot(dxMove, ent.container.y - (ent.prevY ?? ent.container.y));
      if (ent.figure) {
        if (Math.abs(dxMove) > 0.6) ent.figure.setScale(dxMove < 0 ? -1 : 1, 1);
        ent.figure.y = moved > 1 ? Math.sin(this.time.now / 80) * 1.3 : 0;
      }

      // footstep dust while moving
      if (moved > 1.5 && this.time.now - (ent.lastStepAt ?? 0) > 190 && ent.schema.hp > 0) {
        ent.lastStepAt = this.time.now;
        const dust = this.add
          .ellipse(ent.container.x, ent.container.y + 2, 9, 4, 0x9a9aa8, 0.22)
          .setDepth(ent.container.depth - 1);
        this.tweens.add({ targets: dust, alpha: 0, scaleX: 1.7, duration: 420, onComplete: () => dust.destroy() });
      }
      ent.prevX = ent.container.x;
      ent.prevY = ent.container.y;
    });
    this.monsters.forEach((ent) => {
      lerpEnt(ent, k);
      // monsters face the way they move, and lope as they come for you
      const dxm = ent.container.x - (ent.prevX ?? ent.container.x);
      const dym = ent.container.y - (ent.prevY ?? ent.container.y);
      if (ent.figure) {
        if (Math.abs(dxm) > 0.6) ent.figure.setScale(dxm < 0 ? -1 : 1, 1);
        const movedM = Math.hypot(dxm, dym);
        ent.figure.y = movedM > 0.8 ? Math.sin(this.time.now / 95 + ent.container.x * 0.1) * 1.6 : ent.figure.y * 0.85;
      }
      ent.prevX = ent.container.x;
      ent.prevY = ent.container.y;
    });

    this.mercs.forEach((ent) => {
      const t = worldToScreen(ent.schema.x, ent.schema.y);
      const dxm = t.x - ent.container.x;
      ent.container.x += dxm * k;
      ent.container.y += (t.y - ent.container.y) * k;
      ent.container.setDepth(ent.container.y);
      if (Math.abs(dxm) > 0.5) ent.figure.setScale(dxm < 0 ? -1 : 1, 1);
      const frac = Math.max(0, Math.min(1, ent.schema.hp / Math.max(1, ent.schema.maxHp)));
      ent.hpFg.width = 25 * frac;
      ent.hpFg.fillColor = frac > 0.5 ? 0x3fbf5f : frac > 0.25 ? 0xd8b13a : 0xd04040;
    });

    this.pets.forEach((ent) => {
      const t = worldToScreen(ent.schema.x, ent.schema.y);
      const dxp = t.x - ent.container.x;
      ent.container.x += dxp * k;
      ent.container.y += (t.y - ent.container.y) * k;
      ent.container.setDepth(ent.container.y);
      if (Math.abs(dxp) > 0.5) ent.container.setScale(dxp < 0 ? -1 : 1, 1);
    });

    this.projectiles.forEach((ent) => {
      const t = worldToScreen(ent.schema.x, ent.schema.y);
      ent.container.x += (t.x - ent.container.x) * kFast;
      ent.container.y += (t.y - ent.container.y) * kFast;
      ent.container.setDepth(ent.container.y);
      const dx = ent.container.x - ent.lastX;
      const dy = ent.container.y - ent.lastY;
      if (ent.rotatable && (dx !== 0 || dy !== 0)) ent.rotatable.setRotation(Math.atan2(dy, dx));
      // a glowing streak smeared through the air — drop a fading ghost when it's moving
      if (!frozen && ent.trailColor !== undefined && (dx * dx + dy * dy) > 9) {
        const ghost = this.add
          .circle(ent.container.x, ent.container.y - 12, 3, ent.trailColor, 0.5)
          .setDepth(ent.container.depth - 1);
        this.tweens.add({ targets: ghost, alpha: 0, scale: 0.3, duration: 190, onComplete: () => ghost.destroy() });
      }
      ent.lastX = ent.container.x;
      ent.lastY = ent.container.y;
    });

    // hold-to-walk / hold-to-attack (shift+LMB attacks, D2 style)
    const pointer = this.input.activePointer;
    if (this.room && !this.ui?.blocksPoint(pointer.x, pointer.y)) {
      if (pointer.rightButtonDown() || (pointer.leftButtonDown() && this.shiftKey?.isDown)) {
        this.tryAttack(pointer);
      } else if (
        pointer.leftButtonDown() &&
        !this.walkPath && // a BFS route is in progress — let the follower drive, don't stomp it
        this.time.now - this.lastMoveSend > 150 &&
        this.time.now - this.lootClickAt > 400 // a fresh loot click gets a head start over hold-to-walk
      ) {
        this.sendMove(pointer, false);
      }
    }

    // auto-walk: follow the BFS breadcrumbs toward a clicked door/shrine/stairs
    if (this.room && this.walkPath) {
      const meEnt = this.players.get(this.room.sessionId);
      if (!meEnt || this.walkPath.length === 0) {
        this.walkPath = null;
      } else {
        const next = this.walkPath[0];
        if (Math.hypot(meEnt.schema.x - next.x, meEnt.schema.y - next.y) < 22) {
          this.walkPath.shift();
        } else if (this.time.now - this.walkPathSentAt > 200) {
          this.walkPathSentAt = this.time.now;
          this.room.send("move", { x: next.x, y: next.y });
        }
      }
    }

    // shrines: grey out used ones; touch a clicked one when close enough
    this.shrineEnts.forEach((ent) => {
      const a = ent.schema.used ? 0.35 : 1;
      ent.container.setAlpha(a);
      ent.label?.setAlpha(a);
    });
    if (this.room && this.pendingShrine) {
      const s = this.room.state.shrines?.get(this.pendingShrine);
      const me = this.players.get(this.room.sessionId);
      if (!s || s.used) {
        this.pendingShrine = null;
      } else if (me && Math.hypot(me.schema.x - s.x, me.schema.y - s.y) < 48) {
        // conversational NPCs open a dialogue window on the client; the Shop button
        // in it sends the real touchshrine. Everything else touches on arrival.
        const talk = ["vendor", "gamble", "alchemist", "mercnpc", "storyteller", "barkeep"].includes(s.kind);
        if (talk) this.ui?.openNpcDialogue(this.pendingShrine, s.kind, s.variant ?? "");
        else this.room.send("touchshrine", { id: this.pendingShrine });
        this.pendingShrine = null;
        this.walkPath = null; // arrived — and if this teleports us, the breadcrumbs are stale
      }
    }

    // walking toward clicked stairs — descend when we arrive
    if (this.room && this.pendingStairs) {
      const st = this.room.state;
      const me = this.players.get(this.room.sessionId);
      if (this.time.now - this.pendingStairsSince > 12000) {
        this.pendingStairs = false; // gave up — something kept us away
      } else if (me && this.time.now - this.lastStairsSend > 250) {
        this.lastStairsSend = this.time.now;
        if (Math.hypot(me.schema.x - st.stairsX, me.schema.y - st.stairsY) < STAIRS_USE_RANGE - 12) {
          this.room.send("usestairs", {});
          this.pendingStairs = false; // the floor change resets everything anyway
          this.walkPath = null;
        } else if (!this.walkPath) {
          this.room.send("move", { x: st.stairsX, y: st.stairsY }); // keep closing in (no path to follow)
        }
      }
    }

    // loot changed — restack the name labels so every item in a pile is clickable
    if (this.lootDirty && this.time.now - this.lastLootLayoutAt > 120) {
      this.lootDirty = false;
      this.lastLootLayoutAt = this.time.now;
      this.relayoutLootLabels();
    }

    // walking toward a clicked item — keep trying until it's actually in the bag
    if (this.room && this.pendingPickup) {
      const g = this.room.state.loot?.get(this.pendingPickup);
      const me = this.players.get(this.room.sessionId);
      if (!g || this.time.now - this.pendingPickupSince > 8000) {
        this.pendingPickup = null; // picked up (onRemove also clears) or timed out
      } else if (me && this.time.now - this.lastPickupSend > 200) {
        this.lastPickupSend = this.time.now;
        if (Math.hypot(me.schema.x - g.x, me.schema.y - g.y) < 44) {
          this.room.send("pickup", { id: this.pendingPickup });
        } else {
          this.room.send("move", { x: g.x, y: g.y }); // keep closing in
        }
      }
    }

    this.updateFog();

    // the tower steps aside: fade it when any hero stands in its visual shadow
    if (this.towerFade) {
      const z = this.towerFade.zone;
      let behind = false;
      this.players.forEach((pl) => {
        const px = pl.schema.x;
        const py = pl.schema.y;
        if (px >= z.x0 && px <= z.x1 && py >= z.y0 && py <= z.y1) behind = true;
      });
      for (const o of this.towerFade.objs) o.setAlpha(behind ? 0.45 : 1);
    }
    this.updateLight();
    this.updateAtmosphere(delta);
    this.updateAmbientLocation();
    this.updateCutaways();
  }

  // enterable buildings lift their roof away when anyone is inside (or at the threshold),
  // revealing the warm room beneath — and settle it back when the last soul leaves
  private updateCutaways() {
    if (!this.cutaways.length) return;
    for (const cut of this.cutaways) {
      const b = cut.b;
      let occupied = false;
      this.players.forEach((p) => {
        if (occupied) return;
        const tx = Math.floor(p.schema.x / TILE), ty = Math.floor(p.schema.y / TILE);
        const insideBox = tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h;
        const atDoor = !!b.door && Math.abs(tx - b.door.x) <= 1 && Math.abs(ty - b.door.y) <= 1;
        if (insideBox || atDoor) occupied = true;
      });
      const target = occupied ? 0.16 : 1;
      cut.alpha += (target - cut.alpha) * 0.15; // ease the roof up and down
      for (const o of cut.roof) (o as any).setAlpha?.(cut.alpha);
    }
  }

  // the hearth has its own song: swap to the town theme when you step inside the
  // walls, back to the dungeon's dread when you leave. (Ambient index 100+act = town.)
  private lastAmbientTheme = -999;
  private lastCreep = -1;
  private updateAmbientLocation() {
    if (!this.room) return;
    const me = this.players.get(this.room.sessionId);
    if (!me) return;
    const act = this.room.state.act ?? 1;
    const floor = this.room.state.floor ?? 1;
    const inTown = isInTown(me.schema.y);
    const desired = inTown ? 100 + Math.min(Math.max(act, 1), 4) : visualThemeFor(act, floor);
    // the town is a safe hearth (no creep); everywhere else escalates with depth
    const creep = inTown ? 0 : Math.max(0, Math.min(1, (dangerFor(act, floor) - 1) / 27));
    if (desired !== this.lastAmbientTheme || Math.abs(creep - this.lastCreep) > 0.12) {
      this.lastAmbientTheme = desired;
      this.lastCreep = creep;
      this.sfx.setAmbient(desired, creep);
    }
  }

  // --- fog of war: reveal around your own character ---

  // --- atmosphere: the sky's moods, and the deep's breath ---

  private applyWeather(w: string) {
    this.rainG?.destroy();
    this.rainG = undefined;
    this.rainDrops = [];
    this.mistBlobs.forEach((b) => {
      this.tweens.killTweensOf(b);
      b.destroy();
    });
    this.mistBlobs = [];
    this.sfx.setRain(w === "rain");
    this.weatherKind = w;
    if (w === "rain" || w === "sandstorm" || w === "ashfall") {
      this.rainG = this.add.graphics().setScrollFactor(0).setDepth(852_000);
      const n = w === "rain" ? 90 : w === "sandstorm" ? 110 : 60;
      for (let i = 0; i < n; i++) {
        this.rainDrops.push({
          x: Math.random() * this.scale.width,
          y: Math.random() * this.scale.height,
          len: w === "ashfall" ? 2 + Math.random() * 2.5 : 9 + Math.random() * 9,
          spd: w === "rain" ? 540 + Math.random() * 260 : w === "sandstorm" ? 620 + Math.random() * 320 : 34 + Math.random() * 40,
        });
      }
    } else if (w === "mist") {
      // a soft radial puff, drawn once — banks are layered, squashed, breathing copies
      if (!this.textures.exists("mistpuff")) {
        const size = 256;
        const cv = this.textures.createCanvas("mistpuff", size, size);
        if (cv) {
          const ctx = cv.getContext();
          const grad = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size / 2);
          grad.addColorStop(0, "rgba(198,208,204,0.5)");
          grad.addColorStop(0.45, "rgba(190,202,198,0.26)");
          grad.addColorStop(0.75, "rgba(184,196,194,0.09)");
          grad.addColorStop(1, "rgba(184,196,194,0)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, size, size);
          cv.refresh();
        }
      }
      const cam = this.cameras.main;
      for (let i = 0; i < 14; i++) {
        const blob = this.add
          .image(
            cam.midPoint.x + (Math.random() - 0.5) * 1600,
            cam.midPoint.y + (Math.random() - 0.5) * 1000,
            "mistpuff"
          )
          .setScale(1.6 + Math.random() * 2.2, 0.55 + Math.random() * 0.6)
          .setAlpha(0.22 + Math.random() * 0.2)
          .setDepth(700_000 + i);
        // banks breathe: alpha and width swell and thin on their own slow clocks
        this.tweens.add({
          targets: blob,
          alpha: blob.alpha * 0.45,
          scaleX: blob.scaleX * 1.25,
          duration: 2600 + Math.random() * 2600,
          yoyo: true,
          repeat: -1,
          ease: "sine.inout",
        });
        this.mistBlobs.push(blob);
      }
    }
  }

  private updateAtmosphere(dtMs: number) {
    const cam = this.cameras.main;
    // rain: fast diagonal streaks, screen-space, wrapping forever
    if (this.rainG) {
      const g = this.rainG;
      g.clear();
      const kind = this.weatherKind;
      g.lineStyle(1, kind === "sandstorm" ? 0xd8b06a : kind === "ashfall" ? 0x9a9490 : 0x9ab8d8, kind === "sandstorm" ? 0.35 : 0.4);
      const h = this.scale.height;
      const w = this.scale.width;
      for (const d of this.rainDrops) {
        if (kind === "sandstorm") {
          // the wind owns the wastes: streaks race sideways, barely falling
          d.x -= (d.spd * dtMs) / 1000;
          d.y += (d.spd * 0.06 * dtMs) / 1000;
          if (d.x < -30) {
            d.x = w + 30;
            d.y = Math.random() * h;
          }
          if (d.y > h + 20) d.y = -10;
          g.beginPath();
          g.moveTo(d.x, d.y);
          g.lineTo(d.x + d.len * 1.6, d.y - d.len * 0.1);
          g.strokePath();
        } else if (kind === "ashfall") {
          // ash falls the way snow wishes it could: slow, swaying, indifferent
          d.y += (d.spd * dtMs) / 1000;
          d.x += Math.sin((d.y + d.spd) * 0.02) * 0.35;
          if (d.y > h + 10) {
            d.y = -10;
            d.x = Math.random() * w;
          }
          g.fillStyle(0x8a827c, 0.5);
          g.fillRect(d.x, d.y, d.len, d.len);
        } else {
          d.y += (d.spd * dtMs) / 1000;
          d.x -= (d.spd * 0.22 * dtMs) / 1000;
          if (d.y > h + 20) {
            d.y = -20;
            d.x = Math.random() * (w + 120);
          }
          if (d.x < -20) d.x += w + 40;
          g.beginPath();
          g.moveTo(d.x, d.y);
          g.lineTo(d.x - d.len * 0.22, d.y - d.len);
          g.strokePath();
        }
      }
    }
    // mist banks drift on a slow wind, wrapping around the camera
    if (this.mistBlobs.length) {
      for (const b of this.mistBlobs) {
        b.x += (9 * dtMs) / 1000;
        b.y += (2.5 * dtMs) / 1000;
        if (b.x > cam.midPoint.x + 1000) b.x -= 2000;
        if (b.y > cam.midPoint.y + 700) b.y -= 1400;
      }
    }

    // motes: every palette breathes its own particles
    const st = this.room?.state;
    if (!st?.mapData) return;
    const themeIdx = visualThemeFor(st.act ?? 1, st.floor ?? 1);
    const isForestHere = (st.floor ?? 1) === 1 && (st.act ?? 1) < ABYSS_ACT;
    const conf = isForestHere ? 9 : themeIdx;
    const interval = conf === 2 ? 420 : conf === 6 ? 300 : 170;
    if (this.moteCount >= 40 || this.time.now - this.lastMoteAt < interval) return;
    this.lastMoteAt = this.time.now;
    this.moteCount++;
    const view = cam.worldView;
    const mx = view.x + Math.random() * view.width;
    const my = view.y + Math.random() * view.height;
    const done = (obj: Phaser.GameObjects.GameObject) => {
      obj.destroy();
      this.moteCount--;
    };
    switch (conf) {
      case 2: {
        // caves: water finds its way down, then rings out
        const drop = this.add.circle(mx, my - 26, 1.4, 0x9ac8ff, 0.85).setDepth(my);
        this.tweens.add({
          targets: drop, y: my, duration: 320, ease: "quad.in",
          onComplete: () => {
            drop.destroy();
            const ripple = this.add.ellipse(mx, my, 4, 2, 0x9ac8ff, 0).setStrokeStyle(1, 0x9ac8ff, 0.5).setDepth(my - 1);
            this.tweens.add({ targets: ripple, scaleX: 4, scaleY: 4, alpha: 0, duration: 420, onComplete: () => { ripple.destroy(); this.moteCount--; } });
          },
        });
        break;
      }
      case 3:
      case 8: {
        // hell rises embers; the abyss rises ash
        const c = conf === 3 ? 0xff7030 : 0x9a8a92;
        const ember = this.add.rectangle(mx, my, 2, 2, c, 0.85).setDepth(my + 40);
        this.tweens.add({ targets: ember, y: my - 55 - Math.random() * 30, alpha: 0, duration: 2400 + Math.random() * 900, ease: "sine.out", onComplete: () => done(ember) });
        this.tweens.add({ targets: ember, x: mx + (Math.random() - 0.5) * 26, duration: 900, yoyo: true, repeat: 2, ease: "sine.inOut" });
        break;
      }
      case 4: {
        // frozen halls: it snows indoors; nobody questions it
        const flake = this.add.circle(mx, my - 40, 1.6, 0xffffff, 0.8).setDepth(my + 40);
        this.tweens.add({ targets: flake, y: my + 30, alpha: 0, duration: 3000 + Math.random() * 1200, ease: "linear", onComplete: () => done(flake) });
        this.tweens.add({ targets: flake, x: mx + (Math.random() - 0.5) * 34, duration: 1100, yoyo: true, repeat: 2, ease: "sine.inOut" });
        break;
      }
      case 6: {
        // the swamp keeps fireflies
        const fly = this.add.circle(mx, my, 1.8, 0xa8e87f, 0.9).setDepth(my + 40);
        this.tweens.add({ targets: fly, alpha: 0.2, duration: 420, yoyo: true, repeat: 6 });
        this.tweens.add({ targets: fly, x: mx + (Math.random() - 0.5) * 70, y: my + (Math.random() - 0.5) * 40, duration: 3800, ease: "sine.inOut", onComplete: () => done(fly) });
        break;
      }
      case 9: {
        // the forest sheds leaves whatever the weather
        const leaf = this.add.rectangle(mx, my - 50, 3, 2, Math.random() < 0.3 ? 0x6a5a2c : 0x4a6a2c, 0.85).setDepth(my + 40);
        this.tweens.add({ targets: leaf, y: my + 20, rotation: 2 + Math.random() * 3, alpha: 0, duration: 3200 + Math.random() * 1400, ease: "sine.in", onComplete: () => done(leaf) });
        this.tweens.add({ targets: leaf, x: mx + (Math.random() - 0.5) * 60, duration: 1300, yoyo: true, repeat: 2, ease: "sine.inOut" });
        break;
      }
      default: {
        // dust (cathedral/catacombs), blood-motes (sanguine), void-specks — a slow drift
        const c = conf === 5 ? 0xd84a7a : conf === 7 ? 0xa878e8 : 0xcfc8b0;
        const mote = this.add.rectangle(mx, my, 1.6, 1.6, c, 0.3).setDepth(my + 40);
        this.tweens.add({
          targets: mote,
          x: mx + 14 + Math.random() * 16,
          y: my + 22 + Math.random() * 18,
          alpha: 0,
          duration: 3600 + Math.random() * 1600,
          ease: "linear",
          onComplete: () => done(mote),
        });
      }
    }
  }

  private updateFog() {
    const map = this.clientMap;
    const me = this.room ? this.players.get(this.room.sessionId) : undefined;
    if (!map || !this.explored || !me) return;

    if (this.time.now - this.lastRevealAt > 120) {
      this.lastRevealAt = this.time.now;
      const ptx = Math.floor(me.schema.x / TILE);
      const pty = Math.floor(me.schema.y / TILE);
      const R = 7;
      let changed = false;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dy * dy > R * R + 2) continue;
          const tx = ptx + dx;
          const ty = pty + dy;
          if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) continue;
          const idx = ty * map.w + tx;
          if (!this.explored[idx]) {
            this.explored[idx] = 1;
            changed = true;
          }
        }
      }
      if (changed) {
        this.fogDirty = true;
        this.exploredRev++;
      }
    }

    // THE GLOOM: explored ground is memory, not vision. Only your immediate
    // surroundings are lit; everything you merely REMEMBER sits under shadow.
    const ptx2 = Math.floor(me.schema.x / TILE);
    const pty2 = Math.floor(me.schema.y / TILE);
    if (ptx2 !== this.lastGloomTx || pty2 !== this.lastGloomTy) {
      this.lastGloomTx = ptx2;
      this.lastGloomTy = pty2;
      this.fogDirty = true;
    }

    if (this.fogDirty && this.fogG) {
      this.fogDirty = false;
      const g = this.fogG;
      g.clear();
      // oversized diamonds (raised to also cover wall tops) overlap into a solid shroud
      const hw = HALF_W * 1.18;
      const hh = HALF_H * 1.18 + WALL_H / 2;
      const cyOff = WALL_H / 2;
      const inTown = isInTown(me.schema.y);
      // distance → darkness: lit core, then deepening memory-shadow
      const gloomAlpha = (d2: number): number => {
        if (d2 <= 20) return 0; // ~4.5 tiles: your torchlight
        if (d2 <= 36) return 0.18;
        if (d2 <= 52) return 0.32;
        if (d2 <= 72) return 0.44;
        return 0.52; // remembered, barely
      };
      const drawDiamond = (t: { x: number; y: number }) => {
        g.beginPath();
        g.moveTo(t.x, t.y - cyOff - hh);
        g.lineTo(t.x + hw, t.y - cyOff);
        g.lineTo(t.x, t.y - cyOff + hh);
        g.lineTo(t.x - hw, t.y - cyOff);
        g.closePath();
        g.fillPath();
      };
      // pass 1: the unexplored void, solid
      g.fillStyle(0x0e0e13, 1);
      for (const t of this.fogTiles) {
        if (!this.explored[t.ty * map.w + t.tx]) drawDiamond(t);
      }
      // pass 2: the gloom over explored-but-distant ground (town stays lamplit)
      if (!inTown) {
        let currentAlpha = -1;
        for (const bucket of [0.18, 0.32, 0.44, 0.52]) {
          currentAlpha = -1;
          for (const t of this.fogTiles) {
            if (!this.explored[t.ty * map.w + t.tx]) continue;
            const ddx = t.tx - ptx2;
            const ddy = t.ty - pty2;
            const a = gloomAlpha(ddx * ddx + ddy * ddy);
            if (a !== bucket) continue;
            if (currentAlpha !== a) {
              currentAlpha = a;
              g.fillStyle(0x0a0a10, a);
            }
            drawDiamond(t);
          }
        }
      }
    }
  }

  // --- static art (procedural placeholders, themed per depth band) ---

  private ensureThemeTextures(themeIdx: number) {
    if (this.themesGenerated.has(themeIdx)) return;
    this.themesGenerated.add(themeIdx);
    // procedural stone/earth materials: mottled, cracked, brick-coursed, base-shadowed (materials.ts)
    generateThemeTextures(this, themeIdx, FLOOR_THEMES[themeIdx]);
  }
}
