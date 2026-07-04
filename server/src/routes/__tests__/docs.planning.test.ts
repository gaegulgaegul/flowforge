/**
 * audit-capabilities API 통합 테스트 — GET /api/docs/:project/audit-capabilities.
 * docs/audit.json items[]를 capability 단위 집계 맵으로 반환 / 없으면 빈 맵 200 / 404 / 경로조작 차단.
 *
 * 주의: resolveDocsDir는 hasDocs(planning 문서 등 존재)로 docs 디렉토리를 인정한다.
 * 그래서 audit.json만 있는 프로젝트는 404 — 픽스처에 planning/features.md를 함께 둔다.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";

let ROOT: string;
let ORIG: string | undefined;

const FEATURES_MD = `# 기능명세\n## 요구사항: 테스트 <!-- capability: cap-fail -->\n- 기능 1\n`;

const AUDIT_ITEMS = [
  { capability: "cap-fail", verdict: "FAIL", claim: "GET /api/x", reason: "경로 불일치", kind: "assert:endpoint", line: 1 },
  { capability: "cap-fail", verdict: "PASS", claim: "GET /api/y", reason: "", kind: "assert:endpoint", line: 2 },
  { capability: "cap-clean", verdict: "PASS", claim: "GET /api/z", reason: "", kind: "assert:endpoint", line: 3 },
  { capability: "cap-clean", verdict: "UNVERIFIABLE", claim: "자유 서술", reason: "검증수단없음", kind: "freetext", line: 4 },
  { capability: "cap-unknown", verdict: "UNVERIFIABLE", claim: "산문", reason: "검증수단없음", kind: "freetext", line: 5 },
];

function makePlanning(project: string, auditItems?: unknown): void {
  const d = join(ROOT, project, "docs");
  mkdirSync(join(d, "planning"), { recursive: true });
  writeFileSync(join(d, "planning", "features.md"), FEATURES_MD);
  if (auditItems !== undefined) {
    writeFileSync(join(d, "audit.json"), JSON.stringify({ finalJudgment: "조건부", scanRoot: "/etc", items: auditItems }));
  }
}

function loadApp() {
  return import("../../index.js").then((m) => m.app);
}

beforeAll(() => {
  ROOT = mkdtempSync(join(tmpdir(), "audit-cap-api-"));
  makePlanning("proj1", AUDIT_ITEMS); // audit.json 있는 프로젝트
  makePlanning("proj2"); // planning 문서만 있고 audit.json 없는 프로젝트
  ORIG = process.env.DOCS_ROOT;
  process.env.DOCS_ROOT = ROOT;
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
  if (ORIG === undefined) delete process.env.DOCS_ROOT;
  else process.env.DOCS_ROOT = ORIG;
});

describe("GET /api/docs/:project/audit-capabilities", () => {
  it("audit.json 픽스처에서 fail·clean·unknown 3키 집계 맵 200 반환", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/proj1/audit-capabilities");
    expect(res.status).toBe(200);
    const caps = res.body.capabilities;
    expect(Object.keys(caps).sort()).toEqual(["cap-clean", "cap-fail", "cap-unknown"]);
    expect(caps["cap-fail"]).toEqual({
      status: "fail",
      pass: 1,
      fail: 1,
      unverifiable: 0,
      failClaims: [{ claim: "GET /api/x", reason: "경로 불일치" }],
    });
    expect(caps["cap-clean"].status).toBe("clean");
    expect(caps["cap-clean"].unverifiable).toBe(1);
    expect(caps["cap-unknown"].status).toBe("unknown");
  });

  it("audit.json 없는 프로젝트는 빈 맵 200", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/proj2/audit-capabilities");
    expect(res.status).toBe(200);
    expect(res.body.capabilities).toEqual({});
  });

  it("존재하지 않는 프로젝트 → 404", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/nope-not-real/audit-capabilities");
    expect(res.status).toBe(404);
  });

  it("경로 조작(..) 차단 → 404 (safe-4xx)", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/..%2f..%2fetc/audit-capabilities");
    expect(res.status).toBe(404);
  });
});
