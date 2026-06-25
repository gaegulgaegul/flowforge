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

/** 한 capability에 연결된 change 목록(미연결이면 빈 배열, 404 아님). */
export async function fetchCapabilityChanges(
  project: string,
  capability: string,
): Promise<ChangeSummary[]> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(project)}/capabilities/${encodeURIComponent(capability)}/changes`,
  );
  if (!res.ok) throw new Error(`capability-changes ${res.status}`);
  const data = (await res.json()) as { changes: ChangeSummary[] };
  return data.changes;
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

export async function saveLayout(id: string, layout: LayoutOverlay): Promise<void> {
  const res = await fetch(`/api/changes/${id}/layout`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(layout),
  });
  if (!res.ok) throw new Error(`layout ${res.status}`);
}
