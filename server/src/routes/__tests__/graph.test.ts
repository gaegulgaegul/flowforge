/**
 * graph API 통합 테스트 — wowa-app openspec을 스캔 루트로 실제 change 그래프 검증.
 * 레이아웃 저장은 격리 임시 루트(spec.md 오염 방지)로.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";

const WOWA_OPENSPEC = "/home/gaegul/wowa-app/openspec";

async function loadApp() {
  // OPENSPEC_ROOT를 세팅한 뒤 app을 import해야 changesRoot가 반영
  const mod = await import("../../index.js");
  return mod.app;
}

describe("graph API", () => {
  beforeAll(() => {
    process.env.OPENSPEC_ROOT = WOWA_OPENSPEC;
  });

  it("GET /api/changes — change 목록에 archive change 포함", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/changes");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.changes)).toBe(true);
    expect(res.body.changes).toContain("archive/2026-06-18-extract-wod-photo-logger");
  });

  it("GET /api/changes/:id/graph — SpecGraph 형식 + dangling 보존", async () => {
    const app = await loadApp();
    const res = await request(app).get(
      "/api/changes/archive/2026-06-18-extract-wod-photo-logger/graph",
    );
    expect(res.status).toBe(200);
    expect(res.body.graph.nodes.length).toBeGreaterThanOrEqual(1);
    // shared 계약 형식
    const node = res.body.graph.nodes[0];
    expect(node).toHaveProperty("id");
    expect(node).toHaveProperty("kind", "screen");
    expect(node).toHaveProperty("label");
    // dangling 엣지는 target null
    const dangling = res.body.graph.edges.filter((e: { dangling: boolean }) => e.dangling);
    expect(dangling.length).toBeGreaterThanOrEqual(1);
    for (const e of dangling) expect(e.target).toBeNull();
  });

  it("GET 존재하지 않는 change → 404", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/changes/nope-not-real/graph");
    expect(res.status).toBe(404);
  });

  it("경로 조작(..) 차단 → 404", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/changes/..%2f..%2fetc/graph");
    expect(res.status).toBe(404);
  });

  it("PUT /api/changes/:id/layout — 격리 루트에 오버레이 저장", async () => {
    // 임시 openspec 루트에 가짜 change 생성(실 spec.md 오염 방지)
    const tmp = mkdtempSync(join(tmpdir(), "mf-test-"));
    const changeDir = join(tmp, "changes", "demo");
    mkdirSync(join(changeDir, "specs", "scr-a"), { recursive: true });
    writeFileSync(
      join(changeDir, "specs", "scr-a", "spec.md"),
      "### Requirement: 화면 A\n#### Scenario: 진입\n- **WHEN** 탭한다\n- **THEN** 화면에 표시한다 화면 위젯 버튼\n",
    );
    process.env.OPENSPEC_ROOT = tmp;
    const app = await loadApp();
    const res = await request(app)
      .put("/api/changes/demo/layout")
      .send({ "screen-scr-a": { x: 100, y: 200 } });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // 파일 영속 확인
    const overlay = join(changeDir, "viz", "graph-overlay.json");
    expect(existsSync(overlay)).toBe(true);
    expect(JSON.parse(readFileSync(overlay, "utf-8"))["screen-scr-a"]).toEqual({ x: 100, y: 200 });
    rmSync(tmp, { recursive: true, force: true });
    process.env.OPENSPEC_ROOT = WOWA_OPENSPEC;
  });

  it("PUT 잘못된 레이아웃 형식 → 400", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "mf-test-"));
    const changeDir = join(tmp, "changes", "demo");
    mkdirSync(join(changeDir, "specs", "scr-a"), { recursive: true });
    writeFileSync(
      join(changeDir, "specs", "scr-a", "spec.md"),
      "### Requirement: 화면 A\n#### Scenario: 진입\n- **THEN** 화면에 표시한다 위젯 버튼\n",
    );
    process.env.OPENSPEC_ROOT = tmp;
    const app = await loadApp();
    const res = await request(app)
      .put("/api/changes/demo/layout")
      .send({ "screen-scr-a": { x: "nope" } });
    expect(res.status).toBe(400);
    rmSync(tmp, { recursive: true, force: true });
    process.env.OPENSPEC_ROOT = WOWA_OPENSPEC;
  });

  it("GET /api/changes/:id/prd — proposal+design 있는 change는 5섹션 채움", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/changes/implement-ios-app/prd");
    expect(res.status).toBe(200);
    expect(res.body.prd.sections).toHaveLength(5);
    const keys = res.body.prd.sections.map((s: { key: string }) => s.key);
    expect(keys).toEqual(["overview", "value", "target", "metrics", "attributes"]);
    // implement-ios-app엔 proposal(Why/What Changes/Impact)+design 모두 있어 핵심 섹션이 채워짐
    const overview = res.body.prd.sections.find((s: { key: string }) => s.key === "overview");
    expect(overview.empty).toBe(false);
    expect(typeof overview.body).toBe("string");
    expect(overview.body.length).toBeGreaterThan(0);
  });

  it("GET /api/changes/:id/spec-tree — capability→feature→detail 3단, Scenario를 노드로 펼침", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/changes/implement-ios-app/spec-tree");
    expect(res.status).toBe(200);
    const root = res.body.tree;
    expect(root.kind).toBe("change");
    expect(root.children.length).toBeGreaterThanOrEqual(1);
    const cap = root.children[0];
    expect(cap.kind).toBe("requirement");
    const feature = cap.children.find((f: { children: unknown[] }) => f.children.length > 0);
    expect(feature.kind).toBe("feature");
    // 상세기능(Scenario) 노드는 detail이고 when/then을 가진다(count가 아니라 펼쳐진 노드)
    const detail = feature.children[0];
    expect(detail.kind).toBe("detail");
    expect(typeof detail.when).toBe("string");
    expect(typeof detail.then).toBe("string");
  });

  it("GET 존재하지 않는 change → prd/spec-tree 404", async () => {
    const app = await loadApp();
    const prd = await request(app).get("/api/changes/nope-not-real/prd");
    const tree = await request(app).get("/api/changes/nope-not-real/spec-tree");
    expect(prd.status).toBe(404);
    expect(tree.status).toBe(404);
  });
});
