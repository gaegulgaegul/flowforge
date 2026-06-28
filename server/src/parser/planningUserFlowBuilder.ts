/**
 * planningUserFlowBuilder — docs/planning/user-flow/<group>-vN.md(Mermaid flowchart) → SpecGraph.
 *
 * 기획 단계(openspec-plan) 3단계 산출물 유저플로우를 비추는 전용 빌더(읽기전용).
 * mermaid 라이브러리를 쓰지 않고 flowchart 노드/엣지만 정규식으로 파싱한다.
 * change user-flow(graphBuilder, spec.md THEN NLP)·charter user-flow(charterUserFlowParser,
 * 자체 문법)와 입력이 달라 별도 파서지만, 출력은 공용 SpecGraph 타입(graph-types.ts)을 재사용한다.
 *
 * 노드 모양 → kind:
 *   ID(["텍스트"])   stadium → start
 *   ID(("텍스트"))   circle  → section
 *   ID{"텍스트"}     diamond → action
 *   ID["텍스트"]     box     → screen (기본)
 * 엣지: `A --> B`(이동), `A -->|라벨| B`(라벨). Mermaid는 대상 명시 → dangling 없음.
 * 미지원(subgraph/classDef/%%주석/스타일)은 throw 없이 무시한다.
 */
import type { GraphNode, GraphEdge, SpecGraph, NodeKind } from "@flowforge/shared";
import { slug } from "./specParser.js";
import { readDocsUserFlowSpec } from "../lib/docs.js";

/** ```mermaid … ``` 코드블록 본문만 추출(없으면 ""). */
function extractMermaid(md: string): string {
  const m = md.match(/```mermaid\s*\n([\s\S]*?)```/);
  return m ? (m[1] ?? "") : "";
}

/**
 * 노드 모양을 mermaidId만 남기고 제거(엣지 매칭용). `A([라벨]) --> B[라벨]` → `A --> B`.
 * 모양: ([..]) / ((..)) / {..} / [..]. 긴 것부터 벗겨 잔여 괄호 오인식 방지.
 */
function stripNodeShapes(line: string): string {
  return line
    .replace(/\(\[[^\]]*\]\)/g, "") // ([..])
    .replace(/\(\([^)]*\)\)/g, "") // ((..))
    .replace(/\{[^}]*\}/g, "") // {..}
    .replace(/\[[^\]]*\]/g, ""); // [..]
}

// 노드 정의: ID + 모양. 모양별로 분리 인식(긴 패턴 먼저: stadium/circle 전에 매칭 순서 주의).
// 캡처: [1]=id, [2]=라벨텍스트(따옴표 안 또는 그대로).
const NODE_PATTERNS: ReadonlyArray<{ kind: NodeKind; re: RegExp }> = [
  { kind: "start", re: /([A-Za-z0-9_]+)\(\[\s*"?([^"\]]+?)"?\s*\]\)/ }, // ([텍스트])
  { kind: "section", re: /([A-Za-z0-9_]+)\(\(\s*"?([^")]+?)"?\s*\)\)/ }, // (("텍스트"))
  { kind: "action", re: /([A-Za-z0-9_]+)\{\s*"?([^"}]+?)"?\s*\}/ }, // {"텍스트"}
  { kind: "screen", re: /([A-Za-z0-9_]+)\[\s*"?([^"\]]+?)"?\s*\]/ }, // ["텍스트"]
];

// 엣지: A -->|라벨| B  또는  A --> B
const RE_EDGE = /([A-Za-z0-9_]+)\s*-->\s*(?:\|([^|]*)\|\s*)?([A-Za-z0-9_]+)/g;

interface RawNode {
  mermaidId: string;
  kind: NodeKind;
  label: string;
}

/**
 * docsDir + flow stem(`<group>-vN`) → SpecGraph. 파일 없으면 null(라우트가 404).
 * mermaid 블록이 없으면 빈 그래프({nodes:[],edges:[]}).
 */
export function buildDocsPlanningUserFlow(docsDir: string, stem: string): SpecGraph | null {
  const md = readDocsUserFlowSpec(docsDir, stem);
  if (md === null) return null;
  const body = extractMermaid(md);

  // 1) 노드 수집: mermaidId → RawNode (한 줄에 여러 노드 정의 가능, 엣지 양끝 포함).
  const nodes = new Map<string, RawNode>();
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("%%") || /^(flowchart|graph|subgraph|end|classDef|class|style|linkStyle)\b/.test(t)) {
      continue; // 미지원/선언 라인 무시
    }
    // 모양 우선순위대로 모든 노드 정의 추출(한 줄 내 여러 개 — 엣지 양끝).
    let scan = t;
    for (const { kind, re } of NODE_PATTERNS) {
      const g = new RegExp(re.source, "g");
      let m: RegExpExecArray | null;
      while ((m = g.exec(scan)) !== null) {
        const id = m[1]!;
        if (!nodes.has(id)) nodes.set(id, { mermaidId: id, kind, label: (m[2] ?? id).trim() });
      }
      // 이미 잡은 모양은 다음 패턴이 다시 안 잡게 제거(box가 stadium 내부 []를 재매칭 방지).
      scan = scan.replace(new RegExp(re.source, "g"), " ");
    }
  }

  // 2) 엣지 수집 + 엣지 양끝의 bare id(모양 없이 등장)도 노드로 보강.
  //    노드 정의(모양)를 mermaidId만 남기고 벗겨야 `A([..]) --> B[..]`에서 A·B를 잡는다.
  const edges: GraphEdge[] = [];
  let edgeSeq = 0;
  for (const line of body.split(/\r?\n/)) {
    const t = stripNodeShapes(line.trim());
    if (!t || t.startsWith("%%")) continue;
    RE_EDGE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE_EDGE.exec(t)) !== null) {
      const [, from, label, to] = m;
      for (const id of [from!, to!]) {
        if (!nodes.has(id)) nodes.set(id, { mermaidId: id, kind: "screen", label: id });
      }
      edges.push({
        id: `uflow-edge-${edgeSeq++}`,
        source: nodeId(from!, nodes),
        target: nodeId(to!, nodes),
        label: (label ?? "").trim(),
        scenario: stem,
        dangling: false,
      });
    }
  }

  const outNodes: GraphNode[] = [...nodes.values()].map((n) => ({
    id: nodeId(n.mermaidId, nodes),
    kind: n.kind,
    label: n.label,
    specName: n.mermaidId,
  }));
  return { nodes: outNodes, edges };
}

/** mermaidId → 안정 노드 id. 라벨 slug 충돌 대비 mermaidId를 접미로 붙여 고유 보장. */
function nodeId(mermaidId: string, nodes: Map<string, RawNode>): string {
  const n = nodes.get(mermaidId);
  const base = n ? slug(n.label) : "x";
  return `uflow-${base}-${mermaidId.toLowerCase()}`;
}
