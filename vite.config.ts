import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  // Fixed port so Stripe's success/cancel redirects (app.success-url in application-local.yaml)
  // always land here. Vite's default 5173 is shared with other local projects, and a fallback
  // port sends the redirect to whatever happens to be running there. strictPort fails loudly
  // instead of drifting.
  server: { port: 5174, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        // Framework code changes rarely — keep it in its own long-cached chunks
        // so a site deploy only invalidates our own code.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) return "react";
          if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return "motion";
        },
      },
    },
  },
});
