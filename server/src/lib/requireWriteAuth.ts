/**
 * requireWriteAuth — 쓰기 라우트 2차 인증 게이트(Express 미들웨어).
 *
 * 판정(design D-2): (a) `Cf-Access-Jwt-Assertion` JWT 풀검증 통과(cfAccess) OR
 * (b) `Authorization: Bearer <FLOWFORGE_WRITE_TOKEN>` 상수시간 일치. 실패는 401
 * `{error:"unauthorized"}`(내부 사유 미노출 — 30-security).
 *
 * 개발 모드(design D-3): CF Access env(AUD+TEAM_DOMAIN)도 WRITE_TOKEN도 없으면 게이트를
 * 통과시킨다(현행 동작 — jest·러너·로컬 vite 무손상). 프로덕션 강제는 compose env 주입으로 결정.
 * 부착은 쓰기 5종 라우트에만 명시(전역 app.use 아님 — GET 공개는 엣지 소관).
 */
import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { cfAccessConfig, verifyCfAccessJwt } from "./cfAccess.js";

const CF_ACCESS_HEADER = "cf-access-jwt-assertion";

/** 쓰기 토큰(폴백). 빈 문자열이면 미설정. */
function writeToken(): string {
  return (process.env.FLOWFORGE_WRITE_TOKEN ?? "").trim();
}

/** 게이트 활성 여부: CF Access enabled 또는 write token 설정 중 하나라도 있으면 강제. */
function gateEnabled(): boolean {
  return cfAccessConfig().enabled || writeToken().length > 0;
}

/** 길이까지 포함한 상수시간 문자열 비교(길이 노출·타이밍 사이드채널 방어). */
function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) {
    // 길이 불일치도 상수시간 경로를 타도록 자기 자신과 비교 후 false 반환
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** `Authorization: Bearer <token>`에서 토큰만 추출(없으면 ""). */
function bearerToken(req: Request): string {
  const header = req.header("authorization") ?? "";
  const prefix = "Bearer ";
  return header.startsWith(prefix) ? header.slice(prefix.length).trim() : "";
}

/** 401 응답(내부 사유 미노출). */
function unauthorized(res: Response): void {
  res.status(401).json({ error: "unauthorized" });
}

/**
 * 쓰기 게이트 미들웨어. 통과 시 next(), 실패 시 401.
 * 개발 모드(게이트 미설정)면 무조건 통과.
 */
export function requireWriteAuth(req: Request, res: Response, next: NextFunction): void {
  if (!gateEnabled()) {
    next(); // 개발 모드 — 현행 동작
    return;
  }

  // (b) Bearer 토큰 폴백(상수시간). 설정돼 있을 때만.
  const token = writeToken();
  if (token.length > 0) {
    const presented = bearerToken(req);
    if (presented.length > 0 && constantTimeEqual(presented, token)) {
      next();
      return;
    }
  }

  // (a) CF Access JWT 풀검증. AUD+TEAM_DOMAIN 설정 시에만.
  if (cfAccessConfig().enabled) {
    const assertion = req.header(CF_ACCESS_HEADER) ?? "";
    if (assertion) {
      verifyCfAccessJwt(assertion)
        .then((payload) => {
          if (payload) {
            next();
          } else {
            unauthorized(res);
          }
        })
        .catch(() => unauthorized(res));
      return;
    }
  }

  unauthorized(res);
}
