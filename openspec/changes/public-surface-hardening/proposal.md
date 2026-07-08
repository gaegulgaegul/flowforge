# public-surface-hardening

## Why

flowforge.gaegul.house는 현재 **완전 무인증 공개**다(cloudflared 순수 프록시 + `app.use(cors())` 와일드카드 + 인증·rate limit 전무 — 실측). 쓰기 표면 5개(POST apply 3종 = planning `.md` 소스 재작성, PUT layout 2종) 중 layout 쓰기는 **지금도 무인증 원격 쓰기가 실제로 성사**되고(wowa openspec RW 마운트), apply 3종은 RO 마운트라는 **우연한 방어**에만 기대고 있다. 모든 리뷰가 반복 권고해 온 마지막 코드 부채다.

## What Changes

- **CF Access JWT 검증 미들웨어 신설**(app 레벨 2차 방어): cloudflared가 붙이는 `Cf-Access-Jwt-Assertion`을 서명(RS256)·aud·iss·exp까지 검증 — openspec-reports `cfaccess.py` 선례의 TS 포팅. **신규 npm 의존성 0**(node:crypto RS256 + JWKS fetch/캐시).
- **쓰기 5종 라우트 게이트**: CF Access JWT(email claim 필수) **또는** `FLOWFORGE_WRITE_TOKEN` Bearer(상수시간 비교) 통과 시에만 허용. **두 env 모두 미설정이면 현행 동작 유지**(로컬 개발·테스트 무손상) — 프로덕션 compose에 env를 넣는 순간부터 강제.
- **CORS 조임**: 와일드카드 `cors()` 제거 — SPA는 same-origin이라 CORS 자체가 불필요(실측: 외부 소비자 0). 필요 시 화이트리스트 env로만 허용.
- **엣지(1차) = CF Zero Trust Application 등록**: flowforge.gaegul.house 전체(GET 포함)를 CF Access 뒤로 — 홈 전체 RO 마운트 열람도 함께 닫는다. 이건 CF 대시보드 인프라 작업이라 **코드 밖(사용자 또는 별도 세션)** — 이 change는 origin측 코드·env·문서를 준비한다.

## Capabilities

### New Capabilities

- `api-write-auth`: 쓰기 라우트의 2차 인증 게이트(CF Access JWT 검증 + 토큰 폴백 + 미설정 시 개발 모드)

### Modified Capabilities

(없음)

## Impact

- server: `lib/cfAccess.ts` 신설(JWT 검증, stdlib만), `index.ts` cors 교체 + 쓰기 게이트 미들웨어 배선, 쓰기 5종 라우트에 적용
- compose: `FLOWFORGE_CF_ACCESS_AUD`·`FLOWFORGE_CF_ACCESS_TEAM_DOMAIN`·`FLOWFORGE_WRITE_TOKEN` env 자리(값은 커밋 금지 — 30-security)
- web: 무변경(same-origin fetch — CF Access 쿠키가 자동 동반)
- 외부 소비자: 0건 실측(scripts·crontab·agentic-harness 전수 grep) — 깨질 자동화 없음
- Non-Goal: rate limit(후속) / GET 라우트의 앱레벨 게이트(엣지가 담당 — 단 미들웨어는 확장 가능하게) / CF 대시보드 등록 자체(인프라 작업, 절차 문서만 제공)
