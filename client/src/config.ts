// Where the Hollowmark server lives.
//
// In local dev this is `<page-host>:2567`. For a hosted build, set
// VITE_SERVER_URL to the deployed server's origin at build time —
// e.g. `VITE_SERVER_URL=https://api.hollowmark.com` — and the client derives
// both bases from it:
//   • SERVER_HTTP — the lobby/heroes/legends REST calls
//   • SERVER_WS   — the Colyseus gameplay socket
//
// Getting the protocol right matters: an HTTPS page may only open wss:// and
// https:// (browsers block ws:///http:// as mixed content), so the fallback
// mirrors the page's own protocol rather than hardcoding the insecure ones.

const configured = import.meta.env.VITE_SERVER_URL?.trim();

function bases(): { http: string; ws: string } {
  if (configured) {
    const origin = configured.replace(/\/+$/, ""); // trim trailing slash so `${http}/rooms` is clean
    return { http: origin, ws: origin.replace(/^http/, "ws") }; // http->ws, https->wss
  }
  // same-host fallback (dev, or client served from the game server itself):
  // match the page protocol so HTTPS -> wss/https, HTTP -> ws/http
  const secure = location.protocol === "https:";
  const host = `${location.hostname}:2567`;
  return {
    http: `${secure ? "https" : "http"}://${host}`,
    ws: `${secure ? "wss" : "ws"}://${host}`,
  };
}

export const { http: SERVER_HTTP, ws: SERVER_WS } = bases();
