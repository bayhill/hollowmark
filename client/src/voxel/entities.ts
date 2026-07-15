// Voxel actors: humanoid players (with gear reflected from equipment + a walk
// cycle and attack swing) and monsters. All read live Colyseus schema refs.
import * as THREE from "three";
import { RARITY_ORDER, RARITY_COLORS, type Rarity } from "@hollowmark/common";
import { scene, camera } from "./scene";

const CLASS_COLORS: Record<string, number> = {
  barbarian: 0xc0392b, rogue: 0x27ae60, sorcerer: 0x2f80c9, mage: 0x2f80c9,
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
  flashT: number;
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
    group, schema, rx: schema.x, rz: schema.y, facing: 0, step: 0, swingT: 0, flashT: 0,
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

  // hit flash: a quick squash when struck
  if (av.flashT > 0) {
    av.flashT = Math.max(0, av.flashT - dt);
    const q = av.flashT / 0.16;
    av.group.scale.set(1 + q * 0.18, 1 - q * 0.18, 1 + q * 0.18);
  } else if (av.group.scale.y !== 1) {
    av.group.scale.set(1, 1, 1);
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
  flashT: number;
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
  return { group, schema, rx: schema.x, rz: schema.y, hpFg, bars, swingT: 0, flashT: 0, maxHp: schema.maxHp || 1 };
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

  if (mob.flashT > 0) {
    mob.flashT = Math.max(0, mob.flashT - dt);
    const q = mob.flashT / 0.16;
    mob.group.scale.set(1 + q * 0.2, 1 - q * 0.2, 1 + q * 0.2);
  } else if (mob.group.scale.y !== 1) {
    mob.group.scale.set(1, 1, 1);
  }
}

export function removeMob(mob: Mob) { scene.remove(mob.group); disposeObject(mob.group); }

// ============================================================ SHRINES / NPCS

const SHRINE_ACCENT: Record<string, number> = {
  gamble: 0xd8b13a, riftportal: 0xb060ff, riftexit: 0x60d0a0, cowportal: 0xd83a3a,
  waypoint: 0x6a8cff, caravan: 0xc08a4a, alchemist: 0x7fdc9f, vendor: 0xd8a868,
  mercnpc: 0xc03848, storyteller: 0xc9a44a, barkeep: 0xe0a850, encounter: 0x8a7ab0,
  areaportal: 0xc8a860, stash: 0x6a5a8f, chest: 0x8f6a34, healing: 0x50d0a0,
};
const NPC_KINDS = new Set(["vendor", "gamble", "alchemist", "mercnpc", "caravan", "storyteller", "barkeep"]);
const PORTAL_KINDS = new Set(["riftportal", "riftexit", "cowportal", "areaportal"]);

export interface Shrine { group: THREE.Group; schema: any; kind: string; glowMat?: THREE.MeshStandardMaterial; t: number; }

export function makeShrine(schema: any): Shrine {
  const kind = String(schema.kind);
  const accent = SHRINE_ACCENT[kind] ?? 0x8a8a96;
  const group = new THREE.Group();
  group.position.set(schema.x, 0, schema.y);
  let glowMat: THREE.MeshStandardMaterial | undefined;

  if (NPC_KINDS.has(kind)) {
    const robe = new THREE.Mesh(new THREE.BoxGeometry(15, 24, 11), mat(accent, accent, 0.28));
    robe.position.y = 15; robe.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), mat(0xe8c8a0));
    head.position.y = 32; head.castShadow = true;
    group.add(robe, head);
    glowMat = robe.material as THREE.MeshStandardMaterial;
  } else if (kind === "chest" || kind === "stash") {
    const wood = kind === "stash" ? 0x6a5a8f : 0x7a5a2c;
    const body = new THREE.Mesh(new THREE.BoxGeometry(22, 14, 16), mat(wood));
    body.position.y = 7; body.castShadow = true;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(23, 6, 17), mat(wood, accent, 0.2));
    lid.position.y = 16;
    group.add(body, lid);
  } else if (PORTAL_KINDS.has(kind) || kind === "waypoint") {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(14, 48, 14), mat(0x1a1a24, accent, 0.7));
    pillar.position.y = 24; pillar.castShadow = true;
    group.add(pillar);
    glowMat = pillar.material as THREE.MeshStandardMaterial;
  } else {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(10, 20, 10), mat(0x2a2a34, accent, 0.6));
    marker.position.y = 10; group.add(marker);
    glowMat = marker.material as THREE.MeshStandardMaterial;
  }
  scene.add(group);
  return { group, schema, kind, glowMat, t: Math.random() * 6 };
}

export function updateShrine(sh: Shrine, dt: number) {
  sh.t += dt;
  if (sh.glowMat) sh.glowMat.emissiveIntensity = 0.4 + Math.sin(sh.t * 2.2) * 0.2;
}
export function removeShrine(sh: Shrine) { scene.remove(sh.group); disposeObject(sh.group); }

// ============================================================ PETS

const PET_STYLE: Record<string, { color: number; h: number; w: number }> = {
  skeleton: { color: 0xd8d2c0, h: 22, w: 12 },
  wolf: { color: 0x6a5a4a, h: 15, w: 22 },
  golem: { color: 0x5a5a66, h: 30, w: 22 },
  spirit: { color: 0x8ad0e0, h: 20, w: 12 },
  raven: { color: 0x2a2a34, h: 10, w: 14 },
};

export interface Pet { group: THREE.Group; schema: any; rx: number; rz: number; }

export function makePet(schema: any): Pet {
  const st = PET_STYLE[String(schema.kind)] ?? { color: 0x9a9aa6, h: 18, w: 14 };
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(st.w, st.h, st.w * 0.8), mat(st.color));
  body.position.y = st.h / 2; body.castShadow = true; group.add(body);
  group.position.set(schema.x, 0, schema.y);
  scene.add(group);
  return { group, schema, rx: schema.x, rz: schema.y };
}
export function updatePet(p: Pet) {
  p.rx += (p.schema.x - p.rx) * 0.25; p.rz += (p.schema.y - p.rz) * 0.25;
  p.group.position.set(p.rx, 0, p.rz);
}
export function removePet(p: Pet) { scene.remove(p.group); disposeObject(p.group); }

// ============================================================ PROJECTILES

const PROJ_STYLE: Record<string, { color: number; emissive: number; size: number }> = {
  fireball: { color: 0xff8030, emissive: 0xff5010, size: 10 },
  frostbolt: { color: 0x80c0ff, emissive: 0x3080ff, size: 8 },
  ice: { color: 0x80c0ff, emissive: 0x3080ff, size: 8 },
  lightning: { color: 0xd8f0ff, emissive: 0x90b0ff, size: 7 },
  poison: { color: 0x9ad060, emissive: 0x60a020, size: 8 },
  bolt: { color: 0xffe090, emissive: 0xffc040, size: 7 },
};

export interface Proj { group: THREE.Group; schema: any; rx: number; rz: number; arrow: boolean; }

export function makeProjectile(schema: any): Proj {
  const kind = String(schema.kind);
  const group = new THREE.Group();
  const arrow = kind === "arrow";
  if (arrow) {
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.5, 18), mat(0x8a6a3a, 0x201810, 0.2));
    group.add(shaft);
  } else {
    const st = PROJ_STYLE[kind] ?? { color: 0xffffff, emissive: 0xaaaaaa, size: 8 };
    const orb = new THREE.Mesh(new THREE.BoxGeometry(st.size, st.size, st.size), mat(st.color, st.emissive, 1.3));
    group.add(orb);
  }
  group.position.set(schema.x, 18, schema.y);
  scene.add(group);
  return { group, schema, rx: schema.x, rz: schema.y, arrow };
}
export function updateProjectile(pr: Proj) {
  const dx = pr.schema.x - pr.rx, dz = pr.schema.y - pr.rz;
  pr.rx += dx * 0.5; pr.rz += dz * 0.5;
  pr.group.position.set(pr.rx, 18, pr.rz);
  if (pr.arrow) { if (Math.hypot(dx, dz) > 0.1) pr.group.rotation.y = Math.atan2(dx, dz); }
  else pr.group.rotation.y += 0.35;
}
export function removeProjectile(pr: Proj) { scene.remove(pr.group); disposeObject(pr.group); }

// ============================================================ GROUND LOOT

export interface Loot { group: THREE.Group; schema: any; orb?: THREE.Object3D; t: number; }

export function makeLoot(schema: any): Loot {
  const kind = String(schema.kind); // "item" | "potion" | "gold"
  const color = RARITY_COLORS[String(schema.rarity) as Rarity] ?? 0xd0d0d0;
  const group = new THREE.Group();
  group.position.set(schema.x, 0, schema.y);
  let orb: THREE.Object3D | undefined;

  if (kind === "gold") {
    const coins = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 12), mat(0xd8b13a, 0xd8b13a, 0.5));
    coins.position.y = 3; coins.castShadow = true; group.add(coins);
  } else if (kind === "potion") {
    const flask = new THREE.Mesh(new THREE.BoxGeometry(6, 10, 6), mat(0xc03838, 0xc03838, 0.5));
    flask.position.y = 6; flask.castShadow = true; group.add(flask); orb = flask;
  } else {
    // a rarity-colored loot beam + a slowly bobbing item mote (Diablo's "a beam lit up")
    const beamMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 130, 6, 1, true), beamMat);
    beam.position.y = 65;
    const mote = new THREE.Mesh(new THREE.BoxGeometry(11, 11, 11), mat(0x1a1a22, color, 0.9));
    mote.position.y = 16; mote.castShadow = true;
    group.add(beam, mote); orb = mote;
  }
  scene.add(group);
  return { group, schema, orb, t: Math.random() * 6 };
}

export function updateLoot(l: Loot, dt: number) {
  l.t += dt;
  if (l.orb) { l.orb.rotation.y += dt * 1.4; l.orb.position.y = 16 + Math.sin(l.t * 2.2) * 2.5; }
}
export function removeLoot(l: Loot) { scene.remove(l.group); disposeObject(l.group); }
