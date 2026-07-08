/**
 * planningWireframeBuilder — 화면 레지스트리(ScreenRegistry, 화면+요소) → planning 와이어프레임(Wireframe).
 *
 * 화면 → `WireScreen{id,title,boxes}`, 요소 → `WireBox{kind,label,goto}`. goto = 요소의 screen(이동
 * 화면 id)을 WireScreen id(screen-<slug>)로 해석(정의된 화면일 때만, 없으면 null). 세 뷰(유저플로우·
 * IA·와이어)가 같은 화면 노드 id 규칙(screen-<slug>)을 공유해 1:1 대응한다.
 *
 * change 경로 buildWireframe(specs/ → THEN 판정)은 무수정 — 이건 planning/features.md 화면 경로의
 * 병렬 빌더(planningIaBuilder 동형). shared Wireframe 타입을 그대로 재사용해 WireframePanel 렌더를
 * 공짜로 얻는다(신규 렌더 UI 0). 요소↔상세기능(detail) 매핑은 web 상세용 별도 소비 — WireBox는 goto만.
 */
import type { Wireframe, WireScreen, WireBox, WireBoxKind, ScreenRegistry } from "@flowforge/shared";
import { buildScreenRegistry } from "./screenRegistry.js";
import { slug } from "./specParser.js";

const KINDS: readonly WireBoxKind[] = ["header", "list", "button", "field", "empty"];

/** 요소 kind 문자열을 WireBoxKind 5종으로 좁힌다(미지원 값은 field로 폴백 — 렌더 안전). */
function toBoxKind(kind: string): WireBoxKind {
  return (KINDS as readonly string[]).includes(kind) ? (kind as WireBoxKind) : "field";
}

/**
 * docs 디렉토리 절대경로 → planning 와이어프레임. features.md 없으면 null(라우트가 404).
 * 화면이 하나도 없으면 빈 screens(정상 — 아직 화면 미정의).
 */
export function buildDocsPlanningWireframe(docsDir: string): Wireframe | null {
  const registry = buildScreenRegistry(docsDir);
  if (!registry) return null;
  return buildPlanningWireframeFromRegistry(registry);
}

/** ScreenRegistry → Wireframe. 파일 IO 없이 순수 변환(테스트 용이). */
export function buildPlanningWireframeFromRegistry(registry: ScreenRegistry): Wireframe {
  // 정의된 화면 id 집합 → goto 해석 시 미정의 화면(dangling 아님)은 조용히 null.
  const knownScreenIds = new Set(registry.screens.map((s) => s.id));

  const screens: WireScreen[] = registry.screens.map((screen) => {
    const boxes: WireBox[] = (screen.elements ?? []).map((el) => {
      // goto = 이동 화면이 레지스트리에 있으면 그 WireScreen id, 없으면 null(지어내지 않음).
      const goto = el.screen && knownScreenIds.has(el.screen) ? "screen-" + slug(el.screen) : null;
      return { kind: toBoxKind(el.kind), label: el.label, goto, dangling: false };
    });
    return { id: "screen-" + slug(screen.id), title: screen.label, boxes };
  });

  return { screens };
}
