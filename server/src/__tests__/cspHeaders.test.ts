/**
 * 앱 CSP 헤더 미들웨어 통합 테스트(flowforge-wireframe-iframe, Parallel Group 3).
 *
 * flowforge 앱 응답에 CSP `frame-ancestors`(clickjacking 방어)가 세팅되는지 실제 요청으로 검증한다.
 * 서버에 CSP가 현재 전무 → 이 change에서 신설. 값은 shared 단일 원천(WIRE_APP_CSP)과 일치해야 한다.
 */
import request from "supertest";
import { WIRE_APP_CSP } from "@flowforge/shared";

async function loadApp() {
  const mod = await import("../index.js");
  return mod.app;
}

describe("앱 CSP 헤더 (frame-ancestors clickjacking 방어)", () => {
  it("health 응답에 Content-Security-Policy 헤더가 있고 frame-ancestors를 포함한다", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    const csp = res.headers["content-security-policy"];
    expect(typeof csp).toBe("string");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toBe(WIRE_APP_CSP);
  });

  it("CSP 헤더는 외부 프레임 원천을 허용하지 않는다(frame-src 'self')", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/health");
    expect(res.headers["content-security-policy"]).toContain("frame-src 'self'");
  });

  it("X-Frame-Options SAMEORIGIN 폴백도 세팅된다(구형 브라우저)", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/health");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("API가 아닌 경로에도 CSP가 적용된다(전역 미들웨어)", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/docs/projects");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'self'");
  });
});
