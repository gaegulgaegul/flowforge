/**
 * koreanLabels 단위 테스트 (task 2.3 RED → 3.3 GREEN).
 *
 * 표시명만 한글로 해석하고 연결/라우팅 키(영문)는 불변임을 검증한다.
 * - capability 한글명: 출처1(spec.md `## capability: 키 — 한글` 병기) → 출처2(키맵) → 영문키 폴백
 * - change 한글명: 출처3(proposal.md 사람이 쓴 한글 제목) → 영문키 폴백
 */
import {
  capabilityLabel,
  changeLabel,
  parseCapabilityLabels,
} from "../koreanLabels.js";

describe("koreanLabels — capability 표시명", () => {
  it("출처1: spec.md 병기(키 — 한글)에서 한글 라벨을 뽑는다", () => {
    const spec = "## capability: project-card-grid — 프로젝트 카드 그리드\n- 뭔가\n## capability: foo-bar — 푸바\n";
    const map = parseCapabilityLabels(spec);
    expect(map.get("project-card-grid")).toBe("프로젝트 카드 그리드");
    expect(map.get("foo-bar")).toBe("푸바");
  });

  it("출처1 우선: 병기 라벨이 있으면 키맵보다 먼저 쓴다", () => {
    const fromSpec = new Map([["project-card-grid", "스펙쪽 한글"]]);
    const keyMap = new Map([["project-card-grid", "키맵쪽 한글"]]);
    expect(capabilityLabel("project-card-grid", fromSpec, keyMap)).toBe("스펙쪽 한글");
  });

  it("출처2 폴백: 병기 없으면 키맵을 쓴다", () => {
    const fromSpec = new Map<string, string>();
    const keyMap = new Map([["spec-tree-view", "스펙 트리 뷰"]]);
    expect(capabilityLabel("spec-tree-view", fromSpec, keyMap)).toBe("스펙 트리 뷰");
  });

  it("최종 폴백: 병기·키맵 둘 다 없으면 영문키 그대로(연결 키 불변)", () => {
    expect(capabilityLabel("orphan-cap", new Map(), new Map())).toBe("orphan-cap");
  });

  it("병기 분리는 슬러그 내부 하이픈을 오분리하지 않는다(병기 없으면 맵에서 제외=폴백 신호)", () => {
    // 'project-card-grid'는 공백 둘러싼 구분자가 없어 통째로 키. 라벨이 없으므로
    // 맵에 안 들어간다(라벨 부재 = capabilityLabel이 출처2/영문키로 폴백하는 신호).
    const spec = "## capability: project-card-grid\n";
    const map = parseCapabilityLabels(spec);
    expect(map.has("project-card-grid")).toBe(false);
    // 그래서 라벨 해석은 영문키로 폴백한다(키 불변 보장).
    expect(capabilityLabel("project-card-grid", map, new Map())).toBe("project-card-grid");
  });

  it("ASCII 하이픈 병기(키 - 한글)도 허용한다", () => {
    const spec = "## capability: korean-display-labels - 한글 표시명\n";
    expect(parseCapabilityLabels(spec).get("korean-display-labels")).toBe("한글 표시명");
  });
});

describe("koreanLabels — change 표시명", () => {
  it("출처3: proposal.md의 사람이 쓴 한글 제목을 쓴다", () => {
    const proposal = "## Why\n\n어쩌고...\n";
    // 제목 출처는 호출 측이 추출해 주입; 여기선 라벨 우선순위만 검증.
    expect(changeLabel("hierarchical-project-dashboard", "계층형 프로젝트 대시보드")).toBe("계층형 프로젝트 대시보드");
  });

  it("폴백: 한글 제목이 없으면 영문 change 키 그대로", () => {
    expect(changeLabel("some-change", undefined)).toBe("some-change");
    expect(changeLabel("some-change", "")).toBe("some-change");
  });
});
