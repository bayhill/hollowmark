// Shared "Arcane Runic" panel chrome — one ornate frame every menu draws through, so the
// whole UI reads as one intricate system: a gradient-lit dark field, a double rune-etched
// border with a soft glow-pulse, magic-circle corner nodes, and a centered title cartouche
// flanked by ✦. Draw it FIRST into a panel's root container, then lay content on top.
import Phaser from "phaser";

export interface ArcaneFrameOpts {
  accent?: number; // primary border / glow hue (default arcane violet)
  accent2?: number; // secondary fleck / rune hue (default teal)
  title?: string; // centered cartouche title
  titleColor?: string; // title text color (default a bright tint of accent)
  glow?: boolean; // pulsing border glow (default true)
  runes?: boolean; // rune frieze along the bottom edge (default true)
  radius?: number; // corner radius (default 8)
}

// One gothic monochrome for all chrome — tarnished pewter on dark stone. No colour explosion:
// panels differ by content, not hue. Loot rarity + currency keep their colours; the FRAME does not.
const PEWTER = 0x9a93a2; // border / runes / corners
const PEWTER_DARK = 0x5f5866; // inset hairline / shadow flecks
const BONE = 0xcfc6d6; // bright etch — title, node cores
const RUNES = "ᚨᚱᚾᛞᛟᚦᛝᛥᛒᚹᛦᛘᚷᛖᛚᛃᛈ";

const hexStr = (n: number) => "#" + (n & 0xffffff).toString(16).padStart(6, "0");
// lighten a hex color toward white by t (0..1) — for bright title/tick tints
function lighten(hex: number, t: number): number {
  const r = (hex >> 16) & 0xff, g = (hex >> 8) & 0xff, b = hex & 0xff;
  const m = (c: number) => Math.round(c + (255 - c) * t);
  return (m(r) << 16) | (m(g) << 8) | m(b);
}

// a magic-circle corner node: a ring, a bright core diamond, and two radiating ticks
function cornerNode(scene: Phaser.Scene, cx: number, cy: number, accent: number, dirX: number, dirY: number) {
  const g = scene.add.graphics().setPosition(cx, cy);
  g.lineStyle(1.2, accent, 0.85);
  g.strokeCircle(0, 0, 5);
  g.lineStyle(1, accent, 0.5);
  g.strokeCircle(0, 0, 8);
  // radiating ticks inward along the border
  g.lineStyle(1.2, accent, 0.7);
  g.beginPath(); g.moveTo(dirX * 8, 0); g.lineTo(dirX * 15, 0); g.strokePath();
  g.beginPath(); g.moveTo(0, dirY * 8); g.lineTo(0, dirY * 15); g.strokePath();
  // bright core diamond
  g.fillStyle(lighten(accent, 0.4), 0.95);
  g.beginPath();
  g.moveTo(0, -3); g.lineTo(3, 0); g.lineTo(0, 3); g.lineTo(-3, 0); g.closePath();
  g.fillPath();
  return g;
}

/**
 * Draw the arcane frame into `container` occupying (0,0)–(w,h) in its local space.
 * Returns the y at which body content can safely begin (below the title band).
 */
export function arcaneFrame(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  w: number,
  h: number,
  opts: ArcaneFrameOpts = {}
): number {
  const accent = opts.accent ?? PEWTER;
  const accent2 = opts.accent2 ?? PEWTER_DARK;
  const r = opts.radius ?? 8;
  const parts: Phaser.GameObjects.GameObject[] = [];

  // --- field: a dark vertical gradient with a faint violet crown ---
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.9);
  bg.fillRoundedRect(0, 0, w, h, r);
  const top = lighten(accent, 0.06);
  bg.fillGradientStyle(0x1a1626, 0x1a1626, 0x0c0a12, 0x0c0a12, 0.97);
  bg.fillRoundedRect(0, 0, w, h, r);
  // a soft violet crown-glow across the top inch
  bg.fillStyle(top, 0.10);
  bg.fillRoundedRect(3, 3, w - 6, 30, r - 2);
  parts.push(bg);

  // sparse teal/violet flecks, kept to the header + footer bands (out of content)
  const fleck = scene.add.graphics();
  const seed = (w * 31 + h * 17) >>> 0;
  const rnd = (i: number) => (((seed + i * 2654435761) >>> 0) % 1000) / 1000;
  for (let i = 0; i < 10; i++) {
    const fx = 14 + rnd(i) * (w - 28);
    const fy = rnd(i + 50) < 0.5 ? 8 + rnd(i + 7) * 14 : h - 22 + rnd(i + 9) * 12;
    fleck.fillStyle(i % 3 === 0 ? accent2 : accent, 0.35);
    fleck.fillCircle(fx, fy, rnd(i + 3) > 0.7 ? 1.3 : 0.8);
  }
  parts.push(fleck);

  // No glow — the frame is etched, not lit. Gothic stone reads better static than breathing.

  // --- border: an outer keyline, the main etched edge, and an inset hairline ---
  const border = scene.add.graphics();
  border.lineStyle(3, 0x05040a, 0.8);
  border.strokeRoundedRect(-1, -1, w + 2, h + 2, r + 1); // dark keyline for contrast on any bg
  border.lineStyle(2, accent, 0.9);
  border.strokeRoundedRect(0, 0, w, h, r);
  border.lineStyle(1, accent, 0.32);
  border.strokeRoundedRect(5, 5, w - 10, h - 10, r - 2);
  border.lineStyle(1, accent2, 0.14);
  border.strokeRoundedRect(8, 8, w - 16, h - 16, Math.max(2, r - 4));
  parts.push(border);

  // --- corner nodes ---
  const inset = 11;
  parts.push(
    cornerNode(scene, inset, inset, accent, 1, 1),
    cornerNode(scene, w - inset, inset, accent, -1, 1),
    cornerNode(scene, inset, h - inset, accent, 1, -1),
    cornerNode(scene, w - inset, h - inset, accent, -1, -1)
  );

  // --- rune frieze along the bottom inner edge ---
  if (opts.runes !== false) {
    const count = Math.max(5, Math.min(24, Math.floor((w - 60) / 20)));
    let glyphs = "";
    for (let i = 0; i < count; i++) glyphs += RUNES[(seed + i * 7) % RUNES.length] + " ";
    parts.push(
      scene.add.text(w / 2, h - 11, glyphs.trim(), {
        fontFamily: "monospace", fontSize: "10px", color: hexStr(accent),
      }).setOrigin(0.5).setAlpha(0.28)
    );
  }

  // --- title cartouche: ⟨✦  TITLE  ✦⟩ on a small plaque riding the top border ---
  let contentTop = 30;
  if (opts.title) {
    const tColor = opts.titleColor ?? hexStr(BONE);
    const label = `✦  ${opts.title}  ✦`;
    const t = scene.add.text(w / 2, 7, label, {
      fontFamily: "monospace", fontSize: "15px", color: tColor, fontStyle: "bold",
    }).setOrigin(0.5, 0);
    const plaqueW = t.width + 26;
    const plaque = scene.add.graphics();
    plaque.fillStyle(0x120e1e, 0.95);
    plaque.fillRoundedRect(w / 2 - plaqueW / 2, 2, plaqueW, 24, 5);
    plaque.lineStyle(1, accent, 0.7);
    plaque.strokeRoundedRect(w / 2 - plaqueW / 2, 2, plaqueW, 24, 5);
    // little bracket flourishes at the plaque ends
    plaque.lineStyle(1.4, accent, 0.85);
    const bx = w / 2 - plaqueW / 2, by = 14;
    plaque.beginPath(); plaque.moveTo(bx - 5, by - 5); plaque.lineTo(bx - 9, by); plaque.lineTo(bx - 5, by + 5); plaque.strokePath();
    plaque.beginPath(); plaque.moveTo(w - bx + 5, by - 5); plaque.lineTo(w - bx + 9, by); plaque.lineTo(w - bx + 5, by + 5); plaque.strokePath();
    parts.push(plaque, t);
    contentTop = 32;
  }

  container.add(parts);
  return contentTop;
}

// A section divider: a thin arcane line with a bright center node — for splitting panel regions.
export function arcaneDivider(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  width: number,
  accent = PEWTER
) {
  const g = scene.add.graphics();
  g.lineStyle(1, accent, 0.4);
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + width, y); g.strokePath();
  // fade the ends by overdrawing dark stubs
  const cx = x + width / 2;
  g.fillStyle(lighten(accent, 0.4), 0.9);
  g.beginPath(); g.moveTo(cx, y - 3); g.lineTo(cx + 3, y); g.lineTo(cx, y + 3); g.lineTo(cx - 3, y); g.closePath(); g.fillPath();
  g.lineStyle(1, accent, 0.6);
  g.strokeCircle(cx, y, 4);
  container.add(g);
}

// One gothic monochrome. The hue keys are kept (call sites reference them) but all resolve to
// the same tarnished pewter — so every panel's chrome matches; content, not colour, sets them apart.
export const ARCANE = {
  violet: PEWTER,
  teal: PEWTER,
  crimson: PEWTER,
  gold: PEWTER,
  green: PEWTER,
  pewter: PEWTER,
  text: "#cfc6d6", // bone
  dim: "#8a8494", // dim pewter
};
