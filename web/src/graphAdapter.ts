/** SpecGraph(shared) → ReactFlow nodes/edges. 레이아웃 오버레이 머지 + dagre 자동정렬. */
import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { SpecGraph, LayoutOverlay, NodeKind } from "@flowforge/shared";

/** 커스텀 노드가 받는 데이터. App에서 nodeTypes로 SpecNode에 매핑. */
export interface SpecNodeData extends Record<string, unknown> {
  label: string;
  kind: NodeKind;
  /** charter 상주 docs의 SEED(미검증) 마킹. change 경로는 undefined → 배지 미표시. */
  seed?: boolean;
}

const NODE_W = 200;
const NODE_H = 56;
const PER_ROW = 3;

/** 그리드 폴백 배치(오버레이도 dagre도 못 쓸 때) */
function gridPosition(index: number): { x: number; y: number } {
  return { x: (index % PER_ROW) * (NODE_W + 60), y: Math.floor(index / PER_ROW) * (NODE_H + 80) };
}

/**
 * dagre 위계 레이아웃. 엣지 방향 따라 top-down 배치.
 * dangling 엣지(target null)는 제외하고 계산 — 고립 노드는 dagre가 자동 분리 배치.
 */
export function autoLayout(graph: SpecGraph): LayoutOverlay {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 90, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of graph.nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  for (const e of graph.edges) {
    if (e.target !== null && g.hasNode(e.source) && g.hasNode(e.target)) {
      g.setEdge(e.source, e.target);
    }
  }

  dagre.layout(g);

  const layout: LayoutOverlay = {};
  graph.nodes.forEach((n, i) => {
    const pos = g.node(n.id);
    // dagre는 중심좌표 → ReactFlow는 좌상단좌표로 변환
    layout[n.id] = pos
      ? { x: Math.round(pos.x - NODE_W / 2), y: Math.round(pos.y - NODE_H / 2) }
      : gridPosition(i);
  });
  return layout;
}

/**
 * 노드 위치 결정: 저장된 오버레이 우선 → 없으면 dagre 자동정렬.
 * 일부만 저장돼 있어도 저장본은 보존하고 나머지는 dagre 결과로 채운다.
 */
export function toFlowNodes(graph: SpecGraph, layout: LayoutOverlay): Node<SpecNodeData>[] {
  const auto = autoLayout(graph);
  return graph.nodes.map((n) => {
    const position = layout[n.id] ?? auto[n.id]!;
    // exactOptionalPropertyTypes: seed가 undefined면 키 자체를 빼야 SpecNodeData(optional)와 호환된다.
    const data: SpecNodeData = { label: n.label, kind: n.kind, ...(n.seed !== undefined ? { seed: n.seed } : {}) };
    return {
      id: n.id,
      position,
      data,
      type: "spec",
    };
  });
}

export function toFlowEdges(graph: SpecGraph): Edge[] {
  return graph.edges
    .filter((e): e is typeof e & { target: string } => e.target !== null)
    .map((e) => {
      // 에지케이스(점선) 분기 = 애니메이션 점선 + 주황 강조. 실선(happy·부재)은 현행 유지.
      const isEdgecase = e.kind === "edgecase";
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: isEdgecase,
        ...(isEdgecase ? { style: { strokeDasharray: "6 4", stroke: "#f0a05a" } } : {}),
      };
    });
}

/** dangling 엣지(target null) 개수 — 경고 배지용 */
export function danglingCount(graph: SpecGraph): number {
  return graph.edges.filter((e) => e.dangling).length;
}
