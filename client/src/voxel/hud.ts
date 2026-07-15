// DOM HUD overlay: health/mana orbs, level, gold, XP, potions. Reads the local
// player schema each frame (P5 — the UI layer over the 3D canvas).
import { xpForNext } from "@hollowmark/common";

const el = (id: string) => document.getElementById(id)!;
const hpfill = el("hpfill"), hpnum = el("hpnum");
const manafill = el("manafill"), mananum = el("mananum");
const lvl = el("lvl"), gold = el("gold"), xpfill = el("xpfill");
const pots = el("pots"), mpots = el("mpots");

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function updateHud(p: any) {
  hpfill.style.height = `${clamp01(p.hp / (p.maxHp || 1)) * 100}%`;
  hpnum.textContent = `${Math.max(0, Math.round(p.hp))}`;
  manafill.style.height = `${clamp01(p.mana / (p.maxMana || 1)) * 100}%`;
  mananum.textContent = `${Math.max(0, Math.round(p.mana))}`;
  lvl.textContent = `Lv ${p.level}`;
  gold.textContent = `${Math.floor(p.gold ?? 0)}g`;
  xpfill.style.width = `${clamp01((p.xp ?? 0) / (xpForNext(p.level) || 1)) * 100}%`;
  pots.textContent = `${p.potions ?? 0}`;
  mpots.textContent = `${p.manaPotions ?? 0}`;
}
