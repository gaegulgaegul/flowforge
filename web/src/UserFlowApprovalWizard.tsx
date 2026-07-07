/**
 * 유저플로우 승인 위저드 (approval-wizard-extension D-1 셸 마이그레이션).
 *
 * 골격(배너·진행바+결정 점·[반려]/[건너뛰기]/[승인]·탈출구·요약·체크포인트 IO·appliedTick
 * 리셋)은 공용 셸 `ApprovalWizard`가 소유한다. 여기선 유저플로우-종속 조각만 주입한다:
 * 카드 본문(에지 표기·신규 화면/에지케이스 뱃지·라벨·근거)·요약 라벨(from → target)·
 * 체크포인트 키(`uflow-wizard:<project>:<stem>` — D-3, project·stem별 분리).
 *
 * 마이그레이션 게이트: 유저플로우 카드 픽셀 무변(클래스·data-testid·DOM 구조 동일).
 * 카드 `<section>` 래퍼와 승인/반려 버튼은 이제 셸이 소유 — renderCard는 본문만 반환한다.
 */
import type { UserFlowSuggestion } from "@flowforge/shared";
import { ApprovalWizard } from "./ApprovalWizard";

/** 제안의 도착 노드 id — 기존 노드(to) 또는 신규 화면(newNode.id). 무효 제안 방어로 빈 표기 폴백. */
function targetIdOf(sug: UserFlowSuggestion): string {
  return sug.newNode ? sug.newNode.id : (sug.to ?? "(대상 없음)");
}

/** 에지 표기(실선/점선 + 화살촉) — Mermaid `-->`/`-.->`의 시각 대응. 스크린리더엔 종류를 텍스트로. */
function EdgeMark({ edgeKind }: { edgeKind: UserFlowSuggestion["edgeKind"] }): JSX.Element {
  const isEdgecase = edgeKind === "edgecase";
  return (
    <span
      className="uflow-edge"
      role="img"
      aria-label={isEdgecase ? "점선 에지(에지케이스 흐름)" : "실선 에지(정상 흐름)"}
    >
      <span
        className={
          isEdgecase ? "uflow-edge-line uflow-edge-line--dashed" : "uflow-edge-line"
        }
        aria-hidden="true"
      />
      <span className="uflow-edge-head" aria-hidden="true">
        ▶
      </span>
    </span>
  );
}

/** localStorage 체크포인트 키. project·stem별로 분리(D-3). */
function checkpointKey(project: string, stem: string): string {
  return `uflow-wizard:${project}:${stem}`;
}

export function UserFlowApprovalWizard({
  project,
  stem,
  suggestions,
  busy,
  onApply,
  appliedTick,
}: {
  project: string;
  stem: string;
  suggestions: readonly UserFlowSuggestion[];
  busy: boolean;
  onApply: (approve: string[], reject: string[]) => void;
  /** 반영 성공 카운터 — 증가하면 결정 맵을 리셋한다(실패 시엔 안 오름 = 결정 보존). */
  appliedTick: number;
}): JSX.Element | null {
  return (
    <ApprovalWizard<UserFlowSuggestion>
      suggestions={suggestions}
      busy={busy}
      onApply={onApply}
      appliedTick={appliedTick}
      checkpointKey={checkpointKey(project, stem)}
      banner="AI가 제안한 유저플로우 에지가 있습니다. 한 건씩 검토하세요."
      cardTestId={(s) => `uflow-suggestion-${s.id}`}
      summaryLabel={(s) => `${s.from} → ${targetIdOf(s)}`}
      renderCard={(sug) => (
        <>
          <h4 className="feature-approval-path uflow-approval-title">
            <span>{sug.from}</span>
            <EdgeMark edgeKind={sug.edgeKind} />
            <span>{targetIdOf(sug)}</span>
            {sug.edgeKind === "edgecase" && (
              <span className="uflow-badge uflow-badge--edgecase">에지케이스</span>
            )}
            {sug.newNode && <span className="uflow-badge uflow-badge--new">신규 화면</span>}
          </h4>
          {sug.newNode && (
            <p className="uflow-approval-newnode">
              신규 화면 노드: {sug.newNode.label}{" "}
              <span className="uflow-approval-nodeid">({sug.newNode.id})</span>
            </p>
          )}
          {sug.label && <p className="uflow-approval-label">에지 라벨 |{sug.label}|</p>}
          {sug.rationale && <p className="feature-approval-rationale">{sug.rationale}</p>}
        </>
      )}
    />
  );
}
