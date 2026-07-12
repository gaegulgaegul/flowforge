/**
 * auditTrigger 단위 테스트 (RED → GREEN).
 *
 * flowforge = 얇은 인증 프록시. openspec-reports 큐(127.0.0.1:8810/api/tasks)에
 * `{project, change:"-", action:"audit"}`를 서비스 토큰 Bearer로 enqueue만 한다.
 *
 * 검증:
 *  - 정상: 화이트리스트·실재 프로젝트 → 큐 202 → ok:true(+taskId), 올바른 URL·헤더·바디
 *  - 경로조작 project('..'·슬래시·미등록) → 큐 호출 안 함, invalid_project
 *  - 서비스 토큰 미설정 → 큐 호출 안 함, unauthorized(공개 트리거 조기 차단)
 *  - 워커 401/403 → unauthorized
 *  - 워커 비202(500 등)·네트워크 오류 → queue_error
 *  - 중복 enqueue 디바운스 → 창 안 재요청은 debounced(큐 호출 안 함)
 */
import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { triggerAudit, _resetAuditDebounce } from "../auditTrigger.js";

const ENV = { ...process.env };
let root: string;

/** <root>/<project>/ 실재 디렉토리(resolveProjectDir 통과용). */
function makeProject(project: string): void {
  mkdirSync(join(root, project), { recursive: true });
}

/** fetch 모킹: 지정 status/body를 돌려주는 Response 스텁. 호출 인자 캡처. */
function mockFetch(status: number, body: unknown): jest.Mock {
  const fn = jest.fn(async () => ({
    status,
    json: async () => body,
  })) as unknown as jest.Mock;
  (global as unknown as { fetch: unknown }).fetch = fn;
  return fn;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "audit-trigger-"));
  process.env.PROJECTS_ROOT = root;
  process.env.OPENSPEC_CONSOLE_TOKEN = "svc-token-abc";
  process.env.OPENSPEC_QUEUE_URL = "http://127.0.0.1:8810/api/tasks";
  _resetAuditDebounce();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  process.env = { ...ENV };
});

describe("triggerAudit — 얇은 인증 프록시", () => {
  it("정상: 실재 프로젝트를 큐에 202로 enqueue하고 ok:true+taskId", async () => {
    makeProject("flowforge");
    const fetchMock = mockFetch(202, { ok: true, task_id: 42, action: "audit" });

    const r = await triggerAudit("flowforge");

    expect(r).toEqual({ ok: true, taskId: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:8810/api/tasks");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer svc-token-abc");
    // audit은 프로젝트 단위 → change="-", action="audit"
    expect(JSON.parse(init.body as string)).toEqual({ project: "flowforge", change: "-", action: "audit" });
  });

  it("경로조작 project('..')는 큐를 호출하지 않고 invalid_project", async () => {
    const fetchMock = mockFetch(202, { ok: true });
    const r = await triggerAudit("../etc");
    expect(r).toEqual({ ok: false, status: "invalid_project" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("미등록(실재 안 함) project는 resolveProjectDir null → invalid_project, 큐 미호출", async () => {
    const fetchMock = mockFetch(202, { ok: true });
    const r = await triggerAudit("nope"); // 화이트리스트는 통과하나 디렉토리 부재
    expect(r).toEqual({ ok: false, status: "invalid_project" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("서비스 토큰 미설정이면 큐 호출 없이 unauthorized(공개 트리거 조기 차단)", async () => {
    delete process.env.OPENSPEC_CONSOLE_TOKEN;
    makeProject("flowforge");
    const fetchMock = mockFetch(202, { ok: true });
    const r = await triggerAudit("flowforge");
    expect(r).toEqual({ ok: false, status: "unauthorized" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("워커가 401을 주면 unauthorized", async () => {
    makeProject("flowforge");
    mockFetch(401, { error: "unauthorized" });
    const r = await triggerAudit("flowforge");
    expect(r).toEqual({ ok: false, status: "unauthorized" });
  });

  it("워커 비202(500)면 queue_error", async () => {
    makeProject("flowforge");
    mockFetch(500, { error: "boom" });
    const r = await triggerAudit("flowforge");
    expect(r).toEqual({ ok: false, status: "queue_error" });
  });

  it("네트워크 오류(fetch throw)면 queue_error", async () => {
    makeProject("flowforge");
    (global as unknown as { fetch: unknown }).fetch = jest.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const r = await triggerAudit("flowforge");
    expect(r).toEqual({ ok: false, status: "queue_error" });
  });

  it("중복 enqueue 디바운스: 연속 2회 중 두 번째는 debounced(큐 1회만)", async () => {
    makeProject("flowforge");
    const fetchMock = mockFetch(202, { ok: true, task_id: 1 });
    const r1 = await triggerAudit("flowforge");
    const r2 = await triggerAudit("flowforge");
    expect(r1.ok).toBe(true);
    expect(r2).toEqual({ ok: false, status: "debounced" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("202이나 task_id 없으면 ok:true(taskId 생략)", async () => {
    makeProject("flowforge");
    mockFetch(202, { ok: true });
    const r = await triggerAudit("flowforge");
    expect(r).toEqual({ ok: true });
  });
});
