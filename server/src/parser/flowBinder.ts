/**
 * flowBinder — THEN 문장의 화면 전이 바인딩 (Python flow_target/screen_aliases/is_screen_spec 포팅)
 *
 * 한글-aware. NAV_RE/NONNAV_RE/DEST_HINT_RE/EN_KO 사전·self-loop 방지를 원본 그대로 이식한다.
 * 골든 테스트로 Python 동치 박제(한글 NAV·dangling·self-loop 엣지케이스 재발견 방지).
 */
import type { ParsedSpec } from "./specParser.js";
import { slug } from "./specParser.js";

// ── 정규식 (Python 원본 1:1) ──────────────────────────────────────────────
const NAV_RE =
  /(탭하면|누르면|이동한|진입한|바로가기|돌아간|넘어간|로 이동|으로 이동|로 진입|으로 진입|페이지가 열린|화면이 열린|페이지로 열린)/;
const DEST_HINT_RE = /([가-힣A-Za-z]+)\s*(?:화면|스크린|뷰|상세|페이지)/g;
const NONNAV_RE =
  /(이동\s*없이|페이지\s*이동\s*없이|다음\s*작업으로\s*넘어|큐\s*멈춤|돌아오면|숨겨진다)/;

// 영문 디렉토리 토큰 → 한글 별칭(THEN의 한글이 영문 화면에 바인딩되도록)
const EN_KO: Record<string, string[]> = {
  capture: ["캡처", "촬영"], widget: ["위젯", "홈"],
  home: ["홈"], storage: ["저장", "조회"], detail: ["상세"],
  list: ["목록", "리스트"], view: ["조회", "보기"],
  analysis: ["분석"], preview: ["미리보기"], edit: ["수정", "편집"],
  handoff: ["핸드오프"], ios: ["ios"],
};

// ── is_screen_spec 토큰 (Python SCREEN_TOKENS/API_TOKENS) ──────────────────
const SCREEN_TOKENS = [
  "화면", "위젯", "widget", "버튼", "탭하면", "탭한다", "미리보기", "폼",
  "입력 폼", "스크린", "screen", "보여준다", "표시한다", "진입한다", "이동한다",
  "바로가기", "홈 화면", "화면으로", "화면에", "UI", "글랜스", "glance",
  "compose", "swiftui", "뷰", "view ", "레이아웃", "탭", "스와이프",
];
const API_TOKENS = [
  "엔드포인트", "endpoint", "api는", "반환한다", "http", " 401", " 404",
  " 500", "미들웨어", "ci ", "파이프라인", "observability", "로그", "쿼리",
  "토큰을 검증", "영속화", "database", "upsert", "재시도", "마이그레이션",
];

const HANGUL_2PLUS = /[가-힣]{2,}/g;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Python _token_pattern: ASCII 토큰은 \b 단어경계, 한글 포함은 부분매칭(폴백) */
function countToken(textLow: string, tok: string): number {
  const low = tok.toLowerCase().trim();
  // isascii() 동치: 모든 코드포인트 < 128
  const isAscii = /^[\x00-\x7f]*$/.test(low);
  if (isAscii) {
    const re = new RegExp("\\b" + escapeRegExp(low) + "\\b", "g");
    return (textLow.match(re) ?? []).length;
  }
  // 한글 등: 부분매칭 (textLow.count(tok))
  if (low.length === 0) return 0;
  let count = 0;
  let idx = textLow.indexOf(low);
  while (idx !== -1) {
    count++;
    idx = textLow.indexOf(low, idx + low.length);
  }
  return count;
}

function countTokens(text: string, tokens: string[]): number {
  const t = text.toLowerCase();
  let total = 0;
  for (const tok of tokens) total += countToken(t, tok);
  return total;
}

/** Python is_screen_spec: screen 신호가 api 신호보다 우세 + >=3 */
export function isScreenSpec(specText: string): boolean {
  const s = countTokens(specText, SCREEN_TOKENS);
  const a = countTokens(specText, API_TOKENS);
  return s >= 3 && s > a;
}

/** Python screen_aliases: 화면을 식별하는 소문자 별칭 토큰 집합 */
export function screenAliases(spec: ParsedSpec): Set<string> {
  const al = new Set<string>();
  // 디렉토리명: wod-capture → {wod, capture}
  for (const part of spec.name.split(/[-_]/)) {
    if (part.length >= 2) al.add(part.toLowerCase());
  }
  // 영문 토큰 → 한글 별칭
  for (const part of [...al]) {
    for (const ko of EN_KO[part] ?? []) al.add(ko);
  }
  // 요구사항 제목에서 한글 명사
  for (const req of spec.requirements) {
    const matches = req.title.match(HANGUL_2PLUS) ?? [];
    for (const w of matches) al.add(w.toLowerCase());
  }
  return al;
}

/** 별칭이 부착된 스펙 (그래프 빌드 시 _aliases 주입) */
export interface ScreenSpec extends ParsedSpec {
  _aliases: Set<string>;
}

export type FlowResult = { anchor: string; hint: string } | null;

/**
 * Python flow_target: THEN이 다른 화면으로 전이하면 바인딩.
 *   { anchor: "screen-<slug>", hint }  다른 화면으로 바인딩
 *   { anchor: "__dangling__", hint }   nav 동사 있으나 매칭 화면 없음(실제 냄새)
 *   null                               전이 아님(nav 없음 또는 명시적 동일페이지/큐/회상)
 * source는 후보에서 제외 → self-loop 방지(단, dangling은 살려 누락 표면화).
 */
export function flowTarget(
  thenText: string,
  screens: ScreenSpec[],
  source: ScreenSpec | null = null,
): FlowResult {
  if (!NAV_RE.test(thenText)) return null;
  if (NONNAV_RE.test(thenText)) return null;

  // 목적지 힌트 단어 수집
  const hints: string[] = [];
  for (const m of thenText.matchAll(DEST_HINT_RE)) {
    if (m[1] !== undefined) hints.push(m[1]);
  }
  const extra = thenText.match(HANGUL_2PLUS) ?? [];
  const hintLabel =
    hints.length > 0 ? `${hints[0]} 화면` : `${thenText.slice(0, 24)}…`;

  const candWords = new Set<string>(
    [...hints, ...extra].map((w) => w.toLowerCase()),
  );
  const srcName = source ? source.name : null;
  for (const sp of screens) {
    if (sp.name === srcName) continue; // 자기 화면엔 절대 바인딩 안 함
    // 교집합 존재 여부
    let hit = false;
    for (const w of candWords) {
      if (sp._aliases.has(w)) { hit = true; break; }
    }
    if (hit) return { anchor: "screen-" + slug(sp.name), hint: hintLabel };
  }
  return { anchor: "__dangling__", hint: hintLabel };
}
