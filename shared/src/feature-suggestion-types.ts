/**
 * 기능명세(features) 제안 큐 타입 — 6b 승인/반려 편집 UI(features 예광탄).
 *
 * 6a(PRD)와 같은 "읽기 거울" 원칙: flowforge는 features.md를 직접 안 쓴다. 대신 AI(openspec-plan
 * 스킬/봇)가 노드 속성(중요도·상태) 갱신 제안을 `docs/planning/features.suggestions.json`
 * (사이드카 큐)에 노드 단위로 쌓고, flowforge UI에서 개별/일괄 승인·반려 → 승인분만 features.md의
 * 해당 노드 속성 교체 반영(반려=원본 불변). SSOT 재정의: features.md는 승인을 통해서만 바뀐다.
 *
 * server(큐 read/apply)와 web(승인 UI)이 공유. FeaturePriority/FeatureStatus를 재사용해
 * 새 어휘를 안 만든다. apply body/result는 6a의 PrdApplyRequest/PrdApplyResult와 형태가 같아
 * 여기서 신설하지 않고 그대로 재사용한다.
 */
import type { FeaturePriority, FeatureStatus } from './feature-tree-types.js';

/** 기능명세 갱신 제안 1건 — 노드 속성(중요도·상태) 교체. 라벨/구조 변경은 예광탄 스코프 밖. */
export interface FeatureSuggestion {
  /** 안정적 식별자(승인/반려 대상 지정). 스킬이 부여. flowforge는 id로만 큐를 조작. */
  readonly id: string;
  /**
   * 대상 노드 경로 — 헤더 원문 텍스트 경로([요구사항label, 기능label?, 상세기능label?]).
   * features.md의 트리 위계를 따라 노드를 특정한다(요구사항만 있으면 길이 1, 상세기능까지면 3).
   */
  readonly nodePath: readonly string[];
  /** 연산 종류. 예광탄=속성 교체만(결정론적·안전). */
  readonly op: 'set-attrs';
  /** 새 중요도. 생략 시 미변경. */
  readonly priority?: FeaturePriority;
  /** 새 상태. 생략 시 미변경. */
  readonly status?: FeatureStatus;
  /** 제안 근거(선택, UI 표시용). */
  readonly rationale?: string;
}

/** 기능명세 제안 큐 — 사이드카 JSON 전체. */
export interface FeatureSuggestionQueue {
  readonly version: 1;
  readonly suggestions: readonly FeatureSuggestion[];
}
