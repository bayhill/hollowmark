import Phaser from "phaser";
import { GameScene } from "./GameScene";
import { UIScene } from "./UIScene";
import { SERVER_HTTP } from "./config";
import { sfx } from "./sfx";
import { heroPortrait, HeroLook } from "./heroPreview";
import { arcaneOverlay, arcaneHeader, arcanePanel, arcaneButton } from "./arcaneDom";

// a portrait <img> that fills in once the offscreen renderer has drawn the hero
function portraitImg(look: HeroLook, size: number): HTMLImageElement {
  const img = document.createElement("img");
  img.width = size;
  img.height = Math.round(size * 1.31); // portrait aspect (128×168)
  img.style.cssText = `width:${size}px;height:${Math.round(size * 1.31)}px;image-rendering:auto;display:block;`;
  heroPortrait(look).then((src) => { img.src = src; }).catch(() => { /* offline / render failed — no portrait */ });
  return img;
}

// One muted class palette shared by every pre-game screen — class identity is the
// only hue the arcane chrome lets through (the way loot rarity keeps its colour).
const CLASS_COLORS: Record<string, string> = {
  barbarian: "#e07a6a", rogue: "#7fdc9f", sorcerer: "#7aa8e8",
  paladin: "#e8cf7a", necromancer: "#9fceb4", druid: "#cf9a5f",
};

// Browsers won't let audio play before a user gesture — but reaching town always
// means clicking through the lobby first. Unlock the shared synth on that very first
// click (or key), start the lobby's doom-drums, and leave the AudioContext live so the
// town lament begins on its own when town loads. { once } — one and done.
function armAudioUnlock() {
  const opts = { capture: true } as const;
  const unlock = () => {
    // one gesture is enough. Tear down BOTH arming listeners here — they're separate
    // { once } handlers, so if the pointer fired it the keydown stays armed, and the
    // first in-game keypress would re-fire this and restart the lobby drums over the
    // dungeon bed. Removing both is what keeps the lobby theme from leaking into play.
    window.removeEventListener("pointerdown", unlock, opts);
    window.removeEventListener("keydown", unlock, opts);
    sfx.ensure();
    sfx.startLobbyTheme();
  };
  window.addEventListener("pointerdown", unlock, { ...opts, once: true });
  window.addEventListener("keydown", unlock, { ...opts, once: true });
}

// --- character creation: shown once, before the descent begins ---

interface ClassCard {
  cls: string;
  title: string;
  blurb: string;
}

const CLASS_CARDS: ClassCard[] = [
  { cls: "barbarian", title: "Barbarian", blurb: "A mountain of muscle and fury. Crushes skulls at arm's length and roars hard enough to stagger the dead." },
  { cls: "rogue", title: "Rogue", blurb: "A sister of the Sightless Eye. Kills from a distance, dances out of reach, and never misses twice." },
  { cls: "sorcerer", title: "Sorcerer", blurb: "A wielder of the elements. Fragile as parchment, catastrophic as a storm. The floor tends to catch fire." },
  { cls: "paladin", title: "Paladin", blurb: "Faith with a shield attached. Smites, zeals, hurls blessed hammers — and mends the whole party's wounds." },
  { cls: "necromancer", title: "Necromancer", blurb: "Why fight alone? Raises skeletons from the floor, curses flesh to weakness, and breathes poison over rooms." },
  { cls: "druid", title: "Druid", blurb: "Storm and fang. Calls firestorms, volcanoes, and hurricanes — or drops the pretense and becomes the wolf." },
];

function showCreationScreen(): Promise<{ cls: string; name: string; hardcore: boolean }> {
  return new Promise((resolve) => {
    const overlay = arcaneOverlay();

    let chosen = "";
    const cards = new Map<string, HTMLDivElement>();

    const header = arcaneHeader("HOLLOWMARK", "— stay awhile and listen · choose who descends —");

    const panel = arcanePanel({ title: "THE FORGE OF HEROES" });
    panel.style.cssText += "display:flex;flex-direction:column;align-items:center;max-width:720px;";

    const row = document.createElement("div");
    row.style.cssText = "display: flex; gap: 16px; margin: 6px 0 26px; flex-wrap: wrap; justify-content: center;";

    const nameRow = document.createElement("div");
    nameRow.style.cssText = "display: flex; gap: 12px; align-items: center; margin-bottom: 20px;";
    const nameLabel = document.createElement("span");
    nameLabel.textContent = "name:";
    nameLabel.style.cssText = "font-size: 13px; color: #8a8494; letter-spacing: 1px;";
    const nameInput = document.createElement("input");
    nameInput.className = "arc-input";
    nameInput.maxLength = 12;
    nameInput.placeholder = "Pilgrim";
    nameInput.style.width = "190px";
    nameRow.append(nameLabel, nameInput);

    // the vow: one life, no second chances — crimson is a meaning the chrome allows through
    let hardcore = false;
    const hcRow = document.createElement("div");
    hcRow.style.cssText = `
      display: flex; gap: 10px; align-items: center; margin-bottom: 24px; cursor: pointer; user-select: none;
      border: 1px solid #3a2028; border-radius: 3px; padding: 9px 16px; background: #140c10; transition: all .15s;
    `;
    const hcMark = document.createElement("span");
    hcMark.textContent = "☠";
    hcMark.style.cssText = "font-size: 16px; color: #5a3a42;";
    const hcText = document.createElement("span");
    hcText.textContent = "HARDCORE — one life. Death is forever.";
    hcText.style.cssText = "font-size: 12px; color: #8a6a70; letter-spacing: 1px;";
    hcRow.append(hcMark, hcText);
    hcRow.onclick = () => {
      hardcore = !hardcore;
      hcRow.style.borderColor = hardcore ? "#c03848" : "#3a2028";
      hcRow.style.boxShadow = hardcore ? "0 0 22px #c0384833" : "none";
      hcMark.style.color = hardcore ? "#ff4858" : "#5a3a42";
      hcText.style.color = hardcore ? "#e88a96" : "#8a6a70";
      hcText.textContent = hardcore
        ? "HARDCORE SWORN — this hero dies once, and is mourned."
        : "HARDCORE — one life. Death is forever.";
    };

    const button = arcaneButton("ENTER THE DUNGEON", "primary");
    button.disabled = true;
    button.style.fontSize = "15px";
    button.style.padding = "12px 34px";

    for (const card of CLASS_CARDS) {
      const clsColor = CLASS_COLORS[card.cls] ?? "#cfc6d6";
      const el = document.createElement("div");
      el.style.cssText = `
        width: 210px; padding: 16px 15px; cursor: pointer; user-select: none; border-radius: 4px;
        background: linear-gradient(180deg,#161220,#100d18); border: 1px solid rgba(95,88,102,0.5); transition: all .15s;
      `;
      // a living preview of the class, drawn as the in-game hero would look unarmoured
      const portraitWrap = document.createElement("div");
      portraitWrap.style.cssText = "display:flex;justify-content:center;margin-bottom:8px;";
      portraitWrap.appendChild(portraitImg({ cls: card.cls }, 78));
      const title = document.createElement("div");
      title.textContent = card.title.toUpperCase();
      title.style.cssText = `font-size: 16px; font-weight: bold; letter-spacing: 2px; color: ${clsColor}; margin-bottom: 9px; text-align: center;`;
      const blurb = document.createElement("div");
      blurb.textContent = card.blurb;
      blurb.style.cssText = "font-size: 11px; line-height: 1.55; color: #8a8494;";
      el.append(portraitWrap, title, blurb);
      el.onmouseenter = () => { if (chosen !== card.cls) el.style.borderColor = "rgba(154,147,162,0.6)"; };
      el.onmouseleave = () => { if (chosen !== card.cls) el.style.borderColor = "rgba(95,88,102,0.5)"; };
      el.onclick = () => {
        chosen = card.cls;
        cards.forEach((c, cls) => {
          const sel = cls === chosen;
          c.style.borderColor = sel ? "rgba(207,198,214,0.9)" : "rgba(95,88,102,0.5)";
          c.style.boxShadow = sel ? "0 0 22px rgba(154,147,162,0.22)" : "none";
        });
        if (button.disabled) button.disabled = false;
        nameInput.focus();
      };
      cards.set(card.cls, el);
      row.appendChild(el);
    }

    const submit = () => {
      if (!chosen) return;
      resolve({ cls: chosen, name: nameInput.value.trim() || "Pilgrim", hardcore });
      overlay.remove();
    };
    button.onclick = submit;
    nameInput.onkeydown = (e) => {
      if (e.key === "Enter") submit();
      e.stopPropagation(); // don't leak keys into the (future) game
    };

    panel.append(row, nameRow, hcRow, button);
    overlay.append(header, panel);
    document.body.appendChild(overlay);
  });
}

// --- the lobby: find a game, or forge your own ---

function showLobby(): Promise<{ mode: "create"; difficulty: number } | { mode: "join"; roomId: string }> {
  return new Promise((resolve) => {
    const overlay = arcaneOverlay();
    const header = arcaneHeader("HOLLOWMARK", "— join a party, or descend alone —");

    // left: the open games and the forge; right: the Hall of Legends ladder
    const gamesPanel = arcanePanel({ title: "OPEN GAMES" });
    gamesPanel.style.cssText += "display:flex;flex-direction:column;align-items:center;width:480px;";

    const list = document.createElement("div");
    list.className = "arc-scroll";
    list.style.cssText = "width: 100%; max-height: 300px; overflow-y: auto; margin: 4px 0 20px; display: flex; flex-direction: column; gap: 8px;";

    const createBtn = arcaneButton("⚒  FORGE NEW GAME", "primary");
    createBtn.style.width = "100%";

    // THE HALL OF LEGENDS: every hero this server remembers, the fallen in honor
    const hall = arcanePanel({ title: "⚜ HALL OF LEGENDS" });
    hall.style.cssText += "width:300px;align-self:stretch;";
    const hallList = document.createElement("div");
    hallList.className = "arc-scroll";
    hallList.style.cssText = "max-height: 360px; overflow-y: auto; padding-right: 4px;";
    hall.append(hallList);
    const refreshHall = async () => {
      try {
        const res = await fetch(`${SERVER_HTTP}/legends`);
        const legends: any[] = await res.json();
        hallList.innerHTML = "";
        if (!legends.length) {
          hallList.innerHTML = '<div style="font-size:11px;color:#6a6474;font-style:italic;">No legends yet. Be the first.</div>';
          return;
        }
        legends.forEach((l, i) => {
          const row = document.createElement("div");
          row.style.cssText = `display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid rgba(95,88,102,0.35);${l.dead ? "opacity:.6;" : ""}`;
          const left = document.createElement("span");
          left.innerHTML = `<span style="color:#5f5866;">${i + 1}.</span> <span style="color:${l.dead ? "#7a5a60" : CLASS_COLORS[l.cls] ?? "#cfc6d6"};font-weight:bold;">${l.hardcore ? "☠ " : ""}${l.name}</span>`;
          left.style.cssText = "font-size:11px;";
          const right = document.createElement("span");
          const actTag = (a: number, abyss: number) =>
            a >= 5 ? `abyss ${abyss || "?"}` : `act ${["I", "II", "III", "IV"][Math.max(0, Math.min(3, (a || 1) - 1))]}`;
          const diffMark = ["", "", "☠", "☠☠"][l.diffUnlocked ?? 1] ?? "";
          right.textContent = l.dead
            ? `✝ ${l.diedAct >= 5 ? `abyss ${l.diedFloor}` : `act ${l.diedAct || "?"}`}`
            : `${diffMark ? diffMark + " " : ""}${actTag(l.actsUnlocked ?? 1, l.abyssDeepest ?? 0)} · lvl ${l.level}`;
          right.style.cssText = `font-size:10px;color:${l.dead ? "#6a4a50" : "#8a8494"};white-space:nowrap;`;
          row.append(left, right);
          hallList.appendChild(row);
        });
      } catch { /* server napping */ }
    };
    refreshHall();

    let timer = 0;
    const finish = (result: { mode: "create"; difficulty: number } | { mode: "join"; roomId: string }) => {
      window.clearInterval(timer);
      overlay.remove();
      resolve(result);
    };
    // the forge asks how sharp a world you want; the server clamps to what you've earned.
    // difficulty is content, so it keeps its warning colour on pewter chrome.
    const diffRow = document.createElement("div");
    diffRow.style.cssText = "display:flex;gap:8px;margin:12px 0 0;justify-content:center;";
    const DIFF_META = [
      { n: 1, label: "NORMAL", color: "#8fbf9f", hint: "the world as it is" },
      { n: 2, label: "NIGHTMARE", color: "#c9a04a", hint: "−40 all res · deeper danger · richer mythics" },
      { n: 3, label: "HELL", color: "#c0504a", hint: "−100 all res · the world at its cruelest · mythics abound" },
    ];
    let chosenDiff = 1;
    const diffBtns: HTMLButtonElement[] = [];
    for (const d of DIFF_META) {
      const b = document.createElement("button");
      b.textContent = d.label;
      b.title = d.hint;
      const style = (sel: boolean) =>
        `font-family:monospace;font-size:11px;letter-spacing:1px;padding:6px 12px;cursor:pointer;border-radius:3px;background:${sel ? "#1c1726" : "#120f1a"};color:${d.color};border:1px solid ${sel ? "rgba(207,198,214,0.75)" : "rgba(95,88,102,0.5)"};transition:all .15s;`;
      b.style.cssText = style(d.n === 1);
      b.onclick = () => {
        chosenDiff = d.n;
        diffBtns.forEach((bb, i) => (bb.style.cssText = ((sel: boolean) =>
          `font-family:monospace;font-size:11px;letter-spacing:1px;padding:6px 12px;cursor:pointer;border-radius:3px;background:${sel ? "#1c1726" : "#120f1a"};color:${DIFF_META[i].color};border:1px solid ${sel ? "rgba(207,198,214,0.75)" : "rgba(95,88,102,0.5)"};transition:all .15s;`)(DIFF_META[i].n === d.n)));
      };
      diffBtns.push(b);
      diffRow.append(b);
    }
    const diffHint = document.createElement("div");
    diffHint.textContent = "sharper worlds must be earned — Uldrath's fall unlocks the next";
    diffHint.style.cssText = "font-size:10px;color:#6a6474;font-style:italic;margin-top:6px;text-align:center;";
    createBtn.onclick = () => finish({ mode: "create", difficulty: chosenDiff });

    const refresh = async () => {
      let rooms: Array<{ roomId: string; clients: number; maxClients: number; metadata?: any }> = [];
      try {
        const res = await fetch(`${SERVER_HTTP}/rooms`);
        rooms = await res.json();
      } catch {
        /* server napping — the list just stays empty */
      }
      list.innerHTML = "";
      if (rooms.length === 0) {
        const empty = document.createElement("div");
        empty.className = "arc-empty";
        empty.textContent = "No open games. Forge one — the dungeon is patient.";
        list.appendChild(empty);
        return;
      }
      for (const room of rooms) {
        const row = document.createElement("div");
        row.className = "arc-row";
        const info = document.createElement("div");
        const zone = room.metadata?.zoneName ?? "The Mournfield";
        const floor = room.metadata?.floor ?? 1;
        const act = room.metadata?.act ?? 1;
        const diffNames = ["", "", "☠ NIGHTMARE · ", "☠☠ HELL · "];
        const diffTag = diffNames[room.metadata?.difficulty ?? 1] ?? "";
        const where = `${diffTag}${act >= 5 ? `Abyss ${floor}` : `Act ${["I", "II", "III", "IV"][act - 1] ?? act} · floor ${floor}`}`;
        info.innerHTML = `<div style="font-size:13px;color:#cfc6d6;">${where} — ${zone}</div>
          <div style="font-size:10px;color:#8a8494;">${room.clients}/${room.maxClients} heroes · game ${room.roomId.slice(0, 6)}</div>`;
        const full = room.clients >= room.maxClients;
        const join = arcaneButton(full ? "FULL" : "JOIN", full ? undefined : "primary");
        join.disabled = full;
        join.style.fontSize = "12px";
        join.style.padding = "8px 18px";
        join.onclick = () => finish({ mode: "join", roomId: room.roomId });
        row.append(info, join);
        list.appendChild(row);
      }
    };
    refresh();
    timer = window.setInterval(refresh, 3000);

    gamesPanel.append(list, createBtn, diffRow, diffHint);

    const columns = document.createElement("div");
    columns.style.cssText = "display:flex;gap:26px;align-items:stretch;";
    columns.append(gamesPanel, hall);
    overlay.append(header, columns);
    document.body.appendChild(overlay);
  });
}

// --- the hero roster: this browser can own many characters ---

interface RosterEntry {
  key: string;
  name: string;
  cls: string;
}

function newKey(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `k${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function loadRoster(): RosterEntry[] {
  try {
    const r = JSON.parse(localStorage.getItem("arpg_roster") ?? "[]");
    if (Array.isArray(r)) return r.filter((e) => e && typeof e.key === "string");
  } catch { /* corrupted — start over */ }
  return [];
}

function saveRoster(r: RosterEntry[]) {
  localStorage.setItem("arpg_roster", JSON.stringify(r));
}

// heroes forged before the roster era live under the old single key
function migrateRoster(): RosterEntry[] {
  const roster = loadRoster();
  const legacy = localStorage.getItem("arpg_key");
  if (legacy && !roster.some((e) => e.key === legacy)) {
    roster.unshift({ key: legacy, name: "", cls: "" });
    saveRoster(roster);
  }
  return roster;
}

// pick who enters: an owned hero, a fresh one, or (when joining) a random one
function showHeroSelect(
  mode: "create" | "join"
): Promise<{ key: string; isNew?: { cls: string; name: string; hardcore?: boolean }; randomize?: boolean }> {
  return new Promise(async (resolve) => {
    let roster = migrateRoster();

    // a browser with no heroes goes straight to the forge
    if (roster.length === 0 && mode === "create") {
      const { cls, name, hardcore } = await showCreationScreen();
      const key = newKey();
      roster.push({ key, name, cls });
      saveRoster(roster);
      resolve({ key, isNew: { cls, name, hardcore } });
      return;
    }

    const overlay = arcaneOverlay();
    const finish = (result: { key: string; isNew?: { cls: string; name: string; hardcore?: boolean }; randomize?: boolean }) => {
      overlay.remove();
      resolve(result);
    };

    const header = arcaneHeader("CHOOSE YOUR HERO", "— every soul this browser has forged —");
    const panel = arcanePanel({ title: "THE ROSTER" });
    panel.style.cssText += "display:flex;flex-direction:column;align-items:center;width:460px;";

    const list = document.createElement("div");
    list.className = "arc-scroll";
    list.style.cssText = "width: 100%; max-height: 300px; overflow-y: auto; margin: 4px 0 18px; display: flex; flex-direction: column; gap: 8px;";

    // live details from the server (level, class, depth)
    let details: any[] = [];
    if (roster.length) {
      try {
        const res = await fetch(`${SERVER_HTTP}/heroes?keys=${roster.map((e) => e.key).join(",")}`);
        details = await res.json();
      } catch { /* offline — local names only */ }
    }

    for (const entry of roster) {
      const d = details.find((x) => x.key === entry.key);
      const name = d?.name || entry.name || "Unnamed";
      const cls = d?.cls || entry.cls || "?";
      const dead = !!d?.dead;
      const hc = !!d?.hardcore;
      const actWord = (a: number) => (a >= 5 ? "the Abyss" : `Act ${["I", "II", "III", "IV"][Math.max(0, Math.min(3, (a || 1) - 1))]}`);
      const sub = dead
        ? `✝ fell forever${d.diedAct ? ` in ${actWord(d.diedAct)}` : ""}${d.diedTo ? ` — slain by ${d.diedTo}` : ""}`
        : d && d.level > 0
          ? `${hc ? "☠ hardcore · " : ""}level ${d.level} ${cls} · ${actWord(d.actsUnlocked ?? 1)}${(d.diffUnlocked ?? 1) > 1 ? ` · ${["", "", "Nightmare", "Hell"][d.diffUnlocked]} earned` : ""}${(d.abyssDeepest ?? 0) > 0 ? ` · abyss ${d.abyssDeepest}` : ""}`
          : `${hc ? "☠ hardcore · " : ""}${cls} — has not yet descended`;
      const row = document.createElement("div");
      row.className = "arc-row";
      if (dead) { row.style.opacity = ".62"; row.style.borderColor = "rgba(74,32,40,0.7)"; }
      else if (hc) { row.style.borderColor = "rgba(74,32,40,0.8)"; }
      const info = document.createElement("div");
      info.innerHTML = `<div style="font-size:14px;font-weight:bold;color:${dead ? "#6a5a5e" : CLASS_COLORS[cls] ?? "#cfc6d6"};">${hc ? "☠ " : ""}${name}</div>
        <div style="font-size:10px;color:${dead ? "#7a5a60" : "#8a8494"};">${sub}</div>`;
      // the hero exactly as they look in the dungeon — their gear if the server knows it, else the bare class
      const look: HeroLook = d?.appearance?.cls ? d.appearance : { cls };
      const portrait = portraitImg(look, 44);
      if (dead) portrait.style.filter = "grayscale(1) brightness(0.6)";
      const left = document.createElement("div");
      left.style.cssText = "display:flex;align-items:center;gap:12px;min-width:0;";
      left.append(portrait, info);
      row.appendChild(left);
      if (!dead) {
        const enter = arcaneButton("ENTER", "primary");
        enter.style.fontSize = "12px";
        enter.style.padding = "8px 18px";
        enter.onclick = () => finish({ key: entry.key });
        row.appendChild(enter);
      } else {
        const rip = document.createElement("span");
        rip.textContent = "AT REST";
        rip.style.cssText = "font-size: 10px; color: #6a4a50; letter-spacing: 2px;";
        row.appendChild(rip);
      }
      list.appendChild(row);
    }

    const buttons = document.createElement("div");
    buttons.style.cssText = "display: flex; gap: 12px;";

    const newBtn = arcaneButton("★  NEW HERO", "primary");
    newBtn.onclick = async () => {
      overlay.remove();
      const { cls, name, hardcore } = await showCreationScreen();
      const key = newKey();
      roster.push({ key, name, cls });
      saveRoster(roster);
      resolve({ key, isNew: { cls, name, hardcore } });
    };
    buttons.appendChild(newBtn);

    if (mode === "join") {
      const randBtn = arcaneButton("⚄  RANDOM HERO");
      randBtn.title = "Forged at the party's level, geared for this depth";
      randBtn.onclick = () => {
        const key = newKey();
        const cls = ["barbarian", "rogue", "sorcerer", "paladin", "necromancer", "druid"][Math.floor(Math.random() * 6)];
        roster.push({ key, name: "", cls });
        saveRoster(roster);
        finish({ key, isNew: { cls, name: "" }, randomize: true });
      };
      buttons.appendChild(randBtn);
      const hint = document.createElement("div");
      hint.textContent = "random: matched to the party's level, gear rolled for this depth";
      hint.style.cssText = "font-size: 10px; color: #6a6474; margin-top: 14px;";
      panel.append(list, buttons, hint);
    } else {
      panel.append(list, buttons);
    }

    overlay.append(header, panel);
    document.body.appendChild(overlay);
  });
}

function showLoading() {
  const overlay = arcaneOverlay();
  overlay.id = "arpg-loading";
  overlay.style.zIndex = "999";
  const txt = document.createElement("div");
  txt.textContent = "Descending into Hollowmere…";
  txt.style.cssText = "font-size: 18px; letter-spacing: 3px; color: #cfc6d6; animation: arpgpulse 1.2s ease-in-out infinite;";
  const runes = document.createElement("div");
  runes.textContent = "ᚨ ᚱ ᚾ ᛞ ᛟ ᚦ ᛝ ᛥ";
  runes.style.cssText = "font-size: 13px; letter-spacing: 8px; color: rgba(154,147,162,0.4); margin-top: 18px;";
  const style = document.createElement("style");
  style.textContent = "@keyframes arpgpulse { 0%,100% { opacity: .45 } 50% { opacity: 1 } }";
  overlay.append(style, txt, runes);
  document.body.appendChild(overlay);
}

async function boot() {
  armAudioUnlock(); // the lobby's first click wakes the audio, before town ever loads

  // pick your game, then who walks into it
  const intent = await showLobby();
  (window as any).__arpgIntent = intent;

  const choice = await showHeroSelect(intent.mode);
  localStorage.setItem("arpg_key", choice.key); // the active hero
  if (choice.isNew) localStorage.setItem("arpg_new", JSON.stringify(choice.isNew));
  if (choice.randomize) localStorage.setItem("arpg_random", "1");

  sfx.stopLobbyTheme(); // the drums recede; the descent begins
  showLoading();

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: "app",
    backgroundColor: "#0e0e13",
    disableContextMenu: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    scene: [GameScene, UIScene],
  });
}

boot();
