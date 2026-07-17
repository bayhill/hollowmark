import Phaser from "phaser";
import { GameScene } from "./GameScene";
import { UIScene } from "./UIScene";
import { SERVER_HTTP } from "./config";

// --- character creation: shown once, before the descent begins ---

interface ClassCard {
  cls: string;
  title: string;
  blurb: string;
  color: string;
}

const CLASS_CARDS: ClassCard[] = [
  { cls: "barbarian", title: "Barbarian", blurb: "A mountain of muscle and fury. Crushes skulls at arm's length and roars hard enough to stagger the dead.", color: "#c0392b" },
  { cls: "rogue", title: "Rogue", blurb: "A sister of the Sightless Eye. Kills from a distance, dances out of reach, and never misses twice.", color: "#27ae60" },
  { cls: "sorcerer", title: "Sorcerer", blurb: "A wielder of the elements. Fragile as parchment, catastrophic as a storm. The floor tends to catch fire.", color: "#2f80c9" },
  { cls: "paladin", title: "Paladin", blurb: "Faith with a shield attached. Smites, zeals, hurls blessed hammers — and mends the whole party's wounds.", color: "#c9a227" },
  { cls: "necromancer", title: "Necromancer", blurb: "Why fight alone? Raises skeletons from the floor, curses flesh to weakness, and breathes poison over rooms.", color: "#6a8f7a" },
  { cls: "druid", title: "Druid", blurb: "Storm and fang. Calls firestorms, volcanoes, and hurricanes — or drops the pretense and becomes the wolf.", color: "#9a6a3a" },
];

function showCreationScreen(): Promise<{ cls: string; name: string; hardcore: boolean }> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 1000;
      background: radial-gradient(ellipse at center, #16121e 0%, #0a0810 75%);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      font-family: monospace; color: #c9c9d4;
    `;

    let chosen = "";
    const cards = new Map<string, HTMLDivElement>();

    const h1 = document.createElement("div");
    h1.textContent = "HOLLOWMARK";
    h1.style.cssText = "font-size: 26px; letter-spacing: 6px; color: #e8d8a8; margin-bottom: 6px; text-shadow: 0 0 18px #d8b13a44;";
    const h2 = document.createElement("div");
    h2.textContent = "— stay awhile and listen · choose who descends —";
    h2.style.cssText = "font-size: 12px; color: #8a8a96; margin-bottom: 34px; font-style: italic;";

    const row = document.createElement("div");
    row.style.cssText = "display: flex; gap: 18px; margin-bottom: 30px; flex-wrap: wrap; justify-content: center;";

    const nameRow = document.createElement("div");
    nameRow.style.cssText = "display: flex; gap: 12px; align-items: center; margin-bottom: 22px;";
    const nameLabel = document.createElement("span");
    nameLabel.textContent = "name:";
    nameLabel.style.cssText = "font-size: 13px; color: #8a8a96;";
    const nameInput = document.createElement("input");
    nameInput.maxLength = 12;
    nameInput.placeholder = "Pilgrim";
    nameInput.style.cssText = `
      background: #0c0a12; border: 1px solid #54402a; color: #e8d8a8; font-family: monospace;
      font-size: 15px; padding: 8px 12px; outline: none; width: 190px; text-align: center;
    `;
    nameRow.append(nameLabel, nameInput);

    // the vow: one life, no second chances
    let hardcore = false;
    const hcRow = document.createElement("div");
    hcRow.style.cssText = `
      display: flex; gap: 10px; align-items: center; margin-bottom: 22px; cursor: pointer; user-select: none;
      border: 1px solid #3a2028; padding: 9px 16px; background: #140c10; transition: all .15s;
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

    const button = document.createElement("button");
    button.textContent = "ENTER THE DUNGEON";
    button.disabled = true;
    button.style.cssText = `
      font-family: monospace; font-size: 15px; letter-spacing: 3px; padding: 12px 34px; cursor: pointer;
      background: #1c1524; color: #5a5a66; border: 2px solid #342a44; transition: all .15s;
    `;

    const refreshButton = () => {
      if (chosen) {
        button.disabled = false;
        button.style.color = "#ffd54a";
        button.style.borderColor = "#d8b13a";
        button.style.background = "#241c10";
        button.style.boxShadow = "0 0 24px #d8b13a33";
      }
    };

    for (const card of CLASS_CARDS) {
      const el = document.createElement("div");
      el.style.cssText = `
        width: 210px; padding: 18px 16px 16px; cursor: pointer; user-select: none;
        background: #120f1a; border: 2px solid #342a44; transition: all .15s;
      `;
      const title = document.createElement("div");
      title.textContent = card.title.toUpperCase();
      title.style.cssText = `font-size: 17px; font-weight: bold; letter-spacing: 2px; color: ${card.color}; margin-bottom: 10px;`;
      const blurb = document.createElement("div");
      blurb.textContent = card.blurb;
      blurb.style.cssText = "font-size: 11px; line-height: 1.55; color: #8a8a96;";
      el.append(title, blurb);
      el.onmouseenter = () => { if (chosen !== card.cls) el.style.borderColor = "#54402a"; };
      el.onmouseleave = () => { if (chosen !== card.cls) el.style.borderColor = "#342a44"; };
      el.onclick = () => {
        chosen = card.cls;
        cards.forEach((c, cls) => {
          c.style.borderColor = cls === chosen ? "#d8b13a" : "#342a44";
          c.style.boxShadow = cls === chosen ? "0 0 24px #d8b13a33" : "none";
        });
        refreshButton();
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

    overlay.append(h1, h2, row, nameRow, hcRow, button);
    document.body.appendChild(overlay);
  });
}

// --- the lobby: find a game, or forge your own ---

function showLobby(): Promise<{ mode: "create"; difficulty: number } | { mode: "join"; roomId: string }> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 1000;
      background: radial-gradient(ellipse at center, #16121e 0%, #0a0810 75%);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      font-family: monospace; color: #c9c9d4;
    `;

    const h1 = document.createElement("div");
    h1.textContent = "HOLLOWMARK";
    h1.style.cssText = "font-size: 24px; letter-spacing: 5px; color: #e8d8a8; margin-bottom: 6px; text-shadow: 0 0 18px #d8b13a44;";
    const h2 = document.createElement("div");
    h2.textContent = "— join a party, or descend alone —";
    h2.style.cssText = "font-size: 12px; color: #8a8a96; margin-bottom: 26px; font-style: italic;";

    const list = document.createElement("div");
    list.style.cssText = "width: 460px; max-height: 320px; overflow-y: auto; margin-bottom: 22px; display: flex; flex-direction: column; gap: 8px;";

    const createBtn = document.createElement("button");
    createBtn.textContent = "⚒ FORGE NEW GAME";
    createBtn.style.cssText = `
      font-family: monospace; font-size: 14px; letter-spacing: 2px; padding: 12px 30px; cursor: pointer;
      background: #241c10; color: #ffd54a; border: 2px solid #d8b13a; box-shadow: 0 0 24px #d8b13a22;
    `;

    // THE HALL OF LEGENDS: every hero this server remembers, the fallen in honor
    const hall = document.createElement("div");
    hall.style.cssText = `
      width: 300px; max-height: 380px; overflow-y: auto; padding: 14px 16px;
      background: #0e0b14; border: 1px solid #342a44;
    `;
    const hallTitle = document.createElement("div");
    hallTitle.textContent = "⚜ HALL OF LEGENDS";
    hallTitle.style.cssText = "font-size: 13px; letter-spacing: 3px; color: #d8b13a; margin-bottom: 10px;";
    const hallList = document.createElement("div");
    hall.append(hallTitle, hallList);
    const clsCol: Record<string, string> = { barbarian: "#e07a6a", rogue: "#7fdc9f", sorcerer: "#7aa8e8", paladin: "#e8cf7a", necromancer: "#9fceb4", druid: "#cf9a5f" };
    const refreshHall = async () => {
      try {
        const res = await fetch(`${SERVER_HTTP}/legends`);
        const legends: any[] = await res.json();
        hallList.innerHTML = "";
        if (!legends.length) {
          hallList.innerHTML = '<div style="font-size:11px;color:#5a5a66;font-style:italic;">No legends yet. Be the first.</div>';
          return;
        }
        legends.forEach((l, i) => {
          const row = document.createElement("div");
          row.style.cssText = `display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid #1c1626;${l.dead ? "opacity:.6;" : ""}`;
          const left = document.createElement("span");
          left.innerHTML = `<span style="color:#54402a;">${i + 1}.</span> <span style="color:${l.dead ? "#7a5a60" : clsCol[l.cls] ?? "#c9c9d4"};font-weight:bold;">${l.hardcore ? "☠ " : ""}${l.name}</span>`;
          left.style.cssText = "font-size:11px;";
          const right = document.createElement("span");
          const actTag = (a: number, abyss: number) =>
            a >= 5 ? `abyss ${abyss || "?"}` : `act ${["I", "II", "III", "IV"][Math.max(0, Math.min(3, (a || 1) - 1))]}`;
          const diffMark = ["", "", "☠", "☠☠"][l.diffUnlocked ?? 1] ?? "";
          right.textContent = l.dead
            ? `✝ ${l.diedAct >= 5 ? `abyss ${l.diedFloor}` : `act ${l.diedAct || "?"}`}`
            : `${diffMark ? diffMark + " " : ""}${actTag(l.actsUnlocked ?? 1, l.abyssDeepest ?? 0)} · lvl ${l.level}`;
          right.style.cssText = `font-size:10px;color:${l.dead ? "#6a4a50" : "#8a8a96"};white-space:nowrap;`;
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
    // the forge asks how sharp a world you want; the server clamps to what you've earned
    const diffRow = document.createElement("div");
    diffRow.style.cssText = "display:flex;gap:8px;margin:10px 0 0;justify-content:center;";
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
      b.style.cssText = `font-family:monospace;font-size:11px;letter-spacing:1px;padding:6px 12px;cursor:pointer;background:#14101c;color:${d.color};border:1px solid ${d.n === 1 ? d.color : "#342a44"};`;
      b.onclick = () => {
        chosenDiff = d.n;
        diffBtns.forEach((bb, i) => (bb.style.border = `1px solid ${DIFF_META[i].n === d.n ? DIFF_META[i].color : "#342a44"}`));
      };
      diffBtns.push(b);
      diffRow.append(b);
    }
    const diffHint = document.createElement("div");
    diffHint.textContent = "sharper worlds must be earned — Uldrath's fall unlocks the next";
    diffHint.style.cssText = "font-size:10px;color:#5a5a66;font-style:italic;margin-top:4px;text-align:center;";
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
        empty.textContent = "No open games. Forge one — the dungeon is patient.";
        empty.style.cssText = "font-size: 12px; color: #5a5a66; text-align: center; padding: 18px; border: 1px dashed #342a44;";
        list.appendChild(empty);
        return;
      }
      for (const room of rooms) {
        const row = document.createElement("div");
        row.style.cssText = `
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          background: #120f1a; border: 1px solid #342a44; padding: 10px 14px;
        `;
        const info = document.createElement("div");
        const zone = room.metadata?.zoneName ?? "The Mournfield";
        const floor = room.metadata?.floor ?? 1;
        const act = room.metadata?.act ?? 1;
        const diffNames = ["", "", "☠ NIGHTMARE · ", "☠☠ HELL · "];
        const diffTag = diffNames[room.metadata?.difficulty ?? 1] ?? "";
        const where = `${diffTag}${act >= 5 ? `Abyss ${floor}` : `Act ${["I", "II", "III", "IV"][act - 1] ?? act} · floor ${floor}`}`;
        info.innerHTML = `<div style="font-size:13px;color:#c9c9d4;">${where} — ${zone}</div>
          <div style="font-size:10px;color:#8a8a96;">${room.clients}/${room.maxClients} heroes · game ${room.roomId.slice(0, 6)}</div>`;
        const join = document.createElement("button");
        join.textContent = room.clients >= room.maxClients ? "FULL" : "JOIN";
        join.disabled = room.clients >= room.maxClients;
        join.style.cssText = `
          font-family: monospace; font-size: 12px; padding: 8px 18px; cursor: pointer;
          background: ${join.disabled ? "#1c1524" : "#14201a"}; color: ${join.disabled ? "#5a5a66" : "#7fdc9f"};
          border: 1px solid ${join.disabled ? "#342a44" : "#2a6a44"};
        `;
        join.onclick = () => finish({ mode: "join", roomId: room.roomId });
        row.append(info, join);
        list.appendChild(row);
      }
    };
    refresh();
    timer = window.setInterval(refresh, 3000);

    const columns = document.createElement("div");
    columns.style.cssText = "display:flex;gap:26px;align-items:flex-start;";
    const leftCol = document.createElement("div");
    leftCol.style.cssText = "display:flex;flex-direction:column;align-items:center;";
    leftCol.append(list, createBtn, diffRow, diffHint);
    columns.append(leftCol, hall);
    overlay.append(h1, h2, columns);
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

    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 1000;
      background: radial-gradient(ellipse at center, #16121e 0%, #0a0810 75%);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      font-family: monospace; color: #c9c9d4;
    `;
    const finish = (result: { key: string; isNew?: { cls: string; name: string; hardcore?: boolean }; randomize?: boolean }) => {
      overlay.remove();
      resolve(result);
    };

    const h1 = document.createElement("div");
    h1.textContent = "CHOOSE YOUR HERO";
    h1.style.cssText = "font-size: 22px; letter-spacing: 5px; color: #e8d8a8; margin-bottom: 26px; text-shadow: 0 0 18px #d8b13a44;";

    const list = document.createElement("div");
    list.style.cssText = "width: 420px; max-height: 300px; overflow-y: auto; margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px;";

    // live details from the server (level, class, depth)
    let details: any[] = [];
    if (roster.length) {
      try {
        const res = await fetch(`${SERVER_HTTP}/heroes?keys=${roster.map((e) => e.key).join(",")}`);
        details = await res.json();
      } catch { /* offline — local names only */ }
    }

    const clsColor: Record<string, string> = { barbarian: "#e07a6a", rogue: "#7fdc9f", sorcerer: "#7aa8e8", paladin: "#e8cf7a", necromancer: "#9fceb4", druid: "#cf9a5f" };
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
      row.style.cssText = `
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        background: ${dead ? "#0e0a0c" : "#120f1a"}; border: 1px solid ${dead ? "#2a1418" : hc ? "#4a2028" : "#342a44"}; padding: 10px 14px;
        ${dead ? "opacity:.65;" : ""}
      `;
      const info = document.createElement("div");
      info.innerHTML = `<div style="font-size:14px;font-weight:bold;color:${dead ? "#6a5a5e" : clsColor[cls] ?? "#c9c9d4"};">${hc ? "☠ " : ""}${name}</div>
        <div style="font-size:10px;color:${dead ? "#7a5a60" : "#8a8a96"};">${sub}</div>`;
      row.appendChild(info);
      if (!dead) {
        const enter = document.createElement("button");
        enter.textContent = "ENTER";
        enter.style.cssText = `
          font-family: monospace; font-size: 12px; padding: 8px 18px; cursor: pointer;
          background: #14201a; color: #7fdc9f; border: 1px solid #2a6a44;
        `;
        enter.onclick = () => finish({ key: entry.key });
        row.appendChild(enter);
      } else {
        const rip = document.createElement("span");
        rip.textContent = "AT REST";
        rip.style.cssText = "font-size: 10px; color: #5a3a42; letter-spacing: 2px;";
        row.appendChild(rip);
      }
      list.appendChild(row);
    }

    const buttons = document.createElement("div");
    buttons.style.cssText = "display: flex; gap: 12px;";

    const newBtn = document.createElement("button");
    newBtn.textContent = "★ NEW HERO";
    newBtn.style.cssText = `
      font-family: monospace; font-size: 13px; letter-spacing: 1px; padding: 11px 22px; cursor: pointer;
      background: #241c10; color: #ffd54a; border: 2px solid #d8b13a;
    `;
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
      const randBtn = document.createElement("button");
      randBtn.textContent = "⚄ RANDOM HERO";
      randBtn.title = "Forged at the party's level, geared for this depth";
      randBtn.style.cssText = `
        font-family: monospace; font-size: 13px; letter-spacing: 1px; padding: 11px 22px; cursor: pointer;
        background: #1a1424; color: #b48ae8; border: 2px solid #6a4a9f;
      `;
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
      hint.style.cssText = "font-size: 10px; color: #6a6a76; margin-top: 12px;";
      overlay.append(h1, list, buttons, hint);
    } else {
      overlay.append(h1, list, buttons);
    }

    document.body.appendChild(overlay);
  });
}

function showLoading() {
  const overlay = document.createElement("div");
  overlay.id = "arpg-loading";
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 999;
    background: radial-gradient(ellipse at center, #16121e 0%, #0a0810 75%);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    font-family: monospace; color: #e8d8a8;
  `;
  const txt = document.createElement("div");
  txt.textContent = "Descending into Hollowmere…";
  txt.style.cssText = "font-size: 18px; letter-spacing: 3px; animation: arpgpulse 1.2s ease-in-out infinite;";
  const style = document.createElement("style");
  style.textContent = "@keyframes arpgpulse { 0%,100% { opacity: .45 } 50% { opacity: 1 } }";
  overlay.append(style, txt);
  document.body.appendChild(overlay);
}

async function boot() {
  // pick your game, then who walks into it
  const intent = await showLobby();
  (window as any).__arpgIntent = intent;

  const choice = await showHeroSelect(intent.mode);
  localStorage.setItem("arpg_key", choice.key); // the active hero
  if (choice.isNew) localStorage.setItem("arpg_new", JSON.stringify(choice.isNew));
  if (choice.randomize) localStorage.setItem("arpg_random", "1");

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
