/**
 * planning-prd API 통합 테스트 — GET /api/docs/:project/planning-prd.
 * docs/planning/prd.md(기획 단계 산출물)를 읽어 5섹션 Prd 반환 / 404 / 경로조작 차단 / 원본일치.
 *
 * 주의: resolveDocsDir는 hasDocs(user-flow.md OR PRD.md 존재)로 docs 디렉토리를 인정한다.
 * 그래서 픽스처에 charter 문서(PRD.md)를 함께 둬야 디렉토리가 인식된다(Phase 0에서 확인한 제약).
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";

let ROOT: string;
let ORIG: string | undefined;

const PLANNING_PRD = `> owner: @gaegul

# PRD: 테스트 제품

## 개요
한 줄 정의 고유문구ALPHA

## 핵심가치
사용자 문제 고유문구BETA

## 타겟·시나리오
사용자 그룹 고유문구GAMMA

## 성공지표
KPI 고유문구DELTA

## 속성설정
카테고리 고유문구EPSILON
`;

// charter PRD.md (resolveDocsDir의 hasDocs 통과용) — planning/prd.md와 다른 파일·다른 내용.
const CHARTER_PRD = `# PRD\n## decision: 무관한 결정\n- date: 2026-06-28\n`;

function loadApp() {
  return import("../../index.js").then((m) => m.app);
}

beforeAll(() => {
  ROOT = mkdtempSync(join(tmpdir(), "planning-api-"));
  // proj1: charter docs(PRD.md) + planning/prd.md 둘 다
  const d = join(ROOT, "proj1", "docs");
  mkdirSync(join(d, "planning"), { recursive: true });
  writeFileSync(join(d, "PRD.md"), CHARTER_PRD);
  writeFileSync(join(d, "planning", "prd.md"), PLANNING_PRD);
  ORIG = process.env.DOCS_ROOT;
  process.env.DOCS_ROOT = ROOT;
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
  if (ORIG === undefined) delete process.env.DOCS_ROOT;
  else process.env.DOCS_ROOT = ORIG;
});

describe("GET /api/docs/:project/planning-prd", () => {
  it("planning/prd.md 5섹션 200 반환", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/proj1/planning-prd");
    expect(res.status).toBe(200);
    expect(res.body.project).toBe("proj1");
    expect(res.body.prd.sections).toHaveLength(5);
    expect(res.body.prd.sections.map((s: { key: string }) => s.key)).toEqual([
      "overview", "value", "target", "metrics", "attributes",
    ]);
  });

  it("원본 고유 문구가 응답에 포함된다 (proposal 변환 아닌 planning 원본)", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/proj1/planning-prd");
    const bodyText = JSON.stringify(res.body.prd);
    expect(bodyText).toContain("고유문구ALPHA");
    expect(bodyText).toContain("고유문구EPSILON");
  });

  it("존재하지 않는 프로젝트 → 404", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/nope-not-real/planning-prd");
    expect(res.status).toBe(404);
  });

  it("경로 조작(..) 차단 → 404 (safe-4xx)", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/..%2f..%2fetc/planning-prd");
    expect(res.status).toBe(404);
  });
});
