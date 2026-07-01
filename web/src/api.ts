/** flowforge API 클라이언트 (dev: vite 프록시 /api → :8811) */
import type {
  SpecGraph,
  LayoutOverlay,
  IANode,
  Wireframe,
  Prd,
  SpecTreeNode,
  DecisionTimeline,
  ProjectCard,
  FeatureTree,
  PrdSuggestionQueue,
  PrdApplyRequest,
  PrdApplyResult,
} from "@flowforge/shared";

export interface GraphResponse {
  id: string;
  graph: SpecGraph;
  layout: LayoutOverlay;
}

export interface IAResponse {
  id: string;
  tree: IANode;
}

export interface WireframeResponse {
  id: string;
  wireframe: Wireframe;
}

export interface PrdResponse {
  id: string;
  prd: Prd;
}

export interface SpecTreeResponse {
  id: string;
  tree: SpecTreeNode;
}

export async function fetchChanges(): Promise<string[]> {
  const res = await fetch("/api/changes");
  if (!res.ok) throw new Error(`changes ${res.status}`);
  const data = (await res.json()) as { changes: string[] };
  return data.changes;
}

// ─── 계층형 대시보드 (hierarchical-project-dashboard) ───
// 표시명은 한글(displayName/koreanLabel), 연결·라우팅 키는 영문(name/key) — 분리 유지.

/** 한 capability 노드(뼈대 그래프용): 영문 key + 한글 koreanLabel + 연결된 change 키 목록. */
export interface CapabilitySummary {
  key: string;
  koreanLabel: string;
  changeKeys: string[];
}

/** capability에 속한 change 한 줄: 영문 key + 한글 displayName(proposal 제목 폴백=key). */
export interface ChangeSummary {
  key: string;
  displayName: string;
}

/** 홈 랜딩: change 있는 모든 프로젝트 카드(charter 유무 무관). */
export async function fetchProjects(): Promise<ProjectCard[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) throw new Error(`projects ${res.status}`);
  const data = (await res.json()) as { projects: ProjectCard[] };
  return data.projects;
}

/** 한 프로젝트의 charter 뼈대 capability 목록(한글명 + 연결 change). */
export async function fetchCapabilities(project: string): Promise<CapabilitySummary[]> {
  const res = await fetch(`/api/projects/${encodeURIComponent(project)}/capabilities`);
  if (!res.ok) throw new Error(`capabilities ${res.status}`);
  const data = (await res.json()) as { capabilities: CapabilitySummary[] };
  return data.capabilities;
}

/**
 * 한 capability 단위 종합 상세 — features 서브트리 + 연결 유저플로우 stem + 건드리는 change 목록.
 * 연결 0개여도 빈 구조로 200(404 아님). features는 features.md 없으면 null.
 */
export interface CapabilityDetailResponse {
  project: string;
  key: string;
  koreanLabel: string;
  features: FeatureTree | null;
  userFlows: string[];
  changes: ChangeSummary[];
}

export async function fetchCapabilityDetail(
  project: string,
  capability: string,
): Promise<CapabilityDetailResponse> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(project)}/capabilities/${encodeURIComponent(capability)}`,
  );
  if (!res.ok) throw new Error(`capability-detail ${res.status}`);
  return (await res.json()) as CapabilityDetailResponse;
}

export async function fetchGraph(id: string): Promise<GraphResponse> {
  const res = await fetch(`/api/changes/${id}/graph`);
  if (!res.ok) throw new Error(`graph ${res.status}`);
  return (await res.json()) as GraphResponse;
}

export async function fetchIA(id: string): Promise<IAResponse> {
  const res = await fetch(`/api/changes/${id}/ia`);
  if (!res.ok) throw new Error(`ia ${res.status}`);
  return (await res.json()) as IAResponse;
}

export async function fetchWireframe(id: string): Promise<WireframeResponse> {
  const res = await fetch(`/api/changes/${id}/wireframe`);
  if (!res.ok) throw new Error(`wireframe ${res.status}`);
  return (await res.json()) as WireframeResponse;
}

export async function fetchPrd(id: string): Promise<PrdResponse> {
  const res = await fetch(`/api/changes/${id}/prd`);
  if (!res.ok) throw new Error(`prd ${res.status}`);
  return (await res.json()) as PrdResponse;
}

export async function fetchSpecTree(id: string): Promise<SpecTreeResponse> {
  const res = await fetch(`/api/changes/${id}/spec-tree`);
  if (!res.ok) throw new Error(`spec-tree ${res.status}`);
  return (await res.json()) as SpecTreeResponse;
}

export interface DocsProjectsResponse {
  projects: string[];
}

export async function fetchDocsProjects(): Promise<string[]> {
  const res = await fetch("/api/docs/projects");
  if (!res.ok) throw new Error(`docs projects ${res.status}`);
  const data = (await res.json()) as DocsProjectsResponse;
  return data.projects;
}

export async function fetchDocsGraph(project: string): Promise<{ project: string; graph: SpecGraph }> {
  const res = await fetch(`/api/docs/${project}/graph`);
  if (!res.ok) throw new Error(`docs graph ${res.status}`);
  return (await res.json()) as { project: string; graph: SpecGraph };
}

export async function fetchDocsWireframe(project: string): Promise<{ project: string; wireframe: Wireframe }> {
  const res = await fetch(`/api/docs/${project}/wireframe`);
  if (!res.ok) throw new Error(`docs wireframe ${res.status}`);
  return (await res.json()) as { project: string; wireframe: Wireframe };
}

export async function fetchDocsPrd(project: string): Promise<{ project: string; timeline: DecisionTimeline }> {
  const res = await fetch(`/api/docs/${project}/prd`);
  if (!res.ok) throw new Error(`docs prd ${res.status}`);
  return (await res.json()) as { project: string; timeline: DecisionTimeline };
}

/** 기획 단계 산출물 docs/planning/prd.md → manyfast 5섹션 PRD(기존 PrdPanel로 렌더). */
export async function fetchDocsPlanningPrd(project: string): Promise<{ project: string; prd: Prd }> {
  const res = await fetch(`/api/docs/${project}/planning-prd`);
  if (!res.ok) throw new Error(`docs planning-prd ${res.status}`);
  return (await res.json()) as { project: string; prd: Prd };
}

/** PRD 제안 큐 읽기(docs/planning/prd.suggestions.json). 큐 없으면 빈 큐(version:1, suggestions:[]). */
export async function fetchDocsPrdSuggestions(
  project: string,
): Promise<{ project: string; queue: PrdSuggestionQueue }> {
  const res = await fetch(`/api/docs/${project}/planning-prd-suggestions`);
  if (!res.ok) throw new Error(`prd-suggestions ${res.status}`);
  return (await res.json()) as { project: string; queue: PrdSuggestionQueue };
}

/** PRD 제안 승인/반려 적용. 승인분만 prd.md 반영, 반려는 큐에서만 제거. */
export async function applyDocsPrdSuggestions(
  project: string,
  req: PrdApplyRequest,
): Promise<PrdApplyResult> {
  const res = await fetch(`/api/docs/${project}/planning-prd-suggestions/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    // 422(prd_write_failed) = prd.md 형식이 예상과 달라 반영 못 함(원본·큐 보존). 원인을 명확히 전달.
    if (res.status === 422) {
      throw new Error("prd.md 형식이 예상과 달라 반영하지 못했습니다(원본·큐는 보존됨).");
    }
    throw new Error(`prd-apply ${res.status}`);
  }
  return (await res.json()) as PrdApplyResult;
}

/** 기획 단계 산출물 docs/planning/features.md → 기능명세 3단 트리(FeatureTree, 전용 렌더). */
export async function fetchDocsPlanningFeatures(
  project: string,
): Promise<{ project: string; tree: FeatureTree }> {
  const res = await fetch(`/api/docs/${project}/planning-features`);
  if (!res.ok) throw new Error(`docs planning-features ${res.status}`);
  return (await res.json()) as { project: string; tree: FeatureTree };
}

export async function saveLayout(id: string, layout: LayoutOverlay): Promise<void> {
  const res = await fetch(`/api/changes/${id}/layout`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(layout),
  });
  if (!res.ok) throw new Error(`layout ${res.status}`);
}

/** 기획 단계 산출물 docs/planning/user-flow/<flow>.md(Mermaid) → 공용 SpecGraph + 저장 좌표(layout) + 버전 목록. */
export interface DocsPlanningUserFlowResponse {
  project: string;
  flow: string;
  graph: SpecGraph;
  layout: LayoutOverlay;
  versions: string[];
}

export async function fetchDocsPlanningUserFlow(
  project: string,
  flow?: string,
): Promise<DocsPlanningUserFlowResponse> {
  const qs = flow ? `?flow=${encodeURIComponent(flow)}` : "";
  const res = await fetch(`/api/docs/${project}/planning-user-flow${qs}`);
  if (!res.ok) throw new Error(`docs planning-user-flow ${res.status}`);
  return (await res.json()) as DocsPlanningUserFlowResponse;
}

/** 기획 유저플로우 드래그 좌표 저장(명세 .md는 안 건드림 — overlay JSON만). */
export async function saveDocsPlanningUserFlowLayout(
  project: string,
  flow: string,
  layout: LayoutOverlay,
): Promise<void> {
  const res = await fetch(
    `/api/docs/${project}/planning-user-flow/layout?flow=${encodeURIComponent(flow)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(layout),
    },
  );
  if (!res.ok) throw new Error(`docs planning-user-flow layout ${res.status}`);
}
