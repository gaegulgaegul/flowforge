import "dotenv/config";
import express from "express";
import cors from "cors";
import { graphRouter } from "./routes/graph.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "manyfast-local", ts: new Date().toISOString() });
});

app.use(graphRouter);

const PORT = Number(process.env.PORT ?? 8811);

// 테스트에서 import 시 자동 listen 방지 (supertest는 app만 사용)
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT);
}

export { app };
