// Atmosphere: a cohesive post-processing + ambient-particle layer that gives the
// whole game its Diablo-esque mood. Global bloom (every torch, ember, loot beam,
// and spell glows), a vignette that frames the hero, a per-zone color wash for
// temperature, and drifting motes/embers/ash tinted to each zone.
import Phaser from "phaser";
import { FLOOR_THEMES } from "@hollowmark/common";

// pull a color toward white (pastel) — a MULTIPLY wash of a pastel tints the
// scene's hue while barely darkening it
function pastel(color: number, t: number): number {
  const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
  const m = (c: number) => Math.round(c + (255 - c) * t);
  return (m(r) << 16) | (m(g) << 8) | m(b);
}
function brighten(color: number, t: number): number {
  const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
  const m = (c: number) => Math.min(255, Math.round(c * (1 + t)));
  return (m(r) << 16) | (m(g) << 8) | m(b);
}

export class Atmosphere {
  private wash?: Phaser.GameObjects.Rectangle;
  private motes?: Phaser.GameObjects.Particles.ParticleEmitter;
  private curTheme = -1;

  constructor(private scene: Phaser.Scene) {}

  setup() {
    const cam = this.scene.cameras.main;
    // A whisper of a vignette to frame the hero — NO full-screen bloom: it blurs
    // the crisp procedural art and floating text into mush. Glow belongs on
    // specific bright objects (loot beams, portals), not the whole camera.
    if (cam.postFX) {
      cam.postFX.addVignette(0.5, 0.5, 0.92, 0.22);
    }

    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    // a screen-fixed color wash for per-zone temperature (set in applyTheme)
    this.wash = this.scene.add
      .rectangle(w / 2, h / 2, 7000, 7000, 0xffffff, 0)
      .setScrollFactor(0)
      .setDepth(860_000)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  // called on every floor change with the resolved visual theme index
  applyTheme(themeIdx: number) {
    if (themeIdx === this.curTheme) return;
    this.curTheme = themeIdx;
    const theme = FLOOR_THEMES[themeIdx] ?? FLOOR_THEMES[0];
    const accent = theme.accent;

    // zone temperature: a pastel of the accent, MULTIPLY'd *very* faintly — just a
    // whisper of hue, not the muddy green tarp the first pass laid over everything
    this.wash?.setFillStyle(pastel(accent, 0.72), 1).setAlpha(0.1);

    // drifting ambient motes tinted to the zone — rebuilt per floor
    this.motes?.destroy();
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    this.motes = this.scene.add
      .particles(0, 0, "lightmask", {
        x: { min: -40, max: w + 40 },
        y: { min: -40, max: h + 40 },
        lifespan: 6000,
        speedX: { min: -7, max: 7 },
        speedY: { min: -16, max: -3 }, // a slow upward drift, like embers
        scale: { start: 0.04, end: 0.012 },
        alpha: { start: 0.26, end: 0 }, // a mote glimmers, then fades
        frequency: 150,
        quantity: 1,
        tint: brighten(accent, 0.35),
        blendMode: Phaser.BlendModes.ADD,
      })
      .setScrollFactor(0)
      .setDepth(858_000);
  }
}
