/**
 * 기능명세(features) 속성 승인/반려 편집 패널 (6b 예광탄) — manyfast 수정-승인 루프의 flowforge 측.
 *
 * 6a PrdApprovalPanel의 features판. 제안 큐(FeatureSuggestionQueue)가 있으면 노드별 제안 카드를 렌더한다.
 * 6a와의 유일한 구조 차이: diff가 "섹션 body 대비"가 아니라 **노드 속성(중요도·상태) before/after 대비**다.
 * 현재값은 features 트리(nodePath로 노드를 찾아)에서 뽑고, 제안값은 큐에서 뽑아 [현재 → 제안]으로 보여준다.
 * 각 카드에 [승인]/[반려], 상단(배너 직후)에 [모두 승인]/[모두 반려]를 둔다(대량 큐에서도 즉시 도달, D-5). 실제 반영(POST apply)·재조회는
 * 부모(App)가 콜백으로 처리한다(이 패널은 표시 + 인터랙션만, LLM 호출 없음).
 * 큐가 비면 이 패널은 아무것도 렌더하지 않는다(순수 읽기 트리 뷰는 App의 ReactFlow가 담당).
 */
import type {
  FeatureSuggestion,
  FeatureTreeNode,
  FeaturePriority,
  FeatureStatus,
} from "@flowforge/shared";

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

export function FeatureApprovalPanel({
  root,
  suggestions,
  busy,
  onApprove,
  onReject,
  onApproveAll,
  onRejectAll,
}: {
  /** features 트리 가상 루트(현재 속성값 조회용). 없으면 제안값만 표시. */
  root: FeatureTreeNode | null;
  suggestions: readonly FeatureSuggestion[];
  busy: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onApproveAll: () => void;
  onRejectAll: () => void;
}): JSX.Element | null {
  if (suggestions.length === 0) return null;

  return (
    <div className="feature-approval" data-testid="feature-approval">
      <div className="feature-approval-banner" data-testid="feature-approval-banner">
        <span className="feature-approval-badge">제안 {suggestions.length}건</span>
        AI가 제안한 노드 속성 변경(중요도·상태)이 있습니다. 개별 또는 일괄로 승인·반려하세요.
      </div>

      <div className="feature-approval-bulk">
        <button
          type="button"
          className="prd-btn-reject-all"
          data-testid="feature-reject-all"
          disabled={busy}
          onClick={onRejectAll}
        >
          모두 반려 ({suggestions.length}건)
        </button>
        <button
          type="button"
          className="prd-btn-approve-all"
          data-testid="feature-approve-all"
          disabled={busy}
          onClick={onApproveAll}
        >
          모두 승인 ({suggestions.length}건)
        </button>
      </div>

      <div className="feature-approval-list" data-testid="feature-approval-list">
      {suggestions.map((sug) => {
        const cur = currentAttrsOf(root, sug.nodePath);
        const next = proposedAttrsOf(sug, cur);
        return (
          <section
            key={sug.id}
            className="feature-approval-card"
            data-testid={`feature-suggestion-${sug.id}`}
          >
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
            <div className="feature-approval-btns">
              <button
                type="button"
                className="prd-btn-approve"
                data-testid={`feature-approve-${sug.id}`}
                disabled={busy}
                onClick={() => onApprove(sug.id)}
              >
                ✓ 승인
              </button>
              <button
                type="button"
                className="prd-btn-reject"
                data-testid={`feature-reject-${sug.id}`}
                disabled={busy}
                onClick={() => onReject(sug.id)}
              >
                ✕ 반려
              </button>
            </div>
          </section>
        );
      })}
      </div>
    </div>
  );
}
