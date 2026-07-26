// Every voice belonging to a sustained layer must be reachable by that layer's fader.
//
// This exists because of a bug that was inaudible in code review and obvious in play:
// `pluck()` wired itself straight to ctx.destination, so `stopAmbient()` — which only
// disconnects the nodes it tracked — could not silence the town theme. The theme
// schedules a whole ten-second loop into the graph at once, so leaving town left the
// guitar playing over the dungeon bed, and walking back in started a second loop on top
// of the first. Two town soundtracks, out of phase.
//
// The check is structural, not sonic: build the graph with a recording stand-in for
// AudioContext, swap themes, let the fade run, then ask whether anything the old layer
// created can still reach the speakers.
import { Sfx } from "../../../client/src/sfx.js";

class Param {
  constructor(public value = 0) {}
  setValueAtTime(v: number) { this.value = v; return this; }
  linearRampToValueAtTime(v: number) { this.value = v; return this; }
  exponentialRampToValueAtTime(v: number) { this.value = v; return this; }
  cancelScheduledValues() { return this; }
}

class Node {
  outs: Node[] = [];
  started = false;
  stopAt: number | null = null;
  gain = new Param(1);
  frequency = new Param(0);
  Q = new Param(1);
  type = "";
  buffer: unknown = null;
  constructor(public kind: string) { nodes.push(this); }
  connect(dst: Node) { this.outs.push(dst); return dst; }
  disconnect() { this.outs = []; }
  start() { this.started = true; }
  stop(t = 0) { this.stopAt = t; }
}

let nodes: Node[] = [];
const speakers = new Node("destination");

const ctx = {
  currentTime: 0,
  sampleRate: 48000,
  state: "running",
  destination: speakers,
  resume: () => {},
  createGain: () => new Node("gain"),
  createOscillator: () => new Node("osc"),
  createBufferSource: () => new Node("src"),
  createBiquadFilter: () => new Node("filter"),
  createConvolver: () => new Node("convolver"),
  createBuffer: (ch: number, len: number) => ({
    length: len,
    numberOfChannels: ch,
    getChannelData: () => new Float32Array(len),
  }),
};
(globalThis as Record<string, unknown>).AudioContext = function () { return ctx; };

/** Sources that have been started, haven't finished by `now`, and still reach the speakers. */
function audible(now: number): Node[] {
  const reaches = new Set<Node>([speakers]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const n of nodes) {
      if (!reaches.has(n) && n.outs.some((o) => reaches.has(o))) { reaches.add(n); changed = true; }
    }
  }
  return nodes.filter((n) => n.started && reaches.has(n) && (n.stopAt === null || n.stopAt > now));
}

const fail = (msg: string) => { console.error(`audio-bus: ${msg}`); process.exit(1); };
const FADE_MS = 1000; // BED_FADE (0.7s) + the teardown's 150ms grace, with room to spare

async function main() {
  const sfx = new Sfx();
  sfx.ensure();

  // --- the town theme must be audible, then must vanish when you walk out ---
  sfx.setAmbient(101, 0); // 100+act = town
  if (!audible(0).length) fail("town theme is silent");
  // the long plucks are the theme's fingerpicking — 1.5s+ each, scheduled up to 10s ahead
  const townVoices = audible(0).filter((n) => n.kind === "src" && (n.stopAt ?? 0) > 1.4).length;
  if (townVoices < 4) fail(`expected the town theme's fingerpicking, saw ${townVoices} long voices`);

  sfx.setAmbient(9, 0.1); // out into the woods
  await new Promise((r) => setTimeout(r, FADE_MS));
  const strays = audible(1.0).filter((n) => n.kind === "src" && (n.stopAt ?? 0) > 1.4);
  if (strays.length) {
    fail(`${strays.length} town voices still reach the speakers after the crossfade — ` +
         `a sustained layer is bypassing its fader (see the Bus type in client/src/sfx.ts)`);
  }

  // --- the lobby march must fade out too: its gong is a pluck, and plucks default to
  // wiring themselves straight to the speakers ---
  nodes = [];
  sfx.startLobbyTheme();
  if (!audible(0).length) fail("lobby theme is silent");
  sfx.stopLobbyTheme();
  await new Promise((r) => setTimeout(r, FADE_MS));
  const lobbyDry = audible(1.0).filter((n) => {
    const path = (x: Node, d = 0): boolean =>
      d <= 24 && (x === speakers || x.outs.some((o) => path(o, d + 1)));
    return path(n);
  });
  const loud = lobbyDry.filter((n) => (n.stopAt ?? 0) > 1.0);
  if (loud.length) fail(`${loud.length} lobby voices survived the descent fade`);

  // --- and the guard in the other direction: gameplay one-shots must still go straight
  // out, not get swallowed by whatever bed happens to be playing ---
  nodes = [];
  sfx.hit();
  if (!audible(0).length) fail("gameplay SFX no longer reach the speakers");

  console.log("OK: town + lobby layers fade cleanly on exit; gameplay SFX still route direct");
  process.exit(0); // the ambient timers would otherwise hold the process open
}

void main();
