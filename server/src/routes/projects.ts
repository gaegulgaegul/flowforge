/**
 * projects 라우트 — 계층형 대시보드의 백엔드 (읽기전용 합성, 기존 라우트 무손상).
 *
 * GET /api/projects                                      카드 그리드(프로젝트 목록)
 * GET /api/projects/:project/capabilities                charter 뼈대 capability(한글명 + 연결 change)
 * GET /api/projects/:project/capabilities/:cap/changes   그 capability의 change 목록(한글 제목)
 *
 * lib/projects(스캔) + lib/capabilityIndex(연결) + lib/koreanLabels(표시명)을 합성만 한다.
 * 기존 /api/changes/* · /api/docs/* · graph는 import도 안 하므로 변경 0(종착지로 재사용).
 */
import { Router } from "express";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listProjectCards, resolveProjectDir as resolveProjectDirLib } from "../lib/projects.js";
import {
  parseCharterCapabilities,
  buildCapabilityIndex,
  buildCapabilityDetail,
  type UserFlowCaps,
} from "../lib/capabilityIndex.js";
import {
  parseCapabilityLabels,
  capabilityLabel,
  changeLabel,
} from "../lib/koreanLabels.js";
import { buildDocsPlanningFeatures } from "../parser/featureTreeBuilder.js";
import { listDocsUserFlows, readDocsUserFlowSpec } from "../lib/docs.js";
import { safe } from "../lib/safe-error.js";

/** user-flow 명세 본문에서 `> capability: <키>` 마커가 선언한 capability 키들. */
const RE_FLOW_CAP = /^>\s*capability:\s*([A-Za-z0-9_-]+)\s*$/;

/** docsDir의 user-flow stem마다 선언 capability 키를 스캔한다(읽기전용·글자단위). */
function scanUserFlowCaps(docsDir: string): UserFlowCaps[] {
  const out: UserFlowCaps[] = [];
  for (const stem of listDocsUserFlows(docsDir)) {
    const body = readDocsUserFlowSpec(docsDir, stem);
    if (body === null) continue;
    const caps: string[] = [];
    for (const raw of body.split(/\r?\n/)) {
      const m = RE_FLOW_CAP.exec(raw);
      if (m && m[1]) caps.push(m[1]);
    }
    out.push({ stem, caps });
  }
  return out;
}

export const projectsRouter = Router();

/** 프로젝트명 → 절대 디렉토리(스캔 루트 밖 탈출 방지). 부정 시 null. */
function resolveProjectDir(project: string): string | null {
  // 검증은 lib 단일 구현으로 통합(review R-1 — 사본 drift가 C-1의 근원이었다).
  // 이 라우터는 openspec 드릴다운 전용이라 openspec/changes 존재만 추가로 요구한다.
  const dir = resolveProjectDirLib(project);
  if (dir === null || !existsSync(join(dir, "openspec", "changes"))) return null;
  return dir;
}

/** capability 키 화이트리스트(영문 슬러그). 빈값·특수문자 거부(방어적 일관성). */
function isValidCapKey(cap: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(cap);
}

/** <project>/docs/spec.md 본문(없으면 빈 문자열 — charter 없는 프로젝트). */
function readCharterSpec(projectDir: string): string {
  const p = join(projectDir, "docs", "spec.md");
  if (!existsSync(p)) return "";
  try {
    return readFileSync(p, "utf-8");
  } catch {
    return "";
  }
}

/** change의 proposal.md 첫 H1(`# 제목`)을 한글 표시 제목 후보로 추출(없으면 undefined). */
function readProposalTitle(changesRoot: string, changeKey: string): string | undefined {
  const p = join(changesRoot, changeKey, "proposal.md");
  if (!existsSync(p)) return undefined;
  try {
    for (const raw of readFileSync(p, "utf-8").split(/\r?\n/)) {
      const m = /^#\s+(.+?)\s*$/.exec(raw);
      if (m && m[1]) return m[1].trim();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/** 한 프로젝트의 charter capability 집합 + spec 병기 라벨 맵 + 연결 인덱스를 묶어 만든다. */
function indexFor(projectDir: string) {
  const specMd = readCharterSpec(projectDir);
  const charterCaps = parseCharterCapabilities(specMd);
  const specLabels = parseCapabilityLabels(specMd);
  const changesRoot = join(projectDir, "openspec", "changes");
  const index = buildCapabilityIndex(charterCaps, changesRoot);
  return { charterCaps, specLabels, changesRoot, index };
}

projectsRouter.get(
  "/api/projects",
  safe(async (_req, res) => {
    res.json({ projects: listProjectCards() });
  }),
);

projectsRouter.get(
  "/api/projects/:project/capabilities",
  safe(async (req, res) => {
    const project = String(req.params.project ?? "");
    const dir = resolveProjectDir(project);
    if (!dir) {
      res.status(404).json({ error: "project_not_found" });
      return;
    }
    const { charterCaps, specLabels, index } = indexFor(dir);
    const capabilities = [...charterCaps].sort().map((key) => ({
      key, // 영문 슬러그 불변(라우팅·연결 키)
      koreanLabel: capabilityLabel(key, specLabels, new Map()),
      changeKeys: index.byCapability.get(key) ?? [],
    }));
    res.json({ project, capabilities });
  }),
);

projectsRouter.get(
  "/api/projects/:project/capabilities/:cap/changes",
  safe(async (req, res) => {
    const project = String(req.params.project ?? "");
    const cap = String(req.params.cap ?? "");
    const dir = resolveProjectDir(project);
    if (!dir) {
      res.status(404).json({ error: "project_not_found" });
      return;
    }
    if (!isValidCapKey(cap)) {
      res.status(400).json({ error: "invalid_capability" });
      return;
    }
    const { changesRoot, index } = indexFor(dir);
    const changeKeys = index.byCapability.get(cap) ?? [];
    const changes = changeKeys.map((key) => ({
      key, // 영문 change 디렉토리명 불변
      displayName: changeLabel(key, readProposalTitle(changesRoot, key)),
    }));
    res.json({ project, capability: cap, changes });
  }),
);

projectsRouter.get(
  "/api/projects/:project/capabilities/:cap",
  safe(async (req, res) => {
    const project = String(req.params.project ?? "");
    const cap = String(req.params.cap ?? "");
    const dir = resolveProjectDir(project);
    if (!dir) {
      res.status(404).json({ error: "project_not_found" });
      return;
    }
    if (!isValidCapKey(cap)) {
      res.status(400).json({ error: "invalid_capability" });
      return;
    }
    const { specLabels, changesRoot, index } = indexFor(dir);
    // docsDir는 같은 프로젝트 디렉토리 아래(PROJECTS_ROOT 일관 — DOCS_ROOT 분리 회피).
    const docsDir = join(dir, "docs");
    const featureTree = buildDocsPlanningFeatures(docsDir);
    const userFlowCaps = scanUserFlowCaps(docsDir);
    const detail = buildCapabilityDetail(cap, index, featureTree, userFlowCaps);
    res.json({
      project,
      key: cap, // 영문 슬러그 불변(라우팅·연결 키)
      koreanLabel: capabilityLabel(cap, specLabels, new Map()),
      features: detail.features,
      userFlows: detail.userFlows,
      changes: detail.changes.map((key) => ({
        key, // 영문 change 디렉토리명 불변
        displayName: changeLabel(key, readProposalTitle(changesRoot, key)),
        project, // 카드 진입 컨텍스트 — web이 5종 뷰·layout 저장에 ?project=로 부착
      })),
    });
  }),
);
