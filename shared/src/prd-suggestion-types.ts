/**
 * PRD 제안 큐 타입 — 6단계 D3 승인/반려 편집 UI(PRD 예광탄).
 *
 * flowforge는 "읽기 거울"이라 명세 .md를 직접 안 쓴다. 대신 AI(openspec-plan 스킬/봇)가
 * PRD 갱신 제안을 `docs/planning/prd.suggestions.json`(사이드카 큐)에 섹션 단위로 쌓고,
 * flowforge UI에서 개별/일괄 승인·반려 → 승인분만 prd.md 섹션 교체 반영(반려=원본 불변).
 * SSOT 재정의: prd.md는 승인을 통해서만 바뀐다(승인=사용자 의도).
 *
 * server(큐 read/apply)와 web(승인 UI)이 공유. PrdSectionKey를 재사용해 새 어휘를 안 만든다.
 */
import type { PrdSectionKey } from './prd-types.js';

/** PRD 갱신 제안 1건 — 섹션 단위 교체(replace). 부분 diff는 예광탄 스코프 밖. */
export interface PrdSuggestion {
  /** 안정적 식별자(승인/반려 대상 지정). 스킬이 부여. flowforge는 id로만 큐를 조작. */
  readonly id: string;
  /** 대상 섹션(기존 PRD 5키 재사용). */
  readonly section: PrdSectionKey;
  /** 연산 종류. 예광탄=섹션 통째 교체만(결정론적·안전). */
  readonly op: 'replace';
  /** 그 섹션의 새 마크다운 본문. 승인 시 이걸로 교체. */
  readonly proposedBody: string;
  /** 제안 근거(선택, UI 표시용). */
  readonly rationale?: string;
}

/** PRD 제안 큐 — 사이드카 JSON 전체. */
export interface PrdSuggestionQueue {
  readonly version: 1;
  readonly suggestions: readonly PrdSuggestion[];
}

/** 승인/반려 적용 요청 body — 제안 id 목록. */
export interface PrdApplyRequest {
  /** 승인할 제안 id(섹션 교체 반영 후 큐에서 제거). */
  readonly approve: readonly string[];
  /** 반려할 제안 id(반영 없이 큐에서 제거). */
  readonly reject: readonly string[];
}

/** 승인/반려 적용 결과 — silent drop 금지, 처리 못 한 id는 skipped로 표면화. */
export interface PrdApplyResult {
  /** 교체 반영된 섹션 수. */
  readonly applied: number;
  /** 반려로 큐에서 제거된 수. */
  readonly rejected: number;
  /** 큐에 남은 제안 수. */
  readonly remaining: number;
  /** 처리 못 한 id(큐에 없는 id). */
  readonly skipped: readonly string[];
  /**
   * prd.md 파싱/쓰기 실패로 승인 반영을 못 한 경우 true(원본 보호, 큐 불변).
   * 미실재 id(skipped)와 구분 — 이건 원본 손상 신호라 라우트가 422로 변환한다.
   */
  readonly writeFailed?: boolean;
}
