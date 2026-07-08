/**
 * corsOptions — CORS 오리진 화이트리스트(FLOWFORGE_CORS_ORIGIN).
 *
 * 와일드카드 CORS 제거(design D-5): same-origin SPA는 CORS 헤더가 아예 불필요하므로
 * 미설정 시 미들웨어를 붙이지 않는다(=`Access-Control-Allow-Origin` 헤더 없음). 크로스
 * 오리진 소비자가 생기면 `FLOWFORGE_CORS_ORIGIN`에 콤마 구분 오리진을 나열해서만 재개한다
 * (와일드카드 '*' 입력은 무시 — 화이트리스트 강제).
 */
import cors from "cors";
import type { RequestHandler } from "express";

/** env에서 CORS 오리진 화이트리스트를 파싱한다. 미설정·와일드카드 항목은 제거. */
export function parseCorsOrigins(): string[] {
  const raw = process.env.FLOWFORGE_CORS_ORIGIN ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "*");
}

/**
 * CORS 미들웨어를 반환한다. 화이트리스트가 비어 있으면 null(호출측이 붙이지 않음 =
 * CORS 헤더 없음). 설정 시 화이트리스트 오리진만 허용한다.
 */
export function corsMiddleware(): RequestHandler | null {
  const origins = parseCorsOrigins();
  if (origins.length === 0) {
    return null;
  }
  return cors({ origin: origins });
}
