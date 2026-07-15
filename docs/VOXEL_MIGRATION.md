# Goal: migrate Hollowmark to the voxel 3D client

**North star:** the voxel renderer (`client/voxel.html` → `client/src/voxel/`) becomes *the* game — world, players, gear, monsters, NPCs, combat, effects, and UI — while the authoritative Colyseus server and `@hollowmark/common` stay untouched. Atmosphere stays true to the Diablo lineage (fixed isometric camera, torchlit gloom, dread), drawing freely on other voxel/ARPG inspiration for readability and game feel.

**Architecture invariant:** the client is a pure *renderer* over the existing 2D simulation. World `(x, y)` → 3D `(x, 0, z)`, `TILE = 32`. Never fork gameplay into the client; read the same state/messages the Phaser client reads.

**Camera:** locked D3-style — fixed isometric angle, follow-only (no free orbit). Modest zoom is allowed.

## Phases

- [x] **P0 — Slice**: join real server, voxel terrain from `mapData`, class-colored avatars, click-to-move, torch. *(done)*
- [x] **P1 — Camera + player + gear + animation** *(done)*
  - [x] Lock camera to fixed angle, follow-only (modest zoom kept).
  - [x] Humanoid voxel player: head/torso/arms/legs, walk cycle inferred from movement, facing.
  - [x] **Gear reflection**: helm/chest(pauldrons)/boots/offhand-shield + weapon (shape by base category: bow/staff/axe/blade) appear from `*Base` fields; tinted by `gearTier` → rarity color.
  - [x] **Attack animation**: `swing` (players+mercs) / `mswing` (monsters) → weapon arc / lunge.
- [x] **P2 — Monsters**: voxel bodies per `kind`, elite/champion glow + scale, glowing eyes, billboarded health bars, death removal. *(done)*
- [x] **P3 — NPCs, mercs, pets, projectiles** *(done)*
  - [x] Mercs reuse the player avatar (they carry gear); walk + swing.
  - [x] Shrines = town NPCs (vendor/gamble/alchemist/mercnpc/…) as trade-tinted figures, portals/waypoints as glowing obelisks, chests/stash as boxes, all with a soft emissive pulse.
  - [x] Pets (skeleton/wolf/golem/…) and projectiles (arrow + elemental orbs, emissive) with interpolation.
- [~] **P4 — Richer world**: [x] per-theme terrain colors (floor/wall from `FLOOR_THEMES` via `visualThemeFor`, rebuilt each floor). Remaining: water/decor tiles, building height variety, fog-of-war reveal, per-theme fog/lighting & weather.
- [~] **P5 — UI overlay** *(HUD + inventory done)*: [x] bottom HUD — health/mana orbs, level, gold, XP bar, potion counts, hotbar (Q/E/F + R/W). [x] Inventory panel (I/B) — equip/unequip/identify/drop/sort via `loadout` message, rarity-colored, equipping shows gear on the voxel hero. Remaining panels: character sheet, skill tree, vendor/forge, quest log; minimap.
- [x] **Fight input**: right-click (hold) attack toward cursor, Q/E/F skills, R/W potions, T portal, G ping, click-to-loot & click NPC/portal (walk-then-act). Same messages as the Phaser client.
- [~] **P6 — Effects & polish**: [x] floating damage numbers (crit/resisted/incoming), [x] hit-flash squash on struck entities, [x] loot beams. Remaining: particles, screen shake, ability telegraphs, per-theme atmosphere, audio port.
- [ ] **P7 — Cutover**: voxel becomes the default entry; retire Phaser world rendering.

## Notes / signals (from the real code)
- Join: guest is fine — `{ cls, name, difficulty: 1 }`, spawns at `TOWN.spawn`.
- Map: `room.state.mapData` (newline tile rows; `#` solid, `.` walkable) → `makeMap`.
- Players: `players` map — `x,y,cls,name,hp,maxHp,level`, gear `weaponBase/offhandBase/helmBase/chestBase/bootsBase/beltBase`, `gearTier` (RARITY_ORDER index).
- Monsters: `monsters` map — `x,y,hp,maxHp,kind,name,elite,modifier`.
- Combat: server broadcasts `swing` (player attack, `msg.id`), `mswing` (monster), `hit` (damage).
