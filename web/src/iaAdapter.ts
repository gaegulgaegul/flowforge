/** IATree(shared) → ReactFlow nodes/edges. dagre 좌→우 트리 레이아웃 + depth별 노드. */
import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { IANode, IANodeKind } from "@flowforge/shared";

/** 상세 패널용 자식 노드 요약(라벨+종류). 트리에서 파생, 노드 data에 실어 패널이 조인 없이 쓴다.
 * 기획 IA에서 화면(capability) 노드의 자식 = N:M 연결된 상세기능(requirement). */
export interface IAChildRef {
  id: string;
  label: string;
  kind: IANodeKind;
}

export interface IANodeData extends Record<string, unknown> {
  label: string;
  kind: IANodeKind;
  detail: string;
  scenarioCount: number;
  /** 자세히뷰 여부 — 노드가 detail/배지를 보일지 결정 */
  verbose: boolean;
  /** 상세 패널용 파생 필드 — 자식 노드 요약(화면이면 N:M 연결 상세기능). 트리에서 파생. */
  childRefs?: readonly IAChildRef[];
  /** 상세 패널용 파생 필드 — 부모 노드 라벨(루트는 undefined). */
  parentLabel?: string;
  /** 상세 패널용 파생 필드 — 부모 노드 id(전환 이동용, 루트는 undefined). */
  parentId?: string;
  /** 기획 IA 화면 노드의 원본 화면 id(server가 실어줌). 상세 패널 화면 칩 딥링크의 매칭 원천. */
  screenId?: string;
}

const NODE_W = 220;
const NODE_H_SIMPLE = 44;
const NODE_H_VERBOSE = 76;

/** 트리를 평탄화: 각 노드 + 부모→자식 엣지 + 노드별 부모 참조 수집(상세 패널용). */
function flatten(root: IANode): {
  nodes: IANode[];
  edges: Array<{ from: string; to: string }>;
  parents: Map<string, IANode>;
} {
  const nodes: IANode[] = [];
  const edges: Array<{ from: string; to: string }> = [];
  const parents = new Map<string, IANode>();
  const walk = (n: IANode) => {
    nodes.push(n);
    for (const c of n.children) {
      edges.push({ from: n.id, to: c.id });
      parents.set(c.id, n);
      walk(c);
    }
  };
  walk(root);
  return { nodes, edges, parents };
}

/** dagre 좌→우(LR) 트리 레이아웃 → RF nodes/edges. verbose면 노드 높이↑ */
export function toIAFlow(root: IANode, verbose: boolean): { nodes: Node<IANodeData>[]; edges: Edge[] } {
  const { nodes: ianodes, edges: iaedges, parents } = flatten(root);
  const h = verbose ? NODE_H_VERBOSE : NODE_H_SIMPLE;

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 24, ranksep: 80, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of ianodes) g.setNode(n.id, { width: NODE_W, height: h });
  for (const e of iaedges) g.setEdge(e.from, e.to);
  dagre.layout(g);

  const nodes: Node<IANodeData>[] = ianodes.map((n) => {
    const pos = g.node(n.id);
    const parent = parents.get(n.id);
    return {
      id: n.id,
      position: { x: Math.round(pos.x - NODE_W / 2), y: Math.round(pos.y - h / 2) },
      data: {
        label: n.label,
        kind: n.kind,
        detail: n.detail,
        scenarioCount: n.scenarioCount,
        verbose,
        // 상세 패널용 파생 필드(빌더/타입 무저촉 — web에서 트리 구조로만 계산).
        childRefs: n.children.map((c) => ({ id: c.id, label: c.label, kind: c.kind })),
        ...(parent ? { parentLabel: parent.label, parentId: parent.id } : {}),
        // 화면 노드에만 실린 원본 screenId 통과(server IANode.screenId) — 칩 딥링크 문자열 동치 매칭용.
        ...(n.screenId ? { screenId: n.screenId } : {}),
      },
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
