/**
 * 기능명세서 3단 트리 타입. server(파서)와 web(트리 렌더)이 공유.
 *
 * manyfast 기능명세서(reference_manyfast_spec): 요구사항 → 기능 → 상세기능 3단 트리.
 * openspec 매핑: change(루트) → capability(요구사항) → Requirement(기능) → Scenario(상세기능).
 * IA 트리와 달리 Scenario를 count가 아니라 노드로 펼치고 WHEN/THEN을 노출한다(읽기전용).
 */

/** 기능명세서 노드 종류 = change 루트 + 3단(요구사항/기능/상세기능). */
export type SpecTreeNodeKind = 'change' | 'requirement' | 'feature' | 'detail';

/** 기능명세서 트리 노드. children으로 위계 표현(루트=change, leaf=상세기능). */
export interface SpecTreeNode {
  /** 안정 키: 경로 기반 slug. */
  readonly id: string;
  readonly kind: SpecTreeNodeKind;
  /** 표시 이름(capability명 / Requirement title / Scenario title). */
  readonly label: string;
  /** 상세기능(detail) 노드의 THEN 요약 등 부가 설명. 없으면 빈 문자열. */
  readonly detail: string;
  /** 상세기능(detail) 노드의 WHEN 문장. detail 외 노드는 빈 문자열. */
  readonly when: string;
  /** 상세기능(detail) 노드의 THEN 문장. detail 외 노드는 빈 문자열. */
  readonly then: string;
  readonly children: readonly SpecTreeNode[];
}

/** server가 change를 파싱해 내보내는 기능명세서 트리(루트=change 노드 1개). */
export interface SpecTree {
  readonly root: SpecTreeNode;
}
