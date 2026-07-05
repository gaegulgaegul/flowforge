/**
 * 유저플로우 에지 추가 제안 큐 타입 — 6b-userflow 승인/반려 편집 UI.
 *
 * 6a(PRD)·6b(features)와 같은 "읽기 거울" 원칙: flowforge는 user-flow/<stem>.md를 직접 안 쓴다.
 * AI(스킬/봇)가 에지 추가 제안을 per-stem 사이드카 큐 `docs/planning/user-flow/<stem>.suggestions.json`
 * 에 쌓고, flowforge UI에서 개별/일괄 승인·반려 → 승인분만 결정론 검증 + self-roundtrip 방어를
 * 거쳐 첫 mermaid 블록 끝에 에지 한 줄 append(반려=원본 바이트 불변).
 *
 * server(큐 read/apply)와 web(승인 UI)이 공유. apply body/result는 6a의
 * PrdApplyRequest/PrdApplyResult와 형태가 같아 여기서 신설하지 않고 그대로 재사용한다.
 */

/**
 * 유저플로우 편집 제안 1건 — 에지 추가(append)만. 기존 줄 수정/삭제는 스코프 밖(D-1).
 *
 * 대상 지정: `to`(기존 노드 id) 또는 `newNode`(신규 화면 노드 인라인 정의) 중 **정확히 하나**.
 * 둘 다 있거나 둘 다 없으면 무효 제안으로 필터된다. 신규 노드는 to 측만 허용(D-3).
 */
export interface UserFlowSuggestion {
  /** 안정적 식별자(승인/반려 대상 지정). 스킬이 부여. flowforge는 id로만 큐를 조작. */
  readonly id: string;
  /** 연산 종류. 에지 추가만(append 한 줄, 라인 로컬 결정론). */
  readonly op: 'add-edge';
  /** 출발 노드 id — 문서에 이미 존재해야 한다(부재 시 skipped). */
  readonly from: string;
  /** 도착 노드 id(기존 노드). newNode와 배타. */
  readonly to?: string;
  /** 신규 화면 노드 — to 측 인라인 정의(`NewId["라벨"]`). to와 배타. */
  readonly newNode?: {
    readonly id: string;
    readonly label: string;
  };
  /** 에지 종류 — happy=실선 `-->`, edgecase=점선 `-.->`. */
  readonly edgeKind: 'happy' | 'edgecase';
  /** 에지 라벨(선택). `"`·`|`·개행 금지(D-4, 위반 시 skipped). */
  readonly label?: string;
  /** 제안 근거(선택, UI 표시용). */
  readonly rationale?: string;
}

/** 유저플로우 제안 큐 — per-stem 사이드카 JSON 전체. */
export interface UserFlowSuggestionQueue {
  readonly version: 1;
  readonly suggestions: readonly UserFlowSuggestion[];
}
