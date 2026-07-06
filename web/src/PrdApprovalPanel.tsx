/**
 * PRD 승인/반려 편집 패널 (6a 예광탄) — manyfast 수정-승인 루프의 flowforge 측.
 *
 * 제안 큐(PrdSuggestionQueue)가 있으면 섹션별 제안 카드(현재 본문 vs 제안 본문)를 렌더하고,
 * 각 카드에 [승인]/[반려], 하단에 [모두 승인]/[모두 반려]를 둔다. 실제 반영(POST apply)·
 * 재조회는 부모(App)가 콜백으로 처리한다(이 패널은 표시 + 인터랙션만, LLM 호출 없음).
 * 큐가 비면 이 패널은 아무것도 렌더하지 않는다(순수 읽기 뷰는 PrdPanel이 담당).
 */
import type { Prd, PrdSuggestion, PrdSectionKey } from "@flowforge/shared";

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

export function PrdApprovalPanel({
  prd,
  suggestions,
  busy,
  onApprove,
  onReject,
  onApproveAll,
  onRejectAll,
}: {
  prd: Prd | null;
  suggestions: readonly PrdSuggestion[];
  busy: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onApproveAll: () => void;
  onRejectAll: () => void;
}): JSX.Element | null {
  if (suggestions.length === 0) return null;

  return (
    <div className="prd-approval" data-testid="prd-approval">
      <div className="prd-approval-banner" data-testid="prd-approval-banner">
        <span className="prd-approval-badge">제안 {suggestions.length}건</span>
        AI가 제안한 PRD 갱신이 있습니다. 개별 또는 일괄로 승인·반려하세요.
      </div>

      {/* 일괄 바 상단 이동 + 건수 표기 — features/userflow 패널과 동일 구조(신규 CSS 0). */}
      <div className="feature-approval-bulk">
        <button
          type="button"
          className="prd-btn-reject-all"
          data-testid="reject-all"
          disabled={busy}
          onClick={onRejectAll}
        >
          모두 반려 ({suggestions.length}건)
        </button>
        <button
          type="button"
          className="prd-btn-approve-all"
          data-testid="approve-all"
          disabled={busy}
          onClick={onApproveAll}
        >
          모두 승인 ({suggestions.length}건)
        </button>
      </div>

      {/* 목록은 공유 스크롤 캡 컨테이너(feature-approval-list)로 감싼다 — 카드 내부는 PRD 고유 유지. */}
      <div className="feature-approval-list" data-testid="feature-approval-list">
        {suggestions.map((sug) => (
          <section
            key={sug.id}
            className="prd-approval-card"
            data-testid={`prd-suggestion-${sug.id}`}
          >
            <h4 className="prd-approval-sec">## {titleOf(prd, sug.section)}</h4>
            {sug.rationale && <p className="prd-approval-rationale">{sug.rationale}</p>}
            <div className="prd-approval-diff">
              <div className="prd-approval-col prd-approval-cur">
                <h5>현재</h5>
                <pre>{currentBodyOf(prd, sug.section) || "(비어 있음)"}</pre>
              </div>
              <div className="prd-approval-col prd-approval-new">
                <h5>제안</h5>
                <pre>{sug.proposedBody}</pre>
              </div>
            </div>
            <div className="prd-approval-btns">
              <button
                type="button"
                className="prd-btn-approve"
                data-testid={`approve-${sug.id}`}
                disabled={busy}
                onClick={() => onApprove(sug.id)}
              >
                ✓ 승인
              </button>
              <button
                type="button"
                className="prd-btn-reject"
                data-testid={`reject-${sug.id}`}
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
