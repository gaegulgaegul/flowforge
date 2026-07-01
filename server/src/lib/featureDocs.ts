/**
 * featureDocs — 기능명세(features) 승인/반려 편집 (planning/features.md + features.suggestions.json).
 *
 * 6b 예광탄. 6a(PRD)의 lib/docs.ts 승인 로직이 원형이나, PRD가 "섹션 통째 교체"인 반면
 * features는 "노드 속성(중요도·상태) 라인만 교체"라 반영 단위가 다르다 → 별 파일로 분리
 * (docs.ts 400줄 상한·책임 분리). 큐(AI/스킬이 씀)를 읽어 개별/일괄 승인 시 해당 노드의
 * 속성 라인만 교체 반영, 반려는 원본 불변. 명세 features.md에 대한 flowforge의 쓰기는
 * "승인을 통해서만"으로 제한한다(승인=사용자 의도). 라벨·본문·자식은 절대 안 건드린다.
 *
 * server(큐 read/apply)와 web(승인 UI)이 공유하는 타입은 shared. apply body/result는 6a의
 * PrdApplyRequest/PrdApplyResult를 재사용한다(형태 동일 — approve[]/reject[] → 반영/제거 수).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
  FeaturePriority,
  FeatureStatus,
  FeatureSuggestion,
  FeatureSuggestionQueue,
  PrdApplyRequest,
  PrdApplyResult,
} from "@flowforge/shared";

// featureTreeBuilder.ts와 동일 문법(정합 필수): ## 요구사항 / ### 기능 / #### 상세기능 헤더,
// 그리고 헤더 직후 줄의 `(중요도: …, 상태: …)` 속성 줄(줄 전체 앵커).
const RE_HEADER = /^(#{2,4})\s+(.+?)\s*$/;
const RE_ATTRS = /^\s*\(\s*중요도:\s*(?:낮음|중간|높음)?\s*,\s*상태:\s*(?:시작전|진행중|완료|중단)?\s*\)\s*$/;

const PRIORITIES: ReadonlySet<string> = new Set<FeaturePriority>(["낮음", "중간", "높음"]);
const STATUSES: ReadonlySet<string> = new Set<FeatureStatus>(["시작전", "진행중", "완료", "중단"]);

/** features.suggestions.json 경로. */
function featureSuggestionsPath(docsDir: string): string {
  return join(docsDir, "planning", "features.suggestions.json");
}

/** 한 제안이 스키마에 맞는가(op="set-attrs"·nodePath=string[]·priority/status는 있으면 어휘 내). */
function isValidFeatureSuggestion(v: unknown): v is FeatureSuggestion {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  if (typeof s["id"] !== "string" || s["op"] !== "set-attrs") return false;
  const path = s["nodePath"];
  if (!Array.isArray(path) || path.length === 0 || !path.every((e) => typeof e === "string")) return false;
  if (s["priority"] !== undefined && !PRIORITIES.has(s["priority"] as string)) return false;
  if (s["status"] !== undefined && !STATUSES.has(s["status"] as string)) return false;
  return true;
}

/**
 * 기능명세 제안 큐 읽기. 파일 없음·깨진 JSON·미인식 항목은 모두 안전 폴백(빈 큐/필터).
 * 읽기는 절대 throw하지 않는다(라우트가 500으로 죽지 않게).
 */
export function readDocsFeatureSuggestions(docsDir: string): FeatureSuggestionQueue {
  const empty: FeatureSuggestionQueue = { version: 1, suggestions: [] };
  const p = featureSuggestionsPath(docsDir);
  if (!existsSync(p)) return empty;
  try {
    const parsed: unknown = JSON.parse(readFileSync(p, "utf-8"));
    if (typeof parsed !== "object" || parsed === null) return empty;
    const raw = (parsed as Record<string, unknown>)["suggestions"];
    if (!Array.isArray(raw)) return empty;
    return { version: 1, suggestions: raw.filter(isValidFeatureSuggestion) };
  } catch {
    return empty;
  }
}

/** features.suggestions.json 큐 쓰기(승인/반려 후 남은 제안 반영). planning 디렉토리 자동 생성. */
function writeDocsFeatureSuggestions(docsDir: string, queue: FeatureSuggestionQueue): void {
  const dir = join(docsDir, "planning");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(featureSuggestionsPath(docsDir), JSON.stringify(queue, null, 2), "utf-8");
}

/**
 * nodePath(헤더 원문 라벨 경로)로 features.md 라인에서 그 노드의 헤더 줄 인덱스를 찾는다.
 * 위계를 따라 순차 매칭: level 2에서 path[0], 그 다음 헤더 블록 안 level 3에서 path[1] … .
 * 못 찾으면 -1. label은 헤더 원문 그대로 비교(파서가 label로 쓰는 값과 동치).
 */
function findNodeHeaderLine(lines: readonly string[], nodePath: readonly string[]): number {
  let depth = 0; // 다음에 찾을 nodePath 인덱스
  let targetLevel = 2; // 요구사항=2, 기능=3, 상세기능=4
  let found = -1;
  for (let i = 0; i < lines.length; i++) {
    const h = (lines[i] ?? "").match(RE_HEADER);
    if (!h) continue;
    const level = (h[1] ?? "").length;
    const label = h[2] ?? "";
    if (level < targetLevel) return -1; // 상위로 올라가면 경로 이탈(자식 밖) → 실패
    if (level !== targetLevel) continue; // 더 깊은 형제/자식은 건너뜀(현재 타깃 레벨만)
    if (label !== nodePath[depth]) continue;
    depth++;
    if (depth === nodePath.length) {
      found = i;
      break;
    }
    targetLevel++;
  }
  return depth === nodePath.length ? found : -1;
}

/** priority/status로 속성 줄 문자열 생성. 둘 다 없으면 null(속성 줄 불필요). */
function renderAttrLine(priority: FeaturePriority | "", status: FeatureStatus | ""): string | null {
  if (!priority && !status) return null;
  return `(중요도: ${priority}, 상태: ${status})`;
}

/**
 * 헤더 줄(headerIdx) 바로 아래 블록에서 속성 줄을 새 priority/status로 교체(제자리).
 * priority/status가 생략된 건 기존 값 유지. 속성 줄이 없으면 헤더 바로 다음 줄에 삽입.
 * lines를 in-place 수정하고 성공하면 true. 형식 이상(없음)만 반영이라 항상 안전.
 */
function setNodeAttrs(lines: string[], headerIdx: number, next: FeatureSuggestion): void {
  // 이 헤더 블록의 끝(다음 헤더 전)까지 스캔해 기존 속성 줄을 찾는다.
  let attrIdx = -1;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (RE_HEADER.test(lines[i] ?? "")) break; // 다음 노드 진입
    if (RE_ATTRS.test(lines[i] ?? "")) {
      attrIdx = i;
      break;
    }
  }
  const existing = attrIdx >= 0 ? parseAttrLine(lines[attrIdx] ?? "") : { priority: "" as const, status: "" as const };
  const priority = next.priority ?? existing.priority;
  const status = next.status ?? existing.status;
  const rendered = renderAttrLine(priority, status);
  if (rendered === null) return; // 교체할 내용 없음(비정상 — 검증에서 걸러짐)
  if (attrIdx >= 0) {
    lines[attrIdx] = rendered; // 제자리 교체(라벨·본문·자식 불변)
  } else {
    lines.splice(headerIdx + 1, 0, rendered); // 속성 줄 없던 노드엔 헤더 직후 삽입
  }
}

/** 속성 줄 → {priority,status}. featureTreeBuilder RE_ATTRS와 동일 어휘. */
function parseAttrLine(line: string): { priority: FeaturePriority | ""; status: FeatureStatus | "" } {
  const m = line.match(/^\s*\(\s*중요도:\s*(낮음|중간|높음)?\s*,\s*상태:\s*(시작전|진행중|완료|중단)?\s*\)\s*$/);
  return {
    priority: (m?.[1] as FeaturePriority | undefined) ?? "",
    status: (m?.[2] as FeatureStatus | undefined) ?? "",
  };
}

/**
 * 승인/반려 적용. approve id는 노드 속성 교체 반영 후 큐에서 제거, reject id는 반영 없이 제거.
 * 미실재 id·nodePath로 못 찾은 노드·쓰기 실패는 skipped/writeFailed로 표면화(silent drop 금지).
 * features.md 자체를 못 읽거나 쓰기 실패면 writeFailed=true로 큐 통째 보존(원본 보호 → 라우트 422).
 */
export function applyFeatureSuggestions(docsDir: string, req: PrdApplyRequest): PrdApplyResult {
  const queue = readDocsFeatureSuggestions(docsDir);
  const byId = new Map(queue.suggestions.map((s) => [s.id, s]));
  const skipped: string[] = [];
  const path = join(docsDir, "planning", "features.md");

  const approveSet = new Set(req.approve);
  const approvedIds: string[] = [];
  for (const id of req.approve) {
    if (!byId.has(id)) skipped.push(id);
  }

  let applied = 0;
  const willApply = queue.suggestions.filter((s) => approveSet.has(s.id));
  if (willApply.length > 0) {
    if (!existsSync(path)) {
      return { applied: 0, rejected: 0, remaining: queue.suggestions.length, skipped, writeFailed: true };
    }
    let lines: string[];
    try {
      lines = readFileSync(path, "utf-8").split(/\r?\n/);
    } catch {
      return { applied: 0, rejected: 0, remaining: queue.suggestions.length, skipped, writeFailed: true };
    }
    // 큐 배열 순서로 반영(같은 노드 여러 승인은 뒤가 최종 — 결정론). 못 찾은 노드는 skipped.
    for (const s of willApply) {
      const headerIdx = findNodeHeaderLine(lines, s.nodePath);
      if (headerIdx < 0) {
        skipped.push(s.id);
        continue;
      }
      setNodeAttrs(lines, headerIdx, s);
      applied++;
      approvedIds.push(s.id);
    }
    if (applied > 0) {
      try {
        writeFileSync(path, lines.join("\n"), "utf-8");
      } catch {
        return { applied: 0, rejected: 0, remaining: queue.suggestions.length, skipped, writeFailed: true };
      }
    }
  }

  // 반려: 반영 없이 제거. 미실재 id는 skipped.
  const rejectedIds: string[] = [];
  for (const id of req.reject) {
    if (byId.has(id)) rejectedIds.push(id);
    else skipped.push(id);
  }

  // 큐 재작성: 승인 반영분(approvedIds) + 반려분 제거(못 찾은 승인은 큐에 남긴다).
  const removed = new Set<string>([...approvedIds, ...rejectedIds]);
  const remainingSuggestions = queue.suggestions.filter((s) => !removed.has(s.id));
  writeDocsFeatureSuggestions(docsDir, { version: 1, suggestions: remainingSuggestions });

  return { applied, rejected: rejectedIds.length, remaining: remainingSuggestions.length, skipped };
}
