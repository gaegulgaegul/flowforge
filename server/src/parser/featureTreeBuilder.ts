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
// 경량 아이템 메모(capability: lightweight-item-memo). 노드 헤더 아래 `<!-- memo: 한 줄 -->`.
// capability 주석과 네임스페이스가 겹치지 않도록 `memo:` 접두어를 명시적으로 요구하고,
// 캡처는 `-->` 직전까지의 임의 한 줄 텍스트(trim은 아래에서). 모든 kind에 붙일 수 있다.
const RE_MEMO = /<!--\s*memo:\s*(.*?)\s*-->/;
// 동작 시나리오 WHEN/THEN(planning-when-then-authoring). RE_MEMO 동형 — 노드 헤더 아래
// `<!-- when: 한 줄 -->` `<!-- then: 한 줄 -->`. 접두어 명시로 capability/memo와 네임스페이스
// 분리, 한 노드에 각 최대 1개(뒤 매치가 덮어쓰지 않도록 아래에서 첫 매치만 채택, D-1).
const RE_WHEN = /<!--\s*when:\s*(.*?)\s*-->/;
const RE_THEN = /<!--\s*then:\s*(.*?)\s*-->/;
// 속성은 줄 전체가 `(중요도:…, 상태:…)`인 속성 줄에서만 인식한다(^…$ 앵커). 본문 산문 중간에
// 같은 패턴이 들어가도 오매칭하지 않도록 줄 시작·끝에 고정(review CONCERN 2026-06-28).
const RE_ATTRS = /^\s*\(\s*중요도:\s*(낮음|중간|높음)?\s*,\s*상태:\s*(시작전|진행중|완료|중단)?\s*\)\s*$/;

const KIND_BY_LEVEL = { 2: "requirement", 3: "feature", 4: "detail" } as const;

/** 빌드 중 변경 가능한 노드(최종적으로 readonly FeatureTreeNode로 굳힌다). */
interface MutableNode {
  id: string;
  kind: FeatureTreeNode["kind"];
  label: string;
  capability: string;
  priority: FeaturePriority | "";
  status: FeatureStatus | "";
  /** 경량 아이템 메모(없으면 undefined → freeze 시 필드 자체 생략, 비파괴). */
  memo?: string;
  /** 동작 시나리오 트리거/기대결과(없으면 undefined → freeze 시 생략, memo 동형). */
  when?: string;
  then?: string;
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
  return buildFeatureTreeFromLines(lines);
}

/**
 * features.md 라인 배열 → FeatureTree. 파일 IO 없이 in-memory 라인만 파싱한다.
 * 6b self-roundtrip 검증이 "아직 안 쓴 새 라인"을 디스크 왕복 없이 재파싱하려고 분리했다.
 * buildDocsPlanningFeatures는 파일을 읽어 이 함수에 위임하는 얇은 래퍼.
 */
export function buildFeatureTreeFromLines(lines: readonly string[]): FeatureTree {
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
    // 경량 아이템 메모: 헤더 직후 컨텍스트의 직전 헤더 노드에 귀속한다(모든 kind).
    // capability 주석보다 뒤에서 매칭하므로 `<!-- capability: -->`를 삼키지 않는다(접두어 분리).
    // 빈 메모(`<!-- memo:  -->`)는 무시해 빈 필드 노이즈를 막는다.
    const memo = line.match(RE_MEMO);
    if (memo && memo[1]) current.memo = memo[1];
    // 동작 시나리오 WHEN/THEN: memo와 동일 귀속 규칙(직전 헤더 노드·모든 kind·빈 값 무시).
    // 한 노드에 각 최대 1개 — 첫 매치만 채택하고 뒤 매치는 무시한다(D-1).
    const when = line.match(RE_WHEN);
    if (when && when[1] && current.when === undefined) current.when = when[1];
    const then = line.match(RE_THEN);
    if (then && then[1] && current.then === undefined) current.then = then[1];
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
    // memo는 있을 때만 실어 비메모 노드의 형태를 바꾸지 않는다(옵셔널·비파괴).
    ...(n.memo !== undefined ? { memo: n.memo } : {}),
    // when/then도 동일(옵셔널·비파괴 — 한쪽만 있어도 그쪽만 싣는다).
    ...(n.when !== undefined ? { when: n.when } : {}),
    ...(n.then !== undefined ? { then: n.then } : {}),
    children: n.children.map(freeze),
  };
}
