/**
 * planningWireframeFixture 단위 테스트 — 목업(wireframe-mockup-deploy) → WireScreen2 픽스처.
 *
 * 폐기된 element 세로박스가 아니라 디바이스 프레임 레이아웃임을 데이터 수준에서 검증한다:
 * 데스크탑=상단/사이드/본문, 모바일=상단/본문/하단바, 본문 배치(grid/stack/tree), goto 무결성.
 */
import type { WireScreen2 } from "@flowforge/shared";
import { PLANNING_WIREFRAME_FIXTURE } from "../planningWireframeFixture.js";
import { buildDocsPlanningWireframe2 } from "../../lib/wireDocs.js";

describe("planningWireframeFixture — 디바이스 프레임 레이아웃 픽스처", () => {
  it("빌더는 승인분 원천이 없으면 픽스처 WireScreen2[]를 반환한다(폴백)", () => {
    // 승인분(WIREFRAME_FEEDBACK_ROOT 하위)이 없는 경로 → 픽스처 폴백.
    const screens = buildDocsPlanningWireframe2("/nonexistent/proj/docs");
    expect(screens).toBe(PLANNING_WIREFRAME_FIXTURE);
    expect(screens.length).toBe(5);
  });

  it("모바일 화면 요소의 goto는 모바일 화면을 가리킨다(프레임이 데스크탑으로 튀지 않음 — review M-1)", () => {
    const byId = new Map(PLANNING_WIREFRAME_FIXTURE.map((s) => [s.id, s]));
    for (const screen of PLANNING_WIREFRAME_FIXTURE) {
      if (screen.device !== "mobile") continue;
      const regions = [
        ...(screen.regions.topbar ?? []),
        ...screen.regions.body.elements,
        ...(screen.regions.bottombar ?? []),
      ];
      for (const el of regions) {
        if (!el.goto) continue;
        const target = byId.get(el.goto);
        expect(target).toBeDefined();
        expect(target?.device).toBe("mobile"); // 모바일→모바일만(디바이스 흐름 유지)
      }
    }
  });

  it("데스크탑 화면은 상단·사이드·본문 영역을 가진다(세로 목록 아님)", () => {
    const grid = PLANNING_WIREFRAME_FIXTURE.find((s) => s.id === "grid") as WireScreen2;
    expect(grid.device).toBe("desktop");
    expect(grid.regions.topbar?.length).toBeGreaterThan(0);
    expect(grid.regions.sidebar?.length).toBeGreaterThan(0);
    expect(grid.regions.body.layout).toBe("grid");
    expect(grid.regions.body.elements.some((e) => e.kind === "card")).toBe(true);
  });

  it("모바일 화면은 상단·본문·하단바를 가진다(사이드 없음)", () => {
    const mobile = PLANNING_WIREFRAME_FIXTURE.find((s) => s.id === "grid-m") as WireScreen2;
    expect(mobile.device).toBe("mobile");
    expect(mobile.regions.topbar?.length).toBeGreaterThan(0);
    expect(mobile.regions.bottombar?.length).toBeGreaterThan(0);
    expect(mobile.regions.sidebar).toBeUndefined();
  });

  it("본문 배치 힌트가 화면별로 다르다(grid/stack/tree)", () => {
    const layouts = PLANNING_WIREFRAME_FIXTURE.map((s) => s.regions.body.layout);
    expect(layouts).toEqual(["grid", "stack", "tree", "stack", "stack"]);
  });

  it("모든 goto는 정의된 화면 id를 가리킨다(끊긴 링크 없음)", () => {
    const ids = new Set(PLANNING_WIREFRAME_FIXTURE.map((s) => s.id));
    for (const screen of PLANNING_WIREFRAME_FIXTURE) {
      const regions = screen.regions;
      const all = [
        ...(regions.topbar ?? []),
        ...(regions.sidebar ?? []),
        ...(regions.bottombar ?? []),
        ...regions.body.elements,
      ];
      for (const el of all) {
        if (el.goto !== undefined) {
          expect(ids.has(el.goto)).toBe(true);
        }
      }
    }
  });

  it("화면 id는 화면목록 규약과 공유된다(grid·skeleton·features + 모바일 grid-m·skeleton-m)", () => {
    expect(PLANNING_WIREFRAME_FIXTURE.map((s) => s.id)).toEqual([
      "grid",
      "skeleton",
      "features",
      "grid-m",
      "skeleton-m",
    ]);
  });
});
