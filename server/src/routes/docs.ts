/**
 * docs 라우트 — charter 상주 docs(user-flow.md / PRD.md) 읽기전용 시각화.
 *
 * GET /api/docs/projects               charter 프로젝트(docs/) 목록
 * GET /api/docs/:project/graph         user-flow.md → SpecGraph(shared 계약)
 * GET /api/docs/:project/wireframe     user-flow.md → Wireframe
 * GET /api/docs/:project/prd           PRD.md → decision 타임라인
 * GET /api/docs/:project/planning-prd       planning/prd.md → manyfast 5섹션 PRD (기획 단계 산출물)
 * GET /api/docs/:project/planning-features        planning/features.md → 기능명세 3단 트리(FeatureTree)
 * GET /api/docs/:project/audit-capabilities       docs/audit.json items[] → capability 단위 집계 맵(없으면 빈 맵 200)
 * GET /api/docs/:project/planning-user-flow        planning/user-flow/<flow>.md(Mermaid) → SpecGraph + layout + versions
 * PUT /api/docs/:project/planning-user-flow/layout 드래그 좌표 저장(docs 첫 쓰기 — overlay JSON만)
 * GET /api/docs/:project/planning-prd-suggestions       PRD 제안 큐 읽기(없으면 빈 큐 200)
 * POST /api/docs/:project/planning-prd-suggestions/apply 승인·반려 적용(승인분만 prd.md 반영)
 * GET /api/docs/:project/planning-features-suggestions       features 제안 큐 읽기(없으면 빈 큐 200)
 * POST /api/docs/:project/planning-features-suggestions/apply 승인·반려 적용(승인분만 features.md 속성 반영)
 * GET /api/docs/:project/planning-user-flow-suggestions?flow=<stem>       유저플로우 에지 제안 큐 읽기(없으면 빈 큐 200)
 * POST /api/docs/:project/planning-user-flow-suggestions/apply?flow=<stem> 승인·반려 적용(승인분만 <stem>.md 에지 append)
 *
 * :project는 슬래시를 포함할 수 있어 와일드카드(*)로 받는다. docs는 SSOT(읽기전용)지만,
 * 예외로 유저플로우 좌표 overlay와 PRD 승인 반영(승인=사용자 의도)만 쓴다.
 */
import { dirname } from "node:path";
import { Router } from "express";
import type { Response } from "express";
import { buildDocsGraph, buildDocsWireframe, buildDocsDecisionTimeline } from "../parser/docsAdapter.js";
import { buildDocsPlanningPrd } from "../parser/prdBuilder.js";
import { buildDocsPlanningFeatures } from "../parser/featureTreeBuilder.js";
import { buildPlanningIaTree } from "../parser/planningIaBuilder.js";
import { buildScreenRegistry } from "../parser/screenRegistry.js";
import { buildDocsPlanningUserFlow } from "../parser/planningUserFlowBuilder.js";
import {
  listDocsProjects,
  resolveDocsDir,
  listDocsUserFlows,
  readDocsUserFlowOverlay,
  writeDocsUserFlowOverlay,
  readDocsPrdSuggestions,
  applyPrdSuggestions,
  isPrdApplyRequest,
  isSafeFlowToken,
} from "../lib/docs.js";
import { readDocsFeatureSuggestions, applyFeatureSuggestions } from "../lib/featureDocs.js";
import { readUserFlowSuggestions, applyUserFlowSuggestions } from "../lib/userFlowDocs.js";
import { readAuditCapabilities } from "../lib/auditSummary.js";
import { isLayoutOverlay } from "../lib/changes.js";
import { safe } from "../lib/safe-error.js";
import { APPLY_BATCH_CAP } from "@flowforge/shared";

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
  "/api/docs/:project(*)/audit-capabilities",
  safe(async (req, res) => {
    const project = String(req.params.project ?? "");
    const dir = resolveDocsDir(project);
    if (!dir) {
      res.status(404).json({ error: "docs_not_found" });
      return;
    }
    // resolveDocsDir는 docs 디렉토리를 반환 — 리더는 projectDir 기준(<projectDir>/docs/audit.json)
    res.json({ project, capabilities: readAuditCapabilities(dirname(dir)) });
  }),
);

docsRouter.get(
  "/api/docs/:project(*)/planning-screens",
  safe(async (req, res) => {
    const project = String(req.params.project ?? "");
    const dir = resolveDocsDir(project);
    if (!dir) {
      res.status(404).json({ error: "docs_not_found" });
      return;
    }
    // features.md 부재 → null이지만 화면목록은 부가 정보 — 빈 레지스트리 200(에러 아님).
    const registry = buildScreenRegistry(dir);
    if (!registry) {
      res.json({ screens: [], links: [] });
      return;
    }
    res.json({ screens: registry.screens, links: registry.links });
  }),
);

docsRouter.get(
  "/api/docs/:project(*)/planning-ia",
  safe(async (req, res) => {
    const project = String(req.params.project ?? "");
    const dir = resolveDocsDir(project);
    if (!dir) {
      res.status(404).json({ error: "docs_not_found" });
      return;
    }
    // 화면 1급 노드(features.md 화면목록) → IA 트리(화면=부모, 연결 상세기능=자식).
    // features.md 자체가 없으면 null → 404(planning-features와 동형).
    const tree = buildPlanningIaTree(dir);
    if (!tree) {
      res.status(404).json({ error: "planning_ia_not_found" });
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

docsRouter.get(
  "/api/docs/:project(*)/planning-prd-suggestions",
  safe(async (req, res) => {
    const project = String(req.params.project ?? "");
    const dir = resolveDocsDir(project);
    if (!dir) {
      res.status(404).json({ error: "docs_not_found" });
      return;
    }
    // 큐 부재=빈 큐(404 아님). 읽기는 절대 throw하지 않는다(안전 폴백).
    res.json({ project, queue: readDocsPrdSuggestions(dir) });
  }),
);

// D-3 apply 배치 상한 = shared APPLY_BATCH_CAP 단일 정의 소비(웹 청크 분할과 드리프트 방지).

/** 배치 상한 초과면 400 응답을 쓰고 true 반환(호출부는 즉시 return). 3개 apply 라우트 공유. */
function rejectOversizedBatch(body: { approve: readonly string[]; reject: readonly string[] }, res: Response): boolean {
  if (body.approve.length + body.reject.length > APPLY_BATCH_CAP) {
    res.status(400).json({ error: "batch_too_large", cap: APPLY_BATCH_CAP });
    return true;
  }
  return false;
}

docsRouter.post(
  "/api/docs/:project(*)/planning-prd-suggestions/apply",
  safe(async (req, res) => {
    const project = String(req.params.project ?? "");
    const dir = resolveDocsDir(project);
    if (!dir) {
      res.status(404).json({ error: "docs_not_found" });
      return;
    }
    const body: unknown = req.body;
    if (!isPrdApplyRequest(body)) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    if (rejectOversizedBatch(body, res)) return;
    const result = applyPrdSuggestions(dir, body);
    // prd.md 파싱/쓰기 실패(원본 손상) → 422(원본 보호). 미실재 id(skipped)와 구분된 신호.
    if (result.writeFailed) {
      res.status(422).json({ error: "prd_write_failed", ...result });
      return;
    }
    res.json(result);
  }),
);

docsRouter.get(
  "/api/docs/:project(*)/planning-features-suggestions",
  safe(async (req, res) => {
    const project = String(req.params.project ?? "");
    const dir = resolveDocsDir(project);
    if (!dir) {
      res.status(404).json({ error: "docs_not_found" });
      return;
    }
    // 큐 부재=빈 큐(404 아님). 읽기는 절대 throw하지 않는다(안전 폴백).
    res.json({ project, queue: readDocsFeatureSuggestions(dir) });
  }),
);

docsRouter.post(
  "/api/docs/:project(*)/planning-features-suggestions/apply",
  safe(async (req, res) => {
    const project = String(req.params.project ?? "");
    const dir = resolveDocsDir(project);
    if (!dir) {
      res.status(404).json({ error: "docs_not_found" });
      return;
    }
    // apply body는 6a와 동형(approve[]/reject[]) — isPrdApplyRequest 재사용.
    const body: unknown = req.body;
    if (!isPrdApplyRequest(body)) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    if (rejectOversizedBatch(body, res)) return;
    const result = applyFeatureSuggestions(dir, body);
    // features.md 읽기/쓰기 실패(원본 손상) → 422(원본 보호). 미실재 id(skipped)와 구분된 신호.
    if (result.writeFailed) {
      res.status(422).json({ error: "features_write_failed", ...result });
      return;
    }
    res.json(result);
  }),
);

docsRouter.get(
  "/api/docs/:project(*)/planning-user-flow-suggestions",
  safe(async (req, res) => {
    const project = String(req.params.project ?? "");
    const dir = resolveDocsDir(project);
    if (!dir) {
      res.status(404).json({ error: "docs_not_found" });
      return;
    }
    // flow 미지정이면 첫 버전 폴백(planning-user-flow GET과 동형). 무효 stem·버전 없음 → 404.
    const flow = String(req.query.flow ?? listDocsUserFlows(dir)[0] ?? "");
    if (!isSafeFlowToken(flow)) {
      res.status(404).json({ error: "planning_user_flow_not_found" });
      return;
    }
    // 큐 부재=빈 큐(404 아님). 읽기는 절대 throw하지 않는다(안전 폴백).
    res.json({ project, flow, queue: readUserFlowSuggestions(dir, flow) });
  }),
);

docsRouter.post(
  "/api/docs/:project(*)/planning-user-flow-suggestions/apply",
  safe(async (req, res) => {
    const project = String(req.params.project ?? "");
    const dir = resolveDocsDir(project);
    if (!dir) {
      res.status(404).json({ error: "docs_not_found" });
      return;
    }
    // 쓰기라 폴백 없이 명시 stem만 받는다(PUT layout과 동형). 무효·미지정 → 404.
    const flow = String(req.query.flow ?? "");
    if (!isSafeFlowToken(flow)) {
      res.status(404).json({ error: "planning_user_flow_not_found" });
      return;
    }
    // apply body는 6a와 동형(approve[]/reject[]) — isPrdApplyRequest 재사용.
    const body: unknown = req.body;
    if (!isPrdApplyRequest(body)) {
      res.status(400).json({ error: "invalid_request" });
      return;
    }
    if (rejectOversizedBatch(body, res)) return;
    const result = applyUserFlowSuggestions(dir, flow, body);
    // <stem>.md 부재·roundtrip 위반·쓰기 실패(원본 보호) → 422. 미실재 id(skipped)와 구분된 신호.
    if (result.writeFailed) {
      res.status(422).json({ error: "user_flow_write_failed", ...result });
      return;
    }
    res.json(result);
  }),
);
