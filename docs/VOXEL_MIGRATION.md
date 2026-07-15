# Goal: migrate Hollowmark to the voxel 3D client

**North star:** the voxel renderer (`client/voxel.html` → `client/src/voxel/`) becomes *the* game — world, players, gear, monsters, NPCs, combat, effects, and UI — while the authoritative Colyseus server and `@hollowmark/common` stay untouched. Atmosphere stays true to the Diablo lineage (fixed isometric camera, torchlit gloom, dread), drawing freely on other voxel/ARPG inspiration for readability and game feel.

**Architecture invariant:** the client is a pure *renderer* over the existing 2D simulation. World `(x, y)` → 3D `(x, 0, z)`, `TILE = 32`. Never fork gameplay into the client; read the same state/messages the Phaser client reads.

**Camera:** locked D3-style — fixed isometric angle, follow-only (no free orbit). Modest zoom is allowed.

## Phases

- [x] **P0 — Slice**: join real server, voxel terrain from `mapData`, class-colored avatars, click-to-move, torch. *(done)*
- [~] **P1 — Camera + player + gear + animation** *(in progress)*
  - [x] Lock camera to fixed angle, follow-only.
  - [ ] Humanoid voxel player: head/torso/arms/legs, walk cycle inferred from movement.
  - [ ] **Gear reflection**: helm/chest/weapon/boots appear from `*Base` fields; tinted by `gearTier` → rarity color (progression is visible on the body).
  - [ ] **Combat animation**: hook `swing`/`mswing`/`hit` messages → weapon swing, hit flash.
- [~] **P2 — Monsters**: voxel bodies per `kind`, sized/colored by kind, elite/champion glow, health bars, death removal, monster swings (`mswing`). *(started)*
- [ ] **P3 — NPCs, mercs, pets, projectiles**: town NPCs as voxel figures + buildings/props; mercs (they carry gear like players); pets; projectiles (arrow/fireball) as voxel/particle.
- [ ] **P4 — Richer world**: tile-type/theme variety (grass/stone/sand/water), building height, decor, fog-of-war reveal, per-theme lighting & weather.
- [ ] **P5 — UI overlay**: port the HUD + panels (inventory/character/skills/vendor/forge/quest) to a DOM/HTML overlay above the canvas.
- [ ] **P6 — Effects & polish**: particles, damage numbers, screen shake, ability telegraphs, per-theme atmosphere. (Audio already exists in the Phaser client — reuse/port.)
- [ ] **P7 — Cutover**: voxel becomes the default entry; retire Phaser world rendering.

## Notes / signals (from the real code)
- Join: guest is fine — `{ cls, name, difficulty: 1 }`, spawns at `TOWN.spawn`.
- Map: `room.state.mapData` (newline tile rows; `#` solid, `.` walkable) → `makeMap`.
- Players: `players` map — `x,y,cls,name,hp,maxHp,level`, gear `weaponBase/offhandBase/helmBase/chestBase/bootsBase/beltBase`, `gearTier` (RARITY_ORDER index).
- Monsters: `monsters` map — `x,y,hp,maxHp,kind,name,elite,modifier`.
- Combat: server broadcasts `swing` (player attack, `msg.id`), `mswing` (monster), `hit` (damage).
