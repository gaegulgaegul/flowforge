/**
 * charter 상주 docs(PRD.md)의 decision 타임라인 타입. server(파서)와 web(타임라인 뷰) 공유.
 *
 * charter PRD.md(charter-schema.md): `## decision: <ID>` 블록 + 불릿 date/capability/why/what/success/status.
 * **append 이력**(과거 안 지움)이라 flowforge 기존 PRD 5섹션(현재 진실)과 구조가 완전히 다르다 →
 * 5섹션 매핑하지 않고 decision 이력을 시간순 타임라인으로 따로 렌더한다(읽기전용 소비).
 */

/** decision 한 건(= `## decision: <ID>` 블록 1개). 없는 필드는 빈 문자열(지어내지 않음). */
export interface DocsDecision {
  /** 불변 ID = `## decision:` 뒤 값. 예: "D1". */
  readonly id: string;
  /** `- date:` (YYYY-MM-DD). 없으면 빈 문자열. */
  readonly date: string;
  /** `- capability:` = spec capability 키 또는 "(해당 없음)". */
  readonly capability: string;
  /** `- why:` 결정 이유. */
  readonly why: string;
  /** `- what:` 무엇을 하기로 했나. */
  readonly what: string;
  /** `- success:` 성공지표. */
  readonly success: string;
  /** `- status:` 원문(예: "active" / "superseded-by:D5"). */
  readonly status: string;
  /** status가 superseded-by:* 이면 true → 프론트가 흐리게 렌더. */
  readonly superseded: boolean;
  /** superseded일 때 대체 ID(예: "D5"), 아니면 null. */
  readonly supersededBy: string | null;
  /** charter docs SEED(미검증) 마킹 여부. 미마킹이면 미세팅(비파괴). */
  readonly seed?: boolean;
}

/** server가 docs/PRD.md에서 파싱해 내보내는 decision 타임라인(시간순 보존). */
export interface DecisionTimeline {
  readonly decisions: readonly DocsDecision[];
}
