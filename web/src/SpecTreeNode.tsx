/** 기능명세서 트리 커스텀 노드 — 4타입(change/requirement/feature/detail), 읽기전용.
 * detail 노드만 WHEN/THEN을 노출(IANode와 동형, scenario를 노드로 펼침). */
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { SpecTreeNodeKind } from "@flowforge/shared";
import type { SpecTreeNodeData } from "./specTreeAdapter.js";

/** 타입별 시각 토큰(IANode 팔레트 계열, 4단계 구분). */
const KIND_STYLE: Record<SpecTreeNodeKind, { accent: string; bg: string; tag: string }> = {
  change: { accent: "#b6e65a", bg: "#1f2a16", tag: "변경" },
  requirement: { accent: "#7aa2ff", bg: "#161d2a", tag: "요구사항" },
  feature: { accent: "#f2b66d", bg: "#2a2014", tag: "기능" },
  detail: { accent: "#e6e8ec", bg: "#22262e", tag: "상세기능" },
};

export function SpecTreeNode({ data }: NodeProps): JSX.Element {
  const { label, kind, detail, when, then } = data as SpecTreeNodeData;
  const s = KIND_STYLE[kind] ?? KIND_STYLE.detail;
  const isDetail = kind === "detail";
  return (
    <div
      className={`spec-tree-node${isDetail ? " spec-tree-node--detail" : ""}`}
      style={{ background: s.bg, borderColor: s.accent }}
      title={detail || label}
    >
      <Handle type="target" position={Position.Left} className="spec-handle" />
      <div className="spec-tree-node-head">
        <span className="spec-tree-node-tag" style={{ color: s.accent }}>{s.tag}</span>
      </div>
      <span className="spec-tree-node-label">{label}</span>
      {isDetail && when && <span className="spec-tree-node-when">WHEN {when}</span>}
      {isDetail && then && <span className="spec-tree-node-then">THEN {then}</span>}
      <Handle type="source" position={Position.Right} className="spec-handle" />
    </div>
  );
}
