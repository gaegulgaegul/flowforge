/**
 * 기능명세(features) 승인/반려 라우트 통합 테스트 (6b 예광탄).
 * GET /api/docs/:project/planning-features-suggestions (제안 큐 읽기)
 * POST /api/docs/:project/planning-features-suggestions/apply (승인·반려 적용)
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";

let ROOT: string;

const FEATURES_MD = [
  "# 기능명세서: 데모",
  "",
  "## 기획 산출물 생성",
  "<!-- capability: planning-authoring -->",
  "(중요도: 높음, 상태: 진행중)",
  "",
  "### PRD 생성",
  "(중요도: 중간, 상태: 시작전)",
  "",
].join("\n");

/** <ROOT>/<project>/docs/planning/{features.md, features.suggestions.json} 픽스처. */
function makePlanning(project: string, sugs?: unknown[]): string {
  const planDir = join(ROOT, project, "docs", "planning");
  mkdirSync(planDir, { recursive: true });
  writeFileSync(join(planDir, "features.md"), FEATURES_MD);
  if (sugs) {
    writeFileSync(join(planDir, "features.suggestions.json"), JSON.stringify({ version: 1, suggestions: sugs }));
  }
  return planDir;
}

async function loadApp() {
  const mod = await import("../../index.js");
  return mod.app;
}

describe("features 승인/반려 API", () => {
  const ORIG = process.env.DOCS_ROOT;

  beforeEach(() => {
    ROOT = mkdtempSync(join(tmpdir(), "feat-approval-api-"));
    process.env.DOCS_ROOT = ROOT;
  });
  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    if (ORIG === undefined) delete process.env.DOCS_ROOT;
    else process.env.DOCS_ROOT = ORIG;
  });

  it("GET planning-features-suggestions — 큐 있으면 200 + 제안 목록", async () => {
    makePlanning("p", [{ id: "s1", nodePath: ["기획 산출물 생성"], op: "set-attrs", priority: "낮음" }]);
    const app = await loadApp();
    const res = await request(app).get("/api/docs/p/planning-features-suggestions");
    expect(res.status).toBe(200);
    expect(res.body.queue.suggestions).toHaveLength(1);
    expect(res.body.queue.suggestions[0].id).toBe("s1");
  });

  it("GET planning-features-suggestions — 큐 없으면 200 + 빈 큐(404 아님)", async () => {
    makePlanning("p");
    const app = await loadApp();
    const res = await request(app).get("/api/docs/p/planning-features-suggestions");
    expect(res.status).toBe(200);
    expect(res.body.queue).toEqual({ version: 1, suggestions: [] });
  });

  it("GET planning-features-suggestions — 경로 조작 차단(404)", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/..%2f..%2fetc/planning-features-suggestions");
    expect(res.status).toBe(404);
  });

  it("POST apply — 단일 승인 시 속성 라인 교체 반영 + 결과 반환", async () => {
    const planDir = makePlanning("p", [
      { id: "s1", nodePath: ["기획 산출물 생성"], op: "set-attrs", priority: "낮음", status: "완료" },
    ]);
    const app = await loadApp();
    const res = await request(app)
      .post("/api/docs/p/planning-features-suggestions/apply")
      .send({ approve: ["s1"], reject: [] });
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(1);
    expect(res.body.remaining).toBe(0);
    expect(readFileSync(join(planDir, "features.md"), "utf-8")).toContain("(중요도: 낮음, 상태: 완료)");
  });

  it("POST apply — 반려 시 원본 불변", async () => {
    const planDir = makePlanning("p", [{ id: "s1", nodePath: ["기획 산출물 생성"], op: "set-attrs", priority: "낮음" }]);
    const before = readFileSync(join(planDir, "features.md"), "utf-8");
    const app = await loadApp();
    const res = await request(app)
      .post("/api/docs/p/planning-features-suggestions/apply")
      .send({ approve: [], reject: ["s1"] });
    expect(res.status).toBe(200);
    expect(res.body.rejected).toBe(1);
    expect(readFileSync(join(planDir, "features.md"), "utf-8")).toBe(before);
  });

  it("POST apply — 미실재 id는 skipped로 표면화", async () => {
    makePlanning("p", [{ id: "s1", nodePath: ["기획 산출물 생성"], op: "set-attrs", priority: "낮음" }]);
    const app = await loadApp();
    const res = await request(app)
      .post("/api/docs/p/planning-features-suggestions/apply")
      .send({ approve: ["nope"], reject: [] });
    expect(res.status).toBe(200);
    expect(res.body.skipped).toContain("nope");
  });

  it("POST apply — 잘못된 body는 400", async () => {
    makePlanning("p");
    const app = await loadApp();
    const res = await request(app)
      .post("/api/docs/p/planning-features-suggestions/apply")
      .send({ approve: "s1" });
    expect(res.status).toBe(400);
  });

  it("POST apply — 경로 조작 차단(404)", async () => {
    const app = await loadApp();
    const res = await request(app)
      .post("/api/docs/..%2f..%2fetc/planning-features-suggestions/apply")
      .send({ approve: [], reject: [] });
    expect(res.status).toBe(404);
  });

  it("POST apply — features.md 부재 시 422(원본 보호)", async () => {
    // features.md 없이 큐만 있는 프로젝트는 docs 미인식 → 404가 정상이므로
    // planning/prd.md로 docs 인식은 시키되 features.md만 없는 상태를 만든다.
    const planDir = join(ROOT, "nofeat", "docs", "planning");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "prd.md"), "# PRD\n\n## 개요\n\nx\n"); // docs 인식용
    writeFileSync(
      join(planDir, "features.suggestions.json"),
      JSON.stringify({ version: 1, suggestions: [{ id: "s1", nodePath: ["A"], op: "set-attrs", priority: "낮음" }] }),
    );
    const app = await loadApp();
    const res = await request(app)
      .post("/api/docs/nofeat/planning-features-suggestions/apply")
      .send({ approve: ["s1"], reject: [] });
    expect(res.status).toBe(422);
  });
});
