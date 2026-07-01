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
import { readDocsFeatureSuggestions, applyFeatureSuggestions } from "../featureDocs.js";
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
});
