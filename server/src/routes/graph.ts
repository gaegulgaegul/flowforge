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
import { join } from "node:path";
import { Router } from "express";
import type { Request } from "express";
import type { GraphNode, GraphEdge, SpecGraph, LayoutOverlay } from "@flowforge/shared";
import { buildGraph } from "../parser/graphBuilder.js";
import { buildIATree } from "../parser/iaBuilder.js";
import { buildWireframe } from "../parser/wireframeBuilder.js";
import { buildPrd } from "../parser/prdBuilder.js";
import { buildSpecTree } from "../parser/specTreeBuilder.js";
import { listChanges, resolveChangeDir, readOverlay, writeOverlay, isLayoutOverlay } from "../lib/changes.js";
import { resolveProjectDir } from "../lib/projects.js";
import { safe } from "../lib/safe-error.js";

export const graphRouter = Router();

/**
 * 요청에서 change 디렉토리를 해석한다 (선택적 크로스프로젝트).
 * - ?project= 없음 → 현행 글로벌 루트(changesRoot) 기준 — 하위호환.
 * - ?project= 있음+화이트리스트 통과 → 그 프로젝트의 openspec/changes 기준.
 * - ?project= 있음+검증 실패(미지·조작·심링크) → null(라우트가 404, 루트 밖 접근 없음).
 * 실패는 전부 null로 수렴 → 호출부가 404로 처리.
 */
function resolveChangeFromReq(req: Request): string | null {
  const id = String(req.params.id ?? "");
  const project = req.query.project;
  if (project === undefined) return resolveChangeDir(id); // 글로벌 루트(현행)
  if (typeof project !== "string") return null; // 배열 등 이상 쿼리는 차단
  const projDir = resolveProjectDir(project);
  if (projDir === null) return null; // 화이트리스트 실패 → 404
  return resolveChangeDir(id, join(projDir, "openspec", "changes"));
}

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
    const dir = resolveChangeFromReq(req);
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
    const dir = resolveChangeFromReq(req);
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
    const dir = resolveChangeFromReq(req);
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
    const dir = resolveChangeFromReq(req);
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
    const dir = resolveChangeFromReq(req);
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
    const dir = resolveChangeFromReq(req);
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
