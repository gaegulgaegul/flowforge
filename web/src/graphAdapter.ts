/** SpecGraph(shared) → ReactFlow nodes/edges. 레이아웃 오버레이 머지 + dagre 자동정렬. */
import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { SpecGraph, LayoutOverlay, NodeKind } from "@flowforge/shared";

/** 상세 패널용 연결 흐름 요약 — 이 노드에 들어오거나(incoming) 나가는(outgoing) 엣지 한 건.
 * 그래프(SpecGraph)에서 파생, 노드 data에 실어 패널이 조인 없이 쓴다(빌더/골든 무저촉). */
export interface FlowEdgeRef {
  /** 상대 노드 id(전환 대상 이동에 사용). dangling(target null)이면 undefined. */
  otherId?: string;
  /** 상대 노드 라벨(dangling이면 원래 target 텍스트, 없으면 "(미연결)"). */
  otherLabel: string;
  /** 엣지 라벨(전이 조건 문구). 비어있을 수 있음. */
  edgeLabel: string;
  /** 에지케이스(점선) 분기 여부. 부재/happy는 false. */
  edgecase: boolean;
  /** NAV 동사는 있으나 대상 미발견(⚠). */
  dangling: boolean;
}

/** 커스텀 노드가 받는 데이터. App에서 nodeTypes로 SpecNode에 매핑. */
export interface SpecNodeData extends Record<string, unknown> {
  label: string;
  kind: NodeKind;
  /** charter 상주 docs의 SEED(미검증) 마킹. change 경로는 undefined → 배지 미표시. */
  seed?: boolean;
  /** 상세 패널용 파생 필드 — 이 노드로 들어오는 흐름(다른 노드 → 이 노드). */
  incoming?: readonly FlowEdgeRef[];
  /** 상세 패널용 파생 필드 — 이 노드에서 나가는 흐름(이 노드 → 다른 노드). */
  outgoing?: readonly FlowEdgeRef[];
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
  // 라벨 조인용 인덱스(상세 패널의 상대 노드 라벨 표시). id → label.
  const labelById = new Map<string, string>();
  for (const n of graph.nodes) labelById.set(n.id, n.label);

  // 노드별 들어오고 나가는 흐름 파생(서버/골든 무저촉 — web에서 그래프 구조로만 계산).
  const incomingByNode = new Map<string, FlowEdgeRef[]>();
  const outgoingByNode = new Map<string, FlowEdgeRef[]>();
  for (const n of graph.nodes) {
    incomingByNode.set(n.id, []);
    outgoingByNode.set(n.id, []);
  }
  for (const e of graph.edges) {
    const edgecase = e.kind === "edgecase";
    // 나가는 흐름(source 기준). dangling이면 상대 라벨을 원래 target 텍스트/에지 라벨로 표시.
    const out = outgoingByNode.get(e.source);
    if (out) {
      const targetLabel = e.target !== null ? (labelById.get(e.target) ?? e.target) : (e.label || "(미연결)");
      out.push({
        ...(e.target !== null ? { otherId: e.target } : {}),
        otherLabel: targetLabel,
        edgeLabel: e.label,
        edgecase,
        dangling: e.dangling,
      });
    }
    // 들어오는 흐름(target 기준). dangling(target null)은 목적지가 없으니 스킵.
    if (e.target !== null) {
      const inc = incomingByNode.get(e.target);
      if (inc) {
        inc.push({
          otherId: e.source,
          otherLabel: labelById.get(e.source) ?? e.source,
          edgeLabel: e.label,
          edgecase,
          dangling: e.dangling,
        });
      }
    }
  }

  return graph.nodes.map((n) => {
    const position = layout[n.id] ?? auto[n.id]!;
    // exactOptionalPropertyTypes: seed가 undefined면 키 자체를 빼야 SpecNodeData(optional)와 호환된다.
    const data: SpecNodeData = {
      label: n.label,
      kind: n.kind,
      ...(n.seed !== undefined ? { seed: n.seed } : {}),
      incoming: incomingByNode.get(n.id) ?? [],
      outgoing: outgoingByNode.get(n.id) ?? [],
    };
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
