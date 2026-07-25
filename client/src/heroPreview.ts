import Phaser from "phaser";
import { RARITY_ORDER, RARITY_COLORS } from "@hollowmark/common";
import { ensureItemIcons } from "./icons";

// A hero PORTRAIT for the pre-game DOM screens (New Character, the Roster). Those screens
// render before the real game exists, so we can't reuse its live sprite — instead a tiny
// hidden Phaser instance rebuilds the exact figure + gear (reusing the real item icons)
// and snapshots it to a PNG data URL the DOM can drop into an <img>. Faithful, and it never
// touches the live in-game renderer.

export interface HeroLook {
  cls: string;
  weaponBase?: string;
  offhandBase?: string;
  helmBase?: string;
  chestBase?: string; // robe | leather | studded | chainmail | plate
  bootsBase?: string; // boots | greaves
  beltBase?: string; // sash | warbelt | girdle
  gearTier?: number; // 0..6 — drives the rarity aura and the cloak
}

// mirrors GameScene's CLASS_BODY / CLASS_COLORS so the portrait reads as the same hero
const CLASS_BODY: Record<string, { torso: number; hair: number; material: string; hooded?: boolean }> = {
  barbarian: { torso: 0xc98a5a, hair: 0x6b3a24, material: "skin" },
  rogue: { torso: 0x40502f, hair: 0x1e4a2a, material: "leather", hooded: true },
  sorcerer: { torso: 0x2b3c66, hair: 0x2a2a4a, material: "robe" },
  paladin: { torso: 0xa89a72, hair: 0xd8c890, material: "cloth" },
  necromancer: { torso: 0x1e1d26, hair: 0x2a3a34, material: "robe", hooded: true },
  druid: { torso: 0x5a4326, hair: 0x4a3a1e, material: "fur" },
};
const CLASS_COLORS: Record<string, number> = {
  barbarian: 0xc0392b, rogue: 0x27ae60, sorcerer: 0x2f80c9,
  paladin: 0xc9a227, necromancer: 0x6a8f7a, druid: 0x9a6a3a,
};

const W = 128; // portrait canvas, in px
const H = 168;
const SCALE = 3.0; // figure units → portrait px
const FX = W / 2; // figure origin (feet, centered)
const FY = H - 26;

const dk = (c: number, p: number) => Phaser.Display.Color.IntegerToColor(c).darken(p).color;
const lt = (c: number, p: number) => Phaser.Display.Color.IntegerToColor(c).lighten(p).color;

class PreviewScene extends Phaser.Scene {
  private ready = false;
  private queue: Promise<unknown> = Promise.resolve();

  constructor() {
    super("preview");
  }

  create() {
    ensureItemIcons(this);
    this.ready = true;
  }

  // serialize renders — one figure on screen at a time. We add the figure, wait for the
  // very next frame to paint it (postrender), then read the canvas. Deterministic, and
  // unlike renderer.snapshot() it can't wedge after the first capture.
  render(look: HeroLook): Promise<string> {
    const run = () =>
      new Promise<string>((resolve) => {
        const tick = () => {
          if (!this.ready) { this.time.delayedCall(16, tick); return; }
          const fig = this.buildFigure(look);
          fig.setPosition(FX, FY).setScale(SCALE);
          this.game.events.once("postrender", () => {
            const url = (this.game.canvas as HTMLCanvasElement).toDataURL("image/png");
            fig.destroy();
            resolve(url);
          });
        };
        tick();
      });
    this.queue = this.queue.then(run, run);
    return this.queue as Promise<string>;
  }

  private buildFigure(look: HeroLook): Phaser.GameObjects.Container {
    const cb = CLASS_BODY[look.cls] ?? CLASS_BODY.paladin;
    const color = CLASS_COLORS[look.cls] ?? 0xaaaaaa;
    const fig = this.add.container(0, 0);

    const tier = look.gearTier ?? 0;
    // the decked-out rarity glow, beneath everything
    if (tier >= 3) {
      const gc = RARITY_COLORS[RARITY_ORDER[tier]] ?? 0xffffff;
      fig.add(this.add.ellipse(0, 1, 34, 16, gc, 0.22).setStrokeStyle(1.5, gc, 0.6));
    }

    // --- chest armour recolours the torso, arms and legs (or the bare class body) ---
    const CHEST: Record<string, { color: number; stroke: number; pauldrons?: boolean }> = {
      robe: { color: 0x4a3d6a, stroke: 0x2a2340 },
      leather: { color: 0x6a4a2c, stroke: 0x3d2a18 },
      studded: { color: 0x5a3f26, stroke: 0x33241a },
      chainmail: { color: 0x8a8f9a, stroke: 0xb8bcc8 },
      plate: { color: 0xb0b4c0, stroke: 0xd8dce4, pauldrons: true },
    };
    const chest = look.chestBase ? CHEST[look.chestBase] : undefined;
    const torsoColor = chest?.color ?? cb.torso;
    const armColor = dk(torsoColor, 20);
    const robe = cb.material === "robe";
    const torsoW = look.cls === "barbarian" ? 14 : look.cls === "paladin" ? 13 : 11;
    const torsoH = robe ? 17 : 12;
    const torsoY = robe ? -14 : -15;
    const top = torsoY - torsoH / 2, bot = torsoY + torsoH / 2;

    // legs (boots recolour them)
    const BOOTS: Record<string, number> = { boots: 0x5a4632, greaves: 0x9aa0ae };
    const legColor = (look.bootsBase && BOOTS[look.bootsBase]) || 0x39332b;
    const foot = dk(legColor, 30);
    const mkLeg = (x: number) => {
      fig.add(this.add.rectangle(x, -1, 3.5, 8, legColor).setOrigin(0.5, 1));
      fig.add(this.add.ellipse(x + 0.9, -1, 4.4, 2.6, foot).setStrokeStyle(1, 0x000000, 0.4));
    };
    mkLeg(-2.5); mkLeg(2.5);

    // cloak for the well-geared, behind the body
    if (tier >= 4) {
      const CAPE: Record<number, number> = { 4: 0x6a2a34, 5: 0x7a1e1e, 6: 0x4a2a6a };
      const cc = CAPE[tier] ?? 0x5a2a34;
      fig.add(this.add.triangle(0, top + 1, 0, 0, -torsoW * 0.7, torsoH + 6, torsoW * 0.7, torsoH + 6, cc)
        .setStrokeStyle(1, 0x000000, 0.5).setAlpha(0.92));
    }

    // back arm, torso
    const mkArm = (x: number) => fig.add(this.add.rectangle(x, -20, 3, 9, armColor).setOrigin(0.5, 0));
    mkArm(-torsoW / 2 - 1);
    fig.add(this.add.rectangle(0, torsoY, torsoW, torsoH, torsoColor).setStrokeStyle(1, chest?.stroke ?? 0x000000, chest ? 0.7 : 0.55));

    // bare-body class detail — only when no chest is worn
    if (!chest) {
      if (cb.material === "skin") {
        fig.add(this.add.ellipse(-torsoW * 0.24, torsoY - 3, 5, 3.5, dk(torsoColor, 32)).setAlpha(0.5));
        fig.add(this.add.ellipse(torsoW * 0.24, torsoY - 3, 5, 3.5, dk(torsoColor, 32)).setAlpha(0.5));
        fig.add(this.add.rectangle(0, bot - 1, torsoW + 2, 3.5, 0x6b5238).setStrokeStyle(1, 0x3a2c1c, 0.6));
        fig.add(this.add.rectangle(0, torsoY, 2.4, torsoH + 2, 0x5a3b22).setRotation(0.5).setAlpha(0.9));
      } else if (robe) {
        fig.add(this.add.rectangle(-torsoW * 0.24, torsoY + 2, 1, torsoH - 4, 0x000000).setAlpha(0.2));
        fig.add(this.add.rectangle(torsoW * 0.24, torsoY + 2, 1, torsoH - 4, 0x000000).setAlpha(0.2));
        fig.add(this.add.rectangle(0, bot - 0.5, torsoW, 2, 0x000000).setAlpha(0.25));
      } else if (cb.material === "fur") {
        fig.add(this.add.ellipse(0, top + 1, torsoW * 1.28, 5, 0x7a6a4e).setStrokeStyle(1, 0x4a3a26, 0.5));
      } else if (cb.material === "leather") {
        for (let r = 0; r < 2; r++) for (const sx of [-torsoW * 0.28, 0, torsoW * 0.28])
          fig.add(this.add.circle(sx, torsoY - 2 + r * 5, 0.7, 0xb7bec9).setAlpha(0.85));
      } else {
        fig.add(this.add.rectangle(-torsoW * 0.22, torsoY, 0.8, torsoH - 3, 0x000000).setAlpha(0.16));
        fig.add(this.add.rectangle(torsoW * 0.22, torsoY, 0.8, torsoH - 3, 0x000000).setAlpha(0.16));
      }
    } else {
      // worn-armour material detail
      const w = torsoW, h = torsoH, cy = torsoY, tp = top, bt = bot;
      const lite = lt(torsoColor, 28), drk = dk(torsoColor, 28), mat = look.chestBase;
      if (mat === "plate") {
        fig.add(this.add.rectangle(0, cy, 1.4, h - 2, lite).setAlpha(0.6));
        fig.add(this.add.ellipse(-w * 0.24, tp + 3.5, 5, 4, lite).setAlpha(0.35));
        fig.add(this.add.ellipse(w * 0.24, tp + 3.5, 5, 4, drk).setAlpha(0.3));
        for (const rx of [-w * 0.34, w * 0.34]) for (const ry of [tp + 2.5, cy, bt - 2.5])
          fig.add(this.add.circle(rx, ry, 0.7, lite).setAlpha(0.8));
      } else if (mat === "chainmail") {
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++)
          fig.add(this.add.circle(-w * 0.3 + c * (w * 0.2) + (r % 2) * (w * 0.1), tp + 2 + r * (h / 5), 0.6, drk).setAlpha(0.55));
      } else if (mat === "studded") {
        for (let r = 0; r < 3; r++) for (const sx of [-w * 0.28, 0, w * 0.28])
          fig.add(this.add.circle(sx, tp + 3 + r * (h / 4), 0.8, 0xc0c6d0).setAlpha(0.85));
      } else if (mat === "leather") {
        fig.add(this.add.rectangle(-w * 0.32, cy, 0.7, h - 3, drk).setAlpha(0.5));
        fig.add(this.add.rectangle(w * 0.32, cy, 0.7, h - 3, drk).setAlpha(0.5));
      } else if (mat === "robe") {
        fig.add(this.add.rectangle(0, tp + 1.5, w - 2, 1.4, lite).setAlpha(0.5));
        fig.add(this.add.rectangle(0, cy, 0.8, h - 3, 0x000000).setAlpha(0.22));
        fig.add(this.add.rectangle(0, bt - 0.5, w, 1.6, 0x000000).setAlpha(0.25));
      }
    }

    // volume shading + the class accent sash
    fig.add(this.add.rectangle(-torsoW * 0.28, torsoY + 0.5, torsoW * 0.3, torsoH - 3, 0xffffff).setAlpha(0.12));
    fig.add(this.add.rectangle(torsoW * 0.3, torsoY + 1, torsoW * 0.32, torsoH - 2, 0x000000).setAlpha(0.18));
    fig.add(this.add.rectangle(0, top + 1, torsoW - 1, 2, 0x000000).setAlpha(0.26));
    fig.add(this.add.rectangle(0, torsoY, torsoW, 2.4, color).setRotation(0.5).setAlpha(0.9));

    // pauldrons for plate
    if (chest?.pauldrons) {
      const y = top + 1;
      fig.add(this.add.rectangle(-torsoW / 2 - 1, y, 5, 4, 0xd0d4dc).setStrokeStyle(1, 0x6a6e78));
      fig.add(this.add.rectangle(torsoW / 2 + 1, y, 5, 4, 0xd0d4dc).setStrokeStyle(1, 0x6a6e78));
    }

    // neck, shoulders, head
    fig.add(this.add.rectangle(0, -20.5, 4, 3, 0xc79a70));
    fig.add(this.add.ellipse(-torsoW / 2 + 0.5, top + 1, 5, 4.4, dk(torsoColor, 12)).setStrokeStyle(1, 0x000000, 0.4));
    fig.add(this.add.ellipse(torsoW / 2 - 0.5, top + 1, 5, 4.4, dk(torsoColor, 12)).setStrokeStyle(1, 0x000000, 0.4));
    fig.add(this.add.circle(0, -25, 5, 0xd8b090).setStrokeStyle(1, 0x000000, 0.35));

    const hooded = !!cb.hooded;
    if (hooded) {
      fig.add(this.add.ellipse(0, -24.5, 7.2, 7.8, 0x000000).setAlpha(0.5));
      fig.add(this.add.circle(-1.4, -25, 0.7, 0x9aa0b0));
      fig.add(this.add.circle(1.4, -25, 0.7, 0x9aa0b0));
    } else {
      fig.add(this.add.rectangle(0, -26.3, 7, 1.4, 0x000000).setAlpha(0.28));
      fig.add(this.add.circle(-1.6, -25, 0.8, 0x2a2018));
      fig.add(this.add.circle(1.6, -25, 0.8, 0x2a2018));
      fig.add(this.add.rectangle(0, -23.6, 2.4, 1, 0xb07a52).setAlpha(0.5));
    }

    // hair / hood — hidden by a helm
    const helm = look.helmBase;
    const wearingHelm = !!helm;
    if (!wearingHelm) {
      if (hooded) {
        fig.add(this.add.triangle(0, -28, 0, 6, 5.5, -3.5, -5.5, -3.5, cb.hair));
        fig.add(this.add.triangle(0, -28, 0, 3, 3, -4, -3, -4, dk(cb.hair, 30)));
      } else {
        fig.add(this.add.ellipse(0, -28.5, 10.4, 6.8, cb.hair));
        fig.add(this.add.rectangle(-4.4, -26, 1.8, 3.5, cb.hair));
        fig.add(this.add.rectangle(4.4, -26, 1.8, 3.5, cb.hair));
        fig.add(this.add.ellipse(-1.6, -29.6, 5, 3, lt(cb.hair, 28)).setAlpha(0.55));
      }
    }

    // belt
    const BELT: Record<string, number> = { sash: 0x7a2a34, warbelt: 0x54402a, girdle: 0x8a8f9a };
    if (look.beltBase && BELT[look.beltBase] !== undefined) {
      fig.add(this.add.rectangle(0, bot - 2, torsoW + 1, 2.5, BELT[look.beltBase]));
      fig.add(this.add.rectangle(0, bot - 2, 3, 3, 0xd8b13a));
    }

    // offhand, then weapon in the front hand
    if (look.offhandBase && this.textures.exists(`icon_${look.offhandBase}`))
      fig.add(this.add.image(-8, -14, `icon_${look.offhandBase}`).setScale(0.5));
    if (look.weaponBase && this.textures.exists(`icon_${look.weaponBase}`)) {
      const WEAPON_SCALE: Record<string, number> = {
        dagger: 0.5, wand: 0.52, club: 0.55, shortsword: 0.56, scepter: 0.58,
        bow: 0.62, waraxe: 0.64, morningstar: 0.64,
        warstaff: 0.74, maul: 0.76, greatsword: 0.78, scythe: 0.78, greataxe: 0.8,
      };
      fig.add(this.add.image(9, -13, `icon_${look.weaponBase}`)
        .setOrigin(0.5, 0.72).setScale(WEAPON_SCALE[look.weaponBase] ?? 0.6).setRotation(-0.7));
    }

    // helm over the head, with a readable silhouette
    if (wearingHelm && this.textures.exists(`icon_${helm}`)) {
      fig.add(this.add.image(0, -27, `icon_${helm}`).setScale(0.48));
      if (helm === "crown" || helm === "circlet") {
        fig.add(this.add.rectangle(0, -32, helm === "crown" ? 10 : 8, 1.8, 0xd8b13a));
        fig.add(this.add.circle(0, -32, 1.3, helm === "crown" ? 0xb04858 : 0x8ad0ff));
      } else if (helm === "greathelm") {
        fig.add(this.add.triangle(-5, -31, 0, 5, -3, -5, 2, 1, 0xd8d4c0));
        fig.add(this.add.triangle(5, -31, 0, 5, 3, -5, -2, 1, 0xd8d4c0));
      }
    }

    // front arm, over the body
    mkArm(torsoW / 2 + 1);
    return fig;
  }
}

let game: Phaser.Game | null = null;
let sceneReady: Promise<PreviewScene> | null = null;
const cache = new Map<string, string>();

function lookSig(l: HeroLook): string {
  return [l.cls, l.weaponBase, l.offhandBase, l.helmBase, l.chestBase, l.bootsBase, l.beltBase, l.gearTier ?? 0].join("|");
}

function ensureScene(): Promise<PreviewScene> {
  if (sceneReady) return sceneReady;
  sceneReady = new Promise((resolve) => {
    const scene = new PreviewScene();
    const holder = document.createElement("div");
    holder.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;";
    document.body.appendChild(holder);
    game = new Phaser.Game({
      type: Phaser.CANVAS, // predictable transparent snapshots
      parent: holder,
      width: W,
      height: H,
      transparent: true,
      scene,
      audio: { noAudio: true },
      banner: false,
    });
    game.events.once("ready", () => {
      // wait until create() has run and icons are generated
      const wait = () => (scene.scene.settings.status === Phaser.Scenes.RUNNING ? resolve(scene) : setTimeout(wait, 16));
      wait();
    });
  });
  return sceneReady;
}

// Render a hero portrait to a PNG data URL. Cached by look — repeat calls are free.
export async function heroPortrait(look: HeroLook): Promise<string> {
  const key = lookSig(look);
  const hit = cache.get(key);
  if (hit) return hit;
  const scene = await ensureScene();
  const url = await scene.render(look);
  cache.set(key, url);
  return url;
}
