import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [preact()],
  define: {
    "process.env.STAGING_DEPLOY": JSON.stringify(process.env.STAGING_DEPLOY),
    "process.env.MAIN_API_BASE_URL": JSON.stringify(
      process.env.MAIN_API_BASE_URL
    ),
    "process.env.CHAT_API_BASE_URL": JSON.stringify(
      process.env.CHAT_API_BASE_URL
    ),
  },
  build: {
    sourcemap: false,
    target: "esnext",
    commonjsOptions: {},
    rollupOptions: {
      input: [
        resolve(__dirname, "src/index.tsx"),
        resolve(__dirname, "src/story-index.tsx"),
        resolve(__dirname, "src/video-pop-index.tsx"),
        resolve(__dirname, "src/banner-index.tsx"),
      ],
      output: {
        format: "es",
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
      },
    },
  },
});
