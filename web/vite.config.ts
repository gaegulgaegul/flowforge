import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 개발 시 /api → Express(8811) 프록시. 빌드 산출물은 Express가 정적 서빙(배포).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5183,
    proxy: {
      "/api": "http://localhost:8811",
    },
  },
  build: {
    outDir: "dist",
  },
});
