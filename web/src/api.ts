/** flowforge API 클라이언트 (dev: vite 프록시 /api → :8811) */
import type {
  SpecGraph,
  LayoutOverlay,
  IANode,
  Wireframe,
  Prd,
  SpecTreeNode,
  DecisionTimeline,
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
