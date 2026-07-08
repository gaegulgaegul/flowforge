/**
 * planningWireframeBuilder 단위 테스트 — ScreenRegistry(화면+요소) → Wireframe.
 * 순수 변환이라 파일 IO 없이 hand-built 레지스트리로 박스 shape을 검증한다(planningIaBuilder 동형).
 */
import type { ScreenRegistry } from "@flowforge/shared";
import { buildPlanningWireframeFromRegistry } from "../planningWireframeBuilder.js";

describe("planningWireframeBuilder — 화면+요소 → 와이어", () => {
  it("화면은 WireScreen, 요소는 WireBox(kind/label)로 렌더된다", () => {
    const registry: ScreenRegistry = {
      screens: [
        {
          id: "login",
          label: "로그인 화면",
          elements: [
            { kind: "field", label: "이메일" },
            { kind: "button", label: "로그인" },
          ],
        },
      ],
      links: [],
    };
    const wf = buildPlanningWireframeFromRegistry(registry);
    expect(wf.screens).toHaveLength(1);
    const login = wf.screens[0]!;
    expect(login.id).toBe("screen-login");
    expect(login.title).toBe("로그인 화면");
    expect(login.boxes.map((b) => b.kind)).toEqual(["field", "button"]);
    expect(login.boxes.map((b) => b.label)).toEqual(["이메일", "로그인"]);
  });

  it("요소의 screen이 정의된 화면이면 goto가 그 화면 id로 해석된다", () => {
    const registry: ScreenRegistry = {
      screens: [
        { id: "login", label: "로그인", elements: [{ kind: "button", label: "로그인", screen: "home" }] },
        { id: "home", label: "홈", elements: [] },
      ],
      links: [],
    };
    const wf = buildPlanningWireframeFromRegistry(registry);
    const loginBtn = wf.screens.find((s) => s.id === "screen-login")!.boxes[0]!;
    // goto = 이동 화면의 WireScreen id(screen-<slug>)로 해석(유저플로우 노드와 1:1).
    expect(loginBtn.goto).toBe("screen-home");
    expect(loginBtn.dangling).toBe(false);
  });

  it("요소의 screen이 없거나 미정의 화면이면 goto는 null이다", () => {
    const registry: ScreenRegistry = {
      screens: [
        {
          id: "login",
          label: "로그인",
          elements: [
            { kind: "field", label: "이메일" }, // screen 없음
            { kind: "button", label: "미아", screen: "ghost" }, // 미정의 화면
          ],
        },
      ],
      links: [],
    };
    const wf = buildPlanningWireframeFromRegistry(registry);
    const boxes = wf.screens[0]!.boxes;
    expect(boxes[0]!.goto).toBeNull();
    expect(boxes[1]!.goto).toBeNull();
    expect(boxes.every((b) => b.dangling === false)).toBe(true);
  });

  it("요소가 없는 화면은 박스 0(빈 프레임 — 지어내지 않음)", () => {
    const registry: ScreenRegistry = {
      screens: [
        { id: "settings", label: "설정" }, // elements undefined
        { id: "empty", label: "빈 화면", elements: [] },
      ],
      links: [],
    };
    const wf = buildPlanningWireframeFromRegistry(registry);
    expect(wf.screens).toHaveLength(2);
    expect(wf.screens[0]!.boxes).toHaveLength(0);
    expect(wf.screens[1]!.boxes).toHaveLength(0);
  });

  it("화면이 하나도 없으면 빈 screens", () => {
    const wf = buildPlanningWireframeFromRegistry({ screens: [], links: [] });
    expect(wf.screens).toEqual([]);
  });
});
