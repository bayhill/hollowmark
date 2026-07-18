import Phaser from "phaser";
import {
  CLASS_ATTACKS,
  ClassName,
  FLOOR_THEMES,
  RARITY_ORDER,
  SKILL_KEYS,
  SkillKey,
  SkillNode,
  TILE,
  TOWN,
  TOWN_INTERACT_RANGE,
  DialogueTopic,
  townNpcById,
  topicPages,
  shrineNpcId,
  encounterById,
  setpieceById,
  storyBeatFor,
  isBossKind,
  BESTIARY,
  CODEX_CHAPTERS,
  LORE_FRAGMENTS,
  RELIC_LORE,
  chapterFragments,
  chapterComplete,
  mercClassById,
  skillById,
  visualThemeIndexForFloor,
  xpForNext,
  MAX_LEVEL,
  paragonXpForNext,
} from "@hollowmark/common";
import { CharacterPanel, InventoryPanel, SkillPanel, rarityColorStr, statLines } from "./ui";
import { ensureItemIcons } from "./icons";
import type { GameScene } from "./GameScene";

// All interactive UI lives here, in its own scene with a non-scrolling camera.
// (Interactive objects inside scrollFactor(0) containers in a scrolling scene
// hit-test against world coordinates — clicks miss once the camera moves.)
const CHAT_CLASS_COLORS: Record<string, string> = {
  barbarian: "#e07a6a",
  rogue: "#7fdc9f",
  sorcerer: "#7aa8e8",
  paladin: "#e8cf7a",
  necromancer: "#9fceb4",
  druid: "#cf9a5f",
};

export class UIScene extends Phaser.Scene {
  panel!: InventoryPanel;
  charPanel!: CharacterPanel;
  skillPanel!: SkillPanel;
  chatActive = false; // GameScene checks this before acting on hotkeys

  private chatBuffer = "";
  private chatBar!: Phaser.GameObjects.Text;
  private chatLog: Array<{ txt: Phaser.GameObjects.Text; bornAt: number }> = [];
  private menuOpen = false;
  private menuRoot?: Phaser.GameObjects.Container;
  private helpRoot?: Phaser.GameObjects.Container;

  private quests: Array<{ id: string; name: string; desc: string; act?: number; goal: number; progress: number; done: boolean; rewardGold: number; rewardXp: number }> = [];
  private questRoot?: Phaser.GameObjects.Container;
  private questBounds = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private questTab = 0; // selected act in the quest log; 0 = auto-pick latest act with quests
  questsVisible = false;

  // the Codex — the account's remembered world (bestiary / chronicle / relics)
  private codexRoot?: Phaser.GameObjects.Container;
  private codexBounds = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private codexTab = 0; // 0 Bestiary · 1 Chronicle · 2 Relics
  codexVisible = false;
  private codex: { bestiary: Record<string, number>; fragments: string[]; relics: string[] } = { bestiary: {}, fragments: [], relics: [] };
  private endingVeil?: Phaser.GameObjects.Rectangle; // full-screen veil behind the finale cinematic

  private trackedQuestId: string | null = localStorage.getItem("arpg_tracked_quest");
  private trackerRoot?: Phaser.GameObjects.Container;
  private partyRoot?: Phaser.GameObjects.Container;
  private lastPartyAt = 0;

  private shopRoot?: Phaser.GameObjects.Container;
  private shopBounds = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private shopCosts = { health: 40, mana: 60 };
  shopVisible = false;

  private vendorRoot?: Phaser.GameObjects.Container;
  private vendorBounds = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private vendorItems: Array<{ item: any; price: number }> = [];
  vendorVisible = false;

  private gambleRoot?: Phaser.GameObjects.Container;
  private gambleBounds = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private gambleItems: Array<{ id: string; base: string; name: string; price: number }> = [];
  gambleVisible = false;

  private smithRoot?: Phaser.GameObjects.Container;
  private smithBounds = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private smithItems: Array<{ id: string; base: string; name: string; rarity: string; slot: string; source: "bag" | "worn" | "merc"; action: "punch" | "unsocket"; sockets?: number; seated?: number; price: number }> = [];
  smithVisible = false;

  private altarRoot?: Phaser.GameObjects.Container;
  private altarBounds = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private altarData: { gold?: number; reforge?: Array<{ id: string; base: string; name: string; rarity: string; slot: string; ilvl: number; price: number }>; recipes?: { runeup?: string | null; magics?: boolean; rares?: boolean; pegleg?: boolean } } = {};
  altarVisible = false;

  private mercHireRoot?: Phaser.GameObjects.Container;
  private mercHireBounds = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private mercOffers: any[] = [];
  private mercCurrent: any = null;
  private mercHireInfo: any = {}; // classId/className/npcTitle/npcColor/locked/unlockAct
  mercHireVisible = false;

  private mercRoot?: Phaser.GameObjects.Container;
  private mercBounds = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  // the waypoint network
  waypointsVisible = false;
  private waypointsRoot?: Phaser.GameObjects.Container;
  private waypointsBounds = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private waypointsData: { list: string[]; actsUnlocked: number; act: number; floor: number } | null = null;
  // the trade ring
  tradeVisible = false;
  private tradeRoot?: Phaser.GameObjects.Container;
  private tradeBounds = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private tradePartnerName = "";
  private tradeState: any = null; // server echo: {mine, theirs, myConfirmed, theirConfirmed}
  private myOfferIds: string[] = [];
  private myOfferGold = 0;
  private tradeNoteMsg = "";
  private tradeInviteRoot?: Phaser.GameObjects.Container;
  private mercData: any = null; // from "mercloadout"
  mercVisible = false;

  // --- dialogue window (town talk + dungeon encounters) ---
  private dialogueRoot?: Phaser.GameObjects.Container;
  private dialogueBounds = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  dialogueVisible = false;
  private dlgNpc: { id: string; name: string; shopKind?: string; shopLabel?: string; shrineId?: string; storyteller?: boolean; smith?: boolean } | null = null;
  private dlgMode: "root" | "topics" | "text" = "root";
  private dlgTopics: DialogueTopic[] = [];
  private dlgPages: string[] = [];
  private dlgPageIdx = 0;
  private dlgReturn: "topics" | "close" = "close";

  private gs!: GameScene;
  private hud!: Phaser.GameObjects.Text;
  private bars!: Phaser.GameObjects.Graphics;
  private deathText!: Phaser.GameObjects.Text;
  private deathBy!: Phaser.GameObjects.Text;
  private lastLoadoutRev = -1;

  private hotbarBuiltFor = "";
  private hotbarRoot?: Phaser.GameObjects.Container;
  private hotbarOverlay!: Phaser.GameObjects.Graphics;
  private hotbarCells: Array<{ x: number; y: number; skill?: SkillNode }> = [];
  private hotbarBounds = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private potionCell = { x: 0, y: 0 };
  private potionCount?: Phaser.GameObjects.Text;
  private manaCell = { x: 0, y: 0 };
  private manaCount?: Phaser.GameObjects.Text;
  private goldText?: Phaser.GameObjects.Text;
  private hpText?: Phaser.GameObjects.Text;
  private manaText?: Phaser.GameObjects.Text;

  private vignette!: Phaser.GameObjects.Graphics;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossName!: Phaser.GameObjects.Text;

  private miniBase!: Phaser.GameObjects.Graphics;
  private miniDots!: Phaser.GameObjects.Graphics;
  private miniKey = ""; // "act:floor" — act travel to a same-numbered floor must redraw
  private miniWidth = -1;
  private miniRev = -1;
  private mapMode = 0; // M cycles: 0 corner minimap → 1 full-screen map → 2 hidden
  private miniMode = -1;
  private mapTip?: Phaser.GameObjects.Text;
  private fullMapView = { x0: 0, y0: 0, scale: 1 }; // last full-map transform, for click-to-ping
  private miniRows: string[] = [];

  constructor() {
    super("ui");
  }

  create() {
    this.gs = this.scene.get("game") as GameScene;
    ensureItemIcons(this);

    this.hud = this.add.text(12, 10, "connecting…", {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#c9c9d4",
    });

    this.bars = this.add.graphics();
    this.hotbarOverlay = this.add.graphics().setDepth(10);
    this.goldText = this.add.text(0, 0, "", {
      fontFamily: "monospace", fontSize: "15px", color: "#d8b13a", fontStyle: "bold",
    });
    this.hpText = this.add
      .text(0, 0, "", { fontFamily: "monospace", fontSize: "12px", color: "#d8a0a0" })
      .setOrigin(0.5)
      .setDepth(9);
    this.manaText = this.add
      .text(0, 0, "", { fontFamily: "monospace", fontSize: "12px", color: "#a0b0d8" })
      .setOrigin(0.5)
      .setDepth(9);

    this.deathText = this.add
      .text(0, 0, "YOU  DIED", { fontFamily: "monospace", fontSize: "42px", color: "#b03030", fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false);
    this.deathBy = this.add
      .text(0, 0, "", { fontFamily: "monospace", fontSize: "16px", color: "#8a5050", fontStyle: "italic" })
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false);

    this.panel = new InventoryPanel(this, {
      equip: (id) => this.gs.room?.send("equip", { id }),
      unequip: (slot) => this.gs.room?.send("unequip", { slot }),
      drop: (id) => this.gs.room?.send("dropitem", { id }),
      stashPut: (id) => this.gs.room?.send("stashput", { id }),
      stashTake: (id) => this.gs.room?.send("stashtake", { id }),
      sharedStashPut: (id) => this.gs.room?.send("sharedstashput", { id }),
      sharedStashTake: (id) => this.gs.room?.send("sharedstashtake", { id }),
      sell: (id) => this.gs.room?.send("sellitem", { id }),
      socket: (runeId, itemId) => this.gs.room?.send("socketrune", { runeId, itemId }),
      identify: (id) => this.gs.room?.send("identify", { id }),
      sort: () => this.gs.room?.send("sortbag", {}),
    });

    this.miniBase = this.add.graphics().setDepth(5);
    this.miniDots = this.add.graphics().setDepth(6);
    this.vignette = this.add.graphics().setDepth(15);
    this.bossBar = this.add.graphics().setDepth(8);
    this.bossName = this.add
      .text(0, 0, "", { fontFamily: "monospace", fontSize: "15px", color: "#ff8877", fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(9)
      .setVisible(false);

    this.charPanel = new CharacterPanel(
      this,
      (attr) => this.gs.room?.send("allocstat", { attr }),
      (id) => this.gs.room?.send("allocparagon", { id })
    );
    this.skillPanel = new SkillPanel(this, {
      alloc: (id) => this.gs.room?.send("allocskill", { id }),
      bind: (id, key) => this.gs.room?.send("bindskill", { id, key }),
      respec: () => this.gs.room?.send("respec"),
    });

    this.input.keyboard?.on("keydown-I", () => !this.chatActive && this.panel.toggle());
    this.input.keyboard?.on("keydown-B", () => !this.chatActive && this.panel.toggle());
    this.input.keyboard?.on("keydown-C", () => !this.chatActive && this.charPanel.toggle());
    this.input.keyboard?.on("keydown-S", () => !this.chatActive && this.skillPanel.toggle());
    this.input.keyboard?.on("keydown-M", () => {
      if (this.chatActive) return;
      this.mapMode = (this.mapMode + 1) % 3; // minimap → full map → hidden
    });
    this.input.keyboard?.on("keydown-J", () => !this.chatActive && this.toggleQuests());
    this.input.keyboard?.on("keydown-K", () => !this.chatActive && this.toggleCodex());
    this.input.keyboard?.on("keydown-H", () => !this.chatActive && this.toggleMercPanel());
    // U hides the top info bar — for a cleaner, more immersive screen
    this.input.keyboard?.on("keydown-U", () => !this.chatActive && this.hud.setVisible(!this.hud.visible));

    // chat entry + the escape ladder (chat → panels → game menu) share one listener
    this.chatBar = this.add
      .text(12, 0, "", {
        fontFamily: "monospace", fontSize: "15px", color: "#e8d8a8",
        backgroundColor: "#12101add", padding: { x: 8, y: 5 },
      })
      .setDepth(30)
      .setVisible(false);
    this.input.keyboard?.on("keydown", (ev: KeyboardEvent) => this.handleKey(ev));

    // the war table takes orders: click the full map to ping that spot for the party
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.mapMode !== 1 || this.menuOpen) return;
      const v = this.fullMapView;
      const wx = ((pointer.x - v.x0) / v.scale) * TILE;
      const wy = ((pointer.y - v.y0) / v.scale) * TILE;
      const map = this.gs.clientMap;
      if (!map || wx < 0 || wy < 0 || wx >= map.w * TILE || wy >= map.h * TILE) return;
      this.gs.room?.send("ping", { x: wx, y: wy });
    });

    this.scale.on("resize", () => {
      this.hotbarBuiltFor = ""; // force hotbar rebuild at new position
    });
  }

  // GameScene asks before treating a click as a world click
  blocksPoint(x: number, y: number): boolean {
    if (this.menuOpen) return true; // the menu owns the screen
    if (this.mapMode === 1) return true; // the war table owns the screen too
    if (this.panel?.containsPoint(x, y)) return true;
    if (this.charPanel?.containsPoint(x, y)) return true;
    if (this.skillPanel?.containsPoint(x, y)) return true;
    if (this.questsVisible && this.questBounds.contains(x, y)) return true;
    if (this.codexVisible && this.codexBounds.contains(x, y)) return true;
    if (this.shopVisible && this.shopBounds.contains(x, y)) return true;
    if (this.vendorVisible && this.vendorBounds.contains(x, y)) return true;
    if (this.gambleVisible && this.gambleBounds.contains(x, y)) return true;
    if (this.smithVisible && this.smithBounds.contains(x, y)) return true;
    if (this.altarVisible && this.altarBounds.contains(x, y)) return true;
    if (this.mercHireVisible && this.mercHireBounds.contains(x, y)) return true;
    if (this.mercVisible && this.mercBounds.contains(x, y)) return true;
    if (this.dialogueVisible && this.dialogueBounds.contains(x, y)) return true;
    if (this.tradeVisible && this.tradeBounds.contains(x, y)) return true;
    if (this.waypointsVisible && this.waypointsBounds.contains(x, y)) return true;
    if (this.tradeInviteRoot) {
      const r = this.tradeInviteRoot;
      if (x >= r.x && x <= r.x + 300 && y >= r.y && y <= r.y + 74) return true;
    }
    return this.hotbarBounds.contains(x, y);
  }

  // --- Torvald's wares & Fenwick's spread ---

  private myGold(): number {
    const me = this.gs.room ? (this.gs.room.state as any).players?.get(this.gs.room.sessionId) : null;
    return Math.floor(me?.gold ?? 0);
  }

  // shared storefront frame: dark panel, trim, title, gold line, close button
  private buildStorefront(
    W: number,
    H: number,
    title: string,
    trim: number,
    titleColor: string,
    onClose: () => void
  ): Phaser.GameObjects.Container {
    const x = Math.round(this.scale.width / 2 - W / 2);
    const y = Math.round(Math.max(40, this.scale.height * 0.16));
    const root = this.add.container(x, y).setDepth(24);
    const bg = this.add.graphics();
    bg.fillStyle(0x100e14, 0.96);
    bg.fillRoundedRect(0, 0, W, H, 6);
    bg.lineStyle(2, trim, 0.9);
    bg.strokeRoundedRect(0, 0, W, H, 6);
    const header = this.add.text(W / 2, 12, title, {
      fontFamily: "monospace", fontSize: "16px", color: titleColor, fontStyle: "bold",
    }).setOrigin(0.5, 0);
    const goldLine = this.add.text(W / 2, 30, `your gold: ${this.myGold()}`, {
      fontFamily: "monospace", fontSize: "13px", color: "#d8b13a",
    }).setOrigin(0.5, 0);
    const closeX = this.add.text(W - 8, 6, "✕", { fontFamily: "monospace", fontSize: "15px", color: "#8a8a96" })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", onClose);
    root.add([bg, header, goldLine, closeX]);
    return root;
  }

  openVendorShop(items: Array<{ item: any; price: number }>) {
    this.vendorItems = items;
    this.vendorVisible = true;
    this.rebuildVendor();
  }

  closeVendor() {
    this.vendorVisible = false;
    this.vendorRoot?.destroy();
    this.vendorRoot = undefined;
  }

  private rebuildVendor() {
    this.vendorRoot?.destroy();
    const W = 380;
    const rowH = 48;
    const H = 58 + this.vendorItems.length * rowH + 26;
    const root = this.buildStorefront(W, H, "TORVALD'S WARES", 0x8a6a2a, "#d8a868", () => this.closeVendor());
    const gold = this.myGold();

    this.vendorItems.forEach((e, i) => {
      const ry = 54 + i * rowH;
      const afford = gold >= e.price;
      const cell = this.add.rectangle(W / 2, ry + rowH / 2 - 2, W - 20, rowH - 5, 0x1a1720)
        .setStrokeStyle(1.5, afford ? 0x8a6a2a : 0x3a3a42, 0.9)
        .setInteractive({ useHandCursor: true });
      cell.on("pointerover", () => cell.setFillStyle(0x262030));
      cell.on("pointerout", () => cell.setFillStyle(0x1a1720));
      cell.on("pointerdown", () => this.gs.room?.send("buyitem", { id: e.item.id }));
      const iconKey = `icon_${e.item.base}`;
      const parts: Phaser.GameObjects.GameObject[] = [cell];
      if (this.textures.exists(iconKey)) {
        parts.push(this.add.image(28, ry + rowH / 2 - 2, iconKey).setScale(0.68));
      }
      const name = this.add.text(48, ry + 6, e.item.name, {
        fontFamily: "monospace", fontSize: "13px", color: rarityColorStr(e.item.rarity), fontStyle: "bold",
      });
      const lines = statLines(e.item.stats ?? {});
      const sub = this.add.text(48, ry + 24, lines.slice(0, 2).join(" · ") || "plain steel", {
        fontFamily: "monospace", fontSize: "11px", color: "#8a8a96",
      });
      const price = this.add.text(W - 20, ry + 13, `${e.price}g`, {
        fontFamily: "monospace", fontSize: "14px", color: afford ? "#d8b13a" : "#7a5a5a", fontStyle: "bold",
      }).setOrigin(1, 0);
      root.add([...parts, name, sub, price]);
    });
    const hint = this.add.text(W / 2, H - 16, "click an item to buy · right-click bag items to sell · Esc to leave", {
      fontFamily: "monospace", fontSize: "11px", color: "#6a5e4e",
    }).setOrigin(0.5, 0);
    root.add(hint);
    this.vendorRoot = root;
    this.vendorBounds.setTo(root.x, root.y, W, H);
  }

  openGamble(items: Array<{ id: string; base: string; name: string; price: number }>) {
    this.gambleItems = items;
    this.gambleVisible = true;
    this.rebuildGamble();
  }

  closeGamble() {
    this.gambleVisible = false;
    this.gambleRoot?.destroy();
    this.gambleRoot = undefined;
  }

  private rebuildGamble() {
    this.gambleRoot?.destroy();
    const W = 340;
    const rowH = 42;
    const H = 72 + this.gambleItems.length * rowH + 26;
    const root = this.buildStorefront(W, H, "FENWICK'S GAMBLE", 0x7a4a8a, "#c88ad8", () => this.closeGamble());
    const tag = this.add.text(W / 2, 44, "no refunds. no promises. no idea what's in them.", {
      fontFamily: "monospace", fontSize: "11px", color: "#8a7a96", fontStyle: "italic",
    }).setOrigin(0.5, 0);
    root.add(tag);
    const gold = this.myGold();

    this.gambleItems.forEach((e, i) => {
      const ry = 66 + i * rowH;
      const afford = gold >= e.price;
      const cell = this.add.rectangle(W / 2, ry + rowH / 2 - 2, W - 20, rowH - 5, 0x1c1622)
        .setStrokeStyle(1.5, afford ? 0x7a4a8a : 0x3a3a42, 0.9)
        .setInteractive({ useHandCursor: true });
      cell.on("pointerover", () => cell.setFillStyle(0x2a2032));
      cell.on("pointerout", () => cell.setFillStyle(0x1c1622));
      cell.on("pointerdown", () => this.gs.room?.send("gambleitem", { id: e.id }));
      const q = this.add.text(28, ry + rowH / 2 - 2, "?", {
        fontFamily: "monospace", fontSize: "17px", color: "#c88ad8", fontStyle: "bold",
      }).setOrigin(0.5);
      const name = this.add.text(44, ry + 10, e.name, {
        fontFamily: "monospace", fontSize: "13px", color: "#c9c9d4",
      });
      const price = this.add.text(W - 20, ry + 10, `${e.price}g`, {
        fontFamily: "monospace", fontSize: "14px", color: afford ? "#d8b13a" : "#7a5a5a", fontStyle: "bold",
      }).setOrigin(1, 0);
      root.add([cell, q, name, price]);
    });
    const hint = this.add.text(W / 2, H - 16, "the roll can land anything, from any depth · Esc to leave", {
      fontFamily: "monospace", fontSize: "11px", color: "#6a5e6e",
    }).setOrigin(0.5, 0);
    root.add(hint);
    this.gambleRoot = root;
    this.gambleBounds.setTo(root.x, root.y, W, H);
  }

  // --- Torvald's forge: punch sockets into bare gear ---

  openSmith(items: typeof this.smithItems) {
    this.smithItems = items;
    this.smithVisible = true;
    this.rebuildSmith();
  }

  closeSmith() {
    this.smithVisible = false;
    this.smithRoot?.destroy();
    this.smithRoot = undefined;
  }

  private rebuildSmith() {
    this.smithRoot?.destroy();
    const W = 400;
    const rowH = 48;
    const H = 62 + Math.max(1, this.smithItems.length) * rowH + 30;
    const root = this.buildStorefront(W, H, "TORVALD'S FORGE", 0x8a6a2a, "#d8a868", () => this.closeSmith());
    const gold = this.myGold();
    root.add(this.add.text(W / 2, 44, "punch sockets into bare steel — or pull the stones back out", {
      fontFamily: "monospace", fontSize: "11px", color: "#a89678", fontStyle: "italic",
    }).setOrigin(0.5, 0));

    // where the piece lives, so you can spot your worn gear at a glance
    const SRC: Record<string, { tag: string; color: string }> = {
      bag: { tag: "", color: "#7a7a86" },
      worn: { tag: "[worn]", color: "#8ad0c0" },
      merc: { tag: "[merc]", color: "#c8a0e0" },
    };

    if (this.smithItems.length === 0) {
      root.add(this.add.text(W / 2, 96, "nothing to work — bring identified weapons, helms,", {
        fontFamily: "monospace", fontSize: "12px", color: "#8a8a96",
      }).setOrigin(0.5, 0));
      root.add(this.add.text(W / 2, 114, "chests or shields (bare to socket, or stoned to empty)", {
        fontFamily: "monospace", fontSize: "12px", color: "#8a8a96",
      }).setOrigin(0.5, 0));
    }

    this.smithItems.forEach((e, i) => {
      const ry = 60 + i * rowH;
      const afford = gold >= e.price;
      const unsock = e.action === "unsocket";
      const trim = unsock ? 0x7a4a8a : 0x8a6a2a;
      const cell = this.add.rectangle(W / 2, ry + rowH / 2 - 2, W - 20, rowH - 5, 0x1a1720)
        .setStrokeStyle(1.5, afford ? trim : 0x3a3a42, 0.9)
        .setInteractive({ useHandCursor: true });
      cell.on("pointerover", () => cell.setFillStyle(0x262030));
      cell.on("pointerout", () => cell.setFillStyle(0x1a1720));
      cell.on("pointerdown", () => this.gs.room?.send(unsock ? "unsocket" : "punchsockets", { id: e.id }));
      const iconKey = `icon_${e.base}`;
      const parts: Phaser.GameObjects.GameObject[] = [cell];
      if (this.textures.exists(iconKey)) {
        parts.push(this.add.image(28, ry + rowH / 2 - 2, iconKey).setScale(0.68));
      }
      const src = SRC[e.source] ?? SRC.bag;
      const name = this.add.text(48, ry + 6, e.name, {
        fontFamily: "monospace", fontSize: "13px", color: rarityColorStr(e.rarity), fontStyle: "bold",
      });
      if (src.tag) {
        root.add(this.add.text(48 + name.width + 8, ry + 8, src.tag, {
          fontFamily: "monospace", fontSize: "10px", color: src.color, fontStyle: "bold",
        }));
      }
      const action = unsock
        ? `${e.slot} · pull ${e.seated} stone${e.seated === 1 ? "" : "s"} out`
        : `${e.slot} · punch ◈${e.sockets}`;
      const sub = this.add.text(48, ry + 24, action, {
        fontFamily: "monospace", fontSize: "11px", color: unsock ? "#c8a0d8" : "#a89678",
      });
      const price = this.add.text(W - 20, ry + 13, `${e.price}g`, {
        fontFamily: "monospace", fontSize: "14px", color: afford ? "#d8b13a" : "#7a5a5a", fontStyle: "bold",
      }).setOrigin(1, 0);
      root.add([...parts, name, sub, price]);
    });
    const hint = this.add.text(W / 2, H - 16, "click to work a piece · pulled stones go to your bag (or the floor if full) · Esc to leave", {
      fontFamily: "monospace", fontSize: "9px", color: "#6a5e4e",
    }).setOrigin(0.5, 0);
    root.add(hint);
    this.smithRoot = root;
    this.smithBounds.setTo(root.x, root.y, W, H);
  }

  // --- the Ternion Altar: reforge + recipe book ---

  openAltar(data: typeof this.altarData) {
    this.altarData = data ?? {};
    this.altarVisible = true;
    this.rebuildAltar();
  }

  closeAltar() {
    this.altarVisible = false;
    this.altarRoot?.destroy();
    this.altarRoot = undefined;
  }

  private rebuildAltar() {
    this.altarRoot?.destroy();
    const W = 400;
    const recipeRowH = 30;
    const rowH = 48;
    const gold = this.myGold();
    const rc = this.altarData.recipes ?? {};
    const reforge = this.altarData.reforge ?? [];

    const recipes: Array<{ key: string; label: string; avail: boolean }> = [
      { key: "runeup", label: rc.runeup ? `upgrade 3× ${rc.runeup} runes → next tier` : "3× identical runes → next rune tier", avail: !!rc.runeup },
      { key: "magics", label: "3× magic items → an unidentified rare", avail: !!rc.magics },
      { key: "rares", label: "3× rare items → an Adept's rare (+1 skills)", avail: !!rc.rares },
    ];
    if (rc.pegleg) recipes.push({ key: "pegleg", label: "The Peg Leg → ???", avail: true });

    const recipesTop = 60;
    const reforgeHeaderY = recipesTop + recipes.length * recipeRowH + 6;
    const reforgeTop = reforgeHeaderY + 22;
    const nItems = Math.max(1, reforge.length);
    const H = reforgeTop + nItems * rowH + 26;

    const root = this.buildStorefront(W, H, "THE TERNION ALTAR", 0x7a4a8a, "#c88ad8", () => this.closeAltar());
    root.add(this.add.text(W / 2, 44, "gamble an item's affixes for gold — or work a recipe", {
      fontFamily: "monospace", fontSize: "11px", color: "#a888b8", fontStyle: "italic",
    }).setOrigin(0.5, 0));

    // recipe buttons — the old auto-fire book, now click-to-craft
    recipes.forEach((r, i) => {
      const ry = recipesTop + i * recipeRowH;
      const trim = r.avail ? 0x4a8a5a : 0x3a3a42;
      const cell = this.add.rectangle(W / 2, ry + recipeRowH / 2 - 3, W - 20, recipeRowH - 5, 0x141a16)
        .setStrokeStyle(1.5, trim, 0.9);
      if (r.avail) {
        cell.setInteractive({ useHandCursor: true });
        cell.on("pointerover", () => cell.setFillStyle(0x1e2a20));
        cell.on("pointerout", () => cell.setFillStyle(0x141a16));
        cell.on("pointerdown", () => this.gs.room?.send("altarrecipe", { recipe: r.key }));
      }
      const label = this.add.text(18, ry + 6, r.label, {
        fontFamily: "monospace", fontSize: "11px", color: r.avail ? "#a8d8b0" : "#5a5a62",
      });
      root.add([cell, label]);
    });

    root.add(this.add.text(W / 2, reforgeHeaderY, "— REFORGE —", {
      fontFamily: "monospace", fontSize: "10px", color: "#8a7a96", fontStyle: "bold",
    }).setOrigin(0.5, 0));

    if (reforge.length === 0) {
      root.add(this.add.text(W / 2, reforgeTop + 14, "no reforgeable gear — bring identified magic or rare", {
        fontFamily: "monospace", fontSize: "12px", color: "#8a8a96",
      }).setOrigin(0.5, 0));
    }

    reforge.forEach((e, i) => {
      const ry = reforgeTop + i * rowH;
      const afford = gold >= e.price;
      const cell = this.add.rectangle(W / 2, ry + rowH / 2 - 2, W - 20, rowH - 5, 0x1a1720)
        .setStrokeStyle(1.5, afford ? 0x7a4a8a : 0x3a3a42, 0.9)
        .setInteractive({ useHandCursor: true });
      cell.on("pointerover", () => cell.setFillStyle(0x262030));
      cell.on("pointerout", () => cell.setFillStyle(0x1a1720));
      cell.on("pointerdown", () => this.gs.room?.send("reforge", { id: e.id }));
      const iconKey = `icon_${e.base}`;
      const parts: Phaser.GameObjects.GameObject[] = [cell];
      if (this.textures.exists(iconKey)) parts.push(this.add.image(28, ry + rowH / 2 - 2, iconKey).setScale(0.68));
      const name = this.add.text(48, ry + 6, e.name, {
        fontFamily: "monospace", fontSize: "13px", color: rarityColorStr(e.rarity), fontStyle: "bold",
      });
      const sub = this.add.text(48, ry + 24, `${e.slot} · ilvl ${e.ilvl} · re-roll all affixes`, {
        fontFamily: "monospace", fontSize: "11px", color: "#a888b8",
      });
      const price = this.add.text(W - 20, ry + 13, `${e.price}g`, {
        fontFamily: "monospace", fontSize: "14px", color: afford ? "#d8b13a" : "#7a5a5a", fontStyle: "bold",
      }).setOrigin(1, 0);
      root.add([...parts, name, sub, price]);
    });

    root.add(this.add.text(W / 2, H - 16, "reforge keeps the base, re-rolls the magic · recipes consume their reagents · Esc to leave", {
      fontFamily: "monospace", fontSize: "9px", color: "#6a5e4e",
    }).setOrigin(0.5, 0));
    this.altarRoot = root;
    this.altarBounds.setTo(root.x, root.y, W, H);
  }

  // --- Maren's rogues: hire, revive, outfit ---

  private mercLoadoutRev = -1;

  openMercHire(msg: any) {
    this.mercOffers = msg?.offers ?? [];
    this.mercCurrent = msg?.current ?? null;
    this.mercHireInfo = msg ?? {};
    this.mercHireVisible = true;
    this.rebuildMercHire();
  }

  closeMercHire() {
    this.mercHireVisible = false;
    this.mercHireRoot?.destroy();
    this.mercHireRoot = undefined;
  }

  private rebuildMercHire() {
    this.mercHireRoot?.destroy();
    const info = this.mercHireInfo ?? {};
    const classId: string = info.classId ?? "rogue";
    const locked: boolean = !!info.locked;
    const accent: number = info.npcColor ?? 0xc03848;
    const accentStr = "#" + accent.toString(16).padStart(6, "0");
    const W = 360;
    const rowH = 58;
    const curH = this.mercCurrent ? 46 : 0;
    const lockH = locked ? 40 : 0;
    const H = 62 + lockH + curH + this.mercOffers.length * rowH + 30;
    const root = this.buildStorefront(W, H, info.npcTitle ?? "HIRING HALL", accent, accentStr, () => this.closeMercHire());
    const gold = this.myGold();
    const archColor: Record<string, string> = { fire: "#e07a3a", cold: "#7ab0e8", light: "#c8b4ff", vicious: "#d8b13a" };
    let y = 48;

    if (locked) {
      root.add(this.add.text(W / 2, y + 2, `sealed — reach Act ${info.unlockAct ?? "?"} to enlist ${(info.className ?? "them").toLowerCase()}s`, {
        fontFamily: "monospace", fontSize: "12px", color: "#c0a050", fontStyle: "italic",
        wordWrap: { width: W - 30 }, align: "center",
      }).setOrigin(0.5, 0));
      y += lockH;
    }

    if (this.mercCurrent) {
      const cur = this.mercCurrent;
      const line = this.add.text(W / 2, y + 4, cur.dead
        ? `✝ ${cur.name} has fallen — raise them for ${cur.reviveCost}g`
        : `${cur.name} marches with you (a new hire replaces them)`, {
        fontFamily: "monospace", fontSize: "12px", color: cur.dead ? "#c05050" : "#8fbf9f",
        wordWrap: { width: W - 30 },
      }).setOrigin(0.5, 0);
      root.add(line);
      if (cur.dead && !locked) {
        line.setInteractive({ useHandCursor: true });
        line.on("pointerdown", () => this.gs.room?.send("revivemerc", {}));
        line.on("pointerover", () => line.setColor("#ff8a8a"));
        line.on("pointerout", () => line.setColor("#c05050"));
      }
      y += curH;
    }

    for (const o of this.mercOffers) {
      const afford = gold >= o.cost && !locked;
      const cell = this.add.rectangle(W / 2, y + rowH / 2 - 2, W - 20, rowH - 6, 0x1c1216)
        .setStrokeStyle(1.5, afford ? accent : 0x3a3a42, 0.8);
      if (!locked) {
        cell.setInteractive({ useHandCursor: true });
        cell.on("pointerover", () => cell.setFillStyle(0x2a1a20));
        cell.on("pointerout", () => cell.setFillStyle(0x1c1216));
        cell.on("pointerdown", () => this.gs.room?.send("hiremerc", { classId, archetype: o.archetype, name: o.name }));
      } else {
        cell.setAlpha(0.5);
      }
      const name = this.add.text(18, y + 8, `${o.name} — ${o.title}`, {
        fontFamily: "monospace", fontSize: "14px", color: archColor[o.archetype] ?? "#c9c9d4", fontStyle: "bold",
      }).setAlpha(locked ? 0.6 : 1);
      const blurb = this.add.text(18, y + 28, o.blurb, { fontFamily: "monospace", fontSize: "11px", color: "#8a8a96" }).setAlpha(locked ? 0.6 : 1);
      const price = this.add.text(W - 20, y + 15, `${o.cost}g`, {
        fontFamily: "monospace", fontSize: "14px", color: afford ? "#d8b13a" : "#7a5a5a", fontStyle: "bold",
      }).setOrigin(1, 0);
      root.add([cell, name, blurb, price]);
      y += rowH;
    }
    const hint = this.add.text(W / 2, H - 16, "they follow, fight, and can die · [H] manages their gear", {
      fontFamily: "monospace", fontSize: "11px", color: "#6a5e5e",
    }).setOrigin(0.5, 0);
    root.add(hint);
    this.mercHireRoot = root;
    this.mercHireBounds.setTo(root.x, root.y, W, H);
  }

  // the [H] panel: your Rogue's contract, stats, and three gear slots
  setMercLoadout(merc: any) {
    this.mercData = merc;
    if (this.mercVisible) this.rebuildMercPanel();
    if (this.mercHireVisible && merc) {
      // hiring/reviving refreshes Maren's board via openmercs — nothing to do here
    }
  }

  toggleMercPanel() {
    this.mercVisible = !this.mercVisible;
    if (this.mercVisible) this.rebuildMercPanel();
    else this.closeMercPanel();
  }

  closeMercPanel() {
    this.mercVisible = false;
    this.mercRoot?.destroy();
    this.mercRoot = undefined;
  }

  private rebuildMercPanel() {
    this.mercRoot?.destroy();
    const W = 340;
    const m = this.mercData;
    const bag = (this.gs.lastLoadout?.inventory ?? []).filter(
      (it: any) => ["weapon", "helm", "chest"].includes(it.slot) && !it.unidentified
    );
    const bagRows = m && !m.dead ? Math.max(1, Math.ceil(bag.length / 6)) : 0;
    const FOOTER_H = 48;
    const H = m ? 156 + bagRows * 44 + 32 + FOOTER_H : 90;
    const mcls = m ? mercClassById(m.cls) : null;
    const title = mcls ? `YOUR ${mcls.className.toUpperCase()}` : "YOUR COMPANION";
    const accent = mcls ? mcls.npcColor : 0x2a6a44;
    const accentStr = "#" + accent.toString(16).padStart(6, "0");
    const root = this.buildStorefront(W, H, title, accent, accentStr, () => this.closeMercPanel());

    if (!m) {
      root.add(this.add.text(W / 2, 52, "no companion — hire one at a hall in town", {
        fontFamily: "monospace", fontSize: "13px", color: "#8a8a96",
      }).setOrigin(0.5, 0));
    } else {
      // shared hover footer: hover any item (worn or in her bag) to read its name + stats
      const hoverName = this.add.text(W / 2, H - FOOTER_H + 2, "", {
        fontFamily: "monospace", fontSize: "12px", color: "#c9c9d4", fontStyle: "bold",
      }).setOrigin(0.5, 0);
      const hoverStats = this.add.text(W / 2, H - FOOTER_H + 18, "", {
        fontFamily: "monospace", fontSize: "10px", color: "#8a8a96",
        wordWrap: { width: W - 20 }, align: "center",
      }).setOrigin(0.5, 0);
      root.add([hoverName, hoverStats]);
      const showTip = (it: any) => {
        hoverName.setText(it.name).setColor(rarityColorStr(it.rarity));
        hoverStats.setText(statLines(it.stats ?? {}).join(" · ") || "plain steel");
      };
      const clearTip = () => { hoverName.setText(""); hoverStats.setText(""); };
      const archColor: Record<string, string> = { fire: "#e07a3a", cold: "#7ab0e8", light: "#c8b4ff", vicious: "#d8b13a" };
      root.add(this.add.text(W / 2, 44, `${m.name} — ${m.archetype} ${(m.className ?? "rogue").toLowerCase()}${m.dead ? "  ✝ FALLEN" : ""}`, {
        fontFamily: "monospace", fontSize: "14px", color: m.dead ? "#c05050" : archColor[m.archetype] ?? "#c9c9d4", fontStyle: "bold",
      }).setOrigin(0.5, 0));
      root.add(this.add.text(W / 2, 60, `dmg ${m.dmgMin}-${m.dmgMax} · crit ${m.crit}% · armor ${m.armor} · life ${m.maxHp}`, {
        fontFamily: "monospace", fontSize: "12px", color: "#8a8a96",
      }).setOrigin(0.5, 0));

      // her three slots (D2 austerity)
      const slots: Array<{ slot: string; label: string }> = [
        { slot: "weapon", label: "WPN" }, { slot: "helm", label: "HLM" }, { slot: "chest", label: "CHS" },
      ];
      slots.forEach((sl, i) => {
        const sx = W / 2 - 66 + i * 66;
        const sy = 100;
        const item = m.gear?.[sl.slot];
        const cell = this.add.rectangle(sx, sy, 44, 44, 0x161a18)
          .setStrokeStyle(1.5, item ? 0x2a6a44 : 0x2a2a32)
          .setInteractive({ useHandCursor: true });
        cell.on("pointerdown", () => item && this.gs.room?.send("mercunequip", { slot: sl.slot }));
        if (item) {
          cell.on("pointerover", () => { cell.setStrokeStyle(1.5, 0x8fbf9f); showTip(item); });
          cell.on("pointerout", () => { cell.setStrokeStyle(1.5, 0x2a6a44); clearTip(); });
        }
        root.add(cell);
        if (item) {
          const iconKey = `icon_${item.base}`;
          if (this.textures.exists(iconKey)) root.add(this.add.image(sx, sy, iconKey).setScale(0.8));
          root.add(this.add.text(sx, sy + 26, item.name.slice(0, 12), {
            fontFamily: "monospace", fontSize: "9px", color: rarityColorStr(item.rarity),
          }).setOrigin(0.5, 0));
        } else {
          root.add(this.add.text(sx, sy, sl.label, { fontFamily: "monospace", fontSize: "11px", color: "#4a4a52" }).setOrigin(0.5));
        }
      });

      if (m.dead) {
        root.add(this.add.text(W / 2, 140, "they have fallen — raise them at their hall, in town", {
          fontFamily: "monospace", fontSize: "12px", color: "#c05050", fontStyle: "italic",
        }).setOrigin(0.5, 0));
      } else {
        root.add(this.add.text(14, 140, bag.length ? "hand over from your bag (click):" : "nothing in the bag they can wear", {
          fontFamily: "monospace", fontSize: "11px", color: "#6a7a6e",
        }));
        bag.slice(0, 18).forEach((it: any, i: number) => {
          const bx = 30 + (i % 6) * 48;
          const by = 172 + Math.floor(i / 6) * 44;
          const cell = this.add.rectangle(bx, by, 40, 40, 0x14181a)
            .setStrokeStyle(1, 0x2a3a32)
            .setInteractive({ useHandCursor: true });
          cell.on("pointerover", () => { cell.setStrokeStyle(1.5, 0x8fbf9f); showTip(it); });
          cell.on("pointerout", () => { cell.setStrokeStyle(1, 0x2a3a32); clearTip(); });
          cell.on("pointerdown", () => this.gs.room?.send("mercequip", { id: it.id }));
          root.add(cell);
          const iconKey = `icon_${it.base}`;
          if (this.textures.exists(iconKey)) root.add(this.add.image(bx, by, iconKey).setScale(0.72));
        });
      }
    }
    this.mercRoot = root;
    this.mercBounds.setTo(root.x, root.y, W, H);
  }

  // ==================================================================
  // --- dialogue window: D1/D2-style talking heads + paged text ---
  // ==================================================================

  private page(): void {
    (this.gs as any).sfx?.page?.();
  }

  // open the town-talk window for a shrine NPC (functional or storyteller)
  openNpcDialogue(shrineId: string, kind: string, variant: string) {
    const npcId = shrineNpcId(kind, variant);
    const npc = townNpcById(npcId);
    if (!npc) return;
    this.dlgNpc = {
      id: npcId, name: npc.name, shopKind: npc.shopKind, shopLabel: npc.shopLabel,
      shrineId, storyteller: !!npc.storytellerAct, smith: !!npc.smith,
    };
    this.dlgTopics = npc.topics;
    this.dialogueVisible = true;
    this.dlgMode = npc.shopKind ? "root" : "topics"; // talk-only NPCs skip the root
    this.rebuildDialogue();
    this.page();
  }

  // play a dungeon encounter's vignette (no menu — just paged text)
  // ---- The Codex: bestiary / chronicle / relics, the account's remembered world ----

  // server pushes the account's Codex on join, on any change, and when the Reliquary is opened
  setCodex(msg: { bestiary?: Record<string, number>; fragments?: string[]; relics?: string[]; open?: boolean }) {
    this.codex = {
      bestiary: msg.bestiary ?? {},
      fragments: msg.fragments ?? [],
      relics: msg.relics ?? [],
    };
    if (msg.open && !this.codexVisible) this.openCodex();
    else if (this.codexVisible) this.rebuildCodexPanel();
  }

  toggleCodex() {
    if (this.codexVisible) this.closeCodex();
    else this.openCodex();
  }

  private openCodex() {
    this.codexVisible = true;
    this.rebuildCodexPanel();
    this.page();
  }

  closeCodex() {
    this.codexVisible = false;
    this.codexRoot?.destroy();
    this.codexRoot = undefined;
  }

  // open a Codex entry's prose in the shared dialogue window (paged, space/click to advance)
  private showCodexEntry(name: string, pages: string[]) {
    this.dlgNpc = { id: "codex", name };
    this.dlgTopics = [];
    this.dlgPages = pages.filter(Boolean);
    this.dlgPageIdx = 0;
    this.dlgReturn = "close";
    this.dlgMode = "text";
    this.dialogueVisible = true;
    this.rebuildDialogue();
    this.page();
  }

  private rebuildCodexPanel() {
    this.codexRoot?.destroy();
    const W = 380;
    const x = Math.round(this.scale.width / 2 - W / 2);
    const y = 56;
    const root = this.add.container(x, y).setDepth(20);
    const rows: Phaser.GameObjects.GameObject[] = [];

    const TABS = ["BESTIARY", "CHRONICLE", "RELICS"];
    const tabH = 24;
    const tabTop = 40;
    const tabGap = 6;
    const tabW = (W - 28 - (TABS.length - 1) * tabGap) / TABS.length;
    const tabX0 = 14;
    TABS.forEach((t, i) => {
      const tx = tabX0 + i * (tabW + tabGap);
      const on = i === this.codexTab;
      const tabBg = this.add.rectangle(tx, tabTop, tabW, tabH, on ? 0x201a2a : 0x141220, on ? 1 : 0.8)
        .setOrigin(0, 0)
        .setStrokeStyle(1.5, on ? 0x9a7ad8 : 0x3a3242, 0.9)
        .setInteractive({ useHandCursor: true });
      tabBg.on("pointerover", () => { if (!on) tabBg.setFillStyle(0x1c1828, 0.9); });
      tabBg.on("pointerout", () => { if (!on) tabBg.setFillStyle(0x141220, 0.8); });
      tabBg.on("pointerdown", () => { this.codexTab = i; this.rebuildCodexPanel(); });
      rows.push(tabBg, this.add.text(tx + tabW / 2, tabTop + tabH / 2, t, {
        fontFamily: "monospace", fontSize: "12px", color: on ? "#c9b8e8" : "#8a8a96", fontStyle: "bold",
      }).setOrigin(0.5));
    });

    const listTop = tabTop + tabH + 14;
    let contentBottom = listTop;

    if (this.codexTab === 0) {
      // Bestiary — two columns, one line each, click a known kind to read it
      const seenCount = BESTIARY.filter((e) => (this.codex.bestiary[e.kind] ?? 0) > 0).length;
      rows.push(this.add.text(W / 2, listTop - 12, `recorded ${seenCount} / ${BESTIARY.length}`, {
        fontFamily: "monospace", fontSize: "11px", color: "#7a6a9a",
      }).setOrigin(0.5, 0));
      const half = Math.ceil(BESTIARY.length / 2);
      const colX = [14, W / 2 + 4];
      const colW = W / 2 - 20;
      const rowH = 17;
      BESTIARY.forEach((e, i) => {
        const col = i < half ? 0 : 1;
        const rowIdx = i < half ? i : i - half;
        const ry = listTop + 8 + rowIdx * rowH;
        const kills = this.codex.bestiary[e.kind] ?? 0;
        const seen = kills > 0;
        const insight = seen && kills >= e.insightAt;
        const color = !seen ? "#55505e" : insight ? "#c9a44a" : "#c3c3d0";
        const label = seen ? `${insight ? "✦" : "•"} ${e.name}` : "• ??????";
        rows.push(this.add.text(colX[col], ry, label, { fontFamily: "monospace", fontSize: "12px", color }).setOrigin(0, 0));
        if (seen) {
          rows.push(this.add.text(colX[col] + colW, ry, `×${kills}`, { fontFamily: "monospace", fontSize: "11px", color: "#7a7a86" }).setOrigin(1, 0));
          const hit = this.add.rectangle(colX[col] + colW / 2, ry + 8, colW, rowH, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
          hit.on("pointerover", () => hit.setFillStyle(0xffffff, 0.05));
          hit.on("pointerout", () => hit.setFillStyle(0xffffff, 0.001));
          hit.on("pointerdown", () => this.showCodexEntry(e.name, insight ? [e.lore, `Insight — ${e.insight}`] : [e.lore, `You have not studied it enough to know its ways. (${kills}/${e.insightAt} slain)`]));
          rows.push(hit);
        }
      });
      contentBottom = listTop + 8 + half * rowH + 4;

    } else if (this.codexTab === 1) {
      // Chronicle — chapters and their fragments; a complete chapter is an active boon
      let cy = listTop;
      for (const ch of CODEX_CHAPTERS) {
        const frags = chapterFragments(ch.id);
        const have = frags.filter((f) => this.codex.fragments.includes(f.id)).length;
        const done = chapterComplete(ch.id, this.codex.fragments);
        rows.push(this.add.text(14, cy, `${done ? "✓ " : ""}${ch.name}`, {
          fontFamily: "monospace", fontSize: "14px", color: done ? "#8ad07f" : "#c9b8e8", fontStyle: "bold",
        }));
        rows.push(this.add.text(W - 14, cy, `${have}/${frags.length}`, {
          fontFamily: "monospace", fontSize: "13px", color: done ? "#8ad07f" : "#9a8fb0",
        }).setOrigin(1, 0));
        cy += 18;
        rows.push(this.add.text(14, cy, done ? `active: ${ch.reward.desc}` : `reward: ${ch.reward.desc}`, {
          fontFamily: "monospace", fontSize: "11px", color: done ? "#7a9a7e" : "#6a6a74", fontStyle: "italic",
        }));
        cy += 17;
        for (const f of frags) {
          const got = this.codex.fragments.includes(f.id);
          rows.push(this.add.text(24, cy, got ? `• ${f.title}` : "• ??????", {
            fontFamily: "monospace", fontSize: "12px", color: got ? "#c3c3d0" : "#55505e",
          }));
          if (got) {
            const hit = this.add.rectangle(W / 2, cy + 7, W - 20, 15, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
            hit.on("pointerover", () => hit.setFillStyle(0xffffff, 0.05));
            hit.on("pointerout", () => hit.setFillStyle(0xffffff, 0.001));
            hit.on("pointerdown", () => this.showCodexEntry(f.title, [f.text]));
            rows.push(hit);
          }
          cy += 16;
        }
        cy += 8;
      }
      contentBottom = cy;

    } else {
      // Relics — the story of every signature item you've carried
      const got = RELIC_LORE.filter((r) => this.codex.relics.includes(r.name)).length;
      rows.push(this.add.text(W / 2, listTop - 12, `catalogued ${got} / ${RELIC_LORE.length}`, {
        fontFamily: "monospace", fontSize: "11px", color: "#7a6a9a",
      }).setOrigin(0.5, 0));
      let cy = listTop + 8;
      const rowH = 18;
      for (const r of RELIC_LORE) {
        const found = this.codex.relics.includes(r.name);
        rows.push(this.add.text(16, cy, found ? `◆ ${r.name}` : "◆ ??????", {
          fontFamily: "monospace", fontSize: "13px", color: found ? "#c9a44a" : "#55505e",
        }));
        if (found) {
          const hit = this.add.rectangle(W / 2, cy + 8, W - 20, rowH, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
          hit.on("pointerover", () => hit.setFillStyle(0xffffff, 0.05));
          hit.on("pointerout", () => hit.setFillStyle(0xffffff, 0.001));
          hit.on("pointerdown", () => this.showCodexEntry(r.name, [r.lore]));
          rows.push(hit);
        }
        cy += rowH;
      }
      contentBottom = cy;
    }

    const footer = contentBottom + 6;
    rows.push(this.add.text(W / 2, footer, "click a recorded entry to read it", {
      fontFamily: "monospace", fontSize: "10px", color: "#6a6a74",
    }).setOrigin(0.5, 0));
    const H = footer + 22;

    const bg = this.add.graphics();
    bg.fillStyle(0x0d0c14, 0.95);
    bg.fillRoundedRect(0, 0, W, H, 6);
    bg.lineStyle(2, 0x6a5a9a, 0.9);
    bg.strokeRoundedRect(0, 0, W, H, 6);
    bg.lineStyle(1, 0x3a2f52, 0.9);
    bg.strokeRoundedRect(3, 3, W - 6, H - 6, 5);
    const header = this.add.text(W / 2, 14, "— THE CODEX —", {
      fontFamily: "monospace", fontSize: "16px", color: "#c9b8e8", fontStyle: "bold",
    }).setOrigin(0.5, 0);
    const closeX = this.add.text(W - 8, 6, "✕", { fontFamily: "monospace", fontSize: "15px", color: "#8a8a96" })
      .setOrigin(1, 0).setInteractive({ useHandCursor: true }).on("pointerdown", () => this.closeCodex());
    root.add([bg, header, closeX, ...rows]);
    this.codexRoot = root;
    this.codexBounds.setTo(x, y, W, H);
  }

  // an authored story beat — paged prose in the dialogue window. The finale (ending: true)
  // waits for the victory banner to land, then plays behind a full-screen veil.
  openStoryBeat(questId: string) {
    const beat = storyBeatFor(questId);
    if (!beat) return;
    const play = () => {
      if (beat.ending) {
        this.endingVeil?.destroy();
        this.endingVeil = this.add
          .rectangle(0, 0, this.scale.width, this.scale.height, 0x07060a, 0)
          .setOrigin(0, 0).setScrollFactor(0).setDepth(999_000).setInteractive();
        this.tweens.add({ targets: this.endingVeil, alpha: 0.92, duration: 1000 });
      }
      this.dlgNpc = { id: `beat_${questId}`, name: beat.title };
      this.dlgTopics = [];
      this.dlgPages = beat.pages;
      this.dlgPageIdx = 0;
      this.dlgReturn = "close";
      this.dlgMode = "text";
      this.dialogueVisible = true;
      this.rebuildDialogue();
      this.page();
    };
    if (beat.ending) this.time.delayedCall(1600, play); // let the victory banner + gold shower land first
    else play();
  }

  // a set-piece reads like an encounter vignette — paged inscription, no menu
  openSetpieceDialogue(spId: string) {
    const sp = setpieceById(spId);
    if (!sp) return;
    this.dlgNpc = { id: spId, name: sp.label };
    this.dlgTopics = [];
    this.dlgPages = sp.pages;
    this.dlgPageIdx = 0;
    this.dlgReturn = "close";
    this.dlgMode = "text";
    this.dialogueVisible = true;
    this.rebuildDialogue();
    this.page();
  }

  openEncounterDialogue(encId: string) {
    const enc = encounterById(encId);
    if (!enc) return;
    this.dlgNpc = { id: encId, name: enc.label };
    this.dlgTopics = [];
    this.dlgPages = enc.pages;
    this.dlgPageIdx = 0;
    this.dlgReturn = "close";
    this.dlgMode = "text";
    this.dialogueVisible = true;
    this.rebuildDialogue();
    this.page();
  }

  closeDialogue() {
    this.dialogueVisible = false;
    this.dialogueRoot?.destroy();
    this.dialogueRoot = undefined;
    this.dlgNpc = null;
    this.dlgTopics = [];
    this.dlgPages = [];
    // the finale's veil lifts with its last page — fade it out rather than snap
    if (this.endingVeil) {
      const veil = this.endingVeil;
      this.endingVeil = undefined;
      this.tweens.add({ targets: veil, alpha: 0, duration: 1200, onComplete: () => veil.destroy() });
    }
  }

  private selectTopic(topic: DialogueTopic) {
    const act = this.gs.room?.state.act ?? 1;
    this.dlgPages = topicPages(topic, act);
    this.dlgPageIdx = 0;
    this.dlgReturn = "topics";
    this.dlgMode = "text";
    this.rebuildDialogue();
    this.page();
  }

  // advance the paged text; roll back to the topics (or close) at the end
  advanceDialogue() {
    if (!this.dialogueVisible || this.dlgMode !== "text") return;
    this.dlgPageIdx++;
    if (this.dlgPageIdx >= this.dlgPages.length) {
      if (this.dlgReturn === "topics" && this.dlgTopics.length) {
        this.dlgMode = "topics";
        this.rebuildDialogue();
      } else {
        this.closeDialogue();
      }
    } else {
      this.rebuildDialogue();
      this.page();
    }
  }

  // Escape steps back one level; from the top it closes
  dialogueBack() {
    if (!this.dialogueVisible) return;
    if (this.dlgMode === "text") {
      if (this.dlgReturn === "topics" && this.dlgTopics.length) { this.dlgMode = "topics"; this.rebuildDialogue(); }
      else this.closeDialogue();
    } else if (this.dlgMode === "topics") {
      if (this.dlgNpc?.shopKind) { this.dlgMode = "root"; this.rebuildDialogue(); }
      else this.closeDialogue();
    } else {
      this.closeDialogue();
    }
  }

  private dlgButton(root: Phaser.GameObjects.Container, x: number, y: number, w: number, label: string, color: string, onClick: () => void) {
    const cell = this.add.rectangle(x, y, w, 34, 0x1c1712).setStrokeStyle(1.5, 0x6a5836, 0.9).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    cell.on("pointerover", () => cell.setFillStyle(0x2a2015));
    cell.on("pointerout", () => cell.setFillStyle(0x1c1712));
    cell.on("pointerdown", (p: Phaser.Input.Pointer) => { if (!p.rightButtonDown()) onClick(); });
    const t = this.add.text(x + 12, y + 9, label, { fontFamily: "monospace", fontSize: "14px", color }).setOrigin(0, 0);
    root.add([cell, t]);
  }

  private rebuildDialogue() {
    this.dialogueRoot?.destroy();
    if (!this.dlgNpc) return;
    const sw = this.scale.width;
    const sh = this.scale.height;
    const W = Math.min(620, sw - 40);
    // height depends on the mode
    let H = 156;
    if (this.dlgMode === "root") H = this.dlgNpc.smith ? 176 : 136;
    else if (this.dlgMode === "topics") H = 70 + (this.dlgTopics.length + 1) * 38 + 8;
    const x0 = Math.round((sw - W) / 2);
    const y0 = sh - H - 22;
    const root = this.add.container(x0, y0).setScrollFactor(0).setDepth(1_000_000);

    const bg = this.add.rectangle(0, 0, W, H, 0x0e0b07, 0.96).setStrokeStyle(2, 0xc9a44a, 0.9).setOrigin(0, 0);
    const inner = this.add.rectangle(4, 4, W - 8, H - 8, 0x000000, 0).setStrokeStyle(1, 0x6a5836, 0.6).setOrigin(0, 0);
    root.add([bg, inner]);

    // the speaker's name plate, sitting on the top edge
    const nameTab = this.add.rectangle(16, -13, 14 + this.dlgNpc.name.length * 8.4, 24, 0x1c1712).setStrokeStyle(1.5, 0xc9a44a, 0.9).setOrigin(0, 0);
    const nameTxt = this.add.text(22, -9, this.dlgNpc.name, { fontFamily: "monospace", fontSize: "14px", color: "#e8cf7a", fontStyle: "bold" }).setOrigin(0, 0);
    root.add([nameTab, nameTxt]);

    if (this.dlgMode === "text") {
      const body = this.add.text(20, 20, this.dlgPages[this.dlgPageIdx] ?? "", {
        fontFamily: "monospace", fontSize: "15px", color: "#ddd2be", lineSpacing: 5,
        wordWrap: { width: W - 40 },
      }).setOrigin(0, 0);
      root.add(body);
      // page dots + a blinking advance chevron
      const dots = this.dlgPages.map((_, i) => (i === this.dlgPageIdx ? "◆" : "◇")).join(" ");
      root.add(this.add.text(20, H - 22, dots, { fontFamily: "monospace", fontSize: "12px", color: "#8a7a4a" }).setOrigin(0, 0));
      const chev = this.add.text(W - 20, H - 22, "▸ space / click", { fontFamily: "monospace", fontSize: "12px", color: "#c9a44a" }).setOrigin(1, 0);
      root.add(chev);
      this.tweens.add({ targets: chev, alpha: 0.3, duration: 620, yoyo: true, repeat: -1 });
      // the whole window advances the text
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerdown", (p: Phaser.Input.Pointer) => { if (!p.rightButtonDown()) this.advanceDialogue(); });
    } else if (this.dlgMode === "root") {
      root.add(this.add.text(W / 2, 20, "❝ …", { fontFamily: "monospace", fontSize: "15px", color: "#9a8f7a", fontStyle: "italic" }).setOrigin(0.5, 0));
      this.dlgButton(root, 20, 48, W - 40, "❝  Talk", "#e8cf7a", () => { this.dlgMode = "topics"; this.rebuildDialogue(); this.page(); });
      const shop = this.dlgNpc.shopLabel ?? "Trade";
      this.dlgButton(root, 20, 88, W - 40, `▸  ${shop}`, "#c9b48a", () => {
        const id = this.dlgNpc?.shrineId;
        this.closeDialogue();
        if (id) this.gs.room?.send("touchshrine", { id }); // server opens the actual panel
      });
      // the smith's second trade: punch sockets into bare steel
      if (this.dlgNpc.smith) {
        this.dlgButton(root, 20, 128, W - 40, "◈  The forge (sockets)", "#d8a868", () => {
          this.closeDialogue();
          this.gs.room?.send("opensmith", {});
        });
      }
    } else {
      // topics
      let ty = 44;
      for (const topic of this.dlgTopics) {
        this.dlgButton(root, 20, ty, W - 40, `❝  ${topic.label}`, "#ddd2be", () => this.selectTopic(topic));
        ty += 38;
      }
      const backLabel = this.dlgNpc.shopKind ? "◂  Back" : "◂  Leave";
      this.dlgButton(root, 20, ty, W - 40, backLabel, "#9a8f7a", () => this.dialogueBack());
    }

    this.dialogueRoot = root;
    this.dialogueBounds.setTo(x0, y0 - 14, W, H + 14);
  }

  // --- the alchemist's stall ---

  openShop(healthCost: number, manaCost: number) {
    this.shopCosts = { health: healthCost, mana: manaCost };
    this.shopVisible = true;
    this.rebuildShop();
  }

  closeShop() {
    this.shopVisible = false;
    this.shopRoot?.destroy();
    this.shopRoot = undefined;
  }

  refreshShop() {
    if (this.shopVisible) this.rebuildShop();
  }

  private rebuildShop() {
    this.shopRoot?.destroy();
    const me = this.gs.room ? (this.gs.room.state as any).players?.get(this.gs.room.sessionId) : null;
    const W = 270;
    const H = 168;
    const x = Math.round(this.scale.width / 2 - W / 2);
    const y = Math.round(this.scale.height * 0.24);
    const root = this.add.container(x, y).setDepth(24);

    const bg = this.add.graphics();
    bg.fillStyle(0x0e120e, 0.95);
    bg.fillRoundedRect(0, 0, W, H, 6);
    bg.lineStyle(2, 0x3f7a4f, 0.9);
    bg.strokeRoundedRect(0, 0, W, H, 6);
    const header = this.add.text(W / 2, 12, "LYSA'S REMEDIES", {
      fontFamily: "monospace", fontSize: "16px", color: "#7fdc9f", fontStyle: "bold",
    }).setOrigin(0.5, 0);
    const goldLine = this.add.text(W / 2, 30, `your gold: ${Math.floor(me?.gold ?? 0)}`, {
      fontFamily: "monospace", fontSize: "13px", color: "#d8b13a",
    }).setOrigin(0.5, 0);
    const closeX = this.add.text(W - 8, 6, "✕", { fontFamily: "monospace", fontSize: "15px", color: "#8a8a96" })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.closeShop());
    root.add([bg, header, goldLine, closeX]);

    const rows: Array<{ kind: "health" | "mana"; name: string; color: number; count: number }> = [
      { kind: "health", name: "Health Potion", color: 0xc03838, count: me?.potions ?? 0 },
      { kind: "mana", name: "Mana Potion", color: 0x3858c0, count: me?.manaPotions ?? 0 },
    ];
    rows.forEach((r, i) => {
      const ry = 52 + i * 46;
      const cost = this.shopCosts[r.kind];
      const afford = (me?.gold ?? 0) >= cost;
      const cell = this.add.rectangle(W / 2, ry + 18, W - 24, 38, 0x18201a, 1)
        .setStrokeStyle(1.5, afford ? 0x3f7a4f : 0x3a3a42)
        .setInteractive({ useHandCursor: true });
      cell.on("pointerover", () => cell.setFillStyle(0x223026));
      cell.on("pointerout", () => cell.setFillStyle(0x18201a));
      cell.on("pointerdown", () => this.gs.room?.send("buypotion", { kind: r.kind }));
      const fill = this.add.text(W - 62, ry + 12, "[fill]", {
        fontFamily: "monospace", fontSize: "12px", color: afford ? "#7fdc9f" : "#4a5a4e",
      }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
      fill.on("pointerover", () => fill.setColor("#b8f8cf"));
      fill.on("pointerout", () => fill.setColor(afford ? "#7fdc9f" : "#4a5a4e"));
      fill.on("pointerdown", () => this.gs.room?.send("buypotion", { kind: r.kind, fill: true }));
      root.add(fill);
      const flask = this.add.rectangle(28, ry + 16, 10, 15, r.color).setStrokeStyle(1, 0x101018);
      const cork = this.add.rectangle(28, ry + 7, 4, 4, 0x8a6a3a);
      const name = this.add.text(42, ry + 6, r.name, { fontFamily: "monospace", fontSize: "14px", color: "#e8e8f0" });
      const held = this.add.text(42, ry + 21, `carrying ${r.count} / ${me?.maxPotions ?? 4}`, { fontFamily: "monospace", fontSize: "11px", color: "#8a8a96" });
      const price = this.add.text(W - 22, ry + 12, `${cost}g`, {
        fontFamily: "monospace", fontSize: "15px", color: afford ? "#d8b13a" : "#7a5a5a", fontStyle: "bold",
      }).setOrigin(1, 0);
      root.add([cell, flask, cork, name, held, price]);
    });

    const hint = this.add.text(W / 2, H - 14, "click a flask to buy · Esc to leave", {
      fontFamily: "monospace", fontSize: "11px", color: "#5a6a5e",
    }).setOrigin(0.5, 0);
    root.add(hint);

    this.shopRoot = root;
    this.shopBounds.setTo(x, y, W, H);
  }

  // --- the quest log (J) ---

  setQuests(list: typeof this.quests) {
    this.quests = list;
    if (this.questsVisible) this.rebuildQuestPanel();
    this.updateQuestTracker();
  }

  // click a quest in the log to pin it (name + counter) to the top-left
  private toggleTrack(id: string) {
    this.trackedQuestId = this.trackedQuestId === id ? null : id;
    if (this.trackedQuestId) localStorage.setItem("arpg_tracked_quest", this.trackedQuestId);
    else localStorage.removeItem("arpg_tracked_quest");
    if (this.questsVisible) this.rebuildQuestPanel();
    this.updateQuestTracker();
  }

  // --- the waypoint network: every stone you have touched, one panel ---

  openWaypoints(msg: any) {
    this.waypointsData = {
      list: Array.isArray(msg?.list) ? msg.list : [],
      actsUnlocked: msg?.actsUnlocked ?? 1,
      act: msg?.act ?? 1,
      floor: msg?.floor ?? 1,
    };
    if (msg?.open === false) return; // silent refresh — discovery without the panel
    this.waypointsVisible = true;
    this.rebuildWaypoints();
  }

  closeWaypoints() {
    this.waypointsVisible = false;
    this.waypointsRoot?.destroy();
    this.waypointsRoot = undefined;
  }

  private rebuildWaypoints() {
    this.waypointsRoot?.destroy();
    const data = this.waypointsData;
    if (!data) return;
    const ACT_NAMES = ["The Mournfield", "The Sunscar Wastes", "The Drowned Green", "The Hollow Throne", "The Endless Abyss"];
    const known = new Set(data.list);
    // group discovered stones by act; the abyss lists whatever floors it has yielded
    const byAct = new Map<number, number[]>();
    for (const key of known) {
      const [a, f] = key.split(":").map(Number);
      if (!a || !f) continue;
      if (!byAct.has(a)) byAct.set(a, []);
      byAct.get(a)!.push(f);
    }
    const acts = [...byAct.keys()].sort((a, b) => a - b);
    let rowCount = 0;
    for (const a of acts) rowCount += 1 + byAct.get(a)!.length;
    const W = 320;
    const H = Math.min(this.scale.height - 100, 80 + rowCount * 22 + 30);
    const root = this.buildStorefront(W, H, "THE WAYPOINT NETWORK", 0x4a5ac0, "#8ab0ff", () => this.closeWaypoints());
    let cy = 46;
    for (const a of acts) {
      const locked = a > data.actsUnlocked;
      byAct.get(a)!.sort((x, y) => x - y);
      root.add(this.add.text(16, cy, `${["ACT I", "ACT II", "ACT III", "ACT IV", "THE ABYSS"][a - 1] ?? `ACT ${a}`} — ${ACT_NAMES[a - 1] ?? ""}${locked ? "  🔒" : ""}`, {
        fontFamily: "monospace", fontSize: "12px", color: locked ? "#5a5a64" : "#9a8ac8", fontStyle: "bold",
      }));
      cy += 20;
      for (const f of byAct.get(a)!) {
        const here = a === data.act && f === data.floor;
        const label = f === 1 ? (a >= 5 ? "Abyss 1" : "Town") : a >= 5 ? `Abyss ${f}` : `Level ${f}`;
        const row = this.add.text(30, cy, `${here ? "◆" : "◇"} ${label}${here ? "  (you are here)" : ""}`, {
          fontFamily: "monospace", fontSize: "14px", color: here ? "#6a6a76" : locked ? "#5a5a64" : "#c9d4ff",
        });
        root.add(row);
        if (!here && !locked) {
          row.setInteractive({ useHandCursor: true });
          row.on("pointerover", () => row.setColor("#ffffff"));
          row.on("pointerout", () => row.setColor("#c9d4ff"));
          row.on("pointerdown", () => {
            this.gs.room?.send("waypointjump", { act: a, floor: f });
            this.closeWaypoints();
          });
        }
        cy += 22;
      }
      cy += 2;
    }
    root.add(this.add.text(W / 2, H - 16, "the whole party travels · Esc to close", {
      fontFamily: "monospace", fontSize: "11px", color: "#4a4a6a",
    }).setOrigin(0.5));
    this.waypointsRoot = root;
    this.waypointsBounds.setTo(root.x, root.y, W, H);
  }

  // --- the trade ring: a table with two sides and one handshake ---

  showTradeInvite(_from: string, name: string) {
    this.dismissTradeInvite();
    const W = 300;
    const H = 74;
    const root = this.add.container(Math.round(this.scale.width / 2 - W / 2), Math.round(this.scale.height * 0.68)).setDepth(26);
    const bg = this.add.graphics();
    bg.fillStyle(0x100e14, 0.96);
    bg.fillRoundedRect(0, 0, W, H, 6);
    bg.lineStyle(2, 0xd8b13a, 0.9);
    bg.strokeRoundedRect(0, 0, W, H, 6);
    const line = this.add.text(W / 2, 14, `🤝 ${name} wants to trade`, {
      fontFamily: "monospace", fontSize: "14px", color: "#e8cf7a", fontStyle: "bold",
    }).setOrigin(0.5, 0);
    const accept = this.add.text(W / 2 - 60, 44, "[ ACCEPT ]", {
      fontFamily: "monospace", fontSize: "14px", color: "#8ad07f", fontStyle: "bold",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.gs.room?.send("tradeaccept", {});
        this.dismissTradeInvite();
      });
    const decline = this.add.text(W / 2 + 60, 44, "[ decline ]", {
      fontFamily: "monospace", fontSize: "14px", color: "#c05050",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.gs.room?.send("tradedecline", {});
        this.dismissTradeInvite();
      });
    root.add([bg, line, accept, decline]);
    this.tradeInviteRoot = root;
    this.time.delayedCall(15000, () => this.dismissTradeInvite(root));
  }

  private dismissTradeInvite(only?: Phaser.GameObjects.Container) {
    if (only && this.tradeInviteRoot !== only) return; // a newer invite replaced this one
    this.tradeInviteRoot?.destroy();
    this.tradeInviteRoot = undefined;
  }

  openTrade(partnerName: string) {
    this.dismissTradeInvite();
    this.tradePartnerName = partnerName;
    this.tradeState = null;
    this.myOfferIds = [];
    this.myOfferGold = 0;
    this.tradeNoteMsg = "";
    this.tradeVisible = true;
    this.rebuildTrade();
  }

  updateTrade(state: any) {
    if (!this.tradeVisible) return;
    this.tradeState = state;
    // the server's echo is the truth — mirror it so stale clicks can't desync us
    this.myOfferIds = (state?.mine?.items ?? []).map((it: any) => it.id);
    this.myOfferGold = state?.mine?.gold ?? 0;
    this.rebuildTrade();
  }

  tradeNote(reason: string) {
    this.tradeNoteMsg = reason;
    if (this.tradeVisible) this.rebuildTrade();
  }

  closeTrade() {
    this.tradeVisible = false;
    this.tradeRoot?.destroy();
    this.tradeRoot = undefined;
    this.tradeState = null;
  }

  private cancelTrade() {
    this.gs.room?.send("tradecancel", {});
    this.closeTrade();
  }

  private sendOffer() {
    this.gs.room?.send("tradeset", { itemIds: this.myOfferIds, gold: this.myOfferGold });
  }

  private rebuildTrade() {
    this.tradeRoot?.destroy();
    const W = 470;
    const H = 406;
    const root = this.buildStorefront(W, H, `TRADE — ${this.tradePartnerName.toUpperCase()}`, 0xd8b13a, "#e8cf7a", () => this.cancelTrade());
    const st = this.tradeState;
    const colW = W / 2 - 20;
    const cell = 40;

    const drawOffer = (x0: number, title: string, offer: any, mineSide: boolean, confirmed: boolean) => {
      root.add(this.add.text(x0 + colW / 2, 48, title, {
        fontFamily: "monospace", fontSize: "13px", color: mineSide ? "#8ad07f" : "#7ab0e8", fontStyle: "bold",
      }).setOrigin(0.5, 0));
      const items: any[] = offer?.items ?? [];
      for (let i = 0; i < 6; i++) {
        const bx = x0 + 24 + (i % 3) * (cell + 8);
        const by = 88 + Math.floor(i / 3) * (cell + 8);
        const it = items[i];
        const c = this.add.rectangle(bx, by, cell, cell, 0x14121a)
          .setStrokeStyle(1, it ? (mineSide ? 0x3a6a44 : 0x3a5a7a) : 0x26242e);
        root.add(c);
        if (it) {
          const iconKey = `icon_${it.base}`;
          if (this.textures.exists(iconKey)) root.add(this.add.image(bx, by, iconKey).setScale(0.72));
          root.add(this.add.text(bx, by + cell / 2 + 2, it.name.slice(0, 11), {
            fontFamily: "monospace", fontSize: "9px", color: rarityColorStr(it.rarity),
          }).setOrigin(0.5, 0));
          const hover = this.add.text(x0 + colW / 2, 236, "", {
            fontFamily: "monospace", fontSize: "10px", color: "#8a8a96", wordWrap: { width: colW - 8 }, align: "center",
          }).setOrigin(0.5, 0);
          root.add(hover);
          c.setInteractive({ useHandCursor: mineSide });
          c.on("pointerover", () => {
            c.setStrokeStyle(1.5, 0xd8b13a);
            hover.setText(`${it.name} — ${statLines(it.stats ?? {}).slice(0, 3).join(" · ") || "plain steel"}`);
          });
          c.on("pointerout", () => {
            c.setStrokeStyle(1, mineSide ? 0x3a6a44 : 0x3a5a7a);
            hover.setText("");
          });
          if (mineSide) {
            c.on("pointerdown", () => {
              this.myOfferIds = this.myOfferIds.filter((id) => id !== it.id);
              this.sendOffer();
            });
          }
        }
      }
      root.add(this.add.text(x0 + 12, 196, `gold: ${offer?.gold ?? 0}`, {
        fontFamily: "monospace", fontSize: "13px", color: "#d8b13a",
      }));
      root.add(this.add.text(x0 + colW - 12, 196, confirmed ? "✓ CONFIRMED" : "…deciding", {
        fontFamily: "monospace", fontSize: "12px", color: confirmed ? "#8ad07f" : "#6a6a76",
      }).setOrigin(1, 0));
    };

    drawOffer(10, "YOUR OFFER", st?.mine, true, !!st?.myConfirmed);
    drawOffer(W / 2 + 10, `${this.tradePartnerName.toUpperCase()} OFFERS`, st?.theirs, false, !!st?.theirConfirmed);

    // divider
    const div = this.add.rectangle(W / 2, 150, 1, 190, 0x3a3648);
    root.add(div);

    // gold stepper (my side)
    const steps: Array<[string, number]> = [["+10", 10], ["+100", 100], ["+1k", 1000], ["reset", 0]];
    steps.forEach(([label, amt], i) => {
      const b = this.add.text(22 + i * 52, 214, `[${label}]`, {
        fontFamily: "monospace", fontSize: "12px", color: amt ? "#d8b13a" : "#8a8a96",
      }).setInteractive({ useHandCursor: true });
      b.on("pointerdown", () => {
        this.myOfferGold = amt === 0 ? 0 : Math.min(this.myGold(), this.myOfferGold + amt);
        this.sendOffer();
      });
      root.add(b);
    });

    // my bag: click to add to the table
    const offered = new Set(this.myOfferIds);
    const bag: any[] = (this.gs.lastLoadout?.inventory ?? []).filter((it: any) => !offered.has(it.id));
    root.add(this.add.text(14, 258, bag.length ? "your bag (click to offer):" : "your bag is empty", {
      fontFamily: "monospace", fontSize: "11px", color: "#6a6a76",
    }));
    bag.slice(0, 16).forEach((it: any, i: number) => {
      const bx = 32 + (i % 8) * 46;
      const by = 292 + Math.floor(i / 8) * 46;
      const c = this.add.rectangle(bx, by, 40, 40, 0x14181a).setStrokeStyle(1, 0x2a2a32)
        .setInteractive({ useHandCursor: true });
      c.on("pointerover", () => c.setStrokeStyle(1.5, 0xd8b13a));
      c.on("pointerout", () => c.setStrokeStyle(1, 0x2a2a32));
      c.on("pointerdown", () => {
        if (this.myOfferIds.length >= 6) return;
        this.myOfferIds = [...this.myOfferIds, it.id];
        this.sendOffer();
      });
      root.add(c);
      const iconKey = `icon_${it.base}`;
      if (this.textures.exists(iconKey)) root.add(this.add.image(bx, by, iconKey).setScale(0.72));
    });

    // the handshake
    const iConfirmed = !!st?.myConfirmed;
    const confirm = this.add.text(W / 2, H - 34, iConfirmed ? "— waiting for the other hand —" : "[ ✋ CONFIRM THE DEAL ]", {
      fontFamily: "monospace", fontSize: "15px", color: iConfirmed ? "#6a6a76" : "#8ad07f", fontStyle: "bold",
    }).setOrigin(0.5);
    if (!iConfirmed) {
      confirm.setInteractive({ useHandCursor: true });
      confirm.on("pointerdown", () => this.gs.room?.send("tradeconfirm", {}));
    }
    root.add(confirm);
    root.add(this.add.text(W / 2, H - 14, this.tradeNoteMsg || "any change to either offer resets both confirmations", {
      fontFamily: "monospace", fontSize: "10px", color: this.tradeNoteMsg ? "#c05050" : "#4a4a52",
    }).setOrigin(0.5));

    this.tradeRoot = root;
    this.tradeBounds.setTo(root.x, root.y, W, H);
  }

  // your companions' lifelines, always in the corner of your eye
  private rebuildPartyBars() {
    this.partyRoot?.destroy();
    this.partyRoot = undefined;
    const room = this.gs.room;
    if (!room) return;
    const st: any = room.state;
    const others: Array<{ sid: string; p: any }> = [];
    st.players?.forEach((p: any, sid: string) => {
      if (sid !== room.sessionId) others.push({ sid, p });
    });
    if (!others.length) return;
    const y0 = this.trackerRoot ? 88 : 34;
    const root = this.add.container(12, y0).setDepth(7);
    others.slice(0, 6).forEach(({ sid, p }, i) => {
      const ry = i * 30;
      const color = CHAT_CLASS_COLORS[p.cls] ?? "#c9c9d4";
      const dead = p.hp <= 0;
      const name = this.add.text(0, ry, `${p.name || p.cls} · ${p.level}${dead ? "  ✝" : ""}`, {
        fontFamily: "monospace", fontSize: "12px", color: dead ? "#6a5a5a" : color,
        backgroundColor: "#0c0a1299", padding: { x: 4, y: 1 },
      });
      // a companion's name is a handshake waiting to happen
      if (!dead) {
        name.setInteractive({ useHandCursor: true });
        name.on("pointerover", () => name.setText(`${p.name || p.cls} · ${p.level}  ⇄ trade`));
        name.on("pointerout", () => name.setText(`${p.name || p.cls} · ${p.level}`));
        name.on("pointerdown", () => {
          (this.gs as any).lootClickAt = this.gs.time.now; // same clock as the grace check — Date.now() would jam it
          this.gs.room?.send("tradeinvite", { target: sid });
        });
      }
      const bg = this.add.rectangle(0, ry + 18, 92, 5, 0x000000, 0.6).setOrigin(0, 0.5);
      const frac = Math.max(0, Math.min(1, p.hp / Math.max(1, p.maxHp)));
      const fg = this.add.rectangle(1, ry + 18, 90 * frac, 3, dead ? 0x4a3a3a : 0xd04040).setOrigin(0, 0.5);
      root.add([name, bg, fg]);
    });
    this.partyRoot = root;
  }

  private updateQuestTracker() {
    this.trackerRoot?.destroy();
    this.trackerRoot = undefined;
    const q = this.quests.find((x) => x.id === this.trackedQuestId);
    if (!q) return;
    const root = this.add.container(12, 34).setDepth(7);
    const color = q.done ? "#8ad07f" : "#e8cf7a";
    const title = this.add.text(0, 0, `◆ ${q.name}`, {
      fontFamily: "monospace", fontSize: "15px", color, fontStyle: "bold",
      backgroundColor: "#0c0a12bb", padding: { x: 6, y: 2 },
    });
    const counter = this.add.text(0, 22, q.done ? "✓ complete" : q.goal > 1 ? `${q.progress} / ${q.goal}` : q.desc, {
      fontFamily: "monospace", fontSize: "13px", color: q.done ? "#5a7a5e" : "#c9c9d4",
      backgroundColor: "#0c0a12bb", padding: { x: 6, y: 2 },
      wordWrap: { width: 260 },
    });
    root.add([title, counter]);
    this.trackerRoot = root;
  }

  toggleQuests() {
    this.questsVisible = !this.questsVisible;
    if (this.questsVisible) this.rebuildQuestPanel();
    else {
      this.questRoot?.destroy();
      this.questRoot = undefined;
    }
  }

  private rebuildQuestPanel() {
    this.questRoot?.destroy();
    const W = 340;
    const x = this.scale.width - W - 14;
    const y = 64;
    const root = this.add.container(x, y).setDepth(20);

    const rows: Phaser.GameObjects.GameObject[] = [];
    const ACT_HEADERS = ["ACT I — THE MOURNFIELD", "ACT II — THE SUNSCAR WASTES", "ACT III — THE DROWNED GREEN", "ACT IV — THE HOLLOW THRONE"];
    const ACT_NUM = ["I", "II", "III", "IV"];
    const actOf = (q: { act?: number }) => Math.max(1, Math.min(4, q.act ?? 1));

    // one tab per act you have quests in — the log is browsed a page at a time (D2-style)
    const acts = [...new Set(this.quests.map(actOf))].sort((a, b) => a - b);
    const sel = acts.includes(this.questTab) ? this.questTab : (acts[acts.length - 1] ?? 1);
    this.questTab = sel;

    // tab strip
    const tabH = 24;
    const tabTop = 38;
    const tabGap = 6;
    const tabW = acts.length > 0 ? Math.min(64, (W - 28 - (acts.length - 1) * tabGap) / acts.length) : 0;
    const tabsW = acts.length * tabW + Math.max(0, acts.length - 1) * tabGap;
    const tabX0 = (W - tabsW) / 2;
    acts.forEach((a, i) => {
      const tx = tabX0 + i * (tabW + tabGap);
      const on = a === sel;
      const done = this.quests.filter((q) => actOf(q) === a && q.done).length;
      const total = this.quests.filter((q) => actOf(q) === a).length;
      const allDone = total > 0 && done === total;
      const tabBg = this.add.rectangle(tx, tabTop, tabW, tabH, on ? 0x2a2010 : 0x161320, on ? 1 : 0.8)
        .setOrigin(0, 0)
        .setStrokeStyle(1.5, on ? 0xd8b13a : 0x3a3242, 0.9)
        .setInteractive({ useHandCursor: true });
      tabBg.on("pointerover", () => { if (!on) tabBg.setFillStyle(0x201a2a, 0.9); });
      tabBg.on("pointerout", () => { if (!on) tabBg.setFillStyle(0x161320, 0.8); });
      tabBg.on("pointerdown", () => { this.questTab = a; this.rebuildQuestPanel(); });
      const tabTxt = this.add.text(tx + tabW / 2, tabTop + tabH / 2, `${ACT_NUM[a - 1] ?? a}${allDone ? " ✓" : ""}`, {
        fontFamily: "monospace", fontSize: "13px", color: on ? "#ffd54a" : allDone ? "#7a9a7e" : "#8a8a96", fontStyle: "bold",
      }).setOrigin(0.5);
      rows.push(tabBg, tabTxt);
    });

    let cy = tabTop + tabH + 12;
    rows.push(this.add.text(W / 2, cy, ACT_HEADERS[sel - 1] ?? `ACT ${sel}`, {
      fontFamily: "monospace", fontSize: "12px", color: "#7a6a9a", fontStyle: "bold",
    }).setOrigin(0.5, 0));
    cy += 22;

    const actQuests = this.quests.filter((q) => actOf(q) === sel);
    if (actQuests.length === 0) {
      rows.push(this.add.text(W / 2, cy, "no deeds recorded in this act", {
        fontFamily: "monospace", fontSize: "12px", color: "#5a5a64", fontStyle: "italic",
      }).setOrigin(0.5, 0));
      cy += 22;
    }
    for (const q of actQuests) {
      const rowTop = cy - 4;
      const tracked = q.id === this.trackedQuestId;
      const state = q.done ? "✓" : `${q.progress}/${q.goal}`;
      const color = q.done ? "#8ad07f" : q.progress > 0 ? "#e8cf7a" : "#c9c9d4";
      const title = this.add.text(14, cy, `${q.done ? "✓ " : tracked ? "◆ " : "• "}${q.name}`, {
        fontFamily: "monospace", fontSize: "15px", color: tracked && !q.done ? "#ffd54a" : color, fontStyle: "bold",
      });
      const prog = this.add.text(W - 14, cy, state, {
        fontFamily: "monospace", fontSize: "14px", color,
      }).setOrigin(1, 0);
      cy += 20;
      const desc = this.add.text(14, cy, q.done ? q.desc : `${q.desc}  (+${q.rewardGold}g, +${q.rewardXp}xp)`, {
        fontFamily: "monospace", fontSize: "12px", color: q.done ? "#5a5a64" : "#8a8a96",
        wordWrap: { width: W - 28 },
      });
      cy += desc.height + 12;
      // the whole row is a button: click to pin the quest to the top-left
      const hit = this.add.rectangle(W / 2, rowTop + (cy - rowTop) / 2 - 2, W - 10, cy - rowTop - 2, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
      if (tracked) hit.setStrokeStyle(1, 0xffd54a, 0.5);
      hit.on("pointerover", () => hit.setFillStyle(0xffffff, 0.04));
      hit.on("pointerout", () => hit.setFillStyle(0xffffff, 0.001));
      hit.on("pointerdown", () => this.toggleTrack(q.id));
      rows.push(hit, title, prog, desc);
    }
    cy += 2;
    rows.push(this.add.text(W / 2, cy, "click a quest to track it on screen", {
      fontFamily: "monospace", fontSize: "10px", color: "#6a6a74",
    }).setOrigin(0.5, 0));
    cy += 16;
    const H = cy + 8;

    const bg = this.add.graphics();
    bg.fillStyle(0x0e0c14, 0.93);
    bg.fillRoundedRect(0, 0, W, H, 6);
    bg.lineStyle(2, 0x8a6a2a, 0.9);
    bg.strokeRoundedRect(0, 0, W, H, 6);
    bg.lineStyle(1, 0x4a3a1a, 0.9);
    bg.strokeRoundedRect(3, 3, W - 6, H - 6, 5);
    const header = this.add.text(W / 2, 14, "— QUEST LOG —", {
      fontFamily: "monospace", fontSize: "16px", color: "#e8cf7a", fontStyle: "bold",
    }).setOrigin(0.5, 0);
    root.add([bg, header, ...rows]);
    this.questRoot = root;
    this.questBounds.setTo(x, y, W, H);
  }

  // --- chat & escape menu ---

  private handleKey(ev: KeyboardEvent) {
    if (this.chatActive) {
      if (ev.key === "Enter") {
        const text = this.chatBuffer.trim();
        if (text) this.gs.room?.send("chat", { text });
        this.chatActive = false;
      } else if (ev.key === "Escape") {
        this.chatActive = false;
      } else if (ev.key === "Backspace") {
        this.chatBuffer = this.chatBuffer.slice(0, -1);
      } else if (ev.key.length === 1 && this.chatBuffer.length < 120) {
        this.chatBuffer += ev.key;
      }
      this.updateChatBar();
      return;
    }
    // a dialogue window eats Space (advance) and Enter (advance), and the escape
    // ladder steps back through it before anything else
    if (this.dialogueVisible && (ev.key === " " || ev.key === "Spacebar" || ev.key === "Enter")) {
      if (this.dlgMode === "text") this.advanceDialogue();
      return;
    }
    if (ev.key === "Enter") {
      if (this.menuOpen) return;
      this.chatActive = true;
      this.chatBuffer = "";
      this.updateChatBar();
      return;
    }
    if (ev.key === "Escape") {
      if (this.helpRoot) { this.helpRoot.destroy(); this.helpRoot = undefined; return; }
      if (this.dialogueVisible) { this.dialogueBack(); return; }
      if (this.mapMode === 1) {
        this.mapMode = 0; // fold the war table back into the corner
        return;
      }
      if (this.tradeInviteRoot) {
        this.gs.room?.send("tradedecline", {});
        this.dismissTradeInvite();
        return;
      }
      const anyPanel =
        this.panel.visible || this.charPanel.visible || this.skillPanel.visible ||
        this.questsVisible || this.codexVisible || this.shopVisible || this.vendorVisible || this.gambleVisible ||
        this.smithVisible || this.mercHireVisible || this.mercVisible || this.tradeVisible || this.waypointsVisible;
      if (anyPanel) {
        if (this.panel.visible) this.panel.toggle();
        if (this.charPanel.visible) this.charPanel.toggle();
        if (this.skillPanel.visible) this.skillPanel.toggle();
        if (this.questsVisible) this.toggleQuests();
        if (this.codexVisible) this.closeCodex();
        if (this.shopVisible) this.closeShop();
        if (this.vendorVisible) this.closeVendor();
        if (this.gambleVisible) this.closeGamble();
        if (this.smithVisible) this.closeSmith();
        if (this.altarVisible) this.closeAltar();
        if (this.mercHireVisible) this.closeMercHire();
        if (this.mercVisible) this.closeMercPanel();
        if (this.tradeVisible) this.cancelTrade();
        if (this.waypointsVisible) this.closeWaypoints();
      } else {
        this.toggleMenu();
      }
    }
  }

  private updateChatBar() {
    this.chatBar.setVisible(this.chatActive);
    if (this.chatActive) {
      this.chatBar.setPosition(12, this.scale.height - 130).setText(`say: ${this.chatBuffer}_`);
    }
  }

  addSystemLine(text: string) {
    if (!text) return;
    const txt = this.add
      .text(12, 0, `⚔ ${text}`, {
        fontFamily: "monospace", fontSize: "14px", color: "#ffd54a", fontStyle: "italic",
        backgroundColor: "#0c0a12bb", padding: { x: 6, y: 3 },
      })
      .setDepth(29);
    this.chatLog.push({ txt, bornAt: this.time.now });
    while (this.chatLog.length > 8) this.chatLog.shift()!.txt.destroy();
    this.layoutChat();
  }

  addChat(name: string, cls: string, text: string) {
    const color = CHAT_CLASS_COLORS[cls] ?? "#c9c9d4";
    const txt = this.add
      .text(12, 0, `[${name}] ${text}`, {
        fontFamily: "monospace", fontSize: "14px", color,
        backgroundColor: "#0c0a12bb", padding: { x: 6, y: 3 },
        wordWrap: { width: Math.min(520, this.scale.width * 0.5) },
      })
      .setDepth(29);
    this.chatLog.push({ txt, bornAt: this.time.now });
    while (this.chatLog.length > 8) this.chatLog.shift()!.txt.destroy();
    this.layoutChat();
  }

  private layoutChat() {
    // stack upward from just above the chat bar
    let y = this.scale.height - 138;
    for (let i = this.chatLog.length - 1; i >= 0; i--) {
      const entry = this.chatLog[i];
      y -= entry.txt.height + 3;
      entry.txt.setPosition(12, y);
    }
  }

  private toggleMenu() {
    this.menuOpen = !this.menuOpen;
    this.menuRoot?.destroy();
    this.menuRoot = undefined;
    if (!this.menuOpen) return;

    const w = 300;
    const h = 244;
    const x = (this.scale.width - w) / 2;
    const y = (this.scale.height - h) / 2;
    const root = this.add.container(x, y).setDepth(40);
    root.add(this.add.rectangle(0, 0, w, h, 0x120f1a, 0.97).setOrigin(0).setStrokeStyle(2, 0x54402a));
    root.add(this.add.rectangle(3, 3, w - 6, h - 6, 0x000000, 0).setOrigin(0).setStrokeStyle(1, 0xd8b13a, 0.3));
    root.add(
      this.add.text(w / 2, 24, "GAME MENU", { fontFamily: "monospace", fontSize: "18px", color: "#e8d8a8", fontStyle: "bold" }).setOrigin(0.5)
    );

    const button = (by: number, label: string, color: string, onClick: () => void) => {
      const bg = this.add
        .rectangle(w / 2, by, 220, 40, 0x1c1524, 1)
        .setStrokeStyle(1, 0x54402a)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(w / 2, by, label, { fontFamily: "monospace", fontSize: "15px", color, fontStyle: "bold" }).setOrigin(0.5);
      bg.on("pointerover", () => bg.setFillStyle(0x2a2136));
      bg.on("pointerout", () => bg.setFillStyle(0x1c1524));
      bg.on("pointerdown", onClick);
      root.add([bg, txt]);
    };

    button(66, "RESUME", "#7fdc9f", () => this.toggleMenu());
    button(112, "HELP & CONTROLS", "#8ab0e8", () => { this.toggleMenu(); this.showHelp(); });
    button(158, "EXIT TO LOBBY", "#e07a6a", () => {
      // progress persists server-side the moment we leave
      this.gs.room?.leave();
      setTimeout(() => location.reload(), 150);
    });
    root.add(
      this.add.text(w / 2, h - 22, "your hero is saved automatically", { fontFamily: "monospace", fontSize: "12px", color: "#6a6a76" }).setOrigin(0.5)
    );
    this.menuRoot = root;
  }

  // the decked-out controls reference — reachable via Esc → Help & Controls
  private showHelp() {
    this.helpRoot?.destroy();
    const rows: Array<[string, string] | "sep" | string> = [
      "COMBAT",
      ["Move / loot", "Left-click"],
      ["Attack", "Right-click (hold)"],
      ["Skills", "1  2  3  4  5  6"],
      ["Life potion", "Q"],
      ["Mana potion", "W"],
      "sep",
      "PANELS",
      ["Inventory", "I  /  B"],
      ["Character", "C"],
      ["Skill tree", "S"],
      ["Quest log", "J"],
      ["Mercenary", "H"],
      "sep",
      "WORLD",
      ["Town portal", "T"],
      ["Map (mini / full / off)", "M"],
      ["Ping the party", "G"],
      ["Toggle torch light", "L"],
      ["Toggle top info bar", "U"],
      ["Chat", "Enter"],
      ["This menu", "Esc"],
    ];

    const w = 380;
    const pad = 18;
    let cy = 52;
    const contentH = rows.reduce((a, r) => a + (r === "sep" ? 12 : 20), 0);
    const h = cy + contentH + 26;
    const x = (this.scale.width - w) / 2;
    const y = (this.scale.height - h) / 2;
    const root = this.add.container(x, y).setDepth(41);
    root.add(this.add.rectangle(0, 0, w, h, 0x120f1a, 0.98).setOrigin(0).setStrokeStyle(2, 0x54402a));
    root.add(this.add.rectangle(3, 3, w - 6, h - 6, 0x000000, 0).setOrigin(0).setStrokeStyle(1, 0xd8b13a, 0.3));
    for (const [cx, cyy] of [[0, 0], [w - 5, 0], [0, h - 5], [w - 5, h - 5]]) {
      root.add(this.add.rectangle(cx, cyy, 5, 5, 0xd8b13a, 0.75).setOrigin(0));
    }
    root.add(this.add.text(w / 2, 18, "CONTROLS", { fontFamily: "monospace", fontSize: "17px", color: "#e8d8a8", fontStyle: "bold", letterSpacing: 3 }).setOrigin(0.5));
    root.add(this.add.text(w - 12, 12, "[Esc] close", { fontFamily: "monospace", fontSize: "10px", color: "#6a6a76" }).setOrigin(1, 0));

    for (const r of rows) {
      if (r === "sep") { cy += 12; continue; }
      if (typeof r === "string") {
        root.add(this.add.text(pad, cy, r, { fontFamily: "monospace", fontSize: "11px", color: "#8a8a96", fontStyle: "bold", letterSpacing: 2 }));
        cy += 20;
        continue;
      }
      root.add(this.add.text(pad, cy, r[0], { fontFamily: "monospace", fontSize: "13px", color: "#c9c9d4" }));
      root.add(this.add.text(w - pad, cy, r[1], { fontFamily: "monospace", fontSize: "13px", color: "#e8cf7a", fontStyle: "bold" }).setOrigin(1, 0));
      cy += 20;
    }

    // click anywhere on the backdrop closes it too
    const bg = this.add.rectangle(0, 0, w, h, 0x000000, 0.001).setOrigin(0).setInteractive();
    bg.on("pointerdown", () => { this.helpRoot?.destroy(); this.helpRoot = undefined; });
    root.addAt(bg, 2);
    this.helpRoot = root;
  }

  private buildHotbar(cls: string, binds: Partial<Record<SkillKey, string>>) {
    this.hotbarRoot?.destroy();
    this.hotbarCells = [];
    this.hotbarBuiltFor = `${cls}|${JSON.stringify(binds)}`;

    const entries: Array<{ keyLabel: string; name: string; mana: number; skill?: SkillNode }> = [
      { keyLabel: "RMB", name: "Attack", mana: 0 },
      ...SKILL_KEYS.map((k) => {
        const id = binds[k];
        const node = id ? skillById(cls as ClassName, id) : null;
        return node
          ? { keyLabel: k, name: node.name, mana: node.mana ?? 0, skill: node }
          : { keyLabel: k, name: "— [S] skills", mana: 0 };
      }),
    ];

    const CELL = 54;
    const GAP = 10;
    // +2 for the potion flask cells (red life, blue mana) at the end
    const totalW = (entries.length + 2) * CELL + (entries.length + 1) * GAP;
    const x0 = (this.scale.width - totalW) / 2;
    const y0 = this.scale.height - CELL - 34;

    this.hotbarRoot = this.add.container(0, 0);
    this.hotbarBounds = new Phaser.Geom.Rectangle(x0 - 6, y0 - 6, totalW + 12, CELL + 30);

    entries.forEach((e, i) => {
      const x = x0 + i * (CELL + GAP);
      const bg = this.add.rectangle(x, y0, CELL, CELL, 0x14111c, 0.92).setOrigin(0).setStrokeStyle(1, 0x54402a);
      const key = this.add.text(x + 4, y0 + 3, e.keyLabel, {
        fontFamily: "monospace", fontSize: "13px", color: "#ffd54a", fontStyle: "bold",
      });
      // keep the label inside its cell — long skill names were smearing across neighbors
      const shortName = e.name.length > 10 ? e.name.slice(0, 9) + "…" : e.name;
      const name = this.add
        .text(x + CELL / 2, y0 + CELL + 4, shortName, { fontFamily: "monospace", fontSize: "9px", color: "#8a8a96" })
        .setOrigin(0.5, 0);
      this.hotbarRoot!.add([bg, key, name]);
      if (e.mana > 0) {
        const manaText = this.add
          .text(x + CELL - 4, y0 + CELL - 4, `${e.mana}`, { fontFamily: "monospace", fontSize: "12px", color: "#5a8cd8" })
          .setOrigin(1, 1);
        this.hotbarRoot!.add(manaText);
      }
      this.hotbarCells.push({ x, y: y0, skill: e.skill });
    });

    // potion flask cells — red life (Q), blue mana (W), sitting right below the 1-6 skills
    const px = x0 + entries.length * (CELL + GAP);
    this.potionCell = { x: px, y: y0 };
    const pbg = this.add.rectangle(px, y0, CELL, CELL, 0x1c1016, 0.92).setOrigin(0).setStrokeStyle(1, 0x6a2a34);
    pbg.setInteractive({ useHandCursor: true });
    pbg.on("pointerdown", () => this.gs.room?.send("drink"));
    const pkey = this.add.text(px + 4, y0 + 3, "Q", { fontFamily: "monospace", fontSize: "13px", color: "#ffd54a", fontStyle: "bold" });
    const neck = this.add.rectangle(px + CELL / 2, y0 + 18, 6, 8, 0x882233);
    const bulb = this.add.circle(px + CELL / 2, y0 + 30, 10, 0xcc3344).setStrokeStyle(1, 0x000000, 0.5);
    this.potionCount = this.add
      .text(px + CELL - 4, y0 + CELL - 4, "0", { fontFamily: "monospace", fontSize: "14px", color: "#e0a0a0", fontStyle: "bold" })
      .setOrigin(1, 1);
    const pname = this.add
      .text(px + CELL / 2, y0 + CELL + 4, "Life", { fontFamily: "monospace", fontSize: "11px", color: "#8a8a96" })
      .setOrigin(0.5, 0);
    this.hotbarRoot.add([pbg, pkey, neck, bulb, this.potionCount, pname]);

    const mx = px + CELL + GAP;
    this.manaCell = { x: mx, y: y0 };
    const mbg = this.add.rectangle(mx, y0, CELL, CELL, 0x101624, 0.92).setOrigin(0).setStrokeStyle(1, 0x2a3a6a);
    mbg.setInteractive({ useHandCursor: true });
    mbg.on("pointerdown", () => this.gs.room?.send("drinkmana"));
    const mkey = this.add.text(mx + 4, y0 + 3, "W", { fontFamily: "monospace", fontSize: "13px", color: "#ffd54a", fontStyle: "bold" });
    const mneck = this.add.rectangle(mx + CELL / 2, y0 + 18, 6, 8, 0x223388);
    const mbulb = this.add.circle(mx + CELL / 2, y0 + 30, 10, 0x3355cc).setStrokeStyle(1, 0x000000, 0.5);
    this.manaCount = this.add
      .text(mx + CELL - 4, y0 + CELL - 4, "0", { fontFamily: "monospace", fontSize: "14px", color: "#a0b0e0", fontStyle: "bold" })
      .setOrigin(1, 1);
    const mname = this.add
      .text(mx + CELL / 2, y0 + CELL + 4, "Mana", { fontFamily: "monospace", fontSize: "11px", color: "#8a8a96" })
      .setOrigin(0.5, 0);
    this.hotbarRoot.add([mbg, mkey, mneck, mbulb, this.manaCount, mname]);
  }

  // a glass orb with liquid filled to `frac` — the Malgrim classic
  private drawOrb(cx: number, cy: number, r: number, frac: number, deep: number, bright: number) {
    const g = this.bars;
    g.fillStyle(0x0c0a12, 0.92).fillCircle(cx, cy, r + 5); // socket
    g.lineStyle(2, 0x54402a, 1).strokeCircle(cx, cy, r + 5);
    g.lineStyle(1, 0xd8b13a, 0.45).strokeCircle(cx, cy, r + 3);
    g.fillStyle(0x14121c, 1).fillCircle(cx, cy, r); // empty glass

    const f = Phaser.Math.Clamp(frac, 0, 1);
    if (f > 0.02) {
      if (f >= 0.99) {
        g.fillStyle(deep, 1).fillCircle(cx, cy, r);
        g.fillStyle(bright, 0.55).fillCircle(cx, cy - r * 0.25, r * 0.55);
      } else {
        // liquid = the circle segment below the fill line
        const k = (1 - 2 * f) * r; // chord offset from center (+down)
        const A = Math.asin(Phaser.Math.Clamp(k / r, -1, 1));
        g.fillStyle(deep, 1);
        g.beginPath();
        g.arc(cx, cy, r, A, Math.PI - A, false);
        g.closePath();
        g.fillPath();
        // brighter surface band at the liquid line
        g.fillStyle(bright, 0.5);
        const halfChord = Math.cos(A) * r;
        g.fillRect(cx - halfChord, cy + k, halfChord * 2, 2.5);
      }
    }
    g.fillStyle(0xffffff, 0.09).fillEllipse(cx - r * 0.32, cy - r * 0.42, r * 0.75, r * 0.45); // glass shine
  }

  private drawMinimap() {
    const st: any = this.gs.room?.state;
    const full = this.mapMode === 1;
    const show = this.mapMode !== 2 && !!st?.mapData && !this.panel.visible;
    this.miniBase.setVisible(show);
    this.miniDots.setVisible(show);
    if (!show) {
      this.mapTip?.setVisible(false);
      return;
    }

    const mapKey = `${st.act ?? 1}:${st.floor}`;
    const rows: string[] = mapKey !== this.miniKey ? st.mapData.split("\n") : this.miniRows;
    const mapW = rows[0].length;
    const mapH = rows.length;
    // corner minimap, or the full-screen war table
    const SCALE = full
      ? Math.max(4, Math.floor(Math.min((this.scale.width * 0.86) / mapW, (this.scale.height * 0.84) / mapH)))
      : 3;
    const w = mapW * SCALE;
    const h = mapH * SCALE;
    const x0 = full ? Math.round((this.scale.width - w) / 2) : this.scale.width - w - 12;
    const y0 = full ? Math.round(Math.max(20, (this.scale.height - h) / 2)) : 36;
    if (full) this.fullMapView = { x0, y0, scale: SCALE };
    const theme = FLOOR_THEMES[visualThemeIndexForFloor(st.floor)];

    const explored = this.gs.explored;
    const seen = (wx: number, wy: number) => {
      if (!explored) return false;
      const tx = Math.floor(wx / TILE);
      const ty = Math.floor(wy / TILE);
      return !!explored[ty * mapW + tx];
    };

    // static layer: redraw when the floor, mode, window, or explored area changes
    if (mapKey !== this.miniKey || this.miniWidth !== this.scale.width || this.miniRev !== this.gs.exploredRev || this.miniMode !== this.mapMode) {
      this.miniKey = mapKey;
      this.miniWidth = this.scale.width;
      this.miniRev = this.gs.exploredRev;
      this.miniMode = this.mapMode;
      this.miniRows = rows;
      this.miniBase.clear();
      if (full) {
        // the war table: dim the world, spread the parchment
        this.miniBase.fillStyle(0x050508, 0.85).fillRect(0, 0, this.scale.width, this.scale.height);
      }
      this.miniBase.fillStyle(0x000000, 0.55).fillRect(x0 - 3, y0 - 3, w + 6, h + 6);
      this.miniBase.lineStyle(full ? 2 : 1, theme.accent, 0.7).strokeRect(x0 - 3, y0 - 3, w + 6, h + 6);
      for (let ty = 0; ty < mapH; ty++) {
        for (let tx = 0; tx < mapW; tx++) {
          if (explored && !explored[ty * mapW + tx]) continue; // fog of war
          const wall = rows[ty].charAt(tx) === "#";
          if (wall && !full) continue; // the corner map only shows floor
          this.miniBase.fillStyle(wall ? theme.wallTop : theme.floorA, wall ? 0.55 : 1);
          this.miniBase.fillRect(x0 + tx * SCALE, y0 + ty * SCALE, SCALE, SCALE);
        }
      }
      if (full) {
        this.miniBase.fillStyle(0x000000, 0.6).fillRect(x0 - 3, y0 + h + 6, w + 6, 18);
      }
    }

    // live layer — only what you've explored shows up
    const dots = this.miniDots;
    const sz = full ? 2 : 1; // markers grow with the map
    const dot = (wx: number, wy: number, color: number, size: number, alpha = 1) => {
      dots.fillStyle(color, alpha);
      dots.fillRect(x0 + (wx / TILE) * SCALE - (size * sz) / 2, y0 + (wy / TILE) * SCALE - (size * sz) / 2, size * sz, size * sz);
    };

    // points of interest — in full mode they answer to the cursor
    const pois: Array<{ x: number; y: number; label: string }> = [];
    const poi = (wx: number, wy: number, label: string) => {
      if (full && label) pois.push({ x: x0 + (wx / TILE) * SCALE, y: y0 + (wy / TILE) * SCALE, label });
    };

    dots.clear();
    if (seen(st.stairsX, st.stairsY)) {
      dot(st.stairsX, st.stairsY, 0x9a5ae8, 4);
      poi(st.stairsX, st.stairsY, "Stairs down");
    }
    st.shrines?.forEach((s: any) => {
      if (!s.used && seen(s.x, s.y)) {
        dot(s.x, s.y, s.kind === "gamble" ? 0xd8b13a : s.kind === "areaportal" ? 0xc8a860 : theme.accent, 3);
        poi(s.x, s.y, s.label || s.kind);
      }
    });
    const blink = Math.floor(this.time.now / 400) % 2 === 0;
    st.loot?.forEach((g: any) => {
      if (g.kind === "item" && blink && seen(g.x, g.y) && RARITY_ORDER.indexOf(g.rarity) >= RARITY_ORDER.indexOf("rare")) {
        dot(g.x, g.y, 0xffd24a, 3);
      }
    });
    st.monsters?.forEach((m: any) => {
      if (!seen(m.x, m.y)) return;
      const boss = isBossKind(m.kind);
      const color =
        m.kind === "goblin" ? 0xd8b13a : m.elite ? 0xffd54a : m.modifier ? 0x6a8cff : 0xd04040;
      dot(m.x, m.y, color, boss ? 5 : 2);
      if (boss || m.elite || m.name) poi(m.x, m.y, m.name || m.kind);
    });
    st.players?.forEach((p: any, sid: string) => {
      dot(p.x, p.y, sid === this.gs.room?.sessionId ? 0xffffff : 0x3fbf5f, 3);
      poi(p.x, p.y, sid === this.gs.room?.sessionId ? "you" : `${p.name || p.cls} (lvl ${p.level})`);
    });
    // a fresh ping blinks urgently for a few seconds
    const ping = this.gs.gs_lastPing;
    if (ping && this.time.now - ping.at < 4000 && Math.floor(this.time.now / 250) % 2 === 0) {
      dot(ping.x, ping.y, 0xffd54a, 6, 0.95);
    }

    // hover: name whatever the cursor rests on
    if (full) {
      if (!this.mapTip) {
        this.mapTip = this.add
          .text(0, 0, "", {
            fontFamily: "monospace", fontSize: "14px", color: "#e8e0c8",
            backgroundColor: "#16121ee6", padding: { x: 7, y: 4 },
          })
          .setDepth(12)
          .setVisible(false);
      }
      const ptr = this.input.activePointer;
      let best: { label: string } | null = null;
      let bestD = Math.max(12, SCALE * 1.6);
      for (const pt of pois) {
        const d = Math.hypot(ptr.x - pt.x, ptr.y - pt.y);
        if (d < bestD) {
          bestD = d;
          best = pt;
        }
      }
      if (best) {
        this.mapTip
          .setText(best.label)
          .setPosition(Math.min(ptr.x + 14, this.scale.width - this.mapTip.width - 8), ptr.y - 10)
          .setVisible(true);
      } else {
        this.mapTip.setVisible(false);
      }
    } else {
      this.mapTip?.setVisible(false);
    }
  }

  update() {
    const gs = this.gs;
    const room = gs?.room;
    const me = room ? gs.players.get(room.sessionId) : undefined;

    // loadout sync
    if (gs && gs.loadoutRev !== this.lastLoadoutRev && gs.lastLoadout) {
      this.lastLoadoutRev = gs.loadoutRev;
      this.panel.setLoadout(gs.lastLoadout);
    }

    // party lifelines refresh a few times a second — enough to see trouble coming
    if (this.time.now - this.lastPartyAt > 400) {
      this.lastPartyAt = this.time.now;
      this.rebuildPartyBars();
    }

    // town context: selling near the vendor, stash closes when you wander off
    this.panel.viewerCls = gs.myCls;
    this.panel.setNearVendor(gs.nearShrineKind("vendor", 90));
    if (this.panel.stashOpen && !gs.nearShrineKind("stash", 110)) this.panel.setStashOpen(false);
    // …and the merchants stop serving customers who walk away
    if (this.shopVisible && me && Math.hypot(me.schema.x - TOWN.alchemist.x, me.schema.y - TOWN.alchemist.y) > TOWN_INTERACT_RANGE + 40) {
      this.closeShop();
    }
    if (this.vendorVisible && me && Math.hypot(me.schema.x - TOWN.vendor.x, me.schema.y - TOWN.vendor.y) > TOWN_INTERACT_RANGE + 40) {
      this.closeVendor();
    }
    if (this.smithVisible && me && Math.hypot(me.schema.x - TOWN.vendor.x, me.schema.y - TOWN.vendor.y) > TOWN_INTERACT_RANGE + 40) {
      this.closeSmith();
    }
    if (this.gambleVisible && me && Math.hypot(me.schema.x - TOWN.fenwick.x, me.schema.y - TOWN.fenwick.y) > TOWN_INTERACT_RANGE + 40) {
      this.closeGamble();
    }
    if (this.altarVisible && me && Math.hypot(me.schema.x - TOWN.transmute.x, me.schema.y - TOWN.transmute.y) > TOWN_INTERACT_RANGE + 40) {
      this.closeAltar();
    }
    if (this.mercHireVisible && me) {
      // the recruiter keeps the muster post in every town
      if (Math.hypot(me.schema.x - TOWN.maren.x, me.schema.y - TOWN.maren.y) > TOWN_INTERACT_RANGE + 40) this.closeMercHire();
    }
    // a town talk ends when you wander off (encounter vignettes have no shrine to leave)
    if (this.dialogueVisible && me && this.dlgNpc?.shrineId) {
      const sh = gs.room?.state.shrines?.get(this.dlgNpc.shrineId);
      if (!sh || Math.hypot(me.schema.x - sh.x, me.schema.y - sh.y) > TOWN_INTERACT_RANGE + 50) this.closeDialogue();
    }
    // the network only answers while you stand at one of its stones
    if (this.waypointsVisible && !gs.nearShrineKind("waypoint", TOWN_INTERACT_RANGE + 40)) {
      this.closeWaypoints();
    }
    // the merc panel's bag list follows the bag
    if (this.mercVisible && gs.loadoutRev !== this.mercLoadoutRev) {
      this.mercLoadoutRev = gs.loadoutRev;
      this.rebuildMercPanel();
    }

    // character sheet & skill tree panels
    if (me) {
      this.charPanel.setState(
        {
          name: me.schema.name || "", cls: gs.myCls, level: me.schema.level,
          str: me.schema.str, dex: me.schema.dex, vit: me.schema.vit, ene: me.schema.ene,
          statPoints: me.schema.statPoints ?? 0, skillPoints: me.schema.skillPoints ?? 0,
          maxHp: me.schema.maxHp, maxMana: me.schema.maxMana,
          paragonLevel: me.schema.paragonLevel ?? 0, paragonPoints: me.schema.paragonPoints ?? 0,
          paragonAlloc: gs.lastLoadout?.paragonAlloc ?? {},
        },
        gs.lastLoadout?.sheet ?? null
      );
      this.skillPanel.setState(
        gs.myCls,
        me.schema.level,
        me.schema.skillPoints ?? 0,
        gs.lastLoadout?.skills ?? {},
        gs.lastLoadout?.binds ?? {},
        gs.lastLoadout?.derived?.plusSkills ?? 0
      );
    }

    // hotbar — rebuilt whenever bindings change
    const binds = gs.lastLoadout?.binds ?? {};
    const hotbarKey = `${gs.myCls}|${JSON.stringify(binds)}`;
    if (gs?.myCls && room && this.hotbarBuiltFor !== hotbarKey) this.buildHotbar(gs.myCls, binds);

    // orbs & xp bar, D2-style
    this.bars.clear();
    this.hpText?.setVisible(!!me);
    this.manaText?.setVisible(!!me);
    if (me) {
      const w = this.scale.width;
      const h = this.scale.height;
      const hpRatio = Math.max(0, me.schema.hp / me.schema.maxHp);
      const manaRatio = Math.max(0, me.schema.mana / me.schema.maxMana);
      // past the level ceiling the bar tracks the endless paragon track, in violet
      const atCap = me.schema.level >= MAX_LEVEL;
      const xpRatio = atCap
        ? Math.min(1, (me.schema.paragonXp ?? 0) / paragonXpForNext(me.schema.paragonLevel ?? 0))
        : Math.min(1, me.schema.xp / xpForNext(me.schema.level));

      this.drawOrb(58, h - 58, 34, hpRatio, 0xa02020, 0xd04040);
      this.drawOrb(w - 58, h - 58, 34, manaRatio, 0x24409a, 0x3a6cc8);
      this.hpText?.setPosition(58, h - 14).setText(`${Math.ceil(me.schema.hp)}/${me.schema.maxHp}`);
      this.manaText?.setPosition(w - 58, h - 14).setText(`${Math.floor(me.schema.mana)}/${me.schema.maxMana}`);

      // xp filament along the bottom center
      const xw = Math.min(300, w * 0.3);
      const xx = (w - xw) / 2;
      const xy = h - 12;
      this.bars.fillStyle(0x0c0a12, 0.9).fillRect(xx - 2, xy - 2, xw + 4, 8);
      this.bars.lineStyle(1, 0x54402a, 1).strokeRect(xx - 2, xy - 2, xw + 4, 8);
      this.bars.fillStyle(atCap ? 0x2a1a3a : 0x4a3b10).fillRect(xx, xy, xw, 4);
      this.bars.fillStyle(atCap ? 0xc98aff : 0xd8b73a).fillRect(xx, xy, xw * xpRatio, 4);
      for (let i = 1; i < 10; i++) {
        this.bars.fillStyle(0x0c0a12, 0.8).fillRect(xx + (xw / 10) * i, xy, 1, 4);
      }

      this.goldText?.setPosition(w / 2, h - 106).setOrigin(0.5, 0).setText(`◉ ${Math.floor(me.schema.gold ?? 0).toLocaleString()}`);
    }

    // hotbar cooldown overlays
    this.hotbarOverlay.clear();
    if (me && this.hotbarCells.length) {
      const now = this.time.now;
      const CELL = 54;
      this.hotbarCells.forEach((cell, i) => {
        let frac = 0;
        let oom = false;
        if (i === 0) {
          const atk = CLASS_ATTACKS[this.gs.myCls as keyof typeof CLASS_ATTACKS];
          const cd = Math.max(150, atk.cooldownMs * (1 - this.gs.myAtkSpd / 100));
          frac = Math.max(0, (this.gs.attackReadyAt - now) / cd);
        } else if (cell.skill) {
          const readyAt = this.gs.skillReadyAt.get(cell.skill.id) ?? 0;
          frac = Math.max(0, Math.min(1, (readyAt - now) / (cell.skill.cooldownMs ?? 1)));
          oom = me.schema.mana < (cell.skill.mana ?? 0);
        } else if (i > 0) {
          // unbound key — dimmed
          this.hotbarOverlay.fillStyle(0x000000, 0.6);
          this.hotbarOverlay.fillRect(cell.x, cell.y, CELL, CELL);
          return;
        }
        if (frac > 0) {
          this.hotbarOverlay.fillStyle(0x000000, 0.65);
          this.hotbarOverlay.fillRect(cell.x, cell.y + CELL * (1 - frac), CELL, CELL * frac);
        }
        if (oom) {
          this.hotbarOverlay.fillStyle(0x2a3a6a, 0.45);
          this.hotbarOverlay.fillRect(cell.x, cell.y, CELL, CELL);
        }
      });

      // potion cells: count/cap + grey-out when empty
      this.potionCount?.setText(`${me.schema.potions ?? 0}/${me.schema.maxPotions ?? 4}`);
      if ((me.schema.potions ?? 0) === 0) {
        this.hotbarOverlay.fillStyle(0x000000, 0.55);
        this.hotbarOverlay.fillRect(this.potionCell.x, this.potionCell.y, CELL, CELL);
      }
      this.manaCount?.setText(`${me.schema.manaPotions ?? 0}/${me.schema.maxPotions ?? 4}`);
      if ((me.schema.manaPotions ?? 0) === 0) {
        this.hotbarOverlay.fillStyle(0x000000, 0.55);
        this.hotbarOverlay.fillRect(this.manaCell.x, this.manaCell.y, CELL, CELL);
      }
    }

    // old chat lines fade into the dark
    for (let i = this.chatLog.length - 1; i >= 0; i--) {
      const entry = this.chatLog[i];
      const age = this.time.now - entry.bornAt;
      if (age > 15000) {
        entry.txt.destroy();
        this.chatLog.splice(i, 1);
        this.layoutChat();
      } else if (age > 11000) {
        entry.txt.setAlpha(1 - (age - 11000) / 4000);
      }
    }

    this.drawMinimap();

    // boss health bar — shown while a boss is alive and someone is near it
    this.bossBar.clear();
    this.bossName.setVisible(false);
    if (me && room) {
      let boss: any = null;
      room.state.monsters?.forEach((m: any) => {
        if (isBossKind(m.kind)) boss = m;
      });
      if (boss && Math.hypot(boss.x - me.schema.x, boss.y - me.schema.y) < 520) {
        const bw = Math.min(420, this.scale.width * 0.5);
        const bx = (this.scale.width - bw) / 2;
        const by = 52;
        const ratio = Math.max(0, boss.hp / boss.maxHp);
        this.bossBar.fillStyle(0x000000, 0.65).fillRect(bx - 2, by - 2, bw + 4, 14);
        this.bossBar.fillStyle(0x4a1010).fillRect(bx, by, bw, 10);
        this.bossBar.fillStyle(0xc03030).fillRect(bx, by, bw * ratio, 10);
        this.bossBar.lineStyle(1, 0x7a3030, 0.9).strokeRect(bx - 2, by - 2, bw + 4, 14);
        this.bossName.setVisible(true).setPosition(this.scale.width / 2, by - 12).setText(boss.name);
      }
    }

    // low-health warning vignette
    this.vignette.clear();
    if (me && me.schema.hp > 0 && me.schema.hp / me.schema.maxHp < 0.3) {
      const pulse = 0.14 + 0.1 * Math.abs(Math.sin(this.time.now / 220));
      const w = this.scale.width;
      const h = this.scale.height;
      const t = 26;
      this.vignette.fillStyle(0xc02020, pulse);
      this.vignette.fillRect(0, 0, w, t);
      this.vignette.fillRect(0, h - t, w, t);
      this.vignette.fillRect(0, t, t, h - t * 2);
      this.vignette.fillRect(w - t, t, t, h - t * 2);
    }

    // death overlay
    const dead = !!me && me.schema.hp <= 0;
    this.deathText.setVisible(dead);
    this.deathBy.setVisible(dead && !!gs.lastDeathBy);
    if (dead) {
      this.deathText.setPosition(this.scale.width / 2, this.scale.height / 2);
      this.deathBy.setPosition(this.scale.width / 2, this.scale.height / 2 + 34).setText(`slain by ${gs.lastDeathBy}`);
    }

    // hud line
    if (room && me) {
      const count = room.state.players?.size ?? 0;
      const mobs = room.state.monsters?.size ?? 0;
      const pts = (me.schema.statPoints ?? 0) + (me.schema.skillPoints ?? 0);
      const st: any = room.state;
      const bounty = st.bountyText
        ? `  |  BOUNTY: ${st.bountyText} ${st.bountyDone ? "✔" : `(${st.bountyProgress}/${st.bountyGoal})`}`
        : "";
      this.hud.setText(
        `${["", "", "NIGHTMARE — ", "HELL — "][room.state.difficulty ?? 1] ?? ""}${room.state.zoneName || "?"} — ${(room.state.act ?? 1) >= 5 ? `Abyss ${room.state.floor}` : `Act ${room.state.act ?? 1} · floor ${room.state.floor}`}  ·  ${me.schema.name || ""} lvl ${me.schema.level} ${gs.myCls}${bounty}  |  players: ${count}  monsters: ${mobs}${pts > 0 ? `  ·  ★ ${pts} points to spend!` : ""}  ·  Esc: menu & help`
      );
    } else {
      this.hud.setText(gs?.connectionStatus ?? "connecting…");
    }
  }
}
