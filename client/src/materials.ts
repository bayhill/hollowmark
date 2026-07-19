// Procedural material textures — the "several notches up" dungeon rendering. Instead of flat-filled
// diamonds, we paint stone/earth per pixel onto canvas textures: low-frequency mottling, fine grain,
// hairline cracks, edge vignette, plus (for walls) directional face shading, brick courses, and
// ambient occlusion toward the base. Same texture keys the renderer already tiles, so nothing else
// has to change — the world just gets material and depth.
import Phaser from "phaser";
import { TILE_W, TILE_H, WALL_H, FloorTheme } from "@hollowmark/common";

const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;

type RGB = { r: number; g: number; b: number };
function hexToRgb(hex: number): RGB {
  return { r: (hex >> 16) & 0xff, g: (hex >> 8) & 0xff, b: hex & 0xff };
}
const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

// deterministic hash-based value in [0,1)
function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) >>> 0;
  h = (h ^ (h >> 13)) * 1274126177;
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967296;
}
// smooth value noise via bilinear interpolation of the hash grid
function vnoise(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// two octaves of mottling — the blotchy character of worn stone
function mottle(x: number, y: number, seed = 0): number {
  return vnoise(x * 0.16, y * 0.28, seed) * 0.66 + vnoise(x * 0.5, y * 0.85, seed + 7) * 0.34;
}

// a few hairline cracks per tile — deterministic per key so a texture is stable
function crackSegments(seedKey: number): Array<[number, number, number, number]> {
  const segs: Array<[number, number, number, number]> = [];
  const n = 2 + Math.floor(hash2(seedKey, 99) * 2);
  for (let i = 0; i < n; i++) {
    const x0 = hash2(seedKey, i * 3 + 1) * TILE_W;
    const y0 = hash2(seedKey, i * 3 + 2) * TILE_H;
    const ang = hash2(seedKey, i * 3 + 3) * Math.PI * 2;
    const len = 8 + hash2(seedKey, i * 3 + 4) * 16;
    segs.push([x0, y0, x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len]);
  }
  return segs;
}
function distToSeg(px: number, py: number, s: [number, number, number, number]): number {
  const [x0, y0, x1, y1] = s;
  const dx = x1 - x0, dy = y1 - y0;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - x0) * dx + (py - y0) * dy) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = x0 + t * dx, cy = y0 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function setPx(data: Uint8ClampedArray, i: number, base: RGB, bright: number, tint?: RGB, tintAmt = 0) {
  let r = base.r * bright, g = base.g * bright, b = base.b * bright;
  if (tint) { r += (tint.r - r) * tintAmt; g += (tint.g - g) * tintAmt; b += (tint.b - b) * tintAmt; }
  data[i] = clamp(r); data[i + 1] = clamp(g); data[i + 2] = clamp(b); data[i + 3] = 255;
}

// --- floor: a textured iso diamond ---
function genFloor(scene: Phaser.Scene, key: string, baseHex: number, theme: FloorTheme, seedKey: number) {
  const w = TILE_W, h = TILE_H;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const cv = scene.textures.createCanvas(key, w, h)!;
  const ctx = cv.getContext();
  const img = ctx.createImageData(w, h);
  const base = hexToRgb(baseHex);
  const accent = hexToRgb(theme.accent);
  const dark = hexToRgb(theme.stroke);
  const cracks = crackSegments(seedKey);
  const cx = w / 2, cy = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const edge = Math.abs(x - cx) / HALF_W + Math.abs(y - cy) / HALF_H; // <=1 inside the diamond
      if (edge > 1) { img.data[i + 3] = 0; continue; }
      let bright = 0.9 + mottle(x, y, seedKey) * 0.34 + (hash2(x, y, seedKey) - 0.5) * 0.12;
      bright *= 1 - Math.max(0, edge - 0.7) * 0.55; // vignette toward the tile rim → depth between tiles
      let tintAmt = 0; let tint: RGB | undefined;
      // hairline cracks
      let cd = 9; for (const s of cracks) cd = Math.min(cd, distToSeg(x, y, s));
      if (cd < 1.1) { bright *= 0.55; tint = dark; tintAmt = 0.4; }
      // sparse moss / mineral flecks in the theme accent
      else if (hash2(x, y, seedKey + 31) > 0.988) { tint = accent; tintAmt = 0.5; bright *= 1.05; }
      setPx(img.data, i, base, bright, tint, tintAmt);
    }
  }
  ctx.putImageData(img, 0, 0);
  cv.refresh();
}

// --- wall: textured top diamond + two shaded faces with brick courses and base AO ---
function genWall(scene: Phaser.Scene, key: string, theme: FloorTheme, seedKey: number) {
  const w = TILE_W, h = TILE_H + WALL_H;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const cv = scene.textures.createCanvas(key, w, h)!;
  const ctx = cv.getContext();
  const img = ctx.createImageData(w, h);
  const top = hexToRgb(theme.wallTop);
  const left = hexToRgb(theme.wallLeft);
  const right = hexToRgb(theme.wallRight);
  const dark = hexToRgb(theme.stroke);
  const cx = w / 2, cy = HALF_H;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inTop = Math.abs(x - cx) / HALF_W + Math.abs(y - cy) / HALF_H <= 1 && y <= TILE_H;
      // face top-edge y for this column (the diamond's lower silhouette)
      const faceTop = x <= HALF_W ? HALF_H + x * (HALF_H / HALF_W) : HALF_H + (TILE_W - x) * (HALF_H / HALF_W);
      const inLeft = !inTop && x <= HALF_W && y >= faceTop && y <= faceTop + WALL_H;
      const inRight = !inTop && x > HALF_W && y >= faceTop && y <= faceTop + WALL_H;
      if (!inTop && !inLeft && !inRight) { img.data[i + 3] = 0; continue; }

      const grain = mottle(x, y, seedKey) * 0.3 + (hash2(x, y, seedKey) - 0.5) * 0.1;
      if (inTop) {
        let bright = 1.02 + grain;
        const edge = Math.abs(x - cx) / HALF_W + Math.abs(y - cy) / HALF_H;
        bright *= 1 - Math.max(0, edge - 0.78) * 0.4;
        setPx(img.data, i, top, bright);
      } else {
        const base = inLeft ? left : right;
        const down = (y - faceTop) / WALL_H; // 0 at top of face, 1 at base
        let bright = 1 + grain;
        bright *= 1 - down * 0.42; // ambient occlusion: faces darken toward the floor
        // horizontal brick courses (in face space) with staggered offset between faces
        const course = (y - faceTop + (inLeft ? 0 : 4)) % 9;
        if (course < 1) bright *= 0.7;
        // a subtle vertical mortar every ~14px
        if (((x + (inLeft ? 0 : 7)) % 14) < 1) bright *= 0.82;
        if (down > 0.9) { bright *= 0.8; } // contact shadow at the very base
        setPx(img.data, i, base, bright, dark, down > 0.92 ? 0.25 : 0);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  cv.refresh();
}

// generate (or regenerate) the three tiled textures for a depth-band theme
export function generateThemeTextures(scene: Phaser.Scene, themeIdx: number, theme: FloorTheme) {
  genFloor(scene, `floor0_t${themeIdx}`, theme.floorA, theme, themeIdx * 101 + 1);
  genFloor(scene, `floor1_t${themeIdx}`, theme.floorB, theme, themeIdx * 101 + 2);
  genWall(scene, `wall_t${themeIdx}`, theme, themeIdx * 101 + 3);
}
