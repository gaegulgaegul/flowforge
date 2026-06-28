/**
 * docs 라우트 — charter 상주 docs(user-flow.md / PRD.md) 읽기전용 시각화.
 *
 * GET /api/docs/projects               charter 프로젝트(docs/) 목록
 * GET /api/docs/:project/graph         user-flow.md → SpecGraph(shared 계약)
 * GET /api/docs/:project/wireframe     user-flow.md → Wireframe
 * GET /api/docs/:project/prd           PRD.md → decision 타임라인
 * GET /api/docs/:project/planning-prd       planning/prd.md → manyfast 5섹션 PRD (기획 단계 산출물)
 * GET /api/docs/:project/planning-features        planning/features.md → 기능명세 3단 트리(FeatureTree)
 * GET /api/docs/:project/planning-user-flow        planning/user-flow/<flow>.md(Mermaid) → SpecGraph + layout + versions
 * PUT /api/docs/:project/planning-user-flow/layout 드래그 좌표 저장(docs 첫 쓰기 — overlay JSON만)
 *
 * :project는 슬래시를 포함할 수 있어 와일드카드(*)로 받는다. docs는 SSOT(읽기전용 — 안 쓴다).
 */
import { Router } from "express";
import { buildDocsGraph, buildDocsWireframe, buildDocsDecisionTimeline } from "../parser/docsAdapter.js";
import { buildDocsPlanningPrd } from "../parser/prdBuilder.js";
import { buildDocsPlanningFeatures } from "../parser/featureTreeBuilder.js";
import { buildDocsPlanningUserFlow } from "../parser/planningUserFlowBuilder.js";
import {
  listDocsProjects,
  resolveDocsDir,
  listDocsUserFlows,
  readDocsUserFlowOverlay,
  writeDocsUserFlowOverlay,
} from "../lib/docs.js";
import { isLayoutOverlay } from "../lib/changes.js";
import { safe } from "../lib/safe-error.js";

export const docsRouter = Router();

docsRouter.get(
  "/api/docs/projects",
  safe(async (_req, res) => {
    res.json({ projects: listDocsProjects() });
  }),
);

docsRouter.get(
  "/api/docs/:project(*)/graph",
  safe(async (req, res) => {
    const project = String(req.params.project ?? "");
    const dir = resolveDocsDir(project);
    if (!dir) {
      res.status(404).json({ error: "docs_not_found" });
      return;
    }
    res.json({ project, graph: buildDocsGraph(dir) });
  }),
);

docsRouter.get(
  "/api/docs/:project(*)/wireframe",
  safe(async (req, res) => {
    const project = String(req.params.project ?? "");
    const dir = resolveDocsDir(project);
    if (!dir) {
      res.status(404).json({ error: "docs_not_found" });
      return;
    }
    res.json({ project, wireframe: buildDocsWireframe(dir) });
  }),
);

docsRouter.get(
  "/api/docs/:project(*)/prd",
  safe(async (req, res) => {
    const project = String(req.params.project ?? "");
    const dir = resolveDocsDir(project);
    if (!dir) {
      res.status(404).json({ error: "docs_not_found" });
      return;
    }
    res.json({ project, timeline: buildDocsDecisionTimeline(dir) });
  }),
);

docsRouter.get(
  "/api/docs/:project(*)/planning-prd",
  safe(async (req, res) => {
    const project = String(req.params.project ?? "");
    const dir = resolveDocsDir(project);
    if (!dir) {
      res.status(404).json({ error: "docs_not_found" });
      return;
    }
    const prd = buildDocsPlanningPrd(dir);
    if (!prd) {
      res.status(404).json({ error: "planning_prd_not_found" });
      return;
    }
    res.json({ project, prd });
  }),
);

docsRouter.get(
  "/api/docs/:project(*)/planning-features",
  safe(async (req, res) => {
    const project = String(req.params.project ?? "");
    const dir = resolveDocsDir(project);
    if (!dir) {
      res.status(404).json({ error: "docs_not_found" });
      return;
    }
    const tree = buildDocsPlanningFeatures(dir);
    if (!tree) {
      res.status(404).json({ error: "planning_features_not_found" });
      return;
    }
    res.json({ project, tree });
  }),
);

docsRouter.get(
  "/api/docs/:project(*)/planning-user-flow",
  safe(async (req, res) => {
    const project = String(req.params.project ?? "");
    const dir = resolveDocsDir(project);
    if (!dir) {
      res.status(404).json({ error: "docs_not_found" });
      return;
    }
    const versions = listDocsUserFlows(dir);
    // flow 미지정이면 첫 버전. 버전 자체가 없으면 404.
    const flow = String(req.query.flow ?? versions[0] ?? "");
    const graph = flow ? buildDocsPlanningUserFlow(dir, flow) : null;
    if (!graph) {
      res.status(404).json({ error: "planning_user_flow_not_found" });
      return;
    }
    const layout = readDocsUserFlowOverlay(dir, flow) ?? {};
    res.json({ project, flow, graph, layout, versions });
  }),
);

docsRouter.put(
  "/api/docs/:project(*)/planning-user-flow/layout",
  safe(async (req, res) => {
    const project = String(req.params.project ?? "");
    const dir = resolveDocsDir(project);
    if (!dir) {
      res.status(404).json({ error: "docs_not_found" });
      return;
    }
    const flow = String(req.query.flow ?? "");
    const body: unknown = req.body;
    if (!isLayoutOverlay(body)) {
      res.status(400).json({ error: "invalid_layout" });
      return;
    }
    // 명세 .md는 안 건드림 — overlay JSON만 쓴다. 토큰 부정이면 writeDocs…가 false.
    if (!writeDocsUserFlowOverlay(dir, flow, body)) {
      res.status(400).json({ error: "invalid_flow" });
      return;
    }
    res.json({ ok: true, saved: Object.keys(body).length });
  }),
);
