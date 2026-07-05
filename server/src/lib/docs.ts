/**
 * docs — charter 상주 docs(user-flow.md / PRD.md) 디렉토리 스캔 + 경로 안전 해석.
 *
 * 스캔 루트는 DOCS_ROOT 환경변수(기본=cwd). 루트 1단계 하위 <project>/docs/ 에
 * user-flow.md / PRD.md(charter 산출물) 또는 planning/prd.md(기획 단계 산출물)가
 * 하나라도 있으면 docs 프로젝트로 본다. lib/changes.ts와 같은
 * 경로 조작 방지 규칙(.. 금지 + 화이트리스트)을 그대로 재사용한다.
 *
 * 명세 문서(user-flow.md/PRD.md/planning/*.md)는 SSOT(charter·plan이 생성) — 읽기전용.
 * 단 기획 유저플로우의 **드래그 좌표 overlay**(planning/user-flow/<group>-vN.overlay.json)만
 * 예외로 여기서 쓴다(명세 .md는 절대 안 건드림 — changes.ts viz/graph-overlay.json 패턴).
 */
import { readdirSync, statSync, lstatSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
  LayoutOverlay,
  PrdSectionKey,
  PrdSuggestion,
  PrdSuggestionQueue,
  PrdApplyRequest,
  PrdApplyResult,
} from "@flowforge/shared";
import { splitSections } from "../parser/markdown.js";

/** docs 스캔 루트. 기본: cwd. */
export function docsRoot(): string {
  return process.env.DOCS_ROOT ?? process.cwd();
}

/**
 * docs/ 하위에 charter 산출물(user-flow.md / PRD.md) 또는 기획 산출물(planning/prd.md·
 * planning/features.md)이 하나라도 있으면 docs 프로젝트로 본다. planning-only 프로젝트(charter
 * 없이 기획 단계 산출물만 있는 경우)도 인식하기 위해 planning/prd.md·planning/features.md를 OR로
 * 포함한다 — 인식 경로는 planning-prd/planning-features 라우트·빌더가 읽는 경로와 동일하게 맞춘다.
 */
export function hasDocs(docsDir: string): boolean {
  return (
    existsSync(join(docsDir, "user-flow.md")) ||
    existsSync(join(docsDir, "PRD.md")) ||
    existsSync(join(docsDir, "planning", "prd.md")) ||
    existsSync(join(docsDir, "planning", "features.md"))
  );
}

/**
 * charter 프로젝트 이름 목록. 루트 1단계만 펼침(<project>/docs/...). 정렬.
 * 심볼릭 링크 프로젝트 디렉토리는 따라가지 않는다(SEC: 루트 밖 탈출 방지).
 */
export function listDocsProjects(): string[] {
  const root = docsRoot();
  if (!existsSync(root)) return [];
  const out: string[] = [];
  let names: string[];
  try {
    names = readdirSync(root).sort();
  } catch {
    return [];
  }
  for (const name of names) {
    const projDir = join(root, name);
    // 심볼릭 링크면 건너뜀(lstatSync로 링크 자체를 본다).
    try {
      if (lstatSync(projDir).isSymbolicLink()) continue;
    } catch {
      continue;
    }
    let st;
    try {
      st = statSync(projDir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    if (hasDocs(join(projDir, "docs"))) out.push(name);
  }
  return out;
}

/** project 이름 → 절대 docs 디렉토리 경로 (스캔 루트 밖 탈출 방지). 없거나 docs 부재면 null. */
export function resolveDocsDir(project: string): string | null {
  // 경로 조작 방지: '..' 금지 + 단일 세그먼트만(영숫자/-/_). 슬래시 불허 →
  // changes(archive/<name> 때문에 '/' 허용)와 달리 docs project는 1단계 디렉토리명이라
  // '/'를 막아 a/b/c 같은 추가 깊이 접근(:project(*) 와일드카드 경유)을 원천 차단한다.
  if (project.includes("..") || !/^[A-Za-z0-9_-]+$/.test(project)) return null;
  const dir = join(docsRoot(), project, "docs");
  if (!existsSync(dir) || !hasDocs(dir)) return null;
  return dir;
}

/** docs 디렉토리에서 파일 1개 읽기. 없거나 못 읽으면 null. */
export function readDocsFile(docsDir: string, name: string): string | null {
  const p = join(docsDir, name);
  if (!existsSync(p)) return null;
  try {
    return readFileSync(p, "utf-8");
  } catch {
    return null;
  }
}

// ── 기획 유저플로우 (planning/user-flow/) ──────────────────────────────
// 명세는 <group>-vN.md(Mermaid, 읽기전용), 좌표는 <group>-vN.overlay.json(읽기+쓰기).

/** user-flow 파일명 토큰(group/version) 화이트리스트: 영숫자/-/_ 만. '..'·슬래시 차단. */
export function isSafeFlowToken(s: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(s);
}

/** planning/user-flow 디렉토리 절대경로(없을 수도 있음 — 호출부에서 존재 확인). */
function userFlowDir(docsDir: string): string {
  return join(docsDir, "planning", "user-flow");
}

/** `<group>-vN.md` 목록(확장자 뗀 stem). user-flow 디렉토리 없으면 빈 배열. 정렬. */
export function listDocsUserFlows(docsDir: string): string[] {
  const dir = userFlowDir(docsDir);
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.slice(0, -3))
      .sort();
  } catch {
    return [];
  }
}

/** `<group>-vN.md`(Mermaid 명세) 읽기. 토큰 부정·파일 부재면 null. */
export function readDocsUserFlowSpec(docsDir: string, stem: string): string | null {
  if (!isSafeFlowToken(stem)) return null;
  return readDocsFile(userFlowDir(docsDir), `${stem}.md`);
}

/** `<group>-vN.overlay.json`(드래그 좌표) 읽기. 없거나 못 읽으면 null. */
export function readDocsUserFlowOverlay(docsDir: string, stem: string): LayoutOverlay | null {
  if (!isSafeFlowToken(stem)) return null;
  const p = join(userFlowDir(docsDir), `${stem}.overlay.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as LayoutOverlay;
  } catch {
    return null;
  }
}

/**
 * `<group>-vN.overlay.json`에 드래그 좌표 저장(docs 첫 쓰기 — 명세 .md는 안 건드림).
 * 토큰 부정이면 쓰지 않고 false. user-flow 디렉토리 자동 생성. 성공 시 true.
 */
export function writeDocsUserFlowOverlay(docsDir: string, stem: string, overlay: LayoutOverlay): boolean {
  if (!isSafeFlowToken(stem)) return false;
  const dir = userFlowDir(docsDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${stem}.overlay.json`), JSON.stringify(overlay, null, 2), "utf-8");
  return true;
}

// ── PRD 승인/반려 편집 (planning/prd.md + prd.suggestions.json) ──────────
// 명세 prd.md에 대한 flowforge의 첫 쓰기 — 단, "승인을 통해서만" 바뀐다(승인=사용자 의도).
// 제안 큐(AI/스킬이 씀)를 읽어 개별/일괄 승인 시 섹션 교체 반영, 반려는 원본 불변.

/** PRD 5섹션 키 ↔ prd.md 한국어 헤더(buildDocsPlanningPrd와 동일 순서·제목 — 정합 필수). */
const PRD_SECTION_ORDER: readonly (readonly [PrdSectionKey, string])[] = [
  ["overview", "개요"],
  ["value", "핵심가치"],
  ["target", "타겟·시나리오"],
  ["metrics", "성공지표"],
  ["attributes", "속성설정"],
];

const PRD_SECTION_KEYS: ReadonlySet<PrdSectionKey> = new Set(PRD_SECTION_ORDER.map(([k]) => k));

/** prd.suggestions.json 경로. */
function prdSuggestionsPath(docsDir: string): string {
  return join(docsDir, "planning", "prd.suggestions.json");
}

/** 한 제안이 스키마에 맞는가(section=5키·op="replace"·문자열 필드). 부정 데이터가 UI로 새지 않게. */
function isValidPrdSuggestion(v: unknown): v is PrdSuggestion {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s["id"] === "string" &&
    typeof s["section"] === "string" &&
    PRD_SECTION_KEYS.has(s["section"] as PrdSectionKey) &&
    s["op"] === "replace" &&
    typeof s["proposedBody"] === "string"
  );
}

/**
 * PRD 제안 큐 읽기. 파일 없음·깨진 JSON·미인식 항목은 모두 안전 폴백(빈 큐/필터).
 * 읽기는 절대 throw하지 않는다(라우트가 500으로 죽지 않게).
 */
export function readDocsPrdSuggestions(docsDir: string): PrdSuggestionQueue {
  const empty: PrdSuggestionQueue = { version: 1, suggestions: [] };
  const p = prdSuggestionsPath(docsDir);
  if (!existsSync(p)) return empty;
  try {
    const parsed: unknown = JSON.parse(readFileSync(p, "utf-8"));
    if (typeof parsed !== "object" || parsed === null) return empty;
    const raw = (parsed as Record<string, unknown>)["suggestions"];
    if (!Array.isArray(raw)) return empty;
    const suggestions = raw.filter(isValidPrdSuggestion);
    return { version: 1, suggestions };
  } catch {
    return empty;
  }
}

/** prd.suggestions.json 큐 쓰기(승인/반려 후 남은 제안 반영). planning 디렉토리 자동 생성. */
function writeDocsPrdSuggestions(docsDir: string, queue: PrdSuggestionQueue): void {
  const dir = join(docsDir, "planning");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(prdSuggestionsPath(docsDir), JSON.stringify(queue, null, 2), "utf-8");
}

/**
 * 승인된 섹션 교체로 prd.md 재작성. 첫 H2(`## 개요`) 앞 서문(H1 title 포함)을 그대로 보존하고,
 * 5섹션을 고정 순서로 조립하되 replacements에 있는 섹션만 새 본문으로 교체한다.
 * prd.md가 없거나 5섹션 파싱이 실패하면 false(안 씀 — 원본 보호). 성공 시 원자적 전체 write 후 true.
 *
 * 🔒 데이터 손상 방어: 조립 결과(out)를 write **전에** 재파싱해 정확히 원래 5섹션 키로만
 * 갈리는지 self-check한다. 어떤 섹션의 새 본문(replacements의 proposedBody)에 줄 시작 `## `가
 * 섞여 있으면 다음 파싱에서 가짜 섹션으로 오분리돼 후속 승인 시 본문이 소실될 수 있다 →
 * 그런 out은 쓰지 않고 false(원본 보호). 승인 반영이 prd.md 구조를 절대 깨지 않게 하는 불변식.
 */
export function writeDocsPlanningPrd(
  docsDir: string,
  replacements: Partial<Record<PrdSectionKey, string>>,
): boolean {
  const path = join(docsDir, "planning", "prd.md");
  if (!existsSync(path)) return false;
  let original: string;
  try {
    original = readFileSync(path, "utf-8");
  } catch {
    return false;
  }
  const sectionsMap = splitSections(original);
  // 5섹션이 하나라도 파싱 안 되면 손상 상태 — 쓰지 않는다(원본 보호).
  for (const [, title] of PRD_SECTION_ORDER) {
    if (!sectionsMap.has(title.toLowerCase())) return false;
  }
  // 첫 H2 이전(서문=H1 title 등)을 원문에서 그대로 떼어 보존.
  const firstH2 = original.search(/^##\s+/m);
  const preamble = firstH2 >= 0 ? original.slice(0, firstH2).replace(/\s+$/, "") : "";

  const blocks = PRD_SECTION_ORDER.map(([key, title]) => {
    const body = replacements[key] ?? sectionsMap.get(title.toLowerCase()) ?? "";
    return `## ${title}\n\n${body}`.replace(/\s+$/, "");
  });

  const out = (preamble ? `${preamble}\n\n` : "") + blocks.join("\n\n") + "\n";

  // 🔒 self-roundtrip: out을 재파싱해 정확히 원래 5섹션 키만 나오는지 검증.
  // 새 본문에 `## `가 섞여 섹션이 늘거나 키가 바뀌면 쓰지 않는다(원본 보호).
  const roundtrip = splitSections(out);
  if (roundtrip.size !== PRD_SECTION_ORDER.length) return false;
  for (const [, title] of PRD_SECTION_ORDER) {
    if (!roundtrip.has(title.toLowerCase())) return false;
  }

  writeFileSync(path, out, "utf-8");
  return true;
}

/**
 * 승인/반려 적용. approve id는 섹션 교체 반영 후 큐에서 제거, reject id는 반영 없이 제거.
 * 미실재 id·미실재 섹션·쓰기 실패는 skipped로 표면화(silent drop 금지). 원본 파싱 실패 시 반영 0.
 * 같은 섹션 여러 승인은 큐 배열 순서(뒤가 최종)로 결정론적 반영.
 */
export function applyPrdSuggestions(docsDir: string, req: PrdApplyRequest): PrdApplyResult {
  const queue = readDocsPrdSuggestions(docsDir);
  const byId = new Map(queue.suggestions.map((s) => [s.id, s]));
  const skipped: string[] = [];

  // 승인: 큐 배열 순서를 따라 섹션→본문 맵 구성(뒤가 이김). 미실재 id는 skipped.
  const approveSet = new Set(req.approve);
  const replacements: Partial<Record<PrdSectionKey, string>> = {};
  const approvedIds: string[] = [];
  for (const s of queue.suggestions) {
    if (!approveSet.has(s.id)) continue;
    replacements[s.section] = s.proposedBody;
    approvedIds.push(s.id);
  }
  for (const id of req.approve) {
    if (!byId.has(id)) skipped.push(id);
  }

  let applied = 0;
  let writeFailed = false;
  if (Object.keys(replacements).length > 0) {
    const ok = writeDocsPlanningPrd(docsDir, replacements);
    if (ok) {
      applied = Object.keys(replacements).length;
    } else {
      // 원본 파싱/쓰기 실패 = 원본 손상 신호. 미실재 id(skipped)와 구분해 writeFailed로 표면화.
      // 큐를 통째로 보존하고(승인·반려 모두 미적용) 반환 → 라우트가 422로 변환.
      writeFailed = true;
    }
  }

  if (writeFailed) {
    return { applied: 0, rejected: 0, remaining: queue.suggestions.length, skipped, writeFailed: true };
  }

  // 반려: 반영 없이 제거. 미실재 id는 skipped.
  const rejectedIds: string[] = [];
  for (const id of req.reject) {
    if (byId.has(id)) rejectedIds.push(id);
    else skipped.push(id);
  }

  // 큐 재작성: 승인 반영분(approvedIds) + 반려분 제거.
  const removed = new Set<string>([...approvedIds, ...rejectedIds]);
  const remainingSuggestions = queue.suggestions.filter((s) => !removed.has(s.id));
  writeDocsPrdSuggestions(docsDir, { version: 1, suggestions: remainingSuggestions });

  return {
    applied,
    rejected: rejectedIds.length,
    remaining: remainingSuggestions.length,
    skipped,
  };
}

/** POST apply body 런타임 검증: {approve:string[], reject:string[]}. isLayoutOverlay 패턴 복제. */
export function isPrdApplyRequest(v: unknown): v is PrdApplyRequest {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  const strArr = (x: unknown): boolean => Array.isArray(x) && x.every((e) => typeof e === "string");
  return strArr(o["approve"]) && strArr(o["reject"]);
}
