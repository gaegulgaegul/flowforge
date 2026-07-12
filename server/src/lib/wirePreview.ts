/**
 * wirePreview — 미승인 와이어 HTML의 단기 미리보기 토큰 저장소(flowforge-wireframe-iframe, meta→헤더 전환).
 *
 * 배경: 와이어 iframe CSP를 `<meta>` 주입에서 HTTP 응답 헤더로 옮기면서 iframe은 `src`(서버 라우트)로
 * 로드된다. 승인분/픽스처 문서는 원천(buildDocsPlanningWireframe2)에서 screenId로 찾아 직접 서빙하지만,
 * **미승인 제안(WireframeApprovalWizard)·crosslink 미리보기**는 원천에 없는 임시 HTML이라 서버가 알 수
 * 없다. 그래서 렌더 직전 POST로 HTML을 짧게(TTL) 저장하고 추측 불가한 토큰을 받아 `src=.../preview/:token/doc`
 * 로 로드한다. 저장분은 direct 라우트와 **동일하게** text/html + WIRE_DOC_CSP 헤더로 서빙된다(격리 동일).
 *
 * 보안:
 *  - 토큰은 `crypto.randomUUID()`(추측 불가). Date.now/Math.random 금지.
 *  - TTL(기본 5분) 경과분은 만료(get 시 lazy 삭제). 미리보기는 write가 아니라 인증 게이트 없음(GET read
 *    규약과 동형)이나, **개수·크기 상한**으로 메모리 DoS를 막는다(초과 시 가장 오래된 항목 제거 or 거부).
 *  - 저장 HTML은 신뢰되지 않은 AI 생성물 — 서버는 파싱/변형하지 않고 그대로 보관·서빙(격리는 헤더 CSP +
 *    sandbox iframe이 담당). meta 주입은 하지 않는다(우회 벡터 원천 제거).
 *
 * 프로세스 로컬 메모리 저장(단일 컨테이너·미리보기용 휘발 데이터라 영속 불필요). 프로세스 재시작 시 소실 OK.
 */
import { randomUUID } from "node:crypto";

/** 미리보기 TTL(ms). 짧게(사람이 카드를 보는 시간) — 만료분은 get 시 lazy 삭제. */
export const WIRE_PREVIEW_TTL_MS = 5 * 60 * 1000;

/** 저장 항목 개수 상한(DoS 방지). 초과 시 가장 오래된 항목부터 제거. */
export const WIRE_PREVIEW_MAX_ENTRIES = 200;

/** 단일 HTML 바이트 상한(DoS 방지). 초과 HTML은 저장 거부(토큰 미발급). */
export const WIRE_PREVIEW_MAX_HTML_BYTES = 512 * 1024;

interface PreviewEntry {
  readonly html: string;
  readonly expiresAt: number;
}

/** 주입 가능한 시계(테스트 안정성 — Date.now 직접 사용 금지). 기본=현재 epoch ms. */
export type NowMs = () => number;
const defaultNowMs: NowMs = () => Date.now();

/** 주입 가능한 토큰 생성기(테스트 안정성 — randomUUID 직접 사용 금지). 기본=crypto.randomUUID. */
export type GenToken = () => string;
const defaultGenToken: GenToken = () => randomUUID();

/** 프로세스 로컬 저장(token → entry). 삽입 순서 = 오래된 순(Map 순회 순서 = 삽입 순서). */
const store = new Map<string, PreviewEntry>();

/** UTF-8 바이트 길이. */
function byteLength(s: string): number {
  return Buffer.byteLength(s, "utf-8");
}

/** 만료 항목 제거(get·put 진입 시 청소). */
function evictExpired(now: number): void {
  for (const [token, entry] of store) {
    if (entry.expiresAt <= now) store.delete(token);
  }
}

/** 개수 상한 초과 시 가장 오래된 항목부터 제거(삽입 순서 = Map 순회 순서). */
function evictOldestBeyondCap(): void {
  while (store.size > WIRE_PREVIEW_MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/**
 * 미리보기 HTML을 저장하고 토큰을 반환한다. HTML이 크기 상한을 넘으면 null(토큰 미발급 — 라우트 413/400).
 * html은 무변형 보관(격리는 서빙 시 헤더 CSP + sandbox iframe). TTL·개수 상한으로 DoS 방어.
 */
export function putWirePreview(
  html: string,
  nowMs: NowMs = defaultNowMs,
  genToken: GenToken = defaultGenToken,
): string | null {
  if (typeof html !== "string") return null;
  if (byteLength(html) > WIRE_PREVIEW_MAX_HTML_BYTES) return null;
  const now = nowMs();
  evictExpired(now);
  const token = genToken();
  store.set(token, { html, expiresAt: now + WIRE_PREVIEW_TTL_MS });
  evictOldestBeyondCap();
  return token;
}

/**
 * 토큰으로 저장된 HTML을 반환한다. 미존재/만료면 null(라우트 404). 만료분은 이 시점에 lazy 삭제.
 * 토큰은 추측 불가(randomUUID)라 열거 공격 불가.
 */
export function getWirePreview(token: string, nowMs: NowMs = defaultNowMs): string | null {
  const now = nowMs();
  const entry = store.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    store.delete(token);
    return null;
  }
  return entry.html;
}

/** 테스트 격리용 저장소 초기화(프로세스 로컬 상태를 테스트 간 리셋). */
export function _resetWirePreviewStore(): void {
  store.clear();
}
