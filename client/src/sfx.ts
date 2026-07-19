// Tiny WebAudio synth — placeholder sound effects until real audio assets exist.
// A single shared instance (see `sfx` below) is used everywhere so the AudioContext
// unlocked by the lobby's first click is the same one the game plays through.
export class Sfx {
  private ctx: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private reverbSend: GainNode | null = null; // shared wet bus — the space around the sound

  // must be called from a user gesture (browsers block audio before interaction)
  ensure() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.ensureReverb();
    if (this.pendingTheme >= 0 && this.ambientTheme !== this.pendingTheme) {
      this.startAmbient(this.pendingTheme);
    }
    if (this.rainPending && this.rainNodes.length === 0) this.setRain(true);
  }

  // a convolution reverb built from a generated impulse — the stone hush of a
  // cathedral, the wet echo of a flooded crypt. No sample: the tail is synthesized.
  private ensureReverb() {
    if (!this.ctx || this.reverbSend) return;
    const ctx = this.ctx;
    const seconds = 2.8;
    const len = Math.floor(seconds * ctx.sampleRate);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        // exponential-ish decay of filtered-feeling noise; the two channels differ → width
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    const send = ctx.createGain();
    send.gain.value = 1;
    const damp = ctx.createBiquadFilter(); // roll the top off the tail — warm, not glassy
    damp.type = "lowpass";
    damp.frequency.value = 3200;
    const wet = ctx.createGain();
    wet.gain.value = 0.85;
    send.connect(conv).connect(damp).connect(wet).connect(ctx.destination);
    this.reverbSend = send;
  }

  // Karplus-Strong plucked string — a burst of pick-noise fed through a delay line
  // the length of one wavelength, averaged (a gentle lowpass) as it recirculates so
  // the highs die before the fundamental. This is the sound of a fingered nylon
  // guitar, and the sound of Tristram.
  private pluck(freq: number, dur: number, gain = 0.12, damping = 0.995, reverb = 0.55, when = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const len = Math.max(2, Math.floor(dur * sr));
    const N = Math.max(2, Math.round(sr / freq)); // delay length sets the pitch
    const buf = ctx.createBuffer(1, len, sr);
    const y = buf.getChannelData(0);
    for (let i = 0; i < N && i < len; i++) y[i] = Math.random() * 2 - 1; // the pluck
    for (let i = N; i < len; i++) y[i] = damping * 0.5 * (y[i - N] + y[i - N + 1]); // recirculate + lowpass
    const atk = 0.004 * sr;
    for (let i = 0; i < len; i++) {
      const env = i < atk ? i / atk : Math.pow(1 - i / len, 0.5); // soft pick, natural decay
      y[i] *= env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const body = ctx.createBiquadFilter(); // a little soundboard warmth
    body.type = "peaking";
    body.frequency.value = 200;
    body.gain.value = 4;
    body.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(body).connect(g);
    g.connect(ctx.destination);
    if (this.reverbSend && reverb > 0) {
      const s = ctx.createGain();
      s.gain.value = reverb;
      g.connect(s).connect(this.reverbSend);
    }
    const t = ctx.currentTime + when;
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // a run of plucked notes — a reverbed motif, the harp in the dark
  private pluckSeq(notes: number[], step: number, gain: number, damping = 0.99, reverb = 0.6) {
    notes.forEach((f, i) => setTimeout(() => this.pluck(f, step * 2.4, gain, damping, reverb), i * step * 1000));
  }

  // route a finished gain node to the speakers and (optionally) into the reverb
  private toOut(g: GainNode, reverb = 0) {
    if (!this.ctx) return;
    g.connect(this.ctx.destination);
    if (this.reverbSend && reverb > 0) {
      const s = this.ctx.createGain();
      s.gain.value = reverb;
      g.connect(s).connect(this.reverbSend);
    }
  }

  // ============================================================
  // --- the deep listens back: creeping ambient horror, chosen by depth ---
  // low creep = subtle unease (a drip, a far whisper); high creep = overt dread
  // (breathing at your neck, a scream down the hall, a sudden wrong chord).
  // ============================================================
  private creepLayer(creep: number) {
    if (!this.ctx) return;
    const r = Math.random();
    if (creep < 0.34) {
      if (r < 0.5) this.whisper(0.5);
      else this.farDrip();
    } else if (creep < 0.67) {
      if (r < 0.32) this.whisper(0.75);
      else if (r < 0.55) this.scuttle();
      else if (r < 0.8) this.distantScream(0.5);
      else this.boneRattle();
    } else {
      if (r < 0.22) this.breath();
      else if (r < 0.42) this.whisper(1);
      else if (r < 0.58) this.heartbeatFar();
      else if (r < 0.76) this.distantScream(0.85);
      else if (r < 0.9) this.scuttle();
      else this.stinger(); // rare — the wrongness announcing itself
    }
  }

  private farDrip() {
    this.tone(1500, 900, 0.08, "sine", 0.018);
  }

  // a voice you can't quite make out — two breathy band-passed bursts, drenched
  private whisper(intensity = 0.7) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t0 = now + i * 0.3;
      const src = ctx.createBufferSource();
      src.buffer = this.getNoiseBuf();
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = 6;
      const base = 700 + Math.random() * 900;
      f.frequency.setValueAtTime(base, t0);
      f.frequency.linearRampToValueAtTime(base * 0.7, t0 + 0.35);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.02 * intensity, t0 + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
      src.connect(f).connect(g);
      this.toOut(g, 0.85);
      src.start(t0);
      src.stop(t0 + 0.5);
    }
  }

  // a far cry that swells and breaks — sawtooth through a formant, all reverb tail
  private distantScream(intensity = 0.6) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(240, now);
    o.frequency.linearRampToValueAtTime(500 + Math.random() * 180, now + 0.5);
    o.frequency.linearRampToValueAtTime(180, now + 1.4);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 900;
    f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.016 * intensity, now + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    o.connect(f).connect(g);
    this.toOut(g, 0.95);
    o.start(now);
    o.stop(now + 1.6);
  }

  // rapid dry ticks — something on many legs, close
  private scuttle() {
    const n = 5 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = this.getNoiseBuf();
        const f = ctx.createBiquadFilter();
        f.type = "highpass";
        f.frequency.value = 3500;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.03, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
        src.connect(f).connect(g);
        this.toOut(g, 0.25);
        src.start(now);
        src.stop(now + 0.05);
      }, i * (40 + Math.random() * 55));
    }
  }

  // dry knocking of bone on stone
  private boneRattle() {
    const n = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = this.getNoiseBuf();
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = 1600 + Math.random() * 800;
        f.Q.value = 8;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.024, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
        src.connect(f).connect(g);
        this.toOut(g, 0.5);
        src.start(now);
        src.stop(now + 0.07);
      }, i * (55 + Math.random() * 45));
    }
  }

  // something large, near: a slow inhale, then the exhale
  private breath() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const puff = (t0: number, up: boolean) => {
      const src = ctx.createBufferSource();
      src.buffer = this.getNoiseBuf();
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(up ? 300 : 700, now + t0);
      f.frequency.linearRampToValueAtTime(up ? 700 : 300, now + t0 + 0.9);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now + t0);
      g.gain.linearRampToValueAtTime(0.02, now + t0 + 0.35);
      g.gain.linearRampToValueAtTime(0.0001, now + t0 + 0.9);
      src.connect(f).connect(g);
      this.toOut(g, 0.4);
      src.start(now + t0);
      src.stop(now + t0 + 1);
    };
    puff(0, true);
    puff(1.1, false);
  }

  // a slow, quiet heart, somewhere below
  private heartbeatFar() {
    this.tone(55, 48, 0.14, "sine", 0.05);
    setTimeout(() => this.tone(50, 44, 0.12, "sine", 0.04), 230);
  }

  // a sudden dissonant cluster — rare, deep only
  private stinger() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    for (const fr of [110, 116.5, 155.6]) {
      // a minor-second grind with a tritone on top
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = fr;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.03, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
      o.connect(g);
      this.toOut(g, 0.85);
      o.start(now);
      o.stop(now + 1);
    }
    this.noise(0.5, 200, "lowpass", 0.03); // a thud beneath it
  }

  // --- ambient soundscape, one per depth band ---

  private ambientNodes: AudioNode[] = [];
  private ambientTimers: Array<ReturnType<typeof setInterval>> = [];
  private ambientTheme = -1;
  private pendingTheme = -1;
  private creep = 0; // 0..1: how far you've fallen — scales the horror
  ambientEnabled = true;

  // the lobby's impending-doom drums live outside the depth-based ambient system
  private lobbyNodes: AudioNode[] = [];
  private lobbyTimers: Array<ReturnType<typeof setInterval>> = [];
  private lobbyFader: GainNode | null = null;
  private lobbyOn = false;

  // creep is a 0..1 depth factor; deeper = more frequent, more disturbing ambience.
  // A meaningful change in depth restarts the bed so the escalation is heard.
  setAmbient(themeIdx: number, creep = 0) {
    this.pendingTheme = themeIdx;
    const changed = Math.abs(creep - this.creep) > 0.12;
    this.creep = creep;
    if (this.ctx) this.startAmbient(themeIdx, changed && this.ambientTheme === themeIdx);
  }

  toggleAmbient(): boolean {
    this.ambientEnabled = !this.ambientEnabled;
    if (!this.ambientEnabled) this.stopAmbient();
    else if (this.pendingTheme >= 0 && this.ctx) this.startAmbient(this.pendingTheme, true);
    return this.ambientEnabled;
  }

  private stopAmbient() {
    this.ambientTimers.forEach((t) => clearInterval(t));
    this.ambientTimers = [];
    this.ambientNodes.forEach((n) => {
      try { (n as unknown as { stop?: () => void }).stop?.(); } catch { /* already stopped */ }
      try { n.disconnect(); } catch { /* already gone */ }
    });
    this.ambientNodes = [];
    this.ambientTheme = -1;
  }

  private startAmbient(themeIdx: number, force = false) {
    if (!this.ctx || !this.ambientEnabled) return;
    if (!force && this.ambientTheme === themeIdx) return;
    this.stopAmbient();
    this.ambientTheme = themeIdx;
    const ctx = this.ctx;

    const master = ctx.createGain();
    master.gain.value = 0.028; // subtle — dread, not a concert
    master.connect(ctx.destination);
    // send the whole bed into the reverb so drones and motifs breathe in a real space
    this.ensureReverb();
    if (this.reverbSend) {
      const send = ctx.createGain();
      send.gain.value = 0.5;
      master.connect(send).connect(this.reverbSend);
      this.ambientNodes.push(send);
    }
    this.ambientNodes.push(master);

    // slow breathing on the whole bed
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06 + themeIdx * 0.02;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.011;
    lfo.connect(lfoGain).connect(master.gain);
    lfo.start();
    this.ambientNodes.push(lfo, lfoGain);

    const drone = (freq: number, type: OscillatorType, gain: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g).connect(master);
      o.start();
      this.ambientNodes.push(o, g);
    };

    const noiseBed = (freq: number, gain: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.getNoiseBuf();
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(f).connect(g).connect(master);
      src.start();
      this.ambientNodes.push(src, f, g);
    };

    // --- the town theme: a fingerpicked lament by the hearth (Tristram in spirit) ---
    // themeIdx 100+act. One melancholy loop, transposed a little per land for its own mood.
    if (themeIdx >= 100) {
      const act = Math.min(Math.max(themeIdx - 100, 1), 4);
      const semis = [0, -2, 3, -5][act - 1]; // Hollowmere Am · Zerath G · Mirefall C · the Vigil low
      const k = Math.pow(2, semis / 12); // transpose the whole piece
      // Am – F – C – G, voiced low, fingerpicked. [bass, then three voices]
      const chords: number[][] = [
        [110.0, 220.0, 261.6, 329.6], // Am  (A2 · A3 C4 E4)
        [87.31, 174.6, 220.0, 261.6], // F   (F2 · F3 A3 C4)
        [130.8, 261.6, 329.6, 392.0], // C   (C3 · C4 E4 G4)
        [98.0, 196.0, 246.9, 293.7], // G   (G2 · G3 B3 D4)
      ].map((c) => c.map((f) => f * k));
      // a sparse lead that floats over bars 1 and 3 — the melody you half-remember
      const lead = [440.0, 523.3, 493.9, 392.0].map((f) => f * k);
      const beat = 0.62; // slow, grieving
      const barBeats = 4;
      const loopMs = chords.length * barBeats * beat * 1000;
      // a warm low pad under it all, and the fire's breath
      drone(55 * k, "triangle", 0.5);
      drone(110 * k, "sine", 0.14);
      noiseBed(360, 0.05); // the campfire, low
      const playLoop = () => {
        if (!this.ctx || !this.ambientEnabled) return;
        chords.forEach((ch, bar) => {
          const t0 = bar * barBeats * beat;
          // p–i–m–a fingerpicking: bass, high, mid, top
          this.pluck(ch[0], 2.2, 0.10, 0.994, 0.5, t0 + 0 * beat);
          this.pluck(ch[2], 1.5, 0.075, 0.99, 0.55, t0 + 1 * beat);
          this.pluck(ch[1], 1.5, 0.08, 0.99, 0.55, t0 + 2 * beat);
          this.pluck(ch[3], 1.6, 0.07, 0.99, 0.55, t0 + 3 * beat);
          if (bar === 0 || bar === 2) {
            // the lead answers on the off-beat, quiet and reverbed
            const n = bar === 0 ? lead[0] : lead[1];
            this.pluck(n, 2.6, 0.06, 0.992, 0.7, t0 + 2.5 * beat);
          }
          if (bar === 3) this.pluck(lead[3], 2.8, 0.05, 0.992, 0.75, t0 + 3.5 * beat); // a sighing resolve
        });
      };
      playLoop();
      this.ambientTimers.push(setInterval(playLoop, loopMs));
      // a distant chapel bell, rarely
      this.ambientTimers.push(
        setInterval(() => {
          if (this.ctx && Math.random() < 0.35) this.pluck(146.8 * k, 3.4, 0.05, 0.997, 0.8);
        }, 17000)
      );
      return;
    }

    // every dungeon has its own key: a drone bed, an event, and a slow motif
    let event: () => void;
    let motif: number[] = [];
    let motifType: OscillatorType = "sine";
    switch (themeIdx) {
      case 1: // catacombs: cold hollow drone, wind, distant moans
        drone(45, "triangle", 0.5);
        noiseBed(220, 0.22);
        event = () => this.tone(115, 70, 1.4, "sine", 0.018);
        motif = [220, 196, 165, 147]; // A minor descent — a dirge
        break;
      case 2: // caves: earth rumble and dripping water
        drone(38, "sine", 0.35);
        noiseBed(150, 0.5);
        event = () => this.tone(1400, 900, 0.07, "sine", 0.03);
        motif = [131, 156, 175, 156]; // C minor sway — stone breathing
        break;
      case 3: // hell: grinding saw drone, deep rumbles
        drone(40, "sawtooth", 0.32);
        noiseBed(120, 0.35);
        event = () => this.noise(0.9, 90, "lowpass", 0.05);
        motif = [110, 117, 110, 82]; // half-step menace — the tritone lives here
        motifType = "sawtooth";
        break;
      case 4: // frozen: glassy high shimmer, crystalline pings
        drone(66, "sine", 0.4);
        drone(99, "triangle", 0.12);
        noiseBed(3000, 0.06);
        event = () => this.tone(1760, 1750, 0.6, "sine", 0.014);
        motif = [523, 659, 784, 659]; // icy arpeggio, far away
        break;
      case 5: // sanguine: slow heartbeat, choir-ish thirds
        drone(52, "sine", 0.42);
        drone(62.4, "sine", 0.16);
        event = () => {
          this.tone(58, 50, 0.14, "sine", 0.06); // lub
          setTimeout(() => this.tone(52, 46, 0.12, "sine", 0.05), 220); // dub
        };
        motif = [175, 208, 175, 147]; // F minor lament
        break;
      case 6: // swamp: croaks, bubbles, a waterlogged bass
        drone(42, "triangle", 0.4);
        noiseBed(300, 0.3);
        event = () => this.tone(90 + Math.random() * 60, 70, 0.18, "square", 0.02);
        motif = [98, 110, 98, 87]; // something large turning over in the water
        motifType = "triangle";
        break;
      case 7: // void: near-silence, detuned beating, wrong intervals
        drone(48, "sine", 0.35);
        drone(48.7, "sine", 0.35); // beats against itself — unease by physics
        event = () => this.tone(1046, 1044, 1.8, "sine", 0.008);
        motif = [233, 220, 247, 208]; // no home note; never resolves
        break;
      case 8: // the abyss: sub-bass pressure, whispers at the edge of hearing
        drone(31, "sine", 0.55);
        drone(31.4, "sine", 0.3); // beat frequency: the walls breathe
        noiseBed(180, 0.2);
        event = () => this.noise(0.5, 480, "bandpass", 0.02); // something whispered
        motif = [147, 139, 131, 123]; // a chromatic descent — the stairs keep going
        motifType = "sine";
        break;
      case 9: // forest: wind through leaves, a crow somewhere, uneasy pastoral
        drone(58, "triangle", 0.3);
        noiseBed(900, 0.16); // the canopy hushing
        event = () => {
          if (Math.random() < 0.5) {
            // a crow that saw something
            this.tone(620, 480, 0.09, "square", 0.012);
            setTimeout(() => this.tone(590, 460, 0.08, "square", 0.01), 180);
          } else {
            this.tone(330, 328, 1.2, "sine", 0.008); // wind singing in a dead tree
          }
        };
        motif = [196, 220, 247, 196]; // G minor pastoral — pretty, but wrong
        motifType = "triangle";
        break;
      case 10: // sunscar wastes: dry wind, heat shimmer, something circling
        drone(52, "triangle", 0.28);
        noiseBed(1400, 0.12); // wind over hardpan
        event = () => {
          if (Math.random() < 0.4) {
            this.tone(880, 640, 0.5, "sine", 0.007); // a vulture's distant keen
          } else {
            this.noise(0.5, 1800, "highpass", 0.015); // sand hissing across stone
          }
        };
        motif = [175, 165, 147, 165]; // F minor mirage — heat with a pulse
        motifType = "triangle";
        break;
      case 11: // the tombs: dead air, dust, the shift of old cloth
        drone(42, "sine", 0.42);
        noiseBed(180, 0.28);
        event = () => {
          if (Math.random() < 0.5) {
            this.noise(0.35, 900, "bandpass", 0.02); // cloth dragging over stone
          } else {
            this.tone(98, 96, 1.6, "sine", 0.012); // a sarcophagus settling
          }
        };
        motif = [147, 139, 123, 110]; // D minor descent into the dust
        break;
      case 12: // the drowned green: rain on leaves, river, unseen birds
        drone(60, "triangle", 0.26);
        noiseBed(1100, 0.2); // the canopy dripping
        event = () => {
          if (Math.random() < 0.5) {
            this.tone(1240, 1180, 0.06, "sine", 0.014); // something bright calls once
            setTimeout(() => this.tone(1350, 1240, 0.05, "sine", 0.01), 140);
          } else {
            this.tone(220, 218, 1.4, "sine", 0.009); // the river under everything
          }
        };
        motif = [220, 262, 247, 220]; // A dorian — green, wet, alive
        motifType = "triangle";
        break;
      case 13: // the ziggurat: flooded stone, deep hum, dripping altars
        drone(36, "sine", 0.44);
        noiseBed(300, 0.3);
        event = () => {
          if (Math.random() < 0.6) {
            this.tone(1600, 1000, 0.08, "sine", 0.026); // a drop into deep water
          } else {
            this.tone(73, 72, 2.0, "sine", 0.014); // the god turning over in its sleep
          }
        };
        motif = [131, 123, 110, 123]; // C minor undertow
        break;
      case 14: // the ashfall road: cinders, far-off collapse, the breach breathing
        drone(38, "sawtooth", 0.24);
        drone(57, "sine", 0.18);
        noiseBed(500, 0.22);
        event = () => {
          if (Math.random() < 0.5) {
            this.noise(1.1, 70, "lowpass", 0.045); // something enormous falling, far away
          } else {
            this.tone(150, 90, 0.7, "sawtooth", 0.012); // the breach exhaling
          }
        };
        motif = [110, 104, 110, 82]; // the tritone again — closer now
        motifType = "sawtooth";
        break;
      default: // cathedral: low organ-ish hum, distant bell
        drone(55, "sine", 0.5);
        drone(82.5, "sine", 0.18);
        event = () => this.tone(523, 522, 2.2, "sine", 0.012);
        motif = [262, 233, 196, 220]; // plainsong fragment
        break;
    }

    // the further you've fallen, the more often the dark speaks up
    const creep = this.creep;
    this.ambientTimers.push(
      setInterval(() => {
        if (this.ctx && Math.random() < 0.5 + creep * 0.35) event();
      }, Math.round(8000 - creep * 3500)) // 8s near the surface → ~4.5s in the deep
    );
    // the motif drifts in rarely — a plucked line in a reverbed hall, music you
    // only half-notice. Heavier damping on the menacing (sawtooth) bands keeps them muted.
    const motifMuted = motifType === "sawtooth" ? 0.97 : 0.992;
    this.ambientTimers.push(
      setInterval(() => {
        if (this.ctx && Math.random() < 0.5 && motif.length) {
          this.pluckSeq(motif, 0.85, 0.05, motifMuted, 0.7);
        }
      }, Math.round(21000 - creep * 9000)) // more insistent the deeper you go
    );
    // the deep listens back — a separate layer of creeping horror that only wakes
    // once you're past the surface, and grows more frequent and more overt with depth.
    if (creep > 0.06) {
      this.ambientTimers.push(
        setInterval(() => {
          if (this.ctx && Math.random() < 0.3 + creep * 0.5) this.creepLayer(creep);
        }, Math.round(13000 - creep * 7000)) // 13s → ~6s at the bottom
      );
    }
  }

  // ============================================================
  // --- the lobby theme: impending-doom war drums (Diablo in spirit) ---
  // ============================================================

  // a deep war drum — a pitched membrane boom with a beater transient. The fast
  // downward pitch drop is what makes it read as a struck drum and not a bass note.
  private warDrum(out: AudioNode, when: number, freq = 55, gain = 0.5, dur = 0.6) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(freq * 2.4, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.07);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(gain, t + 0.006); // hard attack — the strike
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(og).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
    // the beater: a short low-passed noise crack riding on top of the skin
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuf();
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 260;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(gain * 0.55, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    src.connect(f).connect(ng).connect(out);
    src.start(t);
    src.stop(t + 0.1);
  }

  // A slow martial march toward the dark, over a low D-minor dread-drone, with an
  // ominous horn swell and a distant war-gong. Started from the lobby's first click;
  // call stopLobbyTheme() when the descent begins and the dungeon's own bed takes over.
  startLobbyTheme() {
    if (!this.ctx || this.lobbyOn) return;
    this.lobbyOn = true;
    const ctx = this.ctx;
    this.ensureReverb();

    // fader (the clean exit-fade) ← master (breathes) ← drones + drum bus
    const fader = ctx.createGain();
    fader.gain.value = 1;
    fader.connect(ctx.destination);
    if (this.reverbSend) {
      const send = ctx.createGain();
      send.gain.value = 0.32; // the hall around the drums
      fader.connect(send).connect(this.reverbSend);
      this.lobbyNodes.push(send);
    }
    this.lobbyFader = fader;
    this.lobbyNodes.push(fader);

    const master = ctx.createGain();
    master.gain.value = 0.4;
    master.connect(fader);
    this.lobbyNodes.push(master);

    const drums = ctx.createGain();
    drums.gain.value = 1;
    drums.connect(master);
    this.lobbyNodes.push(drums);

    // --- the dread below: a low D bed and a bare, cold fifth ---
    const drone = (freq: number, type: OscillatorType, gain: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g).connect(master);
      o.start();
      this.lobbyNodes.push(o, g);
    };
    drone(36.71, "sine", 0.30); // D1 — the pit
    drone(55.0, "sine", 0.10); // A1 — a hollow fifth
    drone(73.42, "triangle", 0.06); // D2 — a little body

    // slow breathing on the whole bed
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain).connect(master.gain);
    lfo.start();
    this.lobbyNodes.push(lfo, lfoGain);

    // --- the drums: a heavy pulse, doom on the downbeats, a fill hauling you onward ---
    const beat = 0.5; // slow and weighty
    const phrase = 8; // two 4/4 bars
    const playPhrase = () => {
      if (!this.ctx || !this.lobbyOn) return;
      for (let b = 0; b < phrase; b++) {
        const t = b * beat;
        const down = b === 0 || b === 4;
        this.warDrum(drums, t, down ? 46 : 55, down ? 0.6 : 0.24, down ? 0.8 : 0.4);
        if (b === 2 || b === 6) this.warDrum(drums, t + beat * 0.5, 55, 0.2, 0.3); // walking ghost note
      }
      // the pickup: two rising toms dragging you to the next downbeat
      this.warDrum(drums, (phrase - 1) * beat + beat * 0.5, 62, 0.34, 0.3);
      this.warDrum(drums, (phrase - 1) * beat + beat * 0.75, 72, 0.44, 0.3);
    };
    playPhrase();
    this.lobbyTimers.push(setInterval(playPhrase, phrase * beat * 1000));

    // --- an ominous horn swell rising out of the dark, now and then ---
    this.lobbyTimers.push(
      setInterval(() => {
        if (!this.ctx || !this.lobbyOn) return;
        const now = this.ctx.currentTime;
        for (const fr of [73.42, 110.0]) {
          // D2 + A2 — a bare, cold fifth
          const o = this.ctx.createOscillator();
          o.type = "sawtooth";
          o.frequency.value = fr;
          const f = this.ctx.createBiquadFilter();
          f.type = "lowpass";
          f.frequency.setValueAtTime(180, now);
          f.frequency.linearRampToValueAtTime(720, now + 2.4);
          f.frequency.linearRampToValueAtTime(180, now + 4.8);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, now);
          g.gain.linearRampToValueAtTime(0.05, now + 2.2);
          g.gain.linearRampToValueAtTime(0.0001, now + 4.8);
          o.connect(f).connect(g).connect(master); // through the bed so it fades on exit
          o.start(now);
          o.stop(now + 5);
        }
      }, 11000)
    );

    // --- a distant war-gong, tolling rarely over the march ---
    this.lobbyTimers.push(
      setInterval(() => {
        if (this.ctx && this.lobbyOn && Math.random() < 0.6) this.pluck(55, 3.6, 0.06, 0.997, 0.9);
      }, 8000)
    );
  }

  stopLobbyTheme() {
    if (!this.lobbyOn) return;
    this.lobbyOn = false;
    this.lobbyTimers.forEach((t) => clearInterval(t));
    this.lobbyTimers = [];
    // fade the fader out, then tear the nodes down — no click when town takes over
    if (this.ctx && this.lobbyFader) {
      const now = this.ctx.currentTime;
      try {
        this.lobbyFader.gain.cancelScheduledValues(now);
        this.lobbyFader.gain.setValueAtTime(this.lobbyFader.gain.value, now);
        this.lobbyFader.gain.linearRampToValueAtTime(0.0001, now + 0.6);
      } catch { /* param busy — the teardown below still silences it */ }
    }
    this.lobbyFader = null;
    const nodes = this.lobbyNodes;
    this.lobbyNodes = [];
    setTimeout(() => {
      nodes.forEach((n) => {
        try { (n as unknown as { stop?: () => void }).stop?.(); } catch { /* already stopped */ }
        try { n.disconnect(); } catch { /* already gone */ }
      });
    }, 700);
  }

  private getNoiseBuf(): AudioBuffer {
    if (!this.noiseBuf) {
      this.noiseBuf = this.ctx!.createBuffer(1, this.ctx!.sampleRate, this.ctx!.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuf;
  }

  private noise(dur: number, freq: number, type: BiquadFilterType, gain = 0.08, sweepTo?: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.getNoiseBuf();
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, now);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, now + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(now);
    src.stop(now + dur);
  }

  private tone(from: number, to: number, dur: number, type: OscillatorType = "square", gain = 0.05) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(now);
    o.stop(now + dur);
  }

  private seq(notes: number[], step = 0.08, dur = 0.14, type: OscillatorType = "sine", gain = 0.06) {
    notes.forEach((f, i) => setTimeout(() => this.tone(f, f, dur, type, gain), i * step * 1000));
  }

  // a touch of pitch jitter each call so a detonating pack of hits doesn't machine-gun one tone
  hit() { this.noise(0.09, 500 * (0.82 + Math.random() * 0.36), "lowpass", 0.12); }
  swing() { this.noise(0.12, 1400 * (0.88 + Math.random() * 0.24), "bandpass", 0.06, 350); }
  arrow() { this.noise(0.07, 2600, "highpass", 0.05, 900); }
  fireball() { this.tone(150, 55, 0.25, "sawtooth", 0.06); this.noise(0.2, 700, "lowpass", 0.04); }
  monsterDie() { this.tone(220 * (0.8 + Math.random() * 0.4), 45, 0.3, "square", 0.05); }
  hurt() { this.tone(110, 70, 0.12, "square", 0.08); }

  pickup() { this.tone(700, 1050, 0.07, "sine", 0.05); }
  gulp() { this.seq([300, 220], 0.09, 0.09, "sine", 0.06); }
  levelup() { this.seq([523, 659, 784, 1046], 0.09, 0.2, "triangle", 0.07); }
  // rain on the moor: a soft hiss that lives outside the ambient bed
  private rainNodes: AudioNode[] = [];
  private rainPending = false;
  setRain(on: boolean) {
    this.rainPending = on;
    if (!this.ctx) return;
    if (!on) {
      this.rainNodes.forEach((n) => {
        try { (n as unknown as { stop?: () => void }).stop?.(); } catch { /* gone */ }
        try { n.disconnect(); } catch { /* gone */ }
      });
      this.rainNodes = [];
      return;
    }
    if (this.rainNodes.length) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuf();
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1600;
    const g = ctx.createGain();
    g.gain.value = 0.012;
    src.connect(hp).connect(g).connect(ctx.destination);
    src.start();
    this.rainNodes.push(src, hp, g);
  }

  // the DING: a bright bell strike, a rising triad, and a long golden shimmer
  ding() {
    this.tone(1568, 1560, 1.4, "sine", 0.1); // the bell itself (G6, slow decay)
    this.tone(2093, 2090, 1.1, "sine", 0.05); // its overtone
    this.seq([523, 659, 784, 1046, 1318], 0.07, 0.16, "triangle", 0.08); // triumphant run
    setTimeout(() => this.tone(3136, 3130, 0.9, "sine", 0.025), 180); // shimmer on top
  }

  whirl() { this.noise(0.35, 400, "bandpass", 0.08, 1100); }
  shout() { this.seq([220, 277, 330], 0.05, 0.35, "triangle", 0.07); }
  zap() { this.noise(0.06, 3200, "highpass", 0.06); this.tone(1400, 300, 0.12, "square", 0.05); }
  teleport() { this.tone(400, 1400, 0.16, "sine", 0.06); }
  dash() { this.noise(0.14, 900, "bandpass", 0.06, 2200); }
  roar() { this.tone(90, 35, 0.8, "sawtooth", 0.1); this.noise(0.6, 250, "lowpass", 0.08); }
  descend() { this.tone(520, 110, 0.7, "triangle", 0.07); this.noise(0.5, 400, "lowpass", 0.04, 120); }
  shrine() { this.seq([784, 1046, 1568], 0.1, 0.3, "triangle", 0.05); }
  squelch() { this.noise(0.18, 300, "lowpass", 0.09, 90); this.tone(160, 90, 0.15, "sine", 0.05); }
  novaWarn() { this.tone(220, 340, 0.5, "sine", 0.05); }
  ice() { this.seq([1568, 1174, 880], 0.05, 0.18, "sine", 0.05); this.noise(0.25, 4000, "highpass", 0.03, 1500); }
  coin() { this.seq([1318, 1760], 0.05, 0.08, "square", 0.04); }
  crit() { this.noise(0.08, 700, "lowpass", 0.13); this.seq([880, 1760], 0.03, 0.09, "square", 0.05); }
  page() { this.noise(0.25, 1800, "bandpass", 0.04, 600); }
  portalCast(durS = 2) { this.tone(180, 720, durS * 0.9, "sine", 0.04); this.noise(durS * 0.8, 900, "bandpass", 0.02, 2600); }
  portalOpen() { this.teleport(); this.tone(320, 80, 0.45, "triangle", 0.06); }

  // the drop-moment sound is the product — escalate by rarity
  drop(rarity: string) {
    switch (rarity) {
      case "magic":
        this.seq([880, 1174]);
        break;
      case "rare":
      case "set":
        this.seq([659, 880, 1318], 0.09, 0.16, "sine", 0.07);
        break;
      case "unique":
      case "legendary":
      case "epic":
        this.tone(180, 55, 0.7, "triangle", 0.09);
        this.seq([1046, 1318, 1568], 0.13, 0.35, "sine", 0.05);
        break;
      default:
        this.noise(0.08, 300, "lowpass", 0.07);
    }
  }
}

// The one synth the whole app shares — the lobby unlocks it on the first click,
// so the game already has a live AudioContext by the time town loads.
export const sfx = new Sfx();
