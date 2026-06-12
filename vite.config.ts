import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // Let Rollup split these dynamically imported libraries on-demand
            if (
              id.includes("jspdf") ||
              id.includes("html2canvas") ||
              id.includes("recharts")
            ) {
              return;
            }
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }
            if (id.includes("framer-motion") || id.includes("lucide-react")) {
              return "vendor-ui-libs";
            }
            if (id.includes("react-markdown") || id.includes("react-syntax-highlighter")) {
              return "vendor-markdown";
            }
            // Keep the React runtime and React-heavy ecosystem in the same vendor chunk.
            // Splitting them into a dedicated chunk introduced a circular init path in prod,
            // which left the React namespace partially initialized and broke createContext().
            return "vendor";
          }
        },
      },
    },
  },
}));
