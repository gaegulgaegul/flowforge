/**
 * 승인 위저드 공용 셸 (approval-wizard-extension D-1) — 세 패널(PRD·features·userflow)이
 * 공유하는 골격. 카드 목록 대신 한 건씩 크게 보여주고, 결정하면 다음 미결정으로 넘어간다.
 *
 * 셸이 소유: 배너·진행바+결정 점·[반려]/[건너뛰기]/[승인]·하단 탈출구·요약(카운트+목록+
 * [결정 반영하기])·localStorage 체크포인트 IO·appliedTick 리셋.
 * 패널별 주입: `renderCard`(카드 본문 마크업)·`summaryLabel`(요약 목록 라벨)·`checkpointKey`
 * (키 규약 D-3)·`cardTestId`(카드 section testid)·`banner`(배너 문구).
 *
 * 결정은 반영 전까지 로컬(state + 체크포인트)에만 쌓이고, 요약의 [결정 반영하기] 1회로
 * 부모의 apply 경로를 호출한다. skip은 반영 대상이 아니라 큐에 남는다(다음 진입 때 재등장).
 * 상태 로직은 프레임워크 무의존 순수 모듈(@flowforge/shared wizard-state)에서 계산한다.
 *
 * ⚠️ className/data-testid의 `prd-` 접두어는 레거시다 — 셸은 제네릭이며 세 위저드가 같은
 * 구조 클래스를 공유한다(CSS·픽셀 불변 위해 유지). E2E에서 `prd-wizard` testid로 패널을
 * 구분하지 말 것 — 카드 testid(`cardTestId`)가 패널별 네임스페이스다. (리뷰 C-5)
 */
import { useEffect, useMemo, useState } from "react";
import type { WizardDecision, WizardDecisionMap } from "@flowforge/shared";
import {
  setDecision,
  nextPendingId,
  allDecided,
  fillPending,
  summaryCounts,
  applyPayload,
  reconcileCheckpoint,
} from "@flowforge/shared";

/** 위저드가 다룰 제안의 최소 계약 — id 문자열만 있으면 된다(상태 모듈이 id만 다룸). */
export interface WizardSuggestion {
  id: string;
}

/** 저장된 결정 맵을 읽어 현재 큐와 대조(stale 폐기). 파싱 실패·부재는 빈 맵으로 폴백. */
function loadCheckpoint(key: string, ids: readonly string[]): WizardDecisionMap {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { decisions?: unknown };
    const decisions = parsed?.decisions;
    if (!decisions || typeof decisions !== "object") return {};
    // 결정 *값*도 열거형 화이트리스트로 거른다 — 손상 체크포인트가 요약 렌더로 유입 방지(리뷰 C-4).
    const clean: Record<string, WizardDecision> = {};
    for (const [k, v] of Object.entries(decisions as Record<string, unknown>)) {
      if (v === "approve" || v === "reject" || v === "skip") clean[k] = v;
    }
    return reconcileCheckpoint(ids, clean);
  } catch {
    return {}; // 체크포인트는 편의지 데이터가 아님 — 조용히 새 세션으로
  }
}

const DECISION_LABEL: Record<WizardDecision, string> = {
  approve: "승인",
  reject: "반려",
  skip: "건너뜀",
};

export function ApprovalWizard<TSuggestion extends WizardSuggestion>({
  suggestions,
  busy,
  onApply,
  appliedTick,
  checkpointKey,
  banner,
  cardTestId,
  renderCard,
  summaryLabel,
}: {
  suggestions: readonly TSuggestion[];
  busy: boolean;
  onApply: (approve: string[], reject: string[]) => void;
  /** 반영 성공 카운터 — 증가하면 결정 맵을 리셋한다(실패 시엔 안 오름 = 결정 보존). */
  appliedTick: number;
  /** localStorage 체크포인트 키(D-3 규약 — 패널별로 다름). */
  checkpointKey: string;
  /** 배너 문구(제안 N건 뱃지는 셸이 앞에 붙임). */
  banner: string;
  /** 카드 section의 data-testid(패널별 네임스페이스 — 예: `prd-suggestion-<id>`). */
  cardTestId: (s: TSuggestion) => string;
  /** 카드 본문 마크업(제목·근거·diff 등 패널별). 셸이 section 래퍼·액션 버튼을 감싼다. */
  renderCard: (s: TSuggestion) => JSX.Element;
  /** 요약 목록의 각 행 라벨(패널별 — 예: 섹션 제목·경로). */
  summaryLabel: (s: TSuggestion) => string;
}): JSX.Element | null {
  const ids = useMemo(() => suggestions.map((s) => s.id), [suggestions]);

  // 진입 시 체크포인트 복원(+stale 폐기). key/큐가 바뀌면 다시 로드.
  const [decisions, setDecisions] = useState<WizardDecisionMap>(() =>
    loadCheckpoint(checkpointKey, ids),
  );
  useEffect(() => {
    setDecisions(loadCheckpoint(checkpointKey, ids));
  }, [checkpointKey, ids]);

  // 반영 성공 시 결정 리셋 — skip만 남은 큐가 요약에 갇히지 않고 카드로 다시 나타난다
  // (spec: "건너뛰기한 제안은 다음 위저드 진입 때 다시 나타난다"). 위 복원 effect보다
  // 뒤에 선언해 같은 커밋에서 리셋이 이긴다. 실패 경로는 tick이 안 올라 결정 보존.
  useEffect(() => {
    if (appliedTick > 0) setDecisions({});
  }, [appliedTick]);

  // 결정 변경 시 체크포인트 저장(파싱 실패·용량 초과는 조용히 무시).
  // 빈 큐인데 결정만 남은 상태도 정리 — 키가 프로젝트마다 무한 축적되는 누수 방지(리뷰 C-2).
  useEffect(() => {
    try {
      if (Object.keys(decisions).length === 0 || ids.length === 0) {
        window.localStorage.removeItem(checkpointKey);
      } else {
        window.localStorage.setItem(
          checkpointKey,
          JSON.stringify({ ids, decisions }),
        );
      }
    } catch {
      /* 체크포인트는 편의 — 실패해도 진행 */
    }
  }, [checkpointKey, ids, decisions]);

  if (suggestions.length === 0) return null;

  const decide = (id: string, decision: WizardDecision): void => {
    if (busy) return;
    setDecisions((prev) => setDecision(prev, id, decision));
  };
  const escape = (decision: WizardDecision): void => {
    if (busy) return;
    setDecisions((prev) => fillPending(ids, prev, decision));
  };
  const restart = (): void => {
    if (busy) return;
    setDecisions({});
  };
  const apply = (): void => {
    if (busy) return; // 더블클릭 이중 전송 창 차단 — 다른 세 핸들러와 대칭(리뷰 C-1)
    const { approve, reject } = applyPayload(ids, decisions);
    onApply([...approve], [...reject]);
  };

  const total = ids.length;
  const done = allDecided(ids, decisions);

  // ── 요약 화면 ──
  if (done) {
    const counts = summaryCounts(ids, decisions);
    return (
      <div className="prd-approval prd-wizard" data-testid="prd-wizard">
        <div className="prd-wizard-summary" data-testid="prd-wizard-summary">
          <div className="prd-wizard-summary-title">검토 완료</div>
          <div className="prd-wizard-summary-counts">
            <span className="c-approve">승인 {counts.approve}</span>
            <span className="sep">·</span>
            <span className="c-reject">반려 {counts.reject}</span>
            <span className="sep">·</span>
            <span className="c-skip">건너뜀 {counts.skip}</span>
          </div>
          <div className="prd-wizard-summary-list">
            {suggestions.map((sug) => {
              const d = decisions[sug.id] ?? "skip";
              return (
                <div className="prd-wizard-summary-row" key={sug.id}>
                  <span>{summaryLabel(sug)}</span>
                  <span className={`prd-wizard-tag prd-wizard-tag--${d}`}>
                    {DECISION_LABEL[d]}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="prd-wizard-summary-actions">
            <button
              type="button"
              className="prd-btn-approve-all"
              data-testid="wizard-apply"
              disabled={busy}
              onClick={apply}
            >
              결정 반영하기
            </button>
            <div className="prd-wizard-caption">
              문서 반영은 마지막에 한 번에 일어납니다
            </div>
            <button
              type="button"
              className="prd-btn-reject-all"
              data-testid="wizard-restart"
              disabled={busy}
              onClick={restart}
            >
              처음부터 다시
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── 위저드 카드 화면 ──
  const currentId = nextPendingId(ids, decisions);
  const currentIndex = currentId ? ids.indexOf(currentId) : -1;
  const current = currentIndex >= 0 ? suggestions[currentIndex] : undefined;
  if (!current) return null; // done가 false인데 current 없음은 불가하지만 타입 가드

  const decidedCount = summaryCounts(ids, decisions).decided;
  const position = ids.indexOf(current.id) + 1;
  const pct = total === 0 ? 100 : Math.round((decidedCount / total) * 100);

  return (
    <div className="prd-approval prd-wizard" data-testid="prd-wizard">
      <div className="prd-approval-banner">
        <span className="prd-approval-badge">제안 {total}건</span>
        {banner}
      </div>

      <div className="prd-wizard-progress">
        <div className="prd-wizard-prog-label">
          <span>검토 진행</span>
          <span className="prd-wizard-prog-count">
            {position} / {total}
          </span>
        </div>
        <div className="prd-wizard-bar-track">
          <div className="prd-wizard-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="prd-wizard-dots">
          {ids.map((id) => {
            const d = decisions[id];
            const mod =
              d === "approve"
                ? "approved"
                : d === "reject"
                  ? "rejected"
                  : d === "skip"
                    ? "skipped"
                    : id === current.id
                      ? "current"
                      : "pending";
            return (
              <span
                key={id}
                className={`prd-wizard-dot prd-wizard-dot--${mod}`}
              />
            );
          })}
        </div>
      </div>

      <section
        className="prd-approval-card prd-wizard-card"
        data-testid={cardTestId(current)}
      >
        {renderCard(current)}
        <div className="prd-wizard-actions">
          <button
            type="button"
            className="prd-btn-reject"
            data-testid={`reject-${current.id}`}
            disabled={busy}
            onClick={() => decide(current.id, "reject")}
          >
            ✕ 반려
          </button>
          <button
            type="button"
            className="prd-btn-skip"
            data-testid={`skip-${current.id}`}
            disabled={busy}
            onClick={() => decide(current.id, "skip")}
          >
            건너뛰기
          </button>
          <button
            type="button"
            className="prd-btn-approve"
            data-testid={`approve-${current.id}`}
            disabled={busy}
            onClick={() => decide(current.id, "approve")}
          >
            ✓ 승인
          </button>
        </div>
      </section>

      <div className="prd-wizard-escape">
        <button
          type="button"
          className="prd-wizard-escape-link"
          data-testid="escape-approve-all"
          disabled={busy}
          onClick={() => escape("approve")}
        >
          남은 것 모두 승인
        </button>
        <button
          type="button"
          className="prd-wizard-escape-link"
          data-testid="escape-reject-all"
          disabled={busy}
          onClick={() => escape("reject")}
        >
          남은 것 모두 반려
        </button>
      </div>
    </div>
  );
}
