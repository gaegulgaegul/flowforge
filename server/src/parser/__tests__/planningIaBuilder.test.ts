/**
 * planningIaBuilder 단위 테스트 — ScreenRegistry → 기획 IA 트리(IATree 재사용).
 * 순수 변환이라 파일 IO 없이 hand-built 레지스트리로 노드 shape을 검증한다.
 */
import type { ScreenRegistry } from "@flowforge/shared";
import { buildPlanningIaTreeFromRegistry } from "../planningIaBuilder.js";

const REGISTRY: ScreenRegistry = {
  screens: [
    { id: "login", label: "로그인 화면" },
    { id: "home", label: "홈 화면" },
  ],
  links: [
    { detailLabel: "이메일 로그인", screenIds: ["login"] },
    { detailLabel: "피드 조회", screenIds: ["home"] },
  ],
};

describe("planningIaBuilder — screenId 딥링크 매칭 원천", () => {
  it("화면(capability) 노드에 원본 screenId를 세팅한다", () => {
    const { root } = buildPlanningIaTreeFromRegistry(REGISTRY);
    const byLabel = Object.fromEntries(root.children.map((n) => [n.label, n]));
    // 화면 노드 id는 slug로 죽지만 screenId는 원본을 보존해야 web이 문자열 동치로 찾는다.
    expect(byLabel["로그인 화면"].screenId).toBe("login");
    expect(byLabel["홈 화면"].screenId).toBe("home");
  });

  it("상세기능(requirement) 자식 노드엔 screenId가 없다", () => {
    const { root } = buildPlanningIaTreeFromRegistry(REGISTRY);
    const loginScreen = root.children.find((n) => n.label === "로그인 화면")!;
    expect(loginScreen.children).toHaveLength(1);
    expect(loginScreen.children[0].screenId).toBeUndefined();
  });

  it("루트(change) 노드엔 screenId가 없다", () => {
    const { root } = buildPlanningIaTreeFromRegistry(REGISTRY);
    expect(root.screenId).toBeUndefined();
  });
});
