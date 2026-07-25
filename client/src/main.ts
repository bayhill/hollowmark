import Phaser from "phaser";
import { GameScene } from "./GameScene";
import { UIScene } from "./UIScene";
import { SERVER_HTTP } from "./config";
import { sfx } from "./sfx";
import { heroPortrait, createHeroStage, HeroLook, HeroStage } from "./heroPreview";
import { arcaneOverlay, arcaneHeader, arcanePanel, arcaneButton } from "./arcaneDom";
import {
  ATTRS, ATTR_LABELS, CLASS_ATTACKS, CLASS_BASE_ATTRS, CLASS_OFFENSIVE_ATTR,
  BASE_ITEMS, RARITY_ORDER, RARITY_COLORS, SKILL_TREES, type ClassName,
} from "@hollowmark/common";

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

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
  cls: ClassName;
  title: string;
  epithet: string;
  blurb: string;
}

const CLASS_CARDS: ClassCard[] = [
  { cls: "barbarian", title: "Barbarian", epithet: "of the Highland Clans", blurb: "A mountain of muscle and fury. Crushes skulls at arm's length and roars hard enough to stagger the dead." },
  { cls: "rogue", title: "Rogue", epithet: "sister of the Sightless Eye", blurb: "A sister of the Sightless Eye. Kills from a distance, dances out of reach, and never misses twice." },
  { cls: "sorcerer", title: "Sorcerer", epithet: "of the Vizjerei spires", blurb: "A wielder of the elements. Fragile as parchment, catastrophic as a storm. The floor tends to catch fire." },
  { cls: "paladin", title: "Paladin", epithet: "sworn to the Silver Light", blurb: "Faith with a shield attached. Smites, zeals, hurls blessed hammers — and mends the whole party's wounds." },
  { cls: "necromancer", title: "Necromancer", epithet: "of the Priests of Rathma", blurb: "Why fight alone? Raises skeletons from the floor, curses flesh to weakness, and breathes poison over rooms." },
  { cls: "druid", title: "Druid", epithet: "of the Scosglen wilds", blurb: "Storm and fang. Calls firestorms, volcanoes, and hurricanes — or drops the pretense and becomes the wolf." },
];

// --- shared furniture for the two "who descends" screens ---

// The centrepiece: a live hero standing on a lit dais, with a nameplate beneath.
// The caller owns the returned stage and MUST destroy() it when the screen closes.
function heroStagePanel(title: string): {
  panel: HTMLDivElement; stage: HeroStage; nameEl: HTMLDivElement; subEl: HTMLDivElement;
} {
  const panel = arcanePanel({ title });
  panel.style.cssText += "display:flex;flex-direction:column;align-items:center;width:336px;flex:0 0 auto;";

  const mount = document.createElement("div");
  mount.style.cssText = "margin:4px 0 0;";
  panel.appendChild(mount);
  const stage = createHeroStage(mount, { width: 300, height: 400 });

  const nameEl = document.createElement("div");
  nameEl.style.cssText = "font-size:22px;font-weight:bold;letter-spacing:4px;color:#cfc6d6;text-align:center;margin-top:10px;min-height:26px;text-shadow:0 0 18px rgba(154,147,162,0.35);";
  const subEl = document.createElement("div");
  subEl.style.cssText = "font-size:11px;color:#8a8494;font-style:italic;letter-spacing:1px;text-align:center;margin-top:5px;min-height:15px;";
  const hint = document.createElement("div");
  hint.textContent = "⟲  drag the hero to turn";
  hint.style.cssText = "font-size:9px;color:#5f5866;letter-spacing:2px;margin-top:12px;";
  panel.append(nameEl, subEl, hint);
  return { panel, stage, nameEl, subEl };
}

// One selectable row: thumbnail, a bright title line, a dim detail line. Selection state
// is driven by the caller through the returned setter, so both screens highlight alike.
function pickRow(look: HeroLook, title: string, sub: string, color: string, thumb = 40): {
  el: HTMLDivElement; setSelected: (on: boolean) => void;
} {
  const el = document.createElement("div");
  el.style.cssText = `
    display:flex;align-items:center;gap:11px;padding:8px 11px;border-radius:3px;cursor:pointer;user-select:none;
    background:linear-gradient(180deg,#161220,#100d18);border:1px solid rgba(95,88,102,0.5);transition:all .15s;
  `;
  el.appendChild(portraitImg(look, thumb));
  const text = document.createElement("div");
  text.style.cssText = "min-width:0;flex:1;";
  text.innerHTML = `<div style="font-size:13px;font-weight:bold;letter-spacing:1px;color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${title}</div>
    <div style="font-size:10px;color:#8a8494;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sub}</div>`;
  el.appendChild(text);

  let selected = false;
  const paint = () => {
    el.style.borderColor = selected ? "rgba(207,198,214,0.9)" : "rgba(95,88,102,0.5)";
    el.style.boxShadow = selected ? "0 0 18px rgba(154,147,162,0.2), inset 0 0 14px rgba(154,147,162,0.06)" : "none";
    el.style.background = selected ? "linear-gradient(180deg,#221c30,#151120)" : "linear-gradient(180deg,#161220,#100d18)";
  };
  el.onmouseenter = () => { if (!selected) el.style.borderColor = "rgba(154,147,162,0.6)"; };
  el.onmouseleave = paint;
  paint();
  return { el, setSelected: (on) => { selected = on; paint(); } };
}

// A labelled stat bar — the attribute readout on the forge screen.
function statBar(label: string, value: number, max: number, color: string): HTMLDivElement {
  const row = document.createElement("div");
  row.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:6px;";
  const name = document.createElement("span");
  name.textContent = label;
  name.style.cssText = "font-size:10px;color:#8a8494;letter-spacing:1px;width:66px;";
  const track = document.createElement("div");
  track.style.cssText = "flex:1;height:6px;background:#0c0a12;border:1px solid rgba(95,88,102,0.5);border-radius:2px;overflow:hidden;";
  const fill = document.createElement("div");
  fill.style.cssText = `height:100%;width:${Math.round((value / max) * 100)}%;background:${color};opacity:.85;`;
  track.appendChild(fill);
  const num = document.createElement("span");
  num.textContent = String(value);
  num.style.cssText = `font-size:11px;color:${color};width:20px;text-align:right;`;
  row.append(name, track, num);
  return row;
}

function showCreationScreen(): Promise<{ cls: string; name: string; hardcore: boolean }> {
  return new Promise((resolve) => {
    const overlay = arcaneOverlay();
    const header = arcaneHeader("THE FORGE OF HEROES", "— stay awhile and listen · choose who descends —");

    // three columns: who you could be · who you are · what that means
    const { panel: stagePanel, stage, nameEl, subEl } = heroStagePanel("THE VESSEL");

    const listPanel = arcanePanel({ title: "BLOODLINES" });
    listPanel.style.cssText += "display:flex;flex-direction:column;gap:7px;width:250px;align-self:stretch;flex:0 0 auto;";

    const detail = arcanePanel({ title: "THE CALLING" });
    detail.style.cssText += "display:flex;flex-direction:column;width:300px;align-self:stretch;flex:0 0 auto;";

    const blurb = document.createElement("div");
    blurb.style.cssText = "font-size:11.5px;line-height:1.6;color:#8a8494;min-height:74px;margin-top:4px;";
    const attrsWrap = document.createElement("div");
    attrsWrap.style.cssText = "margin:14px 0 4px;";
    const attackLine = document.createElement("div");
    attackLine.style.cssText = "font-size:10px;color:#6a6474;letter-spacing:1px;margin-bottom:14px;min-height:14px;";
    const pathsLine = document.createElement("div");
    pathsLine.style.cssText = "font-size:10px;letter-spacing:2px;color:#5f5866;border-bottom:1px solid rgba(95,88,102,0.4);padding-bottom:5px;margin-bottom:8px;";
    const skillsWrap = document.createElement("div");
    skillsWrap.style.cssText = "margin-bottom:16px;";

    const nameRow = document.createElement("div");
    nameRow.style.cssText = "display:flex;gap:10px;align-items:center;margin-bottom:14px;";
    const nameLabel = document.createElement("span");
    nameLabel.textContent = "name:";
    nameLabel.style.cssText = "font-size:12px;color:#8a8494;letter-spacing:1px;";
    const nameInput = document.createElement("input");
    nameInput.className = "arc-input";
    nameInput.maxLength = 12;
    nameInput.placeholder = "Pilgrim";
    nameInput.style.cssText += "flex:1;min-width:0;font-size:14px;";
    nameRow.append(nameLabel, nameInput);

    // the vow: one life, no second chances — crimson is a meaning the chrome allows through
    let hardcore = false;
    const hcRow = document.createElement("div");
    hcRow.style.cssText = `
      display: flex; gap: 10px; align-items: center; margin-bottom: 16px; cursor: pointer; user-select: none;
      border: 1px solid #3a2028; border-radius: 3px; padding: 9px 12px; background: #140c10; transition: all .15s;
    `;
    const hcMark = document.createElement("span");
    hcMark.textContent = "☠";
    hcMark.style.cssText = "font-size: 16px; color: #5a3a42;";
    const hcText = document.createElement("span");
    hcText.textContent = "HARDCORE — one life. Death is forever.";
    hcText.style.cssText = "font-size: 11px; color: #8a6a70; letter-spacing: 1px; line-height:1.4;";
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
    button.style.cssText += "font-size:14px;padding:12px 20px;margin-top:auto;";

    // the class list, and the selection that drives the stage and the calling
    const rows = new Map<string, { setSelected: (on: boolean) => void }>();
    let chosen: ClassName = CLASS_CARDS[0].cls;

    const select = (card: ClassCard) => {
      chosen = card.cls;
      rows.forEach((r, cls) => r.setSelected(cls === card.cls));
      const color = CLASS_COLORS[card.cls] ?? "#cfc6d6";
      stage.setLook({ cls: card.cls });
      nameEl.textContent = card.title.toUpperCase();
      nameEl.style.color = color;
      subEl.textContent = card.epithet;
      blurb.textContent = card.blurb;

      const attrs = CLASS_BASE_ATTRS[card.cls];
      const signature = CLASS_OFFENSIVE_ATTR[card.cls];
      attrsWrap.innerHTML = "";
      for (const a of ATTRS)
        attrsWrap.appendChild(statBar(ATTR_LABELS[a], attrs[a], 40, a === signature ? color : "#6a6474"));

      const atk = CLASS_ATTACKS[card.cls];
      attackLine.textContent = atk.type === "melee"
        ? `melee · ${atk.dmg[0]}–${atk.dmg[1]} damage · ${atk.arcDeg}° arc`
        : `${atk.kind} · ${atk.dmg[0]}–${atk.dmg[1]} damage · at range`;

      // the three paths this class can walk, and the first skills off them
      const tree = SKILL_TREES[card.cls] ?? [];
      const paths = [...new Set(tree.map((n) => n.tree))];
      pathsLine.textContent = paths.join("  ·  ").toUpperCase();
      skillsWrap.innerHTML = "";
      for (const node of tree.filter((n) => n.tier === 1 && n.type === "active").slice(0, 3)) {
        const s = document.createElement("div");
        s.style.cssText = "font-size:10.5px;line-height:1.45;margin-bottom:5px;";
        s.innerHTML = `<span style="color:${color};">${node.name}</span> <span style="color:#6a6474;">— ${node.desc.toLowerCase()}</span>`;
        skillsWrap.appendChild(s);
      }
    };

    for (const card of CLASS_CARDS) {
      const color = CLASS_COLORS[card.cls] ?? "#cfc6d6";
      const row = pickRow({ cls: card.cls }, card.title.toUpperCase(), card.epithet, color, 38);
      row.el.onclick = () => { select(card); nameInput.focus(); };
      rows.set(card.cls, row);
      listPanel.appendChild(row.el);
    }

    const submit = () => {
      resolve({ cls: chosen, name: nameInput.value.trim() || "Pilgrim", hardcore });
      stage.destroy();
      overlay.remove();
    };
    button.onclick = submit;
    nameInput.onkeydown = (e) => {
      if (e.key === "Enter") submit();
      e.stopPropagation(); // don't leak keys into the (future) game
    };

    detail.append(blurb, attrsWrap, attackLine, pathsLine, skillsWrap, nameRow, hcRow, button);

    const columns = document.createElement("div");
    columns.style.cssText = "display:flex;gap:22px;align-items:stretch;justify-content:center;flex-wrap:wrap;";
    columns.append(listPanel, stagePanel, detail);
    overlay.append(header, columns);
    document.body.appendChild(overlay);

    select(CLASS_CARDS[0]); // nobody should meet an empty dais
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
    const { panel: stagePanel, stage, nameEl, subEl } = heroStagePanel("THE CHOSEN");
    const finish = (result: { key: string; isNew?: { cls: string; name: string; hardcore?: boolean }; randomize?: boolean }) => {
      stage.destroy();
      overlay.remove();
      resolve(result);
    };

    const header = arcaneHeader("CHOOSE YOUR HERO", "— every soul this browser has forged —");

    const listPanel = arcanePanel({ title: "THE ROSTER" });
    listPanel.style.cssText += "display:flex;flex-direction:column;width:290px;align-self:stretch;flex:0 0 auto;";

    const list = document.createElement("div");
    list.className = "arc-scroll";
    list.style.cssText = "width:100%;max-height:352px;overflow-y:auto;margin:4px 0 16px;display:flex;flex-direction:column;gap:7px;padding-right:3px;";

    const detail = arcanePanel({ title: "THE RECKONING" });
    detail.style.cssText += "display:flex;flex-direction:column;width:300px;align-self:stretch;flex:0 0 auto;";
    const progress = document.createElement("div");
    progress.style.cssText = "margin-top:4px;";
    const gearTitle = document.createElement("div");
    gearTitle.textContent = "WORN INTO THE DARK";
    gearTitle.style.cssText = "font-size:10px;letter-spacing:2px;color:#5f5866;margin:18px 0 8px;border-bottom:1px solid rgba(95,88,102,0.4);padding-bottom:5px;";
    const gearList = document.createElement("div");
    const enterBtn = arcaneButton("ENTER THE DUNGEON", "primary");
    enterBtn.style.cssText += "font-size:14px;padding:12px 20px;margin-top:auto;";
    detail.append(progress, gearTitle, gearList, enterBtn);

    // live details from the server (level, class, depth, the gear they're standing in)
    let details: any[] = [];
    if (roster.length) {
      try {
        const res = await fetch(`${SERVER_HTTP}/heroes?keys=${roster.map((e) => e.key).join(",")}`);
        details = await res.json();
      } catch { /* offline — local names only */ }
    }

    const actWord = (a: number) => (a >= 5 ? "the Abyss" : `Act ${["I", "II", "III", "IV"][Math.max(0, Math.min(3, (a || 1) - 1))]}`);
    const line = (label: string, value: string, color = "#cfc6d6") => {
      const r = document.createElement("div");
      r.style.cssText = "display:flex;justify-content:space-between;gap:10px;font-size:11px;padding:4px 0;border-bottom:1px solid rgba(95,88,102,0.28);";
      r.innerHTML = `<span style="color:#6a6474;letter-spacing:1px;">${label}</span><span style="color:${color};text-align:right;">${value}</span>`;
      return r;
    };

    const rows = new Map<string, { setSelected: (on: boolean) => void }>();
    let chosenKey = "";

    const select = (entry: RosterEntry) => {
      chosenKey = entry.key;
      rows.forEach((r, k) => r.setSelected(k === entry.key));
      const d = details.find((x) => x.key === entry.key);
      const name = d?.name || entry.name || "Unnamed";
      const cls = d?.cls || entry.cls || "?";
      const dead = !!d?.dead;
      const hc = !!d?.hardcore;
      const color = dead ? "#7a5a60" : CLASS_COLORS[cls] ?? "#cfc6d6";

      // the hero exactly as they look in the dungeon — their gear if the server knows it
      const look: HeroLook = d?.appearance?.cls ? d.appearance : { cls };
      stage.setLook(look);
      stage.el.style.filter = dead ? "grayscale(0.85) brightness(0.62)" : "none";
      nameEl.textContent = `${hc ? "☠ " : ""}${name}`;
      nameEl.style.color = color;
      subEl.textContent = dead
        ? `✝ fell forever${d.diedAct ? ` in ${actWord(d.diedAct)}` : ""}${d.diedTo ? ` — slain by ${d.diedTo}` : ""}`
        : d && d.level > 0
          ? `level ${d.level} ${cls}${hc ? " · sworn to one life" : ""}`
          : `${cls} — has not yet descended`;

      progress.innerHTML = "";
      progress.appendChild(line("CLASS", cls.charAt(0).toUpperCase() + cls.slice(1), color));
      progress.appendChild(line("LEVEL", d?.level ? String(d.level) : "—"));
      progress.appendChild(line("REACHED", d ? actWord(d.actsUnlocked ?? 1) : "—"));
      if ((d?.diffUnlocked ?? 1) > 1)
        progress.appendChild(line("EARNED", `${["", "", "Nightmare", "Hell"][d.diffUnlocked]}`, "#c9a04a"));
      if ((d?.abyssDeepest ?? 0) > 0) progress.appendChild(line("ABYSS", `depth ${d.abyssDeepest}`, "#b048d8"));
      if (dead) progress.appendChild(line("STATE", "at rest", "#c0504a"));
      else if (hc) progress.appendChild(line("VOW", "hardcore", "#e88a96"));

      // what they're wearing, slot by slot — the "all the visuals" made legible
      const SLOTS: Array<[keyof HeroLook, string]> = [
        ["weaponBase", "weapon"], ["offhandBase", "offhand"], ["helmBase", "helm"],
        ["chestBase", "chest"], ["beltBase", "belt"], ["bootsBase", "boots"],
      ];
      gearList.innerHTML = "";
      let anyGear = false;
      for (const [field, label] of SLOTS) {
        const base = look[field] as string | undefined;
        if (base) anyGear = true;
        const shown = base ? BASE_ITEMS[base]?.name ?? base : "—";
        gearList.appendChild(line(label.toUpperCase(), shown, base ? "#cfc6d6" : "#4a4552"));
      }
      const tier = look.gearTier ?? 0;
      if (tier > 0) {
        const rarity = RARITY_ORDER[tier];
        gearList.appendChild(line("FINEST", rarity, hex(RARITY_COLORS[rarity] ?? 0xcfc6d6)));
      } else if (!anyGear) {
        const bare = document.createElement("div");
        bare.textContent = "unequipped — the dungeon will provide";
        bare.style.cssText = "font-size:10px;color:#5f5866;font-style:italic;margin-top:8px;";
        gearList.appendChild(bare);
      }

      enterBtn.disabled = dead;
      enterBtn.textContent = dead ? "AT REST" : "ENTER THE DUNGEON";
    };

    for (const entry of roster) {
      const d = details.find((x) => x.key === entry.key);
      const name = d?.name || entry.name || "Unnamed";
      const cls = d?.cls || entry.cls || "?";
      const dead = !!d?.dead;
      const hc = !!d?.hardcore;
      const sub = dead
        ? `✝ fell in ${d.diedAct ? actWord(d.diedAct) : "the dark"}`
        : d && d.level > 0
          ? `level ${d.level} ${cls} · ${actWord(d.actsUnlocked ?? 1)}`
          : `${cls} — not yet descended`;
      const look: HeroLook = d?.appearance?.cls ? d.appearance : { cls };
      const row = pickRow(look, `${hc ? "☠ " : ""}${name}`, sub, dead ? "#6a5a5e" : CLASS_COLORS[cls] ?? "#cfc6d6", 38);
      if (dead) { row.el.style.opacity = ".66"; row.el.querySelector("img")!.style.filter = "grayscale(1) brightness(0.6)"; }
      row.el.onclick = () => select(entry);
      row.el.ondblclick = () => { if (!d?.dead) finish({ key: entry.key }); };
      rows.set(entry.key, row);
      list.appendChild(row.el);
    }
    enterBtn.onclick = () => { if (chosenKey) finish({ key: chosenKey }); };

    const buttons = document.createElement("div");
    buttons.style.cssText = "display:flex;gap:10px;";

    const newBtn = arcaneButton("★  NEW HERO", "primary");
    newBtn.style.cssText += "flex:1;font-size:12px;padding:10px 12px;";
    newBtn.onclick = async () => {
      stage.destroy();
      overlay.remove();
      const { cls, name, hardcore } = await showCreationScreen();
      const key = newKey();
      roster.push({ key, name, cls });
      saveRoster(roster);
      resolve({ key, isNew: { cls, name, hardcore } });
    };
    buttons.appendChild(newBtn);

    listPanel.append(list, buttons);
    if (mode === "join") {
      const randBtn = arcaneButton("⚄  RANDOM");
      randBtn.title = "Forged at the party's level, geared for this depth";
      randBtn.style.cssText += "font-size:12px;padding:10px 12px;";
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
      hint.style.cssText = "font-size:10px;color:#6a6474;margin-top:12px;line-height:1.5;";
      listPanel.append(hint);
    }

    const columns = document.createElement("div");
    columns.style.cssText = "display:flex;gap:22px;align-items:stretch;justify-content:center;flex-wrap:wrap;";
    columns.append(listPanel, stagePanel, detail);
    overlay.append(header, columns);
    document.body.appendChild(overlay);

    // open on whoever descended last, the way a roster should remember you
    const lastKey = localStorage.getItem("arpg_key");
    const opening = roster.find((e) => e.key === lastKey) ?? roster[0];
    if (opening) {
      select(opening);
    } else {
      // a browser joining someone else's game with nobody forged yet — an empty dais
      const empty = document.createElement("div");
      empty.className = "arc-empty";
      empty.textContent = "No heroes yet. Forge one — the dungeon is patient.";
      list.appendChild(empty);
      stage.setLook(null);
      nameEl.textContent = "—";
      subEl.textContent = "the dais stands empty";
      progress.appendChild(line("ROSTER", "empty", "#6a6474"));
      enterBtn.disabled = true;
    }
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
