/** 화면(page) id 조인 헬퍼 — flowforge-screen-crosslink Group B.
 *
 * 유저플로우 화면 노드를 선택하면 그 바레 화면 id로 (a)연관 와이어프레임과 (b)연관 기능명세
 * 상세기능을 상호참조하려면, 다음 두 역방향 lookup이 필요하다. 둘 다 파일 IO·React 의존 0의
 * 순수 함수라 단위 테스트가 쉽다(패널은 조인 결과만 렌더 — App이 이 헬퍼로 조인 결과를 계산해 넘긴다).
 *
 * B.1 화면 id → 상세기능 라벨들: featureTreeAdapter는 정방향(상세기능→화면 목록)만 파생하므로
 *     ScreenRegistry.links를 화면 id 기준으로 역인덱싱한다.
 * B.2 화면 id → 와이어(WireScreen2): planningWireScreens를 id로 조회한다. */
import type { ScreenRegistry, WireScreen2 } from "@flowforge/shared";

/**
 * B.1: 화면 id → 그 화면을 연결화면으로 가진 상세기능 라벨들의 역인덱스.
 * ScreenRegistry.links(`{detailLabel, screenIds}[]`)의 각 링크를 순회하며
 * 각 screenId에 detailLabel을 push한다. 같은 화면을 여러 상세기능이 가리키면 모두 담긴다.
 * 링크 없음/미제공이면 빈 Map(조회 시 undefined → 호출부가 빈 상태로 처리).
 */
export function buildScreenToDetailLabels(
  registry: ScreenRegistry | null | undefined,
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const link of registry?.links ?? []) {
    for (const screenId of link.screenIds) {
      const list = index.get(screenId);
      if (list) list.push(link.detailLabel);
      else index.set(screenId, [link.detailLabel]);
    }
  }
  return index;
}

/**
 * B.1 조회 헬퍼: 화면 id로 연관 상세기능 라벨 배열을 반환(없으면 빈 배열 — dangling·매칭 0 안전).
 */
export function detailLabelsForScreen(
  index: Map<string, string[]>,
  screenId: string | undefined,
): string[] {
  if (screenId === undefined) return [];
  return index.get(screenId) ?? [];
}

/**
 * B.2: 화면 id → WireScreen2 lookup Map. 같은 id가 여러 디바이스(desktop/mobile)로 있으면
 * 마지막 것이 아니라 배열로 유지할 수도 있으나, 여기선 바레 id 정확 매칭 1개 대표만 필요하므로
 * 첫 등장(주로 desktop)을 유지한다(호출부가 프리뷰용 단일 화면을 원함).
 */
export function buildWireById(
  screens: readonly WireScreen2[] | null | undefined,
): Map<string, WireScreen2> {
  const map = new Map<string, WireScreen2>();
  for (const s of screens ?? []) {
    if (!map.has(s.id)) map.set(s.id, s);
  }
  return map;
}

/**
 * B.2 조회 헬퍼: 화면 id로 와이어를 조회(있음/없음/dangling → null).
 */
export function wireForScreen(
  map: Map<string, WireScreen2>,
  screenId: string | undefined,
): WireScreen2 | null {
  if (screenId === undefined) return null;
  return map.get(screenId) ?? null;
}
