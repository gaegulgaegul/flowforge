/**
 * 화면(페이지) 1급 노드 타입 — features.md의 `## 화면목록` 섹션 + 상세기능 N:M 링크.
 *
 * manyfast식으로 화면(페이지)을 기획 명세의 1급 엔티티로 둔다(요구사항·기능·상세기능과 나란한 아이템).
 * 상세기능은 여러 화면에, 한 화면은 여러 상세기능을 담는 N:M 관계다(links[]가 연결 테이블).
 *
 * 예광탄 범위(세로 관통 1개): features.md → screenRegistry(병렬 파서) → planningIaBuilder(IATree 재사용)
 *   → 기획 IA 뷰. featureTreeBuilder(features 트리)는 건드리지 않는다(회귀 0).
 */

/**
 * 화면 요소(버튼·입력칸 등) 한 개 — 화면 헤더 아래 `<!-- element: <kind> "<label>" -->` 주석.
 * kind는 기존 WireBoxKind 5종 재사용(새 종류 안 만듦 — WireframePanel 재사용). 선택으로 상세기능
 * 라벨(detail, 문자열 동치)·이동화면 id(screen)를 매단다. planning 와이어 박스의 원천.
 */
export interface ScreenElement {
  /** 박스 종류(WireBoxKind 5종: header|list|button|field|empty). */
  readonly kind: string;
  /** 표시 라벨(주석의 따옴표 안 텍스트, 한글 가능). */
  readonly label: string;
  /** 선택: 연결 상세기능 라벨(`-> detail:<라벨>`). N:M 링크와 같은 문자열 동치 규약. */
  readonly detail?: string;
  /** 선택: 이 요소가 이동시키는 화면 id(`-> screen:<id>`). 와이어 박스 goto의 원천. */
  readonly screen?: string;
}

/** 화면 1급 노드. id는 명시 영문 식별자(features.md의 `<!-- screen: <id> -->`), label은 표시 이름. */
export interface ScreenNode {
  /** 안정 식별자: features.md에 명시한 영문 id(한글 slug가 x로 죽는 버그 회피). */
  readonly id: string;
  /** 표시 이름(화면 헤더 텍스트, 한글 가능). */
  readonly label: string;
  /** 선택(additive): 이 화면 아래 저작된 요소들(순서 보존). 없으면 undefined(빈 프레임). */
  readonly elements?: readonly ScreenElement[];
}

/** 상세기능 ↔ 화면 N:M 링크 한 줄. detailLabel(상세기능 라벨) → 연결된 화면 id 목록. */
export interface ScreenLink {
  /** 링크 주석이 붙은 상세기능(`#### `)의 라벨. */
  readonly detailLabel: string;
  /** 이 상세기능이 나타나는 화면 id 목록(`<!-- screens: a,b -->`). */
  readonly screenIds: readonly string[];
}

/** features.md에서 병렬 파서가 뽑아낸 화면 레지스트리(화면 노드 + N:M 링크). */
export interface ScreenRegistry {
  readonly screens: readonly ScreenNode[];
  readonly links: readonly ScreenLink[];
}
