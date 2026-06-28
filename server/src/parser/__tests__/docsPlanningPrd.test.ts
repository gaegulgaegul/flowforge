/**
 * buildDocsPlanningPrd — docs/planning/prd.md(manyfast 5섹션 MD)를 읽어 Prd로 파싱한다.
 * change PRD(proposal+design 파생)와 달리 기획 단계가 직접 쓴 5섹션 원본을 읽는다.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDocsPlanningPrd } from "../prdBuilder.js";

/** 임시 docsDir(<tmp>/docs)를 만들고 planning/prd.md를 쓴다. prd 미지정이면 파일 없음. */
function makeDocsDir(prd?: string): string {
  const root = mkdtempSync(join(tmpdir(), "planning-prd-"));
  const docsDir = join(root, "docs");
  mkdirSync(docsDir, { recursive: true });
  if (prd !== undefined) {
    mkdirSync(join(docsDir, "planning"), { recursive: true });
    writeFileSync(join(docsDir, "planning", "prd.md"), prd);
  }
  return docsDir;
}

const FULL_PRD = `> owner: @gaegul

# PRD: 테스트 제품

## 개요
한 줄 정의 고유문구ALPHA

## 핵심가치
사용자 문제 해결 고유문구BETA

## 타겟·시나리오
핵심 사용자 그룹 고유문구GAMMA

## 성공지표
KPI 목표 고유문구DELTA

## 속성설정
카테고리 고유문구EPSILON
`;

describe("buildDocsPlanningPrd", () => {
  it("planning/prd.md 5섹션을 모두 채워 Prd로 반환", () => {
    const dir = makeDocsDir(FULL_PRD);
    try {
      const prd = buildDocsPlanningPrd(dir);
      expect(prd).not.toBeNull();
      expect(prd?.sections).toHaveLength(5);
      const keys = prd?.sections.map((s) => s.key);
      expect(keys).toEqual(["overview", "value", "target", "metrics", "attributes"]);
      expect(prd?.sections.every((s) => s.empty === false)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("원본 고유 문구를 본문에 담는다 (그림자 아닌 실체)", () => {
    const dir = makeDocsDir(FULL_PRD);
    try {
      const prd = buildDocsPlanningPrd(dir);
      const overview = prd?.sections.find((s) => s.key === "overview");
      const attributes = prd?.sections.find((s) => s.key === "attributes");
      expect(overview?.body).toContain("고유문구ALPHA");
      expect(attributes?.body).toContain("고유문구EPSILON");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("planning/prd.md 없으면 null 반환", () => {
    const dir = makeDocsDir(); // 파일 없음
    try {
      expect(buildDocsPlanningPrd(dir)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("일부 섹션만 있으면 나머지는 empty:true로 표면화 (지어내지 않음)", () => {
    const partial = `# PRD\n\n## 개요\n개요만 있음\n`;
    const dir = makeDocsDir(partial);
    try {
      const prd = buildDocsPlanningPrd(dir);
      expect(prd?.sections).toHaveLength(5);
      const overview = prd?.sections.find((s) => s.key === "overview");
      const metrics = prd?.sections.find((s) => s.key === "metrics");
      expect(overview?.empty).toBe(false);
      expect(metrics?.empty).toBe(true);
      expect(metrics?.body).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
