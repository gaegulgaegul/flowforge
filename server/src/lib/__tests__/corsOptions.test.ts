/**
 * corsOptions 단위 테스트 — FLOWFORGE_CORS_ORIGIN 화이트리스트 파싱.
 *
 * 와일드카드 제거(design D-5): 미설정 = CORS 미들웨어 없음(null 반환) = 헤더 없음.
 * 설정 시 콤마 구분 오리진 화이트리스트만 허용. same-origin SPA는 CORS 헤더 불필요.
 */
import { parseCorsOrigins, corsMiddleware } from "../corsOptions.js";

const ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ENV };
});

describe("parseCorsOrigins", () => {
  it("미설정 → 빈 배열", () => {
    delete process.env.FLOWFORGE_CORS_ORIGIN;
    expect(parseCorsOrigins()).toEqual([]);
  });

  it("단일 오리진", () => {
    process.env.FLOWFORGE_CORS_ORIGIN = "https://app.example.com";
    expect(parseCorsOrigins()).toEqual(["https://app.example.com"]);
  });

  it("콤마 구분 다중 오리진(공백 트림)", () => {
    process.env.FLOWFORGE_CORS_ORIGIN = "https://a.com, https://b.com ,https://c.com";
    expect(parseCorsOrigins()).toEqual(["https://a.com", "https://b.com", "https://c.com"]);
  });

  it("빈 항목 제거", () => {
    process.env.FLOWFORGE_CORS_ORIGIN = "https://a.com,,  ,https://b.com";
    expect(parseCorsOrigins()).toEqual(["https://a.com", "https://b.com"]);
  });

  it("와일드카드 '*'는 무시(화이트리스트 강제)", () => {
    process.env.FLOWFORGE_CORS_ORIGIN = "*";
    expect(parseCorsOrigins()).toEqual([]);
  });
});

describe("corsMiddleware", () => {
  it("미설정 → null(미들웨어 없음)", () => {
    delete process.env.FLOWFORGE_CORS_ORIGIN;
    expect(corsMiddleware()).toBeNull();
  });

  it("설정 → 미들웨어 함수 반환", () => {
    process.env.FLOWFORGE_CORS_ORIGIN = "https://app.example.com";
    expect(typeof corsMiddleware()).toBe("function");
  });
});
