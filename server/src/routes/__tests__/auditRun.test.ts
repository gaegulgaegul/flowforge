/**
 * audit-run 라우트 통합 테스트 (RED → GREEN).
 *
 * POST /api/docs/:project/audit-run — 얇은 인증 프록시. openspec-reports 큐로 enqueue.
 *
 * 검증:
 *  - 무인증(게이트 활성) → 401, 큐 미호출(requireWriteAuth)
 *  - 경로조작 project('..'·슬래시) → 4xx, 큐 미호출(resolveProjectDir)
 *  - 정상(인증·실재 프로젝트) → 202, 큐 1회 호출
 *  - 워커 401 → 502(업스트림 실패)
 *
 * fetch(openspec-reports 큐)는 모킹 — 이 테스트는 flowforge 프록시 계층만 검증한다.
 */
import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import request from "supertest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _resetAuditDebounce } from "../../lib/auditTrigger.js";

const WRITE_TOKEN = "s3cr3t-write-token-xyz";
const ENV = { ...process.env };
let ROOT: string;

async function loadApp() {
  const mod = await import("../../index.js");
  return mod.app;
}

/** <ROOT>/<project>/ 실재 디렉토리(resolveProjectDir 통과) + docs(선택). */
function makeProject(project: string): void {
  mkdirSync(join(ROOT, project), { recursive: true });
}

/** fetch 모킹: 큐 응답 status/body 스텁 + 호출 캡처. */
function mockFetch(status: number, body: unknown): jest.Mock {
  const fn = jest.fn(async () => ({ status, json: async () => body })) as unknown as jest.Mock;
  (global as unknown as { fetch: unknown }).fetch = fn;
  return fn;
}

beforeEach(() => {
  ROOT = mkdtempSync(join(tmpdir(), "audit-run-"));
  process.env.DOCS_ROOT = ROOT;
  process.env.PROJECTS_ROOT = ROOT;
  process.env.OPENSPEC_ROOT = join(ROOT, "openspec");
  process.env.OPENSPEC_CONSOLE_TOKEN = "svc-token-abc";
  process.env.OPENSPEC_QUEUE_URL = "http://127.0.0.1:8810/api/tasks";
  _resetAuditDebounce(); // 테스트 간 디바운스 창 격리(프로세스 로컬 맵)
});

afterEach(() => {
  rmSync(ROOT, { recursive: true, force: true });
  process.env = { ...ENV };
});

describe("audit-run — 게이트 활성(WRITE_TOKEN)", () => {
  beforeEach(() => {
    process.env.FLOWFORGE_WRITE_TOKEN = WRITE_TOKEN;
    delete process.env.FLOWFORGE_CF_ACCESS_AUD;
    delete process.env.FLOWFORGE_CF_ACCESS_TEAM_DOMAIN;
  });

  it("무인증 → 401, 큐 미호출", async () => {
    makeProject("flowforge");
    const fetchMock = mockFetch(202, { ok: true, task_id: 1 });
    const app = await loadApp();
    const res = await request(app).post("/api/docs/flowforge/audit-run").send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("인증 + 실재 프로젝트 → 202, 큐 1회", async () => {
    makeProject("flowforge");
    const fetchMock = mockFetch(202, { ok: true, task_id: 7 });
    const app = await loadApp();
    const res = await request(app)
      .post("/api/docs/flowforge/audit-run")
      .set("Authorization", `Bearer ${WRITE_TOKEN}`)
      .send({});
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ ok: true, taskId: 7 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("경로조작 project('..') → 4xx, 큐 미호출", async () => {
    const fetchMock = mockFetch(202, { ok: true });
    const app = await loadApp();
    // 슬래시/'..' 포함 → resolveDocs 계열 화이트리스트에서 거부. 인증은 통과시켜 경로 게이트만 본다.
    const res = await request(app)
      .post("/api/docs/..%2Fetc/audit-run")
      .set("Authorization", `Bearer ${WRITE_TOKEN}`)
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("미등록(실재 안 함) project → 400, 큐 미호출", async () => {
    const fetchMock = mockFetch(202, { ok: true });
    const app = await loadApp();
    const res = await request(app)
      .post("/api/docs/nope/audit-run")
      .set("Authorization", `Bearer ${WRITE_TOKEN}`)
      .send({});
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("워커 401 → 502(업스트림 실패)", async () => {
    makeProject("flowforge");
    mockFetch(401, { error: "unauthorized" });
    const app = await loadApp();
    const res = await request(app)
      .post("/api/docs/flowforge/audit-run")
      .set("Authorization", `Bearer ${WRITE_TOKEN}`)
      .send({});
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("audit_enqueue_failed");
  });
});

describe("audit-run — 게이트 미설정(개발 모드)", () => {
  beforeEach(() => {
    delete process.env.FLOWFORGE_WRITE_TOKEN;
    delete process.env.FLOWFORGE_CF_ACCESS_AUD;
    delete process.env.FLOWFORGE_CF_ACCESS_TEAM_DOMAIN;
  });

  it("무인증이라도 개발 모드면 게이트 통과 → 202(현행 동작)", async () => {
    makeProject("flowforge");
    const fetchMock = mockFetch(202, { ok: true, task_id: 3 });
    const app = await loadApp();
    const res = await request(app).post("/api/docs/flowforge/audit-run").send({});
    expect(res.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
