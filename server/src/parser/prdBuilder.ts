/**
 * prdBuilder — change 디렉토리(proposal.md + design.md) → manyfast 고정 5섹션 PRD.
 *
 * openspec change의 proposal/design 마크다운 섹션을 manyfast PRD 5섹션
 * (개요·핵심가치·타겟/시나리오·성공지표·속성설정)으로 파생한다(읽기전용·SSOT는 원문).
 * 매핑된 소스 헤더가 문서에 없으면 빈 섹션(empty)으로 표면화한다 — 내용을 지어내지 않는다.
 * design.md가 없는 archive change도 4xx 없이 PRD를 반환한다(design 기반 섹션만 empty).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Prd, PrdSection, PrdSectionKey } from "@flowforge/shared";
import { splitSections, sectionBody } from "./markdown.js";

/** 파일이 있으면 읽고, 없으면 빈 문자열(존재하지 않는 design.md 등을 에러 없이 흡수). */
function readIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf-8") : "";
}

/**
 * change 디렉토리 절대경로 → manyfast 고정 5섹션 PRD.
 * proposal.md / design.md를 `## 헤더` 단위로 쪼개 매핑 테이블대로 조립한다.
 * 각 섹션 body가 비면 empty:true(소스 헤더 부재) — 대체 텍스트를 생성하지 않는다.
 */
export function buildPrd(changeDir: string): Prd {
  const proposal = splitSections(readIfExists(join(changeDir, "proposal.md")));
  const design = splitSections(readIfExists(join(changeDir, "design.md")));

  /** 후보 본문들(빈 문자열 제외)을 줄바꿈 2개로 이어붙인다. 모두 비면 빈 문자열. */
  const merge = (...bodies: string[]): string =>
    bodies.filter((b) => b !== "").join("\n\n");

  const make = (key: PrdSectionKey, title: string, body: string): PrdSection => ({
    key,
    title,
    body,
    empty: body === "",
  });

  // 매핑 테이블(고정 순서: overview → value → target → metrics → attributes).
  const sections: readonly PrdSection[] = [
    make("overview", "개요", sectionBody(proposal, ["why", "what changes"])),
    make(
      "value",
      "핵심가치",
      merge(
        sectionBody(proposal, ["why"]),
        sectionBody(design, ["goals / non-goals"]),
      ),
    ),
    make(
      "target",
      "타겟·시나리오",
      sectionBody(design, ["context", "화면 구성 / ui"]),
    ),
    make(
      "metrics",
      "성공지표",
      sectionBody(design, ["risks / trade-offs", "open questions"]),
    ),
    make("attributes", "속성설정", sectionBody(proposal, ["impact"])),
  ];

  return { sections };
}
