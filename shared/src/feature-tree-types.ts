/**
 * 기획 기능명세서(features.md) 3단 트리 타입. server(파서)와 web(트리 렌더)이 공유.
 *
 * 기획 단계(openspec-plan) 산출물 docs/planning/features.md를 비추는 전용 타입.
 * change spec.md용 SpecTree와 의도적으로 분리한다(타입 전략 B, 2026-06-28) —
 * 기획 features는 매핑 출발점(capability 키)이고 이후 단계(역방향 인덱스·승인 UI)에서
 * 진화하므로, 안 변하는 change spec-tree와 한 타입에 묶지 않는다.
 *
 * manyfast 기능명세서: 요구사항 → 기능 → 상세기능 3단 트리. 루트는 요구사항(change 루트 없음).
 * 노드 공통 속성 2개(중요도/상태) + 요구사항에만 capability 키(기획↔change 매핑 출발점).
 */

/** 기능명세서 노드 종류 = 3단(요구사항/기능/상세기능). SpecTree의 'change' 루트는 없다. */
export type FeatureTreeNodeKind = 'requirement' | 'feature' | 'detail';

/** 노드 중요도. manyfast 원형. */
export type FeaturePriority = '낮음' | '중간' | '높음';

/** 노드 진행 상태. manyfast 원형. */
export type FeatureStatus = '시작전' | '진행중' | '완료' | '중단';

/** 기능명세서 트리 노드. children으로 위계 표현(루트=요구사항, leaf=상세기능). */
export interface FeatureTreeNode {
  /** 안정 키: 경로 기반 slug. */
  readonly id: string;
  readonly kind: FeatureTreeNodeKind;
  /** 표시 이름(요구사항/기능/상세기능 명). */
  readonly label: string;
  /**
   * capability 키(영문 kebab-case). 요구사항(requirement) 노드만 가진다 — 기획↔change
   * 매핑의 출발점(나중에 change의 specs/<키>/와 set 멤버십으로 연결). 기능/상세기능은 빈 문자열.
   */
  readonly capability: string;
  /** 노드 중요도. 표기 없으면 빈 문자열. */
  readonly priority: FeaturePriority | '';
  /** 노드 진행 상태. 표기 없으면 빈 문자열. */
  readonly status: FeatureStatus | '';
  readonly children: readonly FeatureTreeNode[];
}

/** server가 features.md를 파싱해 내보내는 기능명세서 트리(루트=가상 루트 1개, children=요구사항들). */
export interface FeatureTree {
  readonly root: FeatureTreeNode;
}
