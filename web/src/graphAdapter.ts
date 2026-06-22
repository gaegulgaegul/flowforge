/** SpecGraph(shared) → ReactFlow nodes/edges. 레이아웃 오버레이 머지 + 기본 그리드 배치. */
import type { Node, Edge } from "@xyflow/react";
import type { SpecGraph, LayoutOverlay } from "@manyfast/shared";

const COL_W = 240;
const ROW_H = 120;
const PER_ROW = 3;

/** 오버레이에 위치 있으면 그걸, 없으면 인덱스 기반 그리드 배치 */
export function toFlowNodes(graph: SpecGraph, layout: LayoutOverlay): Node[] {
  return graph.nodes.map((n, i) => {
    const saved = layout[n.id];
    const position = saved ?? {
      x: (i % PER_ROW) * COL_W,
      y: Math.floor(i / PER_ROW) * ROW_H,
    };
    return {
      id: n.id,
      position,
      data: { label: n.label },
      type: "default",
    };
  });
}

export function toFlowEdges(graph: SpecGraph): Edge[] {
  return graph.edges
    .filter((e): e is typeof e & { target: string } => e.target !== null)
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: false,
    }));
}

/** dangling 엣지(target null) 개수 — 경고 배지용 */
export function danglingCount(graph: SpecGraph): number {
  return graph.edges.filter((e) => e.dangling).length;
}
