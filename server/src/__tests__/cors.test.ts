/**
 * cors 통합 테스트 — spec: 기본(env 미설정) = Access-Control-Allow-Origin 헤더 없음.
 *
 * 와일드카드 CORS 제거(design D-5) 실증. env 미설정 상태에서 임의 Origin으로 요청해도
 * ACAO 헤더가 응답에 없어야 한다(same-origin SPA는 정상). 설정 시 화이트리스트 오리진만 반영.
 */
import request from "supertest";

const ENV = { ...process.env };

async function loadApp() {
  const mod = await import("../index.js");
  return mod.app;
}

afterEach(() => {
  process.env = { ...ENV };
});

describe("CORS 헤더", () => {
  it("env 미설정 → Access-Control-Allow-Origin 헤더 없음", async () => {
    delete process.env.FLOWFORGE_CORS_ORIGIN;
    const app = await loadApp();
    const res = await request(app).get("/api/health").set("Origin", "https://evil.example.com");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
