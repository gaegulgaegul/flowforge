/**
 * planningIaBuilder — 화면 레지스트리(ScreenRegistry) → 기획 정보구조(IA) 트리(IATree 재사용).
 *
 * 화면(페이지)을 IA 부모 노드로, 그 화면에 N:M으로 연결된 상세기능을 자식으로 배치한다
 * (링크의 역방향 인덱스: screenId → [detailLabel...]). 세 뷰(유저플로우·와이어·IA)가 같은 화면
 * 노드를 공유하는 예광탄의 IA 쪽 투영이다.
 *
 * 기존 iaBuilder.ts(change용 specs/ → IA)는 무수정 — 이건 planning/features.md 화면 경로의 병렬 빌더.
 * shared IATree 타입을 그대로 재사용해 web의 toIAFlow·IANode 렌더를 공짜로 얻는다.
 *
 * IA 노드 kind 매핑(기존 3종 재사용):
 *   change=루트(=화면목록 컨테이너), capability=화면(부모), requirement=상세기능(자식).
 *   (kind는 IANode 렌더의 색/태그 토큰일 뿐 — 화면=capability 팔레트, 상세기능=requirement 팔레트.)
 */
import type { ScreenRegistry, IANode, IATree } from "@flowforge/shared";
import { buildScreenRegistry } from "./screenRegistry.js";
import { slug } from "./specParser.js";

const ROOT_LABEL = "화면목록";

/**
 * docs 디렉토리 절대경로 → 기획 IA 트리. features.md 없으면 null(라우트가 404).
 * 화면이 하나도 없으면 빈 children 루트(정상 — 아직 화면 미정의).
 */
export function buildPlanningIaTree(docsDir: string): IATree | null {
  const registry = buildScreenRegistry(docsDir);
  if (!registry) return null;
  return buildPlanningIaTreeFromRegistry(registry);
}

/** ScreenRegistry → IATree. 파일 IO 없이 순수 변환(테스트 용이). */
export function buildPlanningIaTreeFromRegistry(registry: ScreenRegistry): IATree {
  // 역방향 인덱스: screenId → 연결된 상세기능 라벨 목록(등장 순서 보존, 중복 제거).
  const detailsByScreen = new Map<string, string[]>();
  for (const screen of registry.screens) detailsByScreen.set(screen.id, []);
  for (const link of registry.links) {
    for (const sid of link.screenIds) {
      const bucket = detailsByScreen.get(sid);
      // 정의되지 않은 화면 id를 참조하는 링크는 조용히 무시(레지스트리에 없는 화면엔 안 매단다).
      if (bucket && !bucket.includes(link.detailLabel)) bucket.push(link.detailLabel);
    }
  }

  const screenNodes: IANode[] = registry.screens.map((screen) => {
    const details = detailsByScreen.get(screen.id) ?? [];
    const children: IANode[] = details.map((detailLabel, i) => ({
      id: `screen-${slug(screen.id)}__detail-${slug(detailLabel)}#${i}`,
      kind: "requirement" as const,
      label: detailLabel,
      detail: "",
      scenarioCount: 0,
      children: [],
    }));
    return {
      id: `screen-${slug(screen.id)}`,
      kind: "capability" as const, // 화면=부모 노드(capability 팔레트로 렌더)
      label: screen.label,
      detail: "",
      // 배지 = 이 화면에 연결된 상세기능 수(N:M 연결 카운트).
      scenarioCount: children.length,
      children,
    };
  });

  const root: IANode = {
    id: "planning-ia-root",
    kind: "change",
    label: ROOT_LABEL,
    detail: "",
    scenarioCount: screenNodes.reduce((n, s) => n + s.scenarioCount, 0),
    children: screenNodes,
  };
  return { root };
}
