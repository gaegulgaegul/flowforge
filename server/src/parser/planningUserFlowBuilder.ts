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

/**
 * 첫 ```mermaid 블록의 펜스 라인 인덱스(D-4 단일 감지). 여는 펜스 = trim 결과가 정확히
 * "```mermaid"인 라인(```mermaid-example 등 배제), 닫는 펜스 = 그 뒤 trim이 "```"로 시작하는
 * 첫 라인. 블록이 없거나 안 닫혔으면 null. 파서 추출과 userFlowDocs append 위치가 이 하나를
 * 공유해 "파싱 대상 ≠ append 대상" 분열을 구조적으로 차단한다.
 */
export function findFirstMermaidBlock(
  lines: readonly string[],
): { openIdx: number; closeIdx: number } | null {
  let openIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = (lines[i] ?? "").trim();
    if (openIdx < 0) {
      if (t === "```mermaid") openIdx = i;
    } else if (t.startsWith("```")) {
      return { openIdx, closeIdx: i };
    }
  }
  return null;
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

// 엣지: 실선 `A -->|라벨| B` / `A --> B`, 점선 `A -.->|라벨| B` / `A -.-> B`.
// 화살표 리터럴을 캡처([2])해 실선(`-->`)/점선(`-.->`)을 구분한다.
// 점선을 먼저(`-\.->`) 두어 `-->`가 `-.->`의 일부를 먼저 삼키지 않게 한다.
//   [1]=from, [2]=화살표 리터럴(-.-> | -->), [3]=라벨(옵션), [4]=to
const RE_EDGE = /([A-Za-z0-9_]+)\s*(-\.->|-->)\s*(?:\|([^|]*)\|\s*)?([A-Za-z0-9_]+)/g;

interface RawNode {
  mermaidId: string;
  kind: NodeKind;
  label: string;
}

/** 파싱된 raw 엣지 — mermaid 원문 id 기준(from/to). 6b-userflow 검증·roundtrip 비교용. */
export interface UserFlowRawEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: "happy" | "edgecase";
  readonly label: string;
}

/**
 * 라인 파싱 결과 — 공용 SpecGraph에 더해 raw mermaid 데이터를 노출한다.
 * GraphNode.id는 `uflow-<slug>-<id>`로 변환되므로 "mermaid id X가 문서에 있나" 검사에
 * 못 쓴다 → 다운스트림(userFlowDocs 승인 검증·self-roundtrip)이 raw id/엣지를 직접 본다.
 */
export interface UserFlowParse {
  readonly graph: SpecGraph;
  /** raw mermaid id → 라벨. */
  readonly rawNodes: ReadonlyMap<string, string>;
  readonly rawEdges: readonly UserFlowRawEdge[];
}

/** mermaid 본문 라인들 → mermaidId → RawNode (한 줄에 여러 노드 정의 가능, 엣지 양끝 포함). */
function collectRawNodes(bodyLines: readonly string[]): Map<string, RawNode> {
  const nodes = new Map<string, RawNode>();
  for (const line of bodyLines) {
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
  return nodes;
}

/**
 * mermaid 본문 라인들 → 엣지 수집 + 엣지 양끝의 bare id(모양 없이 등장)를 nodes에 보강.
 * 노드 정의(모양)를 mermaidId만 남기고 벗겨야 `A([..]) --> B[..]`에서 A·B를 잡는다.
 */
function collectEdges(
  bodyLines: readonly string[],
  nodes: Map<string, RawNode>,
  scenario: string,
): { edges: GraphEdge[]; rawEdges: UserFlowRawEdge[] } {
  const edges: GraphEdge[] = [];
  const rawEdges: UserFlowRawEdge[] = [];
  let edgeSeq = 0;
  for (const line of bodyLines) {
    const t = stripNodeShapes(line.trim());
    if (!t || t.startsWith("%%")) continue;
    RE_EDGE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE_EDGE.exec(t)) !== null) {
      const [, from, arrow, label, to] = m;
      const dotted = arrow === "-.->"; // 점선 = 에지케이스 분기
      for (const id of [from!, to!]) {
        if (!nodes.has(id)) nodes.set(id, { mermaidId: id, kind: "screen", label: id });
      }
      const kind = dotted ? ("edgecase" as const) : ("happy" as const);
      edges.push({
        id: `uflow-edge-${edgeSeq++}`,
        source: nodeId(from!, nodes),
        target: nodeId(to!, nodes),
        label: (label ?? "").trim(),
        scenario,
        dangling: false,
        kind,
      });
      rawEdges.push({ from: from!, to: to!, kind, label: (label ?? "").trim() });
    }
  }
  return { edges, rawEdges };
}

/**
 * 유저플로우 문서 라인 배열 → UserFlowParse. 파일 IO 없이 in-memory 라인만 파싱한다.
 * 6b self-roundtrip 검증이 "아직 안 쓴 새 라인"을 디스크 왕복 없이 재파싱하려고 분리했다
 * (featureTreeBuilder.buildFeatureTreeFromLines와 같은 이유). 첫 mermaid 블록만 파싱하며,
 * buildDocsPlanningUserFlow는 파일을 읽어 이 함수에 위임하는 얇은 래퍼.
 */
export function buildUserFlowFromLines(lines: readonly string[], scenario = ""): UserFlowParse {
  const block = findFirstMermaidBlock(lines);
  const bodyLines = block ? lines.slice(block.openIdx + 1, block.closeIdx) : [];
  const nodes = collectRawNodes(bodyLines);
  const { edges, rawEdges } = collectEdges(bodyLines, nodes, scenario);

  const outNodes: GraphNode[] = [...nodes.values()].map((n) => ({
    id: nodeId(n.mermaidId, nodes),
    kind: n.kind,
    label: n.label,
    specName: n.mermaidId,
    // 화면(page) 노드에만 바레 화면 id(mermaidId 소문자)를 실어준다(flowforge-screen-crosslink A.3).
    // 와이어(WireScreen2.id)·화면목록(ScreenNode.id)과 공유하는 조인키 — IA의 screenId 부여와 대칭.
    // 화면 아닌 노드(시작/섹션/행동)는 키 자체를 생략(exactOptionalPropertyTypes: undefined면 비파괴).
    ...(n.kind === "screen" ? { screenId: n.mermaidId.toLowerCase() } : {}),
  }));
  const rawNodes = new Map<string, string>([...nodes.values()].map((n) => [n.mermaidId, n.label]));
  return { graph: { nodes: outNodes, edges }, rawNodes, rawEdges };
}

/**
 * docsDir + flow stem(`<group>-vN`) → SpecGraph. 파일 없으면 null(라우트가 404).
 * mermaid 블록이 없으면 빈 그래프({nodes:[],edges:[]}).
 */
export function buildDocsPlanningUserFlow(docsDir: string, stem: string): SpecGraph | null {
  const md = readDocsUserFlowSpec(docsDir, stem);
  if (md === null) return null;
  return buildUserFlowFromLines(md.split(/\r?\n/), stem).graph;
}

/** mermaidId → 안정 노드 id. 라벨 slug 충돌 대비 mermaidId를 접미로 붙여 고유 보장. */
function nodeId(mermaidId: string, nodes: Map<string, RawNode>): string {
  const n = nodes.get(mermaidId);
  const base = n ? slug(n.label) : "x";
  return `uflow-${base}-${mermaidId.toLowerCase()}`;
}
