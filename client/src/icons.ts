import Phaser from "phaser";

// Procedural item icons — one 36x36 texture per base item key, drawn with
// Graphics primitives in a muted D2-ish palette. Generated once, globally.

const S = 36;

const STEEL = 0xc8ccd4;
const STEEL_D = 0x878c98;
const WOOD = 0x7a5a34;
const LEATHER = 0x8a6a42;
const LEATHER_D = 0x5f482e;
const CLOTH = 0x6a5a8f;
const GOLD = 0xd8b13a;
const GEM = 0xb04858;
const BONE = 0xd8d4c0;
const IRON = 0x9a9eaa;
const IRON_D = 0x62666f;

type G = Phaser.GameObjects.Graphics;

function P(g: G, color: number, pts: number[][]) {
  g.fillStyle(color);
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fillPath();
}

function sword(g: G, tipY: number, bladeW: number) {
  // blade
  P(g, STEEL, [[18, tipY], [18 + bladeW, tipY + 4], [18 + bladeW, 24], [18 - bladeW, 24], [18 - bladeW, tipY + 4]]);
  P(g, STEEL_D, [[18, tipY], [18, 24], [18 - bladeW, 24], [18 - bladeW, tipY + 4]]); // edge shading
  g.fillStyle(IRON_D).fillRect(11, 24, 14, 3); // crossguard
  g.fillStyle(WOOD).fillRect(16, 27, 4, 6); // grip
  g.fillStyle(GOLD).fillCircle(18, 34, 2); // pommel
}

const DRAWERS: Record<string, (g: G) => void> = {
  dagger: (g) => sword(g, 10, 2),
  shortsword: (g) => sword(g, 5, 3),
  greatsword: (g) => sword(g, 1, 4),
  colossusblade: (g) => {
    sword(g, 0, 5);
    g.fillStyle(0xffd54a, 0.35).fillRect(13, 2, 2, 20); // a blade too big to be subtle, catching light
  },
  warpike: (g) => {
    g.fillStyle(0x6a4a2c).fillRect(17, 6, 3, 26); // long haft
    P(g, 0xb8bcc8, [[18.5, 1], [22, 8], [18.5, 12], [15, 8]]); // leaf-blade point
    g.fillStyle(0x4a3a20).fillRect(15, 18, 7, 2); // binding
  },
  bonehelm: (g) => {
    P(g, 0xd8d4c0, [[18, 8], [26, 14], [25, 24], [11, 24], [10, 14]]); // skull dome
    g.fillStyle(0x22242a).fillRect(13, 18, 4, 4); // socket
    g.fillStyle(0x22242a).fillRect(20, 18, 4, 4);
    P(g, 0xc8c4ae, [[8, 12], [11, 6], [13, 13]]); // horn stubs
    P(g, 0xc8c4ae, [[28, 12], [25, 6], [23, 13]]);
  },
  sacredarmor: (g) => {
    P(g, 0x9aa0b0, [[11, 8], [25, 8], [28, 16], [25, 28], [11, 28], [8, 16]]); // consecrated plate
    P(g, 0x7a8090, [[11, 8], [18, 8], [18, 28], [11, 28], [8, 16]]);
    g.fillStyle(0xffd54a).fillRect(17, 11, 2, 12); // the golden seam
    g.fillStyle(0xffd54a).fillRect(13, 15, 10, 2);
  },
  scepter: (g) => {
    g.fillStyle(IRON).fillRect(16, 8, 4, 24); // haft
    g.fillStyle(GOLD).fillCircle(18, 7, 5); // holy head
    g.fillStyle(GEM).fillCircle(18, 7, 2);
    g.fillStyle(GOLD).fillCircle(18, 33, 2);
  },
  wand: (g) => {
    g.fillStyle(BONE).fillRect(16, 6, 3, 26); // bone shaft
    P(g, BONE, [[14, 8], [22, 4], [20, 10]]); // knuckle
    g.fillStyle(0x5fae7f).fillCircle(18, 5, 2.5); // necrotic tip
  },
  club: (g) => {
    P(g, WOOD, [[15, 30], [21, 30], [24, 10], [12, 10]]); // gnarled taper
    g.fillStyle(LEATHER_D).fillRect(16, 28, 4, 6);
    g.fillStyle(0x5a4426).fillCircle(15, 12, 2);
    g.fillStyle(0x5a4426).fillCircle(21, 16, 1.6);
  },
  circlet: (g) => {
    g.lineStyle(3, GOLD).strokeCircle(18, 20, 9);
    g.fillStyle(GEM).fillCircle(18, 11, 2.6); // brow gem
    g.fillStyle(0x8ad0ff).fillCircle(11, 16, 1.5);
    g.fillStyle(0x8ad0ff).fillCircle(25, 16, 1.5);
  },
  greataxe: (g) => {
    g.fillStyle(WOOD).fillRect(16, 6, 4, 26); // long haft
    P(g, STEEL, [[20, 8], [30, 12], [28, 22], [20, 18]]); // right blade
    P(g, STEEL_D, [[16, 8], [6, 12], [8, 22], [16, 18]]); // left blade
  },
  waraxe: (g) => {
    g.fillStyle(WOOD).fillRect(16, 4, 4, 30); // haft
    P(g, STEEL, [[20, 6], [31, 9], [33, 16], [20, 18]]); // axe head
    P(g, STEEL_D, [[20, 6], [20, 18], [24, 17], [24, 8]]);
  },
  morningstar: (g) => {
    g.fillStyle(WOOD).fillRect(16, 14, 4, 20);
    g.fillStyle(IRON).fillCircle(18, 10, 6); // spiked ball
    for (const [dx, dy] of [[0, -9], [8, -5], [9, 4], [0, 9], [-9, 4], [-8, -5]]) {
      P(g, IRON_D, [[18, 10], [18 + dx * 0.6, 10 + dy * 0.6], [18 + dx, 10 + dy]]);
    }
  },
  warstaff: (g) => {
    g.fillStyle(WOOD).fillRect(16, 8, 4, 26);
    g.fillStyle(0x4a7ae8).fillCircle(18, 6, 5);
    g.fillStyle(0x9ac8ff).fillCircle(16, 4, 2); // glint
  },
  bow: (g) => {
    g.lineStyle(2.5, WOOD, 1);
    g.beginPath();
    g.arc(14, 18, 12, -Math.PI / 2.3, Math.PI / 2.3, false);
    g.strokePath();
    g.lineStyle(1, BONE, 0.9);
    g.lineBetween(18, 7, 18, 29); // string
    g.fillStyle(STEEL_D).fillRect(8, 17, 12, 2); // nocked arrow
    P(g, STEEL, [[6, 18], [10, 15.5], [10, 20.5]]);
  },
  maul: (g) => {
    g.fillStyle(WOOD).fillRect(16, 12, 4, 22);
    g.fillStyle(IRON).fillRoundedRect(9, 4, 18, 10, 2);
    g.fillStyle(IRON_D).fillRoundedRect(9, 4, 9, 10, 2);
    g.fillStyle(GOLD).fillRect(15, 12, 6, 2); // collar
  },
  scythe: (g) => {
    g.fillStyle(WOOD).fillRect(16, 8, 4, 26);
    g.lineStyle(4, STEEL, 1);
    g.beginPath();
    g.arc(15, 14, 11, -Math.PI * 0.55, Math.PI * 0.1, false);
    g.strokePath();
    g.lineStyle(1.5, STEEL_D, 0.9);
    g.beginPath();
    g.arc(15, 15, 9, -Math.PI * 0.5, Math.PI * 0.05, false);
    g.strokePath();
  },
  quiver: (g) => {
    P(g, LEATHER, [[12, 12], [22, 12], [24, 32], [10, 32]]);
    g.fillStyle(LEATHER_D).fillRect(10, 28, 14, 4);
    for (const x of [14, 18, 22]) {
      g.fillStyle(WOOD).fillRect(x - 0.75, 6, 1.5, 7);
      P(g, GEM, [[x, 3], [x + 2.5, 8], [x - 2.5, 8]]); // fletching
    }
  },
  tome: (g) => {
    g.fillStyle(0x3a2a6f).fillRoundedRect(9, 8, 18, 22, 2);
    g.fillStyle(0x2a1e52).fillRect(9, 8, 5, 22); // spine
    g.lineStyle(1, GOLD, 0.9).strokeRoundedRect(10, 9, 16, 20, 2);
    g.fillStyle(GOLD).fillRect(24, 16, 4, 6); // clasp
    g.fillStyle(0x9ac8ff).fillCircle(20, 19, 2.5); // sigil
  },
  crown: (g) => {
    P(g, GOLD, [[9, 26], [9, 16], [13, 21], [18, 12], [23, 21], [27, 16], [27, 26]]);
    g.fillStyle(0xb8901f).fillRect(9, 23, 18, 4);
    g.fillStyle(GEM).fillCircle(18, 24.5, 2);
    g.fillStyle(0x3a8fd8).fillCircle(12, 24.5, 1.4);
    g.fillStyle(0x3a8fd8).fillCircle(24, 24.5, 1.4);
  },
  studded: (g) => {
    P(g, LEATHER, [[10, 8], [26, 8], [28, 20], [24, 31], [12, 31], [8, 20]]);
    g.fillStyle(IRON);
    for (let y = 12; y < 29; y += 5)
      for (let x = 12 + (y % 10 === 2 ? 2 : 0); x < 25; x += 5) g.fillCircle(x, y, 1.3);
  },
  girdle: (g) => {
    P(g, LEATHER_D, [[5, 12], [31, 12], [31, 25], [5, 25]]);
    g.fillStyle(STEEL_D);
    for (const x of [7, 23]) g.fillRect(x, 13, 6, 11); // plates
    g.fillStyle(GOLD).fillRect(14, 13, 8, 11); // buckle plate
    g.fillStyle(0x22242a).fillRect(17, 16, 2, 5);
  },
  buckler: (g) => {
    g.fillStyle(LEATHER).fillCircle(18, 18, 12);
    g.lineStyle(2, IRON_D).strokeCircle(18, 18, 12);
    g.fillStyle(IRON).fillCircle(18, 18, 4); // boss
  },
  kiteshield: (g) => {
    P(g, IRON, [[18, 4], [30, 10], [26, 26], [18, 33], [10, 26], [6, 10]]);
    P(g, IRON_D, [[18, 4], [18, 33], [10, 26], [6, 10]]);
    g.lineStyle(1, 0x3d4048).strokeCircle(18, 16, 4);
  },
  towershield: (g) => {
    g.fillStyle(IRON).fillRoundedRect(8, 4, 20, 29, 5);
    g.fillStyle(IRON_D).fillRoundedRect(8, 4, 10, 29, 5);
    g.fillStyle(GOLD).fillRect(17, 8, 2, 21); // center ridge
  },
  orb: (g) => {
    g.fillStyle(0x3a2a6f).fillCircle(18, 20, 9);
    g.fillStyle(0x7a5ce8).fillCircle(18, 20, 7);
    g.fillStyle(0xcdbfff).fillCircle(15, 17, 2.5);
    g.fillStyle(GOLD).fillRect(14, 29, 8, 3); // stand
  },
  cap: (g) => {
    P(g, LEATHER, [[8, 22], [10, 12], [18, 8], [26, 12], [28, 22]]);
    g.fillStyle(LEATHER_D).fillRect(8, 22, 20, 4); // brim
  },
  fullhelm: (g) => {
    P(g, IRON, [[9, 26], [9, 13], [18, 6], [27, 13], [27, 26]]);
    g.fillStyle(0x22242a).fillRect(12, 16, 12, 3); // visor slit
    g.fillStyle(IRON_D).fillRect(9, 22, 18, 4);
  },
  greathelm: (g) => {
    g.fillStyle(IRON).fillRoundedRect(9, 7, 18, 22, { tl: 8, tr: 8, bl: 2, br: 2 });
    g.fillStyle(0x22242a).fillRect(12, 15, 5, 3);
    g.fillStyle(0x22242a).fillRect(19, 15, 5, 3);
    g.fillStyle(0x22242a).fillRect(17, 20, 2, 7); // breath slit
  },
  robe: (g) => {
    P(g, CLOTH, [[13, 6], [23, 6], [27, 32], [9, 32]]);
    P(g, 0x4f4370, [[13, 6], [18, 6], [18, 32], [9, 32]]);
    g.fillStyle(GOLD).fillRect(16, 6, 4, 26); // trim
  },
  leather: (g) => {
    P(g, LEATHER, [[10, 8], [26, 8], [28, 20], [24, 31], [12, 31], [8, 20]]);
    g.lineStyle(1, LEATHER_D);
    g.lineBetween(18, 8, 18, 31); // lacing
    for (let y = 12; y < 28; y += 5) g.lineBetween(15, y, 21, y + 2);
  },
  chainmail: (g) => {
    P(g, IRON, [[10, 8], [26, 8], [28, 20], [24, 31], [12, 31], [8, 20]]);
    g.fillStyle(IRON_D);
    for (let y = 11; y < 29; y += 4)
      for (let x = 11 + (y % 8 === 3 ? 2 : 0); x < 25; x += 4) g.fillCircle(x, y, 1.2);
  },
  plate: (g) => {
    P(g, STEEL, [[10, 7], [26, 7], [29, 19], [24, 32], [12, 32], [7, 19]]);
    P(g, STEEL_D, [[10, 7], [18, 7], [18, 32], [12, 32], [7, 19]]);
    g.lineStyle(2, IRON_D);
    g.lineBetween(18, 12, 18, 30); // center seam
    g.lineBetween(11, 15, 25, 15); // chest line
  },
  ring: (g) => {
    g.lineStyle(4, GOLD).strokeCircle(18, 20, 8);
    g.fillStyle(GEM).fillCircle(18, 11, 3.5);
    g.fillStyle(0xe8a0b0).fillCircle(17, 10, 1.2);
  },
  amulet: (g) => {
    g.lineStyle(2, GOLD);
    g.beginPath();
    g.arc(18, 12, 9, Math.PI * 0.15, Math.PI * 0.85, false);
    g.strokePath();
    g.fillStyle(GOLD).fillCircle(18, 22, 5);
    g.fillStyle(0x3a8fd8).fillCircle(18, 22, 3);
  },
  sash: (g) => {
    P(g, LEATHER, [[6, 14], [30, 18], [30, 24], [6, 20]]);
    g.fillStyle(GOLD).fillRect(15, 15, 6, 8); // buckle
    g.fillStyle(0x22242a).fillRect(17, 17, 2, 4);
  },
  warbelt: (g) => {
    P(g, LEATHER_D, [[5, 13], [31, 13], [31, 24], [5, 24]]);
    g.fillStyle(GOLD).fillRect(15, 14, 7, 9);
    g.fillStyle(IRON);
    for (const x of [8, 12, 25, 28]) g.fillCircle(x, 18, 1.5);
  },
  boots: (g) => {
    P(g, LEATHER, [[12, 8], [20, 8], [20, 22], [28, 26], [28, 30], [12, 30]]);
    g.fillStyle(LEATHER_D).fillRect(12, 26, 16, 4); // sole
  },
  greaves: (g) => {
    P(g, IRON, [[12, 7], [20, 7], [20, 21], [29, 25], [29, 30], [12, 30]]);
    g.fillStyle(IRON_D).fillRect(12, 26, 17, 4);
    g.fillStyle(STEEL).fillRect(13, 9, 6, 12); // shin plate
  },
  smallcharm: (g) => {
    P(g, 0x4a7ae8, [[18, 12], [23, 18], [18, 24], [13, 18]]);
    g.fillStyle(0x9ac8ff).fillCircle(17, 16, 1.5);
  },
  largecharm: (g) => {
    P(g, 0x4a7ae8, [[18, 8], [24, 14], [24, 22], [18, 28], [12, 22], [12, 14]]);
    g.fillStyle(0x9ac8ff).fillCircle(16, 13, 2);
  },
  grandcharm: (g) => {
    g.fillStyle(0x4a7ae8).fillRoundedRect(11, 6, 14, 24, 5);
    g.fillStyle(0x2a4a9f).fillRoundedRect(11, 6, 7, 24, 5);
    g.fillStyle(0x9ac8ff).fillCircle(16, 11, 2);
  },
  jewel: (g) => {
    // a cut stone: violet facets catching lamplight
    P(g, 0x7a3fd0, [[18, 6], [28, 14], [23, 28], [13, 28], [8, 14]]);
    P(g, 0x9a5ff0, [[18, 6], [28, 14], [18, 18]]);
    P(g, 0x5a2fa0, [[8, 14], [18, 18], [13, 28]]);
    g.fillStyle(0xd0b0ff, 0.9).fillTriangle(18, 6, 22, 12, 14, 12);
  },
  runestone: (g) => {
    P(g, 0x5a5f6f, [[18, 5], [28, 11], [26, 29], [10, 29], [8, 11]]);
    P(g, 0x454a58, [[18, 5], [18, 29], [10, 29], [8, 11]]);
    g.lineStyle(1.5, 0xff8033, 0.9);
    g.strokeCircle(18, 17, 5); // carved sigil glow ring
    g.fillStyle(0xff8033, 0.25).fillCircle(18, 17, 7);
  },
  potion: (g) => {
    g.fillStyle(0x7a2028).fillCircle(18, 22, 8); // bulb
    g.fillStyle(0xd03848).fillCircle(16, 20, 5);
    g.fillStyle(0x555a64).fillRect(15, 8, 6, 7); // neck
    g.fillStyle(LEATHER_D).fillRect(14, 6, 8, 3); // cork
  },
};

export function ensureItemIcons(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  for (const [key, draw] of Object.entries(DRAWERS)) {
    const tex = `icon_${key}`;
    if (scene.textures.exists(tex)) continue;
    g.clear();
    draw(g);
    g.generateTexture(tex, S, S);
  }
  g.destroy();
}
