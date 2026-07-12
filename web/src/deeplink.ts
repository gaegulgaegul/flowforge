/**
 * 딥링크 URL 스킴(flowforge-deeplink-url) — change 5종 뷰를 URL로 열기 위한 순수 헬퍼.
 *
 * 스킴: `?project=<project>&change=<change>&tab=<tab>` (tab ∈ prd|spec|flow|wire).
 * 여기 두 함수는 DOM·window에 의존하지 않는 순수함수(URLSearchParams만 사용) — typecheck로 검증한다.
 * App.tsx의 pushState/마운트 복원/popstate 배선은 라이브(VERIFY)로 검증한다.
 *
 * 정합: URL 조립·파싱은 반드시 이 두 함수만 거친다(App.tsx에서 `?project=...` 인라인 조립 금지, 드리프트 방지).
 */

// change 4종 뷰 탭. 화이트리스트를 이 한 곳에만 두고 App.tsx가 소비(타입 드리프트 방지).
// IA 뷰 제거(flowforge-ia-removal) — 산출물 4종: PRD → 명세(change) → 유저플로우 → 와이어프레임.
export const TABS = ["prd", "spec", "flow", "wire"] as const;
export type Tab = (typeof TABS)[number];

// 기본 탭(필수 파라미터는 있으나 tab이 없거나 화이트리스트 밖일 때의 폴백).
const DEFAULT_TAB: Tab = "prd";

/** 문자열이 화이트리스트 4종 탭 중 하나인지 좁힘. */
function isTab(value: string | null): value is Tab {
  return value !== null && (TABS as readonly string[]).includes(value);
}

/**
 * URL 쿼리스트링을 딥링크 상태로 파싱한다.
 * - project 또는 change가 없거나 빈 값이면 null(랜딩 폴백 — 기존 grid 유지, 하위호환).
 * - tab이 화이트리스트 4종이 아니면 "prd"로 정규화(알 수 없는 tab 방어).
 * @param search `window.location.search`(선행 `?` 포함/미포함 모두 허용 — URLSearchParams가 처리).
 */
export function parseDeepLink(
  search: string,
): { project: string; change: string; tab: Tab } | null {
  const params = new URLSearchParams(search);
  const project = params.get("project");
  const change = params.get("change");
  if (!project || !change) return null;
  const rawTab = params.get("tab");
  const tab: Tab = isTab(rawTab) ? rawTab : DEFAULT_TAB;
  return { project, change, tab };
}

/**
 * 딥링크 상태를 URL 쿼리스트링으로 직렬화한다(선행 `?` 포함).
 * project·change는 `encodeURIComponent`로 인코딩(api.ts withProject 규약과 일치).
 * tab은 화이트리스트 4종이라 인코딩 불필요.
 */
export function serializeDeepLink(s: { project: string; change: string; tab: Tab }): string {
  const project = encodeURIComponent(s.project);
  const change = encodeURIComponent(s.change);
  return `?project=${project}&change=${change}&tab=${s.tab}`;
}
