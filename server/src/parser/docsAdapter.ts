/**
 * docsAdapter — charter 상주 docs(user-flow.md / PRD.md / wireframe.html) → @flowforge/shared 계약.
 *
 * 기존 change 경로(graphBuilder/wireframeBuilder/prdBuilder)는 손대지 않고, charter docs
 * 입력만 같은 shared 타입(SpecGraph/Wireframe/DecisionTimeline)으로 변환하는 어댑터(additive).
 *
 * 노드 id = "screen-<docsSlug(화면명)>". specParser.slug()는 비영숫자를 전부 '-'로 죽여
 * 한글 전용 화면명(쏙쏙 실데이터)이 모두 'x'로 충돌하므로(검증됨: 9화면→id 1개) 재사용하지 않는다.
 * docsSlug는 한글을 보존하고, 동명 화면은 인덱스로 유일성을 보장한다(ReactFlow는 노드 id 유일 요구).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  GraphNode,
  GraphEdge,
  SpecGraph,
  Wireframe,
  WireScreen,
  WireBox,
  WireBoxKind,
  DecisionTimeline,
} from "@flowforge/shared";
import { parseCharterUserFlow } from "./charterUserFlowParser.js";
import type { CharterScreen } from "./charterUserFlowParser.js";
import { parseCharterPrd } from "./charterPrdParser.js";
import { readDocsFile } from "../lib/docs.js";

/**
 * 화면명 → 안정 slug(한글 보존). 공백류는 '-', URL/마크다운에 위험한 문자만 제거한다.
 * specParser.slug와 달리 한글·CJK를 죽이지 않는다(charter 화면명은 대부분 한글).
 */
function docsSlug(name: string): string {
  const out = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}_-]+/gu, "")
    .replace(/^-+|-+$/g, "");
  return out || "x";
}

/**
 * 화면 목록 → 화면명 → 노드 id 맵(정의 순서). 동명 화면은 두 번째부터 "-2","-3"…으로 유일화.
 * 노드 생성과 goto 대상 매칭이 같은 맵을 공유해야 엣지가 정확히 연결된다.
 */
function buildIdMap(screens: CharterScreen[]): Map<string, string> {
  const idByName = new Map<string, string>();
  const used = new Map<string, number>(); // base slug → 사용 횟수
  for (const s of screens) {
    if (idByName.has(s.name)) continue; // 같은 이름의 화면은 같은 노드로(맵 첫 등장 기준).
    const base = "screen-" + docsSlug(s.name);
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    idByName.set(s.name, n === 0 ? base : `${base}-${n + 1}`);
  }
  return idByName;
}

/**
 * charter_wireframe.py _box_kind 포팅(키워드 → 박스 종류, 순서=우선순위).
 * 원본과 EXACT: list → button(클릭·전송 포함) → empty(기록 없음 포함) → header → field.
 */
function boxKind(text: string): WireBoxKind {
  if (["목록", "리스트", "list"].some((k) => text.includes(k))) return "list";
  if (["버튼", "저장", "촬영", "활성화", "클릭", "전송"].some((k) => text.includes(k))) {
    return "button";
  }
  if (["없음", "빈", "empty", "기록 없음"].some((k) => text.includes(k))) return "empty";
  if (["제목", "title", "헤더", "표시"].some((k) => text.includes(k))) return "header";
  return "field";
}

/** 모든 flow의 화면을 평탄화(정의 순서 보존). */
function allScreens(docsDir: string): { screens: CharterScreen[]; seed: boolean } {
  const raw = readDocsFile(docsDir, "user-flow.md");
  if (raw === null) return { screens: [], seed: false };
  const uf = parseCharterUserFlow(raw);
  const screens: CharterScreen[] = [];
  for (const flow of uf.flows) screens.push(...flow.screens);
  return { screens, seed: uf.seed };
}

/** charter user-flow.md → SpecGraph. 화면=노드, goto=엣지(화면/엔드포인트/dangling). */
export function buildDocsGraph(docsDir: string): SpecGraph {
  const { screens, seed } = allScreens(docsDir);

  // 화면명 → 노드 id (노드 생성·goto 대상 매칭이 공유). 동명 화면은 첫 등장으로 1개 노드.
  const idByName = buildIdMap(screens);
  const seenNodeIds = new Set<string>();

  const nodes: GraphNode[] = [];
  for (const s of screens) {
    const id = idByName.get(s.name)!;
    if (seenNodeIds.has(id)) continue; // 동명 화면 중복 노드 방지(엣지는 같은 id로 연결됨).
    seenNodeIds.add(id);
    const base = { id, kind: "screen" as const, label: s.name, specName: s.name };
    nodes.push(seed ? { ...base, seed: true } : base);
  }

  const edges: GraphEdge[] = [];
  const seenEdgeIds = new Set<string>();
  const pushEdge = (e: GraphEdge): void => {
    if (seenEdgeIds.has(e.id)) return; // 자연 중복 제거(같은 id=같은 엣지).
    seenEdgeIds.add(e.id);
    edges.push(e);
  };

  for (const s of screens) {
    const sourceId = idByName.get(s.name)!;
    for (const g of s.gotos) {
      if (g.kind === "endpoint") {
        const label = `${g.method} ${g.path}`;
        pushEdge({
          id: `${sourceId}->ep:${g.method} ${g.path}`,
          source: sourceId,
          target: null,
          label,
          scenario: s.name,
          dangling: false,
        });
        continue;
      }
      // 화면 goto: 정의된 화면이면 연결, 아니면 dangling.
      const targetId = idByName.get(g.target) ?? null;
      if (targetId) {
        pushEdge({
          id: `${sourceId}->${targetId}`,
          source: sourceId,
          target: targetId,
          label: g.target,
          scenario: s.name,
          dangling: false,
        });
      } else {
        pushEdge({
          id: `${sourceId}->dangling:${g.target}`,
          source: sourceId,
          target: null,
          label: g.target,
          scenario: s.name,
          dangling: true,
        });
      }
    }
  }

  return { nodes, edges };
}

/** charter user-flow.md → Wireframe. 화면=프레임, step=박스. wireframe.html 있으면 originalHtml. */
export function buildDocsWireframe(docsDir: string): Wireframe {
  const { screens, seed } = allScreens(docsDir);
  const idByName = buildIdMap(screens); // graph 노드 id와 동일 키 규칙(같은 화면=같은 id).

  const wireScreens: WireScreen[] = screens.map((s) => {
    const boxes: WireBox[] = s.steps.map((step) => {
      const box = { kind: boxKind(step), label: step, goto: null, dangling: false };
      return seed ? { ...box, seed: true } : box;
    });
    const ws = { id: idByName.get(s.name)!, title: s.name, boxes };
    return seed ? { ...ws, seed: true } : ws;
  });

  const hasHtml = existsSync(join(docsDir, "wireframe.html"));
  return hasHtml ? { screens: wireScreens, originalHtml: true } : { screens: wireScreens };
}

/** charter PRD.md → DecisionTimeline(시간순). PRD.md 없으면 빈 타임라인. */
export function buildDocsDecisionTimeline(docsDir: string): DecisionTimeline {
  const raw = readDocsFile(docsDir, "PRD.md");
  if (raw === null) return { decisions: [] };
  return { decisions: parseCharterPrd(raw).decisions };
}
