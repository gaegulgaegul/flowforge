/** IATree(shared) → ReactFlow nodes/edges. dagre 좌→우 트리 레이아웃 + depth별 노드. */
import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { IANode, IANodeKind } from "@flowforge/shared";

export interface IANodeData extends Record<string, unknown> {
  label: string;
  kind: IANodeKind;
  detail: string;
  scenarioCount: number;
  /** 자세히뷰 여부 — 노드가 detail/배지를 보일지 결정 */
  verbose: boolean;
}

const NODE_W = 220;
const NODE_H_SIMPLE = 44;
const NODE_H_VERBOSE = 76;

/** 트리를 평탄화: 각 노드 + 부모→자식 엣지 수집 */
function flatten(root: IANode): { nodes: IANode[]; edges: Array<{ from: string; to: string }> } {
  const nodes: IANode[] = [];
  const edges: Array<{ from: string; to: string }> = [];
  const walk = (n: IANode) => {
    nodes.push(n);
    for (const c of n.children) {
      edges.push({ from: n.id, to: c.id });
      walk(c);
    }
  };
  walk(root);
  return { nodes, edges };
}

/** dagre 좌→우(LR) 트리 레이아웃 → RF nodes/edges. verbose면 노드 높이↑ */
export function toIAFlow(root: IANode, verbose: boolean): { nodes: Node<IANodeData>[]; edges: Edge[] } {
  const { nodes: ianodes, edges: iaedges } = flatten(root);
  const h = verbose ? NODE_H_VERBOSE : NODE_H_SIMPLE;

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 24, ranksep: 80, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of ianodes) g.setNode(n.id, { width: NODE_W, height: h });
  for (const e of iaedges) g.setEdge(e.from, e.to);
  dagre.layout(g);

  const nodes: Node<IANodeData>[] = ianodes.map((n) => {
    const pos = g.node(n.id);
    return {
      id: n.id,
      position: { x: Math.round(pos.x - NODE_W / 2), y: Math.round(pos.y - h / 2) },
      data: { label: n.label, kind: n.kind, detail: n.detail, scenarioCount: n.scenarioCount, verbose },
      type: "ia",
    };
  });
  const edges: Edge[] = iaedges.map((e, i) => ({
    id: `ia-${e.from}->${e.to}#${i}`,
    source: e.from,
    target: e.to,
    animated: false,
  }));
  return { nodes, edges };
}
