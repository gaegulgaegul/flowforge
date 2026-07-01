/**
 * PRD 승인/반려 라우트 통합 테스트 (6a 예광탄).
 * GET /api/docs/:project/planning-prd-suggestions (제안 큐 읽기)
 * POST /api/docs/:project/planning-prd-suggestions/apply (승인·반려 적용)
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";

let ROOT: string;

const PLANNING_PRD = [
  "# PRD: 데모",
  "",
  "## 개요",
  "",
  "원래 개요.",
  "",
  "## 핵심가치",
  "",
  "원래 핵심가치.",
  "",
  "## 타겟·시나리오",
  "",
  "원래 타겟.",
  "",
  "## 성공지표",
  "",
  "원래 지표.",
  "",
  "## 속성설정",
  "",
  "원래 속성.",
  "",
].join("\n");

/** <ROOT>/<project>/docs/planning/{prd.md, prd.suggestions.json} 픽스처. */
function makePlanning(project: string, sugs?: unknown[]): string {
  const planDir = join(ROOT, project, "docs", "planning");
  mkdirSync(planDir, { recursive: true });
  writeFileSync(join(planDir, "prd.md"), PLANNING_PRD);
  if (sugs) {
    writeFileSync(join(planDir, "prd.suggestions.json"), JSON.stringify({ version: 1, suggestions: sugs }));
  }
  return planDir;
}

async function loadApp() {
  const mod = await import("../../index.js");
  return mod.app;
}

describe("PRD 승인/반려 API", () => {
  const ORIG = process.env.DOCS_ROOT;

  beforeEach(() => {
    ROOT = mkdtempSync(join(tmpdir(), "prd-approval-api-"));
    process.env.DOCS_ROOT = ROOT;
  });
  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    if (ORIG === undefined) delete process.env.DOCS_ROOT;
    else process.env.DOCS_ROOT = ORIG;
  });

  it("GET planning-prd-suggestions — 큐 있으면 200 + 제안 목록", async () => {
    makePlanning("p", [{ id: "s1", section: "overview", op: "replace", proposedBody: "새 개요" }]);
    const app = await loadApp();
    const res = await request(app).get("/api/docs/p/planning-prd-suggestions");
    expect(res.status).toBe(200);
    expect(res.body.queue.suggestions).toHaveLength(1);
    expect(res.body.queue.suggestions[0].id).toBe("s1");
  });

  it("GET planning-prd-suggestions — 큐 없으면 200 + 빈 큐(404 아님)", async () => {
    makePlanning("p"); // suggestions 파일 없음
    const app = await loadApp();
    const res = await request(app).get("/api/docs/p/planning-prd-suggestions");
    expect(res.status).toBe(200);
    expect(res.body.queue).toEqual({ version: 1, suggestions: [] });
  });

  it("GET planning-prd-suggestions — 경로 조작 차단(404)", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/..%2f..%2fetc/planning-prd-suggestions");
    expect(res.status).toBe(404);
  });

  it("POST apply — 단일 승인 시 섹션 교체 반영 + 결과 반환", async () => {
    const planDir = makePlanning("p", [{ id: "s1", section: "overview", op: "replace", proposedBody: "승인된 개요" }]);
    const app = await loadApp();
    const res = await request(app)
      .post("/api/docs/p/planning-prd-suggestions/apply")
      .send({ approve: ["s1"], reject: [] });
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(1);
    expect(res.body.remaining).toBe(0);
    expect(readFileSync(join(planDir, "prd.md"), "utf-8")).toContain("승인된 개요");
  });

  it("POST apply — 반려 시 원본 불변", async () => {
    const planDir = makePlanning("p", [{ id: "s1", section: "overview", op: "replace", proposedBody: "무시됨" }]);
    const before = readFileSync(join(planDir, "prd.md"), "utf-8");
    const app = await loadApp();
    const res = await request(app)
      .post("/api/docs/p/planning-prd-suggestions/apply")
      .send({ approve: [], reject: ["s1"] });
    expect(res.status).toBe(200);
    expect(res.body.rejected).toBe(1);
    expect(readFileSync(join(planDir, "prd.md"), "utf-8")).toBe(before);
  });

  it("POST apply — 미실재 id는 skipped로 표면화", async () => {
    makePlanning("p", [{ id: "s1", section: "overview", op: "replace", proposedBody: "x" }]);
    const app = await loadApp();
    const res = await request(app)
      .post("/api/docs/p/planning-prd-suggestions/apply")
      .send({ approve: ["nope"], reject: [] });
    expect(res.status).toBe(200);
    expect(res.body.skipped).toContain("nope");
  });

  it("POST apply — 잘못된 body는 400", async () => {
    makePlanning("p");
    const app = await loadApp();
    const res = await request(app)
      .post("/api/docs/p/planning-prd-suggestions/apply")
      .send({ approve: "s1" }); // 배열 아님 + reject 없음
    expect(res.status).toBe(400);
  });

  it("POST apply — 경로 조작 차단(404)", async () => {
    const app = await loadApp();
    const res = await request(app)
      .post("/api/docs/..%2f..%2fetc/planning-prd-suggestions/apply")
      .send({ approve: [], reject: [] });
    expect(res.status).toBe(404);
  });

  it("POST apply — prd.md 5섹션 파싱 실패 시 422(원본 보호)", async () => {
    // prd.md를 손상(5섹션 없음)시키고 승인 요청 → writeDocsPlanningPrd false → 422.
    const planDir = join(ROOT, "broken", "docs", "planning");
    mkdirSync(planDir, { recursive: true });
    writeFileSync(join(planDir, "prd.md"), "# PRD: 손상\n\n## 개요\n\n일부만 있음.\n"); // 5섹션 아님
    writeFileSync(
      join(planDir, "prd.suggestions.json"),
      JSON.stringify({ version: 1, suggestions: [{ id: "s1", section: "overview", op: "replace", proposedBody: "x" }] }),
    );
    const app = await loadApp();
    const res = await request(app)
      .post("/api/docs/broken/planning-prd-suggestions/apply")
      .send({ approve: ["s1"], reject: [] });
    expect(res.status).toBe(422);
  });
});
