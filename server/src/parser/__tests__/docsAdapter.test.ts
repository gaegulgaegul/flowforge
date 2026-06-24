/**
 * docsAdapter 단위 테스트 — charter docs → @flowforge/shared 계약 변환.
 * 임시 docs 디렉토리에 user-flow.md / PRD.md / wireframe.html 픽스처를 써서 검증.
 */
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildDocsGraph,
  buildDocsWireframe,
  buildDocsDecisionTimeline,
} from "../docsAdapter.js";

/** 임시 docs 디렉토리 + 파일 작성. */
function makeDocsDir(files: { userFlow?: string; prd?: string; wireframeHtml?: string }): string {
  const dir = mkdtempSync(join(tmpdir(), "docs-adapter-"));
  if (files.userFlow !== undefined) writeFileSync(join(dir, "user-flow.md"), files.userFlow);
  if (files.prd !== undefined) writeFileSync(join(dir, "PRD.md"), files.prd);
  if (files.wireframeHtml !== undefined) {
    writeFileSync(join(dir, "wireframe.html"), files.wireframeHtml);
  }
  return dir;
}

// 화면명은 slug(명)으로 노드 id가 되는데, slug는 영숫자만 살린다(specParser.slug 재사용,
// 설계 D3 결정). 그래서 노드 id가 화면별로 구별되려면 화면명에 라틴 토큰이 있어야 한다.
// 아래 SEED_FLOW는 라틴 화면명(Login/Home)으로 구별되는 id를 검증한다.
const SEED_FLOW = [
  "# 유저 플로우",
  "> ⚠️ SEED — 초안.",
  "",
  "## flow: login",
  "### 화면: Login (LoginScreen, /login)",
  "- step: 이메일 입력",
  "- step: 로그인 버튼",
  "- goto: (POST /api/auth/login)",
  "- goto: Home (HomeScreen)",
  "### 화면: Home (HomeScreen, /)",
  "- step: 사진 목록",
  "- goto: Ghost (GhostScreen)",
].join("\n");

describe("buildDocsGraph", () => {
  it("화면을 GraphNode로 만들고 SEED를 전파한다 (id='screen-'+docsSlug(명))", () => {
    const dir = makeDocsDir({ userFlow: SEED_FLOW });
    try {
      const g = buildDocsGraph(dir);
      const ids = g.nodes.map((n) => n.id);
      expect(ids).toEqual(["screen-login", "screen-home"]);
      const login = g.nodes.find((n) => n.id === "screen-login")!;
      expect(login.kind).toBe("screen");
      expect(login.label).toBe("Login");
      expect(login.specName).toBe("Login");
      expect(login.seed).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("한글 화면명도 보존된 유일 id를 만든다 (ReactFlow 노드 id 유일성 — 회귀가드)", () => {
    // charter 화면명은 대부분 한글. specParser.slug는 비영숫자를 죽여 전부 'screen-x'로 충돌했고
    // (쏙쏙 실데이터 9화면→id 1개 검증) ReactFlow가 깨졌다 → docsSlug는 한글을 보존해 유일성을 보장한다.
    const koFlow = [
      "## flow: f",
      "### 화면: 홈 (HomeScreen, /)",
      "- step: 목록",
      "### 화면: 사진 상세 (PhotoDetailScreen, /p)",
      "- step: 표시",
    ].join("\n");
    const dir = makeDocsDir({ userFlow: koFlow });
    try {
      const g = buildDocsGraph(dir);
      const ids = g.nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length); // 모두 유일
      expect(ids).toEqual(["screen-홈", "screen-사진-상세"]); // 한글 보존, 공백→'-'
      expect(g.nodes[0]!.label).toBe("홈"); // 라벨은 원문 보존
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("동명 화면은 첫 등장 1개 노드로 합치고 id가 유일하다", () => {
    const dupFlow = [
      "## flow: a",
      "### 화면: 홈 (HomeScreen, /)",
      "- step: 목록",
      "## flow: b",
      "### 화면: 홈 (HomeScreen, /)",
      "- step: 표시",
    ].join("\n");
    const dir = makeDocsDir({ userFlow: dupFlow });
    try {
      const g = buildDocsGraph(dir);
      expect(g.nodes.map((n) => n.id)).toEqual(["screen-홈"]); // 동명=1노드
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("정의된 화면을 가리키는 화면 goto → dangling:false 엣지(slug 매칭)", () => {
    const dir = makeDocsDir({ userFlow: SEED_FLOW });
    try {
      const g = buildDocsGraph(dir);
      const toHome = g.edges.find(
        (e) => e.source === "screen-login" && e.target === "screen-home",
      )!;
      expect(toHome).toBeDefined();
      expect(toHome.dangling).toBe(false);
      expect(toHome.label).toBe("Home");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("정의되지 않은 화면을 가리키는 화면 goto → dangling:true / target:null", () => {
    const dir = makeDocsDir({ userFlow: SEED_FLOW });
    try {
      const g = buildDocsGraph(dir);
      const ghost = g.edges.find((e) => e.source === "screen-home" && e.dangling)!;
      expect(ghost).toBeDefined();
      expect(ghost.target).toBeNull();
      expect(ghost.label).toBe("Ghost");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("endpoint goto → target:null / dangling:false / label='METHOD /path' 엣지", () => {
    const dir = makeDocsDir({ userFlow: SEED_FLOW });
    try {
      const g = buildDocsGraph(dir);
      const ep = g.edges.find((e) => e.label === "POST /api/auth/login")!;
      expect(ep).toBeDefined();
      expect(ep.source).toBe("screen-login");
      expect(ep.target).toBeNull();
      expect(ep.dangling).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("엣지 id는 유일하고 중복 엣지는 자연 제거된다", () => {
    const dup = [
      "## flow: f",
      "### 화면: A (CompA, /a)",
      "- goto: B (CompB)",
      "- goto: B (CompB)",
      "### 화면: B (CompB, /b)",
      "- step: s",
    ].join("\n");
    const dir = makeDocsDir({ userFlow: dup });
    try {
      const g = buildDocsGraph(dir);
      const ids = g.edges.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length); // 모든 id 유일
      const aToB = g.edges.filter((e) => e.source === "screen-a" && e.target === "screen-b");
      expect(aToB).toHaveLength(1); // 같은 엣지 중복 제거
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("user-flow.md가 없으면 빈 그래프", () => {
    const dir = makeDocsDir({ prd: "## decision: D1\n- status: active" });
    try {
      expect(buildDocsGraph(dir)).toEqual({ nodes: [], edges: [] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("buildDocsWireframe", () => {
  // boxKind 키워드 클래스별 검증(charter_wireframe.py 규칙과 EXACT).
  const KIND_FLOW = [
    "## flow: f",
    "### 화면: 화면 (Comp, /x)",
    "- step: 사진 목록 표시", // list (목록 우선 — '표시'보다 먼저)
    "- step: 저장 버튼", // button
    "- step: 기록 없음", // empty
    "- step: 제목 헤더", // header
    "- step: 그냥 텍스트", // field
    "- step: 클릭하여 전송", // button (클릭/전송 키워드)
  ].join("\n");

  it("step을 박스로 만들고 boxKind를 키워드 규칙대로 판정한다", () => {
    const dir = makeDocsDir({ userFlow: KIND_FLOW });
    try {
      const wf = buildDocsWireframe(dir);
      expect(wf.screens).toHaveLength(1);
      const kinds = wf.screens[0]!.boxes.map((b) => b.kind);
      expect(kinds).toEqual(["list", "button", "empty", "header", "field", "button"]);
      const labels = wf.screens[0]!.boxes.map((b) => b.label);
      expect(labels[0]).toBe("사진 목록 표시");
      // 모든 박스는 goto:null / dangling:false
      expect(wf.screens[0]!.boxes.every((b) => b.goto === null && b.dangling === false)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("SEED를 화면·박스에 전파한다", () => {
    const dir = makeDocsDir({ userFlow: SEED_FLOW });
    try {
      const wf = buildDocsWireframe(dir);
      const login = wf.screens.find((s) => s.id === "screen-login")!;
      expect(login.seed).toBe(true);
      expect(login.boxes.every((b) => b.seed === true)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("SEED가 아니면 seed 미세팅", () => {
    const noSeed = ["## flow: f", "### 화면: A (C, /a)", "- step: x"].join("\n");
    const dir = makeDocsDir({ userFlow: noSeed });
    try {
      const wf = buildDocsWireframe(dir);
      expect(wf.screens[0]!.seed).toBeUndefined();
      expect(wf.screens[0]!.boxes[0]!.seed).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("wireframe.html이 있으면 originalHtml:true, 없으면 미세팅", () => {
    const flow = ["## flow: f", "### 화면: A (C, /a)", "- step: x"].join("\n");
    const withHtml = makeDocsDir({ userFlow: flow, wireframeHtml: "<html></html>" });
    const without = makeDocsDir({ userFlow: flow });
    try {
      expect(buildDocsWireframe(withHtml).originalHtml).toBe(true);
      expect(buildDocsWireframe(without).originalHtml).toBeUndefined();
    } finally {
      rmSync(withHtml, { recursive: true, force: true });
      rmSync(without, { recursive: true, force: true });
    }
  });
});

describe("buildDocsDecisionTimeline", () => {
  it("PRD.md를 시간순 decision 타임라인으로 변환한다", () => {
    const prd = [
      "# PRD",
      "## decision: D1",
      "- date: 2026-01-01",
      "- capability: a",
      "- status: active",
      "## decision: D2",
      "- date: 2026-02-01",
      "- capability: b",
      "- status: superseded-by:D3",
    ].join("\n");
    const dir = makeDocsDir({ prd });
    try {
      const tl = buildDocsDecisionTimeline(dir);
      expect(tl.decisions.map((d) => d.id)).toEqual(["D1", "D2"]);
      expect(tl.decisions[1]!.superseded).toBe(true);
      expect(tl.decisions[1]!.supersededBy).toBe("D3");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("PRD.md가 없으면 빈 타임라인", () => {
    const dir = makeDocsDir({ userFlow: "## flow: f\n### 화면: A (C, /a)\n- step: x" });
    try {
      expect(buildDocsDecisionTimeline(dir)).toEqual({ decisions: [] });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
