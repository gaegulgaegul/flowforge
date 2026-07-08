# public-surface-hardening — tasks

## Tasks

### Sequential: 검증 모듈 (선행)

- [x] 1.1 RED: cfAccess 단위 테스트 — 픽스처 RSA 키쌍(테스트 내 생성)으로 유효 JWT 통과 / 위조 서명·aud 불일치·만료·nbf 미래·email 부재(service token) 401 판정 / JWKS 캐시 + kid 미스 1회 재조회 (fetch 주입 seam, 실 네트워크 0)
- [x] 1.2 GREEN: `server/src/lib/cfAccess.ts` — node:crypto RS256 검증·JWKS fetch/10분 캐시·aud(배열 포함)/iss/exp/nbf·email claim 필수. 신규 npm 의존성 0

### Sequential: 게이트 배선

- [x] 2.1 RED: 라우트 통합 테스트 — env 설정 시 무자격 쓰기 5종 전부 401+대상 파일 불변 / Bearer 토큰(상수시간) 통과 / 유효 JWT 통과 / env 미설정 시 현행 동작(기존 쓰기 테스트 회귀 0)
- [x] 2.2 GREEN: `requireWriteAuth` 미들웨어 + 쓰기 5종(graph layout·docs layout·apply 3종) 명시 부착 + 401 응답(내부 사유 미노출)
- [x] 2.3 cors 교체 — 와일드카드 제거, `FLOWFORGE_CORS_ORIGIN` 화이트리스트만(미설정=CORS 헤더 없음). same-origin SPA 무영향 확인

### Sequential: 배포 준비 (코드 밖 절차 문서)

- [x] 3.1 docker-compose에 env 참조 자리(`FLOWFORGE_CF_ACCESS_AUD`·`FLOWFORGE_CF_ACCESS_TEAM_DOMAIN`·`FLOWFORGE_WRITE_TOKEN`·`FLOWFORGE_CORS_ORIGIN`) 추가 — `${...:-}` 참조만(실값 커밋 0), .gitignore에 `.env`·`.env.*` 확인. 4개 키 전부 코드 소비처(cfAccess/requireWriteAuth/corsOptions) 실재 대조.
- [x] 3.2 `docs/EDGE_AUTH.md` — CF Zero Trust Application 등록 절차(호스트 등록→정책→AUD 취득→호스트 .env 주입→재배포→검증 curl 3종) + "env 미설정=현행 무인증 공개, 대시보드 등록+env 주입=한 세트" 정직 명시.

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [x] 4.1 VERIFY: 5단계 게이트 — 빌드(shared/server tsc·web vite EXIT 0) → 타입체크(strict tsc, 본체가 apply 잔여 타입갭 2건 수정: cfAccess.ts JWT split undefined 가드 + 테스트 jwk undefined 가드) → 린트(러너 미구성 --if-present) → 테스트(384/384, 기존 347+cfAccess/게이트 신규 37, 회귀 0) → **실동작(격리 서버 8909)**: env 미설정=dev 모드 로그+layout 쓰기 게이트 통과(401 아님) / 토큰 게이트 활성 시 무자격 layout PUT·apply 3종 전부 **401** / 틀린 토큰 401 / 올바른 토큰 200 / 무자격 GET graph 200(게이트 밖) / evil.com Origin에 CORS 헤더 **부재** — 전 시나리오 PASS.
  - 🔴 라이브 CF Access JWT 실증은 **미실행**(CF Zero Trust 대시보드 등록 전 — 인프라 작업, EDGE_AUTH.md 절차로 남김). 토큰 폴백·CORS·dev 모드는 격리 서버로 실증했으나 CF JWT 경로는 단위 테스트(픽스처 RSA 키쌍)까지만 — 정직 표기.
