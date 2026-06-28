/**
 * docs API 통합 테스트 — DOCS_ROOT를 임시 픽스처 루트로 잡고 supertest로 검증.
 * /api/docs/projects + graph/wireframe/prd 3종 + 404 + 경로 조작 차단.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";

let ROOT: string;

/** <ROOT>/<project>/docs/<file> 픽스처. */
function makeProject(project: string, files: Record<string, string>): void {
  const docsDir = join(ROOT, project, "docs");
  mkdirSync(docsDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(docsDir, name), content);
  }
}

// 노드 id = 'screen-'+slug(명). slug는 영숫자만 살리므로 라틴 화면명으로 구별되는 id를 검증.
const USER_FLOW = [
  "# 유저 플로우",
  "> ⚠️ SEED — 초안.",
  "## flow: login",
  "### 화면: Login (LoginScreen, /login)",
  "- step: 이메일 입력",
  "- step: 로그인 버튼",
  "- goto: (POST /api/auth/login)",
  "- goto: Home (HomeScreen)",
  "### 화면: Home (HomeScreen, /)",
  "- step: 사진 목록",
].join("\n");

const PRD = [
  "# PRD",
  "> ⚠️ SEED — 초안.",
  "## decision: 초대코드 필수 가입",
  "- date: 2026-06-24",
  "- capability: register",
  "- status: active",
].join("\n");

// planning-only 프로젝트용 manyfast 5섹션 PRD(charter 문서 없이 이것만 있어야 함).
const PLANNING_PRD = [
  "# 제품 요구사항",
  "## 개요",
  "planning-only 인식 검증용 PRD.",
  "## 핵심가치",
  "charter 없이 기획만으로 인식.",
  "## 타겟·시나리오",
  "기획 단계 사용자.",
  "## 성공지표",
  "planning-prd API 200.",
  "## 속성설정",
  "읽기전용.",
].join("\n");

// 기획 기능명세서(features.md) — 3단 트리 + capability 키 + 속성.
const PLANNING_FEATURES = [
  "# 기능명세서",
  "## 사진 업로드",
  "<!-- capability: photo-upload -->",
  "(중요도: 높음, 상태: 진행중)",
  "### 단일 업로드",
  "(중요도: 중간, 상태: 시작전)",
  "#### 파일 선택",
].join("\n");

// 기획 유저플로우(user-flow/main-v1.md) — Mermaid flowchart.
const PLANNING_USERFLOW = [
  "# 유저 플로우",
  "```mermaid",
  "flowchart TD",
  '  A(["시작"]) --> B["로그인"]',
  '  B -->|성공| C["홈"]',
  "```",
].join("\n");

async function loadApp() {
  const mod = await import("../../index.js");
  return mod.app;
}

describe("docs API", () => {
  const ORIG = process.env.DOCS_ROOT;

  beforeAll(() => {
    ROOT = mkdtempSync(join(tmpdir(), "docs-api-"));
    makeProject("ssok", { "user-flow.md": USER_FLOW, "PRD.md": PRD });
    makeProject("only-prd", { "PRD.md": PRD });
    // planning-only 프로젝트: charter 문서 없이 docs/planning/prd.md + features.md (하위 디렉토리 필요).
    const planonlyDir = join(ROOT, "planonly", "docs", "planning");
    mkdirSync(planonlyDir, { recursive: true });
    writeFileSync(join(planonlyDir, "prd.md"), PLANNING_PRD);
    writeFileSync(join(planonlyDir, "features.md"), PLANNING_FEATURES);
    const uflowDir = join(planonlyDir, "user-flow");
    mkdirSync(uflowDir, { recursive: true });
    writeFileSync(join(uflowDir, "main-v1.md"), PLANNING_USERFLOW);
    // docs 없는 프로젝트(스캔에서 제외돼야 함)
    mkdirSync(join(ROOT, "empty", "docs"), { recursive: true });
    writeFileSync(join(ROOT, "empty", "docs", "notes.md"), "x");
    process.env.DOCS_ROOT = ROOT;
  });

  afterAll(() => {
    rmSync(ROOT, { recursive: true, force: true });
    if (ORIG === undefined) delete process.env.DOCS_ROOT;
    else process.env.DOCS_ROOT = ORIG;
  });

  it("GET /api/docs/projects — charter + planning-only 프로젝트 목록(empty 제외)", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/projects");
    expect(res.status).toBe(200);
    // charter(only-prd, ssok) + planning-only(planonly) 모두 포함, docs없는 empty는 제외, 정렬.
    expect(res.body.projects).toEqual(["only-prd", "planonly", "ssok"]);
  });

  it("planning-only 프로젝트(planning/prd.md만)도 planning-prd가 200+5섹션", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/planonly/planning-prd");
    expect(res.status).toBe(200); // 인식 실패였다면 404였을 것(예광탄 빚 해소 확인)
    expect(res.body.project).toBe("planonly");
    expect(res.body.prd.sections).toHaveLength(5);
    const overview = res.body.prd.sections.find((s: { key: string }) => s.key === "overview");
    expect(overview.body).toContain("planning-only 인식 검증용");
    expect(overview.empty).toBe(false);
  });

  it("GET /api/docs/:project/planning-features — 3단 트리 + capability + 속성으로 200", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/planonly/planning-features");
    expect(res.status).toBe(200);
    expect(res.body.project).toBe("planonly");
    const reqs = res.body.tree.root.children;
    expect(reqs).toHaveLength(1);
    expect(reqs[0].kind).toBe("requirement");
    expect(reqs[0].label).toBe("사진 업로드");
    expect(reqs[0].capability).toBe("photo-upload");
    expect(reqs[0].priority).toBe("높음");
    expect(reqs[0].status).toBe("진행중");
    // 3단 위계: 요구사항 → 기능 → 상세기능
    expect(reqs[0].children[0].label).toBe("단일 업로드");
    expect(reqs[0].children[0].children[0].label).toBe("파일 선택");
  });

  it("planning-features — features.md 없는 프로젝트는 404", async () => {
    const app = await loadApp();
    // ssok은 charter 문서만 있고 planning/features.md 없음
    const res = await request(app).get("/api/docs/ssok/planning-features");
    expect(res.status).toBe(404);
  });

  it("planning-features — 경로 조작(..) 차단 404", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/..%2f..%2fetc/planning-features");
    expect(res.status).toBe(404);
  });

  it("GET /api/docs/:project/planning-user-flow — Mermaid → SpecGraph + layout + versions", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/planonly/planning-user-flow?flow=main-v1");
    expect(res.status).toBe(200);
    expect(res.body.project).toBe("planonly");
    // 노드 3개(시작/로그인/홈), 엣지 2개
    expect(res.body.graph.nodes).toHaveLength(3);
    expect(res.body.graph.edges).toHaveLength(2);
    expect(res.body.layout).toEqual({}); // 저장 전 빈 layout
    expect(res.body.versions).toContain("main-v1"); // 버전 목록
  });

  it("PUT planning-user-flow/layout — 좌표 저장 후 재조회 반영", async () => {
    const app = await loadApp();
    // graph에서 첫 노드 id 얻기
    const g = await request(app).get("/api/docs/planonly/planning-user-flow?flow=main-v1");
    const nodeId = g.body.graph.nodes[0].id as string;
    const put = await request(app)
      .put("/api/docs/planonly/planning-user-flow/layout?flow=main-v1")
      .send({ [nodeId]: { x: 123, y: 456 } });
    expect(put.status).toBe(200);
    // 재조회 시 저장 좌표 반영
    const re = await request(app).get("/api/docs/planonly/planning-user-flow?flow=main-v1");
    expect(re.body.layout[nodeId]).toEqual({ x: 123, y: 456 });
  });

  it("planning-user-flow — 파일 없으면 404", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/planonly/planning-user-flow?flow=nope-v9");
    expect(res.status).toBe(404);
  });

  it("planning-user-flow — 경로 조작(..) 차단 404", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/..%2f..%2fetc/planning-user-flow?flow=main-v1");
    expect(res.status).toBe(404);
  });

  it("planning-user-flow/layout — 잘못된 body 거부 400", async () => {
    const app = await loadApp();
    const res = await request(app)
      .put("/api/docs/planonly/planning-user-flow/layout?flow=main-v1")
      .send({ bad: "not-a-coordinate" });
    expect(res.status).toBe(400);
  });

  it("GET /api/docs/:project/graph — SpecGraph + dangling/endpoint 엣지", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/ssok/graph");
    expect(res.status).toBe(200);
    expect(res.body.project).toBe("ssok");
    const ids = res.body.graph.nodes.map((n: { id: string }) => n.id);
    expect(ids).toEqual(["screen-login", "screen-home"]);
    // SEED 전파
    expect(res.body.graph.nodes.every((n: { seed?: boolean }) => n.seed === true)).toBe(true);
    // endpoint 엣지
    const ep = res.body.graph.edges.find(
      (e: { label: string }) => e.label === "POST /api/auth/login",
    );
    expect(ep.target).toBeNull();
    expect(ep.dangling).toBe(false);
    // 정의 화면 연결 엣지
    const toHome = res.body.graph.edges.find(
      (e: { target: string | null }) => e.target === "screen-home",
    );
    expect(toHome.dangling).toBe(false);
  });

  it("GET /api/docs/:project/wireframe — step 박스 + boxKind", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/ssok/wireframe");
    expect(res.status).toBe(200);
    const login = res.body.wireframe.screens.find((s: { id: string }) => s.id === "screen-login");
    const kinds = login.boxes.map((b: { kind: string }) => b.kind);
    expect(kinds).toEqual(["field", "button"]); // "이메일 입력"=field, "로그인 버튼"=button
    expect(login.seed).toBe(true);
  });

  it("GET /api/docs/:project/prd — decision 타임라인", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/ssok/prd");
    expect(res.status).toBe(200);
    expect(res.body.timeline.decisions).toHaveLength(1);
    const d = res.body.timeline.decisions[0];
    expect(d.id).toBe("초대코드 필수 가입");
    expect(d.capability).toBe("register");
    expect(d.seed).toBe(true);
  });

  it("PRD.md만 있는 프로젝트도 graph/wireframe는 빈 결과로 200", async () => {
    const app = await loadApp();
    const g = await request(app).get("/api/docs/only-prd/graph");
    expect(g.status).toBe(200);
    expect(g.body.graph).toEqual({ nodes: [], edges: [] });
    const w = await request(app).get("/api/docs/only-prd/wireframe");
    expect(w.status).toBe(200);
    expect(w.body.wireframe.screens).toEqual([]);
  });

  it("존재하지 않는 프로젝트 → 404 docs_not_found", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/nope-not-real/graph");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("docs_not_found");
  });

  it("경로 조작(..) 차단 → 404", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/..%2f..%2fetc/graph");
    expect(res.status).toBe(404);
  });
});
