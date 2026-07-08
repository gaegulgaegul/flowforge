# api-write-auth

## Purpose

flowforge 쓰기 라우트(승인 apply 3종 + layout 저장 2종)에 origin측 2차 인증 게이트를 강제하는 능력. CF Access JWT 풀검증(RS256·aud·iss·exp·email 필수, node:crypto 의존성0) 또는 상수시간 토큰 폴백으로 통과, env 미설정 시 현행 개발 모드. 와일드카드 CORS를 제거하고 화이트리스트로만 허용한다.

## Requirements

### Requirement: 쓰기 라우트는 2차 인증 게이트를 통과해야 한다

WHEN write auth is configured (either `FLOWFORGE_CF_ACCESS_AUD`+`FLOWFORGE_CF_ACCESS_TEAM_DOMAIN` or `FLOWFORGE_WRITE_TOKEN` is set), every write route (layout PUT 2종, suggestions apply POST 3종) SHALL require either (a) a fully verified `Cf-Access-Jwt-Assertion` — RS256 signature against the team JWKS, aud, iss, exp/nbf, and a present email claim (service tokens rejected) — or (b) a Bearer token matching `FLOWFORGE_WRITE_TOKEN` via constant-time comparison. Failures SHALL yield 401 without internal detail. WHEN neither is configured, behavior SHALL remain unchanged (dev mode, one startup log line).

#### Scenario: 유효 CF Access JWT → 쓰기 허용

- **WHEN** 팀 JWKS로 서명·aud·iss·exp가 전부 유효하고 email claim이 있는 JWT와 함께 apply를 호출한다
- **THEN** 기존 apply 동작이 그대로 수행된다

#### Scenario: 서명·aud 불일치·만료·email 부재는 401

- **WHEN** 위조 서명, 다른 aud, 만료된 JWT, 또는 email 없는(service) 토큰으로 쓰기를 호출한다
- **THEN** 401이 반환되고 문서·큐·overlay는 불변이다

#### Scenario: 토큰 폴백

- **WHEN** `Authorization: Bearer <FLOWFORGE_WRITE_TOKEN>`으로 쓰기를 호출한다
- **THEN** 허용된다 (불일치 토큰은 401, 상수시간 비교)

#### Scenario: 미설정 = 현행 동작(개발 모드)

- **WHEN** 관련 env가 하나도 없다
- **THEN** 쓰기 라우트는 기존과 동일하게 동작한다(테스트·로컬 개발 무손상)

#### Scenario: 읽기 라우트는 이 게이트의 대상이 아니다

- **WHEN** GET 라우트를 무자격으로 호출한다
- **THEN** 기존과 동일하게 응답한다(전체 공개 차단은 엣지 CF Access 소관)

### Requirement: 와일드카드 CORS를 제거한다

The server SHALL NOT emit wildcard CORS headers. Cross-origin access SHALL be granted only to origins whitelisted via `FLOWFORGE_CORS_ORIGIN` (unset = no CORS headers; same-origin SPA unaffected).

#### Scenario: 기본 = CORS 헤더 없음

- **WHEN** env 미설정 상태에서 임의 Origin으로 요청한다
- **THEN** `Access-Control-Allow-Origin` 헤더가 응답에 없다(같은 오리진 SPA는 정상)
