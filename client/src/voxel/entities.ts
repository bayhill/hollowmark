// Voxel actors: humanoid players (with gear reflected from equipment + a walk
// cycle and attack swing) and monsters. All read live Colyseus schema refs.
import * as THREE from "three";
import { RARITY_ORDER, RARITY_COLORS, type Rarity } from "@hollowmark/common";
import { scene, camera } from "./scene";

const CLASS_COLORS: Record<string, number> = {
  barbarian: 0xc0392b, rogue: 0x27ae60, sorcerer: 0x2f80c9,
  paladin: 0xc9a227, necromancer: 0x6a8f7a, druid: 0x9a6a3a,
};

const SWING_DUR = 0.34; // seconds

function mat(color: number, emissive = 0x000000, emissiveIntensity = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, flatShading: true, emissive, emissiveIntensity });
}

function disposeObject(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm.dispose());
  });
}

// gearTier is an index into RARITY_ORDER — the hero's best-equipped rarity
function tierColor(gearTier: number): number {
  const r = RARITY_ORDER[Math.max(0, Math.min(RARITY_ORDER.length - 1, gearTier | 0))] as Rarity;
  return RARITY_COLORS[r];
}

// a limb: a box hanging from a pivot group, so it swings from the joint
function limb(w: number, h: number, d: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  box.position.y = -h / 2;
  box.castShadow = true;
  g.add(box);
  return g;
}

// ============================================================ PLAYERS / MERCS

export interface Avatar {
  group: THREE.Group;
  schema: any;
  rx: number; rz: number;
  facing: number;
  step: number;
  swingT: number;
  gearSig: string;
  armR: THREE.Group; armL: THREE.Group; legR: THREE.Group; legL: THREE.Group;
  gearMeshes: THREE.Object3D[];
  local: boolean;
}

function weaponKind(base: string): "bow" | "staff" | "axe" | "blade" {
  if (/bow|crossbow/.test(base)) return "bow";
  if (/staff|wand|scepter|rod/.test(base)) return "staff";
  if (/axe|maul|hammer|star|mace|club/.test(base)) return "axe";
  return "blade";
}

export function makeAvatar(schema: any, local: boolean): Avatar {
  const cls = String(schema.cls ?? "");
  const tunic = CLASS_COLORS[cls] ?? 0x9a9aa6;
  const skin = 0xe8c8a0;
  const group = new THREE.Group();

  const torso = new THREE.Mesh(new THREE.BoxGeometry(16, 20, 11), mat(tunic));
  torso.position.y = 23; torso.castShadow = true; group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(11, 11, 11), mat(skin));
  head.position.y = 39; head.castShadow = true; group.add(head);

  const armR = limb(5, 16, 5, tunic); armR.position.set(10.5, 32, 0); group.add(armR);
  const armL = limb(5, 16, 5, tunic); armL.position.set(-10.5, 32, 0); group.add(armL);
  const legR = limb(6, 13, 6, 0x30303c); legR.position.set(4, 13, 0); group.add(legR);
  const legL = limb(6, 13, 6, 0x30303c); legL.position.set(-4, 13, 0); group.add(legL);

  const av: Avatar = {
    group, schema, rx: schema.x, rz: schema.y, facing: 0, step: 0, swingT: 0,
    gearSig: "", armR, armL, legR, legL, gearMeshes: [], local,
  };
  buildGear(av);
  scene.add(group);
  return av;
}

function gearSig(s: any): string {
  return [s.helmBase, s.chestBase, s.weaponBase, s.offhandBase, s.bootsBase, s.gearTier].join("|");
}

// re-attach visible gear whenever equipment changes — progression on the body
function buildGear(av: Avatar) {
  const s = av.schema;
  const sig = gearSig(s);
  if (sig === av.gearSig) return;
  av.gearSig = sig;
  for (const m of av.gearMeshes) { m.parent?.remove(m); disposeObject(m); }
  av.gearMeshes = [];

  const tint = tierColor(s.gearTier ?? 0);
  const metal = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.55, flatShading: true, emissive: tint, emissiveIntensity: 0.18 });
  const add = (mesh: THREE.Object3D, parent: THREE.Object3D) => { parent.add(mesh); av.gearMeshes.push(mesh); };

  if (s.helmBase) {
    const helm = new THREE.Mesh(new THREE.BoxGeometry(12.5, 7, 12.5), metal(0x8a8a96));
    helm.position.y = 44; helm.castShadow = true; add(helm, av.group);
  }
  if (s.chestBase) {
    const padR = new THREE.Mesh(new THREE.BoxGeometry(7, 6, 13), metal(0x9a9aa8));
    padR.position.set(11, 33, 0); add(padR, av.group);
    const padL = padR.clone(); padL.position.x = -11; add(padL, av.group);
  }
  if (s.bootsBase) {
    const bootR = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 8), metal(0x6a6a76));
    bootR.position.y = -13; add(bootR, av.legR);
    const bootL = bootR.clone(); add(bootL, av.legL);
  }
  if (s.offhandBase) {
    const shield = new THREE.Mesh(new THREE.BoxGeometry(2.5, 15, 12), metal(0x88707a));
    shield.position.set(-3, -15, 2); add(shield, av.armL);
  }
  if (s.weaponBase) {
    const kind = weaponKind(String(s.weaponBase));
    const w = new THREE.Group();
    if (kind === "bow") {
      const stave = new THREE.Mesh(new THREE.BoxGeometry(2, 30, 3), metal(0x8a5a34));
      w.add(stave);
    } else if (kind === "staff") {
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(2.5, 34, 2.5), metal(0x7a5a3a));
      shaft.position.y = -6;
      const tip = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), metal(tint)); tip.position.y = 12;
      w.add(shaft, tip);
    } else if (kind === "axe") {
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(2.5, 24, 2.5), metal(0x6a4a2a)); shaft.position.y = -4;
      const headBlade = new THREE.Mesh(new THREE.BoxGeometry(10, 9, 3), metal(0xb8b8c4)); headBlade.position.set(4, 4, 0);
      w.add(shaft, headBlade);
    } else {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(2.5, 26, 3.5), metal(0xc4c4d0)); blade.position.y = -6;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(9, 2.5, 3), metal(0x8a7a4a)); guard.position.y = 6;
      w.add(blade, guard);
    }
    w.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
    w.position.set(0, -15, 2); // in the right hand
    add(w, av.armR);
  }
}

export function triggerSwing(av: Avatar) { av.swingT = SWING_DUR; }

export function updateAvatar(av: Avatar, dt: number) {
  const s = av.schema;
  buildGear(av);

  const dx = s.x - av.rx, dz = s.y - av.rz;
  const dist = Math.hypot(dx, dz);
  av.rx += dx * 0.25; av.rz += dz * 0.25;
  av.group.position.set(av.rx, 0, av.rz);

  // face the way we're heading
  if (dist > 0.6) {
    const want = Math.atan2(dx, dz);
    let d = want - av.facing;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    av.facing += d * 0.25;
    av.group.rotation.y = av.facing;
  }

  // walk cycle: legs and arms counter-swing while moving
  const moving = dist > 0.8;
  if (moving) av.step += dt * 9;
  else av.step *= 0.8;
  const sw = Math.sin(av.step) * (moving ? 0.5 : av.step * 0);
  av.legR.rotation.x = sw;
  av.legL.rotation.x = -sw;
  av.armL.rotation.x = sw * 0.8;

  // attack swing overrides the right arm
  if (av.swingT > 0) {
    av.swingT = Math.max(0, av.swingT - dt);
    const p = 1 - av.swingT / SWING_DUR; // 0..1
    av.armR.rotation.x = -Math.sin(p * Math.PI) * 1.9; // a quick overhand cut
  } else {
    av.armR.rotation.x = -sw * 0.8;
  }
}

export function removeAvatar(av: Avatar) { scene.remove(av.group); disposeObject(av.group); }

// ============================================================ MONSTERS

interface MobStyle { color: number; h: number; w: number; }
const MOB_STYLES: Record<string, MobStyle> = {
  zombie: { color: 0x6a8f5a, h: 34, w: 19 },
  skeleton: { color: 0xd8d2c0, h: 34, w: 15 },
  imp: { color: 0xb0402a, h: 22, w: 15 },
  spineback: { color: 0x8a6a3a, h: 24, w: 22 },
  goblin: { color: 0x4a8f5a, h: 20, w: 15 },
  bat: { color: 0x5a4a6a, h: 14, w: 16 },
  demon: { color: 0x902020, h: 46, w: 27 },
  mudling: { color: 0x6a5a3a, h: 22, w: 20 },
  scarab: { color: 0x3a6a7a, h: 16, w: 20 },
  doomguard: { color: 0x7a2a3a, h: 42, w: 26 },
};
const DEFAULT_MOB: MobStyle = { color: 0x8a5a6a, h: 30, w: 20 };

export interface Mob {
  group: THREE.Group;
  schema: any;
  rx: number; rz: number;
  hpFg: THREE.Mesh;
  bars: THREE.Group;
  swingT: number;
  maxHp: number;
}

export function makeMob(schema: any): Mob {
  const style = MOB_STYLES[String(schema.kind)] ?? DEFAULT_MOB;
  const elite = !!schema.elite || !!schema.modifier;
  const scale = elite ? 1.4 : 1;
  const group = new THREE.Group();

  const bodyColor = elite ? new THREE.Color(style.color).lerp(new THREE.Color(0xffffff), 0.15).getHex() : style.color;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(style.w * scale, style.h * 0.62 * scale, style.w * 0.8 * scale),
    mat(bodyColor, elite ? 0xff5030 : 0x000000, elite ? 0.25 : 0)
  );
  body.position.y = style.h * 0.35 * scale; body.castShadow = true; group.add(body);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(style.w * 0.6 * scale, style.h * 0.3 * scale, style.w * 0.6 * scale),
    mat(bodyColor)
  );
  head.position.y = style.h * 0.78 * scale; head.castShadow = true; group.add(head);
  // two glowing eyes
  const eyeGeo = new THREE.BoxGeometry(2.2, 2.2, 1);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff3020, emissive: 0xff2010, emissiveIntensity: 1.4 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(sx * style.w * 0.16 * scale, style.h * 0.8 * scale, style.w * 0.3 * scale);
    group.add(eye);
  }

  // health bar (billboarded to the fixed camera)
  const bars = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(26, 3.4), new THREE.MeshBasicMaterial({ color: 0x120a0a }));
  const hpFg = new THREE.Mesh(new THREE.PlaneGeometry(24, 2.2), new THREE.MeshBasicMaterial({ color: 0xd04040 }));
  hpFg.position.z = 0.1;
  bars.add(bg, hpFg);
  bars.position.y = style.h * scale + 12;
  group.add(bars);

  scene.add(group);
  return { group, schema, rx: schema.x, rz: schema.y, hpFg, bars, swingT: 0, maxHp: schema.maxHp || 1 };
}

export function triggerMobSwing(mob: Mob) { mob.swingT = 0.28; }

export function updateMob(mob: Mob, dt: number) {
  const s = mob.schema;
  mob.rx += (s.x - mob.rx) * 0.25;
  mob.rz += (s.y - mob.rz) * 0.25;
  // a small forward lunge on attack
  let lunge = 0;
  if (mob.swingT > 0) { mob.swingT = Math.max(0, mob.swingT - dt); lunge = Math.sin((1 - mob.swingT / 0.28) * Math.PI) * 6; }
  mob.group.position.set(mob.rx, lunge * 0.3, mob.rz);

  const frac = Math.max(0, Math.min(1, s.hp / (mob.maxHp || 1)));
  mob.hpFg.scale.x = Math.max(0.001, frac);
  mob.hpFg.position.x = -(1 - frac) * 12; // shrink from the right
  (mob.hpFg.material as THREE.MeshBasicMaterial).color.setHex(frac > 0.5 ? 0x50c050 : frac > 0.25 ? 0xd0b040 : 0xd04040);
  mob.bars.quaternion.copy(camera.quaternion); // face the camera
}

export function removeMob(mob: Mob) { scene.remove(mob.group); disposeObject(mob.group); }
