/**
 * PRD 승인 위저드 (approval-wizard-mode 예광탄 → approval-wizard-extension 셸 마이그레이션).
 *
 * 골격(배너·진행바+결정 점·[반려]/[건너뛰기]/[승인]·탈출구·요약·체크포인트 IO·appliedTick
 * 리셋)은 공용 셸 `ApprovalWizard`가 소유한다(D-1). 여기선 PRD-종속 조각만 주입한다:
 * 카드 본문(섹션 제목·근거·현재/제안 diff)·요약 라벨(섹션 제목)·체크포인트 키(`prd-wizard:<project>`).
 *
 * 마이그레이션 게이트: PRD 동작·픽셀 무변(클래스·data-testid·DOM 구조 동일).
 */
import type { Prd, PrdSuggestion, PrdSectionKey } from "@flowforge/shared";
import { ApprovalWizard } from "./ApprovalWizard";

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

/** localStorage 체크포인트 키. 프로젝트별로 분리(D-3 — 기존 규약 유지, 체크포인트 보존). */
function checkpointKey(project: string): string {
  return `prd-wizard:${project}`;
}

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
  return (
    <ApprovalWizard<PrdSuggestion>
      suggestions={suggestions}
      busy={busy}
      onApply={onApply}
      appliedTick={appliedTick}
      checkpointKey={checkpointKey(project)}
      banner="AI가 제안한 PRD 갱신이 있습니다. 한 건씩 검토하세요."
      cardTestId={(s) => `prd-suggestion-${s.id}`}
      summaryLabel={(s) => titleOf(prd, s.section)}
      renderCard={(current) => (
        <>
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
        </>
      )}
    />
  );
}
