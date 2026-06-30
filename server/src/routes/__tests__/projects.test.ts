/**
 * projects API 통합 테스트 (task 4.1 RED → 4.2/4.3 GREEN).
 *
 * PROJECTS_ROOT를 임시 픽스처로 잡고 supertest로 검증.
 * - GET /api/projects                                   카드 그리드(단일 change로 곧장 안 들어감)
 * - GET /api/projects/:project/capabilities            charter 뼈대 capability + 한글명 + change 수
 * - GET /api/projects/:project/capabilities/:cap/changes  그 capability의 change 목록(0개면 빈 배열)
 * - 404: 존재하지 않는 프로젝트
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";

let ROOT: string;

/** <ROOT>/<project>/openspec/changes/<change>/specs/<cap>/spec.md + proposal.md 픽스처. */
function makeChange(project: string, change: string, caps: string[], proposalTitle?: string): void {
  const changeRoot = join(ROOT, project, "openspec", "changes", change);
  for (const cap of caps) {
    const dir = join(changeRoot, "specs", cap);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "spec.md"), `## capability: ${cap}\n`);
  }
  if (proposalTitle !== undefined) {
    writeFileSync(join(changeRoot, "proposal.md"), `# ${proposalTitle}\n\n## Why\n`);
  }
}

/** <ROOT>/<project>/docs/spec.md (charter 뼈대 — capability 병기 한글명). */
function makeCharterSpec(project: string, body: string): void {
  const dir = join(ROOT, project, "docs");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "spec.md"), body);
  writeFileSync(join(dir, "PRD.md"), "## decision: D1\n"); // hasCharter 신호
}

/** <ROOT>/<project>/docs/planning/features.md (기획 기능명세 3단 트리). */
function makeFeatures(project: string, body: string): void {
  const dir = join(ROOT, project, "docs", "planning");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "features.md"), body);
}

/** <ROOT>/<project>/docs/planning/user-flow/<stem>.md (Mermaid + `> capability:` 마커). */
function makeUserFlow(project: string, stem: string, body: string): void {
  const dir = join(ROOT, project, "docs", "planning", "user-flow");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${stem}.md`), body);
}

async function loadApp() {
  const mod = await import("../../index.js");
  return mod.app;
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), "projects-api-"));
  process.env.PROJECTS_ROOT = ROOT;
});
afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  delete process.env.PROJECTS_ROOT;
});

describe("GET /api/projects", () => {
  it("change 있는 프로젝트를 카드로 반환한다(charter 유무 무관)", async () => {
    makeChange("alpha", "ch1", ["cap-a"]);
    makeCharterSpec("beta", "## capability: cap-b — 베타기능\n");
    makeChange("beta", "ch1", ["cap-b"]);
    const res = await request(await loadApp()).get("/api/projects");
    expect(res.status).toBe(200);
    const names = res.body.projects.map((p: { name: string }) => p.name);
    expect(names).toEqual(["alpha", "beta"]);
    const beta = res.body.projects.find((p: { name: string }) => p.name === "beta");
    expect(beta.hasCharter).toBe(true);
    expect(beta.changeCount).toBe(1);
  });
});

describe("GET /api/projects/:project/capabilities", () => {
  it("charter 뼈대 capability를 한글명·연결 change 수와 함께 반환한다", async () => {
    makeCharterSpec("proj", "## capability: cap-a — 가나다\n## capability: cap-b\n");
    makeChange("proj", "ch1", ["cap-a"], "에이 체인지");
    const res = await request(await loadApp()).get("/api/projects/proj/capabilities");
    expect(res.status).toBe(200);
    const a = res.body.capabilities.find((c: { key: string }) => c.key === "cap-a");
    expect(a.key).toBe("cap-a"); // 영문 키 불변
    expect(a.koreanLabel).toBe("가나다"); // 출처1 병기
    expect(a.changeKeys).toContain("ch1"); // 연결된 change
    const b = res.body.capabilities.find((c: { key: string }) => c.key === "cap-b");
    expect(b.koreanLabel).toBe("cap-b"); // 병기 없음 → 영문키 폴백
  });

  it("존재하지 않는 프로젝트는 404", async () => {
    makeChange("real", "ch1", ["cap-a"]);
    const res = await request(await loadApp()).get("/api/projects/ghost/capabilities");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/projects/:project/capabilities/:cap/changes", () => {
  it("그 capability에 연결된 change 목록(한글 제목)을 반환한다", async () => {
    makeCharterSpec("proj", "## capability: cap-a — 가나다\n");
    makeChange("proj", "ch1", ["cap-a"], "첫 체인지");
    const res = await request(await loadApp()).get("/api/projects/proj/capabilities/cap-a/changes");
    expect(res.status).toBe(200);
    expect(res.body.changes).toHaveLength(1);
    expect(res.body.changes[0].key).toBe("ch1");
    expect(res.body.changes[0].displayName).toBe("첫 체인지"); // 출처3 proposal 제목
  });

  it("연결된 change가 없으면 빈 배열(404 아님)", async () => {
    makeCharterSpec("proj", "## capability: cap-a\n");
    makeChange("proj", "ch1", ["cap-a"]);
    const res = await request(await loadApp()).get("/api/projects/proj/capabilities/cap-zzz/changes");
    expect(res.status).toBe(200);
    expect(res.body.changes).toEqual([]);
  });
});

describe("GET /api/projects/:project/capabilities/:cap (종합 상세)", () => {
  it("features 서브트리 + 연결 유저플로우 + change 목록을 한 응답으로 묶는다", async () => {
    makeCharterSpec("proj", "## capability: payment — 결제\n## capability: shipping — 배송\n");
    makeChange("proj", "add-payment", ["payment"], "결제 추가");
    // capability 주석은 헤더 '다음 줄'에 온다(featureTreeBuilder 스키마 — 헤더 줄엔 안 둠).
    makeFeatures(
      "proj",
      "## 결제\n<!-- capability: payment -->\n### 결제하기\n## 배송\n<!-- capability: shipping -->\n### 배송조회\n",
    );
    makeUserFlow("proj", "checkout-v1", "> capability: payment\n\n```mermaid\nflowchart TD\n  A[시작]\n```\n");
    makeUserFlow("proj", "browse-v1", "> capability: shipping\n\n```mermaid\nflowchart TD\n  B[탐색]\n```\n");

    const res = await request(await loadApp()).get("/api/projects/proj/capabilities/payment");
    expect(res.status).toBe(200);
    expect(res.body.key).toBe("payment");
    expect(res.body.koreanLabel).toBe("결제"); // 출처1 병기
    // features: payment 요구사항 가지만
    const reqs = res.body.features.root.children;
    expect(reqs).toHaveLength(1);
    expect(reqs[0].capability).toBe("payment");
    // userFlows: payment 마커 선언 stem만
    expect(res.body.userFlows).toEqual(["checkout-v1"]);
    // changes: 역방향 인덱스(한글 제목)
    expect(res.body.changes).toHaveLength(1);
    expect(res.body.changes[0].key).toBe("add-payment");
    expect(res.body.changes[0].displayName).toBe("결제 추가");
  });

  it("연결 0개여도 빈 구조로 200(404 아님)", async () => {
    // change 디렉토리는 존재하되(프로젝트로 인식) lonely엔 어떤 연결도 없는 상황.
    makeCharterSpec("proj", "## capability: lonely\n## capability: other\n");
    makeChange("proj", "ch-other", ["other"]);
    const res = await request(await loadApp()).get("/api/projects/proj/capabilities/lonely");
    expect(res.status).toBe(200);
    expect(res.body.key).toBe("lonely");
    expect(res.body.features).toBeNull();
    expect(res.body.userFlows).toEqual([]);
    expect(res.body.changes).toEqual([]);
  });

  it("존재하지 않는 프로젝트는 4xx(safe)", async () => {
    makeChange("real", "ch1", ["cap-a"]);
    const res = await request(await loadApp()).get("/api/projects/ghost/capabilities/cap-a");
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("경로 조작(..)은 4xx로 거부한다(no-traversal)", async () => {
    makeChange("real", "ch1", ["cap-a"]);
    const res = await request(await loadApp()).get("/api/projects/..%2F..%2Fetc/capabilities/cap-a");
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("특수문자 capability 키는 400으로 거부한다(화이트리스트)", async () => {
    makeChange("real", "ch1", ["cap-a"]);
    // 슬래시는 라우트 매칭 자체가 안 되므로, 화이트리스트 밖 문자(공백 인코딩)로 검증.
    const res = await request(await loadApp()).get("/api/projects/real/capabilities/cap%20bad");
    expect(res.status).toBe(400);
  });
});
