/**
 * cfAccess 단위 테스트 — Cloudflare Access JWT(RS256) 검증.
 *
 * 픽스처 RSA 키쌍을 테스트 내에서 생성해 JWT를 직접 서명한다(실 네트워크 0).
 * JWKS fetch는 주입 seam(opts.fetchJwks)으로 대체하고, 시각은 opts.now로 주입해
 * exp/nbf 경계를 결정론적으로 검증한다. 검증 통과/위조/aud 불일치/만료/nbf 미래/
 * email 부재(service token) 판정과 JWKS 캐시·kid 미스 1회 재조회를 커버한다.
 */
import {
  generateKeyPairSync,
  createSign,
  createPublicKey,
  type KeyObject,
} from "node:crypto";
import {
  verifyCfAccessJwt,
  cfAccessConfig,
  __resetJwksCacheForTests,
  type Jwks,
} from "../cfAccess.js";

const AUD = "test-aud-tag-abc123";
const TEAM_DOMAIN = "example.cloudflareaccess.com";
const ISSUER = `https://${TEAM_DOMAIN}`;
const KID = "test-kid-1";

/** base64url(패딩 제거) — JWT 세그먼트 인코딩. */
function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

/** KeyObject(RSA public)에서 JWKS 키 항목(kid/n/e/kty)을 만든다. */
function jwkFromPublicKey(pub: KeyObject, kid: string): Jwks["keys"][number] {
  const jwk = pub.export({ format: "jwk" }) as { n: string; e: string; kty: string };
  return { kid, kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", use: "sig" };
}

/** 주어진 개인키로 RS256 JWT를 서명한다. header.kid/alg 및 payload를 인자로 받는다. */
function signJwt(
  privateKey: KeyObject,
  payload: Record<string, unknown>,
  opts: { kid?: string; alg?: string } = {},
): string {
  const header = { alg: opts.alg ?? "RS256", typ: "JWT", kid: opts.kid ?? KID };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const sig = signer.sign(privateKey);
  return `${signingInput}.${b64url(sig)}`;
}

/** 기본 유효 payload(현재시각 기준 유효창 + email claim). */
function validPayload(now: number, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    aud: AUD,
    iss: ISSUER,
    exp: now + 3600,
    nbf: now - 10,
    iat: now - 10,
    email: "user@example.com",
    ...over,
  };
}

describe("cfAccess — verifyCfAccessJwt", () => {
  let keyPair: { publicKey: KeyObject; privateKey: KeyObject };
  let jwks: Jwks;
  const NOW = 1_700_000_000; // 고정 기준시각(초)

  const ENV = { ...process.env };

  beforeEach(() => {
    process.env.FLOWFORGE_CF_ACCESS_AUD = AUD;
    process.env.FLOWFORGE_CF_ACCESS_TEAM_DOMAIN = TEAM_DOMAIN;
    keyPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    jwks = { keys: [jwkFromPublicKey(keyPair.publicKey, KID)] };
    __resetJwksCacheForTests();
  });

  afterEach(() => {
    process.env = { ...ENV };
    __resetJwksCacheForTests();
  });

  /** fetchJwks 주입 seam — 호출 횟수를 세어 캐시/재조회를 검증. */
  function makeFetch(returned: Jwks) {
    const calls: number[] = [];
    const fn = async (): Promise<Jwks> => {
      calls.push(1);
      return returned;
    };
    return { fn, get calls() { return calls.length; } };
  }

  it("cfAccessConfig — env가 둘 다 있으면 enabled", () => {
    const cfg = cfAccessConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.aud).toBe(AUD);
    expect(cfg.teamDomain).toBe(TEAM_DOMAIN);
    expect(cfg.issuer).toBe(ISSUER);
  });

  it("cfAccessConfig — env가 하나라도 없으면 disabled", () => {
    delete process.env.FLOWFORGE_CF_ACCESS_TEAM_DOMAIN;
    expect(cfAccessConfig().enabled).toBe(false);
  });

  it("유효 JWT → payload 반환", async () => {
    const token = signJwt(keyPair.privateKey, validPayload(NOW));
    const fetcher = makeFetch(jwks);
    const result = await verifyCfAccessJwt(token, { fetchJwks: fetcher.fn, now: NOW });
    expect(result).not.toBeNull();
    expect(result?.email).toBe("user@example.com");
    expect(fetcher.calls).toBe(1);
  });

  it("위조 서명(다른 키로 서명) → null", async () => {
    const attacker = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const token = signJwt(attacker.privateKey, validPayload(NOW)); // JWKS엔 없는 키
    const result = await verifyCfAccessJwt(token, { fetchJwks: async () => jwks, now: NOW });
    expect(result).toBeNull();
  });

  it("본문 변조(서명 후 payload 교체) → null", async () => {
    const token = signJwt(keyPair.privateKey, validPayload(NOW));
    const [h, , s] = token.split(".");
    const tampered = `${h}.${b64url(JSON.stringify(validPayload(NOW, { email: "evil@x.com" })))}.${s}`;
    const result = await verifyCfAccessJwt(tampered, { fetchJwks: async () => jwks, now: NOW });
    expect(result).toBeNull();
  });

  it("aud 불일치 → null", async () => {
    const token = signJwt(keyPair.privateKey, validPayload(NOW, { aud: "other-aud" }));
    const result = await verifyCfAccessJwt(token, { fetchJwks: async () => jwks, now: NOW });
    expect(result).toBeNull();
  });

  it("aud가 배열이고 AUD를 포함하면 통과", async () => {
    const token = signJwt(keyPair.privateKey, validPayload(NOW, { aud: ["x", AUD, "y"] }));
    const result = await verifyCfAccessJwt(token, { fetchJwks: async () => jwks, now: NOW });
    expect(result).not.toBeNull();
  });

  it("iss 불일치 → null", async () => {
    const token = signJwt(keyPair.privateKey, validPayload(NOW, { iss: "https://evil.example.com" }));
    const result = await verifyCfAccessJwt(token, { fetchJwks: async () => jwks, now: NOW });
    expect(result).toBeNull();
  });

  it("만료(exp 과거) → null", async () => {
    const token = signJwt(keyPair.privateKey, validPayload(NOW, { exp: NOW - 3600 }));
    const result = await verifyCfAccessJwt(token, { fetchJwks: async () => jwks, now: NOW });
    expect(result).toBeNull();
  });

  it("nbf 미래(아직 유효 전) → null", async () => {
    const token = signJwt(keyPair.privateKey, validPayload(NOW, { nbf: NOW + 3600 }));
    const result = await verifyCfAccessJwt(token, { fetchJwks: async () => jwks, now: NOW });
    expect(result).toBeNull();
  });

  it("email claim 부재(service token) → null", async () => {
    const p = validPayload(NOW);
    delete p.email;
    const token = signJwt(keyPair.privateKey, p);
    const result = await verifyCfAccessJwt(token, { fetchJwks: async () => jwks, now: NOW });
    expect(result).toBeNull();
  });

  it("email이 빈 문자열 → null(service token 방어)", async () => {
    const token = signJwt(keyPair.privateKey, validPayload(NOW, { email: "" }));
    const result = await verifyCfAccessJwt(token, { fetchJwks: async () => jwks, now: NOW });
    expect(result).toBeNull();
  });

  it("alg가 RS256이 아니면 → null(alg 혼동 방어)", async () => {
    // none alg + 빈 서명 시도
    const header = { alg: "none", typ: "JWT", kid: KID };
    const payload = validPayload(NOW);
    const token = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}.`;
    const result = await verifyCfAccessJwt(token, { fetchJwks: async () => jwks, now: NOW });
    expect(result).toBeNull();
  });

  it("세그먼트 개수가 3이 아니면 → null", async () => {
    const result = await verifyCfAccessJwt("a.b", { fetchJwks: async () => jwks, now: NOW });
    expect(result).toBeNull();
  });

  it("빈 토큰 → null", async () => {
    const result = await verifyCfAccessJwt("", { fetchJwks: async () => jwks, now: NOW });
    expect(result).toBeNull();
  });

  it("disabled(env 미설정)면 검증 시도 없이 null", async () => {
    delete process.env.FLOWFORGE_CF_ACCESS_AUD;
    const token = signJwt(keyPair.privateKey, validPayload(NOW));
    const fetcher = makeFetch(jwks);
    const result = await verifyCfAccessJwt(token, { fetchJwks: fetcher.fn, now: NOW });
    expect(result).toBeNull();
    expect(fetcher.calls).toBe(0); // fetch도 안 함
  });

  it("JWKS 캐시 — 연속 검증 시 fetch는 1회만", async () => {
    const token = signJwt(keyPair.privateKey, validPayload(NOW));
    const fetcher = makeFetch(jwks);
    await verifyCfAccessJwt(token, { fetchJwks: fetcher.fn, now: NOW });
    await verifyCfAccessJwt(token, { fetchJwks: fetcher.fn, now: NOW });
    await verifyCfAccessJwt(token, { fetchJwks: fetcher.fn, now: NOW });
    expect(fetcher.calls).toBe(1);
  });

  it("캐시 TTL(10분) 경과 후 재조회", async () => {
    const token = signJwt(keyPair.privateKey, validPayload(NOW));
    const fetcher = makeFetch(jwks);
    await verifyCfAccessJwt(token, { fetchJwks: fetcher.fn, now: NOW });
    // 10분 + 1초 경과 — exp도 넉넉하므로 유효
    const later = NOW + 601;
    const token2 = signJwt(keyPair.privateKey, validPayload(later));
    await verifyCfAccessJwt(token2, { fetchJwks: fetcher.fn, now: later });
    expect(fetcher.calls).toBe(2);
  });

  it("kid 미스 → 1회 force 재조회 후 통과", async () => {
    // 첫 fetch는 kid가 안 맞는 낡은 JWKS, 두 번째 fetch에 올바른 키(회전 시나리오)
    const stale: Jwks = { keys: [jwkFromPublicKey(keyPair.publicKey, "old-kid-999")] };
    let call = 0;
    const fetchJwks = async (): Promise<Jwks> => {
      call += 1;
      return call === 1 ? stale : jwks; // 두 번째에 올바른 키 등장
    };
    const token = signJwt(keyPair.privateKey, validPayload(NOW)); // kid = KID
    const result = await verifyCfAccessJwt(token, { fetchJwks, now: NOW });
    expect(result).not.toBeNull();
    expect(call).toBe(2); // 미스 → 강제 재조회 정확히 1회
  });

  it("kid 재조회에도 없으면 → null(무한 재조회 안 함)", async () => {
    const stale: Jwks = { keys: [jwkFromPublicKey(keyPair.publicKey, "old-kid-999")] };
    let call = 0;
    const fetchJwks = async (): Promise<Jwks> => {
      call += 1;
      return stale; // 항상 kid 불일치
    };
    const token = signJwt(keyPair.privateKey, validPayload(NOW));
    const result = await verifyCfAccessJwt(token, { fetchJwks, now: NOW });
    expect(result).toBeNull();
    expect(call).toBe(2); // 최초 1 + 강제 재조회 1, 그 이상 안 함
  });

  it("JWKS fetch 실패 → null(fail-closed)", async () => {
    const token = signJwt(keyPair.privateKey, validPayload(NOW));
    const fetchJwks = async (): Promise<Jwks> => {
      throw new Error("network down");
    };
    const result = await verifyCfAccessJwt(token, { fetchJwks, now: NOW });
    expect(result).toBeNull();
  });

  it("createPublicKey/verify 실 경로 — jose 없이 node:crypto만으로 검증됨(회귀 가드)", async () => {
    // 이 테스트는 서명이 실제로 표준 RS256이며 node:crypto로 재검증 가능함을 독립 확인
    const token = signJwt(keyPair.privateKey, validPayload(NOW));
    const [h, p, s] = token.split(".");
    const pub = createPublicKey({ key: jwks.keys[0], format: "jwk" });
    const { createVerify } = await import("node:crypto");
    const v = createVerify("RSA-SHA256");
    v.update(`${h}.${p}`);
    expect(v.verify(pub, Buffer.from(s, "base64url"))).toBe(true);
  });
});
