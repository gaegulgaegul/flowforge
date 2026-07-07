/** 기능명세 노드 상세 패널 — 노드 클릭 시 뜨는 상세 뷰.
 *
 * 데스크탑=우측 슬라이드 패널, 모바일(≤820px)=하단 시트(반응형 같은 컴포넌트, CSS @media로 전환).
 * 표시 필드: 종류/라벨 · 중요도/상태 뱃지 · capability(요구사항) · 연결화면(N:M, 있으면) ·
 *   WHEN/THEN(있으면 — 기획 features엔 보통 없어 생략) · 메모(있으면) · 자식 노드 목록 · 원본 위치.
 * 닫기: X 버튼 · 오버레이 클릭(모바일) · Esc.
 * 데이터는 FeatureNodeData(어댑터가 노드 data에 실어줌)만 사용 — 조인/서버 왕복 없음(예광탄 범위). */
import { useEffect } from "react";
import type { FeatureTreeNodeKind, FeaturePriority, FeatureStatus } from "@flowforge/shared";
import type { FeatureNodeData, FeatureChildRef } from "./featureTreeAdapter.js";

/** 종류별 한글 라벨/색 토큰(FeatureNode의 KIND_STYLE과 정렬). */
const KIND_META: Record<FeatureTreeNodeKind, { tag: string; accent: string }> = {
  requirement: { tag: "요구사항", accent: "#7aa2ff" },
  feature: { tag: "기능", accent: "#f2b66d" },
  detail: { tag: "상세기능", accent: "#e6e8ec" },
};

/** 중요도 → 색(FeatureNode와 동일). 빈 문자열이면 뱃지 숨김. */
const PRIORITY_COLOR: Record<FeaturePriority, string> = {
  높음: "#f2675a",
  중간: "#f2b66d",
  낮음: "#7aa2ff",
};

/** 상태 → 색(FeatureNode와 동일). 빈 문자열이면 뱃지 숨김. */
const STATUS_COLOR: Record<FeatureStatus, string> = {
  시작전: "#9aa0ad",
  진행중: "#b6e65a",
  완료: "#5ad17a",
  중단: "#f2675a",
};

const KIND_DOT: Record<FeatureTreeNodeKind, string> = {
  requirement: "#7aa2ff",
  feature: "#f2b66d",
  detail: "#e6e8ec",
};

/** audit 판정 → 라벨·색(FeatureNode의 AUDIT_BADGE와 어휘 정렬, D-5). */
const AUDIT_META: Record<"clean" | "fail" | "unknown", { label: string; color: string }> = {
  clean: { label: "정합", color: "#5ad17a" },
  fail: { label: "불합", color: "#f2675a" },
  unknown: { label: "미감사", color: "#9aa0ad" },
};

export interface FeatureDetailPanelProps {
  /** 열려있는 노드 data. null이면 닫힘(패널은 항상 마운트하되 open 클래스로 슬라이드). */
  node: FeatureNodeData | null;
  onClose: () => void;
  /** 자식/부모 노드 클릭 시 그 노드로 전환(있으면). id로 다른 노드 data를 찾아 연다. */
  onSelectById?: (id: string) => void;
  /** 연결화면 칩 클릭 시 IA 뷰의 해당 화면 노드로 딥링크(있으면). 원본 screenId로 매칭. */
  onSelectScreen?: (screenId: string) => void;
}

export function FeatureDetailPanel({ node, onClose, onSelectById, onSelectScreen }: FeatureDetailPanelProps): JSX.Element {
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
  const meta = node ? (KIND_META[node.kind] ?? KIND_META.detail) : KIND_META.detail;

  // 연결화면(N:M)은 어댑터가 파생한 정식 필드 — 링크 없는 노드는 undefined(섹션 생략). WHEN/THEN은 아직 없다 — 있을 때만 렌더(지어내지 않음).
  const screens = node?.screens;
  const when = (node as { when?: string } | null)?.when;
  const then = (node as { then?: string } | null)?.then;

  const childRefs: readonly FeatureChildRef[] = node?.childRefs ?? [];
  const path: readonly string[] = node?.path ?? [];

  return (
    <>
      {/* 모바일 하단 시트용 오버레이(데스크탑 패널에선 CSS로 숨김). 클릭 시 닫기. */}
      <div
        className={`feature-detail-overlay${open ? " open" : ""}`}
        data-testid="feature-detail-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`feature-detail-panel${open ? " open" : ""}`}
        data-testid="feature-detail-panel"
        role="dialog"
        aria-modal="false"
        aria-label="기능명세 노드 상세"
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
              <div className="feature-detail-headbadges">
                {node.priority && (
                  <span
                    className="feature-detail-badge"
                    style={{ borderColor: PRIORITY_COLOR[node.priority], color: PRIORITY_COLOR[node.priority] }}
                  >
                    중요도 {node.priority}
                  </span>
                )}
                {node.status && (
                  <span
                    className="feature-detail-badge"
                    style={{ borderColor: STATUS_COLOR[node.status], color: STATUS_COLOR[node.status] }}
                  >
                    {node.status}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="feature-detail-close"
                onClick={onClose}
                aria-label="닫기"
                data-testid="feature-detail-close"
              >
                ×
              </button>
            </header>

            <div className="feature-detail-body">
              {/* capability — 요구사항만 채워짐 */}
              {node.kind === "requirement" && node.capability && (
                <section className="feature-detail-field">
                  <div className="feature-detail-label">capability</div>
                  <code className="feature-detail-cap">{node.capability}</code>
                </section>
              )}

              {/* audit 판정(요구사항만, D-4·D-6) — 판정·건수, 불합일 때만 FAIL claim 목록.
                  claim/reason은 텍스트 렌더만(HTML 주입 금지). 감사 데이터 자체가 없으면 미감사 한 줄. */}
              {node.kind === "requirement" && node.audit && (
                <section className="feature-detail-field" data-testid="feature-detail-audit">
                  <div className="feature-detail-label">audit 판정</div>
                  <div className="feature-detail-audit-head">
                    <span
                      className="feature-detail-badge"
                      style={{
                        borderColor: AUDIT_META[node.audit.status].color,
                        color: AUDIT_META[node.audit.status].color,
                      }}
                    >
                      {AUDIT_META[node.audit.status].label}
                    </span>
                    {node.audit.pass + node.audit.fail + node.audit.unverifiable > 0 ? (
                      <span className="feature-detail-audit-counts">
                        정합 {node.audit.pass} · 불합 {node.audit.fail} · 검증불가 {node.audit.unverifiable}
                      </span>
                    ) : (
                      <span className="feature-detail-audit-counts">감사 데이터 없음</span>
                    )}
                  </div>
                  {node.audit.status === "fail" && node.audit.failClaims.length > 0 && (
                    <ul className="feature-detail-audit-fails">
                      {node.audit.failClaims.map((f, i) => (
                        <li key={`${f.claim}#${i}`} className="feature-detail-audit-fail">
                          <span className="feature-detail-audit-claim">{f.claim}</span>
                          {f.reason && <span className="feature-detail-audit-reason">{f.reason}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {/* 연결된 화면(N:M) — data에 있을 때만(현재 예광탄엔 없음 → 생략) */}
              {screens && screens.length > 0 && (
                <section className="feature-detail-field">
                  <div className="feature-detail-label">🖥️ 연결된 화면 (N:M)</div>
                  <div className="feature-detail-badges">
                    {screens.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="feature-detail-screen"
                        onClick={() => onSelectScreen?.(s.id)}
                        disabled={!onSelectScreen}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* WHEN / THEN — features.md엔 보통 없음. 있을 때만 렌더(지어내지 않음). */}
              {(when || then) && (
                <section className="feature-detail-field">
                  <div className="feature-detail-label">⚡ 시나리오 (WHEN / THEN)</div>
                  <div className="feature-detail-whenthen">
                    {when && (
                      <div className="feature-detail-wt-row">
                        <span className="feature-detail-wt-tag when">WHEN</span>
                        <span className="feature-detail-wt-text">{when}</span>
                      </div>
                    )}
                    {then && (
                      <div className="feature-detail-wt-row">
                        <span className="feature-detail-wt-tag then">THEN</span>
                        <span className="feature-detail-wt-text">{then}</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* 메모(📝) — 있을 때만 */}
              {node.memo && (
                <section className="feature-detail-field">
                  <div className="feature-detail-label">메모</div>
                  <div className="feature-detail-memo">
                    <span className="feature-detail-memo-icon" aria-hidden="true">
                      📝
                    </span>
                    <span>{node.memo}</span>
                  </div>
                </section>
              )}

              {/* 자식 노드 목록 */}
              <section className="feature-detail-field">
                <div className="feature-detail-label">자식 노드</div>
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
                  <div className="feature-detail-empty">하위 노드 없음 (최하위 상세기능)</div>
                )}
              </section>

              {/* 원본 위치(features.md 헤더 경로) */}
              {path.length > 0 && (
                <section className="feature-detail-field">
                  <div className="feature-detail-label">원본 위치 (features.md)</div>
                  <div className="feature-detail-path">
                    {path.map((seg, i) => (
                      <span key={`${seg}#${i}`}>
                        {i > 0 && <span className="feature-detail-path-sep">›</span>}
                        {seg}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
