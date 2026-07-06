/**
 * PRD 승인 위저드 (approval-wizard-mode 예광탄) — 목업 모드 A의 React 번역.
 *
 * 카드 목록 대신 한 건씩 크게 보여주고(진입 즉시 1건), 결정하면 다음 미결정으로 넘어간다.
 * 진행 표시(n/N + 진행바 + 결정 점), [반려]/[건너뛰기]/[승인], 하단 탈출구
 * [남은 것 모두 승인]/[남은 것 모두 반려], 전부 결정되면 요약(카운트+결정 목록+[결정 반영하기]).
 *
 * 결정은 반영 전까지 로컬(state + localStorage 체크포인트)에만 쌓이고, 요약의
 * [결정 반영하기] 1회로 부모(App)의 기존 apply 경로(applyInChunks·청크·재조회)를 호출한다.
 * skip은 반영 대상이 아니라 큐에 남는다(다음 진입 때 재등장). 상태 로직은 프레임워크
 * 무의존 순수 모듈(@flowforge/shared prd-wizard-state)에서 계산하고 여기선 렌더·저장만 한다.
 */
import { useEffect, useMemo, useState } from "react";
import type {
  Prd,
  PrdSuggestion,
  PrdSectionKey,
  WizardDecision,
  WizardDecisionMap,
} from "@flowforge/shared";
import {
  setDecision,
  nextPendingId,
  allDecided,
  fillPending,
  summaryCounts,
  applyPayload,
  reconcileCheckpoint,
} from "@flowforge/shared";

/** PRD 5섹션 키 → 현재 본문(대비 표시용). Prd.sections에서 뽑는다. */
function currentBodyOf(prd: Prd | null, section: PrdSectionKey): string {
  const s = prd?.sections.find((x) => x.key === section);
  if (!s) return "";
  return s.empty ? "" : s.body;
}

/** 섹션 키 → 한국어 제목(Prd.sections의 title 재사용, 없으면 키). */
function titleOf(prd: Prd | null, section: PrdSectionKey): string {
  return prd?.sections.find((x) => x.key === section)?.title ?? section;
}

/** localStorage 체크포인트 키. 프로젝트별로 분리. */
function checkpointKey(project: string): string {
  return `prd-wizard:${project}`;
}

/** 저장된 결정 맵을 읽어 현재 큐와 대조(stale 폐기). 파싱 실패·부재는 빈 맵으로 폴백. */
function loadCheckpoint(project: string, ids: readonly string[]): WizardDecisionMap {
  try {
    const raw = window.localStorage.getItem(checkpointKey(project));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { decisions?: unknown };
    const decisions = parsed?.decisions;
    if (!decisions || typeof decisions !== "object") return {};
    return reconcileCheckpoint(ids, decisions as WizardDecisionMap);
  } catch {
    return {}; // 체크포인트는 편의지 데이터가 아님 — 조용히 새 세션으로
  }
}

const DECISION_LABEL: Record<WizardDecision, string> = {
  approve: "승인",
  reject: "반려",
  skip: "건너뜀",
};

export function PrdApprovalWizard({
  project,
  prd,
  suggestions,
  busy,
  onApply,
  appliedTick,
}: {
  project: string;
  prd: Prd | null;
  suggestions: readonly PrdSuggestion[];
  busy: boolean;
  onApply: (approve: string[], reject: string[]) => void;
  /** 반영 성공 카운터 — 증가하면 결정 맵을 리셋한다(실패 시엔 안 오름 = 결정 보존). */
  appliedTick: number;
}): JSX.Element | null {
  const ids = useMemo(() => suggestions.map((s) => s.id), [suggestions]);

  // 진입 시 체크포인트 복원(+stale 폐기). project/큐가 바뀌면 다시 로드.
  const [decisions, setDecisions] = useState<WizardDecisionMap>(() =>
    loadCheckpoint(project, ids),
  );
  useEffect(() => {
    setDecisions(loadCheckpoint(project, ids));
  }, [project, ids]);

  // 반영 성공 시 결정 리셋 — skip만 남은 큐가 요약에 갇히지 않고 카드로 다시 나타난다
  // (spec: "건너뛰기한 제안은 다음 위저드 진입 때 다시 나타난다"). 위 복원 effect보다
  // 뒤에 선언해 같은 커밋에서 리셋이 이긴다. 실패 경로는 tick이 안 올라 결정 보존.
  useEffect(() => {
    if (appliedTick > 0) setDecisions({});
  }, [appliedTick]);

  // 결정 변경 시 체크포인트 저장(파싱 실패·용량 초과는 조용히 무시).
  useEffect(() => {
    try {
      if (Object.keys(decisions).length === 0) {
        window.localStorage.removeItem(checkpointKey(project));
      } else {
        window.localStorage.setItem(
          checkpointKey(project),
          JSON.stringify({ ids, decisions }),
        );
      }
    } catch {
      /* 체크포인트는 편의 — 실패해도 진행 */
    }
  }, [project, ids, decisions]);

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
                  <span>{titleOf(prd, sug.section)}</span>
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
  const current =
    currentIndex >= 0 ? suggestions[currentIndex] : undefined;
  if (!current) return null; // done가 false인데 current 없음은 불가하지만 타입 가드

  const decidedCount = summaryCounts(ids, decisions).decided;
  const position = ids.indexOf(current.id) + 1;
  const pct = total === 0 ? 100 : Math.round((decidedCount / total) * 100);

  return (
    <div className="prd-approval prd-wizard" data-testid="prd-wizard">
      <div className="prd-approval-banner">
        <span className="prd-approval-badge">제안 {total}건</span>
        AI가 제안한 PRD 갱신이 있습니다. 한 건씩 검토하세요.
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
        data-testid={`prd-suggestion-${current.id}`}
      >
        <h4 className="prd-approval-sec">## {titleOf(prd, current.section)}</h4>
        {current.rationale && (
          <p className="prd-approval-rationale">{current.rationale}</p>
        )}
        <div className="prd-approval-diff">
          <div className="prd-approval-col prd-approval-cur">
            <h5>현재</h5>
            <pre>{currentBodyOf(prd, current.section) || "(비어 있음)"}</pre>
          </div>
          <div className="prd-approval-col prd-approval-new">
            <h5>제안</h5>
            <pre>{current.proposedBody}</pre>
          </div>
        </div>
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
