// The HTML/DOM counterpart of panelFrame.ts's "Arcane Runic" chrome. The pre-game
// screens (lobby, hero roster, forge, Hall of Legends) are plain DOM overlays, so
// they can't draw through the Phaser frame — this reproduces the same visual language
// in CSS: a dark gradient field, a double etched pewter border, magic-circle corner
// nodes, a rune frieze, and a ✦-flanked title cartouche. One gothic monochrome for all
// chrome; only content (class identity, difficulty, the hardcore vow) carries colour.

// The same futhark the in-game frame etches along its lower edge.
export const RUNE_FRIEZE = "ᚨ ᚱ ᚾ ᛞ ᛟ ᚦ ᛝ ᛥ ᛒ ᚹ ᛦ ᛘ ᚷ ᛖ ᛚ ᛃ ᛈ";

// Tarnished pewter on dark stone — matches PEWTER/BONE in panelFrame.ts.
export const ARCANE_DOM = {
  pewter: "#9a93a2",
  pewterDark: "#5f5866",
  bone: "#cfc6d6",
  dim: "#8a8494",
  ink: "#0c0a12",
};

let injected = false;
function injectStyles() {
  if (injected) return;
  injected = true;
  const s = document.createElement("style");
  s.textContent = `
    .arc-overlay {
      position: fixed; inset: 0; z-index: 1000;
      background:
        radial-gradient(ellipse 130% 90% at 50% -10%, #1b1526 0%, transparent 55%),
        radial-gradient(ellipse at center, #100c18 0%, #060409 82%);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      font-family: monospace; color: ${ARCANE_DOM.bone}; overflow: hidden;
    }
    /* a faint vignette so the frame floats in a dim hall */
    .arc-overlay::after {
      content: ""; position: absolute; inset: 0; pointer-events: none;
      box-shadow: inset 0 0 220px 40px rgba(0,0,0,0.7);
    }

    .arc-wordmark {
      font-size: 30px; letter-spacing: 11px; font-weight: bold; color: #e9e3ef;
      text-shadow: 0 0 24px rgba(154,147,162,0.4); margin-bottom: 7px;
      animation: arc-breathe 5.5s ease-in-out infinite;
    }
    .arc-wordmark .flank { color: ${ARCANE_DOM.pewter}; opacity: .7; font-weight: normal; margin: 0 14px; }
    @keyframes arc-breathe {
      0%,100% { text-shadow: 0 0 20px rgba(154,147,162,0.30); }
      50%     { text-shadow: 0 0 30px rgba(154,147,162,0.5); }
    }
    .arc-subtitle {
      font-size: 12px; color: ${ARCANE_DOM.dim}; font-style: italic;
      letter-spacing: 2px; margin-bottom: 30px;
    }

    /* --- the framed field --- */
    .arc-panel {
      position: relative;
      background: linear-gradient(180deg, #1a1626 0%, #0c0a12 100%);
      border: 2px solid rgba(154,147,162,0.9);
      border-radius: 8px;
      box-shadow:
        0 0 0 1px rgba(5,4,10,0.9),           /* dark keyline outside the edge */
        inset 0 0 0 4px rgba(12,10,18,0.85),  /* the gap */
        inset 0 0 0 5px rgba(154,147,162,0.28), /* inset hairline */
        0 24px 70px rgba(0,0,0,0.72);
      padding: 26px 30px;
    }
    .arc-panel.has-frieze { padding-bottom: 34px; }

    /* magic-circle corner nodes: a diamond with a bright bone core */
    .arc-corner {
      position: absolute; width: 9px; height: 9px; transform: rotate(45deg);
      background: #0c0a12; border: 1px solid rgba(154,147,162,0.85);
    }
    .arc-corner::after {
      content: ""; position: absolute; inset: 2px; background: ${ARCANE_DOM.bone}; opacity: .9;
    }
    .arc-corner.tl { top: -5px; left: -5px } .arc-corner.tr { top: -5px; right: -5px }
    .arc-corner.bl { bottom: -5px; left: -5px } .arc-corner.br { bottom: -5px; right: -5px }

    /* rune frieze along the lower inner edge */
    .arc-frieze {
      position: absolute; left: 12px; right: 12px; bottom: 9px; text-align: center;
      font-size: 10px; letter-spacing: 5px; color: rgba(154,147,162,0.26);
      pointer-events: none; user-select: none; overflow: hidden; white-space: nowrap;
    }

    /* title cartouche riding the top border */
    .arc-cartouche {
      position: absolute; top: -14px; left: 50%; transform: translateX(-50%);
      background: #120e1e; border: 1px solid rgba(154,147,162,0.7); border-radius: 5px;
      padding: 5px 18px; font-size: 14px; font-weight: bold; letter-spacing: 3px;
      color: ${ARCANE_DOM.bone}; white-space: nowrap; box-shadow: 0 0 0 1px #05040a;
    }

    /* --- buttons --- */
    .arc-btn {
      font-family: monospace; font-size: 13px; letter-spacing: 2px; text-transform: uppercase;
      padding: 11px 26px; cursor: pointer; border-radius: 4px; transition: all .16s ease;
      background: linear-gradient(180deg, #1c1726, #120f1a); color: ${ARCANE_DOM.bone};
      border: 1px solid rgba(154,147,162,0.55);
    }
    .arc-btn:hover:not(:disabled) {
      border-color: rgba(207,198,214,0.95); color: #fff;
      background: linear-gradient(180deg, #241d30, #171320);
      box-shadow: 0 0 16px rgba(154,147,162,0.25), inset 0 0 12px rgba(154,147,162,0.08);
    }
    .arc-btn:disabled { color: #5a5560; border-color: rgba(95,88,102,0.5); cursor: default; background: #141019; }
    .arc-btn--primary {
      border-color: rgba(207,198,214,0.85); color: #efe8f2;
      box-shadow: 0 0 14px rgba(154,147,162,0.16), inset 0 0 10px rgba(154,147,162,0.05);
    }
    .arc-btn--primary:hover:not(:disabled) {
      box-shadow: 0 0 24px rgba(207,198,214,0.35), inset 0 0 14px rgba(154,147,162,0.12);
    }

    /* --- inputs --- */
    .arc-input {
      background: #0c0a12; border: 1px solid rgba(154,147,162,0.5); color: ${ARCANE_DOM.bone};
      font-family: monospace; font-size: 15px; padding: 9px 12px; outline: none;
      text-align: center; border-radius: 3px; letter-spacing: 1px;
    }
    .arc-input:focus { border-color: rgba(207,198,214,0.9); box-shadow: 0 0 12px rgba(154,147,162,0.2); }
    .arc-input::placeholder { color: #6a6474; }

    /* --- list rows (games, heroes, legends) --- */
    .arc-row {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      background: linear-gradient(180deg, #161220, #100d18);
      border: 1px solid rgba(95,88,102,0.5); padding: 10px 14px; border-radius: 3px;
      transition: border-color .15s;
    }
    .arc-row:hover { border-color: rgba(154,147,162,0.65); }
    .arc-empty {
      font-size: 12px; color: #6a6474; text-align: center; padding: 18px;
      border: 1px dashed rgba(95,88,102,0.55); border-radius: 4px; font-style: italic;
    }

    /* themed scrollbars for the scrolling regions */
    .arc-scroll::-webkit-scrollbar { width: 8px; }
    .arc-scroll::-webkit-scrollbar-track { background: #0c0a12; border-radius: 4px; }
    .arc-scroll::-webkit-scrollbar-thumb { background: #2a2434; border-radius: 4px; }
    .arc-scroll::-webkit-scrollbar-thumb:hover { background: #3a3346; }
    .arc-scroll { scrollbar-width: thin; scrollbar-color: #2a2434 #0c0a12; }
  `;
  document.head.appendChild(s);
}

// A full-screen arcane backdrop.
export function arcaneOverlay(): HTMLDivElement {
  injectStyles();
  const o = document.createElement("div");
  o.className = "arc-overlay";
  return o;
}

// The wordmark + italic subtitle header used across the pre-game screens.
export function arcaneHeader(title: string, subtitle?: string): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;";
  const h1 = document.createElement("div");
  h1.className = "arc-wordmark";
  h1.innerHTML = `<span class="flank">✦</span>${title}<span class="flank">✦</span>`;
  wrap.appendChild(h1);
  if (subtitle) {
    const h2 = document.createElement("div");
    h2.className = "arc-subtitle";
    h2.textContent = subtitle;
    wrap.appendChild(h2);
  }
  return wrap;
}

// A framed panel: dark field, double pewter border, corner nodes, optional rune frieze
// and ✦-flanked title cartouche. Append content straight into the returned element.
export function arcanePanel(opts: { title?: string; frieze?: boolean } = {}): HTMLDivElement {
  injectStyles();
  const panel = document.createElement("div");
  panel.className = "arc-panel";
  for (const pos of ["tl", "tr", "bl", "br"] as const) {
    const c = document.createElement("span");
    c.className = `arc-corner ${pos}`;
    panel.appendChild(c);
  }
  if (opts.title) {
    const cart = document.createElement("div");
    cart.className = "arc-cartouche";
    cart.textContent = `✦  ${opts.title}  ✦`;
    panel.appendChild(cart);
  }
  if (opts.frieze !== false) {
    const fr = document.createElement("div");
    fr.className = "arc-frieze";
    fr.textContent = RUNE_FRIEZE;
    panel.appendChild(fr);
    panel.classList.add("has-frieze");
  }
  return panel;
}

// A pewter button; `variant: "primary"` for the brighter call-to-action.
export function arcaneButton(label: string, variant?: "primary"): HTMLButtonElement {
  injectStyles();
  const b = document.createElement("button");
  b.textContent = label;
  b.className = variant === "primary" ? "arc-btn arc-btn--primary" : "arc-btn";
  return b;
}
