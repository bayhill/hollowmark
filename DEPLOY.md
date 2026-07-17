# Deploying Hollowmark

Hollowmark is two deployable pieces:

| Piece | What it is | Where it goes | Cost |
|-------|-----------|---------------|------|
| **Client** (`client/`) | Phaser + Vite static site | **Vercel** | Free |
| **Server** (`server/`) | Colyseus authoritative WebSocket server, holds room state in RAM, writes save files to disk | **Fly.io** (or any container host) | ~Free with auto-stop |

> **Why not the server on Vercel too?** Vercel's serverless/edge model can't hold a long-lived WebSocket, can't keep a room's state in RAM between messages, and has a read-only filesystem. Colyseus needs all three. This is an architecture mismatch, not a pricing tier — no Vercel plan can host it. The client, being a static build, is a perfect Vercel fit.

Deploy the **server first** — you need its public URL to configure the client.

---

## 1. Server → Fly.io

### One-time setup
```bash
# install + log in
brew install flyctl        # or: curl -L https://fly.io/install.sh | sh
fly auth signup            # or: fly auth login

# from the repo root (where Dockerfile + fly.toml live):
fly apps create hollowmark-server          # must match `app` in fly.toml
fly volumes create hollowmark_data --size 1 --region arn   # 1 GB save storage; match your region
```

### Deploy
```bash
fly deploy
```
Fly builds the `Dockerfile`, attaches the volume at `/data`, and starts the server. Your public URL is `https://hollowmark-server.fly.dev` (or your custom domain). Everything is already set for production — the image bakes in `NODE_ENV=production` and `ARPG_PROD=1`, which **disables the debug/cheat hooks** (`smokegod`, `smokegive`, etc.).

### Verify
```bash
curl https://hollowmark-server.fly.dev/health     # -> {"ok":true,"season":1}
curl https://hollowmark-server.fly.dev/rooms      # -> []  (no open games yet)
```

### Cost / behavior notes
- `min_machines_running = 0` + `auto_stop_machines` means the VM **sleeps when no one is playing** and wakes on the next connection — you pay ~nothing while idle (just ~$0.15/mo for the volume). Trade-off: a ~2–4 s cold start for the first player after an idle period.
- Want zero cold starts? Set `min_machines_running = 1` in `fly.toml` — a always-on `shared-cpu-1x/256mb` VM is roughly ~$2/mo.
- Save data lives on the `hollowmark_data` volume and survives deploys/restarts. Back it up with `fly ssh console` + copying `/data`, or snapshot the volume.

---

## 2. Client → Vercel

The client reads **`VITE_SERVER_URL`** at build time (see `client/src/config.ts`) and derives both its REST base and its `wss://` socket from it.

### Setup (Vercel dashboard or CLI)
- **Root directory:** `client`
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Environment variable:**
  ```
  VITE_SERVER_URL = https://hollowmark-server.fly.dev
  ```
  Use the **https://** server origin — the client turns it into `wss://` for the gameplay socket. (An HTTPS page refuses an insecure `ws://` connection, which is exactly why this indirection exists.)

Redeploy after setting the variable so it's baked into the bundle. That's it — the client will connect to your Fly server over `wss://`.

### Local dev is unaffected
Leave `VITE_SERVER_URL` unset locally and `npm run dev` still talks to `localhost:2567`.

---

## Truly-$0-forever alternative (more setup)
If the Fly pennies ever bother you, the same `Dockerfile` runs on an **Oracle Cloud "Always Free"** ARM VM (free indefinitely). You'd run the container and put **Caddy** in front for automatic TLS (so clients get `wss://`), then point `VITE_SERVER_URL` at that box's domain. It's genuinely free but involves SSH, a reverse proxy, and firewall rules — more moving parts than Fly. Recommended only once you've outgrown the hobby phase or want to cut the last few cents.
