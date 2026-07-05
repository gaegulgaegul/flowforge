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
  pruneUserFlowQueue,
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

  it("from이 문서에 없으면 skipped(사유 포함), 원본 불변, 큐 잔존", () => {
    const dir = makeFlow(root, FLOW_MD, [sug("s1", { from: "ZZZ" })]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.skipped).toContain("s1: from-not-in-doc");
    expect(r.applied).toBe(0);
    expect(r.remaining).toBe(1);
    expect(readMd(dir)).toBe(FLOW_MD);
  });

  it("to(기존 노드 지정)가 문서에 없으면 skipped", () => {
    const dir = makeFlow(root, FLOW_MD, [sug("s1", { to: "Ghost" })]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.skipped).toContain("s1: to-not-in-doc");
    expect(readMd(dir)).toBe(FLOW_MD);
  });

  it("newNode id가 기존 id와 대소문자 무시 충돌하면 skipped", () => {
    const dir = makeFlow(root, FLOW_MD, [
      sug("s1", { to: undefined, newNode: { id: "b", label: "새 화면" } }), // 기존 B와 충돌
    ]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.skipped).toContain("s1: newNode-id-collision");
    expect(readMd(dir)).toBe(FLOW_MD);
  });

  it("newNode id가 [A-Za-z0-9_]+ 형식이 아니면 skipped", () => {
    const dir = makeFlow(root, FLOW_MD, [
      sug("s1", { to: undefined, newNode: { id: "New-Node", label: "새 화면" } }),
    ]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.skipped).toContain("s1: newNode-id-invalid");
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
    expect(r.skipped).toEqual(
      expect.arrayContaining([
        "s1: label-forbidden-char",
        "s2: label-forbidden-char",
        "s3: label-forbidden-char",
        "s4: newNode-label-forbidden-char",
      ]),
    );
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
    expect(r2.skipped).toContain("s2: duplicate-edge");
    expect(r2.applied).toBe(0);
    expect(readMd(dir)).toBe(snapshot);
  });

  it("mermaid 블록이 없는 문서면 skipped(블록을 지어내지 않는다)", () => {
    const md = "# 유저 플로우\n\n초안만 있음.\n";
    const dir = makeFlow(root, md, [sug("s1")]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.skipped).toContain("s1: no-mermaid-block");
    expect(r.applied).toBe(0);
    expect(readMd(dir)).toBe(md);
  });

  // D-4 단일 감지 회귀: append 대상과 파싱 대상이 항상 같은 블록이어야 한다.
  // 과거 firstMermaidCloseIdx는 startsWith("```mermaid")라 ```mermaid-example을 열림 펜스로
  // 오인 → append가 예제 블록에 들어가 파싱 대상(진짜 블록)과 갈라졌다.
  it("```mermaid-example 블록이 진짜 블록 앞에 있어도 승인이 진짜 mermaid 블록에 append된다", () => {
    const md = [
      "예시 문법:",
      "",
      "```mermaid-example",
      "flowchart TD",
      "  X --> Y",
      "```",
      "",
      FLOW_MD,
    ].join("\n");
    const dir = makeFlow(root, md, [sug("s1")]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.applied).toBe(1);
    expect(r.skipped).toEqual([]);
    expect(r.writeFailed).toBeUndefined();
    // 진짜 ```mermaid 블록의 닫는 펜스 직전에만 삽입(예제 블록·나머지 불변) — 전체 파일 정확 비교.
    const beforeLines = md.split("\n");
    const openIdx = beforeLines.indexOf("```mermaid"); // "```mermaid-example"과는 정확 일치 안 함
    const closeIdx = beforeLines.indexOf("```", openIdx + 1);
    const expected = [...beforeLines.slice(0, closeIdx), "  D -->|재시작| A", ...beforeLines.slice(closeIdx)].join(
      "\n",
    );
    expect(readMd(dir)).toBe(expected);
  });

  // EOL 보존(D-1): CRLF 문서에 append하면 새 에지 줄도 CRLF, 기존 줄도 CRLF 그대로.
  it("CRLF 문서에 add-edge 승인 → append 줄도 CRLF, 기존 줄 CRLF 불변(EOL roundtrip)", () => {
    const dir = makeFlow(root, FLOW_MD.replaceAll("\n", "\r\n"), [sug("s1")]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.applied).toBe(1);
    const out = readMd(dir);
    // 바이트 단위: 모든 줄바꿈이 \r\n — CRLF 쌍을 걷어내면 홀로 남는 \n·\r이 없어야 한다.
    const stripped = out.replaceAll("\r\n", "");
    expect(stripped).not.toContain("\n");
    expect(stripped).not.toContain("\r");
    // 전체 파일 정확 비교: 닫는 펜스 직전 CRLF 에지 한 줄 삽입 외엔 바이트 불변.
    const beforeLines = FLOW_MD.split("\n");
    const closeIdx = beforeLines.indexOf("```", beforeLines.indexOf("```mermaid") + 1);
    const expected = [...beforeLines.slice(0, closeIdx), "  D -->|재시작| A", ...beforeLines.slice(closeIdx)].join(
      "\r\n",
    );
    expect(out).toBe(expected);
  });

  it("반려하면 문서는 바이트 단위로 불변, 큐에서만 제거한다", () => {
    const dir = makeFlow(root, FLOW_MD, [sug("s1")]);
    const before = readMd(dir);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: [], reject: ["s1"] });
    expect(r.rejected).toBe(1);
    expect(r.remaining).toBe(0);
    expect(readMd(dir)).toBe(before); // 바이트 동일
  });

  it("미실재 approve id는 skipped로 사유와 함께 표면화한다(silent drop 금지)", () => {
    const dir = makeFlow(root, FLOW_MD, [sug("s1")]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["nope"], reject: [] });
    expect(r.skipped).toContain("nope: not-in-queue");
    expect(r.applied).toBe(0);
    expect(r.remaining).toBe(1);
  });

  it("불안전 stem이면 writeFailed + 전 id를 unsafe-stem 사유로 skipped(어떤 경로에도 안 씀)", () => {
    const dir = makeFlow(root, FLOW_MD, [sug("s1")]);
    const r = applyUserFlowSuggestions(dir, "../evil", { approve: ["s1"], reject: ["s2"] });
    expect(r.writeFailed).toBe(true);
    expect(r.skipped).toEqual(["s1: unsafe-stem", "s2: unsafe-stem"]);
    expect(readMd(dir)).toBe(FLOW_MD);
  });

  it("<stem>.md가 없으면 writeFailed(원본 보호, 큐 불변)", () => {
    const dir = makeFlow(root, null, [sug("s1")]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.writeFailed).toBe(true);
    expect(r.applied).toBe(0);
    expect(r.remaining).toBe(1);
  });

  // D-4는 `"`·`|`·개행만 금지라 `]`는 검증을 통과하지만, 인라인 정의 `Err["취소]확인"]`은
  // 재파싱 시 라벨이 "취소"로 잘려 roundtrip이 깨진다 → 제안별 사전 roundtrip이 그 제안만
  // skipped 처리하고 문서를 건드리지 않는다(배치 writeFailed 독살 아님 — review 치명 1 수정).
  it("roundtrip을 깨는 제안은 개별 skipped·문서 불변(배치 writeFailed 아님)", () => {
    const dir = makeFlow(root, FLOW_MD, [
      sug("s1", { to: undefined, newNode: { id: "Err", label: "취소]확인" }, label: undefined }),
    ]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.writeFailed).toBeUndefined();
    expect(r.applied).toBe(0);
    expect(r.skipped).toEqual(expect.arrayContaining([expect.stringMatching(/^s1: /)]));
    expect(r.remaining).toBe(1); // 검증 위반은 큐에 남는다
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
  it("파싱을 오염시키는 라벨(`[foo]`)은 그 제안만 skipped, 유효 형제는 정상 반영(배치 독살 금지)", () => {
    // `[foo]`는 D-4 금지문자 밖이지만 재파싱 시 노드 모양으로 벗겨져 라벨이 달라진다 —
    // 개별 사전 roundtrip이 없으면 배치 전체가 사유 없는 422로 죽는다(review 치명 1).
    const dir = makeFlow(root, FLOW_MD, [sug("poison", { label: "선택지 [예/아니오]" }), sug("ok", { label: "재시작" })]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["poison", "ok"], reject: [] });
    expect(r.writeFailed).toBeUndefined();
    expect(r.applied).toBe(1);
    expect(r.skipped).toEqual(expect.arrayContaining([expect.stringMatching(/^poison: /)]));
    const out = readMd(dir);
    expect(out).toContain("D -->|재시작| A");
    expect(out).not.toContain("예/아니오");
  });

  // D-4 단일 감지 이후: 닫는 펜스는 "라인 시작 ```"만 인정(CommonMark과 동일)이라 라인 중간
  // 백틱은 블록을 절단하지 못한다. append 라인은 항상 `  <from> `으로 시작하므로 펜스가 될 수
  // 없음 → 과거 정규식(문자열 중간 ``` 매칭)의 오탐 skip이 사라지고 정상 반영된다.
  it("백틱이 든 newNode 라벨은 라인 중간이라 펜스를 절단하지 않는다(정상 반영·블록 무결)", () => {
    const dir = makeFlow(root, FLOW_MD, [
      sug("tick", { to: undefined, newNode: { id: "Tk", label: "코드 ``` 블록" }, edgeKind: "edgecase" }),
      sug("ok", { label: "재시작" }),
    ]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["tick", "ok"], reject: [] });
    expect(r.writeFailed).toBeUndefined();
    expect(r.applied).toBe(2);
    expect(r.skipped).toEqual([]);
    // 재파싱해도 블록이 절단되지 않고 기존 4개 + 신규 2개 에지 전부 보인다.
    const parsed = buildUserFlowFromLines(readMd(dir).split(/\r?\n/));
    expect(parsed.rawEdges).toHaveLength(6);
    expect(parsed.rawNodes.get("Tk")).toBe("코드 ``` 블록");
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

/**
 * D-2 큐 clobber 완화 — pruneUserFlowQueue(재독 후 차집합).
 * apply가 동기 함수라 외부에서 mid-apply 경합을 주입할 수 없어, "쓰기 직전 재독본
 * 기준 차집합" 계약을 이 헬퍼 단위로 박제한다(apply 꼬리가 이 헬퍼를 호출).
 */
describe("pruneUserFlowQueue (D-2 재독 차집합)", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "uflow-prune-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("재독본에만 있는 신규 제안은 보존하고 처리 id만 제거한다", () => {
    // 스냅샷 시점엔 s1만 있었다고 가정 — 쓰기 직전 파일엔 s1+신규 s2가 있다.
    const dir = makeFlow(root, FLOW_MD, [sug("s1"), sug("s2", { label: "인플라이트 신규" })]);
    const remaining = pruneUserFlowQueue(dir, STEM, new Set(["s1"]));
    expect(remaining).toBe(1);
    const q = readUserFlowSuggestions(dir, STEM);
    expect(q.suggestions.map((s) => s.id)).toEqual(["s2"]);
  });

  it("큐 파일이 없으면 빈 큐를 쓰고 0을 반환한다(throw 금지)", () => {
    const dir = makeFlow(root, FLOW_MD);
    expect(pruneUserFlowQueue(dir, STEM, new Set(["s1"]))).toBe(0);
    expect(readUserFlowSuggestions(dir, STEM)).toEqual({ version: 1, suggestions: [] });
  });
});

/** 엣지 게이트 보강(approval-family-hardening 2차 review) — 전부 BENIGN 확인용 박제. */
describe("엣지: 빈 문서·미폐합 펜스·혼합 EOL·non-string id", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "uflow-edge-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("빈 <stem>.md는 전건 no-mermaid-block skipped·문서 불변", () => {
    const dir = makeFlow(root, "", [sug("s1")]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.applied).toBe(0);
    expect(r.skipped).toContain("s1: no-mermaid-block");
    expect(readMd(dir)).toBe("");
  });

  it("여는 펜스만 있고 닫히지 않은 mermaid 블록도 no-mermaid-block skipped·문서 불변", () => {
    const md = ["# 흐름", "", "```mermaid", "flowchart TD", '  A(["시작"]) --> B["홈"]', ""].join("\n");
    const dir = makeFlow(root, md, [sug("s1", { from: "A", to: "B" })]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.applied).toBe(0);
    expect(r.skipped).toEqual(expect.arrayContaining([expect.stringMatching(/^s1: /)]));
    expect(readMd(dir)).toBe(md);
  });

  it("혼합 EOL 문서는 any-CRLF-wins로 결정론 수렴한다(D-1 수용 동작 박제)", () => {
    const mixed = FLOW_MD.replace("flowchart TD\n", "flowchart TD\r\n"); // CRLF 1줄 혼합
    const dir = makeFlow(root, mixed, [sug("s1")]);
    const r = applyUserFlowSuggestions(dir, STEM, { approve: ["s1"], reject: [] });
    expect(r.applied).toBe(1);
    const out = readMd(dir);
    expect(out).toContain("D -->|재시작| A");
    // 결정론: CRLF가 하나라도 있으면 전체 CRLF로 수렴(설계 수용) — LF 단독 줄이 남지 않는다.
    expect(out.split("\r\n").length - 1).toBe(out.split("\n").length - 1);
  });

  it("큐의 non-string id 제안은 읽기에서 걸러진다(프로토타입 오염류 무해)", () => {
    const dir = makeFlow(root, FLOW_MD, [sug("ok"), { ...sug("x"), id: 123 }, { ...sug("y"), id: null }]);
    expect(readUserFlowSuggestions(dir, STEM).suggestions.map((s) => s.id)).toEqual(["ok"]);
  });
});
