import Phaser from "phaser";
import { RARITY_ORDER, RARITY_COLORS } from "@hollowmark/common";
import { ensureItemIcons } from "./icons";

// The hero as the pre-game DOM screens show them. Two renderers, one figure:
//
//   heroPortrait()   — a small static PNG data URL for roster/class list thumbnails.
//   createHeroStage() — the LIVE stage: a big, idling, turnable hero on a lit dais,
//                       mounted straight into the DOM. This is the front-and-centre one.
//
// Both build the same figure from buildFigure(), which mirrors GameScene's construction
// (limbs are containers pivoting at hip/shoulder) so the hero you pick is the hero you play.

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
export const CLASS_ACCENT: Record<string, number> = {
  barbarian: 0xc0392b, rogue: 0x27ae60, sorcerer: 0x2f80c9,
  paladin: 0xc9a227, necromancer: 0x6a8f7a, druid: 0x9a6a3a,
};

const dk = (c: number, p: number) => Phaser.Display.Color.IntegerToColor(c).darken(p).color;
const lt = (c: number, p: number) => Phaser.Display.Color.IntegerToColor(c).lighten(p).color;

// --- the figure, in figure units with the feet at y = 0 ---

interface FigureParts {
  fig: Phaser.GameObjects.Container;
  torso: Phaser.GameObjects.Rectangle;
  head: Phaser.GameObjects.Container; // head + face + hair + helm, so it can bob as one
  armB: Phaser.GameObjects.Container;
  armF: Phaser.GameObjects.Container;
  legL: Phaser.GameObjects.Container;
  legR: Phaser.GameObjects.Container;
  cape?: Phaser.GameObjects.Triangle;
  weapon?: Phaser.GameObjects.Image;
  offhand?: Phaser.GameObjects.Image;
  helm?: Phaser.GameObjects.Image;
  helmFlair: Phaser.GameObjects.GameObject[];
  accent: number;
  tier: number;
  crown: number; // y of the top of the head, for framing
}

// `iconRes` must match whatever was passed to ensureItemIcons in this scene — the item
// sprites are baked that much larger, so their scales divide back down by it.
function buildFigure(scene: Phaser.Scene, look: HeroLook, iconRes = 1): FigureParts {
  const cb = CLASS_BODY[look.cls] ?? CLASS_BODY.paladin;
  const accent = CLASS_ACCENT[look.cls] ?? 0xaaaaaa;
  const fig = scene.add.container(0, 0);
  const tier = look.gearTier ?? 0;

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
  const handColor = dk(torsoColor, 6);
  const robe = cb.material === "robe";
  const torsoW = look.cls === "barbarian" ? 14 : look.cls === "paladin" ? 13 : 11;
  const torsoH = robe ? 17 : 12;
  const torsoY = robe ? -14 : -15;
  const top = torsoY - torsoH / 2, bot = torsoY + torsoH / 2;

  // legs — a container per leg pivoting at the hip, so the foot swings with the shin
  const BOOTS: Record<string, number> = { boots: 0x5a4632, greaves: 0x9aa0ae };
  const legColor = (look.bootsBase && BOOTS[look.bootsBase]) || 0x39332b;
  const footColor = dk(legColor, 30);
  const mkLeg = (x: number) => {
    const c = scene.add.container(x, -9);
    c.add(scene.add.rectangle(0, 0, 3.5, 8, legColor).setOrigin(0.5, 0));
    c.add(scene.add.ellipse(0.9, 8, 4.4, 2.6, footColor).setStrokeStyle(1, 0x000000, 0.4));
    return c;
  };
  // cloak for the well-geared — FIRST, so it hangs behind the legs rather than over them
  let cape: Phaser.GameObjects.Triangle | undefined;
  if (tier >= 4) {
    const CAPE: Record<number, number> = { 4: 0x6a2a34, 5: 0x7a1e1e, 6: 0x4a2a6a };
    // NOTE: a Phaser Triangle draws each point at (px − width/2, py − height/2), so the
    // points must start at x=0,y=0 or the shape lands half its own width off-centre. The
    // placement below is therefore the CENTRE of the cape, not its apex.
    const capeH = torsoH + 6;
    cape = scene.add.triangle(0, top + 1 + capeH / 2, torsoW * 0.7, 0, 0, capeH, torsoW * 1.4, capeH, CAPE[tier] ?? 0x5a2a34)
      .setStrokeStyle(1, 0x000000, 0.5).setAlpha(0.92);
    fig.add(cape);
  }

  const legL = mkLeg(-2.5), legR = mkLeg(2.5);
  fig.add([legL, legR]);

  const mkArm = (x: number) => {
    const c = scene.add.container(x, -20);
    c.add(scene.add.rectangle(0, 0, 3, 9, armColor).setOrigin(0.5, 0));
    c.add(scene.add.ellipse(0, 9.4, 2.8, 2.8, handColor).setStrokeStyle(1, 0x000000, 0.3));
    return c;
  };
  const armB = mkArm(-torsoW / 2 - 1);
  fig.add(armB);

  const torso = scene.add.rectangle(0, torsoY, torsoW, torsoH, torsoColor)
    .setStrokeStyle(1, chest?.stroke ?? 0x000000, chest ? 0.7 : 0.55);
  fig.add(torso);

  // bare-body class detail — only when no chest is worn
  if (!chest) {
    if (cb.material === "skin") {
      fig.add(scene.add.ellipse(-torsoW * 0.24, torsoY - 3, 5, 3.5, dk(torsoColor, 32)).setAlpha(0.5));
      fig.add(scene.add.ellipse(torsoW * 0.24, torsoY - 3, 5, 3.5, dk(torsoColor, 32)).setAlpha(0.5));
      fig.add(scene.add.rectangle(0, bot - 1, torsoW + 2, 3.5, 0x6b5238).setStrokeStyle(1, 0x3a2c1c, 0.6));
      fig.add(scene.add.rectangle(0, torsoY, 2.4, torsoH + 2, 0x5a3b22).setRotation(0.5).setAlpha(0.9));
    } else if (robe) {
      fig.add(scene.add.rectangle(-torsoW * 0.24, torsoY + 2, 1, torsoH - 4, 0x000000).setAlpha(0.2));
      fig.add(scene.add.rectangle(torsoW * 0.24, torsoY + 2, 1, torsoH - 4, 0x000000).setAlpha(0.2));
      fig.add(scene.add.rectangle(0, bot - 0.5, torsoW, 2, 0x000000).setAlpha(0.25));
    } else if (cb.material === "fur") {
      fig.add(scene.add.ellipse(0, top + 1, torsoW * 1.28, 5, 0x7a6a4e).setStrokeStyle(1, 0x4a3a26, 0.5));
    } else if (cb.material === "leather") {
      for (let r = 0; r < 2; r++) for (const sx of [-torsoW * 0.28, 0, torsoW * 0.28])
        fig.add(scene.add.circle(sx, torsoY - 2 + r * 5, 0.7, 0xb7bec9).setAlpha(0.85));
    } else {
      fig.add(scene.add.rectangle(-torsoW * 0.22, torsoY, 0.8, torsoH - 3, 0x000000).setAlpha(0.16));
      fig.add(scene.add.rectangle(torsoW * 0.22, torsoY, 0.8, torsoH - 3, 0x000000).setAlpha(0.16));
    }
  } else {
    // worn-armour material detail
    const w = torsoW, h = torsoH, cy = torsoY, tp = top, bt = bot;
    const lite = lt(torsoColor, 28), drk = dk(torsoColor, 28), mat = look.chestBase;
    if (mat === "plate") {
      fig.add(scene.add.rectangle(0, cy, 1.4, h - 2, lite).setAlpha(0.6));
      fig.add(scene.add.ellipse(-w * 0.24, tp + 3.5, 5, 4, lite).setAlpha(0.35));
      fig.add(scene.add.ellipse(w * 0.24, tp + 3.5, 5, 4, drk).setAlpha(0.3));
      for (const rx of [-w * 0.34, w * 0.34]) for (const ry of [tp + 2.5, cy, bt - 2.5])
        fig.add(scene.add.circle(rx, ry, 0.7, lite).setAlpha(0.8));
    } else if (mat === "chainmail") {
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++)
        fig.add(scene.add.circle(-w * 0.3 + c * (w * 0.2) + (r % 2) * (w * 0.1), tp + 2 + r * (h / 5), 0.6, drk).setAlpha(0.55));
    } else if (mat === "studded") {
      for (let r = 0; r < 3; r++) for (const sx of [-w * 0.28, 0, w * 0.28])
        fig.add(scene.add.circle(sx, tp + 3 + r * (h / 4), 0.8, 0xc0c6d0).setAlpha(0.85));
    } else if (mat === "leather") {
      fig.add(scene.add.rectangle(-w * 0.32, cy, 0.7, h - 3, drk).setAlpha(0.5));
      fig.add(scene.add.rectangle(w * 0.32, cy, 0.7, h - 3, drk).setAlpha(0.5));
    } else if (mat === "robe") {
      fig.add(scene.add.rectangle(0, tp + 1.5, w - 2, 1.4, lite).setAlpha(0.5));
      fig.add(scene.add.rectangle(0, cy, 0.8, h - 3, 0x000000).setAlpha(0.22));
      fig.add(scene.add.rectangle(0, bt - 0.5, w, 1.6, 0x000000).setAlpha(0.25));
    }
  }

  // volume shading + the class accent sash
  fig.add(scene.add.rectangle(-torsoW * 0.28, torsoY + 0.5, torsoW * 0.3, torsoH - 3, 0xffffff).setAlpha(0.12));
  fig.add(scene.add.rectangle(torsoW * 0.3, torsoY + 1, torsoW * 0.32, torsoH - 2, 0x000000).setAlpha(0.18));
  fig.add(scene.add.rectangle(0, top + 1, torsoW - 1, 2, 0x000000).setAlpha(0.26));
  fig.add(scene.add.rectangle(0, torsoY, torsoW, 2.4, accent).setRotation(0.5).setAlpha(0.9));

  if (chest?.pauldrons) {
    const y = top + 1;
    fig.add(scene.add.rectangle(-torsoW / 2 - 1, y, 5, 4, 0xd0d4dc).setStrokeStyle(1, 0x6a6e78));
    fig.add(scene.add.rectangle(torsoW / 2 + 1, y, 5, 4, 0xd0d4dc).setStrokeStyle(1, 0x6a6e78));
  }

  // neck + shoulder caps round the silhouette
  fig.add(scene.add.rectangle(0, -20.5, 4, 3, 0xc79a70));
  fig.add(scene.add.ellipse(-torsoW / 2 + 0.5, top + 1, 5, 4.4, dk(torsoColor, 12)).setStrokeStyle(1, 0x000000, 0.4));
  fig.add(scene.add.ellipse(torsoW / 2 - 0.5, top + 1, 5, 4.4, dk(torsoColor, 12)).setStrokeStyle(1, 0x000000, 0.4));

  // --- the head, in its own container at (0,-25) so a breath can bob the whole thing ---
  const head = scene.add.container(0, -25);
  head.add(scene.add.circle(0, 0, 5, 0xd8b090).setStrokeStyle(1, 0x000000, 0.35));
  const hooded = !!cb.hooded;
  if (hooded) {
    head.add(scene.add.ellipse(0, 0.5, 7.2, 7.8, 0x000000).setAlpha(0.5));
    head.add(scene.add.circle(-1.4, 0, 0.7, 0x9aa0b0));
    head.add(scene.add.circle(1.4, 0, 0.7, 0x9aa0b0));
  } else {
    head.add(scene.add.rectangle(0, -1.3, 7, 1.4, 0x000000).setAlpha(0.28));
    head.add(scene.add.circle(-1.6, 0, 0.8, 0x2a2018));
    head.add(scene.add.circle(1.6, 0, 0.8, 0x2a2018));
    head.add(scene.add.rectangle(0, 1.4, 2.4, 1, 0xb07a52).setAlpha(0.5));
  }

  const helm = look.helmBase;
  if (!helm) {
    if (hooded) {
      // a cowl PEAKED ABOVE the brow — zero-based points, placed at the hood's centre (see
      // the cape note above). The old form pointed down into the face, which reads as a
      // hood at 34px and as a dunce cap at 300.
      head.add(scene.add.triangle(0, -4.9, 5.5, 0, 0, 7.6, 11, 7.6, cb.hair));
      head.add(scene.add.triangle(0, -4.2, 3, 0, 0, 4.4, 6, 4.4, dk(cb.hair, 30)));
    } else {
      head.add(scene.add.ellipse(0, -3.5, 10.4, 6.8, cb.hair));
      head.add(scene.add.rectangle(-4.4, -1, 1.8, 3.5, cb.hair));
      head.add(scene.add.rectangle(4.4, -1, 1.8, 3.5, cb.hair));
      head.add(scene.add.ellipse(-1.6, -4.6, 5, 3, lt(cb.hair, 28)).setAlpha(0.55));
    }
  }
  fig.add(head);

  // belt
  const BELT: Record<string, number> = { sash: 0x7a2a34, warbelt: 0x54402a, girdle: 0x8a8f9a };
  if (look.beltBase && BELT[look.beltBase] !== undefined) {
    fig.add(scene.add.rectangle(0, bot - 2, torsoW + 1, 2.5, BELT[look.beltBase]));
    fig.add(scene.add.rectangle(0, bot - 2, 3, 3, 0xd8b13a));
  }

  // offhand, then weapon in the front hand
  let offhand: Phaser.GameObjects.Image | undefined;
  if (look.offhandBase && scene.textures.exists(`icon_${look.offhandBase}`)) {
    offhand = scene.add.image(-8, -14, `icon_${look.offhandBase}`).setScale(0.5 / iconRes);
    fig.add(offhand);
  }
  let weapon: Phaser.GameObjects.Image | undefined;
  if (look.weaponBase && scene.textures.exists(`icon_${look.weaponBase}`)) {
    const WEAPON_SCALE: Record<string, number> = {
      dagger: 0.5, wand: 0.52, club: 0.55, shortsword: 0.56, scepter: 0.58,
      bow: 0.62, waraxe: 0.64, morningstar: 0.64,
      warstaff: 0.74, maul: 0.76, greatsword: 0.78, scythe: 0.78, greataxe: 0.8,
    };
    weapon = scene.add.image(9, -13, `icon_${look.weaponBase}`)
      .setOrigin(0.5, 0.72).setScale((WEAPON_SCALE[look.weaponBase] ?? 0.6) / iconRes).setRotation(-0.7);
    fig.add(weapon);
  }

  // helm over the head, with a readable silhouette
  let helmImg: Phaser.GameObjects.Image | undefined;
  // the flair exists so a helm is still readable on a 34px hero; up close it doubles the
  // crown, so the stage hides it — hence the handles
  const helmFlair: Phaser.GameObjects.GameObject[] = [];
  if (helm && scene.textures.exists(`icon_${helm}`)) {
    helmImg = scene.add.image(0, -2, `icon_${helm}`).setScale(0.48 / iconRes);
    head.add(helmImg);
    if (helm === "crown" || helm === "circlet") {
      helmFlair.push(
        scene.add.rectangle(0, -7, helm === "crown" ? 10 : 8, 1.8, 0xd8b13a),
        scene.add.circle(0, -7, 1.3, helm === "crown" ? 0xb04858 : 0x8ad0ff),
      );
    } else if (helm === "greathelm") {
      helmFlair.push(
        scene.add.triangle(-5.5, -6, 3, 10, 0, 0, 5, 6, 0xd8d4c0),
        scene.add.triangle(5.5, -6, 2, 10, 5, 0, 0, 6, 0xd8d4c0),
      );
    }
    for (const f of helmFlair) head.add(f);
  }

  // front arm, over the body
  const armF = mkArm(torsoW / 2 + 1);
  fig.add(armF);

  return { fig, torso, head, armB, armF, legL, legR, cape, weapon, offhand, helm: helmImg, helmFlair, accent, tier, crown: -33 };
}

// ============================================================================
// the small static portrait (roster rows, class list thumbnails)
// ============================================================================

const W = 128;
const H = 168;
const SCALE = 3.0;
const FX = W / 2;
const FY = H - 26;

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
          const { fig, tier } = buildFigure(this, look);
          if (tier >= 3) {
            const gc = RARITY_COLORS[RARITY_ORDER[tier]] ?? 0xffffff;
            fig.addAt(this.add.ellipse(0, 1, 34, 16, gc, 0.22).setStrokeStyle(1.5, gc, 0.6), 0);
          }
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
}

let sceneReady: Promise<PreviewScene> | null = null;
const cache = new Map<string, string>();

export function lookSig(l: HeroLook): string {
  return [l.cls, l.weaponBase, l.offhandBase, l.helmBase, l.chestBase, l.bootsBase, l.beltBase, l.gearTier ?? 0].join("|");
}

function ensureScene(): Promise<PreviewScene> {
  if (sceneReady) return sceneReady;
  sceneReady = new Promise((resolve) => {
    const scene = new PreviewScene();
    const holder = document.createElement("div");
    holder.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;";
    document.body.appendChild(holder);
    const game = new Phaser.Game({
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

// ============================================================================
// the LIVE stage — the hero front and centre, idling on a lit dais
// ============================================================================

const SS = 2; // internal supersample, so the vector figure stays crisp on retina
const ICON_RES = 6; // item icons baked 6× — the stage magnifies them ~16×, native 36px would smear
const RUNES =["ᚨ", "ᚱ", "ᚾ", "ᛞ", "ᛟ", "ᚦ", "ᛝ", "ᛥ", "ᛒ", "ᚹ", "ᛦ", "ᛘ"];

export interface HeroStage {
  /** Show a hero (or `null` to empty the dais). Rebuilds the figure. */
  setLook(look: HeroLook | null): void;
  /** Tear down the live renderer. Always call this when the screen closes. */
  destroy(): void;
  /** The canvas' DOM host, already sized and mounted. */
  el: HTMLDivElement;
}

class StageScene extends Phaser.Scene {
  private w = 0;
  private h = 0;
  private floorY = 0;
  private pivot!: Phaser.GameObjects.Container;
  private parts: FigureParts | null = null;
  private aura?: Phaser.GameObjects.Ellipse;
  private glow!: Phaser.GameObjects.Ellipse;
  private dais!: Phaser.GameObjects.Ellipse;
  private beam!: Phaser.GameObjects.Triangle;
  private shadow!: Phaser.GameObjects.Ellipse;
  private runes: Phaser.GameObjects.Text[] = [];
  private motes: Array<{ o: Phaser.GameObjects.Arc; vy: number; drift: number; phase: number }> = [];
  private turn = 0; // radians about the vertical axis — the drag-to-turn angle
  private spin = 0; // decaying angular velocity, so a flick keeps turning a moment
  private entered = 0; // timestamp of the last setLook, for the arrival flourish
  private figScale = 1;
  private pending: HeroLook | null = null;
  private ready = false;

  constructor(cfg: { w: number; h: number; scale: number }) {
    super("stage");
    this.w = cfg.w;
    this.h = cfg.h;
    this.figScale = cfg.scale;
  }

  create() {
    ensureItemIcons(this, ICON_RES);
    const cx = this.w / 2;
    this.floorY = this.h - 46 * SS;

    // a shaft of light falling on the dais — narrow at the top, wide at the feet. Three
    // nested wedges instead of one, because a single hard-edged triangle reads as a purple
    // shape rather than as light.
    const beamH = this.floorY + 10 * SS;
    for (const [spread, alpha] of [[0.46, 0.03], [0.3, 0.03], [0.15, 0.035]] as const) {
      const t = this.add.triangle(cx, beamH / 2, this.w * spread, 0, 0, beamH, this.w * spread * 2, beamH, 0xcdd6ee)
        .setAlpha(alpha);
      if (spread === 0.46) this.beam = t;
    }

    // the dais: a stone disc, a class-tinted pool of light on it, and the hero's shadow
    this.dais = this.add.ellipse(cx, this.floorY, this.w * 0.62, this.w * 0.2, 0x161320)
      .setStrokeStyle(2 * SS, 0x5f5866, 0.55);
    this.add.ellipse(cx, this.floorY, this.w * 0.52, this.w * 0.16, 0x0c0a12, 0.85);
    this.glow = this.add.ellipse(cx, this.floorY, this.w * 0.46, this.w * 0.15, 0xffffff, 0.14);
    this.shadow = this.add.ellipse(cx, this.floorY - 1, 46 * SS, 15 * SS, 0x000000, 0.45);

    // runes orbiting the dais in perspective — they read as a slowly turning ward circle
    for (let i = 0; i < RUNES.length; i++) {
      const t = this.add.text(cx, this.floorY, RUNES[i], {
        fontFamily: "monospace", fontSize: `${11 * SS}px`, color: "#9a93a2",
      }).setOrigin(0.5);
      this.runes.push(t);
    }

    // dust motes rising through the light
    for (let i = 0; i < 16; i++) {
      const o = this.add.circle(0, 0, (0.7 + Math.random() * 1.1) * SS, 0xcfc6d6, 0.35);
      this.motes.push({ o, vy: (6 + Math.random() * 12) * SS, drift: (Math.random() - 0.5) * 8 * SS, phase: Math.random() * 6.28 });
      this.resetMote(this.motes[i], true);
    }

    this.pivot = this.add.container(cx, this.floorY);

    // drag anywhere on the stage to turn the hero, the way you'd spin a model. The drag
    // state is tracked here rather than read off pointer.isDown, which can already have
    // been cleared by the time a fast move is processed.
    let dragging = false;
    this.input.on("pointerdown", () => { dragging = true; this.spin = 0; });
    this.input.on("pointerup", () => { dragging = false; });
    this.input.on("pointerupoutside", () => { dragging = false; });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!dragging) return;
      const dx = (p.x - p.prevPosition.x) / SS; // pointer coords are in the supersampled buffer
      this.turn += dx * 0.012;
      this.spin = dx * 0.005;
    });

    this.ready = true;
    if (this.pending) { const l = this.pending; this.pending = null; this.setLook(l); }
  }

  private resetMote(m: { o: Phaser.GameObjects.Arc; vy: number; drift: number; phase: number }, scatter = false) {
    m.o.x = this.w / 2 + (Math.random() - 0.5) * this.w * 0.55;
    m.o.y = scatter ? Math.random() * this.h : this.floorY + Math.random() * 20 * SS;
    m.o.setAlpha(0.1 + Math.random() * 0.3);
  }

  setLook(look: HeroLook | null) {
    if (!this.ready) { this.pending = look; return; }
    this.parts?.fig.destroy();
    this.parts = null;
    this.aura?.destroy();
    this.aura = undefined;
    this.pivot.removeAll();
    this.turn = 0; // a newly chosen hero always faces you
    this.spin = 0;
    if (!look) { this.shadow.setVisible(false); this.glow.setVisible(false); return; }
    this.shadow.setVisible(true);
    this.glow.setVisible(true);

    const parts = buildFigure(this, look, ICON_RES);

    // POSE FOR THE BIG VIEW. In the dungeon the hero is 34 px tall and a weapon laid
    // across the chest reads as "armed". At 15× that same weapon covers the face and the
    // shield swallows the torso — so on the dais the gear is eased down and outward into
    // something closer to a portrait stance. Same figure, same gear, presented to be seen.
    if (parts.weapon) parts.weapon.setPosition(12, -13).setRotation(0.5).setScale(parts.weapon.scaleX * 0.82);
    if (parts.offhand) parts.offhand.setPosition(-11.5, -13).setScale(parts.offhand.scaleX * 0.78);
    // a helm at dungeon scale is a blob that reads as "headgear"; here it has to actually
    // sit on the head, so it comes down to a band across the brow
    if (parts.helm) parts.helm.setPosition(0, -3.4).setScale(parts.helm.scaleX * 0.62);
    for (const f of parts.helmFlair) (f as Phaser.GameObjects.Shape).setVisible(false);

    // the rarity aura sits under the feet, inside the pivot so it turns with the hero
    if (parts.tier >= 3) {
      const gc = RARITY_COLORS[RARITY_ORDER[parts.tier]] ?? 0xffffff;
      this.aura = this.add.ellipse(0, 1 * this.figScale, 40 * this.figScale, 18 * this.figScale, gc, 0.2)
        .setStrokeStyle(1.5 * SS, gc, 0.55);
      this.pivot.add(this.aura);
    }
    parts.fig.setScale(this.figScale);
    this.pivot.add(parts.fig);
    this.parts = parts;

    // the dais light takes the class hue; the shadow sizes to the silhouette
    this.glow.setFillStyle(parts.accent, 0.16);
    this.dais.setStrokeStyle(2 * SS, parts.accent, 0.4);

    // arrival: the hero fades up out of the floor, and the ward circle flares
    this.entered = this.time.now;
    parts.fig.setAlpha(0);
    this.tweens.add({ targets: parts.fig, alpha: 1, duration: 260, ease: "sine.out" });
    this.tweens.add({ targets: this.glow, scaleX: 1.35, scaleY: 1.35, alpha: 0.42, duration: 220, yoyo: true, ease: "sine.out" });
  }

  update(time: number, delta: number) {
    const dt = delta / 1000;

    // the ward circle turns, its runes riding an ellipse so the far side reads as far
    const rx = this.w * 0.27, ry = this.w * 0.088;
    for (let i = 0; i < this.runes.length; i++) {
      const a = time / 4200 + (i / this.runes.length) * Math.PI * 2;
      const t = this.runes[i];
      const depth = (Math.sin(a) + 1) / 2; // 0 far, 1 near
      t.setPosition(this.w / 2 + Math.cos(a) * rx, this.floorY + Math.sin(a) * ry);
      t.setScale(0.62 + depth * 0.42);
      t.setAlpha(0.16 + depth * 0.4);
    }

    for (const m of this.motes) {
      m.o.y -= m.vy * dt;
      m.o.x += Math.sin(time / 900 + m.phase) * m.drift * dt;
      if (m.o.y < this.h * 0.12) this.resetMote(m);
    }

    this.beam.setAlpha(0.045 + Math.sin(time / 2600) * 0.012);

    const p = this.parts;
    if (!p) return;

    // idle: a slow breath through the whole body, with the limbs a beat behind it
    const breath = Math.sin(time / 1150);
    const sway = Math.sin(time / 1750);
    p.fig.y = breath * 1.1 * this.figScale;
    p.torso.scaleY = 1 + breath * 0.022;
    p.head.y = -25 + breath * 0.5;
    p.head.rotation = sway * 0.035;
    p.armB.rotation = sway * 0.07;
    p.armF.rotation = -sway * 0.07;
    p.legL.rotation = breath * 0.012;
    p.legR.rotation = -breath * 0.012;
    if (p.cape) { p.cape.rotation = sway * 0.05; p.cape.scaleY = 1 + breath * 0.03; }
    if (p.weapon) p.weapon.rotation = -0.7 + sway * 0.03;
    if (this.aura) {
      const pulse = 1 + Math.sin(time / 900) * 0.09;
      this.aura.setScale(pulse).setAlpha(0.18 + Math.sin(time / 900) * 0.12);
    }

    // drag-to-turn: a flat figure can't truly rotate, so squash it toward edge-on and
    // flip when it passes the profile. Clamped well short of zero — a hero that vanishes
    // at 90° reads as a bug, a hero that goes thin reads as a turn.
    this.turn += this.spin;
    this.spin *= 0.9;
    if (Math.abs(this.spin) < 0.0001) this.spin = 0;
    const c = Math.cos(this.turn);
    const face = Math.sign(c) || 1;
    const sx = face * Math.max(0.34, Math.abs(c));
    this.pivot.setScale(sx, 1);
    this.shadow.scaleX = 0.55 + Math.abs(c) * 0.45;

    // a rising shimmer for the first moments after a hero steps onto the dais
    const since = time - this.entered;
    if (since < 420) this.glow.setAlpha(0.16 + (1 - since / 420) * 0.25);
  }
}

/**
 * Mount a live hero stage into `parent`. Returns a handle — call `setLook` whenever the
 * selection changes and `destroy()` when the screen closes (it owns a Phaser.Game).
 */
export function createHeroStage(parent: HTMLElement, opts: { width: number; height: number } ): HeroStage {
  const el = document.createElement("div");
  el.style.cssText = `width:${opts.width}px;height:${opts.height}px;position:relative;`;
  parent.appendChild(el);

  const w = opts.width * SS, h = opts.height * SS;
  // fit the ~34-unit-tall figure into the space above the dais, leaving headroom for the
  // weapon (which reaches above the crown) and a margin at the top of the shaft
  const scale = ((opts.height - 108) / 34) * SS;
  const scene = new StageScene({ w, h, scale });
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    transparent: true,
    scene,
    audio: { noAudio: true },
    banner: false,
    // zoom (not FIT) is what makes the supersampled buffer work: the canvas keeps its
    // w×h backing store and is *displayed* at half that, so the vector figure stays crisp
    // — and unlike FIT it needs no parent measurement, which matters because the panel is
    // still detached from the document when this runs. expandParent stays off so Phaser
    // doesn't overwrite the host div's size with 100%/100%.
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / SS, width: w, height: h, parent: el, expandParent: false },
  });
  game.canvas.style.cursor = "grab";
  game.canvas.style.touchAction = "none";

  // Input maps pointer coordinates through the canvas' measured bounds, which are zero
  // while the panel is detached. Re-measure the moment it lands in the layout.
  const ro = new ResizeObserver(() => game.scale.refresh());
  ro.observe(el);

  return {
    el,
    setLook: (look) => scene.setLook(look),
    destroy: () => { ro.disconnect(); game.destroy(true); el.remove(); },
  };
}
