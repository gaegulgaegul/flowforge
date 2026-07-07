/**
 * PRD 승인 위저드 상태 — 프레임워크 무의존 순수 함수 모음.
 *
 * UI(React)와 저장(localStorage)에서 공통으로 쓰는 결정 로직을 여기 모은다.
 * 큐(제안 id 순서)와 결정 맵만 입력받아 cursor·요약·반영 페이로드·stale 폐기를
 * 결정론적으로 계산한다. DOM·시간·랜덤 등 부수효과는 없다.
 *
 * 반영(apply) 계약은 approve/reject 두 목록만 안다(shared PrdApplyRequest).
 * 위저드의 skip은 UI/상태 개념이라 반영 페이로드에서 제외된다(큐에 잔존).
 */

/** 한 제안에 대한 결정. skip은 반영 대상 아님(큐 잔존, 다음 진입 때 재등장). */
export type WizardDecision = 'approve' | 'reject' | 'skip';

/** id → 결정. 미결정 id는 키가 없다(부분 맵). */
export type WizardDecisionMap = Readonly<Record<string, WizardDecision>>;

/** localStorage 체크포인트 스냅샷. */
export interface WizardCheckpoint {
  /** 저장 시점의 큐 id 순서(stale 대조 기준). */
  readonly ids: readonly string[];
  /** 그 시점까지의 결정. */
  readonly decisions: WizardDecisionMap;
}

/** [결정 반영하기]가 기존 apply 경로로 보낼 페이로드(skip 제외). */
export interface WizardApplyPayload {
  readonly approve: readonly string[];
  readonly reject: readonly string[];
}

/** 요약 화면 카운트. decided = approve+reject+skip. */
export interface WizardSummaryCounts {
  readonly approve: number;
  readonly reject: number;
  readonly skip: number;
  readonly decided: number;
  readonly total: number;
}

/** 결정 맵에서 한 건을 갱신한 새 맵을 반환(불변). */
export function setDecision(
  decisions: WizardDecisionMap,
  id: string,
  decision: WizardDecision,
): WizardDecisionMap {
  return { ...decisions, [id]: decision };
}

/**
 * 다음으로 보여줄 미결정 제안의 id.
 * 큐 순서를 처음부터 훑어 결정 맵에 없는 첫 id를 반환. 전부 결정됐으면 null.
 * (cursor를 별도 저장하지 않고 "첫 미결정"으로 유도 — 건너뛰기가 큐에 남는 의미와 일치)
 */
export function nextPendingId(
  ids: readonly string[],
  decisions: WizardDecisionMap,
): string | null {
  for (const id of ids) {
    if (decisions[id] === undefined) return id;
  }
  return null;
}

/** 아직 결정되지 않은 제안 id들(큐 순서 유지). */
export function pendingIds(
  ids: readonly string[],
  decisions: WizardDecisionMap,
): readonly string[] {
  return ids.filter((id) => decisions[id] === undefined);
}

/** 큐 전부 결정됐는가(요약 화면 진입 조건). 빈 큐는 결정할 게 없으므로 true. */
export function allDecided(
  ids: readonly string[],
  decisions: WizardDecisionMap,
): boolean {
  return nextPendingId(ids, decisions) === null;
}

/**
 * 탈출구: 미결정 제안 전부를 한 결정으로 채운 새 맵.
 * 이미 결정된 것(건너뜀 포함)은 건드리지 않는다 — "아직 결정 안 한 것만" 채운다(D-4).
 */
export function fillPending(
  ids: readonly string[],
  decisions: WizardDecisionMap,
  decision: WizardDecision,
): WizardDecisionMap {
  const next: Record<string, WizardDecision> = { ...decisions };
  for (const id of ids) {
    if (next[id] === undefined) next[id] = decision;
  }
  return next;
}

/** 요약 카운트. 큐에 있는 id만 센다(맵에 남은 stale 결정은 무시). */
export function summaryCounts(
  ids: readonly string[],
  decisions: WizardDecisionMap,
): WizardSummaryCounts {
  let approve = 0;
  let reject = 0;
  let skip = 0;
  for (const id of ids) {
    const d = decisions[id];
    if (d === 'approve') approve += 1;
    else if (d === 'reject') reject += 1;
    else if (d === 'skip') skip += 1;
  }
  return {
    approve,
    reject,
    skip,
    decided: approve + reject + skip,
    total: ids.length,
  };
}

/**
 * 반영 페이로드: 현재 큐에 있는 id만, approve/reject로 분리. skip·미결정은 제외.
 * (큐에 없는 stale id가 apply로 새어나가지 않도록 ids로 게이트)
 */
export function applyPayload(
  ids: readonly string[],
  decisions: WizardDecisionMap,
): WizardApplyPayload {
  const approve: string[] = [];
  const reject: string[] = [];
  for (const id of ids) {
    const d = decisions[id];
    if (d === 'approve') approve.push(id);
    else if (d === 'reject') reject.push(id);
  }
  return { approve, reject };
}

/**
 * 체크포인트 대조: 현재 큐(ids)에 없는 id의 결정을 폐기한 새 맵.
 * 다른 경로로 큐가 바뀌었을 수 있으므로 재진입 시 stale 결정을 조용히 버린다(D-3).
 */
export function reconcileCheckpoint(
  ids: readonly string[],
  decisions: WizardDecisionMap,
): WizardDecisionMap {
  const live = new Set(ids);
  const next: Record<string, WizardDecision> = {};
  for (const [id, decision] of Object.entries(decisions)) {
    if (live.has(id)) next[id] = decision;
  }
  return next;
}
