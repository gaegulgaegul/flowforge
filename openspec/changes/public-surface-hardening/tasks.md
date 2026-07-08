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

- [ ] 3.1 docker-compose에 env 참조 자리(`FLOWFORGE_CF_ACCESS_AUD`·`FLOWFORGE_CF_ACCESS_TEAM_DOMAIN`·`FLOWFORGE_WRITE_TOKEN`·`FLOWFORGE_CORS_ORIGIN`) 추가 — 실값 커밋 금지(호스트 .env, gitignore 확인)
- [ ] 3.2 `docs/EDGE_AUTH.md` — CF Zero Trust Application 등록 절차(호스트 등록→정책→AUD 태그 취득→env 주입→재배포→검증 curl 2종: 무자격 401·CF 경유 200). "대시보드 등록+env 주입=한 세트, env 없인 현행 공개" 정직 명시

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [ ] 4.1 VERIFY: 5단계 게이트 — 빌드 → 타입체크 → 린트 → 테스트(기존 347 회귀 0 + 신규) → 실동작(격리 서버: env 주입 상태에서 무자격 쓰기 401·파일 불변, 토큰 쓰기 200, env 미설정 현행, CORS 헤더 부재) 전부 PASS. 라이브 CF Access 실증은 대시보드 등록 후 별도(정직 표기)
