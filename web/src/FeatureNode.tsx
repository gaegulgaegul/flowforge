/** 기획 기능명세서(FeatureTree) 커스텀 노드 — 3타입(requirement/feature/detail), 읽기전용.
 *
 * change용 SpecTreeNode와 의도적으로 분리(타입 전략 B, 2026-06-28). 스타일은 참고했지만
 * 기획 features 전용으로 독립한다. 요구사항 노드만 capability 키 칩을 노출하고,
 * 모든 노드는 중요도(priority)/상태(status)를 뱃지로 시각화한다. */
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FeatureTreeNodeKind, FeaturePriority, FeatureStatus } from "@flowforge/shared";
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

export function FeatureNode({ data }: NodeProps): JSX.Element {
  const { label, kind, capability, priority, status } = data as FeatureNodeData;
  const s = KIND_STYLE[kind] ?? KIND_STYLE.detail;
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
      </div>
      <span className="feature-tree-node-label">{label}</span>
      {kind === "requirement" && capability && (
        <span className="feature-tree-cap" title={`capability: ${capability}`}>{capability}</span>
      )}
      <Handle type="source" position={Position.Right} className="feature-handle" />
    </div>
  );
}
