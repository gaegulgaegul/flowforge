/**
 * PRD 승인 위저드 상태 순수 모듈 단위 테스트 (task 1.2 RED → GREEN).
 *
 * 검증 대상(design D-2~D-4, spec 시나리오):
 * - 결정 → 다음 미결정으로 이동(nextPendingId)
 * - 건너뛰기 = 반영 대상 제외(applyPayload에서 skip 빠짐), 큐 잔존(pendingIds는 skip을 제외하지만 결정은 유지)
 * - 탈출구 = 미결정만 채움(이미 결정된 건 불변)
 * - 요약 카운트 일치(approve/reject/skip/decided/total)
 * - stale id 폐기(reconcileCheckpoint: 큐에 없는 결정 제거)
 * - 반영 페이로드 생성(approve/reject 분리, skip·미결정·stale 제외)
 */
import type { WizardDecisionMap } from "@flowforge/shared";
import {
  setDecision,
  nextPendingId,
  pendingIds,
  allDecided,
  fillPending,
  summaryCounts,
  applyPayload,
  reconcileCheckpoint,
} from "@flowforge/shared";

const QUEUE = ["a", "b", "c", "d"] as const;

describe("prd-wizard-state — 결정 이동(cursor)", () => {
  it("빈 결정에서 첫 미결정은 큐 첫 id", () => {
    expect(nextPendingId(QUEUE, {})).toBe("a");
  });

  it("첫 건 결정 후 다음 미결정으로 이동한다", () => {
    const d = setDecision({}, "a", "approve");
    expect(nextPendingId(QUEUE, d)).toBe("b");
  });

  it("중간을 건너뛰어도 그건 결정된 것이라 다음 미결정으로 넘어간다", () => {
    let d: WizardDecisionMap = setDecision({}, "a", "approve");
    d = setDecision(d, "b", "skip");
    expect(nextPendingId(QUEUE, d)).toBe("c");
  });

  it("전부 결정되면 nextPendingId는 null, allDecided는 true", () => {
    let d: WizardDecisionMap = {};
    for (const id of QUEUE) d = setDecision(d, id, "approve");
    expect(nextPendingId(QUEUE, d)).toBeNull();
    expect(allDecided(QUEUE, d)).toBe(true);
  });

  it("빈 큐는 결정할 게 없으므로 allDecided=true", () => {
    expect(allDecided([], {})).toBe(true);
    expect(nextPendingId([], {})).toBeNull();
  });
});

describe("prd-wizard-state — 건너뛰기는 반영 제외·큐 잔존", () => {
  it("skip은 applyPayload의 approve/reject 어디에도 안 들어간다", () => {
    let d: WizardDecisionMap = setDecision({}, "a", "approve");
    d = setDecision(d, "b", "skip");
    d = setDecision(d, "c", "reject");
    const payload = applyPayload(QUEUE, d);
    expect(payload.approve).toEqual(["a"]);
    expect(payload.reject).toEqual(["c"]);
    expect(payload.approve).not.toContain("b");
    expect(payload.reject).not.toContain("b");
  });

  it("pendingIds는 결정된 id(skip 포함)를 제외한다 — skip 결정은 유지되므로 다시 미결정이 아니다", () => {
    const d = setDecision({}, "b", "skip");
    expect(pendingIds(QUEUE, d)).toEqual(["a", "c", "d"]);
  });
});

describe("prd-wizard-state — 탈출구(fillPending)", () => {
  it("미결정만 해당 결정으로 채우고 이미 결정된 건 불변", () => {
    let d: WizardDecisionMap = setDecision({}, "a", "reject");
    d = setDecision(d, "b", "skip");
    const filled = fillPending(QUEUE, d, "approve");
    expect(filled.a).toBe("reject"); // 기존 결정 보존
    expect(filled.b).toBe("skip"); // 건너뜀도 결정이라 보존
    expect(filled.c).toBe("approve"); // 미결정 → 채움
    expect(filled.d).toBe("approve");
  });

  it("탈출구 후 전부 결정되어 요약 진입 조건 만족", () => {
    const filled = fillPending(QUEUE, {}, "reject");
    expect(allDecided(QUEUE, filled)).toBe(true);
  });
});

describe("prd-wizard-state — 요약 카운트", () => {
  it("approve/reject/skip/decided/total이 큐 기준으로 일치", () => {
    let d: WizardDecisionMap = setDecision({}, "a", "approve");
    d = setDecision(d, "b", "reject");
    d = setDecision(d, "c", "skip");
    // d는 미결정
    const c = summaryCounts(QUEUE, d);
    expect(c).toEqual({ approve: 1, reject: 1, skip: 1, decided: 3, total: 4 });
  });

  it("큐 밖 stale 결정은 카운트에 새지 않는다", () => {
    const d = setDecision({ ghost: "approve" }, "a", "approve");
    const c = summaryCounts(QUEUE, d);
    expect(c.approve).toBe(1); // ghost 제외
    expect(c.total).toBe(4);
  });
});

describe("prd-wizard-state — stale id 폐기(reconcileCheckpoint)", () => {
  it("현재 큐에 없는 id의 결정을 조용히 버린다", () => {
    const saved: WizardDecisionMap = {
      a: "approve",
      b: "reject",
      gone: "approve", // 큐에서 사라진 제안
    };
    const reconciled = reconcileCheckpoint(QUEUE, saved);
    expect(reconciled.a).toBe("approve");
    expect(reconciled.b).toBe("reject");
    expect(reconciled.gone).toBeUndefined();
  });

  it("폐기 후 반영 페이로드에 stale id가 새어나가지 않는다", () => {
    const saved: WizardDecisionMap = { a: "approve", gone: "approve" };
    const reconciled = reconcileCheckpoint(QUEUE, saved);
    const payload = applyPayload(QUEUE, reconciled);
    expect(payload.approve).toEqual(["a"]);
    expect(payload.approve).not.toContain("gone");
  });

  it("모두 유효하면 그대로 유지", () => {
    const saved: WizardDecisionMap = { a: "approve", b: "skip" };
    expect(reconcileCheckpoint(QUEUE, saved)).toEqual(saved);
  });
});

describe("prd-wizard-state — 반영 페이로드 순서·분리", () => {
  it("approve/reject를 큐 순서대로 분리 수집", () => {
    let d: WizardDecisionMap = setDecision({}, "d", "approve");
    d = setDecision(d, "a", "approve");
    d = setDecision(d, "c", "reject");
    d = setDecision(d, "b", "skip");
    const payload = applyPayload(QUEUE, d);
    // 큐 순서 a,b,c,d 기준: approve=[a,d], reject=[c]
    expect(payload.approve).toEqual(["a", "d"]);
    expect(payload.reject).toEqual(["c"]);
  });

  it("전부 skip이면 반영 대상 없음", () => {
    let d: WizardDecisionMap = {};
    for (const id of QUEUE) d = setDecision(d, id, "skip");
    const payload = applyPayload(QUEUE, d);
    expect(payload.approve).toEqual([]);
    expect(payload.reject).toEqual([]);
  });
});
