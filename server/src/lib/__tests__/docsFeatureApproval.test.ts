/**
 * 기능명세(features) 승인/반려 편집 lib 단위 테스트 (6b 예광탄).
 *
 * 대상: readDocsFeatureSuggestions(제안 큐 읽기)·applyFeatureSuggestions(속성 라인 교체 반영·반려 제거).
 * 임시 DOCS_ROOT에 features.md + features.suggestions.json 픽스처를 만들어 실제 파일 왕복을 검증.
 * 핵심 불변식: op="set-attrs"는 노드의 속성 줄(중요도/상태)만 교체하고 라벨·본문·자식은 불변.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readDocsFeatureSuggestions,
  applyFeatureSuggestions,
  structureInvariantHolds,
  treeFingerprint,
} from "../featureDocs.js";
import { buildFeatureTreeFromLines } from "../../parser/featureTreeBuilder.js";
import type { FeatureSuggestion } from "@flowforge/shared";

/** 3단 트리 features.md 픽스처(요구사항/기능/상세기능 + 속성 줄). featureTreeBuilder 문법과 동일. */
const FEATURES_MD = [
  "# 기능명세서: 데모",
  "",
  "## 기획 산출물 생성",
  "<!-- capability: planning-authoring -->",
  "(중요도: 높음, 상태: 진행중)",
  "",
  "본문 산문.",
  "",
  "### PRD 생성",
  "(중요도: 중간, 상태: 시작전)",
  "",
  "#### 5섹션 PRD 작성",
  "(중요도: 낮음, 상태: 시작전)",
  "",
  "## 다른 요구사항",
  "<!-- capability: other -->",
  "(중요도: 중간, 상태: 시작전)",
  "",
].join("\n");

/** <root>/<project>/docs/planning/ 에 features.md + (선택) suggestions 큐 픽스처 생성. */
function makePlanning(root: string, project: string, md: string | null, sugs?: unknown[]): string {
  const docsDir = join(root, project, "docs");
  mkdirSync(join(docsDir, "planning"), { recursive: true });
  if (md !== null) writeFileSync(join(docsDir, "planning", "features.md"), md);
  if (sugs) {
    writeFileSync(
      join(docsDir, "planning", "features.suggestions.json"),
      JSON.stringify({ version: 1, suggestions: sugs }, null, 2),
    );
  }
  return docsDir;
}

const sug = (
  id: string,
  nodePath: string[],
  attrs: Partial<Pick<FeatureSuggestion, "priority" | "status">>,
): FeatureSuggestion => ({ id, nodePath, op: "set-attrs", ...attrs });

describe("readDocsFeatureSuggestions", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "feat-sug-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("정상 큐를 파싱해 반환한다", () => {
    const dir = makePlanning(root, "p", FEATURES_MD, [sug("s1", ["기획 산출물 생성"], { priority: "낮음" })]);
    const q = readDocsFeatureSuggestions(dir);
    expect(q.version).toBe(1);
    expect(q.suggestions).toHaveLength(1);
    expect(q.suggestions[0]?.id).toBe("s1");
    expect(q.suggestions[0]?.op).toBe("set-attrs");
  });

  it("큐 파일이 없으면 빈 큐를 반환한다(404 아님)", () => {
    const dir = makePlanning(root, "p", FEATURES_MD);
    expect(readDocsFeatureSuggestions(dir)).toEqual({ version: 1, suggestions: [] });
  });

  it("깨진 JSON이면 빈 큐를 반환한다(throw 금지)", () => {
    const dir = makePlanning(root, "p", FEATURES_MD);
    writeFileSync(join(dir, "planning", "features.suggestions.json"), "{ not json ");
    expect(readDocsFeatureSuggestions(dir)).toEqual({ version: 1, suggestions: [] });
  });

  it("미인식 op/nodePath/어휘 항목은 걸러낸다", () => {
    const dir = makePlanning(root, "p", FEATURES_MD);
    writeFileSync(
      join(dir, "planning", "features.suggestions.json"),
      JSON.stringify({
        version: 1,
        suggestions: [
          { id: "ok", nodePath: ["A"], op: "set-attrs", priority: "높음" },
          { id: "bad-op", nodePath: ["A"], op: "delete" },
          { id: "empty-path", nodePath: [], op: "set-attrs" },
          { id: "bad-priority", nodePath: ["A"], op: "set-attrs", priority: "매우높음" },
          { id: "bad-status", nodePath: ["A"], op: "set-attrs", status: "언젠가" },
        ],
      }),
    );
    expect(readDocsFeatureSuggestions(dir).suggestions.map((s) => s.id)).toEqual(["ok"]);
  });

  // LOW 수정: priority·status 둘 다 없으면 아무것도 안 바꾸는 무의미 제안 → 큐에서 제외.
  it("priority·status 둘 다 없는 제안은 걸러내고 정상 항목만 반환한다(무의미 제안 필터)", () => {
    const dir = makePlanning(root, "p", FEATURES_MD);
    writeFileSync(
      join(dir, "planning", "features.suggestions.json"),
      JSON.stringify({
        version: 1,
        suggestions: [
          { id: "noop", nodePath: ["A"], op: "set-attrs" }, // 둘 다 없음 → 제외
          { id: "ok", nodePath: ["A"], op: "set-attrs", priority: "높음", status: "완료" }, // 정상
        ],
      }),
    );
    // 큐 length가 2 → 1로 줄고, 무의미 항목(noop)은 사라진다.
    expect(readDocsFeatureSuggestions(dir).suggestions.map((s) => s.id)).toEqual(["ok"]);
  });

  it("priority만 있거나 status만 있는 제안은 통과한다(둘 중 하나면 유의미)", () => {
    const dir = makePlanning(root, "p", FEATURES_MD);
    writeFileSync(
      join(dir, "planning", "features.suggestions.json"),
      JSON.stringify({
        version: 1,
        suggestions: [
          { id: "prio-only", nodePath: ["A"], op: "set-attrs", priority: "낮음" }, // priority만 → 통과
          { id: "stat-only", nodePath: ["A"], op: "set-attrs", status: "진행중" }, // status만 → 통과
          { id: "noop", nodePath: ["A"], op: "set-attrs" }, // 둘 다 없음 → 제외
        ],
      }),
    );
    expect(readDocsFeatureSuggestions(dir).suggestions.map((s) => s.id)).toEqual(["prio-only", "stat-only"]);
  });
});

describe("applyFeatureSuggestions", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "feat-apply-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("승인하면 노드 속성 줄만 교체하고 라벨·본문·자식·capability는 불변", () => {
    const dir = makePlanning(root, "p", FEATURES_MD, [
      sug("s1", ["기획 산출물 생성"], { priority: "낮음", status: "완료" }),
    ]);
    const r = applyFeatureSuggestions(dir, { approve: ["s1"], reject: [] });
    expect(r.applied).toBe(1);
    expect(r.remaining).toBe(0);
    const out = readFileSync(join(dir, "planning", "features.md"), "utf-8");
    // 속성 줄 교체됨
    expect(out).toContain("## 기획 산출물 생성\n<!-- capability: planning-authoring -->\n(중요도: 낮음, 상태: 완료)");
    // 라벨·capability·본문·자식 불변
    expect(out).toContain("<!-- capability: planning-authoring -->");
    expect(out).toContain("본문 산문.");
    expect(out).toContain("### PRD 생성");
    expect(out).toContain("#### 5섹션 PRD 작성");
    // 다른 노드 속성은 불변
    expect(out).toContain("## 다른 요구사항");
    expect(out).toMatch(/## 다른 요구사항[\s\S]*중요도: 중간, 상태: 시작전/);
  });

  it("생략된 속성은 미변경(priority만 주면 status 유지)", () => {
    const dir = makePlanning(root, "p", FEATURES_MD, [sug("s1", ["기획 산출물 생성"], { priority: "낮음" })]);
    applyFeatureSuggestions(dir, { approve: ["s1"], reject: [] });
    const out = readFileSync(join(dir, "planning", "features.md"), "utf-8");
    // status(진행중) 유지, priority만 낮음으로
    expect(out).toContain("(중요도: 낮음, 상태: 진행중)");
  });

  it("자식 노드(#### 상세기능)도 nodePath 3단으로 특정해 교체한다", () => {
    const dir = makePlanning(root, "p", FEATURES_MD, [
      sug("s1", ["기획 산출물 생성", "PRD 생성", "5섹션 PRD 작성"], { status: "완료" }),
    ]);
    const r = applyFeatureSuggestions(dir, { approve: ["s1"], reject: [] });
    expect(r.applied).toBe(1);
    const out = readFileSync(join(dir, "planning", "features.md"), "utf-8");
    expect(out).toContain("#### 5섹션 PRD 작성\n(중요도: 낮음, 상태: 완료)");
    // 상위 노드 속성 불변
    expect(out).toContain("### PRD 생성\n(중요도: 중간, 상태: 시작전)");
  });

  it("반려하면 원본 불변, 큐에서만 제거한다", () => {
    const dir = makePlanning(root, "p", FEATURES_MD, [sug("s1", ["기획 산출물 생성"], { priority: "낮음" })]);
    const before = readFileSync(join(dir, "planning", "features.md"), "utf-8");
    const r = applyFeatureSuggestions(dir, { approve: [], reject: ["s1"] });
    expect(r.rejected).toBe(1);
    expect(r.remaining).toBe(0);
    expect(readFileSync(join(dir, "planning", "features.md"), "utf-8")).toBe(before);
  });

  it("같은 노드 두 승인은 큐 순서 뒤가 이긴다(결정론)", () => {
    const dir = makePlanning(root, "p", FEATURES_MD, [
      sug("s1", ["기획 산출물 생성"], { priority: "중간" }),
      sug("s2", ["기획 산출물 생성"], { priority: "낮음" }),
    ]);
    applyFeatureSuggestions(dir, { approve: ["s1", "s2"], reject: [] });
    const out = readFileSync(join(dir, "planning", "features.md"), "utf-8");
    expect(out).toMatch(/## 기획 산출물 생성[\s\S]*?중요도: 낮음/);
  });

  it("nodePath로 노드를 못 찾으면 skipped, 큐에 남긴다(원본 불변)", () => {
    const dir = makePlanning(root, "p", FEATURES_MD, [sug("s1", ["존재하지 않는 요구사항"], { priority: "낮음" })]);
    const before = readFileSync(join(dir, "planning", "features.md"), "utf-8");
    const r = applyFeatureSuggestions(dir, { approve: ["s1"], reject: [] });
    expect(r.skipped).toContain("s1");
    expect(r.applied).toBe(0);
    expect(r.remaining).toBe(1); // 큐에 남음
    expect(readFileSync(join(dir, "planning", "features.md"), "utf-8")).toBe(before);
  });

  // MEDIUM 수정: 동일 label 형제가 2개 이상이면 어느 노드인지 모호 → 첫 매치를 조용히
  // 바꾸지 않고 skipped로 표면화(엉뚱한 노드 오변경 방지). features.md는 어느 쪽도 안 바뀐다.
  it("동일 label 형제가 2개면 모호 → skipped, features.md 원본 불변(applied:0)", () => {
    const dupMd = [
      "# 기능명세서: 데모",
      "",
      "## 반복 요구사항",
      "<!-- capability: repeat-a -->",
      "(중요도: 높음, 상태: 진행중)",
      "",
      "본문 산문 A.",
      "",
      "## 반복 요구사항",
      "<!-- capability: repeat-b -->",
      "(중요도: 중간, 상태: 시작전)",
      "",
      "본문 산문 B.",
      "",
    ].join("\n");
    const dir = makePlanning(root, "p", dupMd, [sug("s1", ["반복 요구사항"], { priority: "낮음", status: "완료" })]);
    const before = readFileSync(join(dir, "planning", "features.md"), "utf-8");
    const r = applyFeatureSuggestions(dir, { approve: ["s1"], reject: [] });
    expect(r.skipped).toContain("s1");
    expect(r.applied).toBe(0);
    expect(r.remaining).toBe(1); // 반영 못 했으니 큐에 남는다
    // 어느 쪽 노드도 안 바뀌었다(둘 다 원본 그대로 = 파일 통째 불변).
    expect(readFileSync(join(dir, "planning", "features.md"), "utf-8")).toBe(before);
    expect(r.writeFailed).toBeUndefined();
  });

  // 대비: 동일 label이 1개뿐이면 모호성 판정이 과잉 차단하지 않고 정상 반영된다(applied:1).
  it("동일 label이 1개뿐이면 모호성 판정에 걸리지 않고 정상 반영된다(applied:1)", () => {
    const dir = makePlanning(root, "p", FEATURES_MD, [
      sug("s1", ["기획 산출물 생성"], { priority: "낮음", status: "완료" }),
    ]);
    const r = applyFeatureSuggestions(dir, { approve: ["s1"], reject: [] });
    expect(r.applied).toBe(1);
    expect(r.skipped).not.toContain("s1");
    expect(r.remaining).toBe(0);
    const out = readFileSync(join(dir, "planning", "features.md"), "utf-8");
    expect(out).toContain("## 기획 산출물 생성\n<!-- capability: planning-authoring -->\n(중요도: 낮음, 상태: 완료)");
  });

  it("미실재 id는 skipped로 표면화한다(silent drop 금지)", () => {
    const dir = makePlanning(root, "p", FEATURES_MD, [sug("s1", ["기획 산출물 생성"], { priority: "낮음" })]);
    const r = applyFeatureSuggestions(dir, { approve: ["nope"], reject: [] });
    expect(r.skipped).toContain("nope");
    expect(r.applied).toBe(0);
    expect(r.remaining).toBe(1);
  });

  it("features.md가 없으면 writeFailed(원본 보호, 큐 불변)", () => {
    const dir = makePlanning(root, "p", null, [sug("s1", ["A"], { priority: "낮음" })]);
    const r = applyFeatureSuggestions(dir, { approve: ["s1"], reject: [] });
    expect(r.writeFailed).toBe(true);
    expect(r.applied).toBe(0);
    expect(r.remaining).toBe(1);
  });

  // D5 self-roundtrip 불변식(spec scenario "self-roundtrip 불변식 위반 시 원본 보호"):
  // 정상 승인은 write 전후 노드 개수·capability 키 집합이 불변이라야 실제로 write가 일어난다.
  it("정상 승인은 self-roundtrip 불변식(노드 개수·capability 불변)을 통과해 write된다", () => {
    const dir = makePlanning(root, "p", FEATURES_MD, [
      sug("s1", ["기획 산출물 생성"], { priority: "낮음", status: "완료" }),
    ]);
    // 반영 전 트리 지문(가상 루트 제외) — 반영 후와 동일해야 한다.
    const before = treeFingerprint(buildFeatureTreeFromLines(FEATURES_MD.split(/\r?\n/)).root);
    const r = applyFeatureSuggestions(dir, { approve: ["s1"], reject: [] });
    // 불변식 통과 → 정상 write(422/writeFailed 없음).
    expect(r.applied).toBe(1);
    expect(r.writeFailed).toBeUndefined();
    const out = readFileSync(join(dir, "planning", "features.md"), "utf-8");
    const after = treeFingerprint(buildFeatureTreeFromLines(out.split(/\r?\n/)).root);
    // self-roundtrip: 반영 후 재파싱해도 노드 개수·capability 키 집합 그대로.
    expect(after.count).toBe(before.count);
    expect([...after.caps].sort()).toEqual([...before.caps].sort());
    // 속성만 실제로 바뀌었는지도 확인(happy-path가 no-op이 아님을 못박음).
    expect(out).toContain("(중요도: 낮음, 상태: 완료)");
  });
});

/**
 * D5 self-roundtrip 방어 단위 테스트 — structureInvariantHolds(before, afterLines).
 * spec scenario "self-roundtrip 불변식 위반 시 원본 보호": 반영 결과를 재파싱했을 때 노드 개수
 * 또는 capability 키 집합이 원본과 달라지면 false여야 applyFeatureSuggestions가 write를 막는다.
 * before 트리는 buildFeatureTreeFromLines로 만들고, afterLines를 손상시켜 false 경로를 밟는다.
 */
describe("structureInvariantHolds (D5 self-roundtrip 방어)", () => {
  const beforeTree = buildFeatureTreeFromLines(FEATURES_MD.split(/\r?\n/)).root;

  it("속성 줄만 바뀐 lines는 불변식을 유지한다(true)", () => {
    // 속성 값만 교체(중요도/상태) — 헤더·capability·위계 불변 → 노드 개수·capability 동일.
    const afterLines = FEATURES_MD.replace("(중요도: 높음, 상태: 진행중)", "(중요도: 낮음, 상태: 완료)").split(
      /\r?\n/,
    );
    expect(structureInvariantHolds(beforeTree, afterLines)).toBe(true);
  });

  it("노드(헤더 줄)가 사라지면 노드 개수 감소로 위반(false)", () => {
    // "### PRD 생성" 헤더 줄을 통째 제거 → 트리 노드 개수 감소.
    const afterLines = FEATURES_MD.split(/\r?\n/).filter((l) => l !== "### PRD 생성");
    expect(structureInvariantHolds(beforeTree, afterLines)).toBe(false);
  });

  it("헤더 줄이 늘면 노드 개수 증가로 위반(false)", () => {
    // 엉뚱한 새 요구사항 헤더가 삽입됨(라인 패치가 위계를 흔든 상황 모사).
    const afterLines = [...FEATURES_MD.split(/\r?\n/), "## 유령 요구사항", "(중요도: 중간, 상태: 시작전)"];
    expect(structureInvariantHolds(beforeTree, afterLines)).toBe(false);
  });

  it("capability 주석이 사라지면 키 집합 변화로 위반(false)", () => {
    // 노드 개수는 그대로지만 capability 주석 한 줄이 사라져 키 집합 크기가 줄어든다.
    const afterLines = FEATURES_MD.split(/\r?\n/).filter((l) => l !== "<!-- capability: planning-authoring -->");
    expect(structureInvariantHolds(beforeTree, afterLines)).toBe(false);
  });

  it("capability 키가 다른 값으로 바뀌면 키 집합 변화로 위반(false)", () => {
    // 개수·집합 크기는 같아도 키 문자열이 달라지면 매핑이 깨진 것 → false.
    const afterLines = FEATURES_MD.replace(
      "<!-- capability: planning-authoring -->",
      "<!-- capability: hijacked -->",
    ).split(/\r?\n/);
    expect(structureInvariantHolds(beforeTree, afterLines)).toBe(false);
  });
});
