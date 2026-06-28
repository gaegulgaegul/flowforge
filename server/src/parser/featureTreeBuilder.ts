/**
 * featureTreeBuilder — docs/planning/features.md → 기획 기능명세서 3단 트리(FeatureTree).
 *
 * 기획 단계(openspec-plan) 산출물 features.md를 비추는 전용 빌더(읽기전용·SSOT는 원문).
 * change spec.md용 specTreeBuilder와 분리한다(타입 전략 B). markdown.ts의 splitSections는
 * `##`만 경계로 보므로 ###/#### 위계를 못 잡는다 → 여기서 헤더 레벨을 직접 라인 스캔한다.
 *
 * 문법(openspec-plan SKILL.md 스키마):
 *   ## 요구사항     <!-- capability: <영문키> -->   (중요도: …, 상태: …)
 *   ### 기능         (중요도: …, 상태: …)
 *   #### 상세기능    (중요도: …, 상태: …)
 * capability는 요구사항에만, 속성은 모든 노드에 둘 수 있고(헤더 직후 줄), 없으면 빈 값.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { FeatureTree, FeatureTreeNode, FeaturePriority, FeatureStatus } from "@flowforge/shared";
import { slug } from "./specParser.js";

const RE_HEADER = /^(#{2,4})\s+(.+?)\s*$/; // ## / ### / #### 헤더
const RE_CAPABILITY = /<!--\s*capability:\s*([A-Za-z0-9_-]+)\s*-->/;
const RE_ATTRS = /\(\s*중요도:\s*(낮음|중간|높음)?\s*,\s*상태:\s*(시작전|진행중|완료|중단)?\s*\)/;

const KIND_BY_LEVEL = { 2: "requirement", 3: "feature", 4: "detail" } as const;

/** 빌드 중 변경 가능한 노드(최종적으로 readonly FeatureTreeNode로 굳힌다). */
interface MutableNode {
  id: string;
  kind: FeatureTreeNode["kind"];
  label: string;
  capability: string;
  priority: FeaturePriority | "";
  status: FeatureStatus | "";
  children: MutableNode[];
}

function makeNode(kind: FeatureTreeNode["kind"], label: string, id: string): MutableNode {
  return { id, kind, label, capability: "", priority: "", status: "", children: [] };
}

/**
 * docs 디렉토리 절대경로 → FeatureTree. `docs/planning/features.md`가 없으면 null(라우트가 404).
 * 예상 밖 헤더 깊이(가장 가까운 상위가 없는 ### 등)는 throw 없이 가장 가까운 조상에 매단다(safe).
 */
export function buildDocsPlanningFeatures(docsDir: string): FeatureTree | null {
  const path = join(docsDir, "planning", "features.md");
  if (!existsSync(path)) return null;

  const lines = readFileSync(path, "utf-8").split(/\r?\n/);
  const root = makeNode("requirement", "root", "feat-root"); // 가상 루트(children=요구사항들)
  // 레벨별 "현재 부모" 스택. stack[2]=현재 요구사항, stack[3]=현재 기능. 루트는 레벨1로 둔다.
  const stack: Record<number, MutableNode> = { 1: root };
  let current: MutableNode | null = null; // 속성/capability를 귀속할 직전 헤더 노드

  for (const line of lines) {
    const h = line.match(RE_HEADER);
    if (h) {
      const level = (h[1] ?? "").length; // 2|3|4
      const label = h[2] ?? "";
      const kind = KIND_BY_LEVEL[level as 2 | 3 | 4];
      // 가장 가까운 상위 부모(없으면 루트). 비정상 깊이도 throw 없이 흡수.
      let parent = root;
      for (let p = level - 1; p >= 1; p--) {
        if (stack[p]) {
          parent = stack[p]!;
          break;
        }
      }
      const id = `${parent.id}__${kind[0]}-${slug(label)}#${parent.children.length}`;
      const node = makeNode(kind, label, id);
      parent.children.push(node);
      stack[level] = node;
      // 더 깊은 레벨 스택 무효화(새 형제가 시작되면 하위 컨텍스트 리셋).
      for (const k of Object.keys(stack)) {
        const lv = Number(k);
        if (lv > level) delete stack[lv];
      }
      current = node;
      continue;
    }
    // 헤더가 아닌 줄: 직전 헤더 노드에 capability/속성 귀속.
    if (!current) continue;
    const cap = line.match(RE_CAPABILITY);
    if (cap && current.kind === "requirement") current.capability = cap[1] ?? "";
    const attr = line.match(RE_ATTRS);
    if (attr) {
      if (attr[1]) current.priority = attr[1] as FeaturePriority;
      if (attr[2]) current.status = attr[2] as FeatureStatus;
    }
  }

  return { root: freeze(root) };
}

/** MutableNode 트리를 readonly FeatureTreeNode로 굳힌다. */
function freeze(n: MutableNode): FeatureTreeNode {
  return {
    id: n.id,
    kind: n.kind,
    label: n.label,
    capability: n.capability,
    priority: n.priority,
    status: n.status,
    children: n.children.map(freeze),
  };
}
