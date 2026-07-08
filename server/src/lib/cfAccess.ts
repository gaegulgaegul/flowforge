/**
 * cfAccess — Cloudflare Access JWT(RS256) origin측 검증. 의존성 0(node:crypto만).
 *
 * cloudflared가 인증된 요청에 주입하는 `Cf-Access-Jwt-Assertion` 헤더의 JWT를
 * 팀 JWKS로 풀검증한다: RS256 서명(alg 핀), aud(배열 포함)·iss·exp/nbf(±60s skew),
 * 그리고 **email claim 필수**(service token 거부 — 사람 사용자만). 선례 = openspec-reports
 * cfaccess.py(RS256 hand-roll)의 TS 포팅이되, node:crypto.createVerify로 서명 검증을 대체하고
 * email 요구를 추가한다. JWKS는 10분 캐시 + kid 미스 시 1회 강제 재조회(키 회전 대응).
 *
 * env 미설정(FLOWFORGE_CF_ACCESS_AUD·_TEAM_DOMAIN 둘 다) 시 disabled — 호출측이 다른
 * 게이트(토큰)로 폴백하거나 개발 모드로 통과. fetch는 주입 seam(테스트 실 네트워크 0).
 */
import { createPublicKey, createVerify } from "node:crypto";

/** JWKS 응답(RFC 7517) — 필요한 필드만. */
export interface Jwks {
  keys: Array<{
    kid: string;
    kty: string;
    n: string;
    e: string;
    alg?: string;
    use?: string;
  }>;
}

/** 검증 통과 시 반환되는 CF Access JWT payload(부분). */
export interface CfAccessPayload {
  aud?: string | string[];
  iss?: string;
  exp?: number;
  nbf?: number;
  email?: string;
  [claim: string]: unknown;
}

/** cfAccess 설정. enabled=false면 검증 비활성(env 미설정). */
export interface CfAccessConfig {
  enabled: boolean;
  aud: string;
  teamDomain: string;
  issuer: string;
  jwksUrl: string;
}

/** 검증 옵션 — fetchJwks/now는 테스트 주입 seam(미지정 시 실제 네트워크·시각 사용). */
export interface VerifyOptions {
  fetchJwks?: () => Promise<Jwks>;
  now?: number; // epoch seconds
}

const JWKS_TTL_MS = 10 * 60 * 1000; // 10분
const CLOCK_SKEW_SEC = 60;
const FETCH_TIMEOUT_MS = 8000;

/** env에서 cfAccess 설정을 읽는다. 둘 다 있어야 enabled. */
export function cfAccessConfig(): CfAccessConfig {
  const aud = (process.env.FLOWFORGE_CF_ACCESS_AUD ?? "").trim();
  const teamDomain = (process.env.FLOWFORGE_CF_ACCESS_TEAM_DOMAIN ?? "").trim();
  const enabled = Boolean(aud && teamDomain);
  return {
    enabled,
    aud,
    teamDomain,
    issuer: teamDomain ? `https://${teamDomain}` : "",
    jwksUrl: teamDomain ? `https://${teamDomain}/cdn-cgi/access/certs` : "",
  };
}

// ── JWKS 캐시(모듈 상태) ────────────────────────────────────────────────
let jwksCache: { fetchedAt: number; jwks: Jwks } | null = null;

/** 테스트 전용 — 캐시 초기화(테스트 간 격리). */
export function __resetJwksCacheForTests(): void {
  jwksCache = null;
}

/** 기본 JWKS fetch(Node 22 global fetch). 8초 타임아웃, 실패 시 throw. */
async function defaultFetchJwks(url: string): Promise<Jwks> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "flowforge-cfaccess" },
    });
    if (!res.ok) {
      throw new Error(`jwks fetch status ${res.status}`);
    }
    return (await res.json()) as Jwks;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * JWKS를 캐시 우선으로 가져온다. force=true면 캐시 무시하고 재조회(kid 회전 대응).
 * nowMs는 TTL 판정용 시각(밀리초) — 테스트 결정론을 위해 주입.
 */
async function getJwks(
  fetcher: () => Promise<Jwks>,
  nowMs: number,
  force: boolean,
): Promise<Jwks> {
  if (!force && jwksCache && nowMs - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.jwks;
  }
  const jwks = await fetcher();
  jwksCache = { fetchedAt: nowMs, jwks };
  return jwks;
}

/** base64url JSON 세그먼트를 파싱한다. 실패 시 null. */
function parseSegment(seg: string): Record<string, unknown> | null {
  try {
    const json = Buffer.from(seg, "base64url").toString("utf-8");
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/** JWK(RSA public)로 signingInput의 RS256 서명을 검증한다. */
function verifySignature(jwk: Jwks["keys"][number], signingInput: string, signature: Buffer): boolean {
  try {
    const pub = createPublicKey({ key: jwk, format: "jwk" });
    const verifier = createVerify("RSA-SHA256");
    verifier.update(signingInput);
    return verifier.verify(pub, signature);
  } catch {
    return false;
  }
}

/**
 * CF Access JWT를 풀검증한다. 통과 시 payload, 실패 시 null(내부 사유 미노출).
 * disabled면 항상 null(fetch도 안 함). fetch/시각은 opts로 주입 가능.
 */
export async function verifyCfAccessJwt(
  token: string,
  opts: VerifyOptions = {},
): Promise<CfAccessPayload | null> {
  const cfg = cfAccessConfig();
  if (!cfg.enabled || !token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [headerSeg, payloadSeg, sigSeg] = parts;

  const header = parseSegment(headerSeg);
  const payload = parseSegment(payloadSeg) as CfAccessPayload | null;
  if (!header || !payload) {
    return null;
  }
  if (header.alg !== "RS256") {
    return null; // alg 핀 — none/alg-confusion 방어
  }
  const kid = header.kid;
  if (typeof kid !== "string" || !kid) {
    return null;
  }

  let signature: Buffer;
  try {
    signature = Buffer.from(sigSeg, "base64url");
  } catch {
    return null;
  }
  if (signature.length === 0) {
    return null;
  }

  const signingInput = `${headerSeg}.${payloadSeg}`;
  const nowSec = opts.now ?? Math.floor(Date.now() / 1000);
  const nowMs = opts.now ? opts.now * 1000 : Date.now();
  const fetcher = opts.fetchJwks ?? (() => defaultFetchJwks(cfg.jwksUrl));

  // kid로 키를 찾아 서명 검증. 미스면 강제 재조회 1회.
  let verified = false;
  try {
    const jwks = await getJwks(fetcher, nowMs, false);
    let key = jwks.keys.find((k) => k.kid === kid);
    if (!key) {
      const refreshed = await getJwks(fetcher, nowMs, true); // 회전 대응 강제 재조회 1회
      key = refreshed.keys.find((k) => k.kid === kid);
    }
    if (!key) {
      return null;
    }
    verified = verifySignature(key, signingInput, signature);
  } catch {
    return null; // fetch/파싱 실패 = fail-closed
  }
  if (!verified) {
    return null;
  }

  // ── claims ──
  const audClaim = payload.aud;
  const auds = Array.isArray(audClaim) ? audClaim : [audClaim];
  if (!auds.includes(cfg.aud)) {
    return null;
  }
  if (payload.iss !== cfg.issuer) {
    return null;
  }
  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  if (exp < nowSec - CLOCK_SKEW_SEC) {
    return null; // 만료(누락도 fail-closed)
  }
  const nbf = typeof payload.nbf === "number" ? payload.nbf : 0;
  if (nbf > nowSec + CLOCK_SKEW_SEC) {
    return null; // 아직 유효 전
  }
  // email claim 필수 — service token(email 없음) 거부. 사람 사용자만.
  if (typeof payload.email !== "string" || payload.email.length === 0) {
    return null;
  }

  return payload;
}
