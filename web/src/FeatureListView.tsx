/** 기획 기능명세서(FeatureTree) 계층 리스트 렌더 — 다이어그램(FeatureNode + ReactFlow) 대체.
 *
 * flowforge-artifact-restructure D1: 기능명세 데이터는 순수 계층 트리(children 중첩)라
 * 엣지가 부모-자식 계층 외 정보를 안 싣는다 → 들여쓴 아웃라인 리스트로 무손실 전환한다.
 * 밀도·세로 스캔·브라우저 Ctrl+F 검색에 유리하고 dagre 자동 레이아웃 비용이 0이다.
 *
 * 항목별 정보는 기존 FeatureNode(FeatureNode.tsx:44-96)가 렌더하던 것을 그대로 싣는다:
 *   타입 태그(요구사항/기능/상세기능) · priority/status 뱃지 · 요구사항 capability 칩 ·
 *   audit 뱃지(요구사항만) · 연관 change 뱃지 · 상세기능 연결화면 칩 · 메모.
 * 클릭 시 FeatureDetailPanel을 여는 콜백은 App이 노드 data(FeatureNodeData)를 그대로 넘긴다
 * (다이어그램의 onNodeClick과 동형 — 상세 필드는 어댑터가 이미 data에 실어줬다).
 *
 * planning 기능명세와 capability drill 기능명세 두 진입점이 같은 컴포넌트를 재사용한다. */
import type { CSSProperties } from "react";
import type { FeatureTreeNodeKind, FeaturePriority, FeatureStatus, CapabilityAuditSummary } from "@flowforge/shared";
import type { FeatureNodeData, FeatureListItemFlat } from "./featureTreeAdapter.js";

/** 타입별 시각 토큰(3단 위계: 요구사항 > 기능 > 상세기능). FeatureNode.KIND_STYLE과 정렬. */
const KIND_STYLE: Record<FeatureTreeNodeKind, { accent: string; tag: string }> = {
  requirement: { accent: "#7aa2ff", tag: "요구사항" },
  feature: { accent: "#f2b66d", tag: "기능" },
  detail: { accent: "#e6e8ec", tag: "상세기능" },
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

/** audit 상태 → 뱃지 라벨·클래스(FeatureNode.AUDIT_BADGE와 정렬). */
const AUDIT_BADGE: Record<CapabilityAuditSummary["status"], { label: string; cls: string }> = {
  clean: { label: "정합", cls: "feature-tree-audit--clean" },
  fail: { label: "불합", cls: "feature-tree-audit--fail" },
  unknown: { label: "미감사", cls: "feature-tree-audit--unknown" },
};

/** 리스트 항목 한 줄(들여쓰기 depth 반영). data는 어댑터가 파생 필드까지 실어준 노드 data 그대로. */
function FeatureListItem({
  node,
  depth,
  onSelect,
}: {
  node: FeatureNodeData;
  depth: number;
  onSelect: (data: FeatureNodeData) => void;
}): JSX.Element {
  const { label, kind, capability, priority, status, memo, audit, linkedChanges, screens } = node;
  const s = KIND_STYLE[kind] ?? KIND_STYLE.detail;
  const changeCount = linkedChanges?.length ?? 0;
  return (
    <li
      className={`feature-list-item feature-list-item--${kind}`}
      style={{ "--feature-depth": depth } as CSSProperties}
      data-testid="feature-list-item"
    >
      <button type="button" className="feature-list-row" onClick={() => onSelect(node)} title={label}>
        <span className="feature-list-tag" style={{ color: s.accent, borderColor: s.accent }}>
          {s.tag}
        </span>
        <span className="feature-list-label">{label}</span>
        {priority && (
          <span className="feature-tree-badge" style={{ borderColor: PRIORITY_COLOR[priority], color: PRIORITY_COLOR[priority] }}>
            {priority}
          </span>
        )}
        {status && (
          <span className="feature-tree-badge" style={{ borderColor: STATUS_COLOR[status], color: STATUS_COLOR[status] }}>
            {status}
          </span>
        )}
        {kind === "requirement" && audit && (
          <span
            className={`feature-tree-audit ${AUDIT_BADGE[audit.status].cls}`}
            title={`감사: 정합 ${audit.pass} / 불합 ${audit.fail} / 검증불가 ${audit.unverifiable}`}
          >
            {audit.status === "fail" ? `불합 ${audit.fail}` : AUDIT_BADGE[audit.status].label}
          </span>
        )}
        {changeCount > 0 && (
          <span className="feature-tree-change" title={`연관 change ${changeCount}개 — 클릭 후 상세 패널에서 열기`}>
            change {changeCount}
          </span>
        )}
        {kind === "requirement" && capability && (
          <span className="feature-tree-cap" title={`capability: ${capability}`}>
            {capability}
          </span>
        )}
        {kind === "detail" && screens && screens.length > 0 && (
          <span className="feature-list-screens" title="연결된 화면">
            {screens.map((sc) => (
              <span key={sc.id} className="feature-list-screen-chip">
                🖥 {sc.label}
              </span>
            ))}
          </span>
        )}
        {memo && (
          <span className="feature-tree-memo" title={`메모: ${memo}`}>
            📝 {memo}
          </span>
        )}
      </button>
    </li>
  );
}

/** FeatureTree 리스트 뷰. 어댑터가 평탄화한 (data, depth) 항목들을 받아 들여쓴 리스트를 그린다. */
export function FeatureListView({
  items,
  onSelect,
}: {
  /** 평탄화된 항목들(App이 어댑터 결과로 계산해 넘긴다 — depth 포함). */
  items: readonly FeatureListItemFlat[];
  onSelect: (data: FeatureNodeData) => void;
}): JSX.Element {
  if (items.length === 0) {
    return <div className="feature-list-empty" data-testid="feature-list-empty">표시할 기능명세 항목이 없습니다.</div>;
  }
  return (
    <ul className="feature-list" data-testid="feature-list">
      {items.map((it) => (
        <FeatureListItem key={it.id} node={it.data} depth={it.depth} onSelect={onSelect} />
      ))}
    </ul>
  );
}
