/**
 * writeAuth 통합 테스트 — 쓰기 5종 라우트의 2차 인증 게이트.
 *
 * env(FLOWFORGE_WRITE_TOKEN 또는 CF Access AUD+TEAM_DOMAIN) 설정 시:
 *  - 무자격 쓰기 5종 전부 401 + 대상 파일 불변
 *  - Bearer 토큰(상수시간) 일치 시 통과, 불일치 401
 *  - env 미설정 시 현행 동작(게이트 없음 — 기존 쓰기 회귀 0)
 * CF Access JWT 유효 경로는 cfAccess 단위 테스트가 서명 검증을 커버하므로 여기선 헤더
 * 배선(무자격 JWT=401)만 확인한다. 실 JWKS 없이 위조 JWT는 서명 실패로 401이어야 한다.
 */
import request from "supertest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const WRITE_TOKEN = "s3cr3t-write-token-xyz";

let ROOT: string;
const ENV = { ...process.env };

/** index.ts를 동적 import — env가 세팅된 뒤 모듈이 로드되도록. */
async function loadApp() {
  const mod = await import("../../index.js");
  return mod.app;
}

/** DOCS_ROOT/OPENSPEC_ROOT/PROJECTS_ROOT 하위에 최소 픽스처 생성 후 경로 반환. */
function makeDocsProject(project: string): string {
  const dir = join(ROOT, project, "docs");
  const planning = join(dir, "planning");
  mkdirSync(planning, { recursive: true });
  writeFileSync(join(dir, "PRD.md"), "# PRD\n\n## overview\n원본 개요\n");
  writeFileSync(join(planning, "prd.md"), "# PRD\n\n## overview\n원본 개요\n");
  writeFileSync(join(planning, "features.md"), "# Features\n\n## f1\n원본 기능\n");
  const uf = join(planning, "user-flow");
  mkdirSync(uf, { recursive: true });
  writeFileSync(join(uf, "main.md"), "# main\n\n## step\n원본 스텝\n");
  return dir;
}

/** openspec change 픽스처(그래프 layout PUT 대상). */
function makeChange(id: string): string {
  const dir = join(ROOT, "openspec", "changes", id);
  mkdirSync(join(dir, "specs"), { recursive: true });
  writeFileSync(join(dir, "proposal.md"), "# proposal\n");
  return dir;
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), "write-auth-"));
  process.env.DOCS_ROOT = ROOT;
  process.env.PROJECTS_ROOT = ROOT;
  process.env.OPENSPEC_ROOT = join(ROOT, "openspec");
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  process.env = { ...ENV };
});

/** 5종 쓰기 요청 정의 — method/path/body/query. */
function writeRequests(project: string, changeId: string) {
  return [
    { name: "graph layout PUT", method: "put" as const, path: `/api/changes/${changeId}/layout`, body: { nodes: {} } },
    { name: "docs user-flow layout PUT", method: "put" as const, path: `/api/docs/${project}/planning-user-flow/layout?flow=main`, body: { nodes: {} } },
    { name: "prd apply POST", method: "post" as const, path: `/api/docs/${project}/planning-prd-suggestions/apply`, body: { approve: [], reject: [] } },
    { name: "features apply POST", method: "post" as const, path: `/api/docs/${project}/planning-features-suggestions/apply`, body: { approve: [], reject: [] } },
    { name: "user-flow apply POST", method: "post" as const, path: `/api/docs/${project}/planning-user-flow-suggestions/apply?flow=main`, body: { approve: [], reject: [] } },
  ];
}

describe("writeAuth — 토큰 게이트 설정 시", () => {
  beforeEach(() => {
    process.env.FLOWFORGE_WRITE_TOKEN = WRITE_TOKEN;
    delete process.env.FLOWFORGE_CF_ACCESS_AUD;
    delete process.env.FLOWFORGE_CF_ACCESS_TEAM_DOMAIN;
  });

  it("무자격(헤더 없음) 쓰기 5종 전부 401", async () => {
    const project = "p";
    const changeId = "c1";
    makeDocsProject(project);
    makeChange(changeId);
    const app = await loadApp();
    for (const r of writeRequests(project, changeId)) {
      const res = await request(app)[r.method](r.path).send(r.body);
      expect([r.name, res.status]).toEqual([r.name, 401]);
      expect(res.body).toEqual({ error: "unauthorized" }); // 내부 사유 미노출
    }
  });

  it("무자격 401 시 대상 파일 불변", async () => {
    const project = "p";
    const changeId = "c1";
    const docsDir = makeDocsProject(project);
    makeChange(changeId);
    const prdBefore = readFileSync(join(docsDir, "planning", "prd.md"), "utf-8");
    const featBefore = readFileSync(join(docsDir, "planning", "features.md"), "utf-8");
    const app = await loadApp();
    for (const r of writeRequests(project, changeId)) {
      await request(app)[r.method](r.path).send(r.body);
    }
    expect(readFileSync(join(docsDir, "planning", "prd.md"), "utf-8")).toBe(prdBefore);
    expect(readFileSync(join(docsDir, "planning", "features.md"), "utf-8")).toBe(featBefore);
    // overlay JSON도 생성되지 않아야 함(무자격이 layout을 쓰지 못함)
    const overlayDir = join(ROOT, "openspec", "changes", changeId);
    expect(existsSync(join(overlayDir, "viz", "graph-overlay.json"))).toBe(false);
  });

  it("Bearer 토큰 일치 → 게이트 통과(401 아님)", async () => {
    const project = "p";
    const changeId = "c1";
    makeDocsProject(project);
    makeChange(changeId);
    const app = await loadApp();
    for (const r of writeRequests(project, changeId)) {
      const res = await request(app)[r.method](r.path)
        .set("Authorization", `Bearer ${WRITE_TOKEN}`)
        .send(r.body);
      // 게이트는 통과 — 이후 라우트 로직에 따라 200/400/404 등, 단 401은 아님
      expect([r.name, res.status === 401]).toEqual([r.name, false]);
    }
  });

  it("Bearer 토큰 불일치 → 401", async () => {
    const project = "p";
    const changeId = "c1";
    makeDocsProject(project);
    makeChange(changeId);
    const app = await loadApp();
    const res = await request(app)
      .post(`/api/docs/${project}/planning-prd-suggestions/apply`)
      .set("Authorization", "Bearer wrong-token")
      .send({ approve: [], reject: [] });
    expect(res.status).toBe(401);
  });

  it("위조 CF Access JWT(실 JWKS 없음) → 401(서명 검증 실패)", async () => {
    process.env.FLOWFORGE_CF_ACCESS_AUD = "aud-x";
    process.env.FLOWFORGE_CF_ACCESS_TEAM_DOMAIN = "example.cloudflareaccess.com";
    delete process.env.FLOWFORGE_WRITE_TOKEN;
    const project = "p";
    makeDocsProject(project);
    const app = await loadApp();
    // 아무 헤더 값 — 서명이 팀 JWKS와 안 맞으므로 401
    const res = await request(app)
      .post(`/api/docs/${project}/planning-prd-suggestions/apply`)
      .set("Cf-Access-Jwt-Assertion", "eyJhbGciOiJSUzI1NiJ9.eyJhdWQiOiJ4In0.fake")
      .send({ approve: [], reject: [] });
    expect(res.status).toBe(401);
  }, 15000);
});

describe("writeAuth — env 미설정(개발 모드)", () => {
  beforeEach(() => {
    delete process.env.FLOWFORGE_WRITE_TOKEN;
    delete process.env.FLOWFORGE_CF_ACCESS_AUD;
    delete process.env.FLOWFORGE_CF_ACCESS_TEAM_DOMAIN;
  });

  it("게이트 없음 — 무자격 쓰기가 401이 아니다(현행 동작)", async () => {
    const project = "p";
    const changeId = "c1";
    makeDocsProject(project);
    makeChange(changeId);
    const app = await loadApp();
    for (const r of writeRequests(project, changeId)) {
      const res = await request(app)[r.method](r.path).send(r.body);
      expect([r.name, res.status === 401]).toEqual([r.name, false]);
    }
  });

  it("prd apply가 정상 반영(현행 동작 회귀 0)", async () => {
    const project = "p";
    const docsDir = makeDocsProject(project);
    const app = await loadApp();
    const res = await request(app)
      .post(`/api/docs/${project}/planning-prd-suggestions/apply`)
      .send({ approve: [], reject: [] });
    expect(res.status).toBe(200);
    // 파일은 그대로 존재(빈 apply라 변경 없음)
    expect(existsSync(join(docsDir, "planning", "prd.md"))).toBe(true);
  });
});
