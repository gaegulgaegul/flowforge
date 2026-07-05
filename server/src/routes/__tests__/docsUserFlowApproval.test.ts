/**
 * 유저플로우(user-flow) 에지 추가 승인/반려 라우트 통합 테스트 (6b-userflow).
 * GET /api/docs/:project/planning-user-flow-suggestions?flow=<stem> (제안 큐 읽기)
 * POST /api/docs/:project/planning-user-flow-suggestions/apply?flow=<stem> (승인·반려 적용)
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";

let ROOT: string;

const STEM = "main-v1";

/** 인라인 노드 정의를 포함한 mermaid flowchart 픽스처. */
const FLOW_MD = [
  "# 유저 플로우",
  "",
  "```mermaid",
  "flowchart TD",
  '  Start(["앱 진입"]) --> Grid["카드 그리드"]',
  '  Grid --> Detail["상세"]',
  "```",
  "",
].join("\n");

/**
 * <ROOT>/<project>/docs/planning/{prd.md, user-flow/<stem>.md, <stem>.suggestions.json} 픽스처.
 * planning/user-flow만으로는 docs 프로젝트로 인식되지 않아 prd.md를 항상 함께 둔다(인식용).
 * user-flow 디렉토리 경로를 반환한다.
 */
function makeFlow(project: string, md: string | null, sugs?: unknown[]): string {
  const planDir = join(ROOT, project, "docs", "planning");
  const flowDir = join(planDir, "user-flow");
  mkdirSync(flowDir, { recursive: true });
  writeFileSync(join(planDir, "prd.md"), "# PRD\n\n## 개요\n\nx\n"); // docs 인식용
  if (md !== null) writeFileSync(join(flowDir, `${STEM}.md`), md);
  if (sugs) {
    writeFileSync(join(flowDir, `${STEM}.suggestions.json`), JSON.stringify({ version: 1, suggestions: sugs }));
  }
  return flowDir;
}

/** 기본 유효 제안(Detail→Start happy) 위에 필드를 덮어쓰는 헬퍼. */
function sug(id: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, op: "add-edge", from: "Detail", to: "Start", edgeKind: "happy", label: "재시작", ...over };
}

async function loadApp() {
  const mod = await import("../../index.js");
  return mod.app;
}

describe("유저플로우 승인/반려 API", () => {
  const ORIG = process.env.DOCS_ROOT;

  beforeEach(() => {
    ROOT = mkdtempSync(join(tmpdir(), "uflow-approval-api-"));
    process.env.DOCS_ROOT = ROOT;
  });
  afterEach(() => {
    rmSync(ROOT, { recursive: true, force: true });
    if (ORIG === undefined) delete process.env.DOCS_ROOT;
    else process.env.DOCS_ROOT = ORIG;
  });

  it("GET planning-user-flow-suggestions — 큐 있으면 200 + 제안 목록", async () => {
    makeFlow("p", FLOW_MD, [
      sug("s1"),
      sug("s2", { from: "Grid", to: undefined, newNode: { id: "Err", label: "오류 안내" }, edgeKind: "edgecase" }),
    ]);
    const app = await loadApp();
    const res = await request(app).get(`/api/docs/p/planning-user-flow-suggestions?flow=${STEM}`);
    expect(res.status).toBe(200);
    expect(res.body.flow).toBe(STEM);
    expect(res.body.queue.suggestions).toHaveLength(2);
    expect(res.body.queue.suggestions.map((s: { id: string }) => s.id)).toEqual(["s1", "s2"]);
  });

  it("GET planning-user-flow-suggestions — 큐 파일 없으면 200 + 빈 큐(404 아님)", async () => {
    makeFlow("p", FLOW_MD);
    const app = await loadApp();
    const res = await request(app).get(`/api/docs/p/planning-user-flow-suggestions?flow=${STEM}`);
    expect(res.status).toBe(200);
    expect(res.body.queue).toEqual({ version: 1, suggestions: [] });
  });

  it("GET planning-user-flow-suggestions — flow 미지정이면 첫 버전 폴백(그래프 GET과 동형)", async () => {
    makeFlow("p", FLOW_MD, [sug("s1")]);
    const app = await loadApp();
    const res = await request(app).get("/api/docs/p/planning-user-flow-suggestions");
    expect(res.status).toBe(200);
    expect(res.body.flow).toBe(STEM);
    expect(res.body.queue.suggestions).toHaveLength(1);
  });

  it("GET planning-user-flow-suggestions — 무효 stem은 404", async () => {
    makeFlow("p", FLOW_MD, [sug("s1")]);
    const app = await loadApp();
    for (const flow of ["../evil", "a/b"]) {
      const res = await request(app).get(
        `/api/docs/p/planning-user-flow-suggestions?flow=${encodeURIComponent(flow)}`,
      );
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("planning_user_flow_not_found");
    }
  });

  it("GET planning-user-flow-suggestions — 존재하지 않는 프로젝트 404", async () => {
    const app = await loadApp();
    const res = await request(app).get(`/api/docs/nope/planning-user-flow-suggestions?flow=${STEM}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("docs_not_found");
  });

  it("GET planning-user-flow-suggestions — 경로 조작 차단(404)", async () => {
    const app = await loadApp();
    const res = await request(app).get(`/api/docs/..%2f..%2fetc/planning-user-flow-suggestions?flow=${STEM}`);
    expect(res.status).toBe(404);
  });

  it("POST apply — 승인 시 에지 append + 재조회 그래프에 반영(happy + edgecase 신규 노드)", async () => {
    makeFlow("p", FLOW_MD, [
      sug("s1"),
      sug("s2", {
        from: "Grid",
        to: undefined,
        newNode: { id: "Err", label: "오류 안내" },
        edgeKind: "edgecase",
        label: "실패",
      }),
    ]);
    const app = await loadApp();
    const res = await request(app)
      .post(`/api/docs/p/planning-user-flow-suggestions/apply?flow=${STEM}`)
      .send({ approve: ["s1", "s2"], reject: [] });
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(2);
    expect(res.body.remaining).toBe(0);
    // 재조회: 기존 그래프 라우트로 문서가 실제로 변이됐는지 단언한다.
    const g = await request(app).get(`/api/docs/p/planning-user-flow?flow=${STEM}`);
    expect(g.status).toBe(200);
    const nodes = g.body.graph.nodes as ReadonlyArray<{ id: string; specName: string; label: string }>;
    const idOf = (specName: string): string | undefined => nodes.find((n) => n.specName === specName)?.id;
    // 신규 노드가 그래프에 나타난다(제안 라벨 그대로).
    const errNode = nodes.find((n) => n.specName === "Err");
    expect(errNode?.label).toBe("오류 안내");
    // 승인 에지 2개가 kind까지 정확히 나타난다(happy 실선 + edgecase 점선).
    expect(g.body.graph.edges).toContainEqual(
      expect.objectContaining({ source: idOf("Detail"), target: idOf("Start"), kind: "happy", label: "재시작" }),
    );
    expect(g.body.graph.edges).toContainEqual(
      expect.objectContaining({ source: idOf("Grid"), target: idOf("Err"), kind: "edgecase", label: "실패" }),
    );
  });

  it("POST apply — 반려 시 문서 바이트 불변 + 큐에서 제거", async () => {
    const flowDir = makeFlow("p", FLOW_MD, [sug("s1")]);
    const before = readFileSync(join(flowDir, `${STEM}.md`), "utf-8");
    const app = await loadApp();
    const res = await request(app)
      .post(`/api/docs/p/planning-user-flow-suggestions/apply?flow=${STEM}`)
      .send({ approve: [], reject: ["s1"] });
    expect(res.status).toBe(200);
    expect(res.body.rejected).toBe(1);
    expect(res.body.remaining).toBe(0);
    expect(readFileSync(join(flowDir, `${STEM}.md`), "utf-8")).toBe(before); // 바이트 동일
    // 큐 재조회: 반려분이 제거됐다.
    const q = await request(app).get(`/api/docs/p/planning-user-flow-suggestions?flow=${STEM}`);
    expect(q.body.queue.suggestions).toHaveLength(0);
  });

  it("POST apply — 미실재 id·검증 위반은 skipped로 사유 표면화(silent drop 금지)", async () => {
    const flowDir = makeFlow("p", FLOW_MD, [sug("bad", { from: "ZZZ" })]);
    const app = await loadApp();
    const res = await request(app)
      .post(`/api/docs/p/planning-user-flow-suggestions/apply?flow=${STEM}`)
      .send({ approve: ["bad", "nope"], reject: [] });
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(0);
    expect(res.body.skipped).toEqual(expect.arrayContaining(["bad: from-not-in-doc", "nope: not-in-queue"]));
    expect(readFileSync(join(flowDir, `${STEM}.md`), "utf-8")).toBe(FLOW_MD); // 문서 불변
  });

  it("POST apply — 잘못된 body는 400", async () => {
    makeFlow("p", FLOW_MD);
    const app = await loadApp();
    const res = await request(app)
      .post(`/api/docs/p/planning-user-flow-suggestions/apply?flow=${STEM}`)
      .send({ approve: "s1" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_request");
  });

  it("POST apply — 무효 stem·flow 미지정은 404", async () => {
    makeFlow("p", FLOW_MD, [sug("s1")]);
    const app = await loadApp();
    for (const qs of [`?flow=${encodeURIComponent("../evil")}`, ""]) {
      const res = await request(app)
        .post(`/api/docs/p/planning-user-flow-suggestions/apply${qs}`)
        .send({ approve: ["s1"], reject: [] });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("planning_user_flow_not_found");
    }
  });

  it("POST apply — 경로 조작 차단(404)", async () => {
    const app = await loadApp();
    const res = await request(app)
      .post(`/api/docs/..%2f..%2fetc/planning-user-flow-suggestions/apply?flow=${STEM}`)
      .send({ approve: [], reject: [] });
    expect(res.status).toBe(404);
  });

  it("POST apply — <stem>.md 부재 시 422(원본 보호·큐 불변)", async () => {
    // 큐만 있고 <stem>.md가 없는 상태(docs 인식은 prd.md가 담당) → lib이 writeFailed.
    const flowDir = makeFlow("p", null, [sug("s1")]);
    const queueBefore = readFileSync(join(flowDir, `${STEM}.suggestions.json`), "utf-8");
    const app = await loadApp();
    const res = await request(app)
      .post(`/api/docs/p/planning-user-flow-suggestions/apply?flow=${STEM}`)
      .send({ approve: ["s1"], reject: [] });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("user_flow_write_failed");
    expect(existsSync(join(flowDir, `${STEM}.md`))).toBe(false); // 문서를 지어내지 않음
    expect(readFileSync(join(flowDir, `${STEM}.suggestions.json`), "utf-8")).toBe(queueBefore); // 큐 불변
  });
});
