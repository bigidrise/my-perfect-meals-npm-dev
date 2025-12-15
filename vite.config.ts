
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

// Read version from version.json if it exists
let appVersion = "1.0.0+dev";
try {
  const versionPath = path.resolve(import.meta.dirname, "client", "public", "version.json");
  if (fs.existsSync(versionPath)) {
    const versionData = JSON.parse(fs.readFileSync(versionPath, "utf-8"));
    appVersion = versionData.version;
  }
} catch (e) {
  console.warn("Could not read version.json, using default version");
}

export default defineConfig({
  plugins: [react()],
  resolve: { 
    alias: { 
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared")
    } 
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "client", "dist"),
    emptyOutDir: true,
  },
  server: {
    hmr: false,         // ⬅️ Disable HMR WS
    strictPort: true,   // don't silently hop ports
    port: 5173,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      // Anything starting with /api in dev will be forwarded to the backend
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
  // Inject app version as environment variable
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion)
  },
  // Ensure assets resolve fine on Railway/Replit
  base: "/",
});
