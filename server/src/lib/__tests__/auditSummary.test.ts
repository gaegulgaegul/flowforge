// auditSummary 단위 테스트 — docs/audit.json items[]의 capability 단위 집계 (D-1)
// 픽스처: 임시 <root>/<project>/docs/audit.json (projects.test의 makeAudit 패턴 차용, raw 본문 지원)
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { aggregateAuditItems, readAuditCapabilities } from "../auditSummary.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "audit-summary-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** <root>/<project>/docs/audit.json 픽스처 생성. raw가 있으면 본문 그대로 기록. 프로젝트 dir 반환. */
function makeAudit(project: string, items?: unknown, raw?: string): string {
  const dir = join(root, project, "docs");
  mkdirSync(dir, { recursive: true });
  const body = raw ?? JSON.stringify(items === undefined ? {} : { items });
  writeFileSync(join(dir, "audit.json"), body);
  return join(root, project);
}

/** 실제 audit.json items[] 원소 모양의 픽스처 item */
function item(
  capability: string,
  verdict: string,
  claim = "",
  reason = "",
): Record<string, unknown> {
  return {
    capability,
    feature: "픽스처 기능",
    line: 1,
    kind: "assert:endpoint(heading)",
    claim,
    verdict,
    reason,
    method: "route 문자열 대조",
    evidence: null,
  };
}

describe("readAuditCapabilities — capability 단위 집계", () => {
  it("(a) FAIL 1건 이상 capability는 fail + fail 건수 + failClaims", () => {
    const projDir = makeAudit("proj", [
      item("cap-a", "FAIL", "GET /api/x", "경로 불일치"),
      item("cap-a", "PASS", "GET /api/y"),
      item("cap-a", "UNVERIFIABLE", "자유 서술", "검증수단없음"),
    ]);
    const map = readAuditCapabilities(projDir);
    expect(map["cap-a"]).toEqual({
      status: "fail",
      pass: 1,
      fail: 1,
      unverifiable: 1,
      failClaims: [{ claim: "GET /api/x", reason: "경로 불일치" }],
    });
  });

  it("(b) PASS+UNVERIFIABLE만이면 clean — UNVERIFIABLE은 status를 깎지 않고 건수로만", () => {
    const projDir = makeAudit("proj", [
      item("cap-b", "PASS"),
      item("cap-b", "UNVERIFIABLE"),
      item("cap-b", "UNVERIFIABLE"),
    ]);
    const map = readAuditCapabilities(projDir);
    expect(map["cap-b"]?.status).toBe("clean");
    expect(map["cap-b"]?.unverifiable).toBe(2);
    expect(map["cap-b"]?.failClaims).toEqual([]);
  });

  it("(c) 전부 UNVERIFIABLE이면 unknown", () => {
    const projDir = makeAudit("proj", [
      item("cap-c", "UNVERIFIABLE"),
      item("cap-c", "UNVERIFIABLE"),
    ]);
    expect(readAuditCapabilities(projDir)["cap-c"]?.status).toBe("unknown");
  });

  it("capability 여러 개면 각각 독립 집계된다", () => {
    const projDir = makeAudit("proj", [
      item("cap-a", "FAIL", "GET /api/x", "이유"),
      item("cap-b", "PASS"),
    ]);
    const map = readAuditCapabilities(projDir);
    expect(Object.keys(map).sort()).toEqual(["cap-a", "cap-b"]);
    expect(map["cap-a"]?.status).toBe("fail");
    expect(map["cap-b"]?.status).toBe("clean");
  });

  it("(d) 파일 없음이면 빈 맵 (throw 없음)", () => {
    expect(readAuditCapabilities(join(root, "no-such-project"))).toEqual({});
  });

  it("(d) 깨진 JSON이면 빈 맵 (throw 없음)", () => {
    const projDir = makeAudit("proj", undefined, "{not json!");
    expect(readAuditCapabilities(projDir)).toEqual({});
  });

  it("(d) items가 배열이 아니면 빈 맵 (throw 없음)", () => {
    const projDir = makeAudit("proj", "배열 아님");
    expect(readAuditCapabilities(projDir)).toEqual({});
  });

  it("(e) capability·verdict 없는 item, 비객체 item도 안전하게 건너뛴다", () => {
    const projDir = makeAudit("proj", [
      { feature: "필드 없는 item" },
      null,
      42,
      { capability: 7, verdict: "PASS" },
      { capability: "cap-e", verdict: 123 },
      item("cap-e", "PASS"),
    ]);
    const map = readAuditCapabilities(projDir);
    expect(map).toEqual({
      "cap-e": { status: "clean", pass: 1, fail: 0, unverifiable: 0, failClaims: [] },
    });
  });

  it("(e) 알 수 없는 verdict 값은 어떤 건수에도 세지 않는다", () => {
    const projDir = makeAudit("proj", [item("cap-x", "조건부"), item("cap-x", "PASS")]);
    expect(readAuditCapabilities(projDir)["cap-x"]).toEqual({
      status: "clean",
      pass: 1,
      fail: 0,
      unverifiable: 0,
      failClaims: [],
    });
  });
});

describe("aggregateAuditItems — 순수 집계", () => {
  it("비배열 입력은 빈 맵", () => {
    expect(aggregateAuditItems(undefined)).toEqual({});
    expect(aggregateAuditItems("x")).toEqual({});
    expect(aggregateAuditItems({})).toEqual({});
  });

  it("빈 배열은 빈 맵", () => {
    expect(aggregateAuditItems([])).toEqual({});
  });
});
