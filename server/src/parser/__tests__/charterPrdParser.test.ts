/**
 * charterPrdParser 단위 테스트 — charter PRD.md `## decision:` 블록 파싱.
 * 모든 불릿 / superseded-by·active 상태 / 문서 순서(시간순) 보존 / SEED 전파를 검증.
 */
import { parseCharterPrd } from "../charterPrdParser.js";

const DOC = [
  "# PRD",
  "> owner: @who",
  "> ⚠️ SEED — 역생성 초안.",
  "",
  "## decision: 초대코드 필수 가입",
  "- date: 2026-06-24",
  "- capability: register",
  "- why: 가족 사진 프라이버시.",
  "- what: 가입 시 초대코드 검증 필수.",
  "- success: 무단 가입 0건",
  "- status: active",
  "",
  "## decision: 옛 결정",
  "- date: 2026-04-11",
  "- capability: upload",
  "- why: 이유.",
  "- what: 무엇.",
  "- success: 지표.",
  "- status: superseded-by:D5",
].join("\n");

describe("parseCharterPrd", () => {
  it("decision 블록의 모든 불릿을 파싱한다", () => {
    const { decisions } = parseCharterPrd(DOC);
    expect(decisions).toHaveLength(2);

    const d0 = decisions[0]!;
    expect(d0.id).toBe("초대코드 필수 가입");
    expect(d0.date).toBe("2026-06-24");
    expect(d0.capability).toBe("register");
    expect(d0.why).toBe("가족 사진 프라이버시.");
    expect(d0.what).toBe("가입 시 초대코드 검증 필수.");
    expect(d0.success).toBe("무단 가입 0건");
    expect(d0.status).toBe("active");
  });

  it("active 상태는 superseded:false / supersededBy:null", () => {
    const { decisions } = parseCharterPrd(DOC);
    expect(decisions[0]!.superseded).toBe(false);
    expect(decisions[0]!.supersededBy).toBeNull();
  });

  it("superseded-by:D5 상태는 superseded:true / supersededBy:'D5'", () => {
    const { decisions } = parseCharterPrd(DOC);
    expect(decisions[1]!.status).toBe("superseded-by:D5");
    expect(decisions[1]!.superseded).toBe(true);
    expect(decisions[1]!.supersededBy).toBe("D5");
  });

  it("문서 순서(=시간 순서)를 보존한다", () => {
    const { decisions } = parseCharterPrd(DOC);
    expect(decisions.map((d) => d.id)).toEqual(["초대코드 필수 가입", "옛 결정"]);
  });

  it("문서 헤더 SEED면 각 decision의 seed=true", () => {
    const { decisions, seed } = parseCharterPrd(DOC);
    expect(seed).toBe(true);
    expect(decisions.every((d) => d.seed === true)).toBe(true);
  });

  it("SEED 마킹이 없으면 seed 미세팅(undefined)", () => {
    const noSeed = [
      "# PRD",
      "## decision: D1",
      "- date: 2026-01-01",
      "- capability: c",
      "- status: active",
    ].join("\n");
    const { decisions, seed } = parseCharterPrd(noSeed);
    expect(seed).toBe(false);
    expect(decisions[0]!.seed).toBeUndefined();
  });

  it("빠진 불릿은 빈 문자열로 둔다(지어내지 않음)", () => {
    const partial = ["# PRD", "## decision: D1", "- status: active"].join("\n");
    const { decisions } = parseCharterPrd(partial);
    expect(decisions[0]!.date).toBe("");
    expect(decisions[0]!.capability).toBe("");
    expect(decisions[0]!.why).toBe("");
  });
});
