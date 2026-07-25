// THE WRITTEN WORLD: town dialogue, dungeon encounters, the Codex (bestiary,
// chronicle, reliquary), environmental set-pieces, and the authored story spine.
//
// ~950 lines of prose and data lifted out of index.ts, which re-exports all of it —
// so every existing `from "@hollowmark/common"` import is unchanged.
//
// BOSS_NAMES is a real runtime dependency (the BESTIARY reads it while this module
// initialises), so it comes from the ./bosses leaf and NOT from ./index — importing
// it from the barrel would form a cycle and throw a TDZ error at startup. The rest
// are types, imported with `import type` so they erase completely.
import { BOSS_NAMES } from "./bosses";
import { addStats, type ItemStats } from "./stats";
import type { Item, MonsterKind } from "./index";

// ============================================================
// --- storytelling: town dialogue windows + dungeon encounters ---
// The world's grim arc, told in the D1/D2 way: a talking-head window,
// paged text, and a few topics per speaker. Content is client-rendered
// from these tables (the client knows the NPC, the act, and your progress).
// ============================================================

// one subject an NPC will speak on; pages are shown one at a time.
// pagesByAct lets a townsperson's mood darken as you travel east.
export interface DialogueTopic {
  id: string;
  label: string; // the menu button
  pages: string[]; // default script
  pagesByAct?: Record<number, string[]>; // act-specific override
}

// a person you can talk to in town. Functional NPCs carry a shop button;
// storytellers are talk-only and appear ONLY in their own act's town.
export interface TownNpc {
  id: string; // resolved from the shrine (see shrineNpcId)
  name: string; // header of the dialogue window
  shopKind?: "vendor" | "gamble" | "alchemist" | "mercnpc"; // absent → talk-only
  shopLabel?: string; // the shop button text
  smith?: boolean; // offers the socket-punching forge (a second service button)
  storytellerAct?: number; // set for the act-scoped elders
  figure?: string; // client silhouette hint for talk-only townsfolk (elder|witch|child|priest|fisher|warden|keeper|squire)
  topics: DialogueTopic[];
}

// resolve a topic's script for the current act
export function topicPages(t: DialogueTopic, act: number): string[] {
  return t.pagesByAct?.[act] ?? t.pages;
}

// map a town shrine to the person standing on it
export function shrineNpcId(kind: string, variant: string): string {
  if (kind === "vendor") return "torvald";
  if (kind === "gamble") return "fenwick";
  if (kind === "alchemist") return "lysa";
  if (kind === "mercnpc")
    return ({ rogue: "maren", mage: "orsavio", barbarian: "hrothgar", paladin: "iseult" } as Record<string, string>)[variant] ?? "maren";
  if (kind === "storyteller") return variant;
  if (kind === "barkeep") return variant; // the bartender / hut resident carries its own id
  return "";
}

// the folk who keep the indoors warm: a barkeep behind every tavern's counter and a
// resident by every hut's fire — a different pair in each act's town, talk-only.
export const TAVERN_KEEPERS = ["brannoch", "sedira", "gullimon", "old_hesk"]; // act 1..4
export const HUT_RESIDENTS = ["mabel", "amara", "wickem", "greta"]; // act 1..4
export function tavernKeeperFor(act: number): string {
  return TAVERN_KEEPERS[Math.min(Math.max(act, 1), TAVERN_KEEPERS.length) - 1];
}
export function hutResidentFor(act: number): string {
  return HUT_RESIDENTS[Math.min(Math.max(act, 1), HUT_RESIDENTS.length) - 1];
}

// the act's storyteller — a new face in every land, sat by the campfire
export const STORYTELLERS = ["edric", "halqa", "vaol", "cael"]; // act 1..4 (abyss borrows the last)
export function storytellerFor(act: number): string {
  return STORYTELLERS[Math.min(Math.max(act, 1), STORYTELLERS.length) - 1];
}

// every act keeps its own talk-only townsfolk — the elder plus two locals — each
// standing at a fixed town slot, present ONLY while you walk that act. The three
// slots (elder / loremaster / warband tiles) are reused act to act.
export type ActNpcTile = "elder" | "loremaster" | "warband";
export const ACT_TOWN_NPCS: Record<number, Array<{ id: string; tile: ActNpcTile }>> = {
  1: [{ id: "edric", tile: "elder" }, { id: "senna", tile: "loremaster" }, { id: "pip", tile: "warband" }],
  2: [{ id: "halqa", tile: "elder" }, { id: "jenda", tile: "loremaster" }, { id: "ashk", tile: "warband" }],
  3: [{ id: "vaol", tile: "elder" }, { id: "oona", tile: "loremaster" }, { id: "deel", tile: "warband" }],
  4: [{ id: "cael", tile: "elder" }, { id: "adelheid", tile: "loremaster" }, { id: "tomas", tile: "warband" }],
};
export function actTownNpcs(act: number): Array<{ id: string; tile: ActNpcTile }> {
  return ACT_TOWN_NPCS[Math.min(Math.max(act, 1), 4)];
}

export const TOWN_NPCS: TownNpc[] = [
  // ---- the smith ----
  {
    id: "torvald", name: "Torvald", shopKind: "vendor", shopLabel: "Browse his wares", smith: true,
    topics: [
      { id: "steel", label: "Your steel", pages: [
        "\"You bring me the dead's leavings and call it shopping. Fine. Fine. It all sharpens the same.\"",
        "\"Steel remembers the hand that swung it. I hammer that out before I sell it to you. Mostly.\"",
        "\"Bring me runes and a clean blade and I'll tell you what word wants to live in it. Some words are hungry.\"",
      ]},
      { id: "town", label: "Hollowmere", pages: ["placeholder"], pagesByAct: {
        1: [
          "\"Hollowmere held when the cathedral fell. We built the wall in a night and a day. It held.\"",
          "\"Every soul east of here came through my gate first. Fewer come back through it. You will, though. You've the look.\"",
        ],
        2: [
          "\"Word came up the road — Zerath's wells are running black. My cousin drew water there. Drew it, and screamed.\"",
          "\"The forge stays lit. It's the only honest light left between here and the sand. Keep it at your back as long as you can.\"",
        ],
        3: [
          "\"They say the green country is drowning now. A whole land, going under, slow. I don't sleep much, hearing that.\"",
          "\"I put an extra bar on the gate last night. Old habit. As if a bar keeps out water. As if it keeps out him.\"",
        ],
        4: [
          "\"You've been to the Throne's doorstep and come back to buy a belt. There's something wrong with you. Good. Stay wrong.\"",
          "\"When you go down for the last of them — take the best steel I have. Don't haggle. Not for this one.\"",
        ],
      }},
    ],
  },
  // ---- the alchemist ----
  {
    id: "lysa", name: "Lysa", shopKind: "alchemist", shopLabel: "Buy flasks",
    topics: [
      { id: "flasks", label: "Her flasks", pages: [
        "\"Red for the body, blue for the mind. Drink the wrong one at the wrong time and you'll wish you'd bled out instead.\"",
        "\"I brewed these from marsh-root and worse. Don't ask what worse. You'd stop buying, and then you'd die, and then where would we be.\"",
      ]},
      { id: "dead", label: "The green ones", pages: [
        "\"You've seen the ones that don't stay down. The green ones. The bloated ones. It isn't sickness. Sickness ends.\"",
        "\"I cut one open once, to learn it. There was nothing inside that wanted to be a body. It just... insisted. That's the whole of it. It insists.\"",
        "\"So I make my flasks stronger every season. It isn't enough. It's never quite enough. Buy two.\"",
      ]},
    ],
  },
  // ---- the peddler / gamble ----
  {
    id: "fenwick", name: "Fenwick", shopKind: "gamble", shopLabel: "Try his gamble",
    topics: [
      { id: "gamble", label: "The gamble", pages: [
        "\"Pay, and pray. That's the whole arrangement. I sell you the wrapping; the dark inside is between you and your luck.\"",
        "\"I've handed a beggar a king's blade and a king a beggar's rag, same afternoon, same price. The road's fair like that. Fair and cruel.\"",
      ]},
      { id: "past", label: "Where he's from", pages: [
        "\"Where am I from? East. Always east of wherever you catch me. I keep one town ahead of the rot, and one behind the questions.\"",
        "\"I had a stall in Zerath, before the wells turned. And a table in the green country, before it went under. I do not go back for the merchandise. You understand.\"",
      ]},
    ],
  },
  // ---- the four hiring captains ----
  {
    id: "maren", name: "Captain Maren", shopKind: "mercnpc", shopLabel: "Recruit a Warden",
    topics: [
      { id: "wardens", label: "The Wardens", pages: [
        "\"The Wardens of the Sightless Eye. We were a hundred and twelve. You could hire any of the ones who are left. There are twelve.\"",
        "\"They shoot straight and they die quiet. Pay their bond, treat them well, and if they fall — come back to me. I'll raise them. It costs. Grief always does.\"",
      ]},
      { id: "corvessa", label: "Corvessa", pages: [
        "\"You'll meet a pale woman with a bow in the Mournfield. Corvessa. She was one of ours, once. The best of us.\"",
        "\"Then she went down into the cathedral to bring back the dead sisters, and she brought them back, and now she leads them. Cold arrows. She sings while she looses. Don't listen to the song.\"",
        "\"If you put her down — and you won't, but if — you tell her Maren remembers who she was. Then you burn her. Promise me the burning.\"",
      ]},
    ],
  },
  {
    id: "orsavio", name: "Orsavio, the Exiled Magus", shopKind: "mercnpc", shopLabel: "Recruit an acolyte",
    topics: [
      { id: "ternion", label: "The Ternion", pages: [
        "\"You've used the Altar in the square? Three runes, one greater. Three trinkets, one truth. That is Ternion work — the old order of threes.\"",
        "\"They transmuted the world in careful sets, and asked what the world would give in exchange. The world answered. The order is gone. The altar remains. Draw your own moral.\"",
      ]},
      { id: "exile", label: "His exile", pages: [
        "\"I am called exiled. Correct. I taught my acolytes to feel the shape of what is under the floors — to listen down. My tower listened back.\"",
        "\"They cast me out before it could open. So now I sell you children with candle-fire in their hands and I sleep in a town like everyone else, and I do not listen down. I do not. Some nights I nearly don't.\"",
      ]},
    ],
  },
  {
    id: "hrothgar", name: "Hrothgar, Chief of the Fells", shopKind: "mercnpc", shopLabel: "Recruit a warrior",
    topics: [
      { id: "kragmar", label: "Mount Kragmar", pages: [
        "\"My people swear by the Mountain. Kragmar. It stood before the Hollow Kings and it will stand after — that is the oath, and I have started to doubt it, and doubt is a new thing for me.\"",
        "\"I lead a warband down off the high fells because the cold that comes up out of these floors is not honest cold. It hates. Mountain cold does not hate. This does.\"",
      ]},
      { id: "warriors", label: "His warriors", pages: [
        "\"You want a big man with an axe at your shoulder. Sensible. Mine wade in where your archers won't. They soak the blow so you don't.\"",
        "\"They fight to the death and past it, and they do not thank you for the wage. Feed them, point them at something worth killing, and stay out of the arc.\"",
      ]},
    ],
  },
  {
    id: "iseult", name: "Dame Iseult, the Last Vigil", shopKind: "mercnpc", shopLabel: "Recruit a knight",
    topics: [
      { id: "vigil", label: "The Vigil", pages: [
        "\"The Last Vigil is the garrison at the foot of the Hollow Throne. We were the wall between the Kings and the rest of the world. Were.\"",
        "\"I keep a stall in a warm town and hire out knights because the wall has already fallen and someone has to make it mean something. So: take a knight. Make it mean something.\"",
      ]},
      { id: "aldric", label: "Aldric", pages: [
        "\"Below the Throne you'll find a knight in blackened plate. Aldric. He commanded the Vigil before me. He was the best of us — devout, unbending, kind, even.\"",
        "\"He went down to parley with the Kings and win us terms. He won terms. The terms were: kneel. He kneeled. 'I remember the light,' he'll tell you. 'I chose this.' Kill him gently, if you can. He was better than any of us.\"",
      ]},
    ],
  },

  // ==================================================================
  // ---- the storytellers: one elder per act (talk-only, act-scoped) ----
  // ==================================================================
  {
    id: "edric", name: "Edric the Elder", storytellerAct: 1, figure: "elder",
    topics: [
      { id: "land", label: "This land", pages: [
        "\"Sit. My legs are older than the wall. The Mournfield, you want to know about. It was only a forest, boy. Only a wood, with only wolves in it.\"",
        "\"Then the cathedral on the hill went quiet in the space of one winter. The bells stopped. The candles kept burning — you'll see, they burn without wicks now — and the wood began to weep.\"",
        "\"We named it the Mournfield after that. A whole country renamed for its grief. That is how far along we were before anyone thought to fight.\"",
      ]},
      { id: "boss", label: "The one below", pages: [
        "\"On the cathedral steps there is a thing with a butcher's apron and too many hooks. Hargol. The Flenser. He was the sexton, once — the man who kept the dead decent.\"",
        "\"Now he keeps them on hooks. 'Meat for the hooks,' he says, and he means you. Go around him if you're wise. You are not wise; you're a hero. So sharpen up.\"",
        "\"And deeper still, past the nave, the Thorned Maiden waits. Vessira. 'Every wound you carry, I planted.' She ends this act, and everything she says is true, which is the worst of her.\"",
      ]},
      { id: "dark", label: "The dark below", pages: [
        "\"You want the whole of it. All right. Three kings — brothers — went down into the deep floors an age ago and gave away their names to what lives there. Malgrim. Aldric. Uldrath.\"",
        "\"Nameless now, and crowned, they are unmaking the world from underneath. Slowly. Land by land. First the Mournfield. Then the wastes. Then the green. Each land is the rot a little further gone.\"",
        "\"You go down to cut it at the root. But every root you cut, the road opens deeper — toward the last of them. Toward Uldrath, who is what remains when all else is finished. I am too old to see the end of you. Go be seen.\"",
      ]},
    ],
  },
  {
    id: "halqa", name: "Halqa, the Sand-Blind", storytellerAct: 2, figure: "witch",
    topics: [
      { id: "land", label: "This land", pages: [
        "\"You smell the salt under the sand? Good nose. Zerath was green, traveler. A garden-country, wells like blue coins in every square. I saw it. Then I stopped seeing anything, which is its own mercy.\"",
        "\"The sand came up from below, not down from the sky. It drank the wells from underneath. Now the oasis is one green thumbnail pressed on a dead hand, and we call it home because the alternative is admitting it.\"",
        "\"I read the past in the grains now. It runs through my fingers, all of it, everyone who drowned in dry sand. There are a great many. Careful where you kneel out there. You'll be kneeling on people.\"",
      ]},
      { id: "boss", label: "The one below", pages: [
        "\"Under the Necropolis sits Queen Nyzat. The Embalmed. She ruled Zerath in the green days and she would not let it die, so she wore it — wore the whole drowning garden as a burial shroud, and lay down in the tombs, and waited.\"",
        "\"'I have worn this sand for a thousand years,' she'll tell you. She is not lying. She is never quite dead and never quite alive, and her children hatch out of the walls. Bring fire and patience.\"",
      ]},
      { id: "dark", label: "The dark below", pages: [
        "\"The old man in Hollowmere told you about the Kings, yes? Then you know the shape. Let me tell you the weight of it. The Mournfield grieved. Here, we are past grief. Here it is thirst.\"",
        "\"The rot does not conquer a land. It convinces it. It whispers to the ground until the ground agrees to stop being green. Zerath agreed. That is the horror — not that it was taken, but that it consented.\"",
        "\"Go down. Cut the root. But do not listen too long to anything down there. The wells listened. The gardens listened. Look what listening bought them.\"",
      ]},
    ],
  },
  {
    id: "vaol", name: "Vaol the Ferryman", storytellerAct: 3, figure: "fisher",
    topics: [
      { id: "land", label: "This land", pages: [
        "\"Mind the plank. The whole Landing floats now — Mirefall, they call it, because it fell into the mire and had the decency to keep its porch above water. Barely.\"",
        "\"The Drowned Green was the richest country in the world. Too much water, too much life. It could not hold all that living, so the ground gave way and it all poured downward, into the dark, still growing as it went.\"",
        "\"I pole the dead across the shallows for coin, when there is coin. When there is not, I pole them anyway. Someone has to. They get so lonely, drifting.\"",
      ]},
      { id: "boss", label: "The one below", pages: [
        "\"At the heart of the Ziggurat sits Ssarim. They call him the Drowned God, and I will not tell you he isn't one. He was the river's spirit, back when the river was only a river.\"",
        "\"'The river only ever asks once,' he says. It's true. It asked the green country for everything, once, and the country said yes without hearing the question. He'll ask you too. Keep your mouth shut and your blade wet.\"",
      ]},
      { id: "dark", label: "The dark below", pages: [
        "\"Three lands now you've watched go under, if you've eyes. Grief, then thirst, then the drowning. You feel the pattern tightening? It's a throat, closing. And we are the last of the swallow.\"",
        "\"The Kings do not hurry. That's what no one tells you. They have all the time there is, because they are what's left when time is finished. Every year you don't stop them is a year cheaper to them than to you.\"",
        "\"West of here the last garrison still stands — the Vigil, at the foot of the Throne itself. If you're going to matter, matter there. I'll keep a place on the boat for you. I keep a place for everyone. That's the trouble.\"",
      ]},
    ],
  },
  {
    id: "cael", name: "Brother Cael, the Last Watch", storytellerAct: 4, figure: "warden",
    topics: [
      { id: "land", label: "This land", pages: [
        "\"Keep your voice down. The Throne hears far, this close. You've reached the Last Vigil — the final warm stone before the seat of the Hollow Kings. There is no land past this. Only the descent, and the end of it.\"",
        "\"I am the last of the watch. The others went down the stair, one by one, to hold the line a little lower, and none came back up it. I stayed to ring the bell if the end came. I have my hand on the rope most nights.\"",
      ]},
      { id: "boss", label: "The ones below", pages: [
        "\"Three wait for you now, and they are the whole of the sickness. Aldric first — our own commander, in blackened plate. 'I remember the light. I chose this.' Grant him the mercy of a clean death.\"",
        "\"Then Malgrim, King of Dread, first of the brothers to give his name away. His fear comes off him like heat. And at the very bottom — Uldrath. The Unmaker. The last brother. The last thing.\"",
        "\"'I am what remains when all else is finished.' That's Uldrath. Kill the other two and the road opens to him, and past him there is nothing but the Abyss, which has no bottom and no boss and no mercy. Win here, or there is no here.\"",
      ]},
      { id: "dark", label: "The end of it", pages: [
        "\"You've walked the whole throat of it now — the grieving wood, the thirsting waste, the drowning green — and it all narrows to this stair. Everything the rot has eaten, it ate to reach this. To reach the making of the world, and unmake it.\"",
        "\"I have watched a hundred heroes take this stair. I rang no bell for any of them, because the end never came — only their ends. Maybe that is a kind of hope. Maybe the bell is meant to stay silent, one hero at a time, forever.\"",
        "\"Go down, then. Unmake the Unmaker. And if the world is still here in the morning — do not thank me. Thank the stair, and everyone already on it.\"",
      ]},
    ],
  },

  // ==================================================================
  // ---- two more townsfolk per act (talk-only, act-scoped) ----
  // Each land keeps its own faces, met only while you walk that act.
  // ==================================================================

  // ---- Act I: the Mournfield / Hollowmere ----
  {
    id: "senna", name: "Senna the Herb-Witch", storytellerAct: 1, figure: "witch",
    topics: [
      { id: "wood", label: "The wood", pages: [
        "\"You've been out under the boughs. Good. Then you've felt it — the wood watching, the way a sickroom watches the door. It wasn't always so. I gathered nightbell out there as a girl and the worst I met was a fox.\"",
        "\"Now I hang rowan on every lintel in Hollowmere and it does nothing, and I hang it anyway. That's what faith is, out here. Doing the nothing that's left to do.\"",
      ]},
      { id: "remedy", label: "A remedy", pages: [
        "\"You want something for the dreams. Everyone wants something for the dreams. I'll tell you what I tell them: the dreams aren't yours. They're the land's, and you're only sleeping in it.\"",
        "\"Boil marrowroot if you must sleep. But not too deep. The ones who sleep deep down here don't always trouble to come back up.\"",
      ]},
    ],
  },
  {
    id: "pip", name: "Pip, the Gravedigger's Boy", storytellerAct: 1, figure: "child",
    topics: [
      { id: "graves", label: "The graves", pages: [
        "\"I dig 'em. Somebody's got to and it's me, on account of I'm small and quick and don't ask much. Old Corliss taught me before he went in one himself. I dug his. Made it nice.\"",
        "\"Here's the thing nobody likes when I say it: I dig 'em twice now. Once to put 'em in. Once when they've climbed back out and I have to go and put 'em in again. The second hole is always deeper. You learn.\"",
      ]},
      { id: "quiet", label: "Being quiet", pages: [
        "\"You get good at being quiet, this work. Quiet enough the dead forget you're there. I could stand in your own shadow and you'd not know it.\"",
        "\"That's how I know things. I'm quiet, and I listen, and the grown folk talk over my head like I'm a fencepost. So I know Hargol was the sexton. I know what a sexton is. I know I'm the sexton now, really. Somebody's got to be.\"",
      ]},
    ],
  },

  // ---- Act II: the Sunscar Wastes / Zerath Oasis ----
  {
    id: "jenda", name: "Jenda, the Water-Warden", storytellerAct: 2, figure: "warden",
    topics: [
      { id: "ration", label: "The ration", pages: [
        "\"One cup, one soul, one sundown. That's the law of the last well, and I am the law, and I have turned away children with it. Don't look at me like that. A cup for a crying child today is two dead of thirst tomorrow. I have done that arithmetic more than any person should.\"",
        "\"You've coin and a strong arm, so you'll not go dry. But mark the ones who ration. We're not cruel. We're just the last ones still counting.\"",
      ]},
      { id: "wells", label: "The black wells", pages: [
        "\"There were forty wells in Zerath when I was small. Blue as promises, every one. They didn't dry, understand — drying is honest, drying is the sun. These went black. From the bottom. As if something below had a thirst of its own, and better arithmetic than mine.\"",
        "\"I keep the last one because it's still blue. Every morning I look down it first thing, before I let anyone drink. To be sure it's still blue. One morning it won't be. I try not to think about that morning.\"",
      ]},
    ],
  },
  {
    id: "ashk", name: "Brother Ashk, the Cinder-Priest", storytellerAct: 2, figure: "priest",
    topics: [
      { id: "sermon", label: "His sermon", pages: [
        "\"Come to be preached at? Sit, then, sinner, and let me tell you the good news, which is that there is none. The garden is dead. The Queen wears it. We are the compost of a kinder age. Rejoice — the pressure's off. Nothing you do now can make it worse.\"",
        "\"I used to keep a proper flame in a proper temple. Now I keep a handful of cinders in a clay cup and I call it holy, because holiness is just whatever warmth you refuse to let go out. Warm your hands. Go on. It's free, unlike Jenda's water.\"",
      ]},
      { id: "queen", label: "The Embalmed", pages: [
        "\"You'll go down to her. They all go down to her. Nyzat, who loved Zerath so much she would not let it die and so it cannot, and neither can she, and neither — this is the sermon's cruel middle — can any of the gardeners she wrapped to keep it company.\"",
        "\"When you cut her, and you'll try, remember she is not evil. She is grief that outlived its object and kept on loving anyway. That is the most dangerous thing in this world. More than dread. Ask the man in Act Four about dread. I'll take grief every time.\"",
      ]},
    ],
  },

  // ---- Act III: the Drowned Green / Mirefall Landing ----
  {
    id: "oona", name: "Marsh-Mother Oona", storytellerAct: 3, figure: "witch",
    topics: [
      { id: "trade", label: "Her trade", pages: [
        "\"Leeches, love. That's the trade. I bleed the fever out of the drowned-sick and I bleed the truth out of the ones too proud to weep. Same worm does both jobs. It's not fussy where the poison lives.\"",
        "\"You've a poison in you too — I can smell it from here, under the blood and the road-dust. The wanting kind. The go-deeper kind. I've no leech for that one. Nobody has. It's the only sickness in the world that thinks it's a virtue.\"",
      ]},
      { id: "river", label: "The river", pages: [
        "\"The green country didn't flood, whatever the ferryman tells you in his sad-boat voice. It was drunk. Swallowed. There's a difference and the difference is appetite. Water that rises can fall. This won't fall. This is full and still hungry.\"",
        "\"Ssarim's down in the Ziggurat being a god about it. 'The river only ever asks once.' Faugh. It asks constantly, dear. It's asking you right now — feel it, that little tug toward the deep water? That's the question. The trick is to keep not answering.\"",
      ]},
    ],
  },
  {
    id: "deel", name: "Deel, the Stilt-Walker", storytellerAct: 3, figure: "fisher",
    topics: [
      { id: "stilts", label: "The stilts", pages: [
        "\"Up here on the poles you learn to read the water by its skin. Where it's smooth, it's deep and it's thinking. Where it chops, there's something under, feeding. You want the chop. The smooth water is where the drowned come up to say hello.\"",
        "\"I've walked these floods eleven years. Longer than the floods have been floods, if you can credit it. I built the first stilts to reach the high fruit. Now I build them to stay above my neighbors. Everything you make to reach up, you end up using to keep from going under. There's a lesson there. I try not to learn it.\"",
      ]},
      { id: "family", label: "His family", pages: [
        "\"You'll want to mind your manners and not ask, so I'll say it plain and spare us both. I had four. The water has them now. It didn't take them — that's the part I can't make anyone understand — it kept them. They're down there. Kept nice. Waiting.\"",
        "\"I don't come down off the stilts. Not for anything. Because on a smooth-water night I've seen the little one's face turn up under the surface, patient as the rest, and it smiled to see me, and I very nearly stepped down. So. Up here I stay. Buy a fish. Don't look at the water.\"",
      ]},
    ],
  },

  // ---- Act IV: the Hollow Throne / The Last Vigil ----
  {
    id: "adelheid", name: "Sister Adelheid, the Bell-Keeper", storytellerAct: 4, figure: "keeper",
    topics: [
      { id: "bell", label: "The bell", pages: [
        "\"You've seen Cael with his hand on the rope? He rings for the end. I keep the bell that end is rung on. We are a two-person religion, he and I, and our only sacrament is a sound we pray never to make.\"",
        "\"I oil the yoke. I file the crack that's been spreading in the bronze for a year — from the cold coming up, not from ringing; it's never been rung. Some nights I think the crack is the point. That the world ends not with the bell but with the bell finally too broken to ring. That we'll all just look up at the silence and understand.\"",
      ]},
      { id: "watch", label: "The Vigil", pages: [
        "\"Everyone here is the last of something. Cael, the last watch. Me, the last bell. Iseult sells the last knights out of a warm stall. Even young Tomas is the last of a thing that isn't finished dying yet, which is the worst last to be.\"",
        "\"We are a whole town of endings, wintering at the foot of the stair. And then you arrive, dripping the road behind you, wanting to buy a belt. A beginning. It's obscene. It's the only hope any of us has left. Don't waste it on the belt.\"",
      ]},
    ],
  },
  {
    id: "tomas", name: "Tomas, Aldric's Squire", storytellerAct: 4, figure: "squire",
    topics: [
      { id: "master", label: "His master", pages: [
        "\"I keep his armor bright. His second set — the light plate, the ceremonial. He wore the black plate down the stair to win us terms and I've kept the bright plate ready for his return every day since, because a squire keeps his master's armor ready. That is the whole of the job. That is the whole of me.\"",
        "\"They tell me what he is now. Aldric the Forsworn. 'I chose this.' I hear the words. I polish the greaves. Both things are true at once and I live in the space between them, and I have got quite good at living there. You can get good at anything, it turns out. Even this.\"",
      ]},
      { id: "stair", label: "The stair", pages: [
        "\"You're going down. To him, eventually, among the others. I won't ask you to spare him — I'm not a fool, whatever I look like, kneeling here with a rag and a good man's shin-guard.\"",
        "\"I'll ask you one thing. When it's done — when you've given him the clean death everybody keeps promising him — bring me back the black plate. Not the man. I know better than to ask for the man. Just the plate. I'll polish it. I'll set it beside the bright set. And the pair of them can stand the last watch together, the way he always meant to.\"",
      ]},
    ],
  },

  // ==================================================================
  // ---- the indoor folk: a barkeep per tavern, a resident per hut ----
  //   (talk-only, one pair per act — the warm rooms you can walk into)
  // ==================================================================
  {
    id: "brannoch", name: "Brannoch, of the Crooked Lantern", figure: "barkeep",
    topics: [
      { id: "house", label: "The Lantern", pages: [
        "\"Sit anywhere the floor's dry. That's most of it, tonight. Ale's watered but honest — same as the rest of Hollowmere.\"",
        "\"My grandfather hung that lantern crooked on purpose. Said a light that hangs true, folk walk past. A light that hangs wrong, they stop, and wonder, and come in out of the dark. Forty years I've kept it lit. Longest anyone's managed.\"",
      ]},
      { id: "trade", label: "The talk tonight", pages: [
        "\"You want the talk? Sit at my bar long enough, you hear all of it. Wardens drinking themselves brave before the cathedral road. Peddlers who won't say what they're fleeing.\"",
        "\"And lately — folk who order one ale, drink half, and stare at the door like they're expecting it to open on its own. It hasn't. Not yet. I keep the bar between me and it, all the same. A bar's a good thing to keep between you and a door.\"",
      ]},
    ],
  },
  {
    id: "sedira", name: "Sedira, the Oasis Pourer", figure: "barkeep",
    topics: [
      { id: "house", label: "This tavern", pages: [
        "\"Water's dearer than wine here, so I pour wine. Cheaper to drown a thirst than to slake it in Zerath these days.\"",
        "\"This was the last building in the square to keep its roof when the sand came. People come here to sit under something. Doesn't matter what I'm pouring. They came in for the ceiling.\"",
      ]},
      { id: "trade", label: "The talk tonight", pages: [
        "\"You hear a lot, pouring. The diggers say the necropolis has more doors than it did last month. Doors nobody cut. The Queen's making room.\"",
        "\"I don't repeat it past the bar. Bad for custom, and worse for sleeping. Have your wine. Watch the door if it makes you feel better — everyone does, first night in Zerath. You stop, after a while. That's not the comfort it sounds like.\"",
      ]},
    ],
  },
  {
    id: "gullimon", name: "Gullimon, Keeper of the Stilt-House", figure: "barkeep",
    topics: [
      { id: "house", label: "The stilt-house", pages: [
        "\"Mind the third plank, it's rotted through — no, the OTHER third plank. Whole Landing's held up on stilts and stubbornness. I keep the bar dry. Mostly.\"",
        "\"Water's come up two hands since spring. I've moved the good barrels to the loft twice. When it comes up past the taps, I'll pour from the loft. When it comes up past the loft — well. I'll pour somewhere. A man keeps pouring. It's what I'm for.\"",
      ]},
      { id: "trade", label: "The talk tonight", pages: [
        "\"Vaol the ferryman drinks here, when he's not poling the dead. He says the water's warmer down deep than it ought to be. Says something's breathing in it.\"",
        "\"I told him to stop drinking and stop saying that, in that order. He did neither. Now I hear it too, some nights, under the floor — a long slow tide-breath that isn't the tide. So I pour myself one, and I don't say it past the bar. You'd do the same.\"",
      ]},
    ],
  },
  {
    id: "old_hesk", name: "Old Hesk, the Last Pour", figure: "barkeep",
    topics: [
      { id: "house", label: "The last tavern", pages: [
        "\"Last tavern with a lit hearth this side of the Throne. When mine goes cold, that's the whole world gone cold behind you. So I don't let it go cold. Simple duty. I'm good at simple.\"",
        "\"Ash gets in the ale. I strain it. Ash gets in the ale again. I strain it again. That's the Vigil, friend — you strain the ash out, and you strain it out, and you do not stop straining, because the day you stop is the day you agree.\"",
      ]},
      { id: "trade", label: "The talk tonight", pages: [
        "\"Knights come in off the wall grey as the ash and they don't talk. I pour, they drink, they go back up. That's our whole conversation and it's the best one I have.\"",
        "\"You're going down past the wall, to the Throne itself. I'll have a cup poured when you come back. I'll keep it poured. I keep a lot of cups poured for folk who went down that stair. They line the shelf. I dust them. One of them's going to be drunk one day, and I'd be honored if it were yours.\"",
      ]},
    ],
  },
  {
    id: "mabel", name: "Old Mabel", figure: "homesteader",
    topics: [
      { id: "home", label: "Her home", pages: [
        "\"Come in, come in, mind the cat — no cat anymore, force of habit. Sit by the fire. It's a small fire in a small house and it's mine and it's warm, which is three things more than most folk have east of here.\"",
        "\"Senna next door frets over the whole town. I keep the one hearth. You keep the fire, the fire keeps the dark off the walls, the walls keep the roof up. That's the whole of housekeeping and the whole of soldiering too, if you think on it. Which I do. I've a lot of evenings.\"",
      ]},
      { id: "worry", label: "What troubles her", pages: [
        "\"My boy went east with a Warden's bow three winters back. I keep his chair. I keep the fire high enough he'd see it from the road, if he came up the road. He'd see it a long way, a fire like that.\"",
        "\"You're going where he went. If you pass a tall lad, quiet, left-handed on the string — no. Don't answer that. Don't tell me. Some hopes you keep by not letting anyone put them down. Warm yourself. Go on. Leave an old woman her fire and her fool's chair.\"",
      ]},
    ],
  },
  {
    id: "amara", name: "Amara, the Well-Widow", figure: "homesteader",
    topics: [
      { id: "home", label: "Her home", pages: [
        "\"Mud brick keeps the heat out by day and the cold out by night. My husband laid every brick. Then he went to sound the deep well, to see why it ran black, and the well kept him. So now the walls keep me. Fair's fair, I suppose. Bricks for a bricklayer.\"",
        "\"Sit. There's shade and there's date-wine and there's an hour before the sand starts moving again. In Zerath that's a feast. Don't waste it being somewhere else in your head.\"",
      ]},
      { id: "worry", label: "What troubles her", pages: [
        "\"I hear him, some nights. Down the dry well. Calling up, friendly as market-day, in his own dear voice. 'Amara. Amara. Come see what I found.'\"",
        "\"I filled the well with sand to the brim. He calls up through the sand now, patient as ever. That's the thing nobody warns you — it doesn't stop wearing their face just because you stop listening. But you stop listening. You must. Sit with me till it's light, and don't look at the well.\"",
      ]},
    ],
  },
  {
    id: "wickem", name: "Wickem, the Reed-Cutter", figure: "homesteader",
    topics: [
      { id: "home", label: "His home", pages: [
        "\"Built her myself, out of reed and pitch and spite, up on the good stilts. She sways in the flood and she doesn't fall. That's more than the church managed, and the church had God and stone. I had reeds and a bad temper.\"",
        "\"Sit where it's dry. Everything here is a little wet and a little green and a little alive that shouldn't be. You get used to the smell. That's the frightening part, when you think on it — that you get used to it. So I try not to think on it. Reed-cutting helps. Keeps the hands busy and the head empty.\"",
      ]},
      { id: "worry", label: "What troubles him", pages: [
        "\"The reeds grow where the dead go under. Best cutting's over the drowned graves — tall, green, singing when the wind's up. I cut there because the reeds are best there. I tell myself that's why.\"",
        "\"Last week I cut a stand and it bled. Not sap. I've stopped cutting the tall ones. I've stopped going out past the third channel. Soon I'll have stopped going out at all, and then I'll just be a man in a reed house not going out, listening to it grow. Have you noticed how much of surviving is just — stopping? Stopping doing this, stopping going there. One day you've stopped everything. They call that safe.\"",
      ]},
    ],
  },
  {
    id: "greta", name: "Greta, Who Would Not Leave", figure: "homesteader",
    topics: [
      { id: "home", label: "Her home", pages: [
        "\"Everyone with sense went west a year ago. I stayed. This is my house. My mother's house, her mother's. You don't hand a house to the dark because the dark asked politely with an army.\"",
        "\"So I sweep the ash off the step every morning and every morning there's more, and I sweep it anyway, because the morning I don't sweep is the morning the Throne wins a thing it can't take by force — my saying that today is like any other day, and worth keeping tidy. Sit. The kettle's on. It's always on. Small defiance. It's the size I can manage.\"",
      ]},
      { id: "worry", label: "What troubles her", pages: [
        "\"I'm not afraid of dying, understand. I'm old and I've buried better. I'm afraid of the other thing. The kneeling. They don't kill this town — they invite it. Every night, a little louder: lay down the broom, come below, be at peace.\"",
        "\"Peace. As if I don't know the word for what they're selling. You go down there and you tell the crowned thing at the bottom that there was one house in the Last Vigil that kept its kettle on and its step swept and never once considered the offer. Tell him Greta says the answer is no, and it was always going to be no, and he wasted a very grand voice on a woman with a broom.\"",
      ]},
    ],
  },
];

const TOWN_NPC_BY_ID = new Map(TOWN_NPCS.map((n) => [n.id, n]));
export function townNpcById(id: string): TownNpc | undefined {
  return TOWN_NPC_BY_ID.get(id);
}

// ---- dungeon narrative encounters: vignette / ambush / boon ----
export type EncounterKind = "vignette" | "ambush" | "boon";
export interface EncounterBoon {
  effect: "dmg" | "speed" | "mf" | "heal" | "vuln" | "slow"; // heal is instant; the rest last `ms`
  ms?: number;
  cursed?: boolean; // for the flavor/telemetry — vuln/slow are curses
  note: string; // floated when it lands
}
export interface Encounter {
  id: string;
  kind: EncounterKind;
  act: number; // 1..4; 0 = any land
  label: string; // the shrine's world-label
  pages: string[]; // the dialogue window
  ambushKind?: string; // MonsterKind; server falls back to the floor's own roll if unknown
  ambushCount?: number;
  boon?: EncounterBoon;
}

export const ENCOUNTER_CHANCE = 0.55; // a story waits on most floors
export const ENCOUNTER_XP_BASE = 8; // × danger, for surviving a vignette (like a tome)

export const ENCOUNTERS: Encounter[] = [
  // ---------- Act I — the Mournfield ----------
  { id: "warden_dying", kind: "vignette", act: 1, label: "A fallen Warden", pages: [
    "A woman in Warden leather is folded against the roots, an arrow — one of her own kind — through her side.",
    "\"You're not... one of them. Good. Listen. Corvessa took the others down the nave. They went singing.\"",
    "\"Don't let her sing at you. Whatever you do. Cover your—\" She stops covering anything. The wood is quiet again.",
  ]},
  { id: "confession_stone", kind: "vignette", act: 1, label: "A carved confession", pages: [
    "Someone has cut small, patient letters into the trunk of a dead oak, hundreds of them, a monk's whole guilt in bark.",
    "\"I SEALED THE CRYPT DOOR AS I WAS TOLD. I HEARD THEM ASKING TO BE LET OUT. I TOLD MYSELF THEY WERE ALREADY DEAD.\"",
    "\"THEY WERE NOT ALREADY DEAD. THEY ARE NOT DEAD NOW. FORGIVE THE SEXTON. — BR. MALC\"",
  ]},
  { id: "childs_shoe", kind: "vignette", act: 1, label: "A small shoe", pages: [
    "A child's shoe sits in the middle of the trail, upright, laced, waiting to be stepped back into.",
    "There is no child. There is no second shoe. There is only the very careful way it has been placed, facing home.",
  ]},
  { id: "possessed_survivor", kind: "ambush", act: 1, label: "A survivor, waving", ambushKind: "imp", ambushCount: 4, pages: [
    "A man stumbles from the treeline, both arms up, weeping with relief. \"Thank the light — thank the light, I thought I was the last, I—\"",
    "His jaw keeps opening. Past where a jaw should stop. Something small and pale is already climbing out of the man who is no longer using him.",
  ]},
  { id: "warm_hand", kind: "boon", act: 1, label: "A pale figure", boon: { effect: "speed", ms: 30000, note: "the cold lends you its quickness (+haste)" }, pages: [
    "A figure the color of pond-ice stands very still between two trees, one hand held out, palm up, patient.",
    "\"Warmth,\" it says, without a mouth moving. \"For a memory. You have so many. You'll hardly miss the one I take.\"",
    "You take the hand before you decide to. It is done before you feel the cold. You are faster now. You cannot recall why you came this way.",
  ]},

  // ---------- Act II — the Sunscar Wastes ----------
  { id: "buried_caravan", kind: "vignette", act: 2, label: "A buried wagon", pages: [
    "A merchant wagon stands nose-down in the dune, swallowed to the axles, its cargo still roped and neat under a skin of sand.",
    "The driver is roped in too, still upright, still holding the reins, patient as everything is patient out here. He has been waiting a thousand years for the sand to let go of the wheels.",
  ]},
  { id: "dry_well", kind: "vignette", act: 2, label: "A black well", pages: [
    "A wellhead juts from the sand, its stones green-stained from a time when there was anything to stain them.",
    "You look down. The dark looks back, unhurried. Very far below, something shifts, and the shifting sounds like a word, and the word sounds like your name mispronounced by something learning it.",
  ]},
  { id: "embalmers_note", kind: "vignette", act: 2, label: "An embalmer's slab", pages: [
    "A stone slab, gutters cut for fluids long dry, and a work-order pinned under a jar of blue salt.",
    "\"THE QUEEN'S INSTRUCTION: WE DO NOT BURY ZERATH. WE PRESERVE IT. THE GARDENS ARE TO BE WRAPPED, NOT MOURNED.\"",
    "\"WHOEVER READS THIS: SHE MEANS TO WEAR IT ALL. EVERY GREEN THING. INCLUDING, I NOW UNDERSTAND, US.\"",
  ]},
  { id: "false_pilgrim", kind: "ambush", act: 2, label: "A robed pilgrim", ambushKind: "entombed", ambushCount: 4, pages: [
    "A robed pilgrim kneels at a shrine of piled stones, rocking, murmuring thanks that you've come, that the Queen sent you, that it is time.",
    "The robe is wrapped a great many times. When it turns to greet you, it keeps turning — nothing under the wrappings has a front — and the piled stones stand up to help.",
  ]},
  { id: "salt_offering", kind: "boon", act: 2, label: "A dish of blue salt", boon: { effect: "mf", ms: 45000, note: "the old fortune of Zerath favors you (+magic find)" }, pages: [
    "A brass dish of blue embalmer's salt rests on a cairn, the last offering of a people who believed offerings still bought anything.",
    "You press a pinch to your tongue out of some instinct older than sense. It tastes of gardens. For a little while the wastes decide to be generous with you. It has been a long time since they were generous with anyone.",
  ]},

  // ---------- Act III — the Drowned Green ----------
  { id: "hanged_boats", kind: "vignette", act: 3, label: "Boats in the trees", pages: [
    "Fishing boats hang in the canopy overhead, lifted there by a flood that came and did not go, and stayed instead, and is staying.",
    "One still has its lantern lit, green flame under green water-light. Nobody lit it. Nobody has climbed up to it. It simply has not agreed to go out.",
  ]},
  { id: "ferry_toll", kind: "vignette", act: 3, label: "A drowned ferry", pages: [
    "A flat-bottomed ferry lies half-sunk in the shallows, its toll-box nailed to the rail, still expecting custom.",
    "The passengers are still aboard, seated, orderly, waiting for a shore the ferry will never reach. One has a coin already held out for the box. You could take it. You do not take it.",
  ]},
  { id: "riverfang_bait", kind: "ambush", act: 3, label: "A crying child", ambushKind: "riverfang", ambushCount: 3, pages: [
    "A child stands waist-deep in the black water, back to you, shoulders hitching with sobs, hair drifting on the current.",
    "You call out. The sobbing stops. The child does not turn — the water turns it — and its face is all the river's teeth, and the sobbing was only ever the bait moving.",
  ]},
  { id: "green_bargain", kind: "boon", act: 3, label: "A drowned suitor", boon: { effect: "vuln", ms: 25000, cursed: true, note: "the river marks you — you take more harm (25s)" }, pages: [
    "A drowned man rises to standing in the shallows, courteous, dripping, offering you a ring of woven reed as though at a wedding.",
    "\"The river only ever asks once,\" he says, and slips the reed over your wrist before you can decline the honor.",
    "It tightens. It will not come off. For a while the water knows exactly where you are, and so does everything in it.",
  ]},

  // ---------- Act IV — the Hollow Throne ----------
  { id: "vigil_bell", kind: "vignette", act: 4, label: "A watch-bell", pages: [
    "A great bronze alarm-bell hangs from a broken arch, its rope frayed to a thread, its lip green with the breath of the deep.",
    "A tag is wired to the rope in a soldier's hand: \"RING ONLY WHEN THE END COMES. — THE WATCH.\" Below it, smaller: \"IT HAS NOT COME. IT HAS NOT COME. IT HAS NOT—\" and then the writing stops.",
  ]},
  { id: "forsworn_plate", kind: "vignette", act: 4, label: "Empty black plate", pages: [
    "A suit of blackened knight's plate stands upright and empty in a shaft of grey light, arranged as if to be put on.",
    "It is Vigil-work — you can read the maker's mark under the corruption. Someone stood here and undressed out of the light and dressed into the dark on purpose, piece by piece, and walked down. 'I chose this,' the arrangement says. It is very neat about it.",
  ]},
  { id: "kings_herald", kind: "ambush", act: 4, label: "A kneeling knight", ambushKind: "doomguard", ambushCount: 4, pages: [
    "A knight in Vigil colors kneels facing the descent, head bowed, sword planted, the very picture of a man keeping faith at his post.",
    "\"You came,\" he says, not lifting his head. \"He said a hero would. He said to make you welcome.\" When he stands, the colors are only paint, and what wore them was never keeping faith with you.",
  ]},
  { id: "unmakers_gift", kind: "boon", act: 4, label: "A crown of ash", boon: { effect: "dmg", ms: 30000, note: "dread sharpens your arm (+damage)" }, pages: [
    "A small crown of grey ash sits on a stone at the head of the stair, holding its shape though nothing holds it.",
    "A voice with no source, very patient, very tired: \"Take it up. Strike harder. Finish what you came to finish. I am, after all, what remains when all else is finished — and I do so want to see you hurry.\"",
    "You feel your grip tighten past your own strength. The stair is suddenly very inviting. That, more than anything, is what should frighten you.",
  ]},

  // ---------- any land ----------
  { id: "old_campfire", kind: "vignette", act: 0, label: "A cold campfire", pages: [
    "The ashes of another hero's fire, gone grey and rained-in. A bedroll. A whetstone. A journal, its last page still legible.",
    "\"Day I forget. Deeper than I meant. It gets easier to go down and harder to want up. I'll turn back tomorrow.\" There is no next entry. There is no tomorrow written anywhere in the book.",
  ]},
  { id: "wandering_boon", kind: "boon", act: 0, label: "A flicker of warmth", boon: { effect: "heal", note: "a stranger's mercy closes your wounds" }, pages: [
    "A lantern hangs on nothing at all, burning steady, throwing a small ring of ordinary golden light — the first honest light in a long descent.",
    "Nobody tends it. Nobody claims it. You stand in the warm ring a moment, and your hurts feel suddenly smaller, and then the lantern is simply gone, having done its one kind thing.",
  ]},
];

const ENCOUNTER_BY_ID = new Map(ENCOUNTERS.map((e) => [e.id, e]));
export function encounterById(id: string): Encounter | undefined {
  return ENCOUNTER_BY_ID.get(id);
}

// pick a story for this floor: mostly vignettes, some ambushes, rare bargains
export function rollEncounter(act: number, rng: () => number): Encounter | null {
  const r = rng();
  const kind: EncounterKind = r < 0.7 ? "vignette" : r < 0.9 ? "ambush" : "boon";
  const pool = ENCOUNTERS.filter((e) => e.kind === kind && (e.act === act || e.act === 0));
  const fallback = ENCOUNTERS.filter((e) => e.kind === "vignette" && (e.act === act || e.act === 0));
  const from = pool.length ? pool : fallback;
  if (!from.length) return null;
  return from[Math.floor(rng() * from.length)];
}

// --- The Codex: the world remembers what you have seen, slain, and carried ---
//
// Three books, kept in the Reliquary in every town and shared across all a
// player's heroes (account-wide, like the shared stash):
//   • the Bestiary   — every kind you kill records an entry; a kill-count
//                       milestone unlocks a deeper insight into the thing.
//   • the Chronicle  — lore fragments recovered in the dark, grouped into
//                       chapters; completing a chapter is a permanent boon.
//   • the Reliquary  — the in-world story of each signature relic you find.

export interface BestiaryEntry {
  kind: string; // matches Monster.kind (a MonsterKind or a boss kind)
  name: string; // display name
  lore: string; // unlocked on the first kill
  insightAt: number; // kills needed to unlock the insight
  insight: string; // the deeper truth — read once the count is met
}

export interface LoreFragment {
  id: string;
  chapter: string; // the CodexChapter.id it belongs to
  title: string;
  text: string;
  bossKind?: string; // Stage 1 source: felling this boss recovers the fragment
  // (Stage 2 will add set-piece sources; a fragment with no source simply waits)
}

export interface CodexChapter {
  id: string;
  name: string;
  blurb: string;
  reward: { stats: ItemStats; desc: string }; // account-wide, granted while complete
}

export interface RelicLore {
  name: string; // matches a unique/set Item.name exactly
  lore: string;
}

// the account-wide save shape (mirrored in the server's Account.codex)
export interface CodexState {
  bestiary?: Record<string, number>; // kind → total kills
  fragments?: string[]; // recovered fragment ids
  relics?: string[]; // discovered relic (item) names
}

// ---- the Bestiary: one entry per living (and unliving) kind ----
export const BESTIARY: BestiaryEntry[] = [
  // Act I — the Mournfield
  { kind: "imp", name: "Imp", lore: "Small, pale, and quick — they travel in shrieking packs and lose their nerve the instant a packmate falls.", insightAt: 25, insight: "Kill one and the rest may scatter: break their morale and the swarm breaks with it." },
  { kind: "spineback", name: "Spineback", lore: "A hunched thing bristling with barbed quills, which it spits from range and then skitters away to spit again.", insightAt: 20, insight: "It kites by design — close the gap or corner it; standing at mid-range is exactly what it wants." },
  { kind: "zombie", name: "The Shambling Dead", lore: "Hollowmere's own, dug up and set walking. Slow, patient, and endless.", insightAt: 30, insight: "Their camps refill if left alone — clear a nest fully or don't bother." },
  { kind: "skeleton", name: "Risen Bones", lore: "Marrow-dry soldiers of a war nobody living remembers, drilled into ranks by something below.", insightAt: 30, insight: "Something down here still gives them orders. The Chronicle asks who." },
  { kind: "archer", name: "Bonebow Archer", lore: "Skeletal marksmen that hang at the back of a pack and punish anyone who charges the front.", insightAt: 20, insight: "Deal with the archers first; the melee is only bait to hold you in their line of fire." },
  { kind: "cultist", name: "Hollow Cultist", lore: "Robed devotees who chose the dark on purpose, and are proud of the choosing.", insightAt: 20, insight: "They died believing the brothers would remember them. The brothers did not." },
  { kind: "goatman", name: "Goatman Reaver", lore: "Horned brutes of the deep wood, all muscle and bad temper, that hit far harder than their size warns.", insightAt: 15, insight: "A single reaver can spike your health bar in two blows — never facetank a pack of them." },
  { kind: "goblin", name: "Treasure Goblin", lore: "It does not fight. It flees, sack clutched to its chest, and vanishes through a rip in the air if you dawdle.", insightAt: 3, insight: "Nine seconds and it portals out. Commit to the chase the instant you see it — hesitation is a lost hoard." },

  // Act I — the Cathedral floors
  { kind: "wraith", name: "Cathedral Wraith", lore: "A smear of cold grief that drifts the nave, harmless-looking until it is upon you.", insightAt: 20, insight: "They ignore walls and terrain. Line of sight is no safety." },
  { kind: "gargoyle", name: "Roost Gargoyle", lore: "Stone until you are close, then not stone at all.", insightAt: 15, insight: "They wake in groups. Waking one usually means waking the whole ledge." },

  // Act I / Hell — demons
  { kind: "demon", name: "Lesser Demon", lore: "Squat, red, and full of fire — the rank and file of everything worse below.", insightAt: 20, insight: "Their blows carry fire; fire resistance blunts them far more than armor does." },
  { kind: "succubus", name: "Succubus", lore: "Beautiful at a distance, and the distance is the trap — she calls fire down from across the room.", insightAt: 15, insight: "A ranged burner. Break line of sight or close fast; trading shots is a losing trade." },
  { kind: "hellion", name: "Hellion", lore: "A four-legged furnace that closes distance in a heartbeat and burns what it catches.", insightAt: 15, insight: "It's faster than you. Save a movement skill or a slow for the moment it commits." },

  // Act II — the Sunscar Wastes
  { kind: "scarab", name: "Tomb Scarab", lore: "Fist-sized, iridescent, and never alone — they boil up out of the sand in numbers.", insightAt: 30, insight: "Individually nothing; in a swarm, a wall of chip damage. Area attacks earn their keep here." },
  { kind: "sandserpent", name: "Sand Serpent", lore: "It swims the dunes and surfaces beneath your feet, all jaw and no warning.", insightAt: 20, insight: "It surfaces where you stand. Keep moving and its lunge finds empty sand." },
  { kind: "entombed", name: "The Entombed", lore: "Zerath's wrapped dead, preserved rather than buried, walking because the Queen was thorough.", insightAt: 25, insight: "\"She means to wear it all. Every green thing. Including us.\" — an embalmer's last note." },
  { kind: "duneprowler", name: "Dune Prowler", lore: "A lean desert hunter that circles the edge of your vision and rushes the moment you turn your back.", insightAt: 20, insight: "It waits for you to commit elsewhere. Don't give it your back in an open room." },
  { kind: "carrionbird", name: "Carrion Bird", lore: "They wheel over the wastes wherever something is dying, and are not above hastening it.", insightAt: 20, insight: "Fast and evasive — a good test of whether your ranged option can actually connect." },

  // Act III — the Drowned Green
  { kind: "mudling", name: "Mudling", lore: "A gob of animate silt that pulls itself out of the bog and reaches for the warm.", insightAt: 30, insight: "They come from the water endlessly. The ground itself is the spawner." },
  { kind: "blowreed", name: "Blowreed Stalker", lore: "It hides among the reeds and blows a dart of bog-toxin before you ever see it.", insightAt: 20, insight: "First hit often comes from cover. Poison ticks after — clear the reeds, don't wade blind." },
  { kind: "riverfang", name: "Riverfang", lore: "The river's teeth. It sobs like a lost child to draw you to the water's edge.", insightAt: 15, insight: "The crying is bait. Anything weeping in the black water is already the trap." },
  { kind: "vinehorror", name: "Vine Horror", lore: "The drowned green given a will — a knot of thorned vine that lashes and grabs.", insightAt: 15, insight: "It roots and reaches; its range is longer than it looks. Respect the lash." },
  { kind: "bogwitch", name: "Bogwitch", lore: "A hag of the Mirefall shallows who curses from afar and cackles while you rot.", insightAt: 15, insight: "A caster — her hexes outrange her cackle. Silence her first or eat the curse." },

  // Act IV — the Hollow Throne
  { kind: "ashfiend", name: "Ashfiend", lore: "Born of the ashfall over the Last Vigil, it leaves cinders where it steps.", insightAt: 20, insight: "The ground it walks stays hot. Fire resistance is not optional this deep." },
  { kind: "doomguard", name: "Doomguard", lore: "Armored dead of Uldrath's last garrison, still standing the watch they died standing.", insightAt: 15, insight: "Heavy armor, heavy blows. A slow, patient fight — or a swift death if you rush it." },
  { kind: "flamecaller", name: "Flamecaller", lore: "A robed adept who trades its own burning for the privilege of burning you.", insightAt: 15, insight: "It calls fire from range and never closes. Hunt it down; it will not come to you." },
  { kind: "flayed", name: "The Flayed", lore: "What Malgrim's mercy looks like — the skinned faithful, kept alive past all reason.", insightAt: 15, insight: "\"I remember the light. I chose this.\" They did not all get a choice." },
  { kind: "bovine", name: "Hell Bovine", lore: "It should not be here. It is here. It is furious, and it is not alone.", insightAt: 10, insight: "There is no meadow. There has never been a meadow. Moo." },

  // Bosses
  { kind: "flenser", name: BOSS_NAMES.flenser, lore: "Butcher of the cathedral steps, who kept his hooks and lost everything else.", insightAt: 3, insight: "\"Meat for the hooks!\" — fast, brutal, and never subtle. Bring life on hit or bring a fast exit." },
  { kind: "corvessa", name: BOSS_NAMES.corvessa, lore: "The Carrion Bride, pale and singing, who took the Wardens down the nave one by one.", insightAt: 3, insight: "She kites and her arrows chill. Corner her — a bride who can keep her distance never stops singing." },
  { kind: "maggotqueen", name: BOSS_NAMES.maggotqueen, lore: "Mother of the brood, vast and patient, birthing the writhing dark of the deep caves.", insightAt: 3, insight: "Kill the broodlings or drown in them. The Queen is the least of your problems while they live." },
  { kind: "vessira", name: BOSS_NAMES.vessira, lore: "The Thorned Maiden, who plants a wound in everything she meets and waits for it to bloom.", insightAt: 3, insight: "\"Every wound you carry, I planted.\" Her venom nova rewards standing still — so don't." },
  { kind: "vuruk", name: BOSS_NAMES.vuruk, lore: "The White Maw, a charging cold that carries the winter in every blow.", insightAt: 3, insight: "His hits chill and his charge closes range instantly. Cold resistance turns a death into a fight." },
  { kind: "orvath", name: BOSS_NAMES.orvath, lore: "The Grudge Eternal, who keeps his distance and lets his spite do the walking.", insightAt: 3, insight: "\"Spite outlives the spine.\" He orbits and hurls lightning — chase him down or be chipped to nothing." },
  { kind: "nyzat", name: BOSS_NAMES.nyzat, lore: "The Embalmed Queen of Zerath, who wore the sand a thousand years and means to wear the rest.", insightAt: 3, insight: "Ruler beneath the Necropolis. Everything wrapped in the wastes rose at her word." },
  { kind: "ssarim", name: BOSS_NAMES.ssarim, lore: "The Drowned God at the heart of the Ziggurat, to whom the river only ever asks once.", insightAt: 3, insight: "Act III's ruler. The flood that came and stayed came for him." },
  { kind: "malgrim", name: BOSS_NAMES.malgrim, lore: "The King of Dread, first of the three brother-kings, who trades in fear the way misers trade in gold.", insightAt: 3, insight: "His dread-fire nova telegraphs — a ring, a breath, then ruin. Leave the ring." },
  { kind: "aldric", name: BOSS_NAMES.aldric, lore: "The Forsworn, the knight who saw the light clearly and turned from it anyway.", insightAt: 3, insight: "\"I remember the light. I chose this.\" A guilt that fights like a saint gone wrong." },
  { kind: "uldrath", name: BOSS_NAMES.uldrath, lore: "The Unmaker, last of the Hollow Kings, waiting at the bottom of everything.", insightAt: 3, insight: "\"I am what remains when all else is finished.\" Fell him and the caravan road opens — and the Abyss beneath it." },
  { kind: "bovax", name: BOSS_NAMES.bovax, lore: "Tyrant of a meadow that does not exist, king of a herd that should not be.", insightAt: 1, insight: "MOO." },
];

const BESTIARY_BY_KIND = new Map(BESTIARY.map((b) => [b.kind, b]));
export function bestiaryEntry(kind: string): BestiaryEntry | undefined {
  return BESTIARY_BY_KIND.get(kind);
}

// ---- the Chronicle: fragments grouped into chapters, each a permanent boon ----
export const CODEX_CHAPTERS: CodexChapter[] = [
  { id: "ch_mournfield", name: "Grief of the Mournfield", blurb: "How Act I fell: the butcher, the bride, and the maiden who plants wounds.", reward: { stats: { dmgPct: 3 }, desc: "+3% damage" } },
  { id: "ch_deepcourts", name: "The Drowned Courts", blurb: "The rulers of the wastes and the green, and the brood between them.", reward: { stats: { allRes: 2 }, desc: "+2 all resistance" } },
  { id: "ch_hollowkings", name: "The Hollow Kings", blurb: "Three brothers who traded their names to the dark and unmade the world from underneath.", reward: { stats: { maxHp: 15 }, desc: "+15 life" } },
  { id: "ch_meadow", name: "The Hidden Meadow", blurb: "There is no meadow.", reward: { stats: { goldFind: 5 }, desc: "+5% gold find" } },
  // Stage 2 — chapters filled by environmental set-pieces found in the floors, not by bosses
  { id: "ch_ternion", name: "The Ternion Order", blurb: "The vanished alchemist-scholars who worked transmutation in threes — pieced together from what they left in the dark.", reward: { stats: { magicFind: 5 }, desc: "+5% magic find" } },
  { id: "ch_folk", name: "The Fallen Folk", blurb: "Not kings, not monsters — the ordinary dead of each land, and the small things they left behind.", reward: { stats: { maxHp: 10 }, desc: "+10 life" } },
  // the capstone — sealed until the Unmaker is unmade
  { id: "ch_ending", name: "The Unmaking Undone", blurb: "What was written when the last of the Hollow Kings fell at the bottom of his own hall.", reward: { stats: { dmgPct: 3, allRes: 2 }, desc: "+3% damage, +2 all resistance" } },
];

export const LORE_FRAGMENTS: LoreFragment[] = [
  // ch_mournfield
  { id: "frag_flenser", chapter: "ch_mournfield", bossKind: "flenser", title: "The Butcher's Ledger", text: "Hargol kept a tally on the cathedral wall, one cut per name. He ran out of wall long before he ran out of names." },
  { id: "frag_corvessa", chapter: "ch_mournfield", bossKind: "corvessa", title: "The Bride's Song", text: "The Wardens who went down the nave went singing, because she asked them to, and they could not remember how to refuse." },
  { id: "frag_vessira", chapter: "ch_mournfield", bossKind: "vessira", title: "The Maiden's Garden", text: "Every wound she opens is a seed. Given time and a warm host, it flowers. She is very patient about the flowering." },
  // ch_deepcourts
  { id: "frag_vuruk", chapter: "ch_deepcourts", bossKind: "vuruk", title: "The White Maw", text: "The cold that fills the Sunken Necropolis is not weather. It is Vuruk, breathing, somewhere below the sand." },
  { id: "frag_nyzat", chapter: "ch_deepcourts", bossKind: "nyzat", title: "The Embalmer's Queen", text: "\"We do not bury Zerath. We preserve it. The gardens are to be wrapped, not mourned.\" She meant to wear it all." },
  { id: "frag_orvath", chapter: "ch_deepcourts", bossKind: "orvath", title: "The Grudge Eternal", text: "Ask Orvath what he wants and he will not answer. He wanted something once. Now he only wants you to stop." },
  { id: "frag_ssarim", chapter: "ch_deepcourts", bossKind: "ssarim", title: "The River's Question", text: "The flood that took Mirefall came, and stayed, and is staying. It only ever asked once, and Ssarim was the asking." },
  { id: "frag_maggot", chapter: "ch_deepcourts", bossKind: "maggotqueen", title: "The Brood Hungers", text: "She does not fight so much as multiply. Every heartbeat down in the caves is another mouth she has made for you." },
  // ch_hollowkings
  { id: "frag_malgrim", chapter: "ch_hollowkings", bossKind: "malgrim", title: "Dread Itself", text: "Malgrim was the first to trade his name. He got dread in return, and gave it away freely ever after, to everyone." },
  { id: "frag_aldric", chapter: "ch_hollowkings", bossKind: "aldric", title: "The Forsworn", text: "Aldric was no fool and no puppet. He saw the light clearly, weighed it, and set it down. That is the worst of it." },
  { id: "frag_uldrath", chapter: "ch_hollowkings", bossKind: "uldrath", title: "The Unmaker", text: "\"I am what remains when all else is finished.\" The last brother does not rule the dark. He is what the dark is for." },
  // ch_meadow
  { id: "frag_bovax", chapter: "ch_meadow", bossKind: "bovax", title: "MOO", text: "There is no meadow. There is no herd. There is no peg-legged king of a kingdom that does not exist. Moo." },
  // ch_ternion — recovered from set-pieces (no bossKind; a SETPIECE grants each)
  { id: "frag_ternion_a", chapter: "ch_ternion", title: "The Rule of Threes", text: "\"Nothing is made from one thing, nor from two. Three El-runes become an Ond. Three failures become a proof. Three of us became the Order.\" The altar-stone still hums, faintly, waiting for a fourth thing to complete." },
  { id: "frag_ternion_b", chapter: "ch_ternion", title: "The Cost Ledger", text: "A scholar's ledger, every transmutation double-entered — what went in, what came out, and a third column headed only 'PAID'. The entries in that column are not runes or gold. They are names. Some of them are the scholars' own." },
  { id: "frag_ternion_c", chapter: "ch_ternion", title: "The Last Transmutation", text: "\"We have run out of lesser things to turn into greater ones. There is only one transmutation left that we have not dared. We will each become a third of it. If you are reading this, it worked, and you should run.\"" },
  // ch_folk — one per act, the ordinary dead
  { id: "frag_folk_1", chapter: "ch_folk", title: "The Token Cairn", text: "A cairn beside the trail, and on it the small things the fleeing left so the dead would have company: a wooden horse, a wedding ring, a milk-tooth in a twist of cloth. Nobody came back for any of it. Nobody came back at all." },
  { id: "frag_folk_2", chapter: "ch_folk", title: "The Wrapped Family", text: "Three shapes seated together under the sand, wrapped with a care that outlived whoever did the wrapping — tallest to smallest, hands still joined down the row. The Queen preserves everything. She does not ask whether it wished to be kept." },
  { id: "frag_folk_3", chapter: "ch_folk", title: "The Ferryman's Ledger", text: "A toll-ledger nailed to a drowned post, every passage marked paid, every passenger marked delivered. The last line reads: 'All aboard. None ashore. The far bank has moved again.' The ink under the water has not run in a hundred years." },
  { id: "frag_folk_4", chapter: "ch_folk", title: "The Unsent Letter", text: "Tucked in a dead sentry's breastplate, a letter home: '—holding the wall, tell mother the ash is only ash, tell her we—' It stops there. The wall did not hold. The ash was never only ash. The letter never left the Vigil." },
  // ch_ending — recovered the moment Uldrath falls (granted by the ending flow, not found)
  { id: "frag_ending", chapter: "ch_ending", title: "What Remains", text: "\"I am what remains when all else is finished,\" the Unmaker said, and was wrong, because you remained. The Hollow Throne is empty. The three names traded to the dark are unspoken now, and stay unspoken. The world does not thank you — it has forgotten how — but it goes on, which is the only thanks a dying road has left to give. And far below the empty throne, in the dark under the dark, something that is not a brother begins, very slowly, to wake." },
];

const FRAGMENT_BY_ID = new Map(LORE_FRAGMENTS.map((f) => [f.id, f]));
export function fragmentById(id: string): LoreFragment | undefined {
  return FRAGMENT_BY_ID.get(id);
}
export function fragmentsForBoss(kind: string): LoreFragment[] {
  return LORE_FRAGMENTS.filter((f) => f.bossKind === kind);
}
export function chapterFragments(chapterId: string): LoreFragment[] {
  return LORE_FRAGMENTS.filter((f) => f.chapter === chapterId);
}
// a chapter is complete once every one of its fragments has been recovered
export function chapterComplete(chapterId: string, have: readonly string[]): boolean {
  const frags = chapterFragments(chapterId);
  if (!frags.length) return false;
  const set = new Set(have);
  return frags.every((f) => set.has(f.id));
}
// the account-wide boon: sum the reward of every completed chapter
export function codexChapterBonuses(have: readonly string[]): ItemStats {
  const out: ItemStats = {};
  for (const ch of CODEX_CHAPTERS) {
    if (chapterComplete(ch.id, have)) addStats(out, ch.reward.stats);
  }
  return out;
}

// ---- the Reliquary: the story of each signature relic (curated, not exhaustive) ----
export const RELIC_LORE: RelicLore[] = [
  { name: "Hargol's Cleaver", lore: "The blade that made the cathedral steps famous. It still swings itself, a little, if you let your grip go loose." },
  { name: "The Mummer's Crown", lore: "A jester's cap of the old court, worn by the last man to make a Hollow King laugh. He was not thanked for it." },
  { name: "Winterclaw", lore: "A ring of frozen bone, taken from the finger of someone who reached for warmth in the wrong place." },
  { name: "The Orphan Star", lore: "A gem with no setting and no maker's mark, older than the settings men later built for it. It remembers being a star." },
  { name: "Kragmar's Face", lore: "Cast from the death-mask of a clan-father of the sacred peak. Wear it and the mountain looks out through your eyes." },
  { name: "Vessira's Visage", lore: "Her face, or a mask of it — the difference stopped mattering the day she planted the first seed. It smiles when you bleed." },
  { name: "Vuruk's Carapace", lore: "The White Maw's shed shell, still cold to the touch a hundred years on. The winter in it never agreed to leave." },
  { name: "The Grudgestone", lore: "Orvath's spite, pressed into a single dark stone. It keeps a tally of everyone who ever wronged its bearer, and adds you." },
  { name: "Nyzat's Lid", lore: "The lid of the Embalmed Queen's own jar. She does not need it anymore; she is wearing the world instead." },
  { name: "Ssarim's Riverspine", lore: "A length of the Drowned God's spine, cool and wet and never drying. Hold it to your ear for the sound of the flood that stayed." },
  { name: "The Unmaker's Edge", lore: "A sliver of whatever Uldrath became. It does not cut so much as end — the wound simply decides it was always there." },
  { name: "The First Dawn", lore: "Forged in a light that has not been seen since Act IV began. It is warm. Down here, that alone is worth a war." },
  { name: "The Bloodline", lore: "A greatsword passed hand to hand down a line that ended badly. Every owner is in it now, and they all want another turn." },
  { name: "Bovax's Hide?", lore: "The hide of a tyrant of a meadow that does not exist. The question mark is part of the name. Do not ask. Moo." },
];

const RELIC_LORE_BY_NAME = new Map(RELIC_LORE.map((r) => [r.name, r]));
export function relicLore(name: string): RelicLore | undefined {
  return RELIC_LORE_BY_NAME.get(name);
}

// ---- Set-pieces: hand-authored scenes placed into procedural floors ----
//
// Where encounters are a fleeting shrine (read once, gone), a set-piece is a
// standing monument you walk past — a wrecked wagon, a cairn of tokens, a
// scholar's ruined altar — that tells a beat AND leaves a lore fragment behind
// for the Codex. Act-scoped; the floor roll drops one that fits the land. Each
// grants exactly one fragment (dedup is per-account, so a party all read freely).
export interface SetPiece {
  id: string;
  act: number; // 1..4; 0 = any land
  label: string; // the world-label above the scene
  variant: "altar" | "cairn" | "shroud" | "ferry" | "marker"; // which drawing the client uses
  fragmentId: string; // the lore fragment this scene recovers
  pages: string[]; // the inscription, read in the dialogue window
}

export const SETPIECES: SetPiece[] = [
  // the Ternion Order — their ruin spans the first three lands
  { id: "sp_ternion_a", act: 1, label: "A scholar's altar-stone", variant: "altar", fragmentId: "frag_ternion_a", pages: [
    "A low stone altar stands where no chapel ever was, its face cut with a ring of interlocking threes worn shallow by patient thumbs.",
    "\"Nothing is made from one thing, nor from two,\" the inscription begins — the creed of the Ternion Order, who worked their transmutations in threes and vanished doing it.",
  ]},
  { id: "sp_ternion_b", act: 2, label: "An abandoned work-table", variant: "altar", fragmentId: "frag_ternion_b", pages: [
    "Glass vessels, most shattered, a few still holding a finger of something that has not evaporated in a century. A ledger lies open, weighted with a cracked crucible.",
    "Every transmutation is double-entered — what went in, what came out — and a third column, headed only 'PAID', that you wish you had not read.",
  ]},
  { id: "sp_ternion_c", act: 3, label: "The Order's last altar", variant: "altar", fragmentId: "frag_ternion_c", pages: [
    "The third and last of the Ternion altars, sunk to its rim in bog-water, its ring of threes finally closed by a fourth mark scratched hastily across them all.",
    "A final note is pinned beneath a jar of blue salt. It does not read like the others. It reads like a warning left by people who had run out of time to leave warnings.",
  ]},
  // the Fallen Folk — one memorial per land
  { id: "sp_folk_1", act: 1, label: "A cairn of small things", variant: "cairn", fragmentId: "frag_folk_1", pages: [
    "A cairn of grey stones beside the trail, and heaped upon it the small things the fleeing left behind — a wooden horse, a ring, a twist of cloth.",
    "They are placed, not dropped. Someone meant the dead to have company. Someone had time for that, and then did not have time for anything else.",
  ]},
  { id: "sp_folk_2", act: 2, label: "A wrapped family", variant: "shroud", fragmentId: "frag_folk_2", pages: [
    "Three wrapped shapes seated together under the lee of a dune, tallest to smallest, bound with a care that has outlasted the hands that bound them.",
    "Their wrapped hands are still joined, down the row. Zerath preserves everything. It was never asked whether it wished to be kept.",
  ]},
  { id: "sp_folk_3", act: 3, label: "A drowned mooring", variant: "ferry", fragmentId: "frag_folk_3", pages: [
    "A mooring post juts from the black shallows, a toll-ledger still nailed to it, a dead lantern still hung from its hook, patient for a ferry that is never putting in.",
    "Every passage marked paid. Every passenger marked delivered. The last line: 'All aboard. None ashore. The far bank has moved again.'",
  ]},
  { id: "sp_folk_4", act: 4, label: "A sentry's rest", variant: "marker", fragmentId: "frag_folk_4", pages: [
    "A sword planted point-down through a fallen sentry's shield, the only grave-marker the Vigil had time to give, ash drifting into the seams of the plate.",
    "There is a letter tucked in the breastplate, half-written, telling someone at home that the ash is only ash. It is not only ash. It never was.",
  ]},
];

const SETPIECE_BY_ID = new Map(SETPIECES.map((s) => [s.id, s]));
export function setpieceById(id: string): SetPiece | undefined {
  return SETPIECE_BY_ID.get(id);
}
// pick a set-piece that belongs to this land (or anywhere)
export function rollSetpiece(act: number, rng: () => number): SetPiece | null {
  const pool = SETPIECES.filter((s) => s.act === act || s.act === 0);
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}
export const SETPIECE_CHANCE = 0.4; // a monument stands on many, not all, floors

// ---- Story beats: the authored spine, fired once when a milestone quest first completes ----
//
// Keyed by quest id. Felling an act boss (or a Hollow King) plays a paged beat the FIRST
// time that hero does it — questsDone already guarantees once-only + persistence, so farm
// kills stay quiet. The_unmaking is the ending: it carries `ending: true`, which the client
// renders as a full-screen cinematic (and the server also seals the Codex capstone chapter).
export interface StoryBeat {
  quest: string; // the quest id whose completion fires this beat
  title: string;
  pages: string[];
  ending?: boolean; // the finale — Uldrath unmade
}

export const STORY_BEATS: StoryBeat[] = [
  { quest: "thorned_maiden", title: "The road east opens", pages: [
    "Vessira's thorns go slack. The wound she planted in the Mournfield — in all of it — stops spreading, for the first time since the grieving began.",
    "Beyond the wood the caravan-road runs east, into the Sunscar Wastes, where Zerath Oasis waits and something older than thirst has learned to wear the sand.",
  ]},
  { quest: "embalmed_queen", title: "The wastes let go", pages: [
    "Queen Nyzat, who wore the desert a thousand years, is unwrapped at last. The gardens she meant to keep can finish dying now — the kindest thing left to offer them.",
    "The road runs on, into the Drowned Green, where a flood came and did not leave, and a god sits patient at the bottom of it.",
  ]},
  { quest: "drowned_god", title: "The river recedes", pages: [
    "Ssarim, the Drowned God, sinks a final time, and the flood that stayed a hundred years remembers, all at once, how to leave. The far bank stops moving.",
    "Only the Hollow Throne remains now — under ashfall, at the end of the road — and the three brother-kings who traded their names for it.",
  ]},
  { quest: "oathbreaker", title: "The Forsworn falls", pages: [
    "Aldric the Forsworn goes down still remembering the light he turned from. \"I chose this,\" he says one last time — not a boast now, only the truth, and the worst of it.",
    "Two brothers remain between you and the empty throne.",
  ]},
  { quest: "dread_itself", title: "Dread goes out", pages: [
    "Malgrim, the King of Dread — first of the three to trade his name — has nothing left to trade. The fear he gave away so freely finds no more takers, and goes out like a blown lamp.",
    "One brother remains. The oldest. The last. The Unmaker, at the bottom of everything.",
  ]},
  { quest: "the_unmaking", title: "THE UNMAKING UNDONE", ending: true, pages: [
    "Uldrath, the Unmaker, last of the Hollow Kings, kneels in the hall he emptied of everything but himself.",
    "\"I am what remains when all else is finished,\" he says — and is wrong, because you are still standing, and standing is a kind of remaining he never accounted for.",
    "The Hollow Throne goes cold, and stays cold. The three traded names are unspoken, and will not be spoken again. The dying road, for the first time in a long age, is only a road.",
    "It is over. The world does not know how to thank you, so it simply goes on. But far below the empty throne, in the dark beneath the dark, the Endless Abyss draws its first breath — and it has been waiting for someone exactly like you.",
  ]},
];

const STORY_BEAT_BY_QUEST = new Map(STORY_BEATS.map((b) => [b.quest, b]));
export function storyBeatFor(questId: string): StoryBeat | undefined {
  return STORY_BEAT_BY_QUEST.get(questId);
}
export const ENDING_FRAGMENT = "frag_ending"; // sealed into the Codex when the finale plays
