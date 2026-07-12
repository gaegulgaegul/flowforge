/** flowforge API 클라이언트 (dev: vite 프록시 /api → :8811) */
import type {
  SpecGraph,
  LayoutOverlay,
  Wireframe,
  WireDoc,
  Prd,
  SpecTreeNode,
  DecisionTimeline,
  ProjectCard,
  FeatureTree,
  PrdSuggestionQueue,
  PrdApplyRequest,
  PrdApplyResult,
  FeatureSuggestionQueue,
  UserFlowSuggestionQueue,
  WireSuggestionQueue,
  WireFeedbackItem,
  WireFeedbackStatus,
  CapabilityAuditSummary,
  ScreenRegistry,
} from "@flowforge/shared";
// 서버 apply 배치 상한 — shared 단일 정의 소비(드리프트 방지). 런타임 값이라 type import와 분리.
import { APPLY_BATCH_CAP } from "@flowforge/shared";

export interface GraphResponse {
  id: string;
  graph: SpecGraph;
  layout: LayoutOverlay;
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

/** capability에 속한 change 한 줄: 영문 key + 한글 displayName(proposal 제목 폴백=key). */
export interface ChangeSummary {
  key: string;
  displayName: string;
  // 이 change가 속한 프로젝트(타 프로젝트 드릴다운에서 서버가 실어줌). 전역 진입이면 undefined.
  project?: string;
}

// 선택적 ?project= 쿼리를 URL에 붙인다(없으면 원본 그대로 — 전역 root 하위호환).
function withProject(url: string, project?: string): string {
  return project ? `${url}?project=${encodeURIComponent(project)}` : url;
}

/** 홈 랜딩: change 있는 모든 프로젝트 카드(charter 유무 무관). */
export async function fetchProjects(): Promise<ProjectCard[]> {
  const res = await fetch("/api/projects");
  if (!res.ok) throw new Error(`projects ${res.status}`);
  const data = (await res.json()) as { projects: ProjectCard[] };
  return data.projects;
}

export async function fetchGraph(id: string, project?: string): Promise<GraphResponse> {
  const res = await fetch(withProject(`/api/changes/${id}/graph`, project));
  if (!res.ok) throw new Error(`graph ${res.status}`);
  return (await res.json()) as GraphResponse;
}

export async function fetchWireframe(id: string, project?: string): Promise<WireframeResponse> {
  const res = await fetch(withProject(`/api/changes/${id}/wireframe`, project));
  if (!res.ok) throw new Error(`wireframe ${res.status}`);
  return (await res.json()) as WireframeResponse;
}

export async function fetchPrd(id: string, project?: string): Promise<PrdResponse> {
  const res = await fetch(withProject(`/api/changes/${id}/prd`, project));
  if (!res.ok) throw new Error(`prd ${res.status}`);
  return (await res.json()) as PrdResponse;
}

export async function fetchSpecTree(id: string, project?: string): Promise<SpecTreeResponse> {
  const res = await fetch(withProject(`/api/changes/${id}/spec-tree`, project));
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

/** batch_too_large(400) 안내 — 청크 헬퍼를 안 거친 직접 호출이 상한에 걸렸을 때의 명확한 메시지. */
const BATCH_TOO_LARGE_MSG = `한 번에 처리할 수 있는 제안은 ${APPLY_BATCH_CAP}건까지입니다(자동 분할이 적용되지 않은 요청).`;

/**
 * 대량 일괄 승인/반려를 서버 상한(200)에 맞춰 순차 청크로 전송하고 결과를 합산한다.
 * 큐가 201건 이상이어도 [모두 승인/반려]가 죽지 않게 하는 클라이언트 측 분할(D-3 짝).
 * 청크 도중 실패하면 그 시점까지의 반영은 유지된 채 throw(서버가 청크 단위로 원자 처리).
 */
export async function applyInChunks(
  applyOnce: (req: PrdApplyRequest) => Promise<PrdApplyResult>,
  req: PrdApplyRequest,
): Promise<PrdApplyResult> {
  let applied = 0;
  let rejected = 0;
  let remaining = 0;
  const skipped: string[] = [];
  let queuePruneFailed = false; // 어느 청크든 큐 정리 실패면 합산 결과에 표면화(무시 시 부분반영 은폐).
  const chunks: PrdApplyRequest[] = [];
  for (let a = 0; a < req.approve.length; a += APPLY_BATCH_CAP) {
    chunks.push({ approve: req.approve.slice(a, a + APPLY_BATCH_CAP), reject: [] });
  }
  for (let r = 0; r < req.reject.length; r += APPLY_BATCH_CAP) {
    chunks.push({ approve: [], reject: req.reject.slice(r, r + APPLY_BATCH_CAP) });
  }
  for (const c of chunks) {
    const res = await applyOnce(c);
    applied += res.applied;
    rejected += res.rejected;
    remaining = res.remaining; // 마지막 청크의 잔여가 최신
    skipped.push(...res.skipped);
    if (res.queuePruneFailed) queuePruneFailed = true;
  }
  return queuePruneFailed
    ? { applied, rejected, remaining, skipped, queuePruneFailed: true }
    : { applied, rejected, remaining, skipped };
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
    if (res.status === 400) {
      const body: unknown = await res.json().catch(() => null);
      if (typeof body === "object" && body !== null && (body as { error?: string }).error === "batch_too_large") {
        throw new Error(BATCH_TOO_LARGE_MSG);
      }
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

/** capability별 audit 요약(docs/audit.json) — 요구사항 노드 배지용. audit.json 없으면 빈 객체(배지 없음). */
export async function fetchAuditCapabilities(
  project: string,
): Promise<{ project: string; capabilities: Record<string, CapabilityAuditSummary> }> {
  const res = await fetch(`/api/docs/${project}/audit-capabilities`);
  if (!res.ok) throw new Error(`docs audit-capabilities ${res.status}`);
  return (await res.json()) as { project: string; capabilities: Record<string, CapabilityAuditSummary> };
}

/**
 * "감사 진행" 트리거 — 그 프로젝트의 openspec-audit 잡을 큐잉한다(얇은 인증 프록시).
 * 202면 큐잉 성공(호스트 워커가 결정적 실행 → audit.json 갱신). 인증 게이트 활성 시
 * 무자격은 401. 성공 후 UI는 폴링으로 fetchAuditCapabilities를 재조회해 판정을 갱신한다.
 */
export async function runAudit(project: string): Promise<{ ok: boolean; taskId?: number }> {
  const res = await fetch(`/api/docs/${project}/audit-run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (res.status !== 202) {
    if (res.status === 401) throw new Error("감사 실행 권한이 없습니다(인증 필요).");
    throw new Error(`audit-run ${res.status}`);
  }
  const body = (await res.json().catch(() => ({}))) as { taskId?: number };
  return { ok: true, ...(typeof body.taskId === "number" ? { taskId: body.taskId } : {}) };
}

/** 화면 레지스트리(features.md 화면목록 + 상세기능 N:M 링크) — 상세 패널 연결화면 섹션용.
 * 화면목록 미작성이면 빈 screens/links(에러 아님). */
export async function fetchPlanningScreens(project: string): Promise<ScreenRegistry> {
  const res = await fetch(`/api/docs/${project}/planning-screens`);
  if (!res.ok) throw new Error(`docs planning-screens ${res.status}`);
  return (await res.json()) as ScreenRegistry;
}

/**
 * 기획 단계 planning 와이어 = 화면별 HTML 문서(WireDoc[], flowforge-wireframe-iframe).
 * 각 화면은 id·title·device·html(자족 문서). WireframeDeviceFrame이 sandbox iframe에 렌더한다.
 */
export async function fetchDocsPlanningWireframe(
  project: string,
): Promise<{ project: string; screens: WireDoc[] }> {
  const res = await fetch(`/api/docs/${project}/planning-wireframe`);
  if (!res.ok) throw new Error(`docs planning-wireframe ${res.status}`);
  return (await res.json()) as { project: string; screens: WireDoc[] };
}

/**
 * 미승인 제안(위저드)의 임시 HTML을 서버에 단기 저장하고 미리보기 토큰을 받는다(CSP meta→헤더 전환).
 * 원천에 없는 임시 문서를 iframe `src`로 로드하기 위한 왕복 — 서버는 추측 불가 토큰(TTL·상한)으로만
 * 서빙하고 문서 CSP는 응답 헤더로 강제한다(문서 무변형). write가 아니라 read 규약과 동형(인증 게이트 없음).
 * 413=크기 상한 초과(토큰 미발급).
 */
export async function createWirePreview(project: string, html: string): Promise<string> {
  const res = await fetch(`/api/docs/${project}/planning-wireframe/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html }),
  });
  if (!res.ok) {
    if (res.status === 413) throw new Error("미리보기 문서가 너무 큽니다.");
    throw new Error(`wire-preview ${res.status}`);
  }
  const body = (await res.json()) as { token: string };
  return body.token;
}

/**
 * 와이어 레이아웃 제안 큐 읽기(docs/planning/wireframe.suggestions.json).
 * 큐 없으면 빈 큐(version:1, suggestions:[]). features 제안 큐의 와이어판(화면별 HTML 문서 교체 제안).
 */
export async function fetchDocsWireframeSuggestions(
  project: string,
): Promise<{ project: string; queue: WireSuggestionQueue }> {
  const res = await fetch(`/api/docs/${project}/planning-wireframe-suggestions`);
  if (!res.ok) throw new Error(`wireframe-suggestions ${res.status}`);
  return (await res.json()) as { project: string; queue: WireSuggestionQueue };
}

/**
 * 와이어 제안 승인/반려 적용. 승인분만 와이어 원천(화면 레이아웃) 반영, 반려는 큐에서만 제거.
 * apply body/result는 6a와 동형(PrdApplyRequest/PrdApplyResult 재사용).
 */
export async function applyDocsWireframeSuggestions(
  project: string,
  req: PrdApplyRequest,
): Promise<PrdApplyResult> {
  const res = await fetch(`/api/docs/${project}/planning-wireframe-suggestions/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    // 422(wireframe_write_failed) = 화면 id 집합 위반/쓰기 실패로 반영 못 함(원본·큐 보존). 원인을 명확히 전달.
    if (res.status === 422) {
      throw new Error("와이어 원천에 반영하지 못했습니다(화면 구성이 예상과 달라 — 원본·큐는 보존됨).");
    }
    if (res.status === 400) {
      const body: unknown = await res.json().catch(() => null);
      if (typeof body === "object" && body !== null && (body as { error?: string }).error === "batch_too_large") {
        throw new Error(BATCH_TOO_LARGE_MSG);
      }
    }
    throw new Error(`wireframe-apply ${res.status}`);
  }
  return (await res.json()) as PrdApplyResult;
}

/**
 * 인플레이스 핀 피드백 write(사람→AI 역방향, D8 별도 경로 — 위저드 승인과 독립, D2 정정).
 * Figma 코멘트식: 와이어 위 클릭한 좌표(xPct·yPct 0~100)에 묶인 지점 단위 피드백. region은 좌표에서
 * 자동 인식한 영역(선택). flowforge는 feedback 사이드카에 append만 하고 AI를 호출하지 않는다(A안 파일
 * 릴레이). 빈 텍스트·범위 밖 좌표는 서버가 400으로 거부 — 클라이언트도 막지만 서버가 최종 방어.
 */
export async function postWireframeFeedback(
  project: string,
  input: { screenId: string; text: string; xPct: number; yPct: number; region?: string },
): Promise<{ ok: true }> {
  const res = await fetch(`/api/docs/${project}/planning-wireframe-feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    if (res.status === 400) {
      throw new Error("피드백을 기록하지 못했습니다(빈 텍스트·범위 밖 좌표이거나 형식 오류).");
    }
    throw new Error(`wireframe-feedback ${res.status}`);
  }
  return (await res.json()) as { ok: true };
}

/**
 * 저장된 핀 피드백 재조회(flowforge-pin-feedback-lifecycle GET). 마운트 시 로컬 pins 시딩용 —
 * 새로고침 후에도 핀이 유지된다. 빈 파일은 빈 배열. id/status는 서버가 하위호환 기본값까지 채워 반환.
 */
export async function fetchWireframeFeedback(project: string): Promise<WireFeedbackItem[]> {
  const res = await fetch(`/api/docs/${project}/planning-wireframe-feedback`);
  if (!res.ok) throw new Error(`wireframe-feedback GET ${res.status}`);
  const body = (await res.json()) as { items: WireFeedbackItem[] };
  return body.items;
}

/**
 * 핀 피드백 in-place 갱신(flowforge-pin-feedback-lifecycle PATCH) — resolve 토글(status)·텍스트 수정(text).
 * id로 대상 지정. 미존재 id는 서버 404 → 에러. 중복 append 없이 그 레코드만 바뀐다(좌표 보존).
 */
export async function updateWireframeFeedback(
  project: string,
  id: string,
  patch: { status?: WireFeedbackStatus; text?: string },
): Promise<{ ok: true }> {
  const res = await fetch(`/api/docs/${project}/planning-wireframe-feedback/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error("피드백을 찾지 못했습니다(이미 삭제되었거나 잘못된 id).");
    if (res.status === 400) throw new Error("피드백을 갱신하지 못했습니다(빈 텍스트·형식 오류).");
    throw new Error(`wireframe-feedback PATCH ${res.status}`);
  }
  return (await res.json()) as { ok: true };
}

/**
 * 기능명세(features) 속성 제안 큐 읽기(docs/planning/features.suggestions.json).
 * 큐 없으면 빈 큐(version:1, suggestions:[]). 6a fetchDocsPrdSuggestions의 features판.
 */
export async function fetchDocsFeatureSuggestions(
  project: string,
): Promise<{ project: string; queue: FeatureSuggestionQueue }> {
  const res = await fetch(`/api/docs/${project}/planning-features-suggestions`);
  if (!res.ok) throw new Error(`features-suggestions ${res.status}`);
  return (await res.json()) as { project: string; queue: FeatureSuggestionQueue };
}

/**
 * 기능명세 속성 제안 승인/반려 적용. 승인분만 features.md 해당 속성 줄 교체(산문·capability·위계 보존),
 * 반려는 큐에서만 제거. apply body/result는 6a와 동형(PrdApplyRequest/PrdApplyResult 재사용).
 */
export async function applyDocsFeatureSuggestions(
  project: string,
  req: PrdApplyRequest,
): Promise<PrdApplyResult> {
  const res = await fetch(`/api/docs/${project}/planning-features-suggestions/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    // 422(features_write_failed) = features.md 형식/불변식이 예상과 달라 반영 못 함(원본·큐 보존). 원인을 명확히 전달.
    if (res.status === 422) {
      throw new Error("features.md 형식이 예상과 달라 반영하지 못했습니다(원본·큐는 보존됨).");
    }
    if (res.status === 400) {
      const body: unknown = await res.json().catch(() => null);
      if (typeof body === "object" && body !== null && (body as { error?: string }).error === "batch_too_large") {
        throw new Error(BATCH_TOO_LARGE_MSG);
      }
    }
    throw new Error(`features-apply ${res.status}`);
  }
  return (await res.json()) as PrdApplyResult;
}

export async function saveLayout(id: string, layout: LayoutOverlay, project?: string): Promise<void> {
  const res = await fetch(withProject(`/api/changes/${id}/layout`, project), {
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

/**
 * 유저플로우 에지 제안 큐 읽기(docs/planning/user-flow/<flow>.suggestions.json — per-stem 사이드카).
 * 큐 없으면 빈 큐(version:1, suggestions:[]). 6b fetchDocsFeatureSuggestions의 유저플로우판.
 */
export async function fetchUserFlowSuggestions(
  project: string,
  flow: string,
): Promise<{ project: string; flow: string; queue: UserFlowSuggestionQueue }> {
  const res = await fetch(
    `/api/docs/${project}/planning-user-flow-suggestions?flow=${encodeURIComponent(flow)}`,
  );
  if (!res.ok) throw new Error(`user-flow-suggestions ${res.status}`);
  return (await res.json()) as { project: string; flow: string; queue: UserFlowSuggestionQueue };
}

/**
 * 유저플로우 에지 제안 승인/반려 적용. 승인분만 <flow>.md 첫 mermaid 블록 끝에 에지 append,
 * 반려는 큐에서만 제거(문서 바이트 불변). apply body/result는 6a와 동형(PrdApplyRequest/PrdApplyResult 재사용).
 */
export async function applyUserFlowSuggestions(
  project: string,
  flow: string,
  req: PrdApplyRequest,
): Promise<PrdApplyResult> {
  const res = await fetch(
    `/api/docs/${project}/planning-user-flow-suggestions/apply?flow=${encodeURIComponent(flow)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    },
  );
  if (!res.ok) {
    // 422(user_flow_write_failed) = <flow>.md 부재/roundtrip 위반/쓰기 실패로 반영 못 함(원본·큐 보존). 원인을 명확히 전달.
    if (res.status === 422) {
      throw new Error("유저플로우 문서에 반영하지 못했습니다(형식/검증 위반 — 원본·큐는 보존됨).");
    }
    if (res.status === 400) {
      const body: unknown = await res.json().catch(() => null);
      if (typeof body === "object" && body !== null && (body as { error?: string }).error === "batch_too_large") {
        throw new Error(BATCH_TOO_LARGE_MSG);
      }
    }
    throw new Error(`user-flow-apply ${res.status}`);
  }
  return (await res.json()) as PrdApplyResult;
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
