# Hollowmark

Browser-based multiplayer isometric ARPG in the tradition of the late-90s greats — with a world, bestiary, and legendarium all its own: four acts down a dying caravan road into an endless abyss, six classes with two skill trees each, sockets/runewords/jewels, co-op parties on an authoritative server, and a hardcore permadeath vow for those who dare.

## Stack

- `common/` — shared TypeScript: map data, constants, collision, item logic (later). Imported as source by both sides.
- `server/` — Node + [Colyseus](https://colyseus.io). Authoritative simulation at 20 Hz, room `dungeon`, port 2567.
- `client/` — [Phaser 3](https://phaser.io) + Vite. Isometric projection of the server's flat 2D world, entity interpolation, click-to-move.

## Run

```sh
npm install
npm run dev          # starts server (:2567) and client (:5173) together
```

Open http://localhost:5173 — you land in the **Hollowmere Lobby**. Forge games at **Normal, Nightmare, or Hell** (each earned by unmaking Uldrath in the one before; sharper worlds tax your resistances −40/−100 but weight the loot table toward set/unique/legendary/epic ×1.6/×2.5). Heroes cap at **level 99**, with the trees' fifth tier — Transcendence — opening at 30: join an open game or forge a new one, beside the **⚜ Hall of Legends** — every hero this server remembers, ranked by depth, with the fallen hardcore heroes honored in memorial. Then **choose your hero**: this browser keeps a roster of characters (create as many as you like), and when joining an existing game you can also take a **⚄ RANDOM HERO** — forged at the party's level with gear rolled for that depth. The same hero can't enter a game twice (each window needs its own character). In game, **Escape** opens the menu (resume / exit to lobby) and **Enter** opens party chat (`[YourName] message`, seen by everyone in the game).

The **character creation screen** (via ★ NEW HERO on the hero-select screen) lets you pick any of the six classes, name your hero — and, if you dare, swear the **☠ HARDCORE vow: one life, death is forever.** Hardcore heroes wear the skull on their nameplate for all to see; when they fall, the corpse stays down, an epitaph plays, the profile is sealed with its cause of death, and the roster forever shows them at rest. This browser's heroes are kept in `localStorage.arpg_roster` — forge as many as you like. Every player death also raises a **gravestone** where they fell (until the floor changes).

Controls: **left-click** move (hold to keep walking), or click on/near a ground item to walk over and loot it (auto-equips if the slot is free) · **right-click or shift+left-click** attack (hold to keep attacking) · **Q / E / F** bound skills at the cursor · **R** health potion · **W** mana potion · **Enter** chat · **Esc** menu · **T** town portal (2s channel — interrupted if you're hit) · **I** or **B** inventory · **C** character sheet · **S** skill tree · **J** quest log (click a quest to track it on screen) · **H** your rogue (stats + gear) · **M** map — cycles minimap → full-screen map (hover points of interest for names) → hidden · **G** ping the world for your party (also: click the full-screen map) · **N** ambience · **mouse wheel** zoom. Doors, stairs, shrines, and townsfolk are all **left-click** — your hero pathfinds to them through the trees; right-click always fights. Gold and potions are picked up automatically by walking over them. Floors are covered in fog of war that you reveal by exploring — and exploring only buys you *memory*: outside your torchlight, even mapped ground sits under deepening gloom. The minimap only shows where you've been.

**Character sheet (C)**: four attributes, D2-style — Strength (+damage), Dexterity (+crit and +dodge), Vitality (+life), Energy (+mana/regen); your class's signature attribute adds extra damage. 5 stat points per level, plus a full derived-stats readout (damage range, crit, dodge, armor, speeds, steals, MF/GF…).

**Skill tree (S)**: two trees per class, 1 skill point per level. Actives and passives rank to 5; tier gates at levels 1/4/8/12 with prerequisites; **synergies** boost skills from hard points in others; a rank-3 **ultimate** crowns each class (Wrath of the Mountain / Rain of Vengeance / Meteor). Click to learn (actives auto-bind to Q/E/F), right-click + key to rebind.

**Hollowmere (town)**: every hero **starts in town** — new, returning, or freshly dead (death sends you home). It's a real settlement now: Senna's Hut, Edric's House, the **Smithy**, **The Crooked Lantern** tavern, Pip's Shack, the Old Well, a campfire, and townsfolk wandering the plaza. Its merchants are clickable people: **Torvald** at the smithy sells 7 randomly-rolled identified items (magic/rare, occasionally unique and beyond — restocked per floor; right-click bag items near him to sell, and he **identifies for free**); **Lysa the Alchemist** sells health (40g) and mana (60g) potions; **Fenwick** by the tavern runs the gamble — a spread of 8 **unidentified bases** whose rolls follow the full loot table and can land item levels far beyond your depth (pay, pray, identify); and **Captain Maren of the Wardens** by Edric's house hires out **mercenaries**: three distinctly-skilled Warden archers (ember / frost / deadeye), priced to your level. Your rogue follows, fights, draws aggro, levels with you, wears **weapon/helm/chest** gear (press **H** to manage her), and can die — Maren raises the fallen, for a price. Walk out the **south gate** into the current floor, or touch **Your Stash** (30 slots), the **Waypoint** (jumps the party to your deepest known floor, persisted), or the **Ternion Altar** (3 identical runes → next tier; 3 magic items → unidentified rare) first. Press **T** in the field for a portal home and T again to return. Monsters cannot set foot in town — they crowd the gate and wait.

**Trading**: click a companion's name in the **party bars** (top-left) to offer a trade. They accept, and a two-sided table opens: click bag items to put them on the table (up to 6), add gold in steps, and **confirm**. The deal only executes when *both* hands shake — and any change to either offer burns both confirmations (the anti-scam law). Wander apart, die, or change floors and the deal is off. Server-validated end to end: items and gold move atomically or not at all.

**Quests (J)**: a persistent 17-quest log — the forest arc (*The Overgrowth*, *The Cathedral*, the *Watchtower* climb, cave *Spelunking*), boss hunts (*Hooks and Cleavers*, *The Thorned Maiden*, Vuruk, Orvath, Malgrim, Uldrath, the Hollow Pilgrim, Bovax), and milestones (first gamble, first transmute, first unique+ equipped, level 10, floor 5). Kills credit the whole party; completions pay gold + XP on the spot. **Click any quest to track it** top-left with a live counter.

**Danger**: monsters deal typed damage — demons and bosses burn (fire), Corvessa's arrows chill you (cold slow), and champion packs roll a shared modifier that changes the fight, not just its numbers: the classics (**Fire/Cold/Lightning Enchanted** — FE explodes on death, **Frenzied/Brutal/Stoneskin/Ghostly/Fanatic**) plus behavioral packs that make you *play differently* — **Vampiric** (a red pack that heals itself for half of every blow it lands — burst it down), **Spiked** (an orange pack that throws part of each blow back at you — big hits punish, chip damage is safe), **Mortar** (a teal pack that lobs telegraphed shells at where you're standing — a ring warns, then the ground erupts, so keep moving), and **Warded** (a gold pack that raises a periodic bubble which eats *all* damage — burst it in the gaps or wait it out). Read the label before you swing. Armor stops steel, **resistances** (fire/cold/lightning, cap 75%) stop the elements. Dying scatters **15% of your carried gold** at your corpse — run back for it. Rare-and-better loot drops **unidentified**: the beam tells you the tier, identifying tells you the truth. Every floor rolls a **bounty** (HUD, top) — complete it for party XP, gold, and a boosted drop. Rarely, *a dark presence walks the floor*: slay **the Hollow Pilgrim** for a chance at **The Pilgrim's Burden**, the unique charm. Slay the King of Dread on **floor 10+** for the victory banner; the descent itself is endless. And should a Treasure Goblin drop a certain **peg leg**, take it to the Ternion Altar. Moo.

Equipment: 9 paper-doll slots — weapon, offhand, helm, chest, ring ×2, amulet, belt, boots. Monsters drop health potions (~14% chance, Hargol always drops 2). Drops are deliberately scarce — when a beam lights up, it matters.

**The world above:** each act's floor 1 is its open surface — Act I is the Mournfield forest outside Hollowmere's gate, all swaying trees, dead trunks, and grey daylight, roamed by **imps** (cowards that scatter shrieking when a packmate dies), **spinebacks** (they kite and spit spines), and the shambling dead. Off the trail stand places worth exploring: a two-story **Watchtower** (click the door to enter, climb the stairs — the cache on the top floor is guarded) and **2-3 dark caves** (rocky mouths in the field; lairs, chests, sometimes a shrine inside). A winding trail leads to a **stone cathedral** deep in the wood; Hargol the Flenser prowls before its doors, and the stairs down wait inside.

**FOUR ACTS**: the world is a caravan road east — **Act I The Mournfield** (Hollowmere, the cathedral floors, Vessira), **Act II The Sunscar Wastes** (Zerath Oasis, sandstorms, scarabs and the entombed, the Sunken Necropolis, Vuruk mid-tomb, **Queen Nyzat** at the bottom), **Act III The Drowned Green** (Mirefall Landing, jungle rain, mudlings and bogwitches, the flooded Ziggurat, Orvath mid-temple, **Ssarim the Drowned God**), **Act IV The Hollow Throne** (The Last Vigil under ashfall, doomguards and the flayed, Aldric → Malgrim → **Uldrath** — victory). Each act = surface + six floors; the act boss guards the last, and felling it **opens the caravan** to the next land for everyone present (being carried along unlocks the destination too — rushing lives). After Uldrath: the **Endless Abyss**, infinite floors, every palette and boss rotating, with its own depth ladder.

**THE WAYPOINT NETWORK**: stones stand in every act's town (auto-claimed on arrival) and on **floors 3 and 5** of every descent. Touch one to claim it forever and open the network panel — every stone you've claimed, grouped by act; click to move the whole party. The **caravan wagon** at each town's east edge rolls to the next act (or names the boss still barring the way).

**The descent:** every floor is procedurally generated — five layout algorithms (halls, warrens, grand vaults, caverns, concentric rings) under fifteen palettes, each with its own ambient score. Find the purple stairs — guarded by the floor's boss — and **click them** to take the whole party down. Difficulty, item level, and gold all scale with **true depth** across acts (+35%/+30% per step), packs grow, elite odds climb, and deeper items roll bigger stats and better bases.

Classes (primary attack is always free; everything else comes from the tree):
- **Barbarian** — melee sweep · Bash, Whirlwind, Leap Slam, Battle Shout, War Cry · ult **Wrath of the Mountain**
- **Rogue** — arrow · Multishot, Frost Arrow, Impaling Shot, Dash · ult **Rain of Vengeance**
- **Sorcerer** — splash fireball · Chain Lightning, Frost Nova, Firewall, Teleport · ult **Meteor**
- **Paladin** — holy melee · Smite, Zeal, Hammer of Faith, **Prayer (party heal)** · ult **Judgment**
- **Necromancer** — bone bolt · Teeth, Wither (curse: slow + amp damage), Poison Nova, **Raise Skeleton (pets!)** · ult **Army of the Dead**
- **Druid** — thorn bolt · Firestorm, Twister, Volcano, **Werewolf (shapeshift)** · ult **Hurricane** (the storm follows you)

**The world**: every floor cycles through 8 palettes (Cathedral, Catacombs, Frozen, Caves, Swamp, Sanguine, Hell, Void) and 4 layout styles (halls, warrens, grand vaults, caverns), each with its own **ambient score**. Nine bosses rotate the depths — Vessira, Vuruk, Orvath, Aldric, and Uldrath joined the roster, each with unique mechanics and signature drops.

**Hargol the Flenser** waits at the north end of the map — 400 hp, hits like a truck, guaranteed 2 drops from a boosted loot table (never common), respawns 60s after dying. Zombie camps respawn 25s after being cleared; players respawn at the fountain 3s after dying, and slowly regenerate out of combat. Mana regenerates constantly.

Loot: seven rarities — common, magic, rare, **set** (green, partial + full bonuses), unique / legendary / epic (hand-designed, beams, **unique ★ effects** like corpse explosion and +1 damage per level). Tiered affixes unlock with depth; class-locked affixes only count for the right class. Weapons/offhands/helms/chests roll **sockets**; **runes** drop and can be socketed (click rune → click item) — the right sequence forms a **runeword** — 34 words across a 20-rune alphabet, and they only take in plain steel (white bases socket generously and announce themselves: "Kite Shield ◈3"). **Jewels** seat into any socket for raw stats — but a seated stone bars the word forever. All rolls server-side; Magic Find shifts the odds.

**Persistence**: every hero (class, level, attributes, skills, gold, gear, inventory, stash, waypoint depth) is saved server-side and restored whenever you return — survives refreshes, new rooms, and server restarts. Profiles live in `server/data/profiles/`; the browser's roster of hero keys lives in `localStorage.arpg_roster`.

## Test

```sh
npm run smoke        # headless 2-client multiplayer test (server must be running)
```

## Roadmap

Phase 0 walking skeleton → combat → loot (common/magic/rare/unique/legendary/epic) → progression → farming loop → persistence.
