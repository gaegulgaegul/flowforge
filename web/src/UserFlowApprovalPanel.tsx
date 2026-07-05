/**
 * 유저플로우 에지 추가 제안 승인/반려 편집 패널 (6b-userflow) — manyfast 수정-승인 루프의 flowforge 측.
 *
 * FeatureApprovalPanel의 유저플로우판. 제안 큐(UserFlowSuggestionQueue)가 있으면 에지별 제안 카드를 렌더한다.
 * 카드 구조: [from —▶ to] 에지 표기(happy=실선, edgecase=점선 + «에지케이스» 뱃지) + 라벨 + rationale.
 * 신규 화면 노드 제안(newNode)이면 "신규 화면" 뱃지와 노드 라벨을 함께 보여준다(D-3: to 측 인라인 정의만).
 * 각 카드에 [승인]/[반려], 상단(배너 직후)에 [모두 승인]/[모두 반려]를 둔다(대량 큐에서도 즉시 도달, D-5). 실제 반영(POST apply)·재조회는
 * 부모(App)가 콜백으로 처리한다(이 패널은 표시 + 인터랙션만, LLM 호출 없음).
 * 큐가 비면 이 패널은 아무것도 렌더하지 않는다(순수 읽기 그래프 뷰는 App의 ReactFlow가 담당).
 */
import type { UserFlowSuggestion } from "@flowforge/shared";

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

export function UserFlowApprovalPanel({
  suggestions,
  busy,
  onApprove,
  onReject,
  onApproveAll,
  onRejectAll,
}: {
  suggestions: readonly UserFlowSuggestion[];
  busy: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onApproveAll: () => void;
  onRejectAll: () => void;
}): JSX.Element | null {
  if (suggestions.length === 0) return null;

  return (
    <div className="feature-approval" data-testid="uflow-approval">
      <div className="feature-approval-banner" data-testid="uflow-approval-banner">
        <span className="feature-approval-badge">제안 {suggestions.length}건</span>
        AI가 제안한 유저플로우 에지 추가가 있습니다. 개별 또는 일괄로 승인·반려하세요.
      </div>

      <div className="feature-approval-bulk">
        <button
          type="button"
          className="prd-btn-reject-all"
          data-testid="uflow-reject-all"
          disabled={busy}
          onClick={onRejectAll}
        >
          모두 반려 ({suggestions.length}건)
        </button>
        <button
          type="button"
          className="prd-btn-approve-all"
          data-testid="uflow-approve-all"
          disabled={busy}
          onClick={onApproveAll}
        >
          모두 승인 ({suggestions.length}건)
        </button>
      </div>

      <div className="feature-approval-list" data-testid="uflow-approval-list">
      {suggestions.map((sug) => (
        <section
          key={sug.id}
          className="feature-approval-card"
          data-testid={`uflow-suggestion-${sug.id}`}
        >
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
          <div className="feature-approval-btns">
            <button
              type="button"
              className="prd-btn-approve"
              data-testid={`uflow-approve-${sug.id}`}
              disabled={busy}
              onClick={() => onApprove(sug.id)}
            >
              ✓ 승인
            </button>
            <button
              type="button"
              className="prd-btn-reject"
              data-testid={`uflow-reject-${sug.id}`}
              disabled={busy}
              onClick={() => onReject(sug.id)}
            >
              ✕ 반려
            </button>
          </div>
        </section>
      ))}
      </div>

    </div>
  );
}
