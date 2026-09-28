import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the API runs on :8000 (uvicorn); /api is proxied to it.
// build.target keeps the output working in the last browsers available on
// Windows 7/8.1 (Chrome/Edge 109, Firefox 115 ESR).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8000" } },
  build: { target: ["chrome109", "edge109", "firefox115", "safari15"] },
});
