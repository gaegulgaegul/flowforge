/** FeatureTree(shared) → 계층 리스트 데이터(들여쓴 아웃라인). dagre 다이어그램 대체.
 *
 * flowforge-artifact-restructure D1: 기능명세는 순수 계층 트리(children 중첩)라 좌표·엣지가
 * 정보를 안 싣는다 → dagre 좌표계산·RF nodes/edges 생성을 제거하고 트리 평탄화(깊이 포함)로 교체한다.
 * 연결화면 조인(screenRegistry 병합)·audit 배지·연관 change 상속 등 파생 필드는 그대로 유지한다
 * (렌더만 리스트로 바뀌고 data 계약은 불변 — FeatureDetailPanel이 이 data를 그대로 소비).
 *
 * change용 specTreeAdapter와 의도적으로 분리(타입 전략 B, 2026-06-28) — 기획 features 전용 유지.
 * 가상 루트(id='feat-root')는 렌더하지 않고 그 children(요구사항들)부터 평탄화한다. */
import type {
  FeatureTreeNode,
  FeatureTreeNodeKind,
  FeaturePriority,
  FeatureStatus,
  CapabilityAuditSummary,
  ScreenRegistry,
} from "@flowforge/shared";

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
  /** 동작 시나리오 WHEN/THEN(planning-when-then-authoring). 저작된 노드만 채워짐(없으면 undefined). */
  when?: string;
  then?: string;
  /** 생성일(planning-created-date). created 주석 또는 문서 mtime 폴백. 표시 전용. */
  createdAt?: string;
  /**
   * 원본 위치(features.md 헤더 경로) — 조상 라벨들 `[## , ### , ####]`. 트리 구조에서 파생
   * (빌더/타입/골든 무저촉 — server를 안 건드리고 web adapter에서 조상을 수집). 루트(가상)는 제외.
   */
  path: readonly string[];
  /** 자식 노드 요약 목록(상세 패널의 "자식 노드" 섹션용). 트리에서 파생. */
  childRefs: readonly FeatureChildRef[];
  /** 부모 노드 요약(상세 패널의 "상위 노드" 섹션용). 트리에서 파생. 요구사항(최상위)은 undefined. */
  parentRef?: FeatureChildRef;
  /**
   * capability별 audit 배지(planning-feature-audit-badge, D-6) — 요구사항 노드만 채워짐.
   * audit 맵 미제공/빈 맵(fetch 실패·미감사 프로젝트)이면 undefined(배지 없음). web에서 파생.
   */
  audit?: CapabilityAuditSummary;
  /**
   * 상세기능이 연결된 화면(N:M, planning-panel-screen-links) — 상세기능 노드만 채워짐.
   * web에서 파생(레지스트리 링크의 detailLabel 문자열 일치, D-2). 링크 없으면 undefined(D-4).
   */
  screens?: readonly { id: string; label: string }[];
  /**
   * 연관 change 키 목록(flowforge-change-node-mapping, B.1). 서버는 요구사항 노드에만
   * linkedChanges를 채운다 — web이 그 요구사항의 하위 기능/상세기능 전체로 상속시켜 파생한다
   * (요구사항 자신 포함). 연관 change 없으면 필드 자체 없음(undefined, memo/screens와 동형).
   */
  linkedChanges?: readonly string[];
}

/** 평탄화된 리스트 항목(들여쓰기 depth 포함). id는 트리 노드 id, data는 파생 필드까지 실린 노드 data. */
export interface FeatureListItemFlat {
  id: string;
  depth: number;
  data: FeatureNodeData;
}

/** audit 맵에 키가 없는 요구사항 = 미감사(D-6). 배지 "미감사"로 렌더된다. */
const UNAUDITED: CapabilityAuditSummary = {
  status: "unknown",
  pass: 0,
  fail: 0,
  unverifiable: 0,
  failClaims: [],
};

/** 트리를 평탄화: 각 노드 + 노드별 조상 라벨 경로 + 부모 참조 + 들여쓰기 depth를 수집(전달된 노드 자신부터 시작).
 * path는 조상 라벨들의 배열(자기 자신 포함, 루트=요구사항부터). 상세 패널의 "원본 위치"에 쓴다.
 * depth는 리스트 들여쓰기 단계(start 노드=0). */
function flatten(start: FeatureTreeNode): {
  nodes: Array<{ node: FeatureTreeNode; depth: number }>;
  paths: Map<string, string[]>;
  parents: Map<string, FeatureTreeNode>;
} {
  const nodes: Array<{ node: FeatureTreeNode; depth: number }> = [];
  const paths = new Map<string, string[]>();
  const parents = new Map<string, FeatureTreeNode>();
  const walk = (n: FeatureTreeNode, ancestors: readonly string[], depth: number) => {
    const here = [...ancestors, n.label];
    nodes.push({ node: n, depth });
    paths.set(n.id, here);
    for (const c of n.children) {
      parents.set(c.id, n); // 각 요구사항을 독립 flatten하므로 요구사항(start) 자신은 부모 없음(정답).
      walk(c, here, depth + 1);
    }
  };
  walk(start, [], 0);
  return { nodes, paths, parents };
}

/** FeatureTree → 들여쓴 계층 리스트 항목들.
 * root는 가상 루트(id='feat-root')이므로 제외하고 그 children(요구사항들)부터 평탄화한다.
 * 연결화면 조인(screenRegistry)·audit 배지·연관 change 상속은 기존 다이어그램 어댑터와 동일하게 유지. */
export function toFeatureTreeList(
  root: FeatureTreeNode,
  auditByCapability?: Record<string, CapabilityAuditSummary>,
  screenRegistry?: ScreenRegistry,
): FeatureListItemFlat[] {
  // audit 병합 규칙(D-6): 맵 미제공 or 빈 맵 → 전 노드 배지 없음(fetch 실패/미감사 프로젝트).
  // 비어있지 않으면 요구사항 노드만 capability 문자열 완전일치로 조회, 키 없으면 UNAUDITED(미감사).
  const hasAudit = auditByCapability !== undefined && Object.keys(auditByCapability).length > 0;
  // 연결화면 병합 규칙: 상세기능 라벨 문자열 완전일치로 링크 조회(D-2 — 다른 요구사항 아래
  // 같은 라벨은 의도적으로 같은 화면을 공유). 화면 id→label은 한 번만 Map으로 인덱싱하고,
  // 화면목록에 없는 dangling id는 label=id로 노출(D-3 — 숨기지 않음).
  const screenLabelById = new Map<string, string>(
    (screenRegistry?.screens ?? []).map((s) => [s.id, s.label]),
  );
  const screenLinks = screenRegistry?.links ?? [];
  /** 상세기능 노드의 연결화면 목록. 링크 없음(레지스트리 미제공 포함)이면 undefined(빈 배열 아님, D-4). */
  const screensForDetail = (label: string): { id: string; label: string }[] | undefined => {
    const link = screenLinks.find((l) => l.detailLabel === label);
    if (!link || link.screenIds.length === 0) return undefined;
    return link.screenIds.map((id) => ({ id, label: screenLabelById.get(id) ?? id }));
  };
  // 가상 루트는 렌더하지 않는다 — 각 요구사항을 독립 서브트리로 평탄화해 합친다.
  const flat: Array<{ node: FeatureTreeNode; depth: number }> = [];
  const featpaths = new Map<string, string[]>();
  const featparents = new Map<string, FeatureTreeNode>();
  // B.1: 요구사항의 linkedChanges를 그 서브트리 전체(자신+기능+상세기능)로 상속.
  // flatten이 요구사항 단위로 호출되므로, 그 요구사항의 값을 클로저로 서브트리 모든 id에 매핑한다.
  // linkedChanges 없는(undefined) 요구사항의 하위는 매핑 자체를 안 넣는다(상속받을 것 없음).
  const linkedChangesById = new Map<string, readonly string[]>();
  for (const req of root.children) {
    const { nodes, paths, parents } = flatten(req);
    flat.push(...nodes);
    for (const [id, p] of paths) featpaths.set(id, p);
    for (const [id, par] of parents) featparents.set(id, par);
    if (req.linkedChanges !== undefined && req.linkedChanges.length > 0) {
      for (const { node } of nodes) linkedChangesById.set(node.id, req.linkedChanges);
    }
  }

  return flat.map(({ node: n, depth }) => {
    const screens = n.kind === "detail" ? screensForDetail(n.label) : undefined;
    const data: FeatureNodeData = {
      label: n.label,
      kind: n.kind,
      capability: n.capability,
      priority: n.priority,
      status: n.status,
      // memo는 있을 때만 전달(비메모 노드는 undefined → 렌더 무영향).
      ...(n.memo !== undefined ? { memo: n.memo } : {}),
      // when/then도 동일 — 상세 패널이 (when || then)일 때만 ⚡ 시나리오 섹션을 렌더.
      ...(n.when !== undefined ? { when: n.when } : {}),
      ...(n.then !== undefined ? { then: n.then } : {}),
      // 생성일 — 있으면 패널에 표시(폴백 포함이라 대개 채워짐).
      ...(n.createdAt !== undefined ? { createdAt: n.createdAt } : {}),
      // audit 배지 — 요구사항 노드만, 빈 맵/미제공이면 전부 undefined(D-6). 기능/상세기능은 항상 없음.
      ...(hasAudit && n.kind === "requirement" && n.capability !== ""
        ? { audit: auditByCapability?.[n.capability] ?? UNAUDITED }
        : {}),
      // 연결화면 — 상세기능 노드만, 링크 없으면 키 자체를 생략(D-4 — 패널이 섹션을 통째로 생략).
      ...(screens !== undefined ? { screens } : {}),
      // 연관 change(B.1) — 요구사항의 linkedChanges를 서브트리 전체가 상속. 없으면 키 생략.
      ...((): { linkedChanges?: readonly string[] } => {
        const lc = linkedChangesById.get(n.id);
        return lc ? { linkedChanges: lc } : {};
      })(),
      // 상세 패널용 파생 필드(빌더/타입/골든 무저촉 — web에서 트리 구조로만 계산).
      path: featpaths.get(n.id) ?? [n.label],
      childRefs: n.children.map((c) => ({ id: c.id, label: c.label, kind: c.kind })),
      // 부모 노드 요약 — 상위 노드로 전환용. 요구사항(최상위)은 부모 없음 → 섹션 생략.
      ...((): { parentRef?: FeatureChildRef } => {
        const p = featparents.get(n.id);
        return p ? { parentRef: { id: p.id, label: p.label, kind: p.kind } } : {};
      })(),
    };
    return { id: n.id, depth, data };
  });
}
