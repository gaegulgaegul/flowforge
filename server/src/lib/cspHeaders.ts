/**
 * cspHeaders — flowforge 앱 CSP 보안 헤더 미들웨어(flowforge-wireframe-iframe, Parallel Group 3).
 *
 * 현재 서버에 helmet/CSP가 전무하다(확인함) → 무의존 최소 미들웨어로 CSP 헤더를 신설한다. 목적은
 * clickjacking 방어(`frame-ancestors`)와 iframe 원천 통제(`frame-src`)다. 값은 shared 단일 원천
 * (`WIRE_APP_CSP`)에서 가져와 렌더러·테스트와 drift를 막는다(D8). helmet 전면 도입은 §90 평가 후 선택.
 */
import type { Request, Response, NextFunction } from "express";
import { WIRE_APP_CSP } from "@flowforge/shared";

/**
 * 모든 응답에 앱 CSP 헤더(`Content-Security-Policy`)를 세팅한다. `frame-ancestors 'self'`로 신뢰되지
 * 않은 상위 프레임 임베드(clickjacking)를 막고, `frame-src 'self'`로 iframe 원천을 통제한다.
 * 부가로 `X-Content-Type-Options: nosniff`·`X-Frame-Options: SAMEORIGIN`(구형 브라우저 폴백)도 세팅.
 */
export function cspHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Content-Security-Policy", WIRE_APP_CSP);
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
}
