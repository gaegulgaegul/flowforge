/** IATree(shared) → ReactFlow nodes/edges. dagre 좌→우 트리 레이아웃 + depth별 노드. */
import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import type { IANode, IANodeKind, FeatureTreeNode, ScreenRegistry } from "@flowforge/shared";

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
  /** kind 기본 태그(변경/기능군/요구사항) 오버라이드 — 기획 IA는 화면목록/화면/상세기능 어휘. 없으면 IANode가 KIND_STYLE 기본 사용. */
  tag?: string;
  /**
   * 연관 change 키 목록(flowforge-change-node-mapping, B.2) — 기획 IA의 화면(capability) 노드만
   * 채워짐. 그 화면에 연결된 상세기능들의 상위 요구사항 linkedChanges를 역경유해 합집합(중복 제거)한
   * 값. 연결 상세기능이 없거나 change가 0개면 필드 자체 없음(undefined).
   */
  linkedChanges?: readonly string[];
}

const NODE_W = 220;
const NODE_H_SIMPLE = 44;
const NODE_H_VERBOSE = 76;

/**
 * 화면 id → 그 화면에 연결된 상세기능 라벨 목록(중복 제거). screenRegistry.links(N:M)의
 * 역인덱스 — server planningIaBuilder.ts:33~42 detailsByScreen 패턴을 web에서 순수 함수로 재현.
 */
function buildDetailLabelsByScreen(registry: ScreenRegistry): Map<string, string[]> {
  const byScreen = new Map<string, string[]>();
  for (const screen of registry.screens) byScreen.set(screen.id, []);
  for (const link of registry.links) {
    for (const sid of link.screenIds) {
      const bucket = byScreen.get(sid);
      if (bucket && !bucket.includes(link.detailLabel)) bucket.push(link.detailLabel);
    }
  }
  return byScreen;
}

/**
 * 상세기능 라벨 → 상위 요구사항의 linkedChanges. featureTree(요구사항→기능→상세기능)를 순회해
 * 상세기능(kind='detail') 노드의 라벨로 조인 키를 만든다. 같은 라벨이 여러 요구사항 아래 있으면
 * change 목록을 합친다(featureTreeAdapter의 라벨 완전일치 조인 관례와 동형).
 */
function buildLinkedChangesByDetailLabel(root: FeatureTreeNode): Map<string, readonly string[]> {
  const byLabel = new Map<string, string[]>();
  const walk = (n: FeatureTreeNode, reqLinkedChanges: readonly string[] | undefined) => {
    if (n.kind === "detail" && reqLinkedChanges && reqLinkedChanges.length > 0) {
      const existing = byLabel.get(n.label);
      if (existing) {
        for (const c of reqLinkedChanges) if (!existing.includes(c)) existing.push(c);
      } else {
        byLabel.set(n.label, [...reqLinkedChanges]);
      }
    }
    const nextLinked = n.kind === "requirement" ? n.linkedChanges : reqLinkedChanges;
    for (const c of n.children) walk(c, nextLinked);
  };
  for (const req of root.children) walk(req, req.linkedChanges);
  return byLabel;
}

/**
 * B.2: 원본 화면 id(ScreenRegistry.screens[].id, IANode.screenId와 동일 원천) → 역경유 합집합
 * linkedChanges. screenRegistry로 화면→상세기능 라벨 역인덱스를 만들고, featureTree로 상세기능
 * 라벨→change를 조인해 화면별로 합친다(Set 중복 제거). node id(slug)가 아니라 원본 screenId를
 * 키로 써서 IANode.screenId와 문자열 그대로 매칭한다(slug 재현 불필요, D-3 패턴과 동형).
 * 연결 상세기능이 없거나 change 0개인 화면은 맵에 키 자체가 없다(안전한 빈 처리).
 */
function buildLinkedChangesByScreenId(
  featureTree: FeatureTreeNode,
  screenRegistry: ScreenRegistry,
): Map<string, readonly string[]> {
  const detailLabelsByScreen = buildDetailLabelsByScreen(screenRegistry);
  const linkedChangesByDetailLabel = buildLinkedChangesByDetailLabel(featureTree);
  const result = new Map<string, readonly string[]>();
  for (const [screenId, detailLabels] of detailLabelsByScreen) {
    const union = new Set<string>();
    for (const label of detailLabels) {
      const changes = linkedChangesByDetailLabel.get(label);
      if (changes) for (const c of changes) union.add(c);
    }
    if (union.size > 0) result.set(screenId, [...union]);
  }
  return result;
}

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

/**
 * dagre 좌→우(LR) 트리 레이아웃 → RF nodes/edges. verbose면 노드 높이↑
 * tagByKind: kind 기본 태그(변경/기능군/요구사항) 오버라이드 — 기획 IA만 화면 어휘 주입. 미전달이면 change IA 기본 유지.
 * changeMapping(B.2, 선택): { featureTree, screenRegistry } 둘 다 있으면 화면(capability) 노드에
 * linkedChanges를 역경유 부착. 하나라도 없으면(change IA 등 기획 IA가 아닌 호출) 부착하지 않는다
 * (기존 호출부 무변경 — 옵션 파라미터라 이전 호출 시그니처와 호환).
 */
export function toIAFlow(
  root: IANode,
  verbose: boolean,
  tagByKind?: Partial<Record<IANodeKind, string>>,
  changeMapping?: { featureTree: FeatureTreeNode; screenRegistry: ScreenRegistry },
): { nodes: Node<IANodeData>[]; edges: Edge[] } {
  const { nodes: ianodes, edges: iaedges, parents } = flatten(root);
  const h = verbose ? NODE_H_VERBOSE : NODE_H_SIMPLE;
  const linkedChangesByScreenId = changeMapping
    ? buildLinkedChangesByScreenId(changeMapping.featureTree, changeMapping.screenRegistry)
    : undefined;

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
        // kind 태그 오버라이드(기획 IA 화면 어휘). 없으면 IANode가 KIND_STYLE 기본 사용.
        ...(tagByKind?.[n.kind] ? { tag: tagByKind[n.kind] } : {}),
        // 연관 change 역경유(B.2) — 화면 노드(screenId 보유)만, 매핑 없거나 change 0개면 키 생략.
        ...((): { linkedChanges?: readonly string[] } => {
          if (!n.screenId || !linkedChangesByScreenId) return {};
          const lc = linkedChangesByScreenId.get(n.screenId);
          return lc ? { linkedChanges: lc } : {};
        })(),
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
