/**
 * 정보구조도(IA) 트리 타입. server(파서)와 web(트리 렌더)이 공유.
 *
 * manyfast IA(reference_manyfast_spec): 페이지를 depth 1~3 부모-자식 트리로,
 * 노드 필드=이름+설명+연결상세기능, 2뷰(자세히/간단히).
 * openspec 매핑: change(루트) → capability(섹션) → requirement(페이지) → scenario(상세, 카운트).
 */

/** IA 노드 종류 = openspec 계층의 각 단. */
export type IANodeKind = 'change' | 'capability' | 'requirement';

/** IA 트리 노드. children으로 위계를 표현(depth = 중첩 깊이). */
export interface IANode {
  /** 안정 키: 경로 기반 slug (예: "cap-wod-api__req-weekly-query") */
  readonly id: string;
  readonly kind: IANodeKind;
  /** 표시 이름(간단히뷰는 이것만 보여줌). */
  readonly label: string;
  /** 설명(자세히뷰). requirement는 첫 시나리오 요약 등, 없으면 빈 문자열. */
  readonly detail: string;
  /** 연결된 상세기능 수 = 이 노드 하위 시나리오(받아들임 기준) 개수. 자세히뷰 배지. */
  readonly scenarioCount: number;
  readonly children: readonly IANode[];
}

/** server가 change를 파싱해 내보내는 IA 트리(루트=change 노드 1개). */
export interface IATree {
  readonly root: IANode;
}
