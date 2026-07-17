# Hollowmark game server (Colyseus). Host-agnostic image — runs on Fly.io,
# Railway, Render, or any container platform. The client is a separate static
# build (Vercel); this image is ONLY the authoritative server.
#
# The server runs TypeScript directly via tsx (no compile step), and consumes
# @hollowmark/common as raw TS through the npm workspace symlinks, so the whole
# monorepo's package manifests + the common/ and server/ sources are all we need.
FROM node:22-slim

# tini gives us correct signal handling so SIGTERM reaches Node and Colyseus
# can drain rooms (each disconnect persists the hero via onLeave) before exit.
RUN apt-get update && apt-get install -y --no-install-recommends tini \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for layer caching. Copy every workspace's manifest so the
# root `npm install` can resolve the workspace graph and create the symlinks.
COPY package.json package-lock.json ./
COPY common/package.json ./common/
COPY server/package.json ./server/
COPY client/package.json ./client/

# Full install (NOT --omit=dev): tsx lives in devDependencies and is the runtime.
RUN npm install --no-audit --no-fund

# Only the code the server actually needs at runtime.
COPY common ./common
COPY server ./server

# Player data lives on a mounted volume, NOT in the image. persistence.ts reads
# ARPG_DATA_DIR (profiles) and derives the accounts dir as its sibling, so
# /data/profiles + /data/accounts both land on the volume.
ENV NODE_ENV=production \
    ARPG_PROD=1 \
    ARPG_DATA_DIR=/data/profiles \
    PORT=2567
RUN mkdir -p /data/profiles /data/accounts

EXPOSE 2567
ENTRYPOINT ["tini", "--"]
CMD ["npm", "run", "start", "-w", "@hollowmark/server"]
