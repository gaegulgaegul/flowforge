/**
 * markdown.splitSections 단위 테스트 — `## 헤더` 기준 본문 블록 분할.
 * headerKey는 공백·대소문자 정규화. PRD 빌더가 proposal/design 섹션을 끌어올 때 쓴다.
 */
import { splitSections, sectionBody } from "../markdown.js";

describe("splitSections", () => {
  it("## 헤더로 본문 블록을 자르고 키를 정규화한다", () => {
    const md = [
      "## Why",
      "이유 본문.",
      "둘째 줄.",
      "",
      "## What Changes",
      "- 변경 1",
      "- 변경 2",
    ].join("\n");
    const m = splitSections(md);
    expect(m.get("why")).toContain("이유 본문.");
    expect(m.get("why")).toContain("둘째 줄.");
    expect(m.get("what changes")).toContain("- 변경 1");
    expect(m.get("what changes")).toContain("- 변경 2");
  });

  it("헤더 앞 서문(preamble)은 무시한다", () => {
    const md = ["서문 텍스트", "", "## Context", "본문"].join("\n");
    const m = splitSections(md);
    expect(m.has("context")).toBe(true);
    // 서문은 어떤 ## 키에도 들어가지 않음
    expect([...m.values()].some((v) => v.includes("서문 텍스트"))).toBe(false);
  });

  it("헤더가 하나도 없으면 빈 맵", () => {
    const m = splitSections("헤더 없는 일반 텍스트\n둘째 줄");
    expect(m.size).toBe(0);
  });

  it("키 정규화: 슬래시·여분 공백을 한 칸으로 접는다", () => {
    const md = ["##   Goals  /  Non-Goals  ", "본문"].join("\n");
    const m = splitSections(md);
    expect(m.get("goals / non-goals")).toContain("본문");
  });

  it("### 등 더 깊은 헤더는 섹션을 새로 가르지 않고 본문에 포함한다", () => {
    const md = ["## Decisions", "### D1", "결정 본문", "## Impact", "영향"].join("\n");
    const m = splitSections(md);
    expect(m.get("decisions")).toContain("### D1");
    expect(m.get("decisions")).toContain("결정 본문");
    expect(m.get("impact")).toBe("영향");
  });
});

describe("sectionBody", () => {
  it("여러 헤더 후보 중 처음 매칭되는 섹션 본문을 합쳐 반환한다", () => {
    const m = new Map([
      ["why", "이유"],
      ["impact", "영향"],
    ]);
    expect(sectionBody(m, ["why", "what changes"])).toBe("이유");
  });

  it("여러 키가 매칭되면 줄바꿈 2개로 이어붙인다", () => {
    const m = new Map([
      ["why", "이유"],
      ["what changes", "변경들"],
    ]);
    expect(sectionBody(m, ["why", "what changes"])).toBe("이유\n\n변경들");
  });

  it("매칭 키가 하나도 없으면 빈 문자열", () => {
    const m = new Map([["other", "x"]]);
    expect(sectionBody(m, ["why", "impact"])).toBe("");
  });
});
