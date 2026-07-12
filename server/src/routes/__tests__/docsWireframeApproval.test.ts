/**
 * 와이어 레이아웃 제안 승인/반려 + 화면별 피드백 라우트 통합 테스트
 * (planning-wireframe-generation-feedback change).
 * GET  /api/docs/:project/planning-wireframe-suggestions        (제안 큐 읽기)
 * POST /api/docs/:project/planning-wireframe-suggestions/apply  (승인·반려 적용, RW 볼륨)
 * POST /api/docs/:project/planning-wireframe-feedback           (화면별 자유 텍스트 피드백 write)
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import type { WireDoc, WireSuggestion } from "@flowforge/shared";

let ROOT: string;
let FBROOT: string;

/** 최소 유효 WireDoc(화면별 자족 HTML 문서). */
function screen(id: string, over: Partial<WireDoc> = {}): WireDoc {
  return {
    id,
    title: `화면 ${id}`,
    device: "desktop",
    html: `<!DOCTYPE html><html><body><h1>화면 ${id}</h1></body></html>`,
    ...over,
  };
}
function sug(id: string, screenId: string, docOver?: WireDoc): WireSuggestion {
  return { id, screenId, doc: docOver ?? screen(screenId) };
}

/** <ROOT>/<project>/docs/planning/{prd.md(docs 인식용), wireframe.suggestions.json} 픽스처. */
function makePlanning(project: string, sugs?: unknown[]): string {
  const planDir = join(ROOT, project, "docs", "planning");
  mkdirSync(planDir, { recursive: true });
  writeFileSync(join(planDir, "prd.md"), "# PRD\n\n## 개요\n\nx\n"); // docs 인식용
  if (sugs) {
    writeFileSync(join(planDir, "wireframe.suggestions.json"), JSON.stringify({ version: 1, suggestions: sugs }));
  }
  return planDir;
}

async function loadApp() {
  const mod = await import("../../index.js");
  return mod.app;
}

describe("와이어 승인/반려 + 피드백 API", () => {
  const ORIG_DOCS = process.env.DOCS_ROOT;
  const ORIG_FB = process.env.WIREFRAME_FEEDBACK_ROOT;

  beforeEach(() => {
    ROOT = mkdtempSync(join(tmpdir(), "wire-approval-api-"));
    FBROOT = mkdtempSync(join(tmpdir(), "wire-fbroot-api-"));
    process.env.DOCS_ROOT = ROOT;
    process.env.WIREFRAME_FEEDBACK_ROOT = FBROOT;
  });
  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    rmSync(FBROOT, { recursive: true, force: true });
    if (ORIG_DOCS === undefined) delete process.env.DOCS_ROOT;
    else process.env.DOCS_ROOT = ORIG_DOCS;
    if (ORIG_FB === undefined) delete process.env.WIREFRAME_FEEDBACK_ROOT;
    else process.env.WIREFRAME_FEEDBACK_ROOT = ORIG_FB;
  });

  // ── GET suggestions ──
  it("GET planning-wireframe-suggestions — 큐 있으면 200 + 제안 목록", async () => {
    makePlanning("p", [sug("s1", "grid")]);
    const app = await loadApp();
    const res = await request(app).get("/api/docs/p/planning-wireframe-suggestions");
    expect(res.status).toBe(200);
    expect(res.body.queue.suggestions).toHaveLength(1);
    expect(res.body.queue.suggestions[0].id).toBe("s1");
  });

  it("GET planning-wireframe-suggestions — 큐 없으면 200 + 빈 큐(404 아님)", async () => {
    makePlanning("p");
    const app = await loadApp();
    const res = await request(app).get("/api/docs/p/planning-wireframe-suggestions");
    expect(res.status).toBe(200);
    expect(res.body.queue).toEqual({ version: 1, suggestions: [] });
  });

  it("GET planning-wireframe-suggestions — 경로 조작 차단(404)", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/..%2f..%2fetc/planning-wireframe-suggestions");
    expect(res.status).toBe(404);
  });

  // ── GET planning-wireframe (렌더 원천 = HTML 문서, flowforge-wireframe-iframe) ──
  it("GET planning-wireframe — 각 화면이 좌표 없는 요소 배열이 아니라 id·title·device·html을 담는다", async () => {
    makePlanning("p");
    const app = await loadApp();
    const res = await request(app).get("/api/docs/p/planning-wireframe");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.screens)).toBe(true);
    for (const s of res.body.screens as WireDoc[]) {
      expect(typeof s.id).toBe("string");
      expect(typeof s.title).toBe("string");
      expect(["desktop", "mobile"]).toContain(s.device);
      expect(typeof s.html).toBe("string");
      // 폐기된 요소 배열 스키마(regions/elements)가 응답에 없다.
      expect((s as unknown as Record<string, unknown>)["regions"]).toBeUndefined();
    }
  });

  // ── POST apply ──
  it("POST apply — 단일 승인 시 승인분 반영 + 결과 반환", async () => {
    makePlanning("p", [sug("s1", "grid", screen("grid", { title: "새 그리드" }))]);
    const app = await loadApp();
    const res = await request(app).post("/api/docs/p/planning-wireframe-suggestions/apply").send({ approve: ["s1"], reject: [] });
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(1);
    expect(res.body.remaining).toBe(0);
    // 승인분이 RW 볼륨에 저장됨 → 이후 planning-wireframe GET이 그걸 반환.
    const wf = await request(app).get("/api/docs/p/planning-wireframe");
    expect(wf.body.screens.find((s: WireDoc) => s.id === "grid")?.title).toBe("새 그리드");
  });

  it("POST apply — 반려 시 원천 불변(큐에서만 제거)", async () => {
    makePlanning("p", [sug("s1", "grid", screen("grid", { title: "반려될 제목" }))]);
    const app = await loadApp();
    const res = await request(app).post("/api/docs/p/planning-wireframe-suggestions/apply").send({ approve: [], reject: ["s1"] });
    expect(res.status).toBe(200);
    expect(res.body.rejected).toBe(1);
    // 승인분 미기록 → planning-wireframe은 픽스처 원본(grid 제목).
    const wf = await request(app).get("/api/docs/p/planning-wireframe");
    expect(wf.body.screens.find((s: WireDoc) => s.id === "grid")?.title).toBe("프로젝트 목록");
  });

  it("POST apply — 미실재 id는 skipped로 표면화", async () => {
    makePlanning("p", [sug("s1", "grid")]);
    const app = await loadApp();
    const res = await request(app).post("/api/docs/p/planning-wireframe-suggestions/apply").send({ approve: ["nope"], reject: [] });
    expect(res.status).toBe(200);
    expect(res.body.skipped).toContain("nope");
  });

  it("POST apply — 잘못된 body는 400", async () => {
    makePlanning("p");
    const app = await loadApp();
    const res = await request(app).post("/api/docs/p/planning-wireframe-suggestions/apply").send({ approve: "s1" });
    expect(res.status).toBe(400);
  });

  it("POST apply — 경로 조작 차단(404)", async () => {
    const app = await loadApp();
    const res = await request(app).post("/api/docs/..%2f..%2fetc/planning-wireframe-suggestions/apply").send({ approve: [], reject: [] });
    expect(res.status).toBe(404);
  });

  it("POST apply — 신규 화면 id 승인은 화면 집합 위반 → 422(원본 보호)", async () => {
    makePlanning("p", [sug("s1", "brand-new", screen("brand-new"))]);
    const app = await loadApp();
    const res = await request(app).post("/api/docs/p/planning-wireframe-suggestions/apply").send({ approve: ["s1"], reject: [] });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("wireframe_write_failed");
  });

  it("POST apply — 배치 상한(201건) 초과 시 400", async () => {
    makePlanning("p", [sug("s1", "grid")]);
    const app = await loadApp();
    const approve = Array.from({ length: 201 }, (_, i) => `x${i}`);
    const res = await request(app).post("/api/docs/p/planning-wireframe-suggestions/apply").send({ approve, reject: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("batch_too_large");
  });

  // ── POST feedback (인플레이스 핀 — 좌표 포함, D2 정정) ──
  it("POST feedback — 좌표를 찍어 핀 피드백 남기면 200 + 사이드카 append(좌표·region 포함)", async () => {
    makePlanning("p");
    const app = await loadApp();
    const res = await request(app)
      .post("/api/docs/p/planning-wireframe-feedback")
      .send({ screenId: "grid", text: "하단을 탭바로 바꿔줘", xPct: 50, yPct: 90, region: "하단 메뉴바" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const items = JSON.parse(readFileSync(join(FBROOT, "p.feedback.json"), "utf-8")) as {
      screenId: string;
      text: string;
      ts: string;
      xPct: number;
      yPct: number;
      region?: string;
    }[];
    expect(items).toHaveLength(1);
    expect(items[0]?.screenId).toBe("grid");
    expect(items[0]?.text).toBe("하단을 탭바로 바꿔줘");
    expect(items[0]?.xPct).toBe(50);
    expect(items[0]?.yPct).toBe(90);
    expect(items[0]?.region).toBe("하단 메뉴바");
    expect(typeof items[0]?.ts).toBe("string");
  });

  it("POST feedback — 빈 텍스트는 400(쓰레기 방지), 파일 미기록", async () => {
    makePlanning("p");
    const app = await loadApp();
    const res = await request(app).post("/api/docs/p/planning-wireframe-feedback").send({ screenId: "grid", text: "   ", xPct: 50, yPct: 50 });
    expect(res.status).toBe(400);
    expect(existsSync(join(FBROOT, "p.feedback.json"))).toBe(false);
  });

  it("POST feedback — 좌표 없으면 400(좌표는 필수 — 지점 단위 피드백)", async () => {
    makePlanning("p");
    const app = await loadApp();
    const res = await request(app).post("/api/docs/p/planning-wireframe-feedback").send({ screenId: "grid", text: "x" });
    expect(res.status).toBe(400);
    expect(existsSync(join(FBROOT, "p.feedback.json"))).toBe(false);
  });

  it("POST feedback — 좌표가 0~100 범위 밖이면 400, 파일 미기록", async () => {
    makePlanning("p");
    const app = await loadApp();
    const res = await request(app).post("/api/docs/p/planning-wireframe-feedback").send({ screenId: "grid", text: "x", xPct: 150, yPct: 50 });
    expect(res.status).toBe(400);
    expect(existsSync(join(FBROOT, "p.feedback.json"))).toBe(false);
  });

  it("POST feedback — 잘못된 body(screenId 없음)는 400", async () => {
    makePlanning("p");
    const app = await loadApp();
    const res = await request(app).post("/api/docs/p/planning-wireframe-feedback").send({ text: "x", xPct: 5, yPct: 5 });
    expect(res.status).toBe(400);
  });

  it("POST feedback — 경로 조작 차단(404)", async () => {
    const app = await loadApp();
    const res = await request(app).post("/api/docs/..%2f..%2fetc/planning-wireframe-feedback").send({ screenId: "grid", text: "x", xPct: 5, yPct: 5 });
    expect(res.status).toBe(404);
  });

  // ── GET feedback + PATCH resolve/update (flowforge-pin-feedback-lifecycle) ──
  it("GET feedback — 저장된 피드백 배열을 반환한다(id·status 포함)", async () => {
    makePlanning("p");
    const app = await loadApp();
    await request(app).post("/api/docs/p/planning-wireframe-feedback").send({ screenId: "grid", text: "남긴 것", xPct: 10, yPct: 20 });
    const res = await request(app).get("/api/docs/p/planning-wireframe-feedback");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].text).toBe("남긴 것");
    expect(res.body.items[0].status).toBe("open");
    expect(typeof res.body.items[0].id).toBe("string");
  });

  it("GET feedback — 파일 없으면 빈 배열(404 아님)", async () => {
    makePlanning("p");
    const app = await loadApp();
    const res = await request(app).get("/api/docs/p/planning-wireframe-feedback");
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("GET feedback — 경로 조작 차단(404)", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/..%2f..%2fetc/planning-wireframe-feedback");
    expect(res.status).toBe(404);
  });

  it("PATCH feedback/:id — resolve로 status 갱신 200", async () => {
    makePlanning("p");
    const app = await loadApp();
    await request(app).post("/api/docs/p/planning-wireframe-feedback").send({ screenId: "grid", text: "x", xPct: 5, yPct: 5 });
    const list = await request(app).get("/api/docs/p/planning-wireframe-feedback");
    const id = list.body.items[0].id as string;
    const res = await request(app).patch(`/api/docs/p/planning-wireframe-feedback/${id}`).send({ status: "resolved" });
    expect(res.status).toBe(200);
    const after = await request(app).get("/api/docs/p/planning-wireframe-feedback");
    expect(after.body.items[0].status).toBe("resolved");
  });

  it("PATCH feedback/:id — text in-place 수정, 배열 길이 불변", async () => {
    makePlanning("p");
    const app = await loadApp();
    await request(app).post("/api/docs/p/planning-wireframe-feedback").send({ screenId: "grid", text: "원본", xPct: 5, yPct: 5 });
    const list = await request(app).get("/api/docs/p/planning-wireframe-feedback");
    const id = list.body.items[0].id as string;
    const res = await request(app).patch(`/api/docs/p/planning-wireframe-feedback/${id}`).send({ text: "수정본" });
    expect(res.status).toBe(200);
    const after = await request(app).get("/api/docs/p/planning-wireframe-feedback");
    expect(after.body.items).toHaveLength(1); // 중복 없음
    expect(after.body.items[0].text).toBe("수정본");
    expect(after.body.items[0].xPct).toBe(5); // 좌표 보존
  });

  it("PATCH feedback/:id — 존재하지 않는 id는 404", async () => {
    makePlanning("p");
    const app = await loadApp();
    await request(app).post("/api/docs/p/planning-wireframe-feedback").send({ screenId: "grid", text: "x", xPct: 5, yPct: 5 });
    const res = await request(app).patch("/api/docs/p/planning-wireframe-feedback/nope-id").send({ status: "resolved" });
    expect(res.status).toBe(404);
  });

  it("PATCH feedback/:id — status 화이트리스트 밖 값은 400", async () => {
    makePlanning("p");
    const app = await loadApp();
    await request(app).post("/api/docs/p/planning-wireframe-feedback").send({ screenId: "grid", text: "x", xPct: 5, yPct: 5 });
    const list = await request(app).get("/api/docs/p/planning-wireframe-feedback");
    const id = list.body.items[0].id as string;
    const res = await request(app).patch(`/api/docs/p/planning-wireframe-feedback/${id}`).send({ status: "archived" });
    expect(res.status).toBe(400);
  });

  it("PATCH feedback/:id — 빈 text는 400", async () => {
    makePlanning("p");
    const app = await loadApp();
    await request(app).post("/api/docs/p/planning-wireframe-feedback").send({ screenId: "grid", text: "x", xPct: 5, yPct: 5 });
    const list = await request(app).get("/api/docs/p/planning-wireframe-feedback");
    const id = list.body.items[0].id as string;
    const res = await request(app).patch(`/api/docs/p/planning-wireframe-feedback/${id}`).send({ text: "   " });
    expect(res.status).toBe(400);
  });

  it("PATCH feedback/:id — 경로 조작 차단(404)", async () => {
    const app = await loadApp();
    const res = await request(app).patch("/api/docs/..%2f..%2fetc/planning-wireframe-feedback/x").send({ status: "resolved" });
    expect(res.status).toBe(404);
  });

  // ── 재생성 격리(D6): 그 화면만 갱신, 타 화면 승인분 불변 ──
  it("재생성 격리 — 큐 갱신 후 승인하면 그 화면만 바뀌고 타 화면은 불변(D6)", async () => {
    // 1) grid만 먼저 승인(승인분 원천 생성).
    makePlanning("p", [sug("s1", "grid", screen("grid", { title: "그리드 v1" }))]);
    const app = await loadApp();
    await request(app).post("/api/docs/p/planning-wireframe-suggestions/apply").send({ approve: ["s1"], reject: [] });
    // 2) 스킬이 재생성해 큐 갱신 시뮬(skeleton만 새 제안). 큐 파일을 덮어쓴다.
    writeFileSync(
      join(ROOT, "p", "docs", "planning", "wireframe.suggestions.json"),
      JSON.stringify({ version: 1, suggestions: [sug("s2", "skeleton", screen("skeleton", { title: "기획뷰 v2" }))] }),
    );
    // 3) 재조회+승인 → skeleton만 갱신, grid는 v1 유지(타 화면 불변).
    await request(app).post("/api/docs/p/planning-wireframe-suggestions/apply").send({ approve: ["s2"], reject: [] });
    const wf = await request(app).get("/api/docs/p/planning-wireframe");
    const byId = new Map(wf.body.screens.map((s: WireDoc) => [s.id, s]));
    expect((byId.get("skeleton") as WireDoc)?.title).toBe("기획뷰 v2");
    expect((byId.get("grid") as WireDoc)?.title).toBe("그리드 v1"); // 이전 승인분 불변
  });
});
