/**
 * PRD 승인/반려 편집 UI lib 단위 테스트 (6a 예광탄, RED-first).
 *
 * 대상: readDocsPrdSuggestions(제안 큐 읽기)·writeDocsPlanningPrd(섹션 교체 역직렬화)·
 * applyPrdSuggestions(승인 반영·반려 제거)·isPrdApplyRequest(body 검증).
 * 임시 DOCS_ROOT에 prd.md + prd.suggestions.json 픽스처를 만들어 실제 파일 왕복을 검증.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readDocsPrdSuggestions,
  writeDocsPlanningPrd,
  applyPrdSuggestions,
  isPrdApplyRequest,
} from "../docs.js";
import type { PrdSuggestion } from "@flowforge/shared";

/** 표준 5섹션 prd.md 본문(H1 title 서문 포함). */
const PRD_MD = `# PRD: 데모프로젝트

## 개요

원래 개요 본문.

## 핵심가치

원래 핵심가치.

## 타겟·시나리오

원래 타겟.

## 성공지표

원래 성공지표.

## 속성설정

원래 속성.
`;

/** <root>/<project>/docs/planning/ 에 prd.md + (선택) suggestions 큐 픽스처 생성. */
function makePlanning(root: string, project: string, prdMd: string | null, sugs?: PrdSuggestion[]): string {
  const docsDir = join(root, project, "docs");
  mkdirSync(join(docsDir, "planning"), { recursive: true });
  if (prdMd !== null) writeFileSync(join(docsDir, "planning", "prd.md"), prdMd);
  if (sugs) {
    writeFileSync(
      join(docsDir, "planning", "prd.suggestions.json"),
      JSON.stringify({ version: 1, suggestions: sugs }, null, 2),
    );
  }
  return docsDir;
}

const sug = (id: string, section: PrdSuggestion["section"], body: string): PrdSuggestion => ({
  id,
  section,
  op: "replace",
  proposedBody: body,
});

describe("readDocsPrdSuggestions", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "prd-sug-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("정상 큐를 파싱해 반환한다", () => {
    const dir = makePlanning(root, "p", PRD_MD, [sug("s1", "overview", "새 개요")]);
    const q = readDocsPrdSuggestions(dir);
    expect(q.version).toBe(1);
    expect(q.suggestions).toHaveLength(1);
    expect(q.suggestions[0]?.id).toBe("s1");
    expect(q.suggestions[0]?.section).toBe("overview");
  });

  it("큐 파일이 없으면 빈 큐를 반환한다(404 아님)", () => {
    const dir = makePlanning(root, "p", PRD_MD);
    const q = readDocsPrdSuggestions(dir);
    expect(q).toEqual({ version: 1, suggestions: [] });
  });

  it("깨진 JSON이면 빈 큐를 반환한다(throw 금지)", () => {
    const dir = makePlanning(root, "p", PRD_MD);
    writeFileSync(join(dir, "planning", "prd.suggestions.json"), "{ not json ");
    expect(readDocsPrdSuggestions(dir)).toEqual({ version: 1, suggestions: [] });
  });

  it("미인식 section/op 항목은 걸러낸다", () => {
    const dir = makePlanning(root, "p", PRD_MD);
    writeFileSync(
      join(dir, "planning", "prd.suggestions.json"),
      JSON.stringify({
        version: 1,
        suggestions: [
          { id: "ok", section: "metrics", op: "replace", proposedBody: "x" },
          { id: "bad-section", section: "nope", op: "replace", proposedBody: "x" },
          { id: "bad-op", section: "overview", op: "delete", proposedBody: "x" },
        ],
      }),
    );
    const q = readDocsPrdSuggestions(dir);
    expect(q.suggestions.map((s) => s.id)).toEqual(["ok"]);
  });
});

describe("writeDocsPlanningPrd", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "prd-write-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("단일 섹션만 교체하고 나머지 4섹션은 보존한다", () => {
    const dir = makePlanning(root, "p", PRD_MD);
    const ok = writeDocsPlanningPrd(dir, { overview: "교체된 개요" });
    expect(ok).toBe(true);
    const out = readFileSync(join(dir, "planning", "prd.md"), "utf-8");
    expect(out).toContain("교체된 개요");
    expect(out).not.toContain("원래 개요 본문.");
    expect(out).toContain("원래 핵심가치.");
    expect(out).toContain("원래 속성.");
  });

  it("H1 title 서문을 보존한다", () => {
    const dir = makePlanning(root, "p", PRD_MD);
    writeDocsPlanningPrd(dir, { metrics: "새 지표" });
    const out = readFileSync(join(dir, "planning", "prd.md"), "utf-8");
    expect(out).toContain("# PRD: 데모프로젝트");
  });

  it("교체 후에도 5섹션이 여전히 파싱된다(재조회 가능)", () => {
    const dir = makePlanning(root, "p", PRD_MD);
    writeDocsPlanningPrd(dir, { value: "새 핵심가치" });
    const out = readFileSync(join(dir, "planning", "prd.md"), "utf-8");
    for (const h of ["## 개요", "## 핵심가치", "## 타겟·시나리오", "## 성공지표", "## 속성설정"]) {
      expect(out).toContain(h);
    }
    expect(out).toContain("새 핵심가치");
  });

  it("prd.md가 없으면 false(안 씀)", () => {
    const dir = makePlanning(root, "p", null);
    expect(writeDocsPlanningPrd(dir, { overview: "x" })).toBe(false);
    expect(existsSync(join(dir, "planning", "prd.md"))).toBe(false);
  });

  it("proposedBody에 줄 시작 '## '가 있으면 false(오분리 방지·원본 보호)", () => {
    // 새 본문에 `## 가짜헤더`가 섞이면 재파싱 시 6번째 섹션으로 오분리 → 후속 승인서 본문 소실.
    // self-roundtrip 검증이 이를 잡아 쓰지 않고 원본을 보호해야 한다.
    const dir = makePlanning(root, "p", PRD_MD);
    const before = readFileSync(join(dir, "planning", "prd.md"), "utf-8");
    const evil = "개요.\n\n예시:\n## 가짜헤더\n오분리 유발 줄";
    expect(writeDocsPlanningPrd(dir, { overview: evil })).toBe(false);
    // 원본 불변(안 씀)
    expect(readFileSync(join(dir, "planning", "prd.md"), "utf-8")).toBe(before);
  });

  it("정상 본문(## 없음)은 교체 후에도 정확히 5섹션으로 재파싱된다", () => {
    const dir = makePlanning(root, "p", PRD_MD);
    expect(writeDocsPlanningPrd(dir, { overview: "새 개요\n\n- 항목1\n- 항목2" })).toBe(true);
    // 리스트·여러 줄이 있어도 섹션은 5개 그대로
    const out = readFileSync(join(dir, "planning", "prd.md"), "utf-8");
    const headers = (out.match(/^## /gm) ?? []).length;
    expect(headers).toBe(5);
  });
});

describe("applyPrdSuggestions", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "prd-apply-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("승인하면 섹션을 교체 반영하고 큐에서 제거한다", () => {
    const dir = makePlanning(root, "p", PRD_MD, [sug("s1", "overview", "승인된 개요")]);
    const r = applyPrdSuggestions(dir, { approve: ["s1"], reject: [] });
    expect(r.applied).toBe(1);
    expect(r.remaining).toBe(0);
    expect(readFileSync(join(dir, "planning", "prd.md"), "utf-8")).toContain("승인된 개요");
    expect(readDocsPrdSuggestions(dir).suggestions).toHaveLength(0);
  });

  it("반려하면 원본 불변, 큐에서만 제거한다", () => {
    const dir = makePlanning(root, "p", PRD_MD, [sug("s1", "overview", "무시될 개요")]);
    const before = readFileSync(join(dir, "planning", "prd.md"), "utf-8");
    const r = applyPrdSuggestions(dir, { approve: [], reject: ["s1"] });
    expect(r.rejected).toBe(1);
    expect(r.remaining).toBe(0);
    expect(readFileSync(join(dir, "planning", "prd.md"), "utf-8")).toBe(before);
  });

  it("일괄 승인 — 서로 다른 섹션을 동시 교체한다", () => {
    const dir = makePlanning(root, "p", PRD_MD, [
      sug("s1", "overview", "새 개요"),
      sug("s2", "metrics", "새 지표"),
    ]);
    const r = applyPrdSuggestions(dir, { approve: ["s1", "s2"], reject: [] });
    expect(r.applied).toBe(2);
    const out = readFileSync(join(dir, "planning", "prd.md"), "utf-8");
    expect(out).toContain("새 개요");
    expect(out).toContain("새 지표");
  });

  it("같은 섹션 두 제안은 큐 순서 뒤가 이긴다(결정론)", () => {
    const dir = makePlanning(root, "p", PRD_MD, [
      sug("s1", "overview", "먼저"),
      sug("s2", "overview", "나중"),
    ]);
    applyPrdSuggestions(dir, { approve: ["s1", "s2"], reject: [] });
    const out = readFileSync(join(dir, "planning", "prd.md"), "utf-8");
    expect(out).toContain("나중");
    expect(out).not.toContain("먼저");
  });

  it("미실재 id는 skipped로 표면화한다(silent drop 금지)", () => {
    const dir = makePlanning(root, "p", PRD_MD, [sug("s1", "overview", "x")]);
    const r = applyPrdSuggestions(dir, { approve: ["nope"], reject: [] });
    expect(r.skipped).toContain("nope");
    expect(r.applied).toBe(0);
    expect(r.remaining).toBe(1); // s1은 안 건드림
  });
});

describe("isPrdApplyRequest", () => {
  it("approve·reject가 string[]이면 통과", () => {
    expect(isPrdApplyRequest({ approve: ["a"], reject: [] })).toBe(true);
    expect(isPrdApplyRequest({ approve: [], reject: [] })).toBe(true);
  });
  it("형태가 다르면 거부", () => {
    expect(isPrdApplyRequest(null)).toBe(false);
    expect(isPrdApplyRequest({ approve: "a", reject: [] })).toBe(false);
    expect(isPrdApplyRequest({ approve: [1], reject: [] })).toBe(false);
    expect(isPrdApplyRequest({ approve: [] })).toBe(false);
  });
});
