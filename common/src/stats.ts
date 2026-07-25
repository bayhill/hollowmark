// The stat bag every piece of gear, rune, set, jewel and Codex boon contributes to,
// and the one operation that combines them. A pure leaf: no imports, no data tables —
// so anything may depend on it without risking an import cycle.

export interface ItemStats {
  dmg?: number;
  dmgPct?: number;
  armor?: number;
  maxHp?: number;
  maxMana?: number;
  atkSpd?: number;
  moveSpd?: number;
  regen?: number;
  magicFind?: number;
  // advanced attributes
  crit?: number; // % chance to deal double damage
  lifeSteal?: number; // % of damage dealt returned as life
  manaSteal?: number; // % of damage dealt returned as mana
  thorns?: number; // flat damage reflected to melee attackers
  fireDmg?: number; // flat fire damage added to attacks
  coldDmg?: number; // flat cold damage — also chills targets
  lightDmg?: number; // lightning: adds 0..2N random damage (swingy, D2-style)
  xpBonus?: number; // % bonus experience
  goldFind?: number; // % more gold from kills
  cdr?: number; // % cooldown reduction (attacks + skills, capped 40%)
  potionPower?: number; // % stronger health potions
  dodge?: number; // % chance to avoid a hit entirely (capped)
  manaRegen?: number; // bonus mana per second
  fireRes?: number; // % fire damage reduction (capped)
  coldRes?: number; // % cold damage reduction — also shortens chills
  lightRes?: number; // % lightning damage reduction
  allRes?: number; // adds to all three
  plusSkills?: number; // +N ranks to every skill you've learned (never enables an unlearned one)
  penetration?: number; // % of a monster's elemental resistance your attacks ignore
}

export function addStats(into: ItemStats, from: ItemStats) {
  for (const [k, v] of Object.entries(from) as Array<[keyof ItemStats, number]>) {
    into[k] = (into[k] ?? 0) + v;
  }
}
