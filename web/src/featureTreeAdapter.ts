/** FeatureTree(shared) → ReactFlow nodes/edges. dagre 좌→우 트리 레이아웃.
 *
 * change용 specTreeAdapter와 의도적으로 분리(타입 전략 B, 2026-06-28). dagre LR 패턴은
 * 동형이라 복제했지만, 공유 추출하지 않고 기획 features 전용으로 독립 유지한다.
 * 가상 루트(id='feat-root')는 그리지 않고 그 children(요구사항들)부터 평탄화한다. */
import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { FeatureTreeNode, FeatureTreeNodeKind, FeaturePriority, FeatureStatus } from "@flowforge/shared";

/** 상세 패널용 자식 노드 요약(라벨+종류). 트리에서 파생, 노드 data에 실어 패널이 조인 없이 쓴다. */
export interface FeatureChildRef {
  id: string;
  label: string;
  kind: FeatureTreeNodeKind;
}

export interface FeatureNodeData extends Record<string, unknown> {
  label: string;
  kind: FeatureTreeNodeKind;
  /** 요구사항 노드만 채워짐(영문 capability 키). 기능/상세기능은 빈 문자열. */
  capability: string;
  priority: FeaturePriority | "";
  status: FeatureStatus | "";
  /** 경량 아이템 메모(lightweight-item-memo). 부착된 노드만 채워짐(없으면 undefined). */
  memo?: string;
  /**
   * 원본 위치(features.md 헤더 경로) — 조상 라벨들 `[## , ### , ####]`. 트리 구조에서 파생
   * (빌더/타입/골든 무저촉 — server를 안 건드리고 web adapter에서 조상을 수집). 루트(가상)는 제외.
   */
  path: readonly string[];
  /** 자식 노드 요약 목록(상세 패널의 "자식 노드" 섹션용). 트리에서 파생. */
  childRefs: readonly FeatureChildRef[];
}

const NODE_W = 240;
const NODE_H_SIMPLE = 48;
const NODE_H_REQ = 64;

/** 요구사항 노드는 capability 칩 한 줄을 더 보여줄 수 있으니 살짝 높게. */
function nodeHeight(kind: FeatureTreeNodeKind): number {
  return kind === "requirement" ? NODE_H_REQ : NODE_H_SIMPLE;
}

/** 트리를 평탄화: 각 노드 + 부모→자식 엣지 + 노드별 조상 라벨 경로 수집(전달된 노드 자신부터 시작).
 * path는 조상 라벨들의 배열(자기 자신 포함, 루트=요구사항부터). 상세 패널의 "원본 위치"에 쓴다. */
function flatten(start: FeatureTreeNode): {
  nodes: FeatureTreeNode[];
  edges: Array<{ from: string; to: string }>;
  paths: Map<string, string[]>;
} {
  const nodes: FeatureTreeNode[] = [];
  const edges: Array<{ from: string; to: string }> = [];
  const paths = new Map<string, string[]>();
  const walk = (n: FeatureTreeNode, ancestors: readonly string[]) => {
    const here = [...ancestors, n.label];
    nodes.push(n);
    paths.set(n.id, here);
    for (const c of n.children) {
      edges.push({ from: n.id, to: c.id });
      walk(c, here);
    }
  };
  walk(start, []);
  return { nodes, edges, paths };
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
  const featpaths = new Map<string, string[]>();
  for (const req of root.children) {
    const { nodes, edges, paths } = flatten(req);
    featnodes.push(...nodes);
    featedges.push(...edges);
    for (const [id, p] of paths) featpaths.set(id, p);
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
        // memo는 있을 때만 전달(비메모 노드는 undefined → 렌더 무영향).
        ...(n.memo !== undefined ? { memo: n.memo } : {}),
        // 상세 패널용 파생 필드(빌더/타입/골든 무저촉 — web에서 트리 구조로만 계산).
        path: featpaths.get(n.id) ?? [n.label],
        childRefs: n.children.map((c) => ({ id: c.id, label: c.label, kind: c.kind })),
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
