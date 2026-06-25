/**
 * graph 라우트 — change 목록 / 그래프·IA·와이어·PRD·기능명세서(파서) / 레이아웃 오버레이 저장
 *
 * GET  /api/changes                change id 목록(과거 /api/projects — 대시보드가 그 경로를 점유해 이동)
 * GET  /api/changes/:id/graph      spec.md 파싱 → SpecGraph(shared 계약) + 레이아웃 머지
 * GET  /api/changes/:id/ia         IA 트리
 * GET  /api/changes/:id/wireframe  와이어프레임
 * GET  /api/changes/:id/prd        proposal+design → PRD 5섹션(읽기전용 파생)
 * GET  /api/changes/:id/spec-tree  기능명세서 3단 트리(읽기전용 파생)
 * PUT  /api/changes/:id/layout     레이아웃 오버레이 저장(spec.md는 SSOT, 안 건드림)
 *
 * :id는 'archive/<name>' 형태도 허용하므로 와일드카드(*)로 받는다.
 */
import { Router } from "express";
import type { GraphNode, GraphEdge, SpecGraph, LayoutOverlay } from "@flowforge/shared";
import { buildGraph } from "../parser/graphBuilder.js";
import { buildIATree } from "../parser/iaBuilder.js";
import { buildWireframe } from "../parser/wireframeBuilder.js";
import { buildPrd } from "../parser/prdBuilder.js";
import { buildSpecTree } from "../parser/specTreeBuilder.js";
import { listChanges, resolveChangeDir, readOverlay, writeOverlay } from "../lib/changes.js";
import { safe } from "../lib/safe-error.js";

export const graphRouter = Router();

/** graphBuilder 내부 형식 → shared SpecGraph 계약으로 변환 */
function toSpecGraph(changeDir: string): SpecGraph {
  const g = buildGraph(changeDir);
  const nodes: GraphNode[] = g.nodes.map((n) => ({
    id: n.id,
    kind: "screen",
    label: n.name,
    specName: n.name,
  }));
  const edges: GraphEdge[] = g.edges.map((e, i) => ({
    id: `${e.from}->${e.to}#${i}`,
    source: e.from,
    target: e.dangling ? null : e.to,
    label: e.hint,
    scenario: e.scenario,
    dangling: e.dangling,
  }));
  return { nodes, edges };
}

// 전체 change 목록(archive 포함). 과거엔 /api/projects였으나 hierarchical-project-dashboard
// 의 카드 그리드가 /api/projects를 점유하면서 의미에 맞게 /api/changes로 이동.
graphRouter.get(
  "/api/changes",
  safe(async (_req, res) => {
    res.json({ changes: listChanges() });
  }),
);

graphRouter.get(
  "/api/changes/:id(*)/graph",
  safe(async (req, res) => {
    const id = String(req.params.id ?? "");
    const dir = resolveChangeDir(id);
    if (!dir) {
      res.status(404).json({ error: "change_not_found" });
      return;
    }
    const graph = toSpecGraph(dir);
    const layout = readOverlay(dir) ?? {};
    res.json({ id, graph, layout });
  }),
);

graphRouter.get(
  "/api/changes/:id(*)/ia",
  safe(async (req, res) => {
    const id = String(req.params.id ?? "");
    const dir = resolveChangeDir(id);
    if (!dir) {
      res.status(404).json({ error: "change_not_found" });
      return;
    }
    res.json({ id, tree: buildIATree(dir).root });
  }),
);

graphRouter.get(
  "/api/changes/:id(*)/wireframe",
  safe(async (req, res) => {
    const id = String(req.params.id ?? "");
    const dir = resolveChangeDir(id);
    if (!dir) {
      res.status(404).json({ error: "change_not_found" });
      return;
    }
    res.json({ id, wireframe: buildWireframe(dir) });
  }),
);

graphRouter.get(
  "/api/changes/:id(*)/prd",
  safe(async (req, res) => {
    const id = String(req.params.id ?? "");
    const dir = resolveChangeDir(id);
    if (!dir) {
      res.status(404).json({ error: "change_not_found" });
      return;
    }
    res.json({ id, prd: buildPrd(dir) });
  }),
);

graphRouter.get(
  "/api/changes/:id(*)/spec-tree",
  safe(async (req, res) => {
    const id = String(req.params.id ?? "");
    const dir = resolveChangeDir(id);
    if (!dir) {
      res.status(404).json({ error: "change_not_found" });
      return;
    }
    res.json({ id, tree: buildSpecTree(dir).root });
  }),
);

graphRouter.put(
  "/api/changes/:id(*)/layout",
  safe(async (req, res) => {
    const id = String(req.params.id ?? "");
    const dir = resolveChangeDir(id);
    if (!dir) {
      res.status(404).json({ error: "change_not_found" });
      return;
    }
    const body: unknown = req.body;
    if (!isLayoutOverlay(body)) {
      res.status(400).json({ error: "invalid_layout" });
      return;
    }
    writeOverlay(dir, body);
    res.json({ ok: true, saved: Object.keys(body).length });
  }),
);

/** 런타임 검증: {nodeId: {x:number, y:number}} 형태 */
function isLayoutOverlay(v: unknown): v is LayoutOverlay {
  if (typeof v !== "object" || v === null) return false;
  for (const val of Object.values(v as Record<string, unknown>)) {
    if (typeof val !== "object" || val === null) return false;
    const p = val as Record<string, unknown>;
    if (typeof p["x"] !== "number" || typeof p["y"] !== "number") return false;
  }
  return true;
}
