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
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import type {
  PrdApplyRequest,
  PrdApplyResult,
  WireDocDevice,
  WireDoc,
  WireSuggestion,
  WireSuggestionQueue,
  WireFeedbackItem,
  WireFeedbackStatus,
} from "@flowforge/shared";
import { PLANNING_WIREFRAME_FIXTURE } from "../parser/planningWireframeFixture.js";

// ── WireDoc 스키마 어휘(shared 타입과 정합 필수) ──────────────────────────────
const DEVICES: ReadonlySet<string> = new Set<WireDocDevice>(["desktop", "mobile"]);

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

// ── 스키마 가드 (WireDoc — HTML 문서, flowforge-wireframe-iframe) ─────────────

/**
 * 화면 문서가 WireDoc 스키마를 만족하는가 — id·title·html string + device 어휘.
 * html은 신뢰되지 않은 AI 생성물이라 flowforge는 렌더 시 sandbox iframe에만 넣는다(내용 검증 아님,
 * 스키마 계약만). 외부 참조는 문서 CSP가 차단하므로 여기서 URL 검사는 하지 않는다(격리가 방어선).
 */
export function isValidWireDoc(v: unknown): v is WireDoc {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  if (typeof s["id"] !== "string" || typeof s["title"] !== "string") return false;
  if (!DEVICES.has(s["device"] as string)) return false;
  if (typeof s["html"] !== "string") return false;
  return true;
}

/** 한 제안이 스키마에 맞는가 — id·screenId string + doc이 WireDoc 스키마. */
export function isValidWireSuggestion(v: unknown): v is WireSuggestion {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  if (typeof s["id"] !== "string" || typeof s["screenId"] !== "string") return false;
  if (s["rationale"] !== undefined && typeof s["rationale"] !== "string") return false;
  return isValidWireDoc(s["doc"]);
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
function readApprovedWireframe(docsDir: string): WireDoc[] | null {
  const p = approvedWireframePath(docsDir);
  if (!existsSync(p)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(p, "utf-8"));
    if (!Array.isArray(parsed) || !parsed.every(isValidWireDoc)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** 승인분 원천 JSON 쓰기(RW 볼륨). 루트 디렉토리 자동 생성. 실패는 호출부가 catch(writeFailed). */
function writeApprovedWireframe(docsDir: string, docs: readonly WireDoc[]): void {
  const root = wireframeFeedbackRoot();
  if (!existsSync(root)) mkdirSync(root, { recursive: true });
  writeFileSync(approvedWireframePath(docsDir), JSON.stringify(docs, null, 2), "utf-8");
}

/**
 * 현재 와이어 원천(승인분 있으면 그것, 없으면 픽스처). apply의 merge 기준(base)과 렌더 원천이 같다.
 */
function currentWireframeBase(docsDir: string): WireDoc[] {
  return readApprovedWireframe(docsDir) ?? [...PLANNING_WIREFRAME_FIXTURE];
}

// ── invariant (화면 id 집합 보존, design D4) ──────────────────────────────────

/**
 * self-roundtrip 방어: 승인 반영 후 화면 id 집합이 반영 전과 동일한지 검증한다.
 * 승인은 기존 화면의 레이아웃 교체만 허용 — 화면이 사라지거나 새로 생기면(집합 변화) 위반.
 * 라인패치의 노드개수/capability 지문 비교(featureDocs)와 동형의 JSON판 불변식.
 */
export function wireframeInvariantHolds(
  before: readonly WireDoc[],
  after: readonly WireDoc[],
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
      merged.set(s.screenId, s.doc);
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
 * planning 와이어(WireDoc[] — 화면별 HTML 문서) 제공 — 승인분 원천이 있으면 그걸, 없으면 픽스처 폴백.
 * 렌더러·라우트·web은 화면별 HTML 문서를 sandbox iframe에 렌더한다. 승인분 JSON이 없거나 깨졌으면
 * 픽스처로 안전 폴백해 렌더가 죽지 않게 한다(throw 금지).
 */
export function buildDocsPlanningWireframe2(docsDir: string): readonly WireDoc[] {
  return readApprovedWireframe(docsDir) ?? PLANNING_WIREFRAME_FIXTURE;
}

// ── feedback write/read (사람→AI 역방향, A안 파일 릴레이 + 생애주기) ───────────

/** 주입 가능한 시계(테스트 안정성 — Date.now/new Date 직접 사용 금지). 기본=현재 ISO. */
export type NowIso = () => string;
const defaultNowIso: NowIso = () => new Date().toISOString();

/** 주입 가능한 id 생성기(테스트 안정성 — randomUUID 직접 사용 금지). 기본=crypto.randomUUID. */
export type GenId = () => string;
const defaultGenId: GenId = () => randomUUID();

/**
 * feedback 사이드카 raw 읽기(내부 — 하위호환 기본값 주입 전 원본 배열). 없거나 깨졌으면 빈 배열. throw 금지.
 * id/status가 없는 구버전 레코드도 그대로 반환한다(정규화는 normalizeFeedback가 담당).
 */
function readFeedbackSidecar(path: string): Record<string, unknown>[] {
  if (!existsSync(path)) return [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

/**
 * 구버전 레코드(id/status 없음)에 결정적 기본값을 주입해 WireFeedbackItem으로 정규화한다.
 * - status 없으면 "open". id 없으면 **결정적 파생**(`legacy-<index>-<ts>-<xPct>-<yPct>`) — 같은 레코드가
 *   read마다 같은 id를 얻어 resolve 대상 지정이 안정적이다(신규 난수 id를 매번 만들지 않음).
 * 기존 필드(screenId/text/ts/xPct/yPct/region)는 보존한다.
 */
function normalizeFeedback(raw: Record<string, unknown>, index: number): WireFeedbackItem {
  const status: WireFeedbackStatus = raw["status"] === "resolved" ? "resolved" : "open";
  const id =
    typeof raw["id"] === "string" && raw["id"].length > 0
      ? (raw["id"] as string)
      : `legacy-${index}-${String(raw["ts"] ?? "")}-${String(raw["xPct"] ?? "")}-${String(raw["yPct"] ?? "")}`;
  const item: WireFeedbackItem = {
    id,
    status,
    screenId: String(raw["screenId"] ?? ""),
    text: String(raw["text"] ?? ""),
    ts: String(raw["ts"] ?? ""),
    xPct: typeof raw["xPct"] === "number" ? (raw["xPct"] as number) : 0,
    yPct: typeof raw["yPct"] === "number" ? (raw["yPct"] as number) : 0,
    ...(typeof raw["region"] === "string" && (raw["region"] as string).length > 0
      ? { region: raw["region"] as string }
      : {}),
  };
  return item;
}

/** 좌표 %가 0~100 범위의 유한 숫자인가(범위 밖·NaN·Infinity 거부). */
function isValidPct(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
}

/**
 * 프로젝트의 핀 피드백 전체를 배열로 읽는다(flowforge-pin-feedback-lifecycle GET 원천).
 * id/status 없는 구버전 레코드에 결정적 기본값을 **읽을 때(lazy)** 주입한다 — 파일은 재기록하지 않는다
 * (부작용 최소; 첫 write가 일어날 때 정규화된 전체가 재기록되어 자연히 스키마 승격). throw 금지.
 */
export function readWireframeFeedback(docsDir: string, project: string): WireFeedbackItem[] {
  const path = feedbackSidecarPath(docsDir, project);
  return readFeedbackSidecar(path).map((raw, i) => normalizeFeedback(raw, i));
}

/**
 * 인플레이스 핀 피드백을 feedback 사이드카에 append(사람→AI 역방향, A안 파일 릴레이).
 * flowforge는 write만 하고 AI를 호출하지 않는다. Figma 코멘트식: 클릭한 좌표(xPct·yPct 0~100)에
 * 묶인 지점 단위 피드백. 저장 레코드에 **고유 id + status:"open"** 부여(flowforge-pin-feedback-lifecycle).
 * 빈 텍스트(공백만)·범위 밖 좌표는 거부(쓰레기 방지). ts·id는 주입 가능(테스트 안정성). read-modify-write.
 */
export function appendWireframeFeedback(
  docsDir: string,
  project: string,
  input: { screenId: string; text: string; xPct: number; yPct: number; region?: string },
  nowIso: NowIso = defaultNowIso,
  genId: GenId = defaultGenId,
): { ok: boolean } {
  const text = (input.text ?? "").trim();
  if (text.length === 0) return { ok: false };
  // 좌표 유효성 방어(0~100 밖·NaN·Infinity 거부) — 지점 단위 피드백은 좌표가 곧 의미.
  if (!isValidPct(input.xPct) || !isValidPct(input.yPct)) return { ok: false };
  // 미존재 화면 id 방어 — 현재 와이어(승인분/픽스처)에 없는 화면엔 피드백을 기록하지 않는다.
  const known = new Set(buildDocsPlanningWireframe2(docsDir).map((s) => s.id));
  if (!known.has(input.screenId)) return { ok: false };
  const item: WireFeedbackItem = {
    id: genId(),
    status: "open",
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
  // read-modify-write: 최신 파일을 정규화해 읽고 append 후 전체 재기록(구버전도 스키마 승격).
  const items = readFeedbackSidecar(path).map((raw, i) => normalizeFeedback(raw, i));
  items.push(item);
  writeFileSync(path, JSON.stringify(items, null, 2), "utf-8");
  return { ok: true };
}

/**
 * id로 지정한 피드백을 in-place 갱신한다(flowforge-pin-feedback-lifecycle — resolve 토글·텍스트 수정).
 * read-modify-write: 최신 파일을 정규화해 읽고 → id 매칭 레코드의 status/text만 패치(id·screenId·좌표
 * 보존) → 전체 재기록. 미매칭 id는 `{ok:false}`(라우트 404), 파일 불변. 빈 text 패치는 거부(쓰레기 방지).
 * 삭제가 아닌 soft-close라 이력이 보존된다. 단일 프로세스 sync write라 파일 잠금 불필요(D5).
 */
export function updateWireframeFeedback(
  docsDir: string,
  project: string,
  id: string,
  patch: { status?: WireFeedbackStatus; text?: string },
): { ok: boolean } {
  const path = feedbackSidecarPath(docsDir, project);
  if (!existsSync(path)) return { ok: false };
  // 빈 text 패치는 거부(공백만) — status 없이 text만 바꾸는 요청의 쓰레기 방지.
  if (patch.text !== undefined && patch.text.trim().length === 0) return { ok: false };
  const items = readFeedbackSidecar(path).map((raw, i) => normalizeFeedback(raw, i));
  const idx = items.findIndex((it) => it.id === id);
  if (idx === -1) return { ok: false };
  const current = items[idx] as WireFeedbackItem;
  const next: WireFeedbackItem = {
    ...current,
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.text !== undefined ? { text: patch.text.trim() } : {}),
  };
  items[idx] = next;
  writeFileSync(path, JSON.stringify(items, null, 2), "utf-8");
  return { ok: true };
}
