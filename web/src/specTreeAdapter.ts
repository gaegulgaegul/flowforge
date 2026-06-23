/** SpecTree(shared) → ReactFlow nodes/edges. dagre 좌→우 트리 레이아웃 + kind별 노드 높이. */
import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { SpecTreeNode as SpecTreeNodeT, SpecTreeNodeKind } from "@flowforge/shared";

export interface SpecTreeNodeData extends Record<string, unknown> {
  label: string;
  kind: SpecTreeNodeKind;
  detail: string;
  when: string;
  then: string;
}

const NODE_W = 240;
const NODE_H_SIMPLE = 48;
const NODE_H_DETAIL = 96;

/** detail 노드는 WHEN/THEN 2줄을 보여야 하니 더 높게. */
function nodeHeight(kind: SpecTreeNodeKind): number {
  return kind === "detail" ? NODE_H_DETAIL : NODE_H_SIMPLE;
}

/** 트리를 평탄화: 각 노드 + 부모→자식 엣지 수집 */
function flatten(root: SpecTreeNodeT): {
  nodes: SpecTreeNodeT[];
  edges: Array<{ from: string; to: string }>;
} {
  const nodes: SpecTreeNodeT[] = [];
  const edges: Array<{ from: string; to: string }> = [];
  const walk = (n: SpecTreeNodeT) => {
    nodes.push(n);
    for (const c of n.children) {
      edges.push({ from: n.id, to: c.id });
      walk(c);
    }
  };
  walk(root);
  return { nodes, edges };
}

/** dagre 좌→우(LR) 트리 레이아웃 → RF nodes/edges. detail 노드는 높이↑. */
export function toSpecTreeFlow(root: SpecTreeNodeT): {
  nodes: Node<SpecTreeNodeData>[];
  edges: Edge[];
} {
  const { nodes: specnodes, edges: specedges } = flatten(root);

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 24, ranksep: 80, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of specnodes) g.setNode(n.id, { width: NODE_W, height: nodeHeight(n.kind) });
  for (const e of specedges) g.setEdge(e.from, e.to);
  dagre.layout(g);

  const nodes: Node<SpecTreeNodeData>[] = specnodes.map((n) => {
    const pos = g.node(n.id);
    const h = nodeHeight(n.kind);
    return {
      id: n.id,
      position: { x: Math.round(pos.x - NODE_W / 2), y: Math.round(pos.y - h / 2) },
      data: { label: n.label, kind: n.kind, detail: n.detail, when: n.when, then: n.then },
      type: "specTree",
    };
  });
  const edges: Edge[] = specedges.map((e, i) => ({
    id: `spec-${e.from}->${e.to}#${i}`,
    source: e.from,
    target: e.to,
    animated: false,
  }));
  return { nodes, edges };
}
