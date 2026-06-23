/** flowforge API 클라이언트 (dev: vite 프록시 /api → :8811) */
import type { SpecGraph, LayoutOverlay, IANode, Wireframe } from "@flowforge/shared";

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

export async function fetchChanges(): Promise<string[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) throw new Error(`projects ${res.status}`);
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

export async function saveLayout(id: string, layout: LayoutOverlay): Promise<void> {
  const res = await fetch(`/api/changes/${id}/layout`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(layout),
  });
  if (!res.ok) throw new Error(`layout ${res.status}`);
}
