/**
 * 와이어 레이아웃 승인 위저드 (planning-wireframe-generation-feedback — Parallel Group 3).
 *
 * 골격(배너·진행바+결정 점·[반려]/[건너뛰기]/[승인]·탈출구·요약·체크포인트 IO·appliedTick
 * 리셋)은 공용 셸 `ApprovalWizard`가 소유한다(게으름 위계 — features/prd/userflow와 동일).
 * 여기선 와이어-종속 조각만 주입한다: 카드 본문(제안 화면 미리보기)·요약 라벨(화면 id/제목)·
 * 체크포인트 키(`wireframe-wizard:<project>`).
 *
 * features 위저드가 "속성 diff"를 카드로 그리는 것과 달리, 와이어 제안은 화면 전체 레이아웃
 * 교체라 카드 본문 = 제안 layout 1개를 `WireframeDeviceFrame`으로 미리보기한다(D7 — controls
 * 숨김 prop으로 디바이스 토글·화면 탭 크롬을 제거해 단일 프레임만 렌더). 승인/반려→apply는
 * PRD/features와 동형(승인분만 와이어 원천 반영, 반려는 큐에서만 제거).
 */
import type { WireSuggestion } from "@flowforge/shared";
import { ApprovalWizard } from "./ApprovalWizard";
import { WireframeDeviceFrame } from "./WireframeDeviceFrame";

/** localStorage 체크포인트 키. 프로젝트별로 분리(features 위저드와 동일 규약). */
function checkpointKey(project: string): string {
  return `wireframe-wizard:${project}`;
}

/** 요약/카드 라벨 — 제안 화면의 제목(없으면 화면 id). */
function screenLabelOf(sug: WireSuggestion): string {
  return sug.layout.title || sug.screenId;
}

export function WireframeApprovalWizard({
  project,
  suggestions,
  busy,
  onApply,
  appliedTick,
}: {
  project: string;
  suggestions: readonly WireSuggestion[];
  busy: boolean;
  onApply: (approve: string[], reject: string[]) => void;
  /** 반영 성공 카운터 — 증가하면 결정 맵을 리셋한다(실패 시엔 안 오름 = 결정 보존). */
  appliedTick: number;
}): JSX.Element | null {
  return (
    <ApprovalWizard<WireSuggestion>
      suggestions={suggestions}
      busy={busy}
      onApply={onApply}
      appliedTick={appliedTick}
      checkpointKey={checkpointKey(project)}
      banner="AI가 제안한 와이어 레이아웃 갱신이 있습니다. 한 건씩 검토하세요."
      cardTestId={(s) => `wireframe-suggestion-${s.id}`}
      summaryLabel={(s) => screenLabelOf(s)}
      renderCard={(sug) => (
        <>
          <h4 className="feature-approval-path">
            {screenLabelOf(sug)}
            <span className="wire-approval-screen-id"> ({sug.screenId})</span>
          </h4>
          {sug.rationale && (
            <p className="feature-approval-rationale">{sug.rationale}</p>
          )}
          <div className="wire-approval-preview" data-testid="wire-approval-preview">
            <WireframeDeviceFrame screens={[sug.layout]} hideControls />
          </div>
        </>
      )}
    />
  );
}
