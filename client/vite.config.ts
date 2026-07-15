import { defineConfig } from "vite";
import { resolve } from "path";

// Multi-page: the live Phaser game (index.html) and the parallel voxel 3D
// prototype (voxel.html). Both share @hollowmark/common and the Colyseus server.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        voxel: resolve(__dirname, "voxel.html"),
      },
    },
  },
});
