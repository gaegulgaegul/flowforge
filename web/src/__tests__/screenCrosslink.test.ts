/** 화면 id 조인 헬퍼 단위 테스트 — flowforge-screen-crosslink Group B.
 * 순수 함수(파일 IO·React 의존 0)라 node 환경에서 그대로 검증한다. */
import { describe, it, expect } from "vitest";
import type { ScreenRegistry, WireDoc } from "@flowforge/shared";
import {
  buildScreenToDetailLabels,
  detailLabelsForScreen,
  buildWireById,
  wireForScreen,
} from "../screenCrosslink.js";

const REGISTRY: ScreenRegistry = {
  screens: [
    { id: "home", label: "홈 화면" },
    { id: "settings", label: "설정 화면" },
  ],
  links: [
    { detailLabel: "알림 설정", screenIds: ["home", "settings"] },
    { detailLabel: "프로필 편집", screenIds: ["settings"] },
  ],
};

function wire(id: string, device: "desktop" | "mobile" = "desktop"): WireDoc {
  return {
    id,
    device,
    title: id,
    html: `<!doctype html><title>${id}</title>`,
  };
}

describe("buildScreenToDetailLabels (B.1 화면→상세기능 역인덱스)", () => {
  it("정상 N:M — 각 화면 id에 그 화면을 가진 상세기능 라벨들이 붙는다", () => {
    const idx = buildScreenToDetailLabels(REGISTRY);
    expect(idx.get("home")).toEqual(["알림 설정"]);
    // settings는 두 상세기능이 가리킴(순서 = links 순회 순서).
    expect(idx.get("settings")).toEqual(["알림 설정", "프로필 편집"]);
  });

  it("같은 화면을 여러 상세기능이 가리키면 모두 담긴다", () => {
    const idx = buildScreenToDetailLabels(REGISTRY);
    expect(idx.get("settings")).toHaveLength(2);
  });

  it("화면 id 매칭 0개(링크에 없는 화면) → detailLabelsForScreen 빈 배열", () => {
    const idx = buildScreenToDetailLabels(REGISTRY);
    expect(detailLabelsForScreen(idx, "nonexistent")).toEqual([]);
    // 화면목록엔 있으나 링크가 없는 화면도 빈 배열(크래시 없음).
    expect(detailLabelsForScreen(idx, undefined)).toEqual([]);
  });

  it("빈 링크/미제공 레지스트리 → 빈 Map", () => {
    expect(buildScreenToDetailLabels({ screens: [], links: [] }).size).toBe(0);
    expect(buildScreenToDetailLabels(null).size).toBe(0);
    expect(buildScreenToDetailLabels(undefined).size).toBe(0);
  });
});

describe("buildWireById / wireForScreen (B.2 화면→와이어 lookup)", () => {
  it("id로 조회 — 있음", () => {
    const map = buildWireById([wire("home"), wire("settings")]);
    expect(wireForScreen(map, "home")?.id).toBe("home");
    expect(wireForScreen(map, "settings")?.id).toBe("settings");
  });

  it("없음/dangling → null (숨기지 않고 빈 상태로 처리)", () => {
    const map = buildWireById([wire("home")]);
    expect(wireForScreen(map, "ghost")).toBeNull();
    expect(wireForScreen(map, undefined)).toBeNull();
  });

  it("빈/미제공 화면 배열 → 빈 Map, 모든 조회 null", () => {
    expect(buildWireById([]).size).toBe(0);
    expect(buildWireById(null).size).toBe(0);
    expect(wireForScreen(buildWireById(undefined), "home")).toBeNull();
  });

  it("같은 id가 여러 디바이스로 있으면 첫 등장(대표 1개)을 유지한다", () => {
    const map = buildWireById([wire("grid", "desktop"), wire("grid", "mobile")]);
    expect(map.size).toBe(1);
    expect(wireForScreen(map, "grid")?.device).toBe("desktop");
  });
});
