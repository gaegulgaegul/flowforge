/** IA 트리 커스텀 노드 — 3타입(change/capability/requirement) + 자세히/간단히 2뷰. */
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { IANodeKind } from "@flowforge/shared";
import type { IANodeData } from "./iaAdapter.js";

/** 타입별 시각 토큰(유저플로우 SpecNode와 동일 팔레트 계열). */
const KIND_STYLE: Record<IANodeKind, { accent: string; bg: string; tag: string }> = {
  change: { accent: "#b6e65a", bg: "#1f2a16", tag: "변경" },
  capability: { accent: "#7aa2ff", bg: "#161d2a", tag: "기능군" },
  requirement: { accent: "#e6e8ec", bg: "#22262e", tag: "요구사항" },
};

export function IANode({ data }: NodeProps): JSX.Element {
  const { label, kind, detail, scenarioCount, verbose, tag, linkedChanges } = data as IANodeData;
  const s = KIND_STYLE[kind] ?? KIND_STYLE.requirement;
  const changeCount = linkedChanges?.length ?? 0;
  return (
    <div
      className={`ia-node${verbose ? " ia-node--verbose" : ""}`}
      style={{ background: s.bg, borderColor: s.accent }}
      title={detail || label}
    >
      <Handle type="target" position={Position.Left} className="spec-handle" />
      <div className="ia-node-head">
        <span className="ia-node-tag" style={{ color: s.accent }}>{tag ?? s.tag}</span>
        {verbose && scenarioCount > 0 && (
          <span className="ia-node-badge" style={{ borderColor: s.accent, color: s.accent }}>
            기준 {scenarioCount}
          </span>
        )}
        {/* 연관 change 배지(flowforge-change-node-mapping, B.2) — 화면 노드 역경유 매핑.
            FeatureNode의 feature-tree-change와 동형. 진입은 상세 패널의 change 항목 클릭. */}
        {changeCount > 0 && (
          <span
            className="feature-tree-change"
            title={`연관 change ${changeCount}개 — 노드 클릭 후 상세 패널에서 열기`}
          >
            change {changeCount}
          </span>
        )}
      </div>
      <span className="ia-node-label">{label}</span>
      {verbose && detail && <span className="ia-node-detail">{detail}</span>}
      <Handle type="source" position={Position.Right} className="spec-handle" />
    </div>
  );
}
