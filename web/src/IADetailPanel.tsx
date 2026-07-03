/** IA(정보구조) 노드 상세 패널 — 노드 클릭 시 뜨는 상세 뷰.
 *
 * FeatureDetailPanel과 동일한 UX/CSS(.feature-detail-*)를 재사용한다:
 *   데스크탑=우측 슬라이드 / 모바일(≤820px)=하단 시트, 닫기 3경로(X·오버레이·Esc).
 * 표시 필드: 종류(화면목록/화면/상세기능)/라벨 · 설명(detail, 있으면) ·
 *   부모 노드(있으면 클릭 이동) · 연결된 상세기능(화면이면 N:M 자식, 배지=연결 수).
 * 데이터는 IANodeData(어댑터가 트리에서 파생해 실어줌)만 사용 — 조인/서버 왕복 없음.
 *
 * 기획 IA kind 매핑(planningIaBuilder): change=화면목록(루트), capability=화면(부모),
 * requirement=상세기능(자식). change IA(specs/)도 같은 kind를 쓰므로 라벨은 중립적으로 둔다. */
import { useEffect } from "react";
import type { IANodeKind } from "@flowforge/shared";
import type { IANodeData, IAChildRef } from "./iaAdapter.js";

/** 종류별 한글 라벨/색(IANode의 KIND_STYLE과 정렬). */
const KIND_META: Record<IANodeKind, { tag: string; accent: string }> = {
  change: { tag: "화면목록", accent: "#b6e65a" },
  capability: { tag: "화면", accent: "#7aa2ff" },
  requirement: { tag: "상세기능", accent: "#e6e8ec" },
};

const KIND_DOT: Record<IANodeKind, string> = {
  change: "#b6e65a",
  capability: "#7aa2ff",
  requirement: "#e6e8ec",
};

export interface IADetailPanelProps {
  /** 열려있는 노드 data. null이면 닫힘(패널은 항상 마운트하되 open 클래스로 슬라이드). */
  node: IANodeData | null;
  onClose: () => void;
  /** 자식/부모 노드 클릭 시 그 노드로 전환(있으면). id로 다른 노드 data를 찾아 연다. */
  onSelectById?: (id: string) => void;
}

export function IADetailPanel({ node, onClose, onSelectById }: IADetailPanelProps): JSX.Element {
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
  const meta = node ? (KIND_META[node.kind] ?? KIND_META.requirement) : KIND_META.requirement;
  const childRefs: readonly IAChildRef[] = node?.childRefs ?? [];
  // 화면(capability) 노드의 자식 = N:M 연결 상세기능. 그 외(루트/상세기능)는 일반 자식 라벨.
  const isScreen = node?.kind === "capability";
  const childLabel = isScreen ? "🖥️ 연결된 상세기능 (N:M)" : "자식 노드";

  return (
    <>
      <div
        className={`feature-detail-overlay${open ? " open" : ""}`}
        data-testid="ia-detail-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`feature-detail-panel${open ? " open" : ""}`}
        data-testid="ia-detail-panel"
        role="dialog"
        aria-modal="false"
        aria-label="IA 노드 상세"
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
              {isScreen && node.scenarioCount > 0 && (
                <div className="feature-detail-headbadges">
                  <span
                    className="feature-detail-badge"
                    style={{ borderColor: meta.accent, color: meta.accent }}
                  >
                    연결 {node.scenarioCount}
                  </span>
                </div>
              )}
              <button
                type="button"
                className="feature-detail-close"
                onClick={onClose}
                aria-label="닫기"
                data-testid="ia-detail-close"
              >
                ×
              </button>
            </header>

            <div className="feature-detail-body">
              {/* 설명(detail) — 있을 때만(기획 IA엔 보통 빈 문자열 → 생략) */}
              {node.detail && (
                <section className="feature-detail-field">
                  <div className="feature-detail-label">설명</div>
                  <div className="feature-detail-memo">
                    <span>{node.detail}</span>
                  </div>
                </section>
              )}

              {/* 부모 노드 — 있을 때만(루트는 없음) */}
              {node.parentLabel && (
                <section className="feature-detail-field">
                  <div className="feature-detail-label">상위 노드</div>
                  <div className="feature-detail-childlist">
                    <button
                      type="button"
                      className="feature-detail-childitem"
                      onClick={() => node.parentId && onSelectById?.(node.parentId)}
                      disabled={!onSelectById || !node.parentId}
                    >
                      <span className="feature-detail-child-arrow" aria-hidden="true" style={{ order: -1 }}>
                        ↑
                      </span>
                      <span className="feature-detail-child-label">{node.parentLabel}</span>
                    </button>
                  </div>
                </section>
              )}

              {/* 자식 노드(화면이면 N:M 연결 상세기능) */}
              <section className="feature-detail-field">
                <div className="feature-detail-label">{childLabel}</div>
                {childRefs.length > 0 ? (
                  <div className="feature-detail-childlist">
                    {childRefs.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="feature-detail-childitem"
                        onClick={() => onSelectById?.(c.id)}
                        disabled={!onSelectById}
                      >
                        <span
                          className="feature-detail-child-dot"
                          style={{ background: KIND_DOT[c.kind] }}
                          aria-hidden="true"
                        />
                        <span className="feature-detail-child-label">{c.label}</span>
                        <span className="feature-detail-child-kind">· {KIND_META[c.kind].tag}</span>
                        <span className="feature-detail-child-arrow" aria-hidden="true">
                          ›
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="feature-detail-empty">
                    {isScreen ? "연결된 상세기능 없음" : "하위 노드 없음 (말단)"}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
