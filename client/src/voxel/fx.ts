// Combat FX: floating damage numbers driven by the server's `hit` message.
import * as THREE from "three";
import { scene } from "./scene";

interface DmgNum { sprite: THREE.Sprite; life: number; max: number; vy: number; }
const nums: DmgNum[] = [];

function textTexture(text: string, color: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.font = "bold 44px monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = 7; ctx.strokeStyle = "rgba(0,0,0,0.92)";
  ctx.strokeText(text, 64, 34);
  ctx.fillStyle = color; ctx.fillText(text, 64, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export function spawnDamage(
  x: number, z: number, amount: number, opts: { crit?: boolean; resisted?: boolean; toPlayer?: boolean }
) {
  const color = opts.resisted ? "#8aa0c0" : opts.toPlayer ? "#ff6a5a" : opts.crit ? "#ffb030" : "#f0f0f0";
  const tex = textTexture(opts.crit ? `${amount}!` : `${amount}`, color);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  const s = opts.crit ? 34 : 24;
  spr.scale.set(s * 2, s, 1);
  spr.position.set(x + (Math.random() * 16 - 8), 46, z + (Math.random() * 16 - 8));
  spr.renderOrder = 999;
  scene.add(spr);
  nums.push({ sprite: spr, life: 0, max: 0.85, vy: 52 });
}

export function updateDamageNumbers(dt: number) {
  for (let i = nums.length - 1; i >= 0; i--) {
    const n = nums[i];
    n.life += dt;
    n.sprite.position.y += n.vy * dt;
    n.vy *= 0.92;
    (n.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - n.life / n.max);
    if (n.life >= n.max) {
      scene.remove(n.sprite);
      const m = n.sprite.material as THREE.SpriteMaterial;
      m.map?.dispose(); m.dispose();
      nums.splice(i, 1);
    }
  }
}
