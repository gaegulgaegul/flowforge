/**
 * capability 단위 audit 집계 타입 — docs/audit.json items[]를 capability 키로 집계한 결과.
 *
 * 카드 배지의 AuditStatus(프로젝트 전체 finalJudgment 축)와 어휘를 분리한다:
 * 이 축은 capability 단위 spec↔코드 정합이라 `warn`을 쓰지 않는다 (design D-1·D-5).
 * UNVERIFIABLE은 status를 깎지 않고 건수로만 노출한다.
 */
export type CapabilityAuditStatus = 'clean' | 'fail' | 'unknown';

/** FAIL 판정 항목의 주장·사유 (fail 상태 상세 노출 전용, D-4) */
export interface CapabilityAuditFailClaim {
  readonly claim: string;
  readonly reason: string;
}

/** 한 capability의 audit 집계 요약 */
export interface CapabilityAuditSummary {
  /** FAIL≥1 → fail / FAIL=0∧PASS≥1 → clean / 그 외 → unknown (D-1 결정론) */
  readonly status: CapabilityAuditStatus;
  readonly pass: number;
  readonly fail: number;
  readonly unverifiable: number;
  /** FAIL 항목의 claim·reason만 수집 (fail이 아니면 빈 배열) */
  readonly failClaims: readonly CapabilityAuditFailClaim[];
}
