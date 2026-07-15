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
renderer.toneMappingExposure = 1.1;
app.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07070c);
scene.fog = new THREE.FogExp2(0x07070c, 0.0011);

export const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 1, 6000);
camera.position.set(400, 560, 400);

// cold ambient gloom
const ambient = new THREE.HemisphereLight(0x3a4a6a, 0x0a0a12, 0.55);
scene.add(ambient);

// a dim "moon" for soft directional shadows, kept over the hero
export const moon = new THREE.DirectionalLight(0x8496c0, 0.35);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.near = 10;
moon.shadow.camera.far = 2200;
const sc = moon.shadow.camera as THREE.OrthographicCamera;
sc.left = -760; sc.right = 760; sc.top = 760; sc.bottom = -760;
scene.add(moon);
scene.add(moon.target);

// the warm torch that rides with the hero through the dark
export const torch = new THREE.PointLight(0xffb060, 3.2, 680, 1.4);
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
