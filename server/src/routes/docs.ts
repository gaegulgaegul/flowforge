/**
 * docs 라우트 — charter 상주 docs(user-flow.md / PRD.md) 읽기전용 시각화.
 *
 * GET /api/docs/projects               charter 프로젝트(docs/) 목록
 * GET /api/docs/:project/graph         user-flow.md → SpecGraph(shared 계약)
 * GET /api/docs/:project/wireframe     user-flow.md → Wireframe
 * GET /api/docs/:project/prd           PRD.md → decision 타임라인
 * GET /api/docs/:project/planning-prd  planning/prd.md → manyfast 5섹션 PRD (기획 단계 산출물)
 *
 * :project는 슬래시를 포함할 수 있어 와일드카드(*)로 받는다. docs는 SSOT(읽기전용 — 안 쓴다).
 */
import { Router } from "express";
import { listDocsProjects, resolveDocsDir } from "../lib/docs.js";
import { buildDocsGraph, buildDocsWireframe, buildDocsDecisionTimeline } from "../parser/docsAdapter.js";
import { buildDocsPlanningPrd } from "../parser/prdBuilder.js";
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
