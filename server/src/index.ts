import "dotenv/config";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import express from "express";
import cors from "cors";
import { graphRouter } from "./routes/graph.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "flowforge", ts: new Date().toISOString() });
});

app.use(graphRouter);

// web 빌드 산출물 정적 서빙(배포 단일 컨테이너 패턴). dist 없으면 스킵.
const __dirname = dirname(fileURLToPath(import.meta.url));
const webDist = join(__dirname, "..", "..", "web", "dist");
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(join(webDist, "index.html"));
  });
}

const PORT = Number(process.env.PORT ?? 8811);

// 테스트에서 import 시 자동 listen 방지 (supertest는 app만 사용)
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT);
}

export { app };
