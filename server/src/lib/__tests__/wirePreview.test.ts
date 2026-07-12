/**
 * wirePreview 단위 테스트 — 미승인 와이어 HTML의 단기 미리보기 토큰 저장소(CSP meta→헤더 전환).
 *
 * 대상(server/src/lib/wirePreview.ts):
 *  - putWirePreview — 저장·토큰 발급·크기 상한 거부(null)·개수 상한 초과 시 오래된 항목 제거
 *  - getWirePreview — 조회·미존재 null·TTL 만료 시 null(nowMs 주입으로 결정적 검증)·만료분 lazy 삭제
 *  - _resetWirePreviewStore — 테스트 격리
 *
 * 시계(nowMs)·토큰(genToken)은 주입 가능 — Date.now/randomUUID 직접 의존 없이 결정적으로 검증한다.
 */
import {
  putWirePreview,
  getWirePreview,
  _resetWirePreviewStore,
  WIRE_PREVIEW_TTL_MS,
  WIRE_PREVIEW_MAX_ENTRIES,
  WIRE_PREVIEW_MAX_HTML_BYTES,
} from "../wirePreview.js";

beforeEach(() => {
  _resetWirePreviewStore();
});

describe("putWirePreview / getWirePreview (발급·조회)", () => {
  it("저장한 HTML을 발급 토큰으로 그대로 조회한다(무변형)", () => {
    const html = "<!doctype html><html><head></head><body><h1>hi</h1></body></html>";
    const token = putWirePreview(html);
    expect(token).not.toBeNull();
    expect(getWirePreview(token as string)).toBe(html);
  });

  it("주입 토큰 생성기로 예측 가능한 토큰을 쓴다(테스트 안정성)", () => {
    const token = putWirePreview("<p>x</p>", () => 0, () => "fixed-token-1");
    expect(token).toBe("fixed-token-1");
    expect(getWirePreview("fixed-token-1", () => 0)).toBe("<p>x</p>");
  });

  it("서로 다른 저장은 서로 다른 토큰을 받는다(격리)", () => {
    const a = putWirePreview("<p>a</p>");
    const b = putWirePreview("<p>b</p>");
    expect(a).not.toBe(b);
    expect(getWirePreview(a as string)).toBe("<p>a</p>");
    expect(getWirePreview(b as string)).toBe("<p>b</p>");
  });
});

describe("getWirePreview (미존재·만료)", () => {
  it("미존재 토큰은 null(열거 공격 무의미 — 토큰 추측 불가)", () => {
    expect(getWirePreview("no-such-token")).toBeNull();
  });

  it("TTL 경과분은 만료되어 null(nowMs 주입으로 결정적 검증)", () => {
    const t0 = 1_000_000;
    const token = putWirePreview("<p>ttl</p>", () => t0, () => "tok-ttl");
    // TTL 직전엔 살아있다.
    expect(getWirePreview("tok-ttl", () => t0 + WIRE_PREVIEW_TTL_MS - 1)).toBe("<p>ttl</p>");
    // TTL 도달·경과분은 null.
    expect(getWirePreview("tok-ttl", () => t0 + WIRE_PREVIEW_TTL_MS)).toBeNull();
    expect(token).toBe("tok-ttl");
  });

  it("만료 조회는 항목을 lazy 삭제한다(이후 조회도 계속 null)", () => {
    const t0 = 5_000;
    putWirePreview("<p>gone</p>", () => t0, () => "tok-gone");
    // 만료 시점 조회 → null(내부 삭제)
    expect(getWirePreview("tok-gone", () => t0 + WIRE_PREVIEW_TTL_MS)).toBeNull();
    // 시계를 되돌려도(삭제됐으므로) 여전히 null.
    expect(getWirePreview("tok-gone", () => t0)).toBeNull();
  });
});

describe("DoS 상한", () => {
  it("크기 상한 초과 HTML은 토큰 미발급(null)", () => {
    const tooBig = "x".repeat(WIRE_PREVIEW_MAX_HTML_BYTES + 1);
    expect(putWirePreview(tooBig)).toBeNull();
  });

  it("크기 상한 경계값은 발급된다(<= 상한)", () => {
    const atCap = "x".repeat(WIRE_PREVIEW_MAX_HTML_BYTES);
    const token = putWirePreview(atCap);
    expect(token).not.toBeNull();
    expect(getWirePreview(token as string)).toBe(atCap);
  });

  it("개수 상한 초과 시 가장 오래된 항목부터 제거된다", () => {
    // 상한 + 1개를 순서대로 저장 → 첫 항목이 밀려난다.
    const tokens: string[] = [];
    for (let i = 0; i < WIRE_PREVIEW_MAX_ENTRIES + 1; i++) {
      const tok = putWirePreview(`<p>${i}</p>`, () => 100, () => `tok-${i}`);
      tokens.push(tok as string);
    }
    // 가장 오래된(첫) 토큰은 제거되어 null.
    expect(getWirePreview("tok-0", () => 100)).toBeNull();
    // 최신 토큰은 살아있다.
    expect(getWirePreview(`tok-${WIRE_PREVIEW_MAX_ENTRIES}`, () => 100)).toBe(
      `<p>${WIRE_PREVIEW_MAX_ENTRIES}</p>`,
    );
  });
});
