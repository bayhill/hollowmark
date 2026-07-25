import { defineConfig } from "vite";

// The client used to build with no config at all — one 2.0 MB chunk (≈514 kB gzipped)
// whose hash changed on every deploy, so returning players re-downloaded Phaser each
// time we touched a line of game code.
//
// Splitting does NOT make the download smaller: Phaser is most of those bytes and it is
// all needed on the first frame. What it buys is a stable vendor chunk — Phaser's hash
// only moves when we upgrade Phaser, so a normal deploy invalidates the game code alone.
export default defineConfig({
  build: {
    // ~1.2 MB of that is Phaser, and it is genuinely required up front — the warning
    // has nothing left to teach us once the vendor split is in place.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ["phaser"],
        },
      },
    },
  },
});
