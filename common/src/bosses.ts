// The boss roster as pure data. Deliberately a leaf — the Codex builds its bestiary
// from BOSS_NAMES at module-init time, so this must be able to initialise before it.
// (bossKindForFloor stays in index.ts: it needs the floor-theme bands.)

export const BOSS_KIND_LIST = [
  "flenser", "corvessa", "maggotqueen", "malgrim",
  "vessira", "vuruk", "orvath", "aldric", "uldrath", "nyzat", "ssarim",
] as const;
export type BossKind = (typeof BOSS_KIND_LIST)[number];

export function isBossKind(kind: string): boolean {
  return (BOSS_KIND_LIST as readonly string[]).includes(kind) || kind === "bovax";
}

// each depth band rotates its guardians floor by floor — every descent meets a different evil
export const BOSS_BANDS: BossKind[][] = [
  ["flenser", "vessira"],
  ["corvessa", "vuruk"],
  ["maggotqueen", "orvath"],
  ["malgrim", "aldric", "uldrath"],
];

export const BOSS_NAMES: Record<BossKind | "bovax", string> = {
  flenser: "Hargol the Flenser",
  corvessa: "Corvessa, the Carrion Bride",
  maggotqueen: "The Maggot Queen",
  malgrim: "Malgrim, the King of Dread",
  vessira: "Vessira, the Thorned Maiden",
  vuruk: "Vuruk, the White Maw",
  orvath: "Orvath, the Grudge Eternal",
  aldric: "Aldric the Forsworn",
  uldrath: "Uldrath, the Unmaker",
  bovax: "Bovax, Tyrant of the Meadow",
  nyzat: "Queen Nyzat, the Embalmed",
  ssarim: "Ssarim, the Drowned God",
};
