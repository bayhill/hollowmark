// The view layer: renderer, a LOCKED D3-style camera (fixed isometric angle,
// follow-only), and torchlit gloom. No free orbit — the angle never changes.
import * as THREE from "three";

const app = document.getElementById("app")!;

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
app.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
// dark indigo, not near-black, so distant geometry doesn't vanish into the void
scene.background = new THREE.Color(0x14182a);
scene.fog = new THREE.FogExp2(0x14182a, 0.00055);

export const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 1, 6000);
camera.position.set(400, 560, 400);

// sky/ground ambient fill — bright enough to actually read the room, still cool & moody
const ambient = new THREE.HemisphereLight(0x556688, 0x1a1a24, 1.55);
scene.add(ambient);
// a flat fill so no face falls fully black
const fill = new THREE.AmbientLight(0x404860, 0.55);
scene.add(fill);

// the "moon": the key directional light — gives the voxels form and shadow
export const moon = new THREE.DirectionalLight(0xaebbe0, 1.35);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.near = 10;
moon.shadow.camera.far = 2200;
moon.shadow.bias = -0.0006;
const sc = moon.shadow.camera as THREE.OrthographicCamera;
sc.left = -760; sc.right = 760; sc.top = 760; sc.bottom = -760;
scene.add(moon);
scene.add(moon.target);

// the warm torch that rides with the hero — accent warmth over the cool key light
export const torch = new THREE.PointLight(0xffb060, 5.0, 780, 1.3);
torch.castShadow = true;
torch.shadow.mapSize.set(1024, 1024);
scene.add(torch);

// --- locked camera: fixed angle, follow only, modest zoom -----------------------
const AZ = Math.PI * 0.25; // 45° — the classic isometric bearing
const POLAR = 0.92; // tilt from vertical; fixed (no orbit)
let radius = 660;

export function zoom(deltaY: number) {
  radius = Math.max(360, Math.min(980, radius * (1 + deltaY * 0.001)));
}

const _want = new THREE.Vector3();
export function followCamera(tx: number, tz: number) {
  const ty = 12;
  _want.set(
    tx + radius * Math.sin(POLAR) * Math.cos(AZ),
    ty + radius * Math.cos(POLAR),
    tz + radius * Math.sin(POLAR) * Math.sin(AZ)
  );
  camera.position.lerp(_want, 0.12);
  camera.lookAt(tx, ty, tz);
  torch.position.set(tx, 82, tz);
  moon.position.set(tx - 360, 560, tz - 240);
  moon.target.position.set(tx, 0, tz);
  moon.target.updateMatrixWorld();
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
