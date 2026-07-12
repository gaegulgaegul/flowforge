/**
 * planningWireframeFixture 단위 테스트 — 폴백 와이어 = 화면별 HTML 문서(WireDoc)
 * (flowforge-wireframe-iframe, BREAKING: 좌표 없는 요소 박스 → 자족 HTML 문서).
 *
 * 데이터 수준에서 폐기된 요소 박스가 아니라 화면별 HTML 문서임을 검증한다:
 * 각 화면이 id·title·device·html(문서 문자열)을 담고, html은 자족적(외부 호스트 참조 없음)이며
 * 화면 id가 화면목록 규약과 정합함을 확인한다.
 */
import type { WireDoc } from "@flowforge/shared";
import { PLANNING_WIREFRAME_FIXTURE } from "../planningWireframeFixture.js";
import { buildDocsPlanningWireframe2 } from "../../lib/wireDocs.js";

describe("planningWireframeFixture — 화면별 HTML 문서 폴백", () => {
  it("빌더는 승인분 원천이 없으면 픽스처 WireDoc[]를 반환한다(폴백)", () => {
    const docs = buildDocsPlanningWireframe2("/nonexistent/proj/docs");
    expect(docs).toBe(PLANNING_WIREFRAME_FIXTURE);
    expect(docs.length).toBe(5);
  });

  it("각 화면은 id·title·device·html(문서 문자열)을 담는다(좌표 없는 요소 배열 아님)", () => {
    for (const d of PLANNING_WIREFRAME_FIXTURE) {
      expect(typeof d.id).toBe("string");
      expect(typeof d.title).toBe("string");
      expect(["desktop", "mobile"]).toContain(d.device);
      expect(typeof d.html).toBe("string");
      expect(d.html.length).toBeGreaterThan(0);
      // 폐기된 요소 배열 스키마(regions/elements)는 더 이상 없다.
      expect((d as unknown as Record<string, unknown>)["regions"]).toBeUndefined();
    }
  });

  it("html은 실제 마크업이다(<html>/<body> 문서 구조)", () => {
    for (const d of PLANNING_WIREFRAME_FIXTURE) {
      expect(d.html.toLowerCase()).toContain("<body");
    }
  });

  it("html은 자족적이다 — 외부 호스트(http(s)://) 자산 참조가 없다(CSP가 외부 로드 차단)", () => {
    for (const d of PLANNING_WIREFRAME_FIXTURE) {
      // src=/href= 로 외부 http(s) 호스트를 참조하지 않는다(인라인/data URI만).
      expect(/(?:src|href)\s*=\s*["']https?:\/\//i.test(d.html)).toBe(false);
    }
  });

  it("데스크탑 화면과 모바일 화면이 섞여 있다", () => {
    const devices = PLANNING_WIREFRAME_FIXTURE.map((d) => d.device);
    expect(devices).toContain("desktop");
    expect(devices).toContain("mobile");
  });

  it("화면 id는 화면목록 규약과 공유된다(grid·skeleton·features + 모바일 grid-m·skeleton-m)", () => {
    expect(PLANNING_WIREFRAME_FIXTURE.map((d: WireDoc) => d.id)).toEqual([
      "grid",
      "skeleton",
      "features",
      "grid-m",
      "skeleton-m",
    ]);
  });
});
