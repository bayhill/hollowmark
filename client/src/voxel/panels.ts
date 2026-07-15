// DOM UI panels over the 3D canvas (P5). Inventory first: reads the `loadout`
// message, equips/unequips/drops via the same messages the Phaser client sends.
import { RARITY_COLORS } from "@hollowmark/common";

type Send = (type: string, payload?: any) => void;
let send: Send = () => {};
let root: HTMLDivElement;
let equipEl: HTMLDivElement;
let bagEl: HTMLDivElement;
let visible = false;
let lastLoadout: any = null;

const hex = (n: number) => "#" + (n & 0xffffff).toString(16).padStart(6, "0");

function injectStyles() {
  const css = `
    #invpanel { position: fixed; top: 54px; right: 14px; width: 320px; max-height: 82vh; overflow-y: auto;
      z-index: 20; background: #120f1aef; border: 2px solid #54402a; border-radius: 4px;
      box-shadow: 0 0 24px #000c; padding: 10px 12px; color: #c9c9d4; font-size: 12px; }
    #invpanel .ph { color: #e8d8a8; font-weight: bold; letter-spacing: 3px; margin-bottom: 8px; }
    #invpanel .ph .dim { color: #6a6a76; font-weight: normal; letter-spacing: 1px; float: right; }
    #invpanel .sec { color: #8a8a96; font-weight: bold; letter-spacing: 2px; font-size: 11px;
      margin: 12px 0 5px; border-bottom: 1px solid #33303e; padding-bottom: 3px; }
    #invpanel .sortbtn { color: #8a9ab8; cursor: pointer; float: right; font-weight: normal; }
    #invpanel .sortbtn:hover { color: #c8d8f8; }
    #invpanel .irow { padding: 4px 6px; border-radius: 3px; cursor: pointer; border: 1px solid transparent; }
    #invpanel .irow:hover { background: #221d30; border-color: #3a3446; }
    #invpanel .iname { font-weight: bold; }
    #invpanel .iname .slot { color: #6a6a76; font-weight: normal; font-size: 10px; text-transform: uppercase; }
    #invpanel .istats { color: #9a9aa6; font-size: 10px; margin-top: 1px; }
    #invpanel .empty { color: #4a4a56; font-style: italic; padding: 4px 6px; }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}

export function initPanels(sendFn: Send) {
  send = sendFn;
  injectStyles();
  root = document.createElement("div");
  root.id = "invpanel";
  root.style.display = "none";
  root.innerHTML =
    `<div class="ph">INVENTORY <span class="dim">[I] close</span></div>` +
    `<div class="sec">EQUIPPED</div><div id="equip"></div>` +
    `<div class="sec">BAG <span class="sortbtn" id="sortbtn">[sort]</span></div><div id="bag"></div>`;
  document.body.appendChild(root);
  equipEl = root.querySelector("#equip") as HTMLDivElement;
  bagEl = root.querySelector("#bag") as HTMLDivElement;
  (root.querySelector("#sortbtn") as HTMLElement).addEventListener("click", () => send("sortbag", {}));
}

export function toggleInventory() {
  visible = !visible;
  root.style.display = visible ? "block" : "none";
  if (visible) render();
}

export function setLoadout(data: any) { lastLoadout = data; if (visible) render(); }

function statText(stats: any): string {
  if (!stats) return "";
  return Object.entries(stats)
    .filter(([, v]) => v)
    .map(([k, v]) => `${(v as number) > 0 ? "+" : ""}${v} ${k}`)
    .join(" · ");
}

function itemRow(it: any, equipped: boolean, slot?: string): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "irow";
  const color = it.unidentified ? "#8a8a96" : hex(RARITY_COLORS[it.rarity as keyof typeof RARITY_COLORS] ?? 0xd0d0d0);
  const name = it.unidentified ? `Unidentified ${it.rarity} ${it.slot}` : it.name;
  const socket = it.sockets ? ` ◈${it.sockets}` : "";
  const slotTag = slot ? `<span class="slot">${slot}</span> ` : "";
  row.innerHTML =
    `<div class="iname" style="color:${color}">${slotTag}${name}${socket}</div>` +
    `<div class="istats">${it.unidentified ? "— its truth is hidden —" : statText(it.stats)}</div>`;
  if (equipped) {
    row.title = "click: unequip";
    row.addEventListener("click", () => send("unequip", { slot }));
  } else {
    row.title = it.unidentified ? "click: identify" : "click: equip · right-click: drop";
    row.addEventListener("click", () => send(it.unidentified ? "identify" : "equip", { id: it.id }));
    row.addEventListener("contextmenu", (e) => { e.preventDefault(); send("dropitem", { id: it.id }); });
  }
  return row;
}

function render() {
  const d = lastLoadout;
  if (!d || !equipEl) return;
  equipEl.innerHTML = "";
  bagEl.innerHTML = "";
  const eq = d.equipment ?? {};
  for (const slot of Object.keys(eq)) {
    const it = eq[slot];
    if (it) equipEl.appendChild(itemRow(it, true, slot));
  }
  if (!equipEl.childNodes.length) equipEl.innerHTML = `<div class="empty">nothing equipped</div>`;
  const bag = d.inventory ?? [];
  let any = false;
  for (const it of bag) { if (it) { bagEl.appendChild(itemRow(it, false)); any = true; } }
  if (!any) bagEl.innerHTML = `<div class="empty">your bag is empty</div>`;
}
