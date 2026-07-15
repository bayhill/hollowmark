// Hollowmark — voxel 3D client (migration in progress; see docs/VOXEL_MIGRATION.md).
//
// A renderer + input layer over the REAL Colyseus server. Reads the same state
// (mapData/players/monsters/mercs/shrines/pets/projectiles/loot) and combat
// messages (swing/mswing/hit) the Phaser client uses, and sends the same input
// messages (move/attack/skill/drink/pickup/touchshrine). Locked D3 camera.

import * as THREE from "three";
import { Client, Room, getStateCallbacks } from "colyseus.js";
import { makeMap, visualThemeFor, FLOOR_THEMES } from "@hollowmark/common";
import { renderer, scene, camera, followCamera, zoom } from "./scene";
import { buildTerrain } from "./world";
import {
  makeAvatar, updateAvatar, removeAvatar, triggerSwing, type Avatar,
  makeMob, updateMob, removeMob, triggerMobSwing, type Mob,
  makeShrine, updateShrine, removeShrine, type Shrine,
  makePet, updatePet, removePet, type Pet,
  makeProjectile, updateProjectile, removeProjectile, type Proj,
  makeLoot, updateLoot, removeLoot, type Loot,
} from "./entities";
import { spawnDamage, updateDamageNumbers } from "./fx";

const statusEl = document.getElementById("status")!;
const setStatus = (t: string) => { statusEl.textContent = t; };

const avatars = new Map<string, Avatar>();
const mercs = new Map<string, Avatar>();
const mobs = new Map<string, Mob>();
const shrines = new Map<string, Shrine>();
const pets = new Map<string, Pet>();
const projs = new Map<string, Proj>();
const loots = new Map<string, Loot>();

let room: Room | null = null;

// a click on loot / an NPC walks there first, then acts once in range
let pending: { type: "pickup" | "touchshrine"; id: string; x: number; z: number } | null = null;

// --- picking / input ------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let rightHeld = false;
let lastAttack = 0;

function setNdc(e: { clientX: number; clientY: number }) {
  ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

function groundPoint(): { x: number; z: number } | null {
  raycaster.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane, hit) ? { x: hit.x, z: hit.z } : null;
}

function pickInteractable(): { type: "loot" | "shrine"; id: string; x: number; z: number } | null {
  raycaster.setFromCamera(ndc, camera);
  const groups: THREE.Object3D[] = [];
  loots.forEach((l) => groups.push(l.group));
  shrines.forEach((s) => groups.push(s.group));
  const hits = raycaster.intersectObjects(groups, true);
  for (const h of hits) {
    let o: THREE.Object3D | null = h.object;
    while (o && !(o.userData && o.userData.pick)) o = o.parent;
    if (o && o.userData.pick) return o.userData.pick;
  }
  return null;
}

function attackAt() {
  const g = groundPoint();
  if (g && room) room.send("attack", { x: g.x, y: g.z });
}

renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
renderer.domElement.addEventListener("pointermove", (e) => setNdc(e));

renderer.domElement.addEventListener("pointerdown", (e) => {
  if (!room) return;
  setNdc(e);
  if (e.button === 2) { rightHeld = true; attackAt(); lastAttack = performance.now(); return; } // right = fight
  if (e.button !== 0) return;
  const hit = pickInteractable();
  if (hit) {
    pending = { type: hit.type === "loot" ? "pickup" : "touchshrine", id: hit.id, x: hit.x, z: hit.z };
    room.send("move", { x: hit.x, y: hit.z });
    return;
  }
  const g = groundPoint();
  if (g) { pending = null; room.send("move", { x: g.x, y: g.z }); }
});
window.addEventListener("pointerup", (e) => { if (e.button === 2) rightHeld = false; });
renderer.domElement.addEventListener("wheel", (e) => { e.preventDefault(); zoom(e.deltaY); }, { passive: false });

window.addEventListener("keydown", (e) => {
  if (!room) return;
  const k = e.key.toLowerCase();
  if (k === "q" || k === "e" || k === "f") {
    const g = groundPoint();
    if (g) room.send("skill", { key: e.key.toUpperCase(), x: g.x, y: g.z });
  } else if (k === "r") { room.send("drink"); }
  else if (k === "w") { room.send("drinkmana"); }
  else if (k === "t") { room.send("townportal"); }
  else if (k === "g") { const g = groundPoint(); if (g) room.send("ping", { x: g.x, y: g.z }); }
});

// --- server connection ----------------------------------------------------------
async function connect() {
  try {
    const client = new Client(`ws://${location.hostname}:2567`);
    room = await client.joinOrCreate("dungeon", { cls: "barbarian", name: "VoxelProto", difficulty: 1 });
    setStatus("joined · building the world…");
    const $ = getStateCallbacks(room);

    $(room.state).listen("mapData", (v: string) => {
      if (!v) return;
      const st: any = room!.state;
      const theme = FLOOR_THEMES[visualThemeFor(st.act ?? 1, st.floor ?? 1)] ?? FLOOR_THEMES[0];
      const stats = buildTerrain(makeMap(v.split("\n").filter((r) => r.length > 0)), theme.floorA, theme.wallTop);
      setStatus(`Hollowmark · ${theme.id} · ${stats.floors + stats.walls} voxels`);
    });

    $(room.state).players.onAdd((p: any, key: string) => { avatars.set(key, makeAvatar(p, key === room!.sessionId)); });
    $(room.state).players.onRemove((_p: any, key: string) => { const a = avatars.get(key); if (a) removeAvatar(a); avatars.delete(key); });

    $(room.state).mercs.onAdd((mc: any, id: string) => { mercs.set(id, makeAvatar(mc, false)); });
    $(room.state).mercs.onRemove((_m: any, id: string) => { const a = mercs.get(id); if (a) removeAvatar(a); mercs.delete(id); });

    $(room.state).monsters.onAdd((m: any, id: string) => { mobs.set(id, makeMob(m)); });
    $(room.state).monsters.onRemove((_m: any, id: string) => { const mob = mobs.get(id); if (mob) removeMob(mob); mobs.delete(id); });

    $(room.state).shrines.onAdd((s: any, id: string) => {
      const sh = makeShrine(s);
      sh.group.userData.pick = { type: "shrine", id, x: s.x, z: s.y };
      shrines.set(id, sh);
    });
    $(room.state).shrines.onRemove((_s: any, id: string) => { const sh = shrines.get(id); if (sh) removeShrine(sh); shrines.delete(id); });

    $(room.state).pets.onAdd((p: any, id: string) => { pets.set(id, makePet(p)); });
    $(room.state).pets.onRemove((_p: any, id: string) => { const pet = pets.get(id); if (pet) removePet(pet); pets.delete(id); });

    $(room.state).projectiles.onAdd((p: any, id: string) => { projs.set(id, makeProjectile(p)); });
    $(room.state).projectiles.onRemove((_p: any, id: string) => { const pr = projs.get(id); if (pr) removeProjectile(pr); projs.delete(id); });

    $(room.state).loot.onAdd((g: any, id: string) => {
      const l = makeLoot(g);
      l.group.userData.pick = { type: "loot", id, x: g.x, z: g.y };
      loots.set(id, l);
    });
    $(room.state).loot.onRemove((_g: any, id: string) => { const l = loots.get(id); if (l) removeLoot(l); loots.delete(id); });

    // combat feedback: swings + hit flashes + damage numbers
    room.onMessage("swing", (msg: any) => { const a = avatars.get(msg?.id) ?? mercs.get(msg?.id); if (a) triggerSwing(a); });
    room.onMessage("mswing", (msg: any) => { const m = mobs.get(msg?.id); if (m) triggerMobSwing(m); });
    room.onMessage("hit", (msg: any) => {
      if (typeof msg?.amount === "number" && msg.amount > 0) {
        spawnDamage(msg.x, msg.y, Math.round(msg.amount), {
          crit: !!msg.crit, resisted: !!msg.resisted, toPlayer: msg.t === "p" || msg.t === "c",
        });
      }
      const target = msg?.t === "m" ? mobs.get(msg.id) : msg?.t === "c" ? mercs.get(msg.id) : avatars.get(msg?.id);
      if (target) target.flashT = 0.16;
    });
  } catch (err: any) {
    setStatus(`failed to join: ${err?.message ?? err}`);
    console.error("[voxel] join failed", err);
  }
}

// --- render loop ----------------------------------------------------------------
let last = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  avatars.forEach((a) => updateAvatar(a, dt));
  mercs.forEach((a) => updateAvatar(a, dt));
  mobs.forEach((m) => updateMob(m, dt));
  shrines.forEach((s) => updateShrine(s, dt));
  pets.forEach((p) => updatePet(p));
  projs.forEach((p) => updateProjectile(p));
  loots.forEach((l) => updateLoot(l, dt));
  updateDamageNumbers(dt);

  const me = room ? avatars.get(room.sessionId) : undefined;
  if (me) {
    followCamera(me.rx, me.rz);
    // hold right button to keep attacking toward the cursor
    if (rightHeld && now - lastAttack > 240) { attackAt(); lastAttack = now; }
    // walk-then-act: fire the pending pickup / interaction once in range
    if (pending) {
      const range = pending.type === "pickup" ? 44 : 42;
      if (Math.hypot(me.schema.x - pending.x, me.schema.y - pending.z) < range) {
        room!.send(pending.type, { id: pending.id });
        pending = null;
      }
    }
  }

  renderer.render(scene, camera);
}

connect();
animate();
