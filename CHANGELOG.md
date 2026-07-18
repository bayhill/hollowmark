# Overnight changelog

The night shift's log — newest at the bottom. Everything here passed typecheck + `npm run smoke` before landing.

## Iteration 1 — Elites & the Treasure Goblin (random encounters)

- **Named elite monsters**: each camp's pack leader has a 15% chance to spawn as a gold-named elite — "Gorefang the Cruel", "Skullmaw the Unclean", etc. 2.5× hp, 1.4× damage, 1.15× speed, 4× XP, pulsing gold aura, and a **guaranteed drop from the boss loot table** (never common). Risk you can see coming from across the room.
- **Treasure Goblin**: 40% chance per floor that one is lurking near a camp. It doesn't fight — it *runs* (slightly slower than you, so a clean chase catches it) and **portals out after 9 seconds** of being chased. Catch it: 3 items from the boss table + 2 potions explode out of it. Miss it: the "goblin escapes" and you think about it for the rest of the run.
- Smoke test now survives dying mid-grind (respawn-aware pathfinding) and avoids elites at low level, like any sensible level-1 barbarian.

## Iteration 2 — Floor themes, named zones & shrines (worldbuilding + encounters)

- **Depth bands, D1-style**: floors 1–3 are the **Cathedral** (cold gray-blue stone), 4–6 the **Catacombs** (mossy green), 7–9 the **Caves** (torchlit earth), 10+ **Hell** (crimson). Each band has its own procedurally-generated tile palette.
- **Named zones**: every floor gets a name from its theme's pool — descend into "The Festering Warrens", "Bonegrinder Crypts", "The Sunless Deep", "The Burning Threshold"… shown in the HUD and on the floor-transition banner.
- **Shrines**: 1–2 per floor, tucked into room corners, glowing in the theme's accent color. Click to walk over and touch — one use, first come first served (co-op etiquette applies): Healing (full life), Mana, **Blessed** (+40% damage 30s), **Fortune** (+50% magic find 60s — pop it before a boss!), **Haste** (+25% move speed 30s), **Knowledge** (instant XP scaled by floor). Classic messages float up: "Fortune smiles upon you."
- Smoke test verifies zone names and walks to + consumes a shrine.

## Iteration 3 — A boss for every depth (more bosses)

Each depth band now has its own stairs guardian, with a shouted intro line and its own mechanics:

- **The Butcher** (Cathedral, 1–3) — the classic: fast, huge melee hits. "FRESH MEAT!"
- **Blood Raven** (Catacombs, 4–6) — the game's **first ranged enemy**: fires crimson arrows from 220 units out and *kites away* if you close the distance. Corner her or eat arrows. "Join my army of the dead!"
- **The Maggot Queen** (Caves, 7–9) — slow, tanky, and births 2 broodlings every 6 seconds while in combat (up to 6 alive). Kill the adds or drown. "The brood hungers!"
- **The Lord of Terror** (Hell, 10+) — 800 hp, hits like the end of the world, and charges a **fire nova** every 5 seconds: red warning ring, 1.2 seconds to get out, then the room explodes. "Not even death can save you!"

All bosses share the boosted loot table, scale with floor, and respawn after 60s. Hostile projectiles are a new server-side system (monster arrows collide with players), which future ranged trash mobs can reuse.

## Iteration 4 — Set items & charms (more loot)

- **Set items** — a new **green** rarity between rare and unique. Two sets to start:
  - *Sigon's Complete Steel* (3 pieces: Visor / Shelter / Wrap) — full set: **+25% damage, +20 life, +25% magic find**
  - *Death's Disguise* (2 pieces: Death's Hand / Death's Guard) — full set: **+15% damage, +10% magic find**
  - Tooltips show set progress ("Sigon's Complete Steel (2/3)") and light the bonus lines green when complete. Set pieces drop with a beam, from the normal table (rarely) and boss/elite/goblin tables (notably).
- **Charms** — Small / Large / Grand Charms (1/2/3 affixes) that grant their stats **just by sitting in your inventory**, D2-style. Blue or yellow, ~8% drop chance from any kill; treasure goblins always cough one up. The inventory-space-vs-power tension is now real.
- Smoke test hardened: every walk-and-interact step is now death-tolerant (respawn and retry) — the dungeon got dangerous enough that the test barbarian kept getting murdered, which honestly says good things about the game.

## Iteration 5 — Level-5 skills (skill expansion)

Reaching level 5 now unlocks a third skill on **F** (the hotbar shows it locked with "lvl 5" until then — something to look forward to):

- **Barbarian: Leap Slam** — jump to the cursor (180 range), land for 1.2× AoE damage and **knock the whole pack back** 40 units. Engage tool and panic button in one.
- **Rogue: Impaling Shot** — a shot that **pierces every monster in a 300-unit line**. Line up a corridor of skeletons and enjoy.
- **Sorcerer: Frost Nova** — the D2 classic: AoE burst around you that **slows everything by 50% for 3 seconds**. Monsters now have a chill mechanic server-side (works on bosses — kite the Butcher with it).

Skill unlock levels are server-validated; the smoke test confirms F is rejected at level 1.

## Iteration 6 — Gold & Gheed's Gamble (economy)

- **Gold drops**: ~60% of kills drop a gold pile (amount scales with floor), elites drop 4× piles, bosses shower 3 big piles, treasure goblins burst into 4. Click to scoop; coin *kaching* on pickup; gold counter lives next to your health bar.
- **Gheed's Gamble**: a gold altar near every floor's entrance. Pay the toll (200g on floor 1, +100 per floor) and an **unidentified-odds item drops at your feet** — never common: 55% magic, 30% rare, 6% set, 6% unique, 2% legendary, **1% epic**. Reusable. This is the gold sink, the slot machine, and the reason to clear one more camp before bed. Gheed would be proud; refuses the penniless with a red "Need 200 gold".
- Smoke test: picks up gold e2e, verifies the altar rejects a broke barbarian without touching the balance, and now targets the *newest* drops so nothing despawns mid-test.

## Iteration 7 — Ancient Chests & lore tomes (encounters + worldbuilding)

- **Ancient Chests**: 1–3 per floor, tucked into room corners. Open one and roll the dice:
  - **55% treasure** — 1–2 items + gold
  - **30% CURSED** — "A trap!": 3–5 monsters erupt around the chest, already angry (consolation gold so it never feels purely cruel)
  - **15% JACKPOT** — gold flash, screen shake, 2 boss-table items and a shower of gold piles
- **Lore tomes**: ~50% of floors hide an Ancient Tome. Reading it grants a scrap of XP and shows a line of the world to everyone, themed to the depth — *"The candles here burn without wicks. The faithful never left."* / *"We dug too greedily. The maggots came for the sweetness."*
- Charm naming fixed (prefix charms read "Vital Small Charm", not "Small Charm of Vital").
- Smoke test grew survival instincts: it fights back while walking, drinks potions when low, and counts combat by XP earned rather than a fragile kill counter. It opened a chest this run, got ambushed, and won.

## Iteration 8 — The automap (QoL / worldbuilding)

- **Minimap**, top-right, toggle with **M** — procedural floors finally readable at a glance. Floor layout tinted to the current theme with an accent border; white dot = you, green = party, red = monsters (gold = elites/goblin, big = boss), purple = the stairs, theme-colored = unused shrines, gold-blinking = **rare-or-better loot on the ground** so you never walk away from a beam.
- Hides itself while the inventory is open; static layer redraws only on floor change, live dots every frame.

## Iteration 9 — Champion packs (encounters)

- 20% of camps now spawn as a **champion pack**: every member shares one modifier, blue aura and blue name, D2-style. The roster:
  - **Frenzied** — 1.5× move speed (the scary one)
  - **Brutal** — 1.6× damage
  - **Stoneskin** — 2× life, slightly slow
  - **Ghostly** — translucent, fast, hits harder but dies easier
  - **Fanatic** — attacks nearly twice as fast
- Champions give 2× XP, 2× gold, and a 30% bonus item roll per kill — worth hunting, dangerous to facetank. They show as blue dots on the automap.
- Champion packs replace the elite-leader roll for that camp (one flavor per camp keeps fights readable).

## Iteration 10 — Skeleton Archers & the death recap

- **Skeleton Archers**: the first ranged trash mob, appearing from floor 2 and common by floor 4+. They keep ~120 units of distance, kite away from melee, and pepper you with arrows from 190 out. Positioning suddenly matters — a camp with two archers behind a Frenzied pack is a real fight. (Blood Raven's kiting AI got generalized so any future monster can be ranged.)
- **Death recap**: the YOU DIED screen now tells you who did it — *"slain by Gorefang the Cruel"*, *"slain by a skeleton archer"*, *"slain by the Lord of Terror's fire nova"*. Blame is important.

## Iteration 11 — Belts carry potions & boss signature drops (loot)

- **Belt capacity**: no belt = 4 potions, Sash = 6, War Belt = 8 — the flask counter reads "3/6". Belts went from stat-stick to build decision, and String of Ears / Sigon's Wrap inherit their base's capacity.
- **Boss signature drops**: every boss now has a 20% chance to drop *their* item — the Butcher his **Cleaver**, Blood Raven her new **Raven's Talon** (fast unique dagger), the Maggot Queen her new **Broodmother's Carapace** (regen tank chest), and the Lord of Terror **The Grandfather**. Targeted farming is now a thing: know what you want, know who has it.

## Iteration 12 — Combat juice pass (feel)

- **Boss health bar**: a proper top-of-screen bar with the boss's name whenever you're near a living boss. Watching the Butcher's 540 hp tick down is now an event.
- **Low-health vignette**: below 30% life the screen edges pulse red — you feel the danger before you read the number.
- **Impact pops**: everything that takes a hit squashes and springs back; combined with the white flash, hits finally feel like hits.
- **Footstep dust**: little fading puffs under moving characters — the dungeon feels inhabited.
- **Pickup sparkles**: items and gold vanish upward in a flick of sparks when scooped.

## Iteration 13 — Ambient dread (atmosphere)

- Each depth band now has a **procedural ambient soundscape**, synthesized live with WebAudio (no audio files):
  - **Cathedral** — a low organ-like hum with a distant bell tolling every so often
  - **Catacombs** — cold hollow drone, wind through the ossuaries, far-off moans
  - **Caves** — earth-deep rumble and dripping water
  - **Hell** — a grinding saw-wave drone with rolling rumbles underneath
- The whole bed slowly "breathes" via an LFO, sits deliberately quiet under the combat sounds, switches automatically when you descend into a new band, and toggles with **N**.

## Iteration 14 — Pickup QoL & fog of war (requested)

- **Auto-pickup**: gold and health potions are hoovered up just by walking over them (server-side sweep, 28-unit radius; potions respect your belt cap). No more clicking pennies.
- **Click-to-loot**: left-clicking on or near a ground item (within 30 units — the glyph, the beam, anywhere close) walks you over and loots it. Labels still work; pixel-hunting no longer required.
- **Fog of war**: floors start shrouded in black and reveal in a 7-tile radius around your character as you explore — proper isometric shroud that covers monsters, loot, and walls until you've been there. **The minimap honors it**: only explored terrain is drawn, and stairs/shrines/monsters/loot dots appear only in territory you've seen. Party members always show. Resets every floor, so each descent is a true unknown.

## Iteration 15 — Sanctuary: town portal, stash & vendor (requested)

- **Town portal on T**: a 2-second channel with a growing blue portal ring (and a rising shimmer), then you're whisked to **Sanctuary** — a walled safe zone with a flickering campfire, present on every floor. Taking a hit interrupts the channel, D2-style ("portal interrupted!"). Press **T** in town for a quick 0.8s return portal to the exact spot you left. Monsters never target anyone in town; portals home don't survive a descent.
- **Your Stash**: a purple chest in town. Touch it and the inventory panel grows a 30-slot stash column — click bag items to stash them, click stashed items to take them out. Charms in the stash correctly stop granting stats. (Stash lives per session for now — persistence across server restarts is the next big rock.)
- **Griswold's Ghost**: the vendor. Stand near him and right-click in your bag becomes **SELL**, with the price shown right in the tooltip (5g commons up to 600g epics, scaled by item level). Finally a use for six Short Swords.
- **Loot-click fix**: clicking item names often needed several tries — root cause was an event-ordering bug (the scene's click handler cleared the pickup target the label had just set, unless the raw click landed within a tight radius that label clicks usually missed). Now the whole item — glyph, beam, name — is one generous screen-space hitbox, and pickup retries automatically until the item is actually in your bag. One click, looted.

## Iteration 16 — Respawn pacing & gear comparison (requested)

- **Respawns tamed**: cleared camps now stay cleared for **90 seconds** (was 25 — effectively a treadmill), and bosses respawn after **3 minutes** (was 60s). Clearing a floor actually feels like clearing a floor now; the farm loop is a choice, not an ambush.
- **Gear comparison tooltips**: hovering any item in your bag (or stash) now appends a comparison against what you're wearing in that slot — stat-by-stat deltas, **green for upgrades, red for downgrades** ("+4 armor / −8% attack speed"), "identical stats" when it's a wash, and "empty — free upgrade" when the slot is bare. Rings compare against **both** ring slots. The eternal "is this Cap better than my Cap?" question, answered at a glance.

# Graphics overhaul (/goal: make it look like Diablo)

## Iteration G1 — Procedural item icons

- **27 hand-drawn (procedurally) item icons**, one per base type: blades with edge shading and gold pommels, a spiked morning star, a glowing sorcerer's orb, riveted chainmail, a bucket greathelm with breath slits, gold rings with ruby gems, studded war belts, blue charm trinkets, corked red potions…
- Icons replace the "WPN"/"RNG"/"AMU" placeholder texts in the **inventory, stash, and equipment cells** (rarity still shows via the cell border and name color).
- **Ground loot** now drops as its actual icon under the beam — you can see it's an axe from across the room. Potions on the ground use the flask icon too.
- All generated at runtime from Graphics primitives — still zero asset files.

## Iteration G2 — Character figures & visible gear

- Player circles are gone. Characters are now **layered figures**: legs, class-colored tunic, head, and class flavor — the barbarian is broad, the sorcerer wears a long robe, the rogue has a hood. They **face the way they walk** (sprite flips) and **bob** while moving.
- **Your gear shows on your character** — equip a War Axe and it's in your hand; raise a Tower Shield and it's on your arm; put on a Great Helm and it replaces your hair (as helmets do). Weapon, offhand, and helm base-keys are now synced through the schema (`weaponBase`/`offhandBase`/`helmBase`, set in recompute), so **everyone in the room sees your kit** — loot as visible status, the D2 way.
- Smoke test verifies the visual sync: equip a Cap, `helmBase` reads "cap".

## Iteration G3 — Monster silhouettes

Every monster kind now has a bespoke figure instead of a colored circle, all facing their direction of travel:

- **Zombie** — hunched and tilted, one red eye, arms reaching forward
- **Skeleton** — bone-white with visible ribs, dark eye sockets, a rusty sword; the **archer** variant carries a bow and quiver
- **Demon** — bulky purple brute with bone horns, ember eyes, and claws
- **Treasure Goblin** — a scrawny thing hauling a loot sack with a gold coin poking out
- **The Butcher** — massive, apron-wearing, dragging a very large cleaver
- **Blood Raven** — slim hooded archer with burning red eyes
- **The Maggot Queen** — a bloated three-segment grub trailing egg sacs
- **The Lord of Terror** — horned, spiked, tailed, yellow-eyed and far too big

Elites keep their gold pulsing aura, champions their blue, ghostly packs their translucency — all layered over the new figures.

## Iteration G4 — Dungeon dressing

- **Walls got masonry**: mortar courses and staggered brick joints on both faces, weathering spots on top surfaces — in every theme's palette.
- **Flickering torches** mounted on walls that face open floor (~13% of them), with animated flames and warm light pools spilling onto the ground below.
- **Floor decals**: dark stains (blood-red ones in Hell) and scattered rubble, deterministically placed so each floor keeps its furniture.
- **Theme centerpieces** scattered through rooms: broken pillars in the Cathedral, bone piles with skulls in the Catacombs, stalagmites in the Caves, and **pulsing lava cracks** in Hell. Pillars and stalagmites depth-sort with characters — you walk behind them.

## Iteration G5 — The torch-light gloom

- The classic Diablo darkness: a **radial light circle follows your character**, everything beyond it sinking into near-black. The light **breathes** with a two-frequency flicker like a real flame, and the radius smoothly widens in Sanctuary (the campfire district deserves it).
- Layered *under* the fog of war — unexplored stays pitch black, explored-but-distant is dim, only your torchlight circle is clear. Wall torches and lava cracks glow inside the gloom.
- Zoom-aware (covers the viewport at any wheel zoom), and toggleable with **L** if you want to sightsee.

## Iteration G6 — UI skin: the orbs

- Flat HP/mana bars are gone. **Glass health and mana orbs** now anchor the bottom corners, D2-style — liquid drawn as a true circle segment with a bright surface line, dark socket, bronze ring, gold trim, glass shine. Numbers sit beneath ("62/90").
- **XP filament** along the bottom center with 10% tick notches; gold counter floats above the hotbar.
- **Gothic framing everywhere**: inventory/stash panel and tooltips get bronze double-borders with inner gold edging and gold corner studs; cells shift to a dark violet-slate; hotbar cells pick up bronze strokes.

*Graphics overhaul complete: icons → characters with visible gear → monster silhouettes → dungeon dressing → torch-light gloom → orb UI. Zero external asset files.*

# The Advanced Item System (/goal: deep Diablo itemization)

- **11 new attribute types**: critical strike (2× damage, big gold "48!" numbers with their own sound), life steal, mana steal, thorns (melee attackers bleed), fire damage, **cold damage that chills**, lightning damage (rolls 0–2× — swingy like D2), % experience, % gold find, cooldown reduction (capped 40%, affects attacks and skills), and % potion healing. All flow through combat server-side and appear in tooltips and comparisons automatically.
- **Tiered affixes gated by item level**: Sharp → Brutal, Vicious → Cruel → **Merciless (+35–60% damage, floor 8+)**, Vital → Stalwart → **Titan's**, plus new elemental prefixes (Fiery/Blazing, Frozen/Glacial, Charged/Storm) and suffixes (of the Leech/Locust, of Thorns, of Learning, of Greed, of Alacrity, of the Elixir). Deep floors don't just roll bigger numbers — they roll affixes that *cannot exist* above them.
- **Class-locked affixes**: *of the Berserker* (barbarian: %dmg + life), *of the Viper* (rogue: attack speed + crit), *of the Magus* (sorcerer: mana + CDR). Their stats live in a separate `classBonus` block that **only counts if you're that class** — tooltips show them gold for you, greyed "(not you)" otherwise. Trade fodder for your co-op partner, D2-style.
- **9 unique effects on legendaries/epics**, shown as orange ★ lines:
  - *The Butcher's Cleaver* — **Executioner**: +30% damage below half life
  - *Frostburn Fang* (new) — **Frostbite**: 8% frost nova on hit
  - *Thunderstroke* (new) — **Stormsoul**: lightning erupts from slain enemies
  - *Doombringer* (new) — **Detonation**: corpses explode
  - *Goldwrap* (new, the D2 belt) — **Midas Touch**: kills burst into gold
  - *Windforce* (new, epic bow) — **Gale Force**: knockback shots
  - *Tyrael's Might* — **Second Wind**: emergency 30% heal when struck low
  - *The Stone of Jordan* — **Arcane Surge**: kills restore mana
  - *The Grandfather* — **Patriarch**: +1 damage per character level (scales forever)
- **8 new base items**: Hunting Bow, Maul, Reaper's Scythe (innate life steal), Quiver, Tome of Secrets (CDR), Crown (gold find), Studded Leather, Plated Girdle (potion power, 8-potion belt).
- Smoke test grew a battery of pure checks: 20 distinct stats rolling at depth, class-bonus integrity, tier gating at ilvl 1, and all 9 effects wired to their named items.

# Runewords, Sockets, Sets & Persistence

## Sockets & Runes

- Weapons, offhands, helms, and chests can roll **1–3 sockets** (~25% of drops; deeper floors roll more; uniques/legendaries can roll one). Socket pips show on inventory cells and in tooltips.
- **8 runes drop as loot** (~6% per kill; treasure goblins always carry one): El, Tir, Ral, Ort, Thul, Amn, Sol, and the deep-floor **Ber** (+5% crit). Orange carved-stone icons, ground labels in rune-orange, inert in your bag — their power comes from sockets.
- **Socketing**: click a rune in your bag (it arms with a bright border), then click any item with a free socket — bag or equipped. Stats apply instantly; runes are permanent once set, so choose like it's 2001.

## Runewords

Fill ALL of an item's sockets with the right runes **in the right order** in the right base type, and the item transforms:

- **Steel** (Tir–El, weapon) — +6 damage, +15% attack speed, +3% crit
- **Stealth** (Tir–Ral, chest/helm) — +15% move speed, +10% attack speed, +5% CDR
- **Insight** (Ral–Sol–Amn, weapon/offhand) — +30 mana, +3 regen, ★ Arcane Surge
- **Wrath** (Amn–Ber, weapon) — +30% damage, +8 fire, ★ Detonation

Formation is a moment: screen flash, epic gong, `RUNEWORD: "Steel"!` — and the item gains an orange-glowing cell and its runeword title in tooltips.

## Set expansion

- Three new class-flavored 3-piece sets: **The Arcane Conclave** (sorcerer: orb/robe/crown → +40 mana, +10% CDR, ★ Arcane Surge), **Hunter's Creed** (rogue: bow/quiver/boots → attack speed + crit + move speed), **The Colossus** (barbarian: maul/plate/belt → +50 life, thorns, ★ Executioner). Five sets total, 14 pieces.
- **Partial set bonuses**: 3-piece sets now grant a smaller bonus at 2 pieces — progress feels rewarding before completion, D2-style.

## Persistence — your hero survives

- Every browser gets a persistent identity (localStorage key, sent on join). The server saves **class, level, XP, gold, potions, equipment, inventory, and stash** to disk — every 10 seconds and on leave — and restores it all when you return, in any room, after any server restart.
- No accounts, no passwords: your browser owns your hero. Guests without keys still play fine (session-only).
- Smoke test proves it end-to-end: leave, reconnect into a brand-new room with the same key, and the barbarian walks in with his level, class, gold, potions, and bag intact.

# Heroes Are Born, Not Assigned (/goal: creation, skill trees, attributes)

## Character creation
- **"STAY AWHILE AND LISTEN"** — first visit to the game now opens a creation screen: three class cards (Barbarian / Rogue / Sorcerer, each with a flavor blurb) and a name field. Your choice and name travel with the join and become the profile. Returning browsers skip straight into the game.
- **Hero names**: `Player.name` is synced — shown over every head, in the HUD, and in the server log ("Smokey the barbarian lvl 3"). Sanitized server-side, 12 chars max.

## Attributes — the character sheet era
- **STR / DEX / VIT / ENE**, D2-style, with class-specific starting spreads (barb 30/20/25/10 … sorc 15/15/20/35). **5 stat points per level**, spent one at a time on the character sheet (**C**).
- Formulas: every point of STR gives +0.4% damage; your class's *signature attribute* (STR/DEX/ENE) gives another +0.6% — so a sorcerer's Energy is also his weapon. DEX gives crit AND **dodge** (a whole new defensive layer — "dodge!" floats when it fires, capped at 50%). VIT gives +3 life. ENE gives +2 mana and mana regen.
- Life is now `20 + 3×VIT + 6/level + gear`; mana is `10 + 2×ENE + gear`. Legacy profiles migrate on load: base attributes plus **all earned points handed back unspent**.
- **Character panel (C)**: attributes with [+] buttons, and the full sheet — damage range, crit, dodge, armor, attack/move speed, life/mana regen, steals, thorns, CDR, MF/GF, XP bonus. All computed server-side (`buildSheet`) so the panel never lies.

## Skill trees — choose, rank up, synergize, ascend
- **27 nodes across 3 classes**, two trees each (Might/War Cries, Archery/Shadow, Elements/Arcane). **1 skill point per level** (and one at level 1). Actives rank to 5, passives rank to 5, **ultimates rank to 3**.
- **Tier gates** at levels 1/4/8/12 + prerequisites (Whirlwind needs Bash; Meteor needs Firewall…). **Synergies**: hard points in one skill boost another — 5 points of Bash = +40% Whirlwind damage. Tooltips show current + next-rank damage and the synergy line.
- **New skills**: Bash (stunning single strike), War Cry (AoE stagger), **Wrath of the Ancients** (barb ultimate — screen-shaking stun nova), Frost Arrow (chilling shot), **Rain of Vengeance** (rogue ultimate — 3 waves of arrows blot out the sky), Firewall (burning ground line), **Meteor** (sorc ultimate — telegraphed impact + burning crater). Plus passives: Iron Skin, Weapon Mastery, Frenzy, Blood Rage, Precision, Sharpshooter, Evasion, Envenom, Warmth, Arcane Attunement, Archon.
- **Monster stuns** (`stunUntil`) and a **burning-ground hazard system** (firewall lines, meteor craters tick every 500ms) are new server mechanics.
- **Bindings**: learned actives auto-bind to the first free Q/E/F key; right-click a skill in the tree (**S**) then press Q/E/F to rebind. The hotbar rebuilds from your bindings, unbound keys sit dimmed with "[S] skills".
- Skills/attrs/binds/name all **persist** in the profile and survived a full reconnect in smoke.

Smoke grew from 30 to 40+ checks: creation honored, ultimate rejected at level 1, learn→auto-bind→cast→mana drain, rebind round-trip, stat gating at 0 points, VIT allocation raising max life, rank 2, tree validation (gates/prereqs/max ranks/synergy math/attribute formulas), and persistence of the whole character sheet.

# The Diabloesque Gap Plan (analysis → execution)

Analyzed the whole game against the D1/D2 canon and shipped the six biggest missing pieces:

## 1. Waypoints — persistence finally pays off
Every town has a **Waypoint**. Descending updates your hero's `deepestFloor` (persisted); in a fresh session — which always starts on floor 1 — portal to town, touch the waypoint, and the whole party jumps straight to your deepest known floor. No more re-walking the Cathedral every evening. At max depth it just hums.

## 2. Resistances & elemental monster damage
Fire/cold/lightning **resistances** (plus "all res"), capped at 75%. Demons, the Butcher, and the Lord of Terror now deal half their damage as **fire**; Blood Raven's arrows are **cold** and *chill you* (35% slow — yes, you can be chilled now). Armor stops the physical half; resists stop the elemental half. Four new affixes (of the Salamander / Tundra / Grounding, Prismatic), resist lines on Stormshield / Raven Frost / Tyrael's Might, and three resist rows on the character sheet.

## 3. Unidentified items — the suspense mechanic
Rare and better now drops as **"Unidentified Greatsword"** — the beam and border tell you the tier, the tooltip says only `? ? ?`. No auto-equip, no stats, until you **identify**: click it in the bag (20g + 15g/ilvl) or for **free at Griswold's Ghost**. The reveal floats the true name in rarity color with the drop fanfare. Gheed's gambled items arrive identified (the roll *was* the gamble).

## 4. Death has a price
Dying scatters **15% of your carried gold at your corpse** ("your purse tears — 84g scatters!"). It's a real pile — run back and reclaim it, or watch your co-op partner "hold it for you".

## 5. The Horadric Altar
New town fixture. Touch it with **3 identical runes** → one rune of the next tier (el→tir→ral→ort→thul→amn→sol→ber — a real ladder to Ber). Or **3 magic items** → one unidentified rare. Empty-handed? It explains its recipes.

## 6. Victory — and the eternal grind
Slay **the Lord of Terror on floor 10 or deeper** and the room erupts: "THE LORD OF TERROR IS VANQUISHED", screen flash, gold shower (6 boss-scale piles). The floors keep going forever — the victory is a beat, not an ending.

Smoke: +12 checks (waypoint refusal at max depth, altar hint/transmute, resist/identify/rune-ladder math, deepestFloor persistence, and a full live loop: reconnect → fresh room → town portal → waypoint → floor 2).

## Stairs are a choice now (user request)

Standing on the stairs no longer teleports the party down — too many Butcher fights ended with an accidental descent. The stairs are now a **clickable object like loot**: click "stairs down (click)", your hero walks over and uses them deliberately (server validates you're actually standing there). A genuine ground click cancels the walk. Smoke now loiters on the stairs and asserts the floor does NOT change, then descends properly.

# The Final Hours (make it truly awesome and addictive)

## Enchanted champions (the D2 classics)
**Fire Enchanted** (explodes on death — respect the corpse), **Cold Enchanted** (chilling hits), **Lightning Enchanted** (fast, typed zaps). Champion packs now deal typed damage your resistances actually answer.

## The rune ladder grows: 13 runes, 9 runewords
New runes: Ith, Lum, Ko, Fal, **Um** (+8 all res). New runewords: **Leaf** (Tir-Ral weapon — same runes as Stealth, different slot!), **Lore**, **Ancient's Pledge**, **Wealth**, and the grail: **Spirit** (Tir-Thul-Ort-Amn) — deep floors now roll **4-socket** bases to hold it.

## Mana potions
Blue flasks drop (~12%), auto-pickup, belt-capped, **W** to drink (50% of max mana). The hotbar has two flasks now: red R, blue W.

## Floor bounties — the addiction engine
Every floor rolls an objective in the HUD: *Slay the boss / Slay N monsters / Open an Ancient Chest*. Completing it: party-wide XP, a gold pile, and a boosted-table item where it happened, plus a "BOUNTY COMPLETE!" fanfare.

## The Dark Wanderer
~10% of floors: *"A dark presence walks this floor…"* A roaming super-elite (6× hp, fire-enchanted, brutal). Kill it for boss-table loot and a 25% shot at **Annihilus** — the unique charm (dmg%, life, xp, all-res, scales with depth). The chase item.

## THE SECRET COW LEVEL
Treasure Goblins (30%) and jackpot chests (25%) can drop **Wirt's Leg**. Take it to the **Horadric Altar** → a red portal tears open in town → an open pasture packed with **Hell Bovines** (bipedal, polearm-armed, unimpressed) ruled by **The Cow King** (crowned, red-eyed, guaranteed boss loot). "MOO." The stairs there descend as usual. There is no cow level.

## Game lobby (user request)
Boot now lands in the **Sanctuary Lobby**: live list of open games (floor, zone, party size, refreshes every 3s) with JOIN buttons, or ⚒ FORGE NEW GAME. Server exposes `/rooms` (matchMaker.query + room metadata). **Escape** in game opens a menu: RESUME / EXIT TO LOBBY (heroes save on leave).

## Party chat (user request)
**Enter** opens the message bar, Enter sends, Escape cancels; everyone sees `[Name] message` color-coded by class, bottom-left, fading after 15s. All game hotkeys are suspended while typing. Server sanitizes and rate-limits (800ms).

Smoke: chat round-trip with name attached, lobby listing with metadata, Spirit/Leaf/Stealth matching, 4-socket cap, cow level generation + connectivity, enchanted mod audit, bounty math — all green end-to-end.

## Hero roster, random guests & no more doppelgangers (user request)

The "second window spawns a copy of the game creator" bug is dead — it happened because both windows shared one browser identity. Now:
- **Hero roster**: a browser owns *many* heroes (`arpg_roster`; the old single key migrates in). After picking a game in the lobby, a **CHOOSE YOUR HERO** screen lists them with live server details (name, class, level, deepest floor via the new `/heroes` endpoint), plus **★ NEW HERO** (full creation screen).
- **⚄ RANDOM HERO** (when joining): one click forges a stranger at the **party's level** — random class, D1-flavored name (Adria, Lachdanan, Warriv…), stat points auto-spent class-sensibly, every skill point spent on a random legal tree build (actives auto-bound), all 9 gear slots rolled at the **game's current item level**, flasks and gold in hand. It persists like any hero and joins your roster.
- **One hero, one body**: the server rejects a join with a key that's already in the game — the second window is told to pick someone else.
- **Loading screen** ("Descending into Sanctuary…") covers the join; joiners' waypoints also learn the floor they land on.

## The game breathes (user request: sprites & animation pass)

Still zero asset files — everything below is shapes and tweens.

- **Players have limbs now**: two legs and two arms, pivoting at hip and shoulder. A real **walk cycle** (legs scissor, arms counter-swing), idle **breathing** when standing, and the dead **topple sideways** instead of just fading.
- **Attack animation**: on every melee swing the weapon itself winds up, cuts through, and returns to guard; the sword arm follows the blow and eases back.
- **Your armor is your silhouette**: chest gear now recolors torso and arms (violet robes, brown leather, grey chainmail with bright links, gleaming **plate with pauldrons**); boots recolor your legs (steel greaves!); belts draw a waist-wrap with a gold buckle. All synced (`chestBase/bootsBase/beltBase`) so the whole party sees your kit.
- **Every monster idles**: zombies endlessly reach, skulls jitter on old bones, demon claws flex, the Butcher's cleaver twitches while he decides which cut you are, the Maggot Queen's segments writhe out of phase, Diablo's tail lashes and his eyes pulse, goblin sacks jiggle, bovine tails swish. Everything breathes (the undead approximate it). Idle tweens are desynced per-monster and killed with the body.
- **Monsters lope** while moving (bob synced to their stride) and **lunge visibly at their victim** when they strike (new `mswing` broadcast).
- **Bosses stand on a slow-burning sigil** — a pulsing ground ring (gold for the Cow King, red for everyone else).

## Loot piles you can actually loot (user request + bug hunt)

**The multi-click bug, found**: clicking an item's name label set the pickup target correctly — but the scene-level click handler fired right after it, ran its own "nearest item to the cursor" search, and either **overrode your choice with a different item** from the pile or found nothing in its window and **cancelled the pickup outright**. On top of that, hold-to-walk kicked in 150ms into any slightly-long click and yanked you away from the item. Fixed: label clicks are now authoritative (the scene click stands down for 100ms), and a fresh loot click gets a 400ms head start before hold-to-walk may take over.

**Pile declutter, D2-style**: name labels in a heap now stack upward into free rows — every item in the pile gets its own visible, clickable label (gold and flasks included). Labels settle back down as the pile shrinks. The fallback click hit-test also measures against each label's real (lifted) position, so clicking anywhere on a name always targets that item.

# The Grand Finale (/goal: 3 classes, 50+ items, 5 bosses, unique floors, music)

## Three new classes — 6 total, 51 skill nodes
- **PALADIN** (Combat/Auras): Smite (stunning shield-blow), Zeal (three strikes in one breath), Blessed Hammer (holy steel in every direction), ult **Fist of the Heavens** (sky-judgment that also heals the party) — and **Prayer**, the game's first party-heal. Passives: Devotion, Resolve (+all res), Fervor.
- **NECROMANCER** (Poison & Bone/Summoning): Teeth (bone-shard fan), **Decrepify** (a curse — slowed AND takes +25% damage, a whole new debuff system), Poison Nova, **Raise Skeleton** — real pets that seek, follow, and bite (new Pet schema + AI), ult **Army of the Dead** (four at once). Pets crumble when their master leaves.
- **DRUID** (Elemental/Wild): Firestorm (racing ground-flame), Twister (wind-blade with knockback), Volcano, ult **Hurricane** (a chilling storm that *rides on you*), and **Werewolf** — a true shapeshift: fur, ears, snout, faster attacks and feet, tooth-and-claw melee regardless of weapon.
- New attack projectiles (bone, thorn, spinning hammer), class-locked affixes (Crusader/Lich/Beast), creation cards, chat colors, and figure art for all three.

## 68 new fixed items (86 total: 40 unique / 27 legendary / 19 epic)
The chase library: Nagelring, Goldskin, The Oculus, Vampire Gaze, Shaftstop, Arachnid Mesh, Eaglehorn, Bul-Kathos' Wedding Band, Crescent Moon… up to the epics: **Chains of Honor, Griffon's Eye, Mara's Kaleidoscope, Widowmaker, Earthshaker, Shadow Dancer, Heaven's Light**. New bases with icons: War Scepter, Bone Wand, Gnarled Club, Circlet, Great Axe. Andariel's Visage even has negative fire resist, as tradition demands.

## Five legendary bosses — nine now rotate the depths
Floor by floor the band's guardians alternate: butcher→ANDARIEL (venom novas), bloodraven→DURIEL (chilling hits + terrifying charge bursts), maggotqueen→MEPHISTO (floating spectre, lightning orbs at range), diablo→IZUAL (frozen novas)→BAAL (broodspawner + waves of destruction). Each with bespoke art, aggro lines, and a **signature drop** (Duriel's Shell, The Soulstone, Frostwind, Destruction's Edge).

## Every floor is a different place
- **8 color palettes** cycling per level: Cathedral → Catacombs → **Frozen** → Caves → **Swamp** → **Sanguine** → Hell → **Void** (new zone names each).
- **4 layout algorithms** by floor: classic halls, cramped **warrens** (12 tiny rooms, 1-wide corridors), **grand vaults** (huge cathedral rooms, 3-wide passages), and organic **caverns** (drunkard's-walk tunnels with clearings).

## Ambient music, per dungeon
Each palette now has its own score: plainsong fragments in the Cathedral, a dirge in the Catacombs, icy arpeggios in the Frozen halls, a slow *heartbeat* in the Sanguine Chapel, croaks and waterlogged bass in the Swamp, detuned beating oscillators in the Void (unease by physics), tritone menace in Hell. Motifs drift in rarely — music you only half-notice.

## The decked-out hero (user request: kick-ass graphics, grim & bloody)

- **Gear presence tiers** — the chase made visible: your best equipped rarity is synced (`gearTier`), and from set-green upward your hero stands on a pulsing **rarity underglow**; legendary+ gear sheds **drifting embers** (orange for legendary, violet for epic) as you walk the dark. Everyone in the game sees you're decked out — from across the room.
- **Weapon heft** — weapon sprites scale by class of weapon: a Grandfather looms, a dagger is a dagger. Swing arcs now take the **color of your gear tier** — rare swings flash gold, epic swings cut violet.
- **Headgear flair** — crowns and circlets get a gold band and gem above the helm; great helms grow horn nubs. Readable silhouettes at a glance.
- **Blood & gore** — monsters bleed where they're struck: **splatter decals stay on the stones** and slowly soak away (14s, 26s for the big pools; pooled and capped at 110 for performance). Deaths throw **gibs** — chunks of whatever that was, briefly airborne — and bosses leave proper murder scenes. Heroes bleed too. Floors start clean; they don't stay that way.
- **The dark leans in** — the torchlight radius tightens ~7% per depth band. Hell is genuinely darker than the Cathedral.

## Every unique+ item now alters the game (user request)

No more stat sticks: **all 86 unique/legendary/epic items carry a gameplay-altering ★ perk** (smoke-enforced — a perkless unique now fails the build). The EFFECTS engine grew from 9 to **27 perks**, tiered:
- **Unique tier** (subtle, real): Giantslayer (+25% vs elites/bosses), Bloodletter (hits leave bleeding wounds), Frostplate (melee attackers chilled), Mana Shield (30% of damage drains mana instead), Bottomless Flask (25% potions not consumed), Golden Vigor (gold heals), Blood Rush (kills grant speed), Adrenaline (getting hit grants speed), Dread Presence (kills terrify nearby monsters).
- **Legendary tier** (dramatic): **Twin Strike** (20% hits strike twice), **Death Wish** (+40% damage below 35% life), **Storm Herald** (crits call lightning on another enemy), **Aegis** (blocks one hit entirely every 8s — with a "BLOCKED" shield flash).
- **Epic tier** (build-defining): **Culling Blade** (non-boss enemies under 20% life are executed — "CULLED"), **Undying** (cheat death at 1 life, 90s cooldown, golden halo), **Echo** (25% chance skills incur no cooldown), **Immolation** (nearby enemies burn every second), **Stormlord** (every 6th attack unleashes chain lightning).
Flavor-matched across the library: Goldskin hoards, Raven Frost chills its attackers, Nightsmoke shields with mana (as the D2 gods intended), Shadow Dancer culls, Chains of Honor refuses death.

## The world above: town, forest, cathedral (user request)

The game finally begins the way a Diablo game should — in **town**, with a wood between you and the dark.

- **Everyone starts in town now** — new heroes, returning veterans, random joiners. Death sends you back to the campfire too (the corpse run is part of the game). A **gate** cut through the south wall connects the plaza to the current floor on foot; monsters still cannot cross into sacred ground — they pile up at the gate and *wait*.
- **Floor 1 is a forest** — the Blood Moor / Dark Wood / Forgotten Glade: a large open wood (~290 trees per map, swaying canopies, dead gnarled trunks, mushrooms, grass tufts, grey daylight) with a winding trail from the town gate to a **stone cathedral** deep in the trees — gothic arch, rose window, braziers, a doorway that swallows light. The stairs down are *inside*; the Butcher prowls before its doors. Layout is BFS-verified at generation time: every camp, shrine, and chest is placed on ground you can actually walk to (fuzzed across 500 seeds).
- **New forest fauna** — **fallen** (small red imps that hop nervously and *flee shrieking when a packmate dies*), **quill rats** (spined rodents that kite and spit their own backs at you), and the shambling dead. Floor 2 onward keeps the old roster; palettes now run forest → cathedral → catacombs → …
- **The quest log (J)** — five quests, persisted per hero, rewarded on the spot with gold + XP toasts: *Den of Evil* (clear 15 forest creatures), *The Cathedral* (descend — completes on the descent, not by joining a deep room), *Fresh Meat* (the Butcher), *Maiden of Anguish* (Andariel), *Into the Dark* (reach floor 5). Kills credit the whole party; progress syncs live ("getquests" handshake beats the join race).
- **A town worth defending** — the plaza tripled in size and grew **Akara's Hut, Cain's House, the Smithy (forge glow, anvil, coals that breathe), The Slaughtered Calf tavern (warm flickering windows, hanging sign), Wirt's Shack, and the Old Well** (creaking bucket) — all solid, roofed, timber-framed iso buildings blocked in the grid on every floor. Griswold now works in front of his smithy. Three **townsfolk wander the plaza** between the well, the fire, and the tavern. Chimneys smoke. The gate is flanked by braziers.
- **Forest ambience** — a ninth score: wind through the canopy, a crow that saw something, a G-minor pastoral motif that's pretty but wrong.
- Smoke grew with it: starts-in-town assert, cathedral rect + stairs-inside assert, town-gate BFS connectivity on every floor style + cow level, forest fauna check, quest tick + quest-complete-on-descend asserts, 9-palette battery, and the grind bot learned to chase kiting quill rats. `scratchpad/forest-check.ts` fuzzes 500 forest seeds. **SMOKE TEST PASSED ✔**

## The forest grows places worth exploring (user request)

- **The Watchtower** — a two-story stone tower now rises somewhere in the wood (placed off the trail, never blocking the way to the cathedral). Click its heavy banded door to step inside: floor one is a torch-lit stone room with something living in it; take the **stairs up** to the second story, where a camp guards the tower's **cache chest**. Stairs down and a door bring you back out into the daylight. Lit windows flicker on both stories, crenellations on top.
- **Random caves** — 2-3 dark little caves per forest, their rocky mouths scattered off the trail. Each is a drunkard-carved earthen pocket (cave walls and floor, no torches — bring your own light) with a monster lair, often a chest, sometimes a shrine. "Back to daylight" when you're done.
- All of it rides one new mechanic: **area portals** — click a doorway like an item, step through. Interiors live in a walled strip below the field, so nothing leaks; every doorway is standable and connected at generation time (fuzz-verified across 500 seeds, plus a live smoke bot that enters, climbs both stories, and walks back out).
- **Grass under the trees** — tree tiles used to sit on black void; every tree now stands on proper forest floor. (The wood also got bigger: 48×70 map, ~1100 trees.)
- **Doors on every building** — huts, houses, smithy, and tavern all have banded wooden doors with lintels, brass handles, and doorsteps. People *live* here.
- **Lysa the Alchemist** — a new townsfolk at a stall of flasks between the smithy and the tavern. Click her to browse: health potions 40g, mana potions 60g, with your gold and belt count shown; she refuses the broke and the full-belted, and stops serving customers who wander off. Smoke buys a flask every run.

## The merchants come alive (user request)

Town commerce is people now, not furniture — you click a person, their wares open, and the town breathes a little more.

- **Griswold sells** — click him (he got a body worth clicking: broad shoulders, smith's apron, grey beard, hammer on the shoulder) to open **GRISWOLD'S WARES**: 7 randomly generated, fully identified items with icons, stat lines, and prices (5× sell value). Stock is mostly magic and rare with a thin tail of set/unique/legendary/epic (`VENDOR_WEIGHTS` — never common junk), rerolled every floor, and each sold slot restocks immediately. Selling your own gear still works the same way (right-click bag items near him).
- **Gheed moved to town** — the gambling altars are gone from the dungeon floors. Gheed now stands in the tavern's shadow: a portly man in a loud coat with a jingling coin purse, swaying like a sales pitch. Click him for **GHEED'S GAMBLE**: a finite spread of 8 **unidentified bases** ("Unidentified Longsword — 300g"; rings and amulets cost 1.5×). You pay for the base; the roll is between you and fate — `generateItem` gained a **base override** so the promised base always comes back, at any rarity the loot table lands (magic 55% … epic 1%), and the **item level can roll up to 8 floors past your depth** (`gambleIlvl`, quadratically rare). Rare-and-better arrives unidentified: the reveal is the second gamble.
- Both shops share the storefront UI (gold readout, affordability coloring, Esc/✕/walk-away closes), refuse the broke and the full-bagged, and NPCs cast shadows now instead of standing on shrine-glow.
- Smoke: Gheed-is-in-town assert, 8-slot spread with prices, broke-refusal with zero gold movement, funded gamble e2e (gold delta, bag delta, **promised-base contract**), Griswold 7-slot browse + cheapest-item purchase + restock assert, and a pure 600-roll battery proving the base override survives every rarity. **SMOKE TEST PASSED ✔**

## Left-click everything, track anything, three maps (user request)

- **The right-click mystery, solved** — entering the watchtower (and using stairs, and touching every shrine/NPC) only worked reliably with *right*-click. Cause: the third shipping of THE multi-click bug — a glyph's own pointerdown fires first, then the scene-level pointerdown fires for the same click and cancels/overrides the walk-to (right-click dodged it by taking the attack branch). Fix: interact clicks are **left-click only** now, and they stamp the same grace window loot uses, so the scene click stands down. Right-click is for fighting.
- **Click-to-walk pathfinding** — clicking a door, stairway, shrine, or NPC from across the map now BFS-paths through the trees instead of walking your hero face-first into one. Breadcrumb waypoints, cancelled the moment you steer by hand; stale paths cleared on teleports and floor changes. The tower's big drawn door is also clickable now and forwards to the real doorway.
- **Quest tracking** — click any quest in the log (J) to pin it top-left: name + live counter ("Den of Evil — 7/15"), gold-highlighted in the log, persists across sessions, click again to unpin.
- **Three map modes** — M now cycles: corner minimap → **full-screen map** → hidden. The full map is a war table: world dimmed, explored floor *and walls* drawn large, and every point of interest answers to the cursor — hover the stairs, any NPC or doorway, bosses and elites, or party members for a name tag. Esc folds it back into the corner; world clicks are blocked while it's open.

## THE NEXT LEVEL (/goal: more of everything, darker than ever)

The big push. Every axis of the game got deeper — and the dark finally behaves like the dark.

- **THE GLOOM** — the defining change: lifting the fog of war no longer means *seeing*. Explored ground outside your torchlight now sits under memory-shadow — four deepening rings of darkness (18% → 52%) that follow you tile by tile, repainted as you move. Only your immediate surroundings are truly lit; the rest of what you've mapped is remembered, not watched. Town stays lamplit. Paired with the radial torch mask, dungeons are finally *gloomy* — you can know a corridor is there and still dread it.
- **Drop scarcity restored** — trash drop chance cut 0.55 → 0.32, potions 0.18 → 0.14, charms/runes/gold all trimmed. Beams are rarer; every one earns its gasp. (The smoke bot's grind deadline grew to match — even the tests feel the famine.)
- **Six new monster types across depth bands** — **dark cultists** (robed, faceless, hurl purple hex bolts), **khazra goatmen** (fast axes, yellow eyes), **wraiths** (hovering torn shrouds, cold touch), **gargoyles** (animate masonry, slow wing-flex idle), **succubi** (winged, cast blood stars, entirely uninterested in your survival), and **balrogs** (a furnace with shoulders — its chest glows as it breathes fire *in*). Spawn tables now shift band by band: floors 3-4 mix the old guard with goatmen and cultists; 5-6 add wraiths; 7-9 field gargoyles and succubi; floor 10+ is the abyss's own army. **Elite odds climb +2% per floor** (cap 40%).
- **17 quests** (was 5): the Watchtower climb, cave spelunking, first gamble, first transmute, first unique+ equipped, level 10, and kill quests for Duriel, Mephisto, Diablo, Baal, the Dark Wanderer, and the Cow King. Hooks run through every system; kills credit the whole party.
- **102 fixed items** (45u/33l/24e, +16) on four new prestige bases — **War Pike, Colossus Blade, Bone Helm, Sacred Armor** (all with icons): Azurewrath, Lightsabre, Gull, Death's Web, Ondal's Wisdom, Cliffkiller, Archangel's Aegis, Grandfather's Shadow, Hone Sundan, The Undead Crown, Wormskull, Nightwing's Veil… every one carrying a ★ perk, all smoke-enforced.
- **The Abyss** — a 10th palette (near-black stone, wound-red accents) spliced into the descent between Hell and the Void, with its own ambient score: sub-bass beat-frequency pressure and whispers at the edge of hearing. Plus a **fifth layout algorithm**: RINGS — concentric corridor circles joined by four spokes, eight chambers at the crossings, corridors that always curve away from your torchlight.
- **Multiplayer glue** — **G pings the world**: an expanding gold pulse with your name, blinking on every map. **The full-screen map takes orders**: click it to ping that spot for the party. **Party lifelines**: teammates' names and health bars live top-left. **Announcements**: boss kills, deaths, and quest completions post to everyone in ceremonial gold.
- **QoL** — **[⇅ sort]** button in the bag (slot → rarity → depth, server-side); **[fill]** buttons at Lysa's top the belt off in one click; hover-comparison against equipped gear was already in — now you'll actually find items rare enough to compare.

## Hardcore, the Hall of Legends, and gravestones (the stakes update)

Loot suspense was always the pillar. Now the game has the other half of the Diablo bargain: **permanence**.

- **☠ HARDCORE MODE** — a vow on the creation screen ("one life. Death is forever."). Hardcore heroes wear the skull on their nameplate in blood-tinted text, visible to everyone. When they die: no respawn timer — the corpse stays where it fell; a full-screen **epitaph** rises ("YOU HAVE FALLEN — <name> the <class>, level N, slain by X on floor Y — this hero is gone forever"), the camera shakes, and seven seconds later you're back in Sanctuary's lobby. The profile is marked dead with its cause, floor, and hour; **the fallen cannot re-enter** (`hero_fallen` rejection), and the hero-select roster shows them greyed and at rest: "✝ fell forever on floor 3 — slain by Fanatic Fallen". Deaths are announced to the whole game in gold: *☠ Doomed the sorcerer has fallen forever…*
- **⚜ THE HALL OF LEGENDS** — the lobby now carries a second column: every hero this server has ever known, ranked by how deep they dared (then level), living heroes in class colors, hardcore marked with the skull — **plus a memorial: the most recently fallen hardcore heroes are honored regardless of rank.** Server-side `/legends` endpoint reads the whole profile graveyard.
- **✝ Gravestones** — every player death (hardcore or not) now raises a small stone where they fell: mound, slab, etched name floating above. The graveyard resets with the floor. Die three times to the same boss and the arena says so.
- Smoke grew the darkest e2e yet: a hardcore hero named **Doomed** joins, BFS-walks out the town gate into the nearest reachable pack (euclidean-nearest could be a walled-off cave lair — that bug cost him 120 immortal seconds), refuses to fight back, dies, stays down past every respawn window, is refused re-entry, and is found honored in the Hall of Legends. **SMOKE TEST PASSED ✔**

## Mercenaries — Kashya's rogues march (user request)

You are no longer alone down there.

- **Kashya, Rogue Captain** stands by Cain's house — a proper NPC (leather, red sash, bow across her back). Click her to browse **three distinctly-skilled rogue sisters**, price matched to your level: the **Fire Arrow Rogue** (burning shots, +18% damage), the **Cold Arrow Rogue** (every arrow chills), and the **Vicious Rogue** (25% crit, faster draw). Names from the sisterhood's roll call — Amplisa, Floria, Klaudia, Vidala…
- **She fights like she means it** — follows at heel, opens fire on anything threatening you (within her range *and* loyal to your position — she never abandons her employer to chase), her kills credit *you*, her cold arrows chill, her crits hit for 1.6×. She **draws aggro**: monsters treat her as a target like any hero, melee and stray arrows both. She regens between fights, teleports to your side through portals, waypoints, and stairs, and grows stronger every time you level.
- **She can die** — and stays dead until you pay Kashya to raise her (revive priced by level). Her fall raises a gravestone, posts an announcement, and shows a toast. Her contract (archetype, name, gear, alive-or-dead) is persisted on your profile.
- **She wears gear, D2-style** — three slots: **weapon, helm, chest** — no jewelry on the payroll. Press **[H]** for her panel: name, school, live stats (damage/crit/armor/life — gear and level both feed in), her three slots (click to take back), and a grid of everything in your bag she can wear (click to hand it over). Her sash and arrows tint by school; her nameplate and health bar hang over her head for the whole party.
- Smoke: Kashya-in-town assert, exactly 3 distinctly-skilled offers priced `100+60×(level-1)`, hire e2e (gold delta, entity appears with the right name and a pulse), conditional gear handover (bag→her slot, bag shrinks), broke-refusal. Found along the way: `moveNear` walks straight lines, and Kashya was the one NPC with the Old Well on her approach — the suite now routes accordingly.

## The DING (user request: "more of a Ding feeling")

Leveling up is now an *event*: a **pillar of light** erupts through your hero, a triple golden shockwave rolls out, fourteen sparks fountain and fall, the screen flashes warm gold, and a big **⬆ LEVEL N** banner punches in (with the "+5 stat [C] · +1 skill [S]" reminder under it). The sound is a proper bell: a bright G6 strike with its overtone, a triumphant five-note run, and a long shimmer that hangs in the air. Party members' level-ups get the pillar and rings too — you'll know when your friend dings across the room.

## The world breathes: weather, motes, and small lives (user request: ambiance + sprites)

- **The moor has a sky, and the sky has moods** — floor 1 rolls its weather per visit, server-synced so the whole party shares it: **clear**, **rain** (90 wind-slanted streaks with a soft audio hiss layered under the ambient score), or **mist** (eight fog banks drifting on a slow wind, wrapping around the camera forever).
- **Every palette breathes its own particles** — dust motes drifting through the cathedral and catacombs; water **drips** in the caves that land with expanding ripples; **embers rising** in Hell and ash in the Abyss; **snow falling indoors** in the Frozen halls (nobody questions it); **fireflies** wandering the swamp; blood-motes in the Sanguine chapel; slow violet specks in the Void; **falling leaves** swaying down through the forest, whatever the weather.
- **Sprite life** — the restless dead no longer walk in: zombies, skeletons, and wraiths **claw their way out of the ground** with a burst of dirt when they spawn. Idle heroes now **check their weapon grip** every few seconds. **Rabbits and rats** hop through the Blood Moor's undergrowth and bolt when you come within arm's reach. (And a fix: the hardcore skull no longer falls off your nameplate when you level.)
- Suite: weather asserted on floor 1 (`the sky has a mood: rain`) and asserted *absent* underground; the random-hero test now compares against true party max (quest credits can out-level the host); Doomed the test martyr scans **all** monsters for a reachable executioner — the nearest few can be walled-off cave lairs, which twice granted him accidental immortality.

## The Great Renaming (user request: pivot away from Blizzard IP)

The game had grown up wearing borrowed clothes — bosses, NPCs, items, runes, and lore lifted straight from the D1/D2 canon. All of it is now **original coinage** (see `LORE.md`, the new lore bible), and none of it is a sound-alike:

- **The world**: the town is **Hollowmere**; the forest is **The Mournfield** (and **The Blackbough**); the transmutation order is the **Ternion** (their Altar stands where the old one did); the sacred peak is **Mount Kragmar**; the secret bovine realm is **The Hidden Meadow** (there is no meadow).
- **The Hollow Kings**: the full boss roster re-forged — Hargol the Flenser, Corvessa the Carrion Bride, Vessira the Thorned Maiden, Vuruk the White Maw, Orvath the Grudge Eternal, Malgrim the King of Dread, Aldric the Forsworn, Uldrath the Unmaker, Bovax Tyrant of the Meadow — with new voice lines to match ("Meat for the hooks!", "Spite outlives the spine."). The roaming super-elite is **the Hollow Pilgrim**, and its prize charm **The Pilgrim's Burden**.
- **The town cast**: Torvald the smith, Fenwick the gambler, **Captain Maren of the Wardens** (mercenaries are now Ember Archer / Frost Archer / Deadeye, with a 12-name original Warden roster), Senna's Hut, Edric's House, Pip's Shack, and **The Crooked Lantern** tavern.
- **Species**: fallen → **imps**, quill rats → **spinebacks**, khazra → **goatmen**, balrogs → **hellions**. Generic mythology (zombies, wraiths, succubi…) stays.
- **The legendarium**: ~90 unique/set/base names re-coined — The Orphan Star, The Mummer's Crown, The Howling Yew, The Ferryman's Fee, Kragmar's Face, The Blunt Truth… Sets became **Vargan's Warplate** and **The Pallbearer's Garb**. A new 13-rune alphabet (**Vek → … → Ghal**) and nine renamed runewords (**Warbrand, Ghoststep, … Anima**).
- **Quests & skills**: eight quest ids/names re-forged (The Overgrowth, Hooks and Cleavers, The Ternion Craft, The Unmaking, A Load of Bull…); the four Blizzard-coined skill names became Hammer of Faith, Judgment, Wither, and Wrath of the Mountain. Dictionary-word skills (Whirlwind, Smite, Teleport…) and generic bases/affixes/charms deliberately kept.
- **Save migration**: pre-pivot profiles translate on load — item names, socketed rune ids, runeword names, set ids, quest progress, and even Hall-of-Legends epitaphs all speak the new tongue. Verified with a 16-check synthetic old-save test.
- Along the way: death labels finally respect grammar ("slain by **an** imp"), and the smoke suite's potion-drink assert tolerates a monster hit landing inside its read window.

## The Trade Ring (player trading)

The multiplayer economy closes its loop: heroes can now trade with each other, D2-style.

- **Invite via party bars**: hover a companion's name top-left ("⇄ trade"), click to invite (must stand within 160px). They get an accept/decline toast; unanswered invites expire in 30s.
- **The table**: a two-column trade window — your offer and theirs, live. Click bag items to table them (6 max per side), gold in +10/+100/+1k steps, hover any tabled item for its stats. Offers stay in their owners' bags until the final handshake — nothing is escrowed, nothing can be lost mid-deal.
- **The anti-scam law**: any change to either offer resets *both* confirmations — the oldest trick in multiplayer ARPGs (swap the item after they confirm) dies here. The swap only executes when both sides have signed the *current* offer, and the server revalidates everything (items still present, gold still there, both bags have room) at the instant of execution — atomically, then persists both profiles immediately.
- **Presence required**: drift more than 1.5× trade range apart, die, change floors, or disconnect and the deal is off. One trade per hero at a time. A completed deal is announced to the room (🤝).
- Suite: full two-client e2e at the floor-2 entrance — invite → accept → offer an item + 25g → **confirm → partner changes offer → signature burns** (asserted) → both confirm → gold deltas exact on both sides, item id present in the taker's bag and gone from the giver's. Plus a sessionless-confirm no-op guard.
- Client gotcha fixed en route: party-bar clicks stamp the interact grace with `scene.time.now` — the field compares against Phaser's clock, and a `Date.now()` stamp would have swallowed every ground click forever.

## Four Acts, Phase A: the world grows a shape (acts skeleton)

The endless descent became a WORLD: four acts + the Endless Abyss, D2-style, per the approved plan.

- **(act, floor) addressing**: `DungeonState.act`; floor is now floor-within-act; every act = surface (floor 1) + six dungeon floors, the act boss holding floor 7. All travel funnels through `startFloor(act, floor)` via `pendingTravel`.
- **danger(act, floor)** = (act−1)·7 + floor replaces raw floor at ~30 scaling/ilvl/gold/xp call sites — the difficulty curve is unchanged, just re-addressed. Layout styles and map seeds salt on danger so acts don't repeat layouts.
- **ACTS table** (common): The Mournfield → The Sunscar Wastes → The Drowned Green → The Hollow Throne, each with town name, palette cycle, boss ladder + rotation, act boss, weather pool. Phase A finales: Vessira → Vuruk → Orvath → **Uldrath** (victory moved from "Malgrim at floor 10" to Uldrath at IV·7). The **Endless Abyss** (act 5) unlocks after victory: no surface, palettes and all nine bosses rotate forever, `abyssDeepest` is the new ladder.
- **The waypoint network**: waypoints now stand on floors 3 and 5 of every act (generator-placed) plus every town (auto-discovered on arrival). Touching a stone claims it (per-hero, persisted as "act:floor") and opens the **network panel** — discovered stones grouped by act, locked acts greyed, click to move the whole party. Server validates discovery + unlock + standing-at-a-stone.
- **Act gating**: felling an act boss on its last floor opens the road for everyone present ("⚑ The road to X lies open"), idempotent across respawns. The town **caravan** (new wagon fixture, east edge) rolls to the next act — or refuses with the guard's name. Stairs on floor 7 respect the same gate. Being carried into an act unlocks it for you (rushing, exactly like the old days).
- **Data-driven trash AI**: the six hard-coded ranged-monster branches and the coward/charger special cases became common tables (`RANGED_MONSTERS`, `MONSTER_AI`) — Phases B–D add new species without touching the room.
- **Migration**: old `deepestFloor` maps to acts (1-3→I, 4-6→II, 7-9→III, 10+→IV + the Abyss they lived in), act-1 waypoints granted up to the old high-water, hardcore records gain the act. Hall of Legends now ranks acts → abyss depth → level; lobby, hero-select, HUD, minimap (now keyed act:floor), quest log (grouped by act chapter), and death epitaphs all speak acts.
- Suite: act-finale ladder asserts, per-act + Abyss gen battery (waypoints standable on 3/5), waypoint discovery + refusal e2e, caravan-locked e2e, and **the rush**: a seeded veteran rides town → Act II → back to an Act I mid-act stone. Migration test grew to 19 checks.

## Four Acts, Phases B-D: the lands themselves

- **Act II — The Sunscar Wastes** (Zerath Oasis): the surface generator became parameterized (`generateSurface` + per-act opts — scatter density, pairing, watchtower, hollow labels), giving the wastes wind-carved rocks, dead scrub, and cactus over sun-bleached hardpan, with 2-3 **sunken tombs** (the cave mechanic, re-labeled and re-paletted). Two new palettes (sunscar surface, tombs) + ambient scores (dry wind and vulture keens above; cloth on stone and settling sarcophagi below). **Sandstorms** race sideways across the screen. Five species: scarab, sandserpent, the entombed (they claw out of the ground), duneprowler (charger), carrionbird (flying coward). **Queen Nyzat, the Embalmed** rules floor 7 — golden mask, embalming nova, scarab brood, signature "Nyzat's Lid" — with **Vuruk pinned mid-act** on floor 4. Quests: The Thirsty Road, Vultures Overhead, The Sunken Door, The White Maw (re-homed), The Embalmed Queen (arc).
- **Act III — The Drowned Green** (Mirefall Landing): strangler canopies sway over the trail; flooded ruins hide beneath; heavy rain and mist. Jungle + ziggurat palettes and scores (canopy drip and birdcalls; deep-water drops and a god turning in its sleep). Species: mudling (mud coward), blowreed hunter, riverfang (croc charger), vinehorror, bogwitch. **Ssarim, the Drowned God** ends the act — orb-caster AND drowning nova (kiting bosses now work their novas — the ranged-return used to skip them), signature "Ssarim's Riverspine". **Orvath broods mid-temple**. Quests: Landfall, Green Hell, The Flooded Steps, Spite's End (re-homed), The Drowned God (arc).
- **Act IV — The Hollow Throne** (The Last Vigil): charred spires with glowing cracks, slag heaps, **ashfall** drifting down forever. Species: ashfiend, doomguard, flamecaller, the flayed. The ladder is the old kings themselves: **Aldric (floor 4) → Malgrim (floor 6) → Uldrath (floor 7, victory + the Abyss opens)**. Quests: The Last Vigil, The Breach, The Oathbreaker, Dread Itself (re-homed), The Unmaking (the finale), Into the Endless (Abyss floor 3).
- Every act's tomb/ruin/fissure interiors wear their own palette; the descent entrance wears each act's stone and gem; critters stay a Mournfield thing; trash rolls are act-authored (`pickMonsterKindFor`) with the Abyss falling back to the deep bands. 10 new monster figures + 2 boss figures, all procedural. Suite: per-act finale/mid-boss ladder asserts, 15-palette battery, act surface invariants (no watchtower east of the Mournfield), Abyss rotating all 11 bosses.

## Graphics pass: the label layer, living mist, and a polite tower

- **The label layer**: loot names and NPC/shrine nameplates no longer live inside y-depth-sorted world containers — they render on a dedicated always-on-top band (880k/885k). An item dropped behind the watchtower keeps its name; Maren's and Torvald's names float over the houses instead of under them. Declutter stacking, click-to-loot hitboxes, and used-shrine dimming all follow the labels to their new home.
- **The tower steps aside**: walk into the watchtower's visual shadow and the whole structure fades to 45% so you can see yourself (and your loot). The generator also keeps a full tree-free ring around the tower footprint — the trees-plus-tower cul-de-sac that could trap a hero walking past is gone.
- **Mist with a body**: the flat white ellipses became layered banks of a soft radial-gradient puff — squashed, drifting, and breathing (each bank swells and thins on its own slow clock). Fourteen banks deep, torn down cleanly with their tweens on weather change.
- **Ground under everything**: building and tower-base tiles now draw their floor tile first — the Old Well (and every structure) stands on ground instead of a black hole, in every act's palette.

## The Great Drought (drop-economy rebalance)

The flood was drowning the gasp. Per-kill item chance cut from 32% to **15%** — most kills now drop nothing — with the rarity weights retuned in the same stroke so the pyramid gets steeper, not uniformly drier:

| tier | per-kill before | after | change |
|---|---|---|---|
| common | 17.6% | 6.3% | 2.8× rarer |
| magic | 9.7% | 5.0% | 2.0× rarer |
| rare | 3.2% | 2.5% | 1.3× rarer |
| set / unique | 0.53% / 0.70% | 0.39% / 0.54% | ~1.3× rarer |
| legendary / epic | 0.26% / 0.088% | **unchanged** | the chase stays the chase |

Charms 5% → 3%, runes 4.5% → 3.5%. Gold, potions, and every guaranteed source untouched — elites, champions, bosses, chests, and the goblin are now clearly THE loot moments, and Fenwick's gamble and Torvald's shelves matter more. Magic find quietly got more valuable.

## Magic Find learns restraint (MF saturation + boss-table fix)

A level-11 hero with 89% MF pulled 2 uniques and 4 rares from eight kills. Two systemic causes, both fixed:

- **The boss table was a unique fountain**: 23% of every boss drop was unique-or-better, and bosses guarantee 2-3 drops plus a 20% signature roll — every 3-minute respawn was a jackpot. Now 13% (magic 40 / rare 40 / set 6 / unique 8 / legendary 3.5 / epic 1.5). Boss kills still average roughly one unique-tier moment every other kill counting signatures — an event, not an entitlement.
- **MF was linear and uncapped**: every non-common weight scaled by (1+MF/100) forever, quietly flattening the pyramid as gear stacked. MF now **saturates per tier** (`effectiveMagicFind`: mf·K/(mf+K), K rising with tier depth so deep tiers always outgrow shallow ones — nothing gets crowded out, every tier stays monotone in MF). 89 MF: uniques ×1.27 instead of ×1.89. 600 MF: uniques ×1.8 instead of ×7 — and commons survive at 22% instead of being annihilated. Bonus fix: MF used to be a complete **no-op on commonless tables** (boss/elite/gamble/vendor — uniform scaling cancels out); with per-tier saturation it now nudges those up-tier too, so MF gear finally matters on boss farms.
- Verified with 300k-roll simulations at MF 0/89/300/600 on both tables; suite green.

## The deep camps seal their gates

- Underground floors no longer have a walkable entrance into the town strip — the gate and its connecting corridor exist only on each act's surface (the strip below ground is now a **sealed camp**: town portal remains the only way in, and it still holds the stash, shops, waypoint, and caravan, so mid-dungeon shopping via T works exactly as before).
- Consequences wired: late joiners land at the floor's entrance beside the party instead of inside a sealed camp; death underground respawns you at the floor's entrance (the corpse run starts on the field); gate braziers only burn where a gate exists; T-from-camp already fell back to the floor entrance when no return anchor existed.
- **Waypoint cadence tightened**: stones now stand on floors 3, 5, AND 7 of every act (Abyss: every third floor) — with the camps sealed, the network is how you get home, and you're never more than two floors from a stone.
- Suite: sealed-camp battery asserts (a path from town on a deep floor is now a failure), waypoint cadence asserts, and the grind hardened for the Great Drought (600s deadline, potion optional with downstream fallbacks).

## THE END GAME: difficulties, level 99, the deep alphabet, and jewels

Four systems landed in one stroke — the /goal that turns the campaign into a career:

- **The difficulty ladder** — Normal / Nightmare / Hell, chosen at the forge (lobby buttons, tooltips of what awaits). Unmaking Uldrath earns the next tier for everyone present ("⚔ Nightmare has been earned"). The forge clamps to what the creator earned; unproven heroes (and guests) are refused at the door of sharper games. Nightmare adds +28 danger and −40 all resistances; Hell +56 and −100 — and each tier puts a growing thumb on the mythic scale (set/unique/legendary/epic weights ×1 / ×1.6 / ×2.5; verified monotone by simulation). The Hall of Legends now ranks difficulty first (☠ / ☠☠ marks), then acts, then Abyss depth, then level. Migration: heroes who had already opened the Abyss wake up with Nightmare earned.
- **Level 99 & Transcendence** — the cap is 99 (XP simply stops), and the trees grew to hold it: every passive deepened to rank 10, every ultimate to rank 5, and a fifth tier — **Transcendence**, gated at level 30 — added four rank-12 passives per class (Blood of the Mountain, Deadeye's Patience, Bottomless Well, The Anvil, Plague Eternal, The Old Shape…). Every class's tree now holds 103-118 ranks: all 99 points always have a home, and no two level-99 builds need look alike.
- **The deep alphabet & the book of words** — seven new runes (Bren → Ulth, ilvl 10-28: the sharpened worlds' currency) extend the ladder to 20; the runeword book grew from 9 to **24** (Mournfield, Sunscar, Undertow, Stormlaw, Winterking, The Drought, Kingslayer, Sanctum… and the 4-socket grail **Worldsedge**). The law is now D2-true: **words form only in plain steel** — runes in colored gear are just stats. To feed the economy, commons socket at nearly triple the old rate, and every socketed drop announces itself ("Kite Shield ◈3" on the ground and in the bag).
- **Jewels** — cut stones (magic/rare, 1-3 depth-scaled facets, ~2% drop) that seat into ANY socketed item through the same click-to-arm flow. The tradeoff is the point: a seated jewel permanently bars that item from ever forming a runeword — flexible power versus the book's recipes. Violet pips and ◆ tooltip lines keep the two economies visually distinct.
- Suite: mythic monotonicity sim, forge-clamp + door-refusal e2e, per-class 99-capacity + Transcendence gating asserts, 20-rune/24-word validity battery, white-only formation assert, jewel battery.

## The waypoint panel finds its rows

- **Bugfix**: the waypoint network panel opened as an empty frame — act headers and footer rendered inside the panel, but the clickable destination rows were never added to the panel container, so they drew orphaned at the screen's top-left (depth 0, hidden under the HUD) and could not be clicked. One missing `root.add(row)` in `rebuildWaypoints`; the rows now sit in the panel, hover-highlight, and send `waypointjump` on click as designed.
- The rest of the chain was verified sound end to end: waypoint shrine click → walk over → `touchshrine` → server discovers the stone and answers with the open-panel message → destination click → server validates discovery/act unlock/proximity → the whole party travels.

## Monsters and mercs grow eyes — line of sight

- **Monsters no longer aggro through walls.** Target acquisition now requires an unobstructed sightline (`hasLineOfSight`, sampled every half-tile against the wall grid) on top of the aggro-range distance check. A monster in an unexplored room no longer wakes to a player it cannot see and grinds face-first into the intervening wall.
- **They remember where they last saw you.** Once a monster has sighted its quarry it records the spot; if the sightline breaks it hunts that last-seen position for a few seconds (`AGGRO_MEMORY_MS`, 4s) — sliding along walls toward the doorway you vanished through, often re-acquiring as it rounds the corner — then falls quiet and holds its ground instead of running forever. Never-sighted monsters simply idle.
- **The hired rogue only looses at what she can see.** The merc's target scan now requires line of sight to the monster, so you can no longer park in one room and have her snipe a pack through the wall. No sightline, no arrow — she heels to you until a real shot opens up.
- Suite: a pure line-of-sight battery (a solid wall blocks the sightline; open ground does not; a clear corridor carries across the map) and the hardcore end-to-end still lands its kill at melee range under the new rule.

## A hiring hall for every act — mages, barbarians & paladins join the payroll

For the whole game there was one mercenary and one recruiter: Captain Maren and her rogue archers. Now every act musters a different kind of companion, and each recruiter keeps a stall in town.

- **Four schools, four recruiters.** Maren (rogues, **arrows**) is joined by **Orsavio the Exiled Magus** (mages, **spellbolts** — fire/frost/storm), **Hrothgar, Chief of the Fells** (barbarians, **melee** — Reaver/Warbringer/Frostwolf), and **Dame Iseult, the Last Vigil** (paladins, **melee** — Templar/Zealot/Sentinel). Each offers three distinctly-skilled recruits, level-priced like before.
- **Unlocked by progress, hireable anywhere.** A recruiter's hall stands in *every* town, but is **sealed until you've opened its act** — mages at Act 2, barbarians at Act 3, paladins at Act 4. A locked hall is greyed with an "— Act N" tag; touching it shows the roster but the door stays shut and refuses your coin (`shopfail: locked`). Once an act is open, you can hire or revive that school from any town.
- **One blade at a time (D2 austerity).** Signing a new companion dismisses the old one — their gear comes home to your bag first. Your single merc slot, revive, and gear panel work exactly as before, now flavored to whoever walks with you.
- **They fight to their kind.** Rogues and mages loose from range (mages fling a glowing elemental mote with the right sound per school); barbarians and paladins **wade in** — closing to melee, lunging on the swing, a steel-slash where the blow lands. Barbarians soak (×1.45 life), paladins stand firm (×1.28), mages are frail (×0.82).
- **Everyone got a silhouette.** New recruiter figures in town (robed magus with a glowing staff, fur-cloaked chieftain with a planted axe, plated knight with shield and mace) and matching walking-companion figures, each tinted by its element school. The `[H]` panel titles and colors follow the class; hovering an item in the merc's bag now reads its name and stats (previously only worn items showed a name).
- **Persistence & back-compat.** The companion's class rides the save file; every legacy merc loads as the Rogue it always was.
- Suite: a pure four-class contract battery (one per act, distinct unlock acts, distinct archetype ids, rogue=arrow / mage=spell / barbarian+paladin=melee, no shared tiles) plus an end-to-end gate check — the mage hall answers in Act 1 but reports `locked`, and hiring is refused with the gold untouched. Green with the existing rogue hire/gear/line-of-sight coverage intact.

## The world finds its voice — town dialogue, storytellers & dungeon encounters

The last great piece: the grim story of the world, told the D1/D2 way. No more silent shopkeepers.

- **Talk to anyone.** Clicking a town NPC opens a **dialogue window** — a name-plate, paged text you advance with click or space, and a small menu: **Talk** on top (a submenu of that NPC's topics, with Back), and **Shop / Gamble / Hire** beneath it. Torvald, Lysa, Fenwick and the recruiters each carry a slice of the world, and their words **darken act by act** as you travel east.
- **Each land its own faces.** Towns are no longer interchangeable. **The recruiter now keeps to one act** — the *muster post* in every town holds only that act's captain (Maren's rogues in I, Orsavio's acolytes in II, Hrothgar's warband in III, Iseult's knights in IV; the Abyss borrows the last). You hire that act's school; any recruiter will *revive* whatever companion you already march with. **Two more townsfolk join every act** to fill the space: an herb-witch and a gravedigger's boy in the Mournfield, a water-warden and a cinder-priest in the wastes, a marsh-mother and a stilt-walker in the green, a bell-keeper and a fallen knight's squire at the Last Vigil — talk-only locals, present only while you walk their land, each with their own grim corner of the story.
- **A storyteller in every land.** One elder sits by each act's campfire, carrying the main arc: **Edric the Elder** (I), **Halqa the Sand-Blind** (II), **Vaol the Ferryman** (III), **Brother Cael, the Last Watch** (IV) — three brother-kings who traded their names to the dark and now *unmake the world from underneath*, land by land: the Mournfield grieves, the wastes thirst, the green drowns, and it all narrows to the stair beneath the Hollow Throne.
- **Stories waiting in the dark.** Most dungeon floors hide one **narrative encounter**, rolled between three kinds: a **vignette** (~70% — a fallen Warden's warning, a monk's carved confession, boats hung in a flooded canopy: paged text + a scrap of insight), an **ambush** (~20% — a "survivor" who is no longer a survivor; the dialogue turns and the thing wearing him spills into a fight), or a **bargain** (~10% — a pale figure or drowned suitor offering a short boon, or a curse wearing a boon's face: "Warmth, for a memory"; "the river only ever asks once").
- **Under the hood.** Town talk is client-rendered from a shared `TOWN_NPCS` table (12 act-scoped townsfolk over 4 acts, plus the shared shopkeepers); the recruiter and each act's three locals spawn only in their own act, on a fixed set of reused town slots. Encounters are a new dungeon shrine kind driven by an `ENCOUNTERS` table and a per-floor roll; the server applies the mechanic (XP scrap / `-3`-camp ambush pack / timed boon or a new vulnerability curse). All canon lives in `LORE.md`.
- Suite: a pure battery (every speaker resolves and is well-formed; `recruiterForAct` pins one school per act; each act keeps ≥3 distinct-slot talk-only townsfolk — 12 total; every encounter's ambush-monster is real and every boon defined; all three encounter kinds per act) plus e2e checks — exactly one act-scoped recruiter and the full talk-only roster stand in town, the elder is *not* consumed like a shrine, and a best-effort field-touch fires a real encounter's mechanic. Green with the full existing suite.

## The town remembers a song — Karplus-Strong guitar, reverb & a hearth theme

Diablo's soul is that lonely fingerpicked guitar in Tristram. The audio engine was already all-procedural (drones, noise beds, sparse motifs) but had no strings and no space. Now it does — still zero audio files, all synthesized.

- **A plucked-string voice.** Added `pluck()` — **Karplus-Strong** string synthesis: a burst of pick-noise recirculated through a delay line one wavelength long, averaged as it loops so the highs die before the fundamental. That's a fingered nylon-guitar string, built from math, no sample.
- **A real space.** Added a **convolution reverb** from a *generated* impulse (exponentially-decaying stereo noise, top rolled off) — the stone hush of a cathedral, the wet echo of a flooded crypt. The whole ambient bed now breathes through it.
- **The town has its own theme.** Step inside the walls and a **melancholy fingerpicked lament** fades in over a warm low pad and the fire's breath — an Am–F–C–G loop with p-i-m-a picking and a sparse lead that answers on the off-beat. It's **transposed per act** so each town has its own mood (Hollowmere in A minor, Zerath dropped a step and dry, Mirefall up a third, the Last Vigil low and heavy), with a distant chapel bell now and then. Leave the walls and the dungeon's dread returns — the theme swaps on the town boundary (`updateAmbientLocation`, ambient index `100+act`).
- **The dungeons gained a harp in the dark.** Each depth band's half-heard motif is no longer a bare oscillator beep — it's now a **reverbed plucked line**, muted heavier on the menacing (sawtooth) bands so hell and the void stay grim.
- All in `client/src/sfx.ts` (+ the town/dungeon swap in `GameScene`); zero dependencies, one shared `AudioContext`, no asset files. Client-only — typecheck + production build clean; the server smoke is unaffected.

## The deep listens back — depth-scaled ambient horror

The dungeons and the surface already had per-band ambience (wind, drips, distant moans), but it stayed the same whether you were on the first step or the last. Now the dark gets louder the further you fall.

- **A creep factor tied to real depth.** Every non-town area now carries a `creep` value derived from danger (`(act-1)*7 + floor`), normalized 0→1 across the whole descent. The surface of Act I is near-silent unease; the bottom of Act IV and the Abyss are full horror. The **outside world escalates too** — Act II's wastes are creepier than Act I's wood, and so on.
- **Everything gets more insistent with depth.** The theme's own events fire more often (~8s near the surface → ~4.5s deep) and more reliably; the half-heard plucked motif drifts in harder (~21s → ~12s).
- **A whole new layer of dread that only wakes below the surface**, escalating in kind as you descend: at shallow depth a far **drip** or an unintelligible **whisper**; deeper, **scuttling** on many legs, dry **bone-rattle**, a **scream** down the hall; at the bottom, slow **breathing** at your neck, a distant **heartbeat**, and — rarely — a sudden dissonant **stinger** (a minor-second grind with a tritone on top). All synthesized, all drenched in the reverb from the last pass.
- The town stays a safe hearth — `creep` is forced to 0 inside the walls, so the guitar theme is never invaded. The bed restarts when your depth changes enough to matter (`setAmbient(theme, creep)`, threshold-gated so it doesn't thrash).
- Client-only (`sfx.ts` + `GameScene.updateAmbientLocation`); zero dependencies, no asset files. Typecheck + production build clean; server smoke unaffected.

## Reliability & balance — the smoke stops lying, and a deterministic death for the deathless test

Two long-standing RNG flakes were failing good builds, a latent crash lurked behind them, and the drop/scaling curves had never actually been measured. All addressed at the root — test-and-tooling only, no game logic changed.

- **The hardcore "Doomed" flake, fixed at the root.** The bot that proves permadeath works has to *die*, but a level-1 hero (~80 HP) regenerates 3 HP/s and Act-I monsters barely out-damage that — so organic death was a coin-flip that could take minutes or never land, no matter how the bot positioned (chasing kiters to point-blank, standing in aggro range, burying itself in the densest melee pack — all still flaked). The permadeath *machinery* (epitaph, corpse-stays-down, re-entry lockout, Hall of Legends) is what the test actually verifies, not that monsters can win a DPS race. So the server gained a **dev-only, self-only `smokekill` hook**: it routes a lethal blow through the real `damagePlayer` pipeline (so the exact permadeath path runs), credits the nearest monster for a truthful epitaph, and is gated off in production (`NODE_ENV`/`ARPG_PROD`). The test now gives real combat a brief 15s crack, then keeps the promise deterministically. Verified green across repeated runs.
- **The grind "no item dropped" flake, fixed properly.** A normal kill drops gear at exactly 15%, so a short grind had a real ~7–10% chance of no gear — which the test *requires*. But an **elite kill is a guaranteed drop**, so the bot now hunts the nearest elite/champion when it still owes the test an item (and gets desperate sooner). The guarantee closes the flake; a bounded, elite-first re-grind also re-secures a fresh ground item for the auto-equip step.
- **A real crash, caught and killed.** De-flaking exposed a null-deref: the auto-equip test's ground item could despawn or be looted during the intervening attribute/skill checks, then `itemG.rarity` threw on null. The capture now re-secures a fresh item and guards the null with a clear message instead of a stack trace.
- **A balance report, measured not guessed** (`scratchpad/balance-check.ts`, 300k-roll Monte-Carlo over the real `generateItem`). The drop economy is **healthy**: 1 gear / 6.7 kills, 1 unique+ / ~114 kills at 0 MF (→ ~70 at 300 MF), 1 unique+ every ~2.7 boss kills; MF shifts commons 42%→22% along a sane curve. Two things flagged for a design call, not silently changed: **difficulty cliffs** (each tier adds a flat +28 danger, so Hell Act I plays at danger 57, ~20× monster HP, −100 resist) and **deep-content monotony** (pack size caps at 5, elite chance at 40% by mid-Act-II, so the Abyss scales only by HP/damage — a natural endgame-mode target).
- Known residual: a separate, rarer "party did not descend" timing flake still surfaces occasionally. The real fix for the last tail is a **seedable test RNG** (deterministic monster spawns/positions for smoke runs) — recommended as the proper follow-up rather than chasing each independent tail-flake.

## Each town its own place — per-act identity, and doors you can walk through

Every act reused one plaza in one palette; the tavern and huts were solid blocks you could only look at. Now each land's town is dressed as itself, and you can step inside.

- **Four towns, four faces.** A new per-act `TownStyle` (in `common`) gives each land its own building material and palette, read by the renderer with **no new server wiring**: **Hollowmere**'s rain-blacked timber, **Zerath Oasis**'s sun-bleached adobe, **Mirefall Landing**'s moss-slick stilts, **The Last Vigil**'s ash-choked stone. Walls, roofs, timber, smoke, the tavern sign (THE CROOKED LANTERN → THE DRY WELL → THE STILT & LANTERN → THE LAST POUR), and even **crowd density** all key off the act — Hollowmere teems; the besieged Vigil is nearly deserted.
- **You can go inside now.** The tavern and one hut are **hollowed to real rooms**, carved straight into the shared collision grid (so server movement, monster pathing, client BFS, and the minimap all stay in sync from one source of truth). Both were enlarged so there's a room once the walls are subtracted, with a **door punched through the front wall** — none of it disturbs a plaza landmark or the gate. Walk to the threshold and the **roof lifts away in a Diablo-style cutaway** (its own render object, alpha-eased on footprint occupancy), revealing a plank floor, a bar counter, stools and barrels, a hearth, the swinging crooked lantern, and a couple of patrons nursing drinks. Step out and the roof settles back.
- **Someone's always at the bar.** A new talk-only **`barkeep`** NPC kind — a different **bartender behind every tavern's counter** and a **resident by every hut's fire**, one distinct pair per act (Brannoch, Sedira, Gullimon, Old Hesk pour; Old Mabel, Amara, Wickem, Greta keep the hearth), each with their own paged dialogue that darkens as the world does. Fully wired through the existing dialogue system (figure art, accent, talk-gate, `shrineNpcId`) — deliberately *not* the `storyteller` kind, so the act-townsfolk head-counts the suite asserts stay intact.
- **Verified.** `scratchpad/lore-check.ts` grew to **356 assertions** (four distinct styles/materials/tavern-names; exactly two enterable buildings, big enough, doors on their perimeter; interior NPC anchors strictly inside their walls; no POI or gate/spawn column buried; four distinct barkeeps + four residents, talk-only, correct figures). A carved-grid dump confirms the hollow interiors, punched doors, and open gate; the **full `npm run smoke` passes** (town gate connected, every plaza walk-and-interact still reachable). Typecheck clean across common/server/client.

## The path to greatness, thrust 1 — combat feel & the pull

Combat had a broad visual/audio vocabulary but a soft core loop: landing a blow froze nothing and shook nothing (camera shake was gated to *you* being hit), packs hard-capped at 5 scattered monsters, and one boss charged with no warning. This pass makes hitting things *feel* like hitting things, and makes the screen fill up enough to gather and detonate. All client-side juice + a density bump; typecheck + client build + `npm run smoke` all green.

- **Hit-stop.** Your crunching blows now briefly *freeze the world* — entities and projectiles stop advancing for a beat while the impact pops keep playing (crit ~55ms, elite kill ~45ms, boss kill ~120ms). Trash kills stay freeze-free so clearing a big pack still flows. Implemented as an interpolation gate in the frame loop, so scale-pops, tweens, and camera all keep running — only world motion holds.
- **The camera answers your hits.** Every blow *you* land now kicks the camera (the server now tags each hit with its attacker), scaled up for crits and kills — the moment-to-moment "chunk" that was entirely missing. Taking a hit yourself still shakes as before.
- **Density — the Diablo "pull."** Pack size was `min(5, 1+floor)`; it's now `min(12, 3 + danger×0.75)` and scales with difficulty, so nightmare/hell hordes swell too. Big packs spread wider (so they read as a horde, not a stack) and can field a **second elite lieutenant**. You can finally gather 20–30 and blow them up — the core power fantasy.
- **A telegraph for the charger.** Vuruk used to hit you at 3.6× speed with zero warning (read as a cheap shot). He now **plants his feet and flashes a red lane** for ~550ms before launching — a real, dodgeable mechanic, reusing the nova/meteor telegraph pattern.
- **Loot bursts + juicier deaths.** Elites and bosses erupt a fountain of light on death (gold for elites, blue for champions) to sell the guaranteed-loot payoff; gib counts scale with the kill. Projectiles now **smear a glowing trail** through the air (per-kind color). Crit numbers grow with the damage and jitter sideways so a detonating pack doesn't stack them into a blur. Hit/swing/death sfx got per-call pitch jitter so rapid hits don't machine-gun one tone.
- **Balance note (flagged, not silently changed):** denser packs mean more total drops per floor, which softens the deliberate "Great Drought" scarcity. `DROP_CHANCE` is left untouched on purpose — worth a playtest to decide whether to embrace the fountain or trim per-kill odds to hold floor-level scarcity.

This is thrust 1 of a "best Diablo-like" plan built from a three-part audit (combat feel / endgame loop / itemization). Still ahead: **build depth & agency** (respec, gear that transforms skills, real elemental specialization) and the **endgame loop** (paragon past 99, a rift-style run container, account-wide stash + seasons).

## The path to greatness, thrust 2 — build depth & agency

Gear and levels were stat-sticks in parallel to your build, and a misclick was permanent. This pass makes builds a *playground* and makes gear *transform* how you play. Four interlocking systems, all landed together; typecheck (×3), client build, 416-assertion data battery, and full `npm run smoke` all green (the perkless invariant now covers 110 unique+ items).

- **Free, instant respec.** A `↺ respec (free)` button on the Skills panel (two-click confirm so it's never a misclick disaster) hands back every skill and stat point and resets attributes to the class base — experimentation is the whole point, so it costs nothing. Clears stale cooldowns and re-derives HP/mana. Diablo-3-style, because agency beats preciousness here.
- **Gear that grants skill ranks (+skills).** A new flat `plusSkills` stat boosts the ranks — and synergies — of skills you've *already learned* (it never conjures an unlearned one). Applied everywhere rank matters: damage, synergy scaling, pet caps, buff durations. New rare **Adept's** (+1) and **Archmage's** (+2) affixes, deliberately *flat* so depth never inflates them, plus every build-defining legend carries +1. The Skills panel shows the boosted rank (`3/5 +2`) and recalculated damage.
- **Legendary powers that REWRITE a skill.** The real "gear transforms builds" fantasy — six chase items, one per class, each rewriting its signature skill: **Starfall** (Meteor falls *twice*), **Auric Verdict** (Blessed Hammer — *twin* rings), **The Bone Choir** (Raise Skeleton — a larger host + an extra per cast), **Maelrend** (Whirlwind — wider reap that leaves the ground *burning*), **The Thousandfold Quiver** (Multishot — a far wider volley), and **Tempest's Kiss** (Twister splits into *three* blades). Powers live in a `SKILL_POWERS` registry, attach via an item `power` field into a `p.powers` set, and branch inside each skill's handler. Tooltips call them out in bright violet.
- **Elements finally matter — monster resists + penetration.** Monsters shrug off elements now: fire-born demons/hellions/flamecallers resist fire (and *hate* cold — negative resist amplifies), the cold-touched resist cold, the arcane resist lightning, and act bosses guard against everything. So "fire build vs cold build" is a real decision, and a new **penetration** stat (with **of Piercing** / **of Sundering** affixes) claws that resistance back — the D2 Facet/immunity-breaking dance. The elemental slice of a blow is tracked through the damage pipeline (dominant element + fraction) and reduced in `damageMonster`; resisted hits grey out and occasionally say "resist". Physical damage is never resisted.
- **Targeted crafting at the Ternion Altar.** A fourth recipe: **3 rare items → a crafted rare imbued with a guaranteed +1 to skills** — a deterministic path to the single most build-defining affix, so the chase isn't pure RNG.
- **Balance note:** +skills, powers, and free respec meaningfully raise the ceiling and invite optimization; monster resists can wall a mono-element build until it picks up penetration (that's the intended tension). All tunable — resist values and affix tiers are data.

This is thrust 2 of the "best Diablo-like" plan. Remaining: the **endgame loop** — paragon past level 99, a rift/map run-container with modifiers, and account-wide stash + seasons.

## The path to greatness, thrust 3 — the endgame loop

Character power hard-stopped at 99 (XP discarded), there was no repeatable "run" with a shape, alts started from zero, and the ladder only ever ratcheted. This pass builds the endgame: a reason to keep playing for a hundred hours. Four systems; typecheck (×3), client build, a 463-assertion data battery, and full `npm run smoke` (hardcore, `/heroes`, the season-filtered `/legends`, and a persistence reconnect) all green.

- **♾️ Paragon — power past the ceiling.** At level 99, XP no longer vanishes: it banks into an endless **paragon** track (per-character). Every paragon level is a point to spend on a small permanent bonus (Might / Vigor / Guard / Ward / Greed / Celerity), so a maxed hero keeps growing forever. The XP bar turns violet and tracks paragon progress; the character panel gains a `✦ PARAGON N` section with spend buttons; a violet burst marks each paragon-up. Free respec reallocates paragon too. Persisted.
- **🌀 Dedicated Rift mode — the "one more run" loop.** A **Rift obelisk** in town opens a self-contained, pushable instance at the next Rift Tier above your best clear. Inside: a dense horde to cull, then a summoned **Rift Warden** (a boss scaled to tier), then **tiered rewards** (more loot the deeper you push) and a portal home. Rift Tier drives danger — the pushable knob — and clearing bumps your permanent `riftBest`. Carefully sealed: no caravan, no waypoints, and it never pollutes the world ladder (deepest-floor / acts / waypoints are all guarded), so a rift is a pure, committed endgame run. New violet portal art + a tier/progress HUD (reusing the bounty banner) + a clear celebration.
- **🏆 Seasons — a ladder that resets.** Every hero is stamped with a season; the Hall of Legends (`/legends`) now shows only the **current season**, and **Rift Tier crowns the ranking** (then difficulty, acts, abyss, level). Bumping one constant (`CURRENT_SEASON`) starts a fresh ladder with fresh characters while old heroes archive cleanly — the PoE-league / D3-season engine, the genre's most reliable recurring-engagement driver.
- **📦 Account-wide shared stash — cross-character meta.** A new **account identity** spans all a browser's heroes; the stash panel gains a **SHARED** tab whose contents travel across every character you own. Stored in its own account file (never inside a hero profile, so items are never double-stored), saved on every deposit. Alts finally inherit something.
- **Verification note:** the surrounding floor lifecycle, ladder, persistence, and pure rift/paragon math are all test-covered and green; the live rift *run* (enter → cull → Warden → clear) wasn't end-to-end smoke-tested (it's an endgame flow with no bot script yet) — worth a manual playthrough. Browser extension isn't connected this session, so no visual pass on the paragon panel / rift portal.

That completes the three-thrust "best Diablo-like" plan (combat feel & density → build depth & agency → the endgame loop). The bones of a genuinely sticky ARPG are all here now.

## Rift hotfix — the stairs trap and the death loop

Live testing surfaced a nasty compounding bug: descending stairs in a Rift dumped you out of Rift mode into a catastrophically-scaled instance (RIFT_ACT 90 ran through the normal travel path → danger 625 → hundreds of one-shotting mobs), and respawning in place with no invulnerability then locked you in an inescapable death loop.

- **Rifts are now a single sealed arena — no descending.** `usestairs` is refused in a Rift ("the Rift has no way down — cull the horde, then face the Warden"), so the act-90 scaling explosion can't happen. You stay on the one arena (where death respawns you on the safe town strip).
- **Respawn invulnerability (a general fix).** Every respawn now grants ~3s of immunity with the golden protection shimmer, so a swarm can never spawn-camp you into a death loop — anywhere, not just in Rifts.
- **Always an exit.** A Rift now always carries an "Abandon the Rift" portal on its safe town strip (reachable by town portal or on respawn), so you can bail to town even mid-run — you can never be trapped.

Typecheck (×3) + full `npm run smoke` green.

## Enemy variety, slice 1 — behavioral champion packs (fighting deep-content monotony)

The Abyss (and every deep floor) scaled only by HP and damage — the flagged "deep-content monotony." Champion packs had eight modifiers, but five were pure stat multipliers and three were elemental; none changed *how* you fought. This slice opens a new axis: **behavioral pack affixes** that change the verb of combat, not the numbers. Two land here as an end-to-end vertical slice, with the plumbing for the rest (Mortar, Warded, Teleporting, Vortex — the telegraph-based ones) proven and ready.

- **Vampiric** (red pack) — heals itself for **half of every blow it lands on you**. Ignore it and it never dies; burst it down or peel off its target. A green life-drain mote rises off it each time it drinks, so you can read what's happening.
- **Spiked** (orange pack) — throws **15% of every blow you land right back at you**. Big single hits punish; chip damage is safe. The reflect is gated so it can never cascade off its own DoTs or splash.
- Champion auras now tint to their modifier (Vampiric bleeds red, Spiked burns orange) instead of the flat champion blue — the color is a warning you can read across the room, same as the name label.
- **Verification.** New dev-only, production-gated test hooks (`smokespawnchamp` / `smokeclear`) let a probe force a champion of a named modifier and reset between runs, so behavioral affixes — a ~20% random roll otherwise — can be checked deterministically. `scratchpad/champ-affix-probe.ts` proves both against a live server: Vampiric wounded-then-climbs while the hero holds fire; Spiked costs the hero real hp over a fixed swing routine where a no-reflect control costs zero (clean isolation — the hero attacks from outside the pack's own strike range). Typecheck (×3), client production build, and full `npm run smoke` all green.
- **Also fixed here:** the smoke suite had been red since the Q/E/F→1/2/3 hotkey migration — it still asserted skills auto-bind to `Q`. Updated the skill-bind, cast, rebind round-trip, and persistence checks to the numeric slots; the full suite passes again.

## Enemy variety, slice 2 — telegraph packs (Mortar & Warded)

The behavioral-affix axis gets its harder pair — the two that need a real monster→player telegraph system (the existing hazard system is player-owned and only hits monsters). Both reuse the boss-nova telegraph pattern (a warning with a lead time, then the payoff), so they read fair: the label warns you, the ground or the shimmer warns you, and you get a beat to answer.

- **Mortar** (teal pack) — lobs a shell at **where you're standing**, locked the instant it launches. A ring fills on the ground over ~0.95s, then the spot erupts for AoE. Standing still is death; keep moving and the blast lands on nothing. Small blast radius so it's always sidesteppable, staggered per-champion so a whole pack doesn't barrage you as one.
- **Warded** (gold pack) — raises a **damage-immunity bubble** every ~6s that holds ~2.1s and refuses *everything* (no hp, no procs, no leech). Burst it in the gaps or wait the shimmer out. A gold shield follows each warded champion while its bubble is up.
- Built on a new telegraph path: server-only per-monster timers drive `mortarwarn`/`mortarhit` and `wardup` broadcasts (with their own durations, so the client is immune to clock skew); the client paints a filling ground ring + earth-burst for Mortar and a following shield for Warded; ward damage is refused with one guard at the top of `damageMonster`.
- **Verification.** `scratchpad/champ-affix-probe.ts` now covers all four behavioral affixes against a live server and passes green: Mortar telegraphs → detonates → damages a hero who holds still; Warded raises a bubble, refuses damage while up, and takes chip damage in the gaps. A new dev-only `smokegod` hook (production-gated, alongside `smokespawnchamp`/`smokeclear`) hands the probe a large hp pool so it can sit in sustained combat without dying and respawning to town — which had been silently breaking the aggro-gated telegraph tests (monsters never engage a player on town's sacred ground). Typecheck (×3), client production build, and full `npm run smoke` all green (a separate, pre-existing "random hero gold" flake — auto-pickup grabbing floor gold in the join window — is unrelated and clears on re-run).

## Track B, slice 1 — the second book of runewords (24 → 34)

The runeword deck was weapon-heavy (11 weapon words vs 3 helm / 3 offhand / 4 chest) and thin on four-socket endgame grails (only 3). Ten new words fill those gaps — armor slots get real options, and the deep gets two more four-socket chases — using the existing rune alphabet and effect registry:

- **Armor words:** *Wardvigil* (helm — all-res / mana / dodge), *Mindspire* (helm — a caster's crown: mana, regen, cdr + Arcane Surge), *Ironbark* (chest — armor / life / thorns + Frostplate), *Tidecaller* (offhand — cold / mana / res + Frostbite nova), *Lightward* (offhand — lightning bulwark).
- **Weapon words:** *Wyrmtongue* (fire + Immolation), *Soulcinder* (leech + Detonation).
- **Four-socket grails:** *Doomsayer* (weapon — dmg% / crit / leech + Executioner), *Everstorm* (weapon — lightning + Lightning Storm), *Sanctuary* (chest — the defensive endgame: armor / all-res / life + Aegis).
- Each new word has a unique (slot, exact-rune-sequence) so nothing shadows an existing word; a script check confirms zero collisions across all 34, and all ten form correctly through `matchRuneword`. Typecheck (×3, which enforces valid stat keys on every bonus) and full `npm run smoke` green (the runeword battery + a re-run past the known jewel-auto-equip flake).

## Balance pass — the loot fountain and the endless bullet-sponge

A data-driven pass (`scratchpad/balance-check.ts`, now with density-plateau, per-floor-loot, and HP-sponge sections) turned two of the changelog's long-flagged "design calls" into concrete changes. It also **cleared a myth**: the feared difficulty *cliff* isn't real — Normal spans danger 1–28, Nightmare 29–56, Hell 57–84, each tier picking up exactly where the last ended, so the transitions are continuous. Left the density plateau (pack/elite caps by danger ~14) untouched for now — the new behavioral affixes already inject deep-fight variety.

- **The loot fountain, trimmed.** When packs grew from a cap of 5 to 12, per-floor loot quietly ~2.4×'d (a deep floor rained ~20 gear + ~1.2 unique+), softening the deliberate "Great Drought" scarcity — but `DROP_CHANCE` had been left at 15% on purpose, pending a call. Now **15% → 11%**: ~14.5 gear/floor instead of ~20, 1 gear every 9.1 kills (was 6.7), 1 unique+ every 154 kills at MF0 (was 112) — still far from dry, and each beam matters more again. Boss/elite/guaranteed drops and the rarity *spread* are untouched; this only thins the trash rain.
- **The endless Abyss stays a fight, not a sponge.** Monster HP/damage scaled a flat +0.35/+0.30 per danger *forever*, so by deep Abyss (danger 84) enemies hit 30× HP and 26× damage — against a hero whose base HP/DPS growth stops at the level cap (only paragon trickles). Scaling now **eases past danger 28** (one full campaign): +0.35/+0.30 through the base game, then +0.22/+0.20 in the deep. Continuous at the knee (no cliff): Act IV boss is unchanged at 10.45×, Abyss f1 is 10.67×, and danger 84 now lands ~22.8× HP / ~20× damage instead of 30×/26×. **The entire four-act Normal campaign is numerically identical to before** — only the deep (Nightmare/Hell late acts + the endless Abyss, all danger > 28) gentles, exactly where bounded player power was falling behind.
- Typecheck (×3), and the drop/scaling math is covered by the balance battery + `npm run smoke` (the grind test leans on guaranteed elite drops, so the thinner trash rain doesn't flake it).

## Track B, slice 2 — the Ternion Altar reforge (targeted crafting)

The altar's recipes were "have the ingredients, touch it, hope the right one fires" — and there was no way to *fix* a so-close rare with one bad affix. Now the altar is a proper **crafting panel**, and reforge closes the chase's last mile.

- **Reforge.** Any identified magic or rare piece can be re-rolled at the altar: same base, same rarity, same item level — fresh affixes — for a gold fee that scales with ilvl (rares cost far more than magics). It's the targeted, gamble-your-own-item loop the itemization was missing: found a great base with a junk roll? Feed it gold until it sings. Items with seated runes/jewels are refused (you'd lose the stones); the id is preserved so worn/stash references stay put.
- **The recipe book, now buttons.** Touching the altar opens a panel listing your reforge-eligible gear (with per-item cost) and the existing recipes as **explicit buttons**, lit only when you hold the reagents — rune upgrade (3 identical → next tier), 3 magic → an unidentified rare, 3 rare → an *Adept's* rare (+1 skills), and the peg-leg secret when you carry it. No more surprise auto-consumption on touch; you choose what to craft.
- Built by mirroring the smith's item-picker panel: server `sendAltar`/`handleReforge`/`handleAltarRecipe` (reforge reuses `generateItem` with a forced base+rarity, so it's the exact drop-generation logic), a new client altar panel with recipe + reforge rows, and a `reforgefx` flourish. `canReforge` / `reforgeCost` live in `common`.
- **Verification.** `scratchpad/reforge-probe.ts` proves it live (9/9): the panel opens, the granted rare is offered, six reforges yield **seven distinct affix sets** (the re-roll genuinely varies) while base/rarity/id hold, gold is charged, and the "3 magic → rare" button fires and consumes exactly its reagents. Full `npm run smoke` reforges a granted rare and checks the server cost matches the panel price with base/rarity/id preserved. A new dev-only `smokegive` hook (production-gated) hands a probe a reforgeable item + funds. Typecheck ×3, client build, smoke all green.

## Pathfinding fix — clicks that jammed, and the town-gate trap

Two movement bugs, both in the client's ground-click handler (`sendMove`), both fixed by making a plain click as smart as clicking a door already was:

- **Clicks that did nothing.** A ground click was silently dropped if the exact clicked pixel wasn't standable — so clicking a tree, a wall, a bit of decoration, or just slightly off a walkable tile left you standing still. Now a click **snaps to the nearest standable tile** and walks there.
- **Stuck in town next to the gate.** Ground clicks only ever sent a *straight-line* move (BFS pathfinding was reserved for clicking interactive objects). The town and the field are walled apart except at the single gate column, so a straight line from the plaza into the field drove into the wall, wall-slid, and dead-stopped — the "I'm right by the gate and can't leave" trap. Ground clicks now **route with BFS whenever the straight path is blocked** (and stay straight-line-responsive when it's clear), so the walk finds the gate — or the way around any tree or cathedral corner — on its own.
- Hold-to-walk defers to the BFS follower while a route is in progress (no stomping), and resumes free-steering on open ground.
- **Verification.** `scratchpad/pathfind-check.ts` runs the exact client algorithms (findPath / lineClear / nearestStandable) against real generated surfaces across five seeds: the straight town→field line is blocked every time, BFS always finds a route, and that route always crosses the gate — plus a wall-click snaps to a standable tile. Client typecheck + production build clean. (Client-only; the server's movement is untouched, so the headless smoke is unaffected.)

## Rift UX — the stairs-lock message tells the truth now

A player in a Rift who pressed the (intentionally dead) stairs always got the same line — "cull the horde, then face the Warden" — even after the Warden was dead and the rift cleared, which read like the run was bugged/stuck. The message is now state-aware: it shows the kill progress toward summoning the Warden (`cull the horde (N/60)`), then "the Rift Warden bars the way" once it's up, then "the Rift is spent — step through the portal home" once cleared. (Rifts remain sealed with no descent by design — this only fixes the misleading text. The Abyss, reached by beating Act 4 and taking the real stairs, is unaffected.)

## Legendary Powers II, slice 1 — the Sorcerer's two new chase items

The "gear rewrites a skill" system (`SKILL_POWERS`) had exactly six powers — one per class, on one signature skill each — so only ~1 skill in 5 was ever build-defining. This begins tripling that. First vertical slice: the Sorcerer gets two more skill-transforming epics (6 → 8 powers total).

- **The Tempest Coil** (orb) — **Stormfork**: Chain Lightning forks to **two more foes** (past its four-jump cap) and **stuns** everything it strikes. Turns the single-target zap into a room-clearing, crowd-locking chain.
- **Voidstride** (warstaff) — **Riftwalk**: Teleport tears a **burning arcane rift at BOTH ends** — departure and arrival — each searing everything in it for a few seconds. Blink through a pack and leave two damage zones behind; escape becomes offense.
- Built on the existing plumbing: powers ride the item's `power` field into `p.powers`, and each skill handler branches on it (Stormfork extends the chain's jump cap + applies `stunUntil`; Riftwalk pushes two point-hazards through the proven firewall damage system + a new `riftbloom` visual). Both new epics carry `plusSkills +1` like every power item.
- **Verification.** `scratchpad/powers-probe.ts` proves both live: with Stormfork the chain strikes **6 foes vs the base 4**; Riftwalk fires **two** rift blooms (from + to) and ticks damage into a foe left in the departure rift. A new dev-only `smokepower` hook grants a power directly so the probe can test a handler branch without farming the epic. The smoke's data battery now also validates that every item `power` maps to a real `SKILL_POWERS` entry pointing at a real skill (catches future typos). Typecheck ×3, client build, full `npm run smoke` green.

## Legendary Powers II, slice 2 — the other five classes (the system is now 6 → 18)

The remaining five classes each get two skill-rewriting epics, completing the thrust: every class now has three build-defining chase items instead of one, and every one of ~18 skills that could carry a power now does. Ten new powers, ten new epics:

- **Barbarian** — *Groundsplitter* (**Aftershock**: Leap Slam leaves a quake that keeps rupturing where you land) · *The Sundering* (**Sundering Roar**: War Cry shreds the pack's guard — they take more damage — and hurls them back).
- **Rogue** — *Winter's Recompense* (**Killing Frost**: Frost Arrow shatters into a cold nova on impact) · *The Ricochet* (**Ricochet**: Impaling Shot splits a second bolt into a parallel lane).
- **Paladin** — *The Zealot's Oath* (**Holy Fervor**: every fifth Zeal detonates a nova of holy light) · *The Warding Light* (**Sanctuary**: Prayer wraps the whole party in a shield that swallows the next blow each).
- **Necromancer** — *The Plaguebringer* (**Contagion**: Poison Nova leaves a lingering plague pool) · *The Long Withering* (**Plaguecarrier**: a withered foe's death spreads the curse to everything around the corpse).
- **Druid** — *Emberheart* (**Cataclysm**: Volcano erupts a second time off-center) · *The Wildcaller* (**Pack Leader**: shifting to Werewolf calls a spirit wolf to fight beside you).
- Built on the same plumbing as slice 1 — a `SKILL_POWERS` entry, a `FIXED_ITEM` with a `power` field, and a branch on `p.powers.has(id)` in that skill's handler — reusing proven systems throughout: the firewall hazard for the quake/plague pools, `vulnUntil` for the guard-shred, `stunUntil`/knockback for the rout, the pet system for the spirit wolf, and a `damagePlayer` shield gate for Sanctuary. New shared client visuals: a `poolfx` lingering ground pool (quake amber / plague green) and the wolf pet's amber spectral glow.
- **Verification.** `scratchpad/powers-probe2.ts` drives one hero per class (levelled via a new dev-only `smokelevel` hook so tier-gated skills and their prereqs can be learned) and confirms all ten live: the quake/plague pools bloom, the frost shatter novas, Ricochet fires two lanes, the fifth Zeal detonates, Sanctuary grants a shield, the plague leaps from a corpse, Volcano erupts twice, and the spirit wolf appears. A grep gate also confirms every `powers.has(...)` string in the server matches a real `SKILL_POWERS` key, and the smoke data battery validates every item→power→skill link. Typecheck ×3, client build, full `npm run smoke` green.

## Enemy variety — the Hexer (Cursed) champion pack

Behavioral champion packs teach you to fight *differently*, not just harder — Mortar makes you keep moving, Warded makes you time your burst. The fifth of these, and the first that attacks your **offense** instead of your health:

- **Hexer** (purple aura) — from range (≤300u), a Hexer lays a **telegraphed curse-circle on where you're standing**: a purple ring gathers inward over ~0.85s, and if you're still inside when it seals, your own blows are **sapped to 60% for 4s**. It doesn't hurt you — it *declaws* you. Two clean counters, both readable from the tell: step out of the closing ring, or burst the caster before it seals. Backing off past its cast range shuts it down entirely.
- Built entirely on the proven Mortar telegraph plumbing: a `hexer` flag on `ChampionMod`, a per-monster cast/seal timer pair mirroring the mortar shell, a locked-at-cast target (dodgeable by design), and a single application point — the curse rides a new server-only `Player.hexUntil` and is read once in `outgoingDamage`, the choke point every player hit already flows through, so it composes with every skill, crit, and buff without touching any skill handler. New client events `hexwarn`/`hexhit` render the inward-sealing ring, the implosion, and a "Cursed!" float when the local hero is caught. The aura color is data-driven, so it lit up for free.
- **Verification.** Typecheck ×2 (server + client) green; `common` validated transitively as always. A new smoke assertion confirms the Hexer mod carries its behavioral flag, and both new broadcast events are registered. Full `npm run smoke` green (after shrugging off a pre-existing loot-RNG flake in the unrelated jewel auto-equip check).

## Build depth — class keystones (one transformative capstone per class)

Every passive in the trees was a stat stick (`+dmgPct`, `+crit`); the only *build-defining* effects lived behind found epics (`SKILL_POWERS`). This adds the missing layer: a **keystone** per class at the Transcendence tier (level 30, single rank, no loot) — a real choice, since the point could instead buy flat endgame stats.

- **Barbarian — Immovable**: cannot be chilled or slowed. The facetank answer to cold casters and the Hexer's kin.
- **Rogue — Lethality**: critical hits deal **×2.5** instead of ×2. The payoff node for a crit build.
- **Sorcerer — Unraveling**: your attacks ignore an extra **25%** of monster elemental resistance — the answer to Hell's overcapped and the resistant bosses.
- **Paladin — Bulwark**: while above **60% life**, take **20% less** damage. Rewards staying healthy; makes the frontline a wall.
- **Necromancer — Soul Siphon**: each kill restores **3% of life and mana**. Turns a room-clear into sustain.
- **Druid — Primal Fury**: in Werewolf form, **+30% damage and attack speed**. Commits you to the shape.

- Built on the proven `powers.has(id)` pattern — a new single-`keystone` marker on `SkillNode` (the string is the rule shown in the tooltip; presence brands the node), allocated through the normal skill economy and checked in combat via one `hasKeystone(p, id)` helper. Each effect is a 1–3 line branch at an existing choke point: the `outgoingDamage` crit/wolf multipliers (Lethality, Primal Fury damage), `attackCooldown` (Primal Fury speed), the monster-resistance penetration calc (Unraveling), the `damageMonster` kill point (Soul Siphon), `damagePlayer`'s reduction step (Bulwark), and the two player-chill application points (Immovable). No new systems, no stat-block bloat — keystones deliberately carry no `passive` stats. The skill panel brands them "◆ KEYSTONE" and states the rule.
- **Verification.** Typecheck ×2 (server + client) + client build green. The smoke data battery now asserts exactly one keystone per class, single-rank, at tier 5, and that no keystone also carries a stat block (they're mutually exclusive). Full `npm run smoke` green.

## Extensive skill system, slice 1 — the synergy web + Barbarian's third tree

Two foundations for deeper builds:
- **Synergy web (multi-source).** Skill synergies were a single source each (`synergy: {from,pct}`) — a linear chain. Now `synergies: [...]` is an array: a skill can be powered by *several* related skills, so investing across a tree pays off and the tooltip lists every source. Pure enabling change — all 20 existing synergies migrated 1:1 with no balance shift; a smoke assertion proves multi-source stacking is multiplicative.
- **Barbarian gets a third tree — Carnage.** A bleed-and-sustain brawler path, distinct from Might (burst) and War Cries (support): **Cleave** (a wide forward sweep — the front rank at once), **Rend** (a strike that opens a heavy 4-tick bleed, reusing the Bloodletter wound system; a fresh Rend refreshes but never shortens a deeper wound), plus **Bloodlust** (lifesteal/attack-speed), **War Paint** (dmg/crit), and **Red Harvest** (Transcendence lifesteal). Rend synergizes off both Cleave and Bash — the new web in action. New `rendfx` blood spray on the client.

The client skill panel already lays out dynamically by tree column × tier row, so the third column appeared with no layout work. **Verification:** typecheck ×2 + client build + full `npm run smoke` green (incl. the multi-source stacking assertion). Remaining classes' third trees follow in subsequent slices.

## Extensive skill system, slice 2 — third trees for the other five classes

Every class now has a third skill tree — a distinct third build archetype — completing the expansion (the trees went 2→3 across the board; ~85 skill nodes → 111). Each new tree adds two actives (built on existing primitives, so no new combat systems) plus passives, wired into the multi-source synergy web:

- **Rogue — Venom.** Area denial beside Archery and Shadow: **Caltrops** (a slowing, wounding trap field) and **Noxious Cloud** (a lingering poison pool). Both ride the ground-hazard system; the client's `poolfx` renders them.
- **Sorcerer — Winter.** A dedicated cold spec: **Ice Shard** (a fast, cheap chilling bolt — a new `frostbolt` projectile) and **Blizzard** (a lingering cold storm), plus **Cold Mastery** (flat penetration — the answer to resistant foes).
- **Paladin — Retribution.** Holy-fire offense: **Holy Fire** (a self-centered nova to clear crowds) and **Holy Wrath** (a heavy single strike with holy splash). Reuses the `classfx` "prayer" ring.
- **Necromancer — Blood Magic.** A self-sustaining caster line (distinct from the existing Poison & Bone): **Blood Spear** (a lance skewering a whole line, on the pierce primitive) and **Blood Boil** (an AoE burst), with lifesteal passives throughout.
- **Druid — Spirits.** A summoner/beastmaster path: **Spirit Wolf** (call one to your side) and **Call the Pack** (the whole pack at once), on the pet system with a per-druid cap.

The synergy web threads through all of them — e.g. Noxious off Caltrops+Toxin, Blizzard off Ice Shard, Holy Wrath off Holy Fire+Smite, Blood Boil off Blood Spear+Wither, Call the Pack off Spirit Wolf. The client skill panel lays out by tree column × tier row, so every third column appeared with no layout work. **Verification:** typecheck ×2 + client build + full `npm run smoke` green, with a new data assertion that every class fields exactly three trees; the 111-node battery validates every synergy source, requirement, and gate.
