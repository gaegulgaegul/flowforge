/** 유저플로우 노드 상세 패널 — 노드 클릭 시 뜨는 상세 뷰.
 *
 * FeatureDetailPanel과 동일한 UX/CSS(.feature-detail-*)를 재사용한다:
 *   데스크탑=우측 슬라이드 / 모바일(≤820px)=하단 시트, 닫기 3경로(X·오버레이·Esc).
 * 표시 필드: 종류(시작/섹션/화면/행동)/라벨 · SEED 뱃지(있으면) ·
 *   나가는 흐름(outgoing: 이 노드 → 대상, 에지케이스면 점선 배지) ·
 *   들어오는 흐름(incoming: 다른 노드 → 이 노드).
 * 데이터는 SpecNodeData(어댑터가 그래프에서 파생해 실어줌)만 사용 — 조인/서버 왕복 없음. */
import { useEffect } from "react";
import type { NodeKind } from "@flowforge/shared";
import type { SpecNodeData, FlowEdgeRef } from "./graphAdapter.js";

/** 종류별 한글 라벨/색(SpecNode의 KIND_STYLE과 정렬). */
const KIND_META: Record<NodeKind, { tag: string; accent: string }> = {
  start: { tag: "시작", accent: "#b6e65a" },
  section: { tag: "섹션", accent: "#7aa2ff" },
  screen: { tag: "화면", accent: "#e6e8ec" },
  action: { tag: "행동", accent: "#f0a05a" },
};

export interface FlowDetailPanelProps {
  /** 열려있는 노드 data. null이면 닫힘(패널은 항상 마운트하되 open 클래스로 슬라이드). */
  node: SpecNodeData | null;
  onClose: () => void;
  /** 연결 노드 클릭 시 그 노드로 전환(있으면). id로 다른 노드 data를 찾아 연다. */
  onSelectById?: (id: string) => void;
}

/** 흐름 한 건 렌더(방향 화살표 + 상대 라벨 + 조건 문구 + 에지케이스/dangling 배지). */
function FlowRow({
  edge: r,
  dir,
  onSelectById,
}: {
  edge: FlowEdgeRef;
  dir: "in" | "out";
  onSelectById?: ((id: string) => void) | undefined;
}): JSX.Element {
  const arrow = dir === "out" ? "→" : "←";
  const clickable = onSelectById !== undefined && r.otherId !== undefined && !r.dangling;
  return (
    <button
      type="button"
      className="feature-detail-childitem"
      onClick={() => clickable && r.otherId && onSelectById?.(r.otherId)}
      disabled={!clickable}
    >
      <span className="feature-detail-child-arrow" aria-hidden="true" style={{ order: -1 }}>
        {arrow}
      </span>
      <span className="feature-detail-child-label">{r.otherLabel}</span>
      {r.edgeLabel && <span className="feature-detail-child-kind">· {r.edgeLabel}</span>}
      {r.edgecase && (
        <span className="feature-detail-badge" style={{ borderColor: "#f0a05a", color: "#f0a05a" }}>
          에지케이스
        </span>
      )}
      {r.dangling && (
        <span className="feature-detail-badge" style={{ borderColor: "#f2675a", color: "#f2675a" }}>
          ⚠ 미연결
        </span>
      )}
    </button>
  );
}

export function FlowDetailPanel({ node, onClose, onSelectById }: FlowDetailPanelProps): JSX.Element {
  // Esc로 닫기(패널이 열려있을 때만).
  useEffect(() => {
    if (!node) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [node, onClose]);

  const open = node !== null;
  const meta = node ? (KIND_META[node.kind] ?? KIND_META.screen) : KIND_META.screen;
  const outgoing: readonly FlowEdgeRef[] = node?.outgoing ?? [];
  const incoming: readonly FlowEdgeRef[] = node?.incoming ?? [];

  return (
    <>
      <div
        className={`feature-detail-overlay${open ? " open" : ""}`}
        data-testid="flow-detail-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`feature-detail-panel${open ? " open" : ""}`}
        data-testid="flow-detail-panel"
        role="dialog"
        aria-modal="false"
        aria-label="유저플로우 노드 상세"
        aria-hidden={!open}
      >
        <div className="feature-detail-handle" aria-hidden="true" />
        {node && (
          <>
            <header className="feature-detail-head">
              <span className="feature-detail-kind" style={{ color: meta.accent }}>
                {meta.tag}
              </span>
              <h2 className="feature-detail-title">{node.label}</h2>
              {node.seed && (
                <div className="feature-detail-headbadges">
                  <span
                    className="feature-detail-badge"
                    style={{ borderColor: "#f2b66d", color: "#f2b66d" }}
                    title="미검증(SEED) — 사람 검토 전"
                  >
                    🟡 SEED
                  </span>
                </div>
              )}
              <button
                type="button"
                className="feature-detail-close"
                onClick={onClose}
                aria-label="닫기"
                data-testid="flow-detail-close"
              >
                ×
              </button>
            </header>

            <div className="feature-detail-body">
              {/* 나가는 흐름(이 노드 → 대상) */}
              <section className="feature-detail-field">
                <div className="feature-detail-label">➡️ 나가는 흐름</div>
                {outgoing.length > 0 ? (
                  <div className="feature-detail-childlist">
                    {outgoing.map((r, i) => (
                      <FlowRow key={`out-${r.otherId ?? "x"}-${i}`} edge={r} dir="out" onSelectById={onSelectById} />
                    ))}
                  </div>
                ) : (
                  <div className="feature-detail-empty">나가는 전이 없음 (종료/말단 노드)</div>
                )}
              </section>

              {/* 들어오는 흐름(다른 노드 → 이 노드) */}
              <section className="feature-detail-field">
                <div className="feature-detail-label">⬅️ 들어오는 흐름</div>
                {incoming.length > 0 ? (
                  <div className="feature-detail-childlist">
                    {incoming.map((r, i) => (
                      <FlowRow key={`in-${r.otherId ?? "x"}-${i}`} edge={r} dir="in" onSelectById={onSelectById} />
                    ))}
                  </div>
                ) : (
                  <div className="feature-detail-empty">들어오는 전이 없음 (시작/진입 노드)</div>
                )}
              </section>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
