/**
 * 유저플로우(user-flow) 에지 추가 승인/반려 편집 lib 단위 테스트 (6b-userflow).
 *
 * 대상: readUserFlowSuggestions(per-stem 사이드카 큐 읽기)·applyUserFlowSuggestions(승인분
 * 에지 append·반려 제거)·userFlowInvariantHolds(D-5 self-roundtrip 방어).
 * 임시 docsDir에 <stem>.md + <stem>.suggestions.json 픽스처를 만들어 실제 파일 왕복을 검증.
 * 핵심 불변식: 승인=첫 mermaid 블록 닫는 펜스 직전에 에지 한 줄 append만, 반려=원본 바이트 불변.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readUserFlowSuggestions,
  applyUserFlowSuggestions,
  userFlowInvariantHolds,
} from "../userFlowDocs.js";
import { buildUserFlowFromLines } from "../../parser/planningUserFlowBuilder.js";

/** 첫 mermaid 블록 + 블록 뒤 산문·두 번째 펜스 블록(append 위치 검증용). */
const FLOW_MD = [
  "# 유저 플로우",
  "",
  "```mermaid",
  "flowchart TD",
  '  A(["앱 시작"]) --> B["로그인"]',
  '  B --> C{"인증 확인"}',
  '  C -->|성공| D["홈"]',
  "  C -.->|실패| B",
  "```",
  "",
  "## 메모",
  "",
  "블록 뒤 산문.",
  "",
  "```text",
  "두 번째 펜스 블록",
  "```",
  "",
].join("\n");

const STEM = "main-v1";

/** <root>/docs/planning/user-flow/ 에 <stem>.md + (선택) 큐 픽스처 생성. docsDir 반환. */
function makeFlow(root: string, md: string | null, sugs?: unknown[]): string {
  const docsDir = join(root, "docs");
  mkdirSync(join(docsDir, "planning", "user-flow"), { recursive: true });
  if (md !== null) writeFileSync(join(docsDir, "planning", "user-flow", `${STEM}.md`), md);
  if (sugs) {
    writeFileSync(
      join(docsDir, "planning", "user-flow", `${STEM}.suggestions.json`),
      JSON.stringify({ version: 1, suggestions: sugs }, null, 2),
    );
  }
  return docsDir;
}

function readMd(docsDir: string): string {
  return readFileSync(join(docsDir, "planning", "user-flow", `${STEM}.md`), "utf-8");
}

/** 기본 유효 제안(D→A happy) 위에 필드를 덮어쓰는 헬퍼. */
function sug(id: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, op: "add-edge", from: "D", to: "A", edgeKind: "happy", label: "재시작", ...over };
}

describe("readUserFlowSuggestions", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "uflow-sug-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("정상 큐를 파싱해 반환한다", () => {
    const dir = makeFlow(root, FLOW_MD, [sug("s1")]);
    const q = readUserFlowSuggestions(dir, STEM);
    expect(q.version).toBe(1);
    expect(q.suggestions).toHaveLength(1);
    expect(q.suggestions[0]?.id).toBe("s1");
    expect(q.suggestions[0]?.op).toBe("add-edge");
  });

  it("큐 파일이 없으면 빈 큐를 반환한다(404 아님)", () => {
    const dir = makeFlow(root, FLOW_MD);
    expect(readUserFlowSuggestions(dir, STEM)).toEqual({ version: 1, suggestions: [] });
  });

  it("깨진 JSON이면 빈 큐를 반환한다(throw 금지)", () => {
    const dir = makeFlow(root, FLOW_MD);
    writeFileSync(join(dir, "planning", "user-flow", `${STEM}.suggestions.json`), "{ not json ");
    expect(readUserFlowSuggestions(dir, STEM)).toEqual({ version: 1, suggestions: [] });
  });

  it("stem이 안전 토큰이 아니면 빈 큐를 반환한다(경로 이탈 차단)", () => {
    const dir = makeFlow(root, FLOW_MD, [sug("s1")]);
    expect(readUserFlowSuggestions(dir, "../evil")).toEqual({ version: 1, suggestions: [] });
  });

  it("무효 제안은 걸러내고 유효만 남긴다(필드 누락·to+newNode 동시·둘 다 없음·어휘 밖)", () => {
    const dir = makeFlow(root, FLOW_MD, [
      sug("ok"),
      { id: "no-from", op: "add-edge", to: "A", edgeKind: "happy" }, // from 누락
      sug("both", { newNode: { id: "N", label: "새 화면" } }), // to+newNode 둘 다
      { id: "neither", op: "add-edge", from: "D", edgeKind: "happy" }, // 둘 다 없음
      sug("bad-kind", { edgeKind: "detour" }), // edgeKind 어휘 밖
      sug("bad-op", { op: "remove-edge" }), // op 어휘 밖
      sug("bad-newnode", { to: undefined, newNode: { id: "N" } }), // newNode.label 누락
    ]);
    expect(readUserFlowSuggestions(dir, STEM).suggestions.map((s) => s.id)).toEqual(["ok"]);
  });
});

describe("applyUserFlowSuggestions", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "uflow-apply-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("기존 노드 대상 happy 에지 승인 → `From -->|라벨| To` append + 재파싱 kind:'happy'", () => {
    const dir = makeFlow(root, FLOW_MD, [sug("s1")]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.applied).toBe(1);
    expect(r.remaining).toBe(0);
    expect(r.writeFailed).toBeUndefined();
    const out = readMd(dir);
    expect(out).toContain("D -->|재시작| A");
    const parsed = buildUserFlowFromLines(out.split(/\r?\n/));
    const added = parsed.rawEdges.find((e) => e.from === "D" && e.to === "A");
    expect(added).toEqual({ from: "D", to: "A", kind: "happy", label: "재시작" });
  });

  it("newNode 대상 edgecase 승인 → `From -.->|라벨| NewId[\"라벨\"]` append + 재파싱 새 노드", () => {
    const dir = makeFlow(root, FLOW_MD, [
      sug("s1", { to: undefined, newNode: { id: "Err", label: "오류 안내" }, edgeKind: "edgecase", label: "실패" }),
    ]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.applied).toBe(1);
    const out = readMd(dir);
    expect(out).toContain('D -.->|실패| Err["오류 안내"]');
    const parsed = buildUserFlowFromLines(out.split(/\r?\n/));
    expect(parsed.rawNodes.get("Err")).toBe("오류 안내");
    const added = parsed.rawEdges.find((e) => e.to === "Err");
    expect(added).toEqual({ from: "D", to: "Err", kind: "edgecase", label: "실패" });
  });

  it("라벨 없는 제안은 `From --> To` 형식으로 append한다", () => {
    const dir = makeFlow(root, FLOW_MD, [sug("s1", { label: undefined })]);
    applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    const out = readMd(dir);
    expect(out).toContain("D --> A");
    expect(out).not.toContain("D -->|");
  });

  it("append는 첫 mermaid 블록 닫는 펜스 직전에만 들어간다(블록 뒤 산문·두 번째 블록 불변)", () => {
    const dir = makeFlow(root, FLOW_MD, [sug("s1")]);
    applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    const beforeLines = FLOW_MD.split("\n");
    const closeIdx = beforeLines.indexOf("```", beforeLines.indexOf("```mermaid") + 1);
    const expected = [...beforeLines.slice(0, closeIdx), "  D -->|재시작| A", ...beforeLines.slice(closeIdx)].join(
      "\n",
    );
    expect(readMd(dir)).toBe(expected); // 전체 파일 정확 비교 — 위치·나머지 불변까지 못박음
  });

  it("from이 문서에 없으면 skipped, 원본 불변, 큐 잔존", () => {
    const dir = makeFlow(root, FLOW_MD, [sug("s1", { from: "ZZZ" })]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.skipped).toContain("s1");
    expect(r.applied).toBe(0);
    expect(r.remaining).toBe(1);
    expect(readMd(dir)).toBe(FLOW_MD);
  });

  it("to(기존 노드 지정)가 문서에 없으면 skipped", () => {
    const dir = makeFlow(root, FLOW_MD, [sug("s1", { to: "Ghost" })]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.skipped).toContain("s1");
    expect(readMd(dir)).toBe(FLOW_MD);
  });

  it("newNode id가 기존 id와 대소문자 무시 충돌하면 skipped", () => {
    const dir = makeFlow(root, FLOW_MD, [
      sug("s1", { to: undefined, newNode: { id: "b", label: "새 화면" } }), // 기존 B와 충돌
    ]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.skipped).toContain("s1");
    expect(readMd(dir)).toBe(FLOW_MD);
  });

  it("newNode id가 [A-Za-z0-9_]+ 형식이 아니면 skipped", () => {
    const dir = makeFlow(root, FLOW_MD, [
      sug("s1", { to: undefined, newNode: { id: "New-Node", label: "새 화면" } }),
    ]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.skipped).toContain("s1");
    expect(readMd(dir)).toBe(FLOW_MD);
  });

  it('라벨에 금지문자(`"`·`|`·개행)가 있으면 전부 skipped(D-4)', () => {
    const dir = makeFlow(root, FLOW_MD, [
      sug("s1", { label: '따옴표"포함' }),
      sug("s2", { label: "파이프|포함" }),
      sug("s3", { label: "개행\n포함" }),
      sug("s4", { to: undefined, newNode: { id: "N1", label: "라벨|금지" } }),
    ]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1", "s2", "s3", "s4"], reject: [] });
    expect(r.skipped).toEqual(expect.arrayContaining(["s1", "s2", "s3", "s4"]));
    expect(r.applied).toBe(0);
    expect(readMd(dir)).toBe(FLOW_MD);
  });

  it("동일 from·to·kind 에지가 이미 있으면 skipped(라벨 달라도) — 재적용 멱등", () => {
    const dir = makeFlow(root, FLOW_MD, [sug("s1")]);
    const r1 = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r1.applied).toBe(1);
    const snapshot = readMd(dir);
    // 같은 D→A happy 에지를 라벨만 바꿔 다시 제안 → 중복으로 skipped, 파일 불변.
    writeFileSync(
      join(dir, "planning", "user-flow", `${STEM}.suggestions.json`),
      JSON.stringify({ version: 1, suggestions: [sug("s2", { label: "다른라벨" })] }),
    );
    const r2 = applyUserFlowSuggestions(dir, STEM, { approve: ["s2"], reject: [] });
    expect(r2.skipped).toContain("s2");
    expect(r2.applied).toBe(0);
    expect(readMd(dir)).toBe(snapshot);
  });

  it("mermaid 블록이 없는 문서면 skipped(블록을 지어내지 않는다)", () => {
    const md = "# 유저 플로우\n\n초안만 있음.\n";
    const dir = makeFlow(root, md, [sug("s1")]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.skipped).toContain("s1");
    expect(r.applied).toBe(0);
    expect(readMd(dir)).toBe(md);
  });

  it("반려하면 문서는 바이트 단위로 불변, 큐에서만 제거한다", () => {
    const dir = makeFlow(root, FLOW_MD, [sug("s1")]);
    const before = readMd(dir);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: [], reject: ["s1"] });
    expect(r.rejected).toBe(1);
    expect(r.remaining).toBe(0);
    expect(readMd(dir)).toBe(before); // 바이트 동일
  });

  it("미실재 approve id는 skipped로 표면화한다(silent drop 금지)", () => {
    const dir = makeFlow(root, FLOW_MD, [sug("s1")]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["nope"], reject: [] });
    expect(r.skipped).toContain("nope");
    expect(r.applied).toBe(0);
    expect(r.remaining).toBe(1);
  });

  it("<stem>.md가 없으면 writeFailed(원본 보호, 큐 불변)", () => {
    const dir = makeFlow(root, null, [sug("s1")]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.writeFailed).toBe(true);
    expect(r.applied).toBe(0);
    expect(r.remaining).toBe(1);
  });

  // D-4는 `"`·`|`·개행만 금지라 `]`는 검증을 통과하지만, 인라인 정의 `Err["취소]확인"]`은
  // 재파싱 시 라벨이 "취소"로 잘려 roundtrip이 깨진다 → 가드가 write를 막는 결정론 경로.
  it("append 결과가 roundtrip 불변식을 깨면 write하지 않고 writeFailed(문서·큐 불변)", () => {
    const dir = makeFlow(root, FLOW_MD, [
      sug("s1", { to: undefined, newNode: { id: "Err", label: "취소]확인" }, label: undefined }),
    ]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.writeFailed).toBe(true);
    expect(r.applied).toBe(0);
    expect(r.remaining).toBe(1); // 큐 불변
    expect(readMd(dir)).toBe(FLOW_MD); // 문서 불변
  });

  it("정상 승인 후 self-roundtrip: 기존 노드·엣지 전부 보존 + 새 엣지만 추가(재파싱 단언)", () => {
    const dir = makeFlow(root, FLOW_MD, [sug("s1")]);
    const before = buildUserFlowFromLines(FLOW_MD.split("\n"));
    applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    const after = buildUserFlowFromLines(readMd(dir).split(/\r?\n/));
    // 기존 노드(raw id·라벨) 전부 보존
    for (const [id, label] of before.rawNodes) expect(after.rawNodes.get(id)).toBe(label);
    // 기존 엣지 전부 보존 + 새 엣지 1개만 추가
    expect(after.rawEdges).toHaveLength(before.rawEdges.length + 1);
    for (const e of before.rawEdges) expect(after.rawEdges).toContainEqual(e);
    expect(after.rawEdges).toContainEqual({ from: "D", to: "A", kind: "happy", label: "재시작" });
  });
});

/**
 * D-5 self-roundtrip 방어 단위 테스트 — userFlowInvariantHolds(before, afterLines, expected).
 * 무력화 프로브 포함: 가드를 `return true`로 스텁하면 아래 false 기대 테스트들이 빨갛게 된다.
 */
describe("userFlowInvariantHolds (D-5 self-roundtrip 방어)", () => {
  const beforeLines = FLOW_MD.split("\n");
  const before = buildUserFlowFromLines(beforeLines);
  const closeIdx = beforeLines.indexOf("```", beforeLines.indexOf("```mermaid") + 1);
  const NEW_EDGE = { from: "D", to: "A", kind: "happy" as const, label: "재시작" };

  it("닫는 펜스 직전에 기대 에지 한 줄만 추가된 lines는 true", () => {
    const afterLines = [...beforeLines.slice(0, closeIdx), "  D -->|재시작| A", ...beforeLines.slice(closeIdx)];
    expect(userFlowInvariantHolds(before, afterLines, [NEW_EDGE])).toBe(true);
  });

  it("기존 엣지 라인이 사라진 afterLines는 false(기존 노드·엣지 보존 위반)", () => {
    const damaged = beforeLines.filter((l) => l !== '  B --> C{"인증 확인"}');
    const afterLines = [...damaged.slice(0, closeIdx - 1), "  D -->|재시작| A", ...damaged.slice(closeIdx - 1)];
    expect(userFlowInvariantHolds(before, afterLines, [NEW_EDGE])).toBe(false);
  });

  it("기대와 다른 에지가 추가되면 false(제안과 결과 불일치)", () => {
    const afterLines = [...beforeLines.slice(0, closeIdx), "  D -->|재시작| B", ...beforeLines.slice(closeIdx)];
    expect(userFlowInvariantHolds(before, afterLines, [NEW_EDGE])).toBe(false);
  });

  it("기대 에지가 있는데 아무것도 추가 안 된 afterLines는 false(무력화 프로브)", () => {
    expect(userFlowInvariantHolds(before, beforeLines, [NEW_EDGE])).toBe(false);
  });
});
