/**
 * userFlowDocs — 유저플로우 에지 추가 승인/반려 편집 (planning/user-flow/<stem>.md + <stem>.suggestions.json).
 *
 * 6b-userflow. 6b(features)의 featureDocs가 원형이나, features가 "속성 라인 제자리 교체"인 반면
 * 유저플로우는 "첫 mermaid 블록 끝에 에지 한 줄 append"라 반영 단위가 다르다 → 별 파일로 분리
 * (성급한 공통화 금지 — design lazy hierarchy). AI(스킬)가 per-stem 사이드카 큐에 에지 추가 제안을
 * 쌓고, 개별/일괄 승인 시 결정론 검증(from/to 존재·id 충돌·라벨 금지문자·중복 에지)을 통과한 것만
 * 닫는 펜스 직전에 append(D-2), 반려는 원본 바이트 불변. 기존 줄 수정/삭제는 스코프 밖(D-1).
 *
 * D-5 self-roundtrip: append 결과를 buildUserFlowFromLines로 재파싱해 기존 노드·엣지가 전부
 * 보존되고 정확히 승인분 에지만 늘었는지 확인 후에만 write(위반=writeFailed, 라우트가 422).
 * server(큐 read/apply)와 web(승인 UI)이 공유하는 타입은 shared. apply body/result는 6a의
 * PrdApplyRequest/PrdApplyResult를 재사용한다.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
  PrdApplyRequest,
  PrdApplyResult,
  UserFlowSuggestion,
  UserFlowSuggestionQueue,
} from "@flowforge/shared";
import { isSafeFlowToken } from "./docs.js";
import { detectEol } from "./eol.js";
import { buildUserFlowFromLines, findFirstMermaidBlock } from "../parser/planningUserFlowBuilder.js";
import type { UserFlowParse, UserFlowRawEdge } from "../parser/planningUserFlowBuilder.js";

/** 신규 노드 mermaid id 화이트리스트 — 파서 RE_EDGE의 id 문자집합과 동일해야 한다. */
const RE_NEW_NODE_ID = /^[A-Za-z0-9_]+$/;
/** 라벨 금지문자(D-4): `"`·`|`·개행 — mermaid 라벨/에지 문법을 깨는 문자만 최소 금지. */
const RE_FORBIDDEN_LABEL = /["|\n\r]/;

/** <stem>.suggestions.json 경로(<stem>.md·<stem>.overlay.json 옆 사이드카). */
function suggestionsPath(docsDir: string, stem: string): string {
  return join(docsDir, "planning", "user-flow", `${stem}.suggestions.json`);
}

/** newNode가 {id,label} 문자열 쌍인가. */
function isValidNewNode(v: unknown): v is { id: string; label: string } {
  if (typeof v !== "object" || v === null) return false;
  const n = v as Record<string, unknown>;
  return typeof n["id"] === "string" && typeof n["label"] === "string";
}

/**
 * 한 제안이 스키마에 맞는가 — id/op='add-edge'/from 문자열, edgeKind 어휘 내,
 * 그리고 to(기존 노드)·newNode(신규 노드) 중 **정확히 하나**(둘 다·둘 다 없음 → 무효).
 */
function isValidUserFlowSuggestion(v: unknown): v is UserFlowSuggestion {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  if (typeof s["id"] !== "string" || s["op"] !== "add-edge") return false;
  if (typeof s["from"] !== "string") return false;
  if (s["edgeKind"] !== "happy" && s["edgeKind"] !== "edgecase") return false;
  if (s["label"] !== undefined && typeof s["label"] !== "string") return false;
  if (s["to"] !== undefined && typeof s["to"] !== "string") return false;
  if (s["newNode"] !== undefined && !isValidNewNode(s["newNode"])) return false;
  const hasTo = s["to"] !== undefined;
  const hasNew = s["newNode"] !== undefined;
  return hasTo !== hasNew; // 정확히 하나
}

/**
 * 유저플로우 제안 큐 읽기. 파일 없음·깨진 JSON·미인식 항목·불안전 stem은 모두 안전 폴백
 * (빈 큐/필터). 읽기는 절대 throw하지 않는다(라우트가 500으로 죽지 않게).
 */
export function readUserFlowSuggestions(docsDir: string, stem: string): UserFlowSuggestionQueue {
  const empty: UserFlowSuggestionQueue = { version: 1, suggestions: [] };
  if (!isSafeFlowToken(stem)) return empty;
  const p = suggestionsPath(docsDir, stem);
  if (!existsSync(p)) return empty;
  try {
    const parsed: unknown = JSON.parse(readFileSync(p, "utf-8"));
    if (typeof parsed !== "object" || parsed === null) return empty;
    const raw = (parsed as Record<string, unknown>)["suggestions"];
    if (!Array.isArray(raw)) return empty;
    // id 유일성 보장(first-occurrence-wins): 같은 id가 두 번 들어오면 첫 제안만 남긴다 —
    // 승인 id 하나가 두 큐 항목을 매칭해 에지가 중복 반영되는 것을 읽기 단계에서 차단한다.
    const seen = new Set<string>();
    const suggestions = raw.filter(isValidUserFlowSuggestion).filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    return { version: 1, suggestions };
  } catch {
    return empty;
  }
}

/** <stem>.suggestions.json 큐 쓰기(승인/반려 후 남은 제안 반영). 디렉토리 자동 생성. */
function writeUserFlowSuggestions(docsDir: string, stem: string, queue: UserFlowSuggestionQueue): void {
  const dir = join(docsDir, "planning", "user-flow");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(suggestionsPath(docsDir, stem), JSON.stringify(queue, null, 2), "utf-8");
}

/** 제안 → append할 에지 라인. happy `-->`/edgecase `-.->`, 라벨 없으면 `From --> To`(D-2/D-3). */
function renderEdgeLine(s: UserFlowSuggestion): string {
  const arrow = s.edgeKind === "edgecase" ? "-.->" : "-->";
  const label = (s.label ?? "").trim();
  const mid = label ? `${arrow}|${label}|` : arrow;
  const target = s.newNode ? `${s.newNode.id}["${s.newNode.label}"]` : (s.to ?? "");
  return `  ${s.from} ${mid} ${target}`;
}

/** 배치 진행 중 문서 상태(기존 + 이번에 추가된 노드/에지) — 배치 내 중복·충돌도 잡는다. */
interface ApplyState {
  readonly nodeIds: Set<string>;
  readonly nodeIdsLower: Set<string>;
  readonly edgeKeys: Set<string>; // `from\0to\0kind` — 중복 판정은 라벨 무시(D 결정)
}

function edgeKey(from: string, to: string, kind: string): string {
  return [from, to, kind].join("\u0000");
}

/** 결정론 검증(D-4 포함). 위반이면 skip 사유 문자열, 통과면 null. */
function violationReason(s: UserFlowSuggestion, st: ApplyState): string | null {
  if (!st.nodeIds.has(s.from)) return "from-not-in-doc";
  if (s.label !== undefined && RE_FORBIDDEN_LABEL.test(s.label)) return "label-forbidden-char";
  if (s.newNode) {
    if (!RE_NEW_NODE_ID.test(s.newNode.id)) return "newNode-id-invalid";
    if (st.nodeIdsLower.has(s.newNode.id.toLowerCase())) return "newNode-id-collision";
    if (RE_FORBIDDEN_LABEL.test(s.newNode.label)) return "newNode-label-forbidden-char";
  } else if (!st.nodeIds.has(s.to ?? "")) {
    return "to-not-in-doc";
  }
  const to = s.newNode ? s.newNode.id : (s.to ?? "");
  if (st.edgeKeys.has(edgeKey(s.from, to, s.edgeKind))) return "duplicate-edge";
  return null;
}

/** 승인 반영으로 늘어나야 하는 에지(+ newNode면 기대 라벨). roundtrip 가드 비교용. */
export interface ExpectedNewEdge extends UserFlowRawEdge {
  readonly newNodeLabel?: string;
}

/**
 * D-5 self-roundtrip 방어: append 후 lines를 재파싱해 (1) 파싱 성공 (2) 기존 노드(raw id·라벨)
 * 전부 보존 (3) 기존 에지(from·to·kind·label) 전부 보존 (4) 정확히 승인분 에지만 제안대로
 * 추가됐는지(멀티셋 일치) 검증한다. 하나라도 깨지면 false → apply가 write하지 않는다(라우트 422).
 * featureDocs의 지문(개수) 비교보다 강한 완전 비교 — append 한 줄이 파서를 오염시키면 잡는다.
 */
export function userFlowInvariantHolds(
  before: UserFlowParse,
  afterLines: readonly string[],
  expectedNewEdges: readonly ExpectedNewEdge[],
): boolean {
  let after: UserFlowParse;
  try {
    after = buildUserFlowFromLines(afterLines);
  } catch {
    return false; // (1) 재파싱 실패 = append가 문서를 깨뜨림
  }
  // (2) 기존 노드 보존: raw id와 라벨이 모두 그대로여야 한다.
  for (const [id, label] of before.rawNodes) {
    if (after.rawNodes.get(id) !== label) return false;
  }
  // 신규 노드는 제안한 라벨 그대로 정의됐어야 한다(인라인 정의 라벨 잘림 감지).
  for (const e of expectedNewEdges) {
    if (e.newNodeLabel !== undefined && after.rawNodes.get(e.to) !== e.newNodeLabel) return false;
  }
  // (3)+(4) 에지 멀티셋 완전 일치: before + expected == after.
  const key = (e: UserFlowRawEdge): string => [e.from, e.to, e.kind, e.label].join("\u0000");
  const budget = new Map<string, number>();
  for (const e of [...before.rawEdges, ...expectedNewEdges]) budget.set(key(e), (budget.get(key(e)) ?? 0) + 1);
  for (const e of after.rawEdges) {
    const c = budget.get(key(e)) ?? 0;
    if (c <= 0) return false; // 기대에 없는 에지가 생김
    budget.set(key(e), c - 1);
  }
  for (const c of budget.values()) if (c !== 0) return false; // 있어야 할 에지가 사라짐/누락
  return true;
}

/** 승인 배치를 lines에 append. skipped는 밖의 배열에 누적, 반영 내역을 반환한다. */
function patchApprovedEdges(
  lines: string[],
  willApply: readonly UserFlowSuggestion[],
  before: UserFlowParse,
  skipped: string[],
): { approvedIds: string[]; expected: ExpectedNewEdge[] } {
  // D-4 단일 감지: 파서와 같은 findFirstMermaidBlock으로 append 위치를 정한다(null=블록 없음 → -1).
  let closeIdx = findFirstMermaidBlock(lines)?.closeIdx ?? -1;
  const st: ApplyState = {
    nodeIds: new Set(before.rawNodes.keys()),
    nodeIdsLower: new Set([...before.rawNodes.keys()].map((k) => k.toLowerCase())),
    edgeKeys: new Set(before.rawEdges.map((e) => edgeKey(e.from, e.to, e.kind))),
  };
  const approvedIds: string[] = [];
  const expected: ExpectedNewEdge[] = [];
  for (const s of willApply) {
    // mermaid 블록이 없으면 지어내지 않는다(D-2) → 전부 skipped(사유 표면화, D-7).
    if (closeIdx < 0) {
      skipped.push(`${s.id}: no-mermaid-block`);
      continue;
    }
    const reason = violationReason(s, st);
    if (reason !== null) {
      skipped.push(`${s.id}: ${reason}`);
      continue;
    }
    const to = s.newNode ? s.newNode.id : (s.to ?? "");
    const expectedOne: ExpectedNewEdge = {
      from: s.from,
      to,
      kind: s.edgeKind,
      label: (s.label ?? "").trim(),
      ...(s.newNode ? { newNodeLabel: s.newNode.label } : {}),
    };
    // 제안별 사전 roundtrip(D-5의 개별판): D-4 금지문자 밖의 파서 오염 문자(`[`·`]`·백틱 등)가
    // 배치 전체를 사유 없는 422로 독살하는 것을 차단 — 시험 append가 재파싱 불일치면 이 제안만 skip.
    const trial = [...lines];
    trial.splice(closeIdx, 0, renderEdgeLine(s));
    if (!userFlowInvariantHolds(before, trial, [...expected, expectedOne])) {
      skipped.push(`${s.id}: label-not-parse-safe`);
      continue;
    }
    lines.splice(closeIdx, 0, renderEdgeLine(s));
    closeIdx++;
    if (s.newNode) {
      st.nodeIds.add(s.newNode.id);
      st.nodeIdsLower.add(s.newNode.id.toLowerCase());
    }
    st.edgeKeys.add(edgeKey(s.from, to, s.edgeKind));
    expected.push(expectedOne);
    approvedIds.push(s.id);
  }
  return { approvedIds, expected };
}

/** 원본 보호 실패 결과(문서·큐 모두 불변) — 라우트가 422로 변환한다. */
function failResult(queue: UserFlowSuggestionQueue, skipped: readonly string[]): PrdApplyResult {
  return { applied: 0, rejected: 0, remaining: queue.suggestions.length, skipped, writeFailed: true };
}

/**
 * 승인/반려 적용. approve id는 에지 append 반영 후 큐에서 제거, reject id는 반영 없이 제거
 * (문서 바이트 불변). 검증 위반·미실재 id는 skipped로 표면화(silent drop 금지).
 * <stem>.md 부재·roundtrip 위반·쓰기 실패는 writeFailed=true로 큐 통째 보존(원본 보호).
 */
export function applyUserFlowSuggestions(docsDir: string, stem: string, req: PrdApplyRequest): PrdApplyResult {
  // 불안전 stem이면 어떤 경로에도 쓰지 않는다(경로 이탈 차단).
  if (!isSafeFlowToken(stem)) {
    const skippedAll = [...req.approve, ...req.reject].map((id) => `${id}: unsafe-stem`);
    return { applied: 0, rejected: 0, remaining: 0, skipped: skippedAll, writeFailed: true };
  }
  const queue = readUserFlowSuggestions(docsDir, stem);
  const byId = new Map(queue.suggestions.map((s) => [s.id, s]));
  // skipped 엔트리 형식은 `"<id>: <reason>"` — spec THEN "사유와 함께" + design D-7 준수.
  const skipped: string[] = [];
  for (const id of req.approve) if (!byId.has(id)) skipped.push(`${id}: not-in-queue`);

  const approveSet = new Set(req.approve);
  const willApply = queue.suggestions.filter((s) => approveSet.has(s.id));
  let approvedIds: string[] = [];

  if (willApply.length > 0) {
    const mdPath = join(docsDir, "planning", "user-flow", `${stem}.md`);
    if (!existsSync(mdPath)) return failResult(queue, skipped);
    let lines: string[];
    let eol: "\r\n" | "\n"; // 읽을 때 감지한 EOL을 쓸 때 복원(CRLF 보존 — lib/eol.ts)
    try {
      const raw = readFileSync(mdPath, "utf-8");
      eol = detectEol(raw);
      lines = raw.split(/\r?\n/);
    } catch {
      return failResult(queue, skipped);
    }
    const before = buildUserFlowFromLines(lines); // 패치 전 상태(검증 기준 + roundtrip 비교 기준)
    const patched = patchApprovedEdges(lines, willApply, before, skipped);
    approvedIds = patched.approvedIds;
    if (approvedIds.length > 0) {
      if (!userFlowInvariantHolds(before, lines, patched.expected)) return failResult(queue, skipped);
      try {
        writeFileSync(mdPath, lines.join(eol), "utf-8");
      } catch {
        return failResult(queue, skipped);
      }
    }
  }

  // 반려: 반영 없이 제거. 미실재 id는 skipped.
  const rejectedIds: string[] = [];
  for (const id of req.reject) {
    if (byId.has(id)) rejectedIds.push(id);
    else skipped.push(`${id}: not-in-queue`);
  }

  // 큐 재작성: 승인 반영분 + 반려분만 제거(검증 위반 skipped는 큐에 남긴다).
  // D-2: 시작 스냅샷이 아니라 쓰기 직전 재독본에서 차집합 — apply 진행 중
  // AI가 추가한 신규 제안이 통삭제되는 silent drop 창을 닫는다.
  const removed = new Set<string>([...approvedIds, ...rejectedIds]);
  // 본문(.md) 반영은 이미 위에서 성공(또는 반려만)했다. 큐 정리(prune) 쓰기가 실패해도
  // 문서는 되돌릴 수 없으므로 라우트를 500(safe throw)으로 몰지 않고 200-형으로 응답하되,
  // 큐가 디스크에 그대로 남았음을 queuePruneFailed로 표면화한다(재승인은 duplicate-edge로
  // 멱등 skip → 재동기화 신호). read는 절대 throw하지 않으므로 remaining을 안전히 재계산한다.
  try {
    const remaining = pruneUserFlowQueue(docsDir, stem, removed);
    return { applied: approvedIds.length, rejected: rejectedIds.length, remaining, skipped };
  } catch {
    const remaining = readUserFlowSuggestions(docsDir, stem).suggestions.length;
    return { applied: approvedIds.length, rejected: rejectedIds.length, remaining, skipped, queuePruneFailed: true };
  }
}

/**
 * 큐 파일을 신선하게 재독해 처리된 id만 제거하고 나머지(재독본에만 있는 신규
 * 제안 포함)를 보존해 재작성한다(D-2). 남은 제안 수를 반환.
 * apply가 동기 함수라 외부에서 경합을 주입할 수 없어, "재독 후 차집합" 계약은
 * 이 헬퍼 단위 테스트로 박제한다(파일 락은 Non-Goal — 로컬 단일 사용자 전제).
 */
export function pruneUserFlowQueue(docsDir: string, stem: string, processedIds: ReadonlySet<string>): number {
  const fresh = readUserFlowSuggestions(docsDir, stem);
  const remainingSuggestions = fresh.suggestions.filter((s) => !processedIds.has(s.id));
  writeUserFlowSuggestions(docsDir, stem, { version: 1, suggestions: remainingSuggestions });
  return remainingSuggestions.length;
}
