/** 기획 기능명세서(FeatureTree) 커스텀 노드 — 3타입(requirement/feature/detail), 읽기전용.
 *
 * change용 SpecTreeNode와 의도적으로 분리(타입 전략 B, 2026-06-28). 스타일은 참고했지만
 * 기획 features 전용으로 독립한다. 요구사항 노드만 capability 키 칩을 노출하고,
 * 모든 노드는 중요도(priority)/상태(status)를 뱃지로 시각화한다. */
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type {
  FeatureTreeNodeKind,
  FeaturePriority,
  FeatureStatus,
  CapabilityAuditSummary,
} from "@flowforge/shared";
import type { FeatureNodeData } from "./featureTreeAdapter.js";

/** 타입별 시각 토큰(3단 위계: 요구사항 > 기능 > 상세기능). */
const KIND_STYLE: Record<FeatureTreeNodeKind, { accent: string; bg: string; tag: string }> = {
  requirement: { accent: "#7aa2ff", bg: "#161d2a", tag: "요구사항" },
  feature: { accent: "#f2b66d", bg: "#2a2014", tag: "기능" },
  detail: { accent: "#e6e8ec", bg: "#22262e", tag: "상세기능" },
};

/** 중요도 → 색. 빈 문자열이면 미표기(뱃지 숨김). */
const PRIORITY_COLOR: Record<FeaturePriority, string> = {
  높음: "#f2675a",
  중간: "#f2b66d",
  낮음: "#7aa2ff",
};

/** 상태 → 색. 빈 문자열이면 미표기(뱃지 숨김). */
const STATUS_COLOR: Record<FeatureStatus, string> = {
  시작전: "#9aa0ad",
  진행중: "#b6e65a",
  완료: "#5ad17a",
  중단: "#f2675a",
};

/** audit 상태 → 뱃지 라벨·클래스(D-6). 요구사항 노드에 audit가 있을 때만 렌더. */
const AUDIT_BADGE: Record<CapabilityAuditSummary["status"], { label: string; cls: string }> = {
  clean: { label: "정합", cls: "feature-tree-audit--clean" },
  fail: { label: "불합", cls: "feature-tree-audit--fail" },
  unknown: { label: "미감사", cls: "feature-tree-audit--unknown" },
};

export function FeatureNode({ data }: NodeProps): JSX.Element {
  const { label, kind, capability, priority, status, memo, audit, linkedChanges } = data as FeatureNodeData;
  const s = KIND_STYLE[kind] ?? KIND_STYLE.detail;
  const changeCount = linkedChanges?.length ?? 0;
  return (
    <div
      className="feature-tree-node"
      style={{ background: s.bg, borderColor: s.accent }}
      title={label}
    >
      <Handle type="target" position={Position.Left} className="feature-handle" />
      <div className="feature-tree-node-head">
        <span className="feature-tree-node-tag" style={{ color: s.accent }}>{s.tag}</span>
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
        {/* 연관 change 배지(flowforge-change-node-mapping) — 연관 change가 있는 노드에만.
            요구사항 자신 + 상속받은 기능/상세기능 모두 표시. 진입은 상세 패널의 change 항목 클릭. */}
        {changeCount > 0 && (
          <span
            className="feature-tree-change"
            title={`연관 change ${changeCount}개 — 노드 클릭 후 상세 패널에서 열기`}
          >
            change {changeCount}
          </span>
        )}
      </div>
      <span className="feature-tree-node-label">{label}</span>
      {kind === "requirement" && capability && (
        <span className="feature-tree-cap" title={`capability: ${capability}`}>{capability}</span>
      )}
      {memo && (
        <span className="feature-tree-memo" title={`메모: ${memo}`}>📝 {memo}</span>
      )}
      <Handle type="source" position={Position.Right} className="feature-handle" />
    </div>
  );
}
