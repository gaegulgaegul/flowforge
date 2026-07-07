/**
 * 기능명세(features) 승인 위저드 (approval-wizard-extension — FeatureApprovalPanel 셸 마이그레이션).
 *
 * 골격(배너·진행바+결정 점·[반려]/[건너뛰기]/[승인]·탈출구·요약·체크포인트 IO·appliedTick
 * 리셋)은 공용 셸 `ApprovalWizard`가 소유한다(D-1). 여기선 features-종속 조각만 주입한다:
 * 카드 본문(노드 경로·근거·현재/제안 속성 diff)·요약 라벨(노드 경로)·체크포인트 키
 * (`features-wizard:<project>`).
 *
 * 6a PRD와의 유일한 구조 차이: diff가 "섹션 body 대비"가 아니라 **노드 속성(중요도·상태)
 * before/after 대비**다. 현재값은 features 트리(nodePath로 노드를 찾아)에서 뽑고, 제안값은
 * 큐에서 뽑아 [현재 → 제안]으로 보여준다. 마이그레이션 게이트: 카드 픽셀 무변(클래스·
 * data-testid 동일).
 */
import type {
  FeatureSuggestion,
  FeatureTreeNode,
  FeaturePriority,
  FeatureStatus,
} from "@flowforge/shared";
import { ApprovalWizard } from "./ApprovalWizard";

/** 한 노드의 현재 속성(대비 표시용). 트리에서 nodePath로 찾은 노드의 값, 못 찾으면 미표기(''). */
interface NodeAttrs {
  readonly priority: FeaturePriority | "";
  readonly status: FeatureStatus | "";
}

/**
 * nodePath(요구사항 label / 기능 label / 상세기능 label 원문 텍스트 경로)로 트리에서 노드를 찾는다.
 * 트리 루트는 가상 루트(children=요구사항들)이므로 root.children부터 label로 내려간다.
 * 못 찾으면 null(현재값 미표기로 폴백 — 제안값만 표시).
 */
function findNodeByPath(
  root: FeatureTreeNode | null,
  nodePath: readonly string[],
): FeatureTreeNode | null {
  if (!root || nodePath.length === 0) return null;
  let level: readonly FeatureTreeNode[] = root.children;
  let found: FeatureTreeNode | null = null;
  for (const label of nodePath) {
    const next = level.find((n) => n.label === label);
    if (!next) return null;
    found = next;
    level = next.children;
  }
  return found;
}

/** 제안의 nodePath로 트리에서 현재 속성값을 조회. 노드 못 찾으면 빈 값(제안값만 대비). */
function currentAttrsOf(
  root: FeatureTreeNode | null,
  nodePath: readonly string[],
): NodeAttrs {
  const node = findNodeByPath(root, nodePath);
  if (!node) return { priority: "", status: "" };
  return { priority: node.priority, status: node.status };
}

/**
 * 제안 속성값 = 큐의 priority/status. 생략(미변경)이면 현재값을 그대로 이어받아 표시한다
 * (제안 카드에서 "무엇이 실제로 바뀌는지"만 강조되도록 — 미변경 축은 현재=제안 동일 표기).
 */
function proposedAttrsOf(sug: FeatureSuggestion, cur: NodeAttrs): NodeAttrs {
  return {
    priority: sug.priority ?? cur.priority,
    status: sug.status ?? cur.status,
  };
}

/** nodePath를 사람이 읽는 경로 문자열로(요구사항 › 기능 › 상세기능). 빈 경로면 '(경로 없음)'. */
function pathLabelOf(nodePath: readonly string[]): string {
  return nodePath.length > 0 ? nodePath.join(" › ") : "(경로 없음)";
}

/** 속성 뱃지 한 쌍(중요도·상태) 렌더. 빈 값은 '미표기'로. */
function AttrBadges({ attrs }: { attrs: NodeAttrs }): JSX.Element {
  return (
    <>
      <span className="feature-approval-attr">중요도 {attrs.priority || "미표기"}</span>
      <span className="feature-approval-attr">상태 {attrs.status || "미표기"}</span>
    </>
  );
}

/** localStorage 체크포인트 키. 프로젝트별로 분리(D-3 — `features-wizard:<project>`). */
function checkpointKey(project: string): string {
  return `features-wizard:${project}`;
}

export function FeatureApprovalWizard({
  project,
  root,
  suggestions,
  busy,
  onApply,
  appliedTick,
}: {
  project: string;
  /** features 트리 가상 루트(현재 속성값 조회용). 없으면 제안값만 표시. */
  root: FeatureTreeNode | null;
  suggestions: readonly FeatureSuggestion[];
  busy: boolean;
  onApply: (approve: string[], reject: string[]) => void;
  /** 반영 성공 카운터 — 증가하면 결정 맵을 리셋한다(실패 시엔 안 오름 = 결정 보존). */
  appliedTick: number;
}): JSX.Element | null {
  return (
    <ApprovalWizard<FeatureSuggestion>
      suggestions={suggestions}
      busy={busy}
      onApply={onApply}
      appliedTick={appliedTick}
      checkpointKey={checkpointKey(project)}
      banner="AI가 제안한 기능 명세 갱신이 있습니다. 한 건씩 검토하세요."
      cardTestId={(s) => `feature-suggestion-${s.id}`}
      summaryLabel={(s) => pathLabelOf(s.nodePath)}
      renderCard={(sug) => {
        const cur = currentAttrsOf(root, sug.nodePath);
        const next = proposedAttrsOf(sug, cur);
        return (
          <>
            <h4 className="feature-approval-path">{pathLabelOf(sug.nodePath)}</h4>
            {sug.rationale && (
              <p className="feature-approval-rationale">{sug.rationale}</p>
            )}
            <div className="feature-approval-diff">
              <div className="feature-approval-col feature-approval-cur">
                <h5>현재</h5>
                <AttrBadges attrs={cur} />
              </div>
              <span className="feature-approval-arrow" aria-hidden="true">
                →
              </span>
              <div className="feature-approval-col feature-approval-new">
                <h5>제안</h5>
                <AttrBadges attrs={next} />
              </div>
            </div>
          </>
        );
      }}
    />
  );
}
