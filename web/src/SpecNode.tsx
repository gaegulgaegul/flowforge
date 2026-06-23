/** 유저플로우 커스텀 노드 — 4타입(start/section/screen/action) 다크테마 디자인. */
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NodeKind } from "@manyfast/shared";
import type { SpecNodeData } from "./graphAdapter.js";

/** 타입별 시각 토큰. 색상은 styles.css 다크 팔레트 + 라임 액센트 계열. */
const KIND_STYLE: Record<NodeKind, { accent: string; bg: string; icon: string; tag: string }> = {
  start: { accent: "#b6e65a", bg: "#1f2a16", icon: "▶", tag: "시작" },
  section: { accent: "#7aa2ff", bg: "#161d2a", icon: "▤", tag: "섹션" },
  screen: { accent: "#e6e8ec", bg: "#22262e", icon: "▢", tag: "화면" },
  action: { accent: "#f0a05a", bg: "#2a1f16", icon: "↳", tag: "행동" },
};

export function SpecNode({ data }: NodeProps): JSX.Element {
  const { label, kind } = data as SpecNodeData;
  const s = KIND_STYLE[kind] ?? KIND_STYLE.screen;
  return (
    <div
      className="spec-node"
      style={{ background: s.bg, borderColor: s.accent, boxShadow: `0 0 0 1px ${s.accent}22, 0 2px 8px #0006` }}
      title={`${s.tag}: ${label}`}
    >
      <Handle type="target" position={Position.Top} className="spec-handle" />
      <span className="spec-node-icon" style={{ color: s.accent }}>{s.icon}</span>
      <div className="spec-node-body">
        <span className="spec-node-tag" style={{ color: s.accent }}>{s.tag}</span>
        <span className="spec-node-label">{label}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="spec-handle" />
    </div>
  );
}
