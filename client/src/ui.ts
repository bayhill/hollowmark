import Phaser from "phaser";
import {
  ATTRS,
  ATTR_LABELS,
  AttrName,
  ClassName,
  EFFECTS,
  SKILL_POWERS,
  PARAGON_PERKS,
  EquipSlot,
  INVENTORY_SIZE,
  Item,
  ItemStats,
  RARITY_COLORS,
  RUNES,
  SETS,
  SKILL_KEYS,
  SKILL_TREES,
  STASH_SIZE,
  SkillKey,
  SkillNode,
  Slot,
  TIER_LEVELS,
  canAllocSkill,
  effectiveSkills,
  identifyCost,
  runewordByName,
  sellValue,
  skillDamageMult,
} from "@arpg/common";

export interface Sheet {
  dmgMin: number;
  dmgMax: number;
  crit: number;
  dodge: number;
  armor: number;
  atkSpd: number;
  moveSpd: number;
  magicFind: number;
  goldFind: number;
  lifeSteal: number;
  manaSteal: number;
  thorns: number;
  cdr: number;
  regen: number;
  manaRegen: number;
  xpBonus: number;
  fireRes: number;
  coldRes: number;
  lightRes: number;
}

export interface Loadout {
  inventory: Item[];
  equipment: Partial<Record<EquipSlot, Item | null>>;
  stash?: Item[];
  sharedStash?: Item[];
  derived: ItemStats;
  skills?: Record<string, number>;
  binds?: Partial<Record<SkillKey, string>>;
  paragonAlloc?: Record<string, number>;
  sheet?: Sheet;
}

export interface PanelActions {
  equip(id: string): void;
  unequip(slot: EquipSlot): void;
  drop(id: string): void;
  stashPut(id: string): void;
  stashTake(id: string): void;
  sharedStashPut(id: string): void;
  sharedStashTake(id: string): void;
  sell(id: string): void;
  socket(runeId: string, itemId: string): void;
  identify(id: string): void;
  sort(): void;
}

const SLOT_GLYPH: Record<string, string> = {
  weapon: "WPN",
  offhand: "OFF",
  helm: "HLM",
  chest: "CHS",
  ring: "RNG",
  amulet: "AMU",
  belt: "BLT",
  boots: "BTS",
  charm: "CHM",
};

// paper-doll layout: 3x3
const EQUIP_LAYOUT: Array<{ slot: EquipSlot; label: string; col: number; row: number }> = [
  { slot: "weapon", label: "weapon", col: 0, row: 0 },
  { slot: "helm", label: "helm", col: 1, row: 0 },
  { slot: "offhand", label: "offhand", col: 2, row: 0 },
  { slot: "ring1", label: "ring 1", col: 0, row: 1 },
  { slot: "chest", label: "chest", col: 1, row: 1 },
  { slot: "ring2", label: "ring 2", col: 2, row: 1 },
  { slot: "belt", label: "belt", col: 0, row: 2 },
  { slot: "boots", label: "boots", col: 1, row: 2 },
  { slot: "amulet", label: "amulet", col: 2, row: 2 },
];

const PANEL_W = 268;
const STASH_W = 250; // extra panel width when the stash is open
const CELL = 46;
const GAP = 8;

const STAT_LABELS: Record<keyof ItemStats, string> = {
  dmg: "damage",
  dmgPct: "% damage",
  armor: "armor",
  maxHp: "life",
  maxMana: "mana",
  atkSpd: "% attack speed",
  moveSpd: "% move speed",
  regen: "life regen",
  manaRegen: "mana regen",
  dodge: "% dodge",
  magicFind: "% magic find",
  crit: "% critical strike",
  lifeSteal: "% life steal",
  manaSteal: "% mana steal",
  thorns: "thorns",
  fireDmg: "fire damage",
  coldDmg: "cold damage (chills)",
  lightDmg: "lightning damage (0-2x)",
  xpBonus: "% experience",
  goldFind: "% gold find",
  cdr: "% cooldown reduction",
  potionPower: "% potion healing",
  fireRes: "% fire resist",
  coldRes: "% cold resist",
  lightRes: "% lightning resist",
  allRes: "% all resistances",
  plusSkills: "to all skills",
  penetration: "% elemental penetration",
};

export function statLines(stats: ItemStats): string[] {
  const lines: string[] = [];
  for (const k of Object.keys(STAT_LABELS) as Array<keyof ItemStats>) {
    const v = stats[k];
    if (v) lines.push(`${v > 0 ? "+" : ""}${v}${STAT_LABELS[k].startsWith("%") ? STAT_LABELS[k] : ` ${STAT_LABELS[k]}`}`);
  }
  return lines;
}

export function rarityColorStr(rarity: string): string {
  const c = RARITY_COLORS[rarity as keyof typeof RARITY_COLORS] ?? 0xd0d0d0;
  return "#" + c.toString(16).padStart(6, "0");
}

export class InventoryPanel {
  visible = false;
  stashOpen = false;
  private stashTab: "personal" | "shared" = "personal"; // which stash the open panel shows
  nearVendor = false;
  viewerCls = ""; // set by UIScene — used to color class-locked bonuses
  selectedRune: string | null = null; // rune awaiting a socket target
  loadout: Loadout = { inventory: [], equipment: {}, stash: [], derived: {} };

  private root: Phaser.GameObjects.Container;
  private tooltip: Phaser.GameObjects.Container;
  private panelH = 0;
  private lastNearVendor = false;

  constructor(private scene: Phaser.Scene, private actions: PanelActions) {
    this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(1_000_005).setVisible(false);
    this.tooltip = scene.add.container(0, 0).setScrollFactor(0).setDepth(1_000_010).setVisible(false);
  }

  setLoadout(l: Loadout) {
    this.loadout = l;
    if (this.visible) this.render();
  }

  toggle() {
    this.visible = !this.visible;
    this.root.setVisible(this.visible);
    if (this.visible) this.render();
    else {
      this.stashOpen = false;
      this.hideTooltip();
    }
  }

  openStash() {
    this.stashOpen = true;
    if (!this.visible) {
      this.visible = true;
      this.root.setVisible(true);
    }
    this.render();
  }

  setStashOpen(open: boolean) {
    if (this.stashOpen === open) return;
    this.stashOpen = open;
    if (this.visible) this.render();
  }

  setNearVendor(near: boolean) {
    this.nearVendor = near;
    if (this.visible && near !== this.lastNearVendor) {
      this.lastNearVendor = near;
      this.render(); // hints change between "drop" and "sell"
    }
  }

  private totalW(): number {
    return PANEL_W + (this.stashOpen ? STASH_W : 0);
  }

  containsPoint(x: number, y: number): boolean {
    if (!this.visible) return false;
    const px = this.scene.scale.width - this.totalW() - 10;
    return x >= px && y >= 50 && y <= 50 + this.panelH;
  }

  private hideTooltip() {
    this.tooltip.setVisible(false);
  }

  private setPiecesWorn(setId: string): number {
    const worn = new Set(
      Object.values(this.loadout.equipment)
        .filter((i) => i?.setId === setId)
        .map((i) => i!.name)
    );
    return worn.size;
  }

  private showTooltip(item: Item, atX: number, atY: number, hint: string, compare = false) {
    this.tooltip.removeAll(true);
    const color = rarityColorStr(item.rarity);

    // an unidentified item shows its tier and nothing else — the suspense is the point
    if (item.unidentified) {
      const texts: Phaser.GameObjects.Text[] = [];
      let y = 8;
      texts.push(this.scene.add.text(10, y, `Unidentified ${item.rarity} item`, {
        fontFamily: "monospace", fontSize: "15px", color, fontStyle: "bold",
      }));
      y += 21;
      texts.push(this.scene.add.text(10, y, `${item.slot === "charm" ? "charm" : item.slot} · the beam knows its tier, not its truth`, {
        fontFamily: "monospace", fontSize: "12px", color: "#8a8a96", fontStyle: "italic",
      }));
      y += 18;
      texts.push(this.scene.add.text(10, y, "? ? ?", { fontFamily: "monospace", fontSize: "14px", color: "#5a5a66" }));
      y += 21;
      texts.push(this.scene.add.text(10, y, hint, { fontFamily: "monospace", fontSize: "12px", color: "#6a6a76" }));
      y += 21;
      const w = Math.max(170, ...texts.map((t) => t.width + 20));
      const bg = this.scene.add.rectangle(0, 0, w, y, 0x120f1a, 0.97).setOrigin(0).setStrokeStyle(2, 0x54402a);
      this.tooltip.add([bg, ...texts]);
      this.tooltip.setPosition(Math.min(atX, this.scene.scale.width - w - 8), Math.min(atY, this.scene.scale.height - y - 8)).setVisible(true);
      return;
    }

    const lines = statLines(item.stats);

    const texts: Phaser.GameObjects.Text[] = [];
    let y = 8;
    const isRuneItem = item.slot === "rune";
    const socketTag = item.sockets ? ` ◈${item.sockets}` : "";
    const displayName = (item.runeword ? `"${item.runeword}" ${item.name}` : item.name) + socketTag;
    const name = this.scene.add.text(10, y, displayName, {
      fontFamily: "monospace", fontSize: "15px",
      color: item.runeword || isRuneItem ? "#ff8033" : color,
      fontStyle: "bold",
    });
    texts.push(name);
    y += 21;
    const sub = this.scene.add.text(10, y, isRuneItem ? "rune — socket into gear" : `${item.rarity} ${item.slot}`, {
      fontFamily: "monospace", fontSize: "13px", color: "#8a8a96",
    });
    texts.push(sub);
    y += 18;
    for (const line of lines) {
      texts.push(this.scene.add.text(10, y, line, { fontFamily: "monospace", fontSize: "13px", color: "#c9c9d4" }));
      y += 16;
    }
    if (item.sockets) {
      y += 3;
      const filled = item.runes ?? [];
      const stones = item.jewels ?? [];
      const pips = Array.from({ length: item.sockets }, (_, i) =>
        filled[i] ? `[${RUNES[filled[i]]?.name ?? "?"}]` : stones[i - filled.length] ? `[◆]` : "[ ]"
      ).join(" ");
      texts.push(
        this.scene.add.text(10, y, `sockets: ${pips}`, {
          fontFamily: "monospace", fontSize: "12px", color: "#ffb066",
        })
      );
      y += 15;
      for (const j of item.jewels ?? []) {
        for (const line of statLines(j.stats)) {
          texts.push(
            this.scene.add.text(10, y, `  ◆ ${j.name}: ${line}`, {
              fontFamily: "monospace", fontSize: "12px", color: "#b066ff",
            })
          );
          y += 15;
        }
      }
      for (const r of filled) {
        const rune = RUNES[r];
        if (!rune) continue;
        for (const line of statLines(rune.stats)) {
          texts.push(
            this.scene.add.text(10, y, `  ${rune.name}: ${line}`, {
              fontFamily: "monospace", fontSize: "12px", color: "#c9a080",
            })
          );
          y += 15;
        }
      }
      if (item.runeword) {
        const rw = runewordByName(item.runeword);
        if (rw) {
          texts.push(
            this.scene.add.text(10, y, `Runeword "${rw.name}":`, {
              fontFamily: "monospace", fontSize: "12px", color: "#ff8033", fontStyle: "bold",
            })
          );
          y += 15;
          for (const line of statLines(rw.bonus)) {
            texts.push(
              this.scene.add.text(10, y, `  ${line}`, { fontFamily: "monospace", fontSize: "12px", color: "#ff8033" })
            );
            y += 15;
          }
          if (rw.effect && EFFECTS[rw.effect]) {
            texts.push(
              this.scene.add.text(10, y, `  ★ ${EFFECTS[rw.effect].name} — ${EFFECTS[rw.effect].desc}`, {
                fontFamily: "monospace", fontSize: "12px", color: "#ff8033", fontStyle: "italic", wordWrap: { width: 300 },
              })
            );
            y += texts[texts.length - 1].height + 1;
          }
        }
      }
    }
    if (item.classBonus) {
      const mine = item.classBonus.cls === this.viewerCls;
      texts.push(
        this.scene.add.text(10, y, `${item.classBonus.cls} only${mine ? "" : " (not you)"}:`, {
          fontFamily: "monospace", fontSize: "12px", color: mine ? "#d8b13a" : "#5a5a66", fontStyle: "bold",
        })
      );
      y += 15;
      for (const line of statLines(item.classBonus.stats)) {
        texts.push(
          this.scene.add.text(10, y, `  ${line}`, {
            fontFamily: "monospace", fontSize: "12px", color: mine ? "#d8b13a" : "#5a5a66",
          })
        );
        y += 15;
      }
    }
    if (item.effect && EFFECTS[item.effect]) {
      const fx = EFFECTS[item.effect];
      y += 3;
      const fxText = this.scene.add.text(10, y, `★ ${fx.name} — ${fx.desc}`, {
        fontFamily: "monospace", fontSize: "12px", color: "#ff8033", fontStyle: "italic",
        wordWrap: { width: 300 },
      });
      texts.push(fxText);
      y += fxText.height + 2;
    }
    // legendary skill-power — the build-defining line, called out in bright violet
    if (item.power && SKILL_POWERS[item.power]) {
      const pw = SKILL_POWERS[item.power];
      y += 3;
      const pwText = this.scene.add.text(10, y, `✦ ${pw.name} — ${pw.desc}`, {
        fontFamily: "monospace", fontSize: "12px", color: "#c98aff", fontStyle: "bold",
        wordWrap: { width: 300 },
      });
      texts.push(pwText);
      y += pwText.height + 2;
    }
    if (item.setId && SETS[item.setId]) {
      const set = SETS[item.setId];
      const worn = this.setPiecesWorn(item.setId);
      const complete = worn >= set.pieces;
      y += 4;
      texts.push(
        this.scene.add.text(10, y, `${set.name} (${worn}/${set.pieces})`, {
          fontFamily: "monospace", fontSize: "13px", color: "#40c060", fontStyle: "bold",
        })
      );
      y += 16;
      for (const line of statLines(set.bonus)) {
        texts.push(
          this.scene.add.text(10, y, `set bonus: ${line}`, {
            fontFamily: "monospace", fontSize: "12px", color: complete ? "#40c060" : "#4a5a4e",
          })
        );
        y += 15;
      }
    }
    if (item.slot === "charm") {
      y += 4;
      texts.push(
        this.scene.add.text(10, y, "works from your inventory", {
          fontFamily: "monospace", fontSize: "12px", color: "#6a8cff",
        })
      );
      y += 15;
    }

    // comparison vs what's currently equipped in that slot (both slots for rings)
    if (compare && item.slot !== "charm") {
      const slots: EquipSlot[] =
        item.slot === "ring" ? ["ring1", "ring2"] : [item.slot as EquipSlot];
      for (const slot of slots) {
        const eq = this.loadout.equipment[slot];
        y += 5;
        if (!eq) {
          texts.push(
            this.scene.add.text(10, y, `${slot}: empty — free upgrade`, {
              fontFamily: "monospace", fontSize: "12px", color: "#40c060",
            })
          );
          y += 15;
          continue;
        }
        texts.push(
          this.scene.add.text(10, y, `vs ${eq.name}${slots.length > 1 ? ` (${slot})` : ""}:`, {
            fontFamily: "monospace", fontSize: "12px", color: "#8a8a96", fontStyle: "bold",
          })
        );
        y += 15;
        const keys = new Set<keyof ItemStats>([
          ...(Object.keys(item.stats) as Array<keyof ItemStats>),
          ...(Object.keys(eq.stats) as Array<keyof ItemStats>),
        ]);
        let anyDiff = false;
        for (const k of keys) {
          const delta = (item.stats[k] ?? 0) - (eq.stats[k] ?? 0);
          if (delta === 0) continue;
          anyDiff = true;
          texts.push(
            this.scene.add.text(10, y, `  ${delta > 0 ? "+" : ""}${delta} ${STAT_LABELS[k]}`, {
              fontFamily: "monospace", fontSize: "12px", color: delta > 0 ? "#40c060" : "#e05050",
            })
          );
          y += 15;
        }
        if (!anyDiff) {
          texts.push(
            this.scene.add.text(10, y, "  identical stats", {
              fontFamily: "monospace", fontSize: "12px", color: "#6a6a76",
            })
          );
          y += 15;
        }
      }
    }
    y += 4;
    texts.push(this.scene.add.text(10, y, hint, { fontFamily: "monospace", fontSize: "12px", color: "#6a6a76" }));
    y += 21;

    const w = Math.max(150, ...texts.map((t) => t.width + 20));
    const bg = this.scene.add.rectangle(0, 0, w, y, 0x120f1a, 0.97).setOrigin(0).setStrokeStyle(2, 0x54402a);
    const goldEdge = this.scene.add
      .rectangle(2, 2, w - 4, y - 4, 0x000000, 0)
      .setOrigin(0)
      .setStrokeStyle(1, 0xd8b13a, 0.25);
    this.tooltip.add([bg, goldEdge, ...texts]);

    const tx = Math.min(atX, this.scene.scale.width - w - 8);
    const ty = Math.min(atY, this.scene.scale.height - y - 8);
    this.tooltip.setPosition(tx, ty).setVisible(true);
  }

  private cell(
    x: number,
    y: number,
    item: Item | null | undefined,
    emptyGlyph: string,
    onLeft: () => void,
    onRight: (() => void) | null,
    hint: string,
    compare = false
  ) {
    const bg = this.scene.add.rectangle(x, y, CELL, CELL, 0x171226, 0.95).setOrigin(0);
    if (item && item.id === this.selectedRune) {
      bg.setStrokeStyle(3, 0xffb066); // rune armed for socketing
    } else if (item?.slot === "rune") {
      bg.setStrokeStyle(2, 0xff8033);
    } else if (item?.slot === "jewel") {
      bg.setStrokeStyle(2, item.rarity === "rare" ? 0xf2d34e : 0x5b8cff);
    } else if (item) {
      bg.setStrokeStyle(2, RARITY_COLORS[item.rarity as keyof typeof RARITY_COLORS] ?? 0xd0d0d0);
    } else {
      bg.setStrokeStyle(1, 0x342a44);
    }
    this.root.add(bg);

    const iconKey = item ? (item.slot === "rune" ? "icon_runestone" : item.slot === "jewel" ? "icon_jewel" : `icon_${item.base}`) : "";
    if (item && this.scene.textures.exists(iconKey)) {
      const img = this.scene.add.image(x + CELL / 2, y + CELL / 2, iconKey);
      this.root.add(img);
      if (item.unidentified) {
        img.setAlpha(0.35).setTint(0x8888aa); // shrouded until identified
        this.root.add(
          this.scene.add
            .text(x + CELL / 2, y + CELL / 2, "?", {
              fontFamily: "monospace", fontSize: "20px", color: rarityColorStr(item.rarity), fontStyle: "bold",
            })
            .setOrigin(0.5)
        );
      }
      if (item.slot === "rune") {
        // carved rune letters over the stone
        this.root.add(
          this.scene.add
            .text(x + CELL / 2, y + CELL / 2 - 1, item.name.split(" ")[0], {
              fontFamily: "monospace", fontSize: "12px", color: "#ffb066", fontStyle: "bold",
            })
            .setOrigin(0.5)
        );
      }
      if (item.sockets) {
        // socket pips along the bottom of the cell — orange runes, violet jewels
        const nRunes = item.runes?.length ?? 0;
        const nJewels = item.jewels?.length ?? 0;
        for (let s = 0; s < item.sockets; s++) {
          const kind = s < nRunes ? "rune" : s < nRunes + nJewels ? "jewel" : "";
          const pip = this.scene.add
            .circle(x + 8 + s * 9, y + CELL - 7, 3, kind === "rune" ? 0xff8033 : kind === "jewel" ? 0xb066ff : 0x0c0a12, 1)
            .setStrokeStyle(1, kind ? 0xffffff : 0x54402a);
          this.root.add(pip);
        }
      }
      if (item.runeword) {
        const rwGlow = this.scene.add
          .rectangle(x + 1, y + 1, CELL - 2, CELL - 2, 0x000000, 0)
          .setOrigin(0)
          .setStrokeStyle(1, 0xff8033, 0.8);
        this.root.add(rwGlow);
      }
    } else {
      const glyph = this.scene.add
        .text(x + CELL / 2, y + CELL / 2, item ? SLOT_GLYPH[item.slot] : emptyGlyph, {
          fontFamily: "monospace",
          fontSize: "14px",
          color: item ? rarityColorStr(item.rarity) : "#3a3a46",
          fontStyle: item ? "bold" : "normal",
        })
        .setOrigin(0.5);
      this.root.add(glyph);
    }

    bg.setInteractive({ useHandCursor: !!item });
    bg.on("pointerover", () => {
      bg.setFillStyle(0x251d33, 0.95);
      if (item) {
        const m = this.root.getWorldTransformMatrix();
        this.showTooltip(item, m.tx + x - 160, m.ty + y + CELL + 4, hint, compare);
      }
    });
    bg.on("pointerout", () => {
      bg.setFillStyle(0x171226, 0.95);
      this.hideTooltip();
    });
    bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!item) return;
      this.hideTooltip();
      if (pointer.rightButtonDown()) {
        if (onRight) onRight();
      } else {
        onLeft();
      }
    });
  }

  private render() {
    this.root.removeAll(true);
    this.hideTooltip();
    this.lastNearVendor = this.nearVendor;

    const totalW = this.totalW();
    const off = this.stashOpen ? STASH_W : 0; // main sections shift right of the stash block
    const px = this.scene.scale.width - totalW - 10;
    const py = 50;
    this.root.setPosition(px, py);

    const cols = 4;
    const rows = Math.ceil(INVENTORY_SIZE / cols);
    const equipRows = 3;
    const gridTop = 34 + equipRows * (CELL + 17) + 14;
    const derivedTop = gridTop + rows * (CELL + GAP) + 12;
    const lines = statLines(this.loadout.derived);
    this.panelH = derivedTop + Math.max(1, lines.length) * 16 + 34;

    const bg = this.scene.add
      .rectangle(0, 0, totalW, this.panelH, 0x120f1a, 0.96)
      .setOrigin(0)
      .setStrokeStyle(2, 0x54402a);
    this.root.add(bg);
    const goldLine = this.scene.add
      .rectangle(3, 3, totalW - 6, this.panelH - 6, 0x000000, 0)
      .setOrigin(0)
      .setStrokeStyle(1, 0xd8b13a, 0.3);
    this.root.add(goldLine);
    for (const [cx, cy] of [[0, 0], [totalW - 5, 0], [0, this.panelH - 5], [totalW - 5, this.panelH - 5]]) {
      this.root.add(this.scene.add.rectangle(cx, cy, 5, 5, 0xd8b13a, 0.75).setOrigin(0));
    }

    this.root.add(
      this.scene.add.text(off + 12, 10, "INVENTORY", { fontFamily: "monospace", fontSize: "16px", color: "#c9c9d4", fontStyle: "bold" })
    );
    this.root.add(
      this.scene.add.text(totalW - 12, 12, "[I] close", { fontFamily: "monospace", fontSize: "12px", color: "#6a6a76" }).setOrigin(1, 0)
    );
    // one click, an orderly bag
    const sortBtn = this.scene.add
      .text(off + 100, 11, "[⇅ sort]", { fontFamily: "monospace", fontSize: "12px", color: "#8a9ab8" })
      .setInteractive({ useHandCursor: true });
    sortBtn.on("pointerover", () => sortBtn.setColor("#c8d8f8"));
    sortBtn.on("pointerout", () => sortBtn.setColor("#8a9ab8"));
    sortBtn.on("pointerdown", () => this.actions.sort());
    this.root.add(sortBtn);

    // stash block (left side, only while standing at your stash in town)
    if (this.stashOpen) {
      const shared = this.stashTab === "shared";
      const stash = (shared ? this.loadout.sharedStash : this.loadout.stash) ?? [];
      // two tabs: this hero's stash, and the account-wide shared stash (travels across heroes)
      const tab = (label: string, key: "personal" | "shared", tx: number) => {
        const on = this.stashTab === key;
        const t = this.scene.add
          .text(tx, 10, label, {
            fontFamily: "monospace", fontSize: "13px", fontStyle: "bold",
            color: on ? "#e0b0ff" : "#6a6a76", backgroundColor: on ? "#2a1a3aaa" : undefined,
            padding: { x: 3, y: 2 },
          })
          .setInteractive({ useHandCursor: true });
        t.on("pointerdown", () => { this.stashTab = key; this.render(); });
        this.root.add(t);
      };
      tab("STASH", "personal", 12);
      tab("SHARED", "shared", 92);
      this.root.add(
        this.scene.add.text(12, 26, `${stash.length}/${STASH_SIZE}${shared ? "  ✦ account-wide" : ""}`, {
          fontFamily: "monospace", fontSize: "11px", color: "#8a7a9a",
        })
      );
      const sCols = 4;
      for (let i = 0; i < STASH_SIZE; i++) {
        const x = 12 + (i % sCols) * (CELL + GAP);
        const y = 42 + Math.floor(i / sCols) * (CELL + GAP);
        if (y + CELL > this.panelH - 8) break; // don't overflow the panel
        const item = stash[i] ?? null;
        this.cell(x, y, item, "·", () => item && (shared ? this.actions.sharedStashTake(item.id) : this.actions.stashTake(item.id)), null, "click: take out", true);
      }
      const sep = this.scene.add.rectangle(STASH_W - 4, 8, 1, this.panelH - 16, 0x3a3a48).setOrigin(0);
      this.root.add(sep);
    }

    // paper-doll equipment grid
    const equipX0 = off + (PANEL_W - (3 * CELL + 2 * GAP)) / 2;
    EQUIP_LAYOUT.forEach(({ slot, label, col, row }) => {
      const x = equipX0 + col * (CELL + GAP);
      const y = 34 + row * (CELL + 17);
      const item = this.loadout.equipment[slot] ?? null;
      const freeSocket = !!item?.sockets && (item.runes?.length ?? 0) + (item.jewels?.length ?? 0) < (item.sockets ?? 0);
      const canInsert = !!this.selectedRune && freeSocket;
      this.cell(
        x, y, item, "·",
        () => {
          if (canInsert && item) {
            this.actions.socket(this.selectedRune!, item.id);
            this.selectedRune = null;
          } else {
            this.actions.unequip(slot);
          }
        },
        null,
        canInsert ? "click: SEAT THE STONE" : "click: unequip"
      );
      this.root.add(
        this.scene.add.text(x + CELL / 2, y + CELL + 2, label, { fontFamily: "monospace", fontSize: "11px", color: "#6a6a76" }).setOrigin(0.5, 0)
      );
    });

    // inventory grid
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      const x = off + 12 + (i % cols) * (CELL + GAP);
      const y = gridTop + Math.floor(i / cols) * (CELL + GAP);
      const item = this.loadout.inventory[i] ?? null;
      const isCharm = item?.slot === "charm";
      const isRune = item?.slot === "rune" || item?.slot === "jewel";
      const isUnid = !!item?.unidentified;
      const freeSocket = !!item?.sockets && (item.runes?.length ?? 0) + (item.jewels?.length ?? 0) < item.sockets;
      const rightHint = item && this.nearVendor ? `right-click: SELL (${sellValue(item)}g)` : "right-click: drop";
      const leftHint = this.stashOpen
        ? "click: stash it"
        : isUnid
          ? `click: IDENTIFY (${this.nearVendor ? "free — Torvald squints at it" : `${identifyCost(item!.ilvl)}g`}) · `
          : isRune
            ? "click: select, then click a socketed item · "
            : this.selectedRune && freeSocket
              ? "click: INSERT RUNE · "
              : isCharm
                ? ""
                : "click: equip · ";
      this.cell(
        x, y, item, "·",
        () => {
          if (!item) return;
          if (this.stashOpen) {
            if (this.stashTab === "shared") this.actions.sharedStashPut(item.id);
            else this.actions.stashPut(item.id);
          } else if (isUnid) {
            this.actions.identify(item.id);
          } else if (isRune) {
            this.selectedRune = this.selectedRune === item.id ? null : item.id;
            this.render();
          } else if (this.selectedRune && freeSocket) {
            this.actions.socket(this.selectedRune, item.id);
            this.selectedRune = null;
          } else if (!isCharm) {
            this.actions.equip(item.id);
          }
        },
        () => {
          if (!item) return;
          if (this.nearVendor) this.actions.sell(item.id);
          else this.actions.drop(item.id);
        },
        `${leftHint}${leftHint.endsWith("· ") ? "" : leftHint ? " · " : ""}${rightHint}`,
        true // hovering a bag item compares it against what's equipped
      );
    }

    // derived stat summary
    this.root.add(
      this.scene.add.text(off + 12, derivedTop, "FROM GEAR", { fontFamily: "monospace", fontSize: "13px", color: "#8a8a96", fontStyle: "bold" })
    );
    if (lines.length === 0) {
      this.root.add(
        this.scene.add.text(off + 12, derivedTop + 20, "nothing equipped", { fontFamily: "monospace", fontSize: "13px", color: "#4a4a56" })
      );
    }
    lines.forEach((line, i) => {
      this.root.add(
        this.scene.add.text(off + 12, derivedTop + 20 + i * 16, line, { fontFamily: "monospace", fontSize: "13px", color: "#9fdc9f" })
      );
    });
  }
}

// shared gothic panel chrome
function panelChrome(scene: Phaser.Scene, root: Phaser.GameObjects.Container, w: number, h: number) {
  root.add(scene.add.rectangle(0, 0, w, h, 0x120f1a, 0.96).setOrigin(0).setStrokeStyle(2, 0x54402a));
  root.add(scene.add.rectangle(3, 3, w - 6, h - 6, 0x000000, 0).setOrigin(0).setStrokeStyle(1, 0xd8b13a, 0.3));
  for (const [cx, cy] of [[0, 0], [w - 5, 0], [0, h - 5], [w - 5, h - 5]]) {
    root.add(scene.add.rectangle(cx, cy, 5, 5, 0xd8b13a, 0.75).setOrigin(0));
  }
}

// --- the character sheet: attributes + the numbers that matter ---

export interface HeroState {
  name: string;
  cls: string;
  level: number;
  str: number;
  dex: number;
  vit: number;
  ene: number;
  statPoints: number;
  skillPoints: number;
  maxHp: number;
  maxMana: number;
  paragonLevel: number;
  paragonPoints: number;
  paragonAlloc: Record<string, number>;
}

const CHAR_W = 300;

export class CharacterPanel {
  visible = false;
  private root: Phaser.GameObjects.Container;
  private panelH = 0;
  private hero: HeroState | null = null;
  private sheet: Sheet | null = null;

  constructor(
    private scene: Phaser.Scene,
    private allocStat: (attr: AttrName) => void,
    private allocParagon: (id: string) => void
  ) {
    this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(1_000_005).setVisible(false);
  }

  toggle() {
    this.visible = !this.visible;
    this.root.setVisible(this.visible);
    if (this.visible) this.render();
  }

  setState(hero: HeroState, sheet: Sheet | null) {
    const dirty =
      !this.hero ||
      JSON.stringify(this.hero) !== JSON.stringify(hero) ||
      JSON.stringify(this.sheet) !== JSON.stringify(sheet);
    this.hero = hero;
    this.sheet = sheet;
    if (this.visible && dirty) this.render();
  }

  containsPoint(x: number, y: number): boolean {
    return this.visible && x >= 10 && x <= 10 + CHAR_W && y >= 50 && y <= 50 + this.panelH;
  }

  private render() {
    this.root.removeAll(true);
    const h = this.hero;
    if (!h) return;
    const s = this.sheet;

    const sheetLines: Array<[string, string]> = s
      ? [
          ["damage", `${s.dmgMin}-${s.dmgMax}`],
          ["life / mana", `${h.maxHp} / ${h.maxMana}`],
          ["critical strike", `${s.crit}%`],
          ["dodge", `${s.dodge}%`],
          ["armor", `${s.armor}`],
          ["attack speed", `+${s.atkSpd}%`],
          ["move speed", `+${s.moveSpd}%`],
          ["life regen", `${Math.round(s.regen * 10) / 10}/s`],
          ["mana regen", `${Math.round(s.manaRegen * 10) / 10}/s`],
          ["life steal", `${s.lifeSteal}%`],
          ["thorns", `${s.thorns}`],
          ["cooldown reduction", `${s.cdr}%`],
          ["magic find", `+${s.magicFind}%`],
          ["gold find", `+${s.goldFind}%`],
          ["experience", `+${s.xpBonus}%`],
          ["fire resist", `${s.fireRes ?? 0}%`],
          ["cold resist", `${s.coldRes ?? 0}%`],
          ["lightning resist", `${s.lightRes ?? 0}%`],
        ]
      : [];

    const attrsTop = 68;
    const sheetTop = attrsTop + 4 * 30 + 30;
    const paragonTop = sheetTop + sheetLines.length * 17 + 14;
    // paragon only appears once you've broken the level ceiling
    const showParagon = (h.paragonLevel ?? 0) > 0 || (h.paragonPoints ?? 0) > 0;
    const paragonH = showParagon ? 28 + PARAGON_PERKS.length * 18 : 0;
    this.panelH = paragonTop + paragonH + 12;
    panelChrome(this.scene, this.root, CHAR_W, this.panelH);
    this.root.setPosition(10, 50);

    this.root.add(
      this.scene.add.text(12, 10, h.name.toUpperCase(), { fontFamily: "monospace", fontSize: "16px", color: "#e8d8a8", fontStyle: "bold" })
    );
    this.root.add(
      this.scene.add.text(12, 28, `level ${h.level} ${h.cls}`, { fontFamily: "monospace", fontSize: "13px", color: "#8a8a96" })
    );
    this.root.add(
      this.scene.add.text(CHAR_W - 12, 12, "[C] close", { fontFamily: "monospace", fontSize: "12px", color: "#6a6a76" }).setOrigin(1, 0)
    );

    // unspent points banner
    if (h.statPoints > 0) {
      this.root.add(
        this.scene.add.text(12, attrsTop - 18, `${h.statPoints} stat points to spend`, {
          fontFamily: "monospace", fontSize: "13px", color: "#ffd54a", fontStyle: "bold",
        })
      );
    }

    ATTRS.forEach((attr, i) => {
      const y = attrsTop + i * 30;
      const val = h[attr];
      this.root.add(
        this.scene.add.text(12, y, ATTR_LABELS[attr], { fontFamily: "monospace", fontSize: "14px", color: "#c9c9d4" })
      );
      this.root.add(
        this.scene.add.text(150, y, `${val}`, { fontFamily: "monospace", fontSize: "14px", color: "#e8d8a8", fontStyle: "bold" }).setOrigin(1, 0)
      );
      if (h.statPoints > 0) {
        const btn = this.scene.add
          .rectangle(170, y - 2, 22, 20, 0x2a2416, 1)
          .setOrigin(0)
          .setStrokeStyle(1, 0xd8b13a, 0.8)
          .setInteractive({ useHandCursor: true });
        const plus = this.scene.add
          .text(181, y + 8, "+", { fontFamily: "monospace", fontSize: "15px", color: "#ffd54a", fontStyle: "bold" })
          .setOrigin(0.5);
        btn.on("pointerover", () => btn.setFillStyle(0x4a3c1e));
        btn.on("pointerout", () => btn.setFillStyle(0x2a2416));
        btn.on("pointerdown", () => this.allocStat(attr));
        this.root.add(btn);
        this.root.add(plus);
      }
    });

    const sep = this.scene.add.rectangle(12, sheetTop - 12, CHAR_W - 24, 1, 0x3a3a48).setOrigin(0);
    this.root.add(sep);
    sheetLines.forEach(([label, value], i) => {
      const y = sheetTop + i * 17;
      this.root.add(this.scene.add.text(12, y, label, { fontFamily: "monospace", fontSize: "12px", color: "#8a8a96" }));
      this.root.add(
        this.scene.add.text(CHAR_W - 12, y, value, { fontFamily: "monospace", fontSize: "12px", color: "#c9e0c9" }).setOrigin(1, 0)
      );
    });

    // paragon: the endless track, and its spend buttons
    if (showParagon) {
      const psep = this.scene.add.rectangle(12, paragonTop - 8, CHAR_W - 24, 1, 0x4a3a5a).setOrigin(0);
      this.root.add(psep);
      this.root.add(
        this.scene.add.text(12, paragonTop, `✦ PARAGON ${h.paragonLevel}`, {
          fontFamily: "monospace", fontSize: "14px", color: "#c98aff", fontStyle: "bold",
        })
      );
      if (h.paragonPoints > 0) {
        this.root.add(
          this.scene.add.text(CHAR_W - 12, paragonTop + 1, `${h.paragonPoints} pt`, {
            fontFamily: "monospace", fontSize: "12px", color: "#ffd54a", fontStyle: "bold",
          }).setOrigin(1, 0)
        );
      }
      PARAGON_PERKS.forEach((perk, i) => {
        const y = paragonTop + 24 + i * 18;
        const spent = h.paragonAlloc?.[perk.id] ?? 0;
        this.root.add(
          this.scene.add.text(12, y, `${perk.name} — ${perk.desc}`, { fontFamily: "monospace", fontSize: "12px", color: "#b9a9c9" })
        );
        this.root.add(
          this.scene.add.text(CHAR_W - 30, y, `${spent}`, { fontFamily: "monospace", fontSize: "12px", color: "#e8d8a8" }).setOrigin(1, 0)
        );
        if (h.paragonPoints > 0) {
          const btn = this.scene.add
            .rectangle(CHAR_W - 24, y - 1, 16, 14, 0x2a1a3a, 1)
            .setOrigin(0)
            .setStrokeStyle(1, 0xc98aff, 0.8)
            .setInteractive({ useHandCursor: true });
          const plus = this.scene.add
            .text(CHAR_W - 16, y + 6, "+", { fontFamily: "monospace", fontSize: "14px", color: "#e0b0ff", fontStyle: "bold" })
            .setOrigin(0.5);
          btn.on("pointerover", () => btn.setFillStyle(0x4a2a5a));
          btn.on("pointerout", () => btn.setFillStyle(0x2a1a3a));
          btn.on("pointerdown", () => this.allocParagon(perk.id));
          this.root.add(btn);
          this.root.add(plus);
        }
      });
    }
  }
}

// --- the skill tree: where builds are born ---

const SKILL_W = 380;
const NODE = 44;

export class SkillPanel {
  visible = false;
  bindPending: string | null = null; // learned active waiting for a Q/E/F press

  private root: Phaser.GameObjects.Container;
  private tooltip: Phaser.GameObjects.Container;
  private panelH = 0;
  private cls: ClassName | "" = "";
  private level = 1;
  private points = 0;
  private skills: Record<string, number> = {};
  private binds: Partial<Record<SkillKey, string>> = {};
  private plusSkills = 0; // +skills from gear — boosts learned ranks for display

  private respecArmed = false; // two-click confirm so a free respec isn't a misclick disaster

  constructor(
    private scene: Phaser.Scene,
    private actions: { alloc: (id: string) => void; bind: (id: string, key: SkillKey) => void; respec: () => void }
  ) {
    this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(1_000_005).setVisible(false);
    this.tooltip = scene.add.container(0, 0).setScrollFactor(0).setDepth(1_000_010).setVisible(false);
  }

  toggle() {
    this.visible = !this.visible;
    this.root.setVisible(this.visible);
    this.bindPending = null;
    this.respecArmed = false;
    if (this.visible) this.render();
    else this.tooltip.setVisible(false);
  }

  setState(cls: string, level: number, points: number, skills: Record<string, number>, binds: Partial<Record<SkillKey, string>>, plusSkills = 0) {
    const dirty =
      this.cls !== cls ||
      this.level !== level ||
      this.points !== points ||
      this.plusSkills !== plusSkills ||
      JSON.stringify(this.skills) !== JSON.stringify(skills) ||
      JSON.stringify(this.binds) !== JSON.stringify(binds);
    this.cls = cls as ClassName;
    this.level = level;
    this.points = points;
    this.skills = skills;
    this.binds = binds;
    this.plusSkills = plusSkills;
    if (this.visible && dirty) this.render();
  }

  // UIScene routes Q/E/F here first while a bind is pending
  tryBind(key: SkillKey): boolean {
    if (!this.bindPending) return false;
    this.actions.bind(this.bindPending, key);
    this.bindPending = null;
    if (this.visible) this.render();
    return true;
  }

  containsPoint(x: number, y: number): boolean {
    return this.visible && x >= 10 && x <= 10 + SKILL_W && y >= 50 && y <= 50 + this.panelH;
  }

  private keyFor(id: string): SkillKey | null {
    for (const k of SKILL_KEYS) if (this.binds[k] === id) return k;
    return null;
  }

  private showTooltip(node: SkillNode, atX: number, atY: number) {
    this.tooltip.removeAll(true);
    const rank = this.skills[node.id] ?? 0;
    const bonus = rank > 0 ? this.plusSkills : 0; // +skills only shows on skills you've learned
    const texts: Phaser.GameObjects.Text[] = [];
    let y = 8;
    const title = `${node.name}  ${rank}/${node.maxRank}${bonus ? `  +${bonus}` : ""}`;
    texts.push(
      this.scene.add.text(10, y, title, {
        fontFamily: "monospace", fontSize: "15px", fontStyle: "bold",
        color: node.type === "ultimate" ? "#ff8033" : node.type === "passive" ? "#9fdc9f" : "#e8d8a8",
      })
    );
    y += 21;
    const tier = Math.min(node.tier, TIER_LEVELS.length - 1);
    texts.push(
      this.scene.add.text(10, y, `${node.type} · ${node.tree} tier ${node.tier} (level ${TIER_LEVELS[tier]}+)`, {
        fontFamily: "monospace", fontSize: "12px", color: "#8a8a96",
      })
    );
    y += 17;
    const desc = this.scene.add.text(10, y, node.desc, {
      fontFamily: "monospace", fontSize: "13px", color: "#c9c9d4", fontStyle: "italic", wordWrap: { width: 300 },
    });
    texts.push(desc);
    y += desc.height + 5;

    if (node.passive) {
      for (const [k, v] of Object.entries(node.passive)) {
        const label = STAT_LABELS[k as keyof ItemStats] ?? k;
        texts.push(
          this.scene.add.text(10, y, `+${v} ${label} per rank${rank > 0 ? `  (now +${(v as number) * rank})` : ""}`, {
            fontFamily: "monospace", fontSize: "12px", color: "#9fdc9f",
          })
        );
        y += 15;
      }
    }
    if (node.baseMult !== undefined && this.cls) {
      // actives show their +skills-boosted damage; passives (above) stay on hard ranks
      const eff = effectiveSkills(this.skills, this.plusSkills);
      const nowPct = rank > 0 ? Math.round(skillDamageMult(node, eff) * 100) : 0;
      const nextSkills = { ...eff, [node.id]: Math.min(node.maxRank + this.plusSkills, rank + 1 + bonus) };
      const nextPct = Math.round(skillDamageMult(node, nextSkills) * 100);
      texts.push(
        this.scene.add.text(10, y, rank > 0 ? `deals ${nowPct}% weapon damage (next: ${nextPct}%)` : `deals ${nextPct}% weapon damage at rank 1`, {
          fontFamily: "monospace", fontSize: "12px", color: "#e0b070",
        })
      );
      y += 15;
    }
    if (node.synergy) {
      const from = SKILL_TREES[this.cls as ClassName]?.find((n) => n.id === node.synergy!.from);
      texts.push(
        this.scene.add.text(10, y, `synergy: +${node.synergy.pct}% damage per point in ${from?.name ?? node.synergy.from}`, {
          fontFamily: "monospace", fontSize: "12px", color: "#6a8cff", wordWrap: { width: 300 },
        })
      );
      y += texts[texts.length - 1].height + 1;
    }
    if (node.mana) {
      texts.push(
        this.scene.add.text(10, y, `${node.mana} mana · ${(node.cooldownMs ?? 0) / 1000}s cooldown`, {
          fontFamily: "monospace", fontSize: "12px", color: "#5a8cd8",
        })
      );
      y += 15;
    }
    if (node.req) {
      const req = SKILL_TREES[this.cls as ClassName]?.find((n) => n.id === node.req);
      const met = (this.skills[node.req] ?? 0) > 0;
      texts.push(
        this.scene.add.text(10, y, `requires: ${req?.name ?? node.req}`, {
          fontFamily: "monospace", fontSize: "12px", color: met ? "#6a6a76" : "#e05050",
        })
      );
      y += 15;
    }
    y += 4;
    const canAlloc = this.cls && canAllocSkill(node, this.skills, this.level, this.points);
    const hint =
      node.type === "passive"
        ? canAlloc ? "click: learn" : ""
        : rank > 0
          ? `${canAlloc ? "click: rank up · " : ""}right-click: bind to Q/E/F`
          : canAlloc ? "click: learn (auto-binds)" : "";
    if (hint) {
      texts.push(this.scene.add.text(10, y, hint, { fontFamily: "monospace", fontSize: "12px", color: "#6a6a76" }));
      y += 16;
    }
    y += 6;

    const w = Math.max(170, ...texts.map((t) => t.width + 20));
    const bg = this.scene.add.rectangle(0, 0, w, y, 0x120f1a, 0.97).setOrigin(0).setStrokeStyle(2, 0x54402a);
    const goldEdge = this.scene.add.rectangle(2, 2, w - 4, y - 4, 0x000000, 0).setOrigin(0).setStrokeStyle(1, 0xd8b13a, 0.25);
    this.tooltip.add([bg, goldEdge, ...texts]);
    const tx = Math.min(atX, this.scene.scale.width - w - 8);
    const ty = Math.min(atY, this.scene.scale.height - y - 8);
    this.tooltip.setPosition(tx, ty).setVisible(true);
  }

  private render() {
    this.root.removeAll(true);
    this.tooltip.setVisible(false);
    if (!this.cls) return;
    const nodes = SKILL_TREES[this.cls as ClassName] ?? [];
    const trees = [...new Set(nodes.map((n) => n.tree))];
    const maxTier = Math.max(...nodes.map((n) => n.tier));

    const colW = (SKILL_W - 24) / trees.length;
    const top = 66;
    const rowH = NODE + 34;
    this.panelH = top + maxTier * rowH + 8;
    panelChrome(this.scene, this.root, SKILL_W, this.panelH);
    this.root.setPosition(10, 50);

    this.root.add(
      this.scene.add.text(12, 10, "SKILLS", { fontFamily: "monospace", fontSize: "16px", color: "#e8d8a8", fontStyle: "bold" })
    );
    this.root.add(
      this.scene.add.text(SKILL_W - 12, 12, "[S] close", { fontFamily: "monospace", fontSize: "12px", color: "#6a6a76" }).setOrigin(1, 0)
    );
    // free respec — experiment freely; two-click confirm guards the misclick
    const respecBtn = this.scene.add
      .text(SKILL_W - 12, 44, this.respecArmed ? "click again to confirm" : "↺ respec (free)", {
        fontFamily: "monospace", fontSize: "12px", fontStyle: "bold",
        color: this.respecArmed ? "#ffd54a" : "#d89090",
        backgroundColor: this.respecArmed ? "#4a2a10cc" : "#2a1418aa", padding: { x: 5, y: 2 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    respecBtn.on("pointerdown", () => {
      if (this.respecArmed) {
        this.respecArmed = false;
        this.actions.respec();
      } else {
        this.respecArmed = true;
        this.render();
      }
    });
    this.root.add(respecBtn);
    this.root.add(
      this.scene.add.text(12, 28, this.points > 0 ? `${this.points} skill point${this.points > 1 ? "s" : ""} to spend` : "no points to spend", {
        fontFamily: "monospace", fontSize: "13px", color: this.points > 0 ? "#ffd54a" : "#6a6a76", fontStyle: this.points > 0 ? "bold" : "normal",
      })
    );
    if (this.bindPending) {
      const node = nodes.find((n) => n.id === this.bindPending);
      this.root.add(
        this.scene.add.text(SKILL_W - 12, 28, `press Q/E/F to bind ${node?.name ?? ""}`, {
          fontFamily: "monospace", fontSize: "12px", color: "#ffd54a", fontStyle: "bold",
        }).setOrigin(1, 0)
      );
    }

    trees.forEach((tree, ti) => {
      const cx = 12 + ti * colW;
      this.root.add(
        this.scene.add.text(cx + colW / 2 - 6, 48, tree.toUpperCase(), {
          fontFamily: "monospace", fontSize: "12px", color: "#8a8a96", fontStyle: "bold",
        }).setOrigin(0.5, 0)
      );

      const colNodes = nodes.filter((n) => n.tree === tree);
      // group nodes of the same tier side by side
      const byTier = new Map<number, SkillNode[]>();
      for (const n of colNodes) {
        byTier.set(n.tier, [...(byTier.get(n.tier) ?? []), n]);
      }

      byTier.forEach((tierNodes, tier) => {
        tierNodes.forEach((node, i) => {
          const perRow = tierNodes.length;
          const x = cx + (colW - 12) / 2 - (perRow * (NODE + 8) - 8) / 2 + i * (NODE + 8);
          const y = top + (tier - 1) * rowH;
          this.drawNode(node, x, y);
        });
      });
    });
  }

  private drawNode(node: SkillNode, x: number, y: number) {
    const rank = this.skills[node.id] ?? 0;
    const canAlloc = canAllocSkill(node, this.skills, this.level, this.points);
    const maxed = rank >= node.maxRank;
    const locked = rank === 0 && !canAlloc;

    const strokeColor = maxed
      ? 0xd8b13a
      : canAlloc
        ? 0x40c060
        : rank > 0
          ? 0x8a7a5a
          : 0x342a44;
    const fillColor = node.type === "ultimate" ? 0x241016 : 0x171226;
    const bg = this.scene.add
      .rectangle(x, y, NODE, NODE, fillColor, locked ? 0.6 : 0.95)
      .setOrigin(0)
      .setStrokeStyle(canAlloc && !maxed ? 2 : 1.5, strokeColor, locked ? 0.5 : 1);
    this.root.add(bg);

    // simple glyph: initial letters, ultimates get a flame mark
    const glyph = this.scene.add
      .text(x + NODE / 2, y + NODE / 2 - 4, node.type === "ultimate" ? "☠" : node.name.slice(0, 2).toUpperCase(), {
        fontFamily: "monospace", fontSize: node.type === "ultimate" ? "18px" : "14px", fontStyle: "bold",
        color: locked ? "#4a4a56" : node.type === "ultimate" ? "#ff8033" : node.type === "passive" ? "#9fdc9f" : "#e8d8a8",
      })
      .setOrigin(0.5);
    this.root.add(glyph);

    this.root.add(
      this.scene.add.text(x + NODE - 3, y + NODE - 3, `${rank}/${node.maxRank}`, {
        fontFamily: "monospace", fontSize: "11px", color: maxed ? "#ffd54a" : rank > 0 ? "#c9c9d4" : "#5a5a66",
      }).setOrigin(1, 1)
    );

    const key = this.keyFor(node.id);
    if (key) {
      this.root.add(
        this.scene.add
          .rectangle(x - 4, y - 4, 14, 14, 0x2a2416, 1).setOrigin(0).setStrokeStyle(1, 0xffd54a, 0.9)
      );
      this.root.add(
        this.scene.add.text(x + 3, y + 3, key, { fontFamily: "monospace", fontSize: "12px", color: "#ffd54a", fontStyle: "bold" }).setOrigin(0.5)
      );
    }
    if (this.bindPending === node.id) {
      this.root.add(
        this.scene.add.rectangle(x - 2, y - 2, NODE + 4, NODE + 4, 0x000000, 0).setOrigin(0).setStrokeStyle(2, 0xffd54a, 1)
      );
    }

    this.root.add(
      this.scene.add.text(x + NODE / 2, y + NODE + 3, node.name, {
        fontFamily: "monospace", fontSize: "10px", color: locked ? "#4a4a56" : "#8a8a96", align: "center", wordWrap: { width: NODE + 26 },
      }).setOrigin(0.5, 0)
    );

    bg.setInteractive({ useHandCursor: canAlloc || rank > 0 });
    bg.on("pointerover", () => {
      bg.setFillStyle(0x251d33, 0.95);
      const m = this.root.getWorldTransformMatrix();
      this.showTooltip(node, m.tx + x + NODE + 10, m.ty + y);
    });
    bg.on("pointerout", () => {
      bg.setFillStyle(fillColor, locked ? 0.6 : 0.95);
      this.tooltip.setVisible(false);
    });
    bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        if (node.type !== "passive" && rank > 0) {
          this.bindPending = this.bindPending === node.id ? null : node.id;
          this.render();
        }
        return;
      }
      if (canAlloc) {
        this.tooltip.setVisible(false);
        this.actions.alloc(node.id);
      }
    });
  }
}
