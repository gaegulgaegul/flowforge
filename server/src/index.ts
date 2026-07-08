import "dotenv/config";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import express from "express";
import { graphRouter } from "./routes/graph.js";
import { docsRouter } from "./routes/docs.js";
import { projectsRouter } from "./routes/projects.js";
import { corsMiddleware } from "./lib/corsOptions.js";
import { cfAccessConfig } from "./lib/cfAccess.js";

const app = express();
// 와일드카드 CORS 제거(D-5): 화이트리스트 설정 시에만 미들웨어 부착. 미설정=헤더 없음(same-origin SPA 무영향).
const cors = corsMiddleware();
if (cors) {
  app.use(cors);
}
app.use(express.json());

// 쓰기 게이트 상태 기동 로그 1줄(D-3): env 미설정이면 개발 모드(현행 공개)임을 정직히 표기.
if (process.env.NODE_ENV !== "test") {
  const gateOn = cfAccessConfig().enabled || Boolean((process.env.FLOWFORGE_WRITE_TOKEN ?? "").trim());
  process.stdout.write(
    gateOn
      ? "[flowforge] write auth enabled\n"
      : "[flowforge] write auth disabled — dev mode (writes are public until env is set)\n",
  );
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "flowforge", ts: new Date().toISOString() });
});

app.use(graphRouter);
app.use(docsRouter);
app.use(projectsRouter);

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
