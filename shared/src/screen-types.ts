/**
 * 화면(페이지) 1급 노드 타입 — features.md의 `## 화면목록` 섹션 + 상세기능 N:M 링크.
 *
 * manyfast식으로 화면(페이지)을 기획 명세의 1급 엔티티로 둔다(요구사항·기능·상세기능과 나란한 아이템).
 * 상세기능은 여러 화면에, 한 화면은 여러 상세기능을 담는 N:M 관계다(links[]가 연결 테이블).
 *
 * 화면 id 데이터원: features.md → screenRegistry(병렬 파서) → 기능명세 연결화면 칩 + 유저플로우/와이어 조인키.
 *   featureTreeBuilder(features 트리)는 건드리지 않는다(회귀 0). (IA 뷰는 flowforge-ia-removal로 제거됨.)
 */

/** 화면 1급 노드. id는 명시 영문 식별자(features.md의 `<!-- screen: <id> -->`), label은 표시 이름. */
export interface ScreenNode {
  /** 안정 식별자: features.md에 명시한 영문 id(한글 slug가 x로 죽는 버그 회피). */
  readonly id: string;
  /** 표시 이름(화면 헤더 텍스트, 한글 가능). */
  readonly label: string;
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
