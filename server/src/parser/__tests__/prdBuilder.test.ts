/**
 * prdBuilder.buildPrd 단위 테스트 — change(proposal+design) → 고정 5섹션 PRD 매핑.
 * 실제 wowa change에 의존하지 않고, 임시 디렉토리에 자체 픽스처를 써서 검증한다.
 * 소스 헤더가 없으면 empty:true(대체 텍스트 미생성)임을 핵심으로 본다.
 */
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PrdSectionKey } from "@flowforge/shared";
import { buildPrd } from "../prdBuilder.js";

/** 임시 change 디렉토리 생성 + 선택적으로 proposal/design 파일 작성. */
function makeChangeDir(files: { proposal?: string; design?: string }): string {
  const dir = mkdtempSync(join(tmpdir(), "prd-builder-"));
  if (files.proposal !== undefined) writeFileSync(join(dir, "proposal.md"), files.proposal);
  if (files.design !== undefined) writeFileSync(join(dir, "design.md"), files.design);
  return dir;
}

const PROPOSAL_FULL = [
  "## Why",
  "현재 OCR 기록 추출이 수동이라 사용자가 매번 직접 입력한다.",
  "",
  "## What Changes",
  "- 사진 업로드 시 자동 OCR 파이프라인 추가",
  "- 추출 결과 확인 화면 제공",
  "",
  "## Impact",
  "- affected specs: extract-wod-photo-logger",
  "- affected code: server/ocr, web/upload",
].join("\n");

const DESIGN_FULL = [
  "## Context",
  "크로스핏 WOD 기록은 화이트보드 사진으로 남는다.",
  "",
  "## Goals / Non-Goals",
  "- Goal: 사진 한 장으로 기록 자동화",
  "- Non-Goal: 실시간 영상 인식",
  "",
  "## 화면 구성 / UI",
  "- 업로드 카드, 결과 미리보기, 저장 버튼",
  "",
  "## Risks / Trade-offs",
  "- OCR 정확도 편차 → 사용자 확인 단계로 완화",
  "",
  "## Open Questions",
  "- 손글씨 인식률을 어디까지 보장할 것인가?",
].join("\n");

const ORDER: readonly PrdSectionKey[] = [
  "overview",
  "value",
  "target",
  "metrics",
  "attributes",
];

describe("buildPrd", () => {
  // 케이스 A: proposal + design 모두 존재 → 5섹션 모두 채워짐, 순서·내용 검증.
  it("proposal·design이 모두 있으면 5섹션 모두 empty:false이고 매핑 소스 텍스트를 담는다", () => {
    const dir = makeChangeDir({ proposal: PROPOSAL_FULL, design: DESIGN_FULL });
    try {
      const prd = buildPrd(dir);
      expect(prd.sections.map((s) => s.key)).toEqual([...ORDER]);
      expect(prd.sections.every((s) => s.empty === false)).toBe(true);

      const by = (k: PrdSectionKey) => prd.sections.find((s) => s.key === k)!;

      // overview = proposal Why + What Changes
      expect(by("overview").body).toContain("자동 OCR 파이프라인");
      expect(by("overview").body).toContain("수동이라");
      // value = proposal Why + design Goals / Non-Goals
      expect(by("value").body).toContain("수동이라");
      expect(by("value").body).toContain("기록 자동화");
      // target = design Context + 화면 구성 / UI
      expect(by("target").body).toContain("화이트보드 사진");
      expect(by("target").body).toContain("결과 미리보기");
      // metrics = design Risks / Trade-offs + Open Questions
      expect(by("metrics").body).toContain("OCR 정확도 편차");
      expect(by("metrics").body).toContain("손글씨 인식률");
      // attributes = proposal Impact
      expect(by("attributes").body).toContain("affected specs");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // 케이스 B: design.md 없음 → overview/attributes 채워지고, target/metrics는 empty, value는 proposal Why만으로 채워짐.
  it("design.md가 없으면 design 기반 섹션은 empty이고 proposal 기반 섹션만 채워진다", () => {
    const dir = makeChangeDir({ proposal: PROPOSAL_FULL });
    try {
      const prd = buildPrd(dir);
      const by = (k: PrdSectionKey) => prd.sections.find((s) => s.key === k)!;

      expect(by("overview").empty).toBe(false);
      expect(by("attributes").empty).toBe(false);
      expect(by("target").empty).toBe(true);
      expect(by("target").body).toBe("");
      expect(by("metrics").empty).toBe(true);
      expect(by("metrics").body).toBe("");

      // value는 proposal Why만으로 채워짐(design Goals 없음 → Why 단독).
      expect(by("value").empty).toBe(false);
      expect(by("value").body).toContain("수동이라");
      expect(by("value").body).not.toContain("기록 자동화");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // 케이스 C: 특정 섹션의 소스 헤더가 아예 없으면 그 섹션만 empty:true.
  it("특정 섹션 소스 헤더가 없으면 해당 섹션만 empty:true이고 대체 텍스트를 만들지 않는다", () => {
    // proposal에 Impact 헤더 없음 → attributes 빈 섹션. design 전체 존재.
    const proposalNoImpact = ["## Why", "이유.", "", "## What Changes", "- 변경"].join("\n");
    const dir = makeChangeDir({ proposal: proposalNoImpact, design: DESIGN_FULL });
    try {
      const prd = buildPrd(dir);
      const by = (k: PrdSectionKey) => prd.sections.find((s) => s.key === k)!;

      expect(by("attributes").empty).toBe(true);
      expect(by("attributes").body).toBe("");
      // 나머지는 정상 채워짐.
      expect(by("overview").empty).toBe(false);
      expect(by("target").empty).toBe(false);
      expect(by("metrics").empty).toBe(false);
      expect(by("value").empty).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // 케이스 D: 섹션 배열 길이 정확히 5이고 key 순서가 고정(빈 change여도 동일).
  it("proposal/design이 둘 다 없어도 섹션은 정확히 5개·고정 순서로 반환되고 모두 empty", () => {
    const dir = makeChangeDir({});
    try {
      const prd = buildPrd(dir);
      expect(prd.sections).toHaveLength(5);
      expect(prd.sections.map((s) => s.key)).toEqual([...ORDER]);
      expect(prd.sections.every((s) => s.empty === true)).toBe(true);
      expect(prd.sections.every((s) => s.body === "")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
