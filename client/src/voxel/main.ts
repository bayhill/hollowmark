// Hollowmark — voxel 3D client (migration in progress; see docs/VOXEL_MIGRATION.md).
//
// A renderer over the REAL Colyseus server: joins the "dungeon" room as a guest,
// reads the same `mapData`/`players`/`monsters` state and `swing`/`mswing` combat
// messages the Phaser client reads, and draws a voxel world with a locked D3 camera.
// The Phaser client (index.html) is untouched and runs in parallel.

import * as THREE from "three";
import { Client, Room, getStateCallbacks } from "colyseus.js";
import { makeMap } from "@hollowmark/common";
import { renderer, scene, camera, followCamera, zoom } from "./scene";
import { buildTerrain } from "./world";
import {
  makeAvatar, updateAvatar, removeAvatar, triggerSwing, type Avatar,
  makeMob, updateMob, removeMob, triggerMobSwing, type Mob,
} from "./entities";

const statusEl = document.getElementById("status")!;
const setStatus = (t: string) => { statusEl.textContent = t; };

const avatars = new Map<string, Avatar>();
const mobs = new Map<string, Mob>();

// --- input: click-to-move (camera is locked; no orbit) --------------------------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let room: Room | null = null;

renderer.domElement.addEventListener("pointerdown", (e) => {
  if (e.button !== 0 || !room) return;
  ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(ground, hit)) room.send("move", { x: hit.x, y: hit.z });
});
renderer.domElement.addEventListener("wheel", (e) => { e.preventDefault(); zoom(e.deltaY); }, { passive: false });

// --- server connection ----------------------------------------------------------
async function connect() {
  try {
    const client = new Client(`ws://${location.hostname}:2567`);
    room = await client.joinOrCreate("dungeon", { cls: "barbarian", name: "VoxelProto", difficulty: 1 });
    setStatus("joined · building the world…");
    const $ = getStateCallbacks(room);

    $(room.state).listen("mapData", (v: string) => {
      if (!v) return;
      const stats = buildTerrain(makeMap(v.split("\n").filter((r) => r.length > 0)));
      setStatus(`Hollowmark · ${stats.floors + stats.walls} voxels · ${avatars.size} heroes`);
    });

    $(room.state).players.onAdd((player: any, key: string) => {
      avatars.set(key, makeAvatar(player, key === room!.sessionId));
    });
    $(room.state).players.onRemove((_p: any, key: string) => {
      const a = avatars.get(key); if (a) removeAvatar(a); avatars.delete(key);
    });

    $(room.state).monsters.onAdd((m: any, id: string) => { mobs.set(id, makeMob(m)); });
    $(room.state).monsters.onRemove((_m: any, id: string) => {
      const mob = mobs.get(id); if (mob) removeMob(mob); mobs.delete(id);
    });

    // combat: the same messages that drive the Phaser client's animations
    room.onMessage("swing", (msg: any) => { const a = avatars.get(msg?.id); if (a) triggerSwing(a); });
    room.onMessage("mswing", (msg: any) => { const m = mobs.get(msg?.id); if (m) triggerMobSwing(m); });
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
  mobs.forEach((m) => updateMob(m, dt));

  const me = room ? avatars.get(room.sessionId) : undefined;
  if (me) followCamera(me.rx, me.rz);

  renderer.render(scene, camera);
}

connect();
animate();
