/** FeatureTree(shared) → ReactFlow nodes/edges. dagre 좌→우 트리 레이아웃.
 *
 * change용 specTreeAdapter와 의도적으로 분리(타입 전략 B, 2026-06-28). dagre LR 패턴은
 * 동형이라 복제했지만, 공유 추출하지 않고 기획 features 전용으로 독립 유지한다.
 * 가상 루트(id='feat-root')는 그리지 않고 그 children(요구사항들)부터 평탄화한다. */
import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { FeatureTreeNode, FeatureTreeNodeKind, FeaturePriority, FeatureStatus } from "@flowforge/shared";

export interface FeatureNodeData extends Record<string, unknown> {
  label: string;
  kind: FeatureTreeNodeKind;
  /** 요구사항 노드만 채워짐(영문 capability 키). 기능/상세기능은 빈 문자열. */
  capability: string;
  priority: FeaturePriority | "";
  status: FeatureStatus | "";
}

const NODE_W = 240;
const NODE_H_SIMPLE = 48;
const NODE_H_REQ = 64;

/** 요구사항 노드는 capability 칩 한 줄을 더 보여줄 수 있으니 살짝 높게. */
function nodeHeight(kind: FeatureTreeNodeKind): number {
  return kind === "requirement" ? NODE_H_REQ : NODE_H_SIMPLE;
}

/** 트리를 평탄화: 각 노드 + 부모→자식 엣지 수집(전달된 노드 자신부터 시작). */
function flatten(start: FeatureTreeNode): {
  nodes: FeatureTreeNode[];
  edges: Array<{ from: string; to: string }>;
} {
  const nodes: FeatureTreeNode[] = [];
  const edges: Array<{ from: string; to: string }> = [];
  const walk = (n: FeatureTreeNode) => {
    nodes.push(n);
    for (const c of n.children) {
      edges.push({ from: n.id, to: c.id });
      walk(c);
    }
  };
  walk(start);
  return { nodes, edges };
}

/** dagre 좌→우(LR) 트리 레이아웃 → RF nodes/edges.
 * root는 가상 루트(id='feat-root')이므로 제외하고 그 children(요구사항들)부터 그린다. */
export function toFeatureTreeFlow(root: FeatureTreeNode): {
  nodes: Node<FeatureNodeData>[];
  edges: Edge[];
} {
  // 가상 루트는 렌더하지 않는다 — 각 요구사항을 독립 서브트리로 평탄화해 합친다.
  const featnodes: FeatureTreeNode[] = [];
  const featedges: Array<{ from: string; to: string }> = [];
  for (const req of root.children) {
    const { nodes, edges } = flatten(req);
    featnodes.push(...nodes);
    featedges.push(...edges);
  }

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 24, ranksep: 80, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of featnodes) g.setNode(n.id, { width: NODE_W, height: nodeHeight(n.kind) });
  for (const e of featedges) g.setEdge(e.from, e.to);
  dagre.layout(g);

  const nodes: Node<FeatureNodeData>[] = featnodes.map((n) => {
    const pos = g.node(n.id);
    const h = nodeHeight(n.kind);
    return {
      id: n.id,
      position: { x: Math.round(pos.x - NODE_W / 2), y: Math.round(pos.y - h / 2) },
      data: {
        label: n.label,
        kind: n.kind,
        capability: n.capability,
        priority: n.priority,
        status: n.status,
      },
      type: "featureTree",
    };
  });
  const edges: Edge[] = featedges.map((e, i) => ({
    id: `feat-${e.from}->${e.to}#${i}`,
    source: e.from,
    target: e.to,
    animated: false,
  }));
  return { nodes, edges };
}
