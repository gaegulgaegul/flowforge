/**
 * wireDocs — 와이어 레이아웃(WireScreen2) 제안 승인/반려 + 화면별 피드백 write
 * (planning-wireframe-generation-feedback change).
 *
 * featureDocs(속성 라인 제자리 교체)·userFlowDocs(mermaid 에지 append)가 원형이나, 와이어 원천은
 * `WireScreen2[]` **JSON 구조체**라 라인패치 invariant를 복제할 수 없다(design D4) → 저장 포맷을
 * JSON 사이드카로 바꾸고, invariant를 `wireframeInvariantHolds`(화면 id 집합 보존)로 조정한다.
 *
 * 저장 위치(design D5): flowforge 컨테이너는 홈(docsDir)을 :ro 마운트라 docsDir 하위 write 불가.
 *  - 큐 read = `<docsDir>/planning/wireframe.suggestions.json` (외부 스킬이 씀 → RO에서 읽기 OK).
 *  - 승인분 원천 write = `<WIREFRAME_FEEDBACK_ROOT>/<project>.wireframe.json` (전용 RW 볼륨).
 *  - 피드백 write = `<WIREFRAME_FEEDBACK_ROOT>/<project>.feedback.json` (같은 RW 볼륨, D8 별도 경로).
 * env 미설정 시 tmp 폴백(테스트/로컬).
 *
 * server(큐 read/apply·feedback write)와 web(승인 UI·피드백 입력)이 공유하는 타입은 shared.
 * apply body/result는 6a의 PrdApplyRequest/PrdApplyResult를 재사용한다(형태 동일).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import type {
  PrdApplyRequest,
  PrdApplyResult,
  WireBodyLayout,
  WireDevice,
  WireElement,
  WireElementKind,
  WireScreen2,
  WireSuggestion,
  WireSuggestionQueue,
  WireFeedbackItem,
} from "@flowforge/shared";
import { PLANNING_WIREFRAME_FIXTURE } from "../parser/planningWireframeFixture.js";

// ── WireScreen2 스키마 어휘(shared 타입과 정합 필수) ──────────────────────────
const DEVICES: ReadonlySet<string> = new Set<WireDevice>(["desktop", "mobile"]);
const BODY_LAYOUTS: ReadonlySet<string> = new Set<WireBodyLayout>(["grid", "stack", "tree", "form"]);
const ELEMENT_KINDS: ReadonlySet<string> = new Set<WireElementKind>([
  "nav-item",
  "tab",
  "card",
  "input",
  "button",
  "text",
  "tree-node",
  "placeholder",
]);

// ── 경로 규약 ────────────────────────────────────────────────────────────────

/** 와이어 제안 큐 경로(외부 스킬이 씀 → RO docsDir에서 읽기만). */
function wireSuggestionsPath(docsDir: string): string {
  return join(docsDir, "planning", "wireframe.suggestions.json");
}

/**
 * feedback/승인분 write 볼륨 루트(design D5). env `WIREFRAME_FEEDBACK_ROOT`가 우선,
 * 없으면 tmp 폴백(테스트/로컬 — 프로덕션은 docker-compose가 RW 볼륨 env를 주입).
 */
export function wireframeFeedbackRoot(): string {
  return process.env.WIREFRAME_FEEDBACK_ROOT ?? join(tmpdir(), "flowforge-wireframe-feedback");
}

/** docsDir(`<root>/<project>/docs`)에서 project 세그먼트 추출. RW 볼륨 파일명에 쓴다. */
function projectFromDocsDir(docsDir: string): string {
  return basename(dirname(docsDir));
}

/** 승인분 원천 경로 = `<feedbackRoot>/<project>.wireframe.json`(RW 볼륨). */
export function approvedWireframePath(docsDir: string): string {
  return join(wireframeFeedbackRoot(), `${projectFromDocsDir(docsDir)}.wireframe.json`);
}

/** 피드백 사이드카 경로 = `<feedbackRoot>/<project>.feedback.json`(RW 볼륨, D8 별도 경로). */
export function feedbackSidecarPath(docsDir: string, project: string): string {
  void docsDir;
  return join(wireframeFeedbackRoot(), `${project}.feedback.json`);
}

// ── 스키마 가드 ──────────────────────────────────────────────────────────────

/** 요소 1개가 WireElement 스키마인가(kind 8종·label string·goto?·span?). */
function isValidWireElement(v: unknown): v is WireElement {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  if (!ELEMENT_KINDS.has(e["kind"] as string)) return false;
  if (typeof e["label"] !== "string") return false;
  if (e["goto"] !== undefined && typeof e["goto"] !== "string") return false;
  if (e["span"] !== undefined && typeof e["span"] !== "number") return false;
  return true;
}

/** 영역(topbar/sidebar/bottombar) 요소 배열이 유효한가(선택 필드 — undefined면 통과). */
function isValidRegionArray(v: unknown): boolean {
  if (v === undefined) return true;
  return Array.isArray(v) && v.every(isValidWireElement);
}

/** layout이 WireScreen2 스키마를 만족하는가(id·title·device·regions.body layout·요소 kind). */
function isValidWireScreen2(v: unknown): v is WireScreen2 {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  if (typeof s["id"] !== "string" || typeof s["title"] !== "string") return false;
  if (!DEVICES.has(s["device"] as string)) return false;
  const regions = s["regions"];
  if (typeof regions !== "object" || regions === null) return false;
  const r = regions as Record<string, unknown>;
  const body = r["body"];
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  if (!BODY_LAYOUTS.has(b["layout"] as string)) return false;
  if (!Array.isArray(b["elements"]) || !b["elements"].every(isValidWireElement)) return false;
  if (!isValidRegionArray(r["topbar"])) return false;
  if (!isValidRegionArray(r["sidebar"])) return false;
  if (!isValidRegionArray(r["bottombar"])) return false;
  return true;
}

/** 한 제안이 스키마에 맞는가 — id·screenId string + layout이 WireScreen2 스키마. */
export function isValidWireSuggestion(v: unknown): v is WireSuggestion {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  if (typeof s["id"] !== "string" || typeof s["screenId"] !== "string") return false;
  if (s["rationale"] !== undefined && typeof s["rationale"] !== "string") return false;
  return isValidWireScreen2(s["layout"]);
}

// ── 큐 read/write ────────────────────────────────────────────────────────────

/**
 * 와이어 제안 큐 읽기. 파일 없음·깨진 JSON·미인식 항목은 모두 안전 폴백(빈 큐/필터).
 * 읽기는 절대 throw하지 않는다(라우트가 500으로 죽지 않게). id 중복은 first-occurrence-wins.
 */
export function readDocsWireframeSuggestions(docsDir: string): WireSuggestionQueue {
  const empty: WireSuggestionQueue = { version: 1, suggestions: [] };
  const p = wireSuggestionsPath(docsDir);
  if (!existsSync(p)) return empty;
  try {
    const parsed: unknown = JSON.parse(readFileSync(p, "utf-8"));
    if (typeof parsed !== "object" || parsed === null) return empty;
    const raw = (parsed as Record<string, unknown>)["suggestions"];
    if (!Array.isArray(raw)) return empty;
    const seen = new Set<string>();
    const suggestions = raw.filter(isValidWireSuggestion).filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    return { version: 1, suggestions };
  } catch {
    return empty;
  }
}

/** 큐 쓰기(승인/반려 후 남은 제안 반영). planning 디렉토리 자동 생성. */
function writeDocsWireframeSuggestions(docsDir: string, queue: WireSuggestionQueue): void {
  const dir = join(docsDir, "planning");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(wireSuggestionsPath(docsDir), JSON.stringify(queue, null, 2), "utf-8");
}

// ── 승인분 원천 read/write (RW 볼륨) ──────────────────────────────────────────

/** 승인분 원천 JSON 읽기. 없거나 깨졌거나 스키마 위반이면 null(폴백=픽스처). throw 금지. */
function readApprovedWireframe(docsDir: string): WireScreen2[] | null {
  const p = approvedWireframePath(docsDir);
  if (!existsSync(p)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(p, "utf-8"));
    if (!Array.isArray(parsed) || !parsed.every(isValidWireScreen2)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 승인분 원천 JSON 쓰기(RW 볼륨). 루트 디렉토리 자동 생성. 실패는 호출부가 catch(writeFailed). */
function writeApprovedWireframe(docsDir: string, screens: readonly WireScreen2[]): void {
  const root = wireframeFeedbackRoot();
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
  writeFileSync(approvedWireframePath(docsDir), JSON.stringify(screens, null, 2), "utf-8");
}

/**
 * 현재 와이어 원천(승인분 있으면 그것, 없으면 픽스처). apply의 merge 기준(base)과 렌더 원천이 같다.
 */
function currentWireframeBase(docsDir: string): WireScreen2[] {
  return readApprovedWireframe(docsDir) ?? [...PLANNING_WIREFRAME_FIXTURE];
}

// ── invariant (화면 id 집합 보존, design D4) ──────────────────────────────────

/**
 * self-roundtrip 방어: 승인 반영 후 화면 id 집합이 반영 전과 동일한지 검증한다.
 * 승인은 기존 화면의 레이아웃 교체만 허용 — 화면이 사라지거나 새로 생기면(집합 변화) 위반.
 * 라인패치의 노드개수/capability 지문 비교(featureDocs)와 동형의 JSON판 불변식.
 */
export function wireframeInvariantHolds(
  before: readonly WireScreen2[],
  after: readonly WireScreen2[],
): boolean {
  const b = new Set(before.map((s) => s.id));
  const a = new Set(after.map((s) => s.id));
  if (b.size !== a.size) return false;
  for (const id of b) if (!a.has(id)) return false;
  return true;
}

// ── apply ────────────────────────────────────────────────────────────────────

/**
 * 승인/반려 적용. approve id는 그 화면 레이아웃을 승인분 원천에 교체 반영 후 큐에서 제거,
 * reject id는 반영 없이 제거. 미실재 id는 skipped로 표면화(silent drop 금지).
 * 승인 화면이 기존 화면 집합 밖(신규/삭제 유발)이면 wireframeInvariantHolds 위반 → writeFailed로
 * 원본 보존(라우트 422). 승인분 write 실패도 writeFailed. write는 성공했으나 큐 prune만 실패하면
 * queuePruneFailed(부분반영, 라우트 200).
 */
export function applyWireframeSuggestions(docsDir: string, req: PrdApplyRequest): PrdApplyResult {
  const queue = readDocsWireframeSuggestions(docsDir);
  const byId = new Map(queue.suggestions.map((s) => [s.id, s]));
  const skipped: string[] = [];

  for (const id of req.approve) if (!byId.has(id)) skipped.push(id);

  const approveSet = new Set(req.approve);
  const willApply = queue.suggestions.filter((s) => approveSet.has(s.id));
  const approvedIds: string[] = [];
  let applied = 0;

  if (willApply.length > 0) {
    const base = currentWireframeBase(docsDir);
    const merged = new Map(base.map((s) => [s.id, s] as const));
    // 큐 배열 순서로 반영(같은 화면 여러 승인은 뒤가 최종 — 결정론).
    for (const s of willApply) {
      merged.set(s.screenId, s.layout);
      applied++;
      approvedIds.push(s.id);
    }
    const after = [...merged.values()];
    // D4 self-roundtrip: 화면 id 집합이 변했으면(신규/삭제 화면) = 승인분 교체 범위를 벗어남
    // → 쓰지 않고 원본 보존(라우트 422). 큐도 그대로 둔다.
    if (!wireframeInvariantHolds(base, after)) {
      return { applied: 0, rejected: 0, remaining: queue.suggestions.length, skipped, writeFailed: true };
    }
    try {
      writeApprovedWireframe(docsDir, after);
    } catch {
      return { applied: 0, rejected: 0, remaining: queue.suggestions.length, skipped, writeFailed: true };
    }
  }

  // 반려: 반영 없이 제거. 미실재 id는 skipped.
  const rejectedIds: string[] = [];
  for (const id of req.reject) {
    if (byId.has(id)) rejectedIds.push(id);
    else skipped.push(id);
  }

  // 큐 재작성(D-2 재독 차집합): 승인 반영분 + 반려분만 제거. prune write만 실패하면 부분반영 고지.
  const removed = new Set<string>([...approvedIds, ...rejectedIds]);
  try {
    const remaining = pruneWireframeQueue(docsDir, removed);
    return { applied, rejected: rejectedIds.length, remaining, skipped };
  } catch {
    const remaining = readDocsWireframeSuggestions(docsDir).suggestions.length;
    return { applied, rejected: rejectedIds.length, remaining, skipped, queuePruneFailed: true };
  }
}

/** 큐 파일 재독 후 처리 id만 제거·재작성(D-2). 남은 제안 수 반환. */
export function pruneWireframeQueue(docsDir: string, processedIds: ReadonlySet<string>): number {
  const fresh = readDocsWireframeSuggestions(docsDir);
  const remainingSuggestions = fresh.suggestions.filter((s) => !processedIds.has(s.id));
  writeDocsWireframeSuggestions(docsDir, { version: 1, suggestions: remainingSuggestions });
  return remainingSuggestions.length;
}

// ── 원천 교체: buildDocsPlanningWireframe2 ────────────────────────────────────

/**
 * planning 와이어 레이아웃(WireScreen2[]) 제공 — 승인분 원천이 있으면 그걸, 없으면 픽스처 폴백.
 * 1단계 렌더러·라우트·web은 무변경(`readonly WireScreen2[]` 계약 유지, 동기). 승인분 JSON이
 * 없거나 깨졌으면 픽스처로 안전 폴백해 1단계 렌더가 안 깨지게 한다.
 */
export function buildDocsPlanningWireframe2(docsDir: string): readonly WireScreen2[] {
  return readApprovedWireframe(docsDir) ?? PLANNING_WIREFRAME_FIXTURE;
}

// ── feedback write (사람→AI 역방향, A안 파일 릴레이) ──────────────────────────

/** 주입 가능한 시계(테스트 안정성 — Date.now/new Date 직접 사용 금지). 기본=현재 ISO. */
export type NowIso = () => string;
const defaultNowIso: NowIso = () => new Date().toISOString();

/** feedback 사이드카 읽기(누적 append용). 없거나 깨졌으면 빈 배열. throw 금지. */
function readFeedbackSidecar(path: string): WireFeedbackItem[] {
  if (!existsSync(path)) return [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
    return Array.isArray(parsed) ? (parsed as WireFeedbackItem[]) : [];
  } catch {
    return [];
  }
}

/** 좌표 %가 0~100 범위의 유한 숫자인가(범위 밖·NaN·Infinity 거부). */
function isValidPct(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
}

/**
 * 인플레이스 핀 피드백을 feedback 사이드카에 append(사람→AI 역방향, D2/D3 A안 파일 릴레이).
 * flowforge는 write만 하고 AI를 호출하지 않는다. Figma 코멘트식: 클릭한 좌표(xPct·yPct 0~100)에
 * 묶인 지점 단위 피드백. 빈 텍스트(공백만)·범위 밖 좌표는 거부(쓰레기 방지). ts는 주입 시계(nowIso)로
 * 스탬프 — 테스트 안정성. write는 RW 볼륨(WIREFRAME_FEEDBACK_ROOT)에.
 */
export function appendWireframeFeedback(
  docsDir: string,
  project: string,
  input: { screenId: string; text: string; xPct: number; yPct: number; region?: string },
  nowIso: NowIso = defaultNowIso,
): { ok: boolean } {
  const text = (input.text ?? "").trim();
  if (text.length === 0) return { ok: false };
  // 좌표 유효성 방어(0~100 밖·NaN·Infinity 거부) — 지점 단위 피드백은 좌표가 곧 의미.
  if (!isValidPct(input.xPct) || !isValidPct(input.yPct)) return { ok: false };
  const item: WireFeedbackItem = {
    screenId: input.screenId,
    text,
    ts: nowIso(),
    xPct: input.xPct,
    yPct: input.yPct,
    ...(typeof input.region === "string" && input.region.length > 0 ? { region: input.region } : {}),
  };
  const path = feedbackSidecarPath(docsDir, project);
  const root = wireframeFeedbackRoot();
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
  const items = readFeedbackSidecar(path);
  items.push(item);
  writeFileSync(path, JSON.stringify(items, null, 2), "utf-8");
  return { ok: true };
}
