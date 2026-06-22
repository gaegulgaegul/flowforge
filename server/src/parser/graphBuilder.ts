/**
 * graphBuilder — openspec change 디렉토리 → 유저플로우 그래프 {nodes, edges}
 *
 * Python __golden__/gen_golden.py build_graph 와 동일 로직 (골든 동치 대상).
 * screen spec만 노드, 각 시나리오 THEN을 flowTarget으로 바인딩해 엣지 생성.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { parseSpecText, slug } from "./specParser.js";
import { isScreenSpec, screenAliases, flowTarget } from "./flowBinder.js";
import type { ScreenSpec } from "./flowBinder.js";

export interface GraphNode {
  id: string;
  name: string;
  kind: "screen";
}
export interface GraphEdge {
  from: string;
  to: string;
  scenario: string;
  hint: string;
  dangling: boolean;
}
export interface SpecGraph {
  change: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** change 디렉토리(<dir>/specs/<name>/spec.md 다수) → 그래프 */
export function buildGraph(changeDir: string): SpecGraph {
  const specsRoot = join(changeDir, "specs");
  const names = readdirSync(specsRoot).sort();
  const screens: ScreenSpec[] = [];
  for (const name of names) {
    const specMd = join(specsRoot, name, "spec.md");
    try {
      if (!statSync(specMd).isFile()) continue;
    } catch {
      continue;
    }
    const raw = readFileSync(specMd, "utf-8");
    const parsed = parseSpecText(raw, name);
    if (!isScreenSpec(raw)) continue; // screen spec만
    screens.push({ ...parsed, _aliases: screenAliases(parsed) });
  }

  const nodes: GraphNode[] = screens.map((s) => ({
    id: "screen-" + slug(s.name),
    name: s.name,
    kind: "screen",
  }));
  const edges: GraphEdge[] = [];
  for (const s of screens) {
    for (const req of s.requirements) {
      for (const scn of req.scenarios) {
        const tgt = flowTarget(scn.then, screens, s);
        if (tgt === null) continue;
        edges.push({
          from: "screen-" + slug(s.name),
          to: tgt.anchor,
          scenario: scn.title,
          hint: tgt.hint,
          dangling: tgt.anchor === "__dangling__",
        });
      }
    }
  }
  return { change: basename(changeDir.replace(/\/+$/, "")), nodes, edges };
}
