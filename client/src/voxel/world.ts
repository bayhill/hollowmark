// Terrain: extrude the server's tile string into instanced voxel blocks.
// `#` = solid (wall/tree/building) → tall block; `.` = walkable → floor slab.
import * as THREE from "three";
import { TILE, type GameMap } from "@hollowmark/common";
import { scene } from "./scene";

let terrain: THREE.Group | null = null;

function tileHash(tx: number, ty: number): number {
  const v = Math.sin(tx * 127.1 + ty * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

function disposeGroup(g: THREE.Group) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => mm.dispose());
  });
}

function instanced(
  tiles: Array<[number, number]>, height: number, baseColor: number, yCenter: number, cast: boolean
): THREE.InstancedMesh {
  const geo = new THREE.BoxGeometry(TILE, height, TILE);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0.0, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, tiles.length));
  mesh.count = tiles.length;
  mesh.receiveShadow = true;
  mesh.castShadow = cast;
  const m = new THREE.Matrix4();
  const col = new THREE.Color();
  const base = new THREE.Color(baseColor);
  tiles.forEach(([tx, ty], i) => {
    m.makeTranslation(tx * TILE + TILE / 2, yCenter, ty * TILE + TILE / 2);
    mesh.setMatrixAt(i, m);
    col.copy(base).multiplyScalar(0.82 + tileHash(tx, ty) * 0.36);
    mesh.setColorAt(i, col);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

export function buildTerrain(
  map: GameMap, floorColor = 0x2b3040, wallColor = 0x4a4560
): { floors: number; walls: number } {
  if (terrain) { scene.remove(terrain); disposeGroup(terrain); }
  terrain = new THREE.Group();
  const floors: Array<[number, number]> = [];
  const walls: Array<[number, number]> = [];
  for (let ty = 0; ty < map.h; ty++) {
    const row = map.rows[ty] ?? "";
    for (let tx = 0; tx < map.w; tx++) {
      const c = row.charAt(tx);
      if (c === "#") walls.push([tx, ty]);
      else if (c === ".") floors.push([tx, ty]);
    }
  }
  terrain.add(instanced(floors, 8, floorColor, -4, false)); // floor slabs, top at y=0
  terrain.add(instanced(walls, 54, wallColor, 27, true)); // wall blocks, base at y=0
  scene.add(terrain);
  return { floors: floors.length, walls: walls.length };
}
