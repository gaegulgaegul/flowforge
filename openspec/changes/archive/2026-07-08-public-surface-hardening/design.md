# public-surface-hardening — design

## Context

실측(2026-07-08): `index.ts:11` 와일드카드 `cors()`, 인증 0, cloudflared는 flowforge.gaegul.house→8812 순수 프록시(CF Access 미등록). 쓰기 라우트 5종 — `PUT /api/changes/:id/layout`(wowa RW 마운트에 **실쓰기 성사**), `PUT /api/docs/:project/planning-user-flow/layout`, `POST .../planning-{prd,features,user-flow}-suggestions/apply`(3종은 DOCS_ROOT RO라 현재 EROFS 실패 = 우연한 방어). 외부 소비자 0(SPA same-origin뿐). 선례 = openspec-reports `cfaccess.py`(RS256 직검증+JWKS 10분 캐시+aud/iss/exp, service token 거부) — 단 openspec도 인프라(AUD·팀도메인 실값)는 미적용 상태였음.

## Goals / Non-Goals

**Goals:**

- 쓰기 5종에 origin측 2차 게이트(CF 우회 직격 차단) — CF Access JWT 풀검증 or 토큰
- 와일드카드 CORS 제거(외부 소비자 0 실측이 근거)
- 신규 npm 의존성 0(90-tech-evaluation — node:crypto로 충분)
- 로컬 개발·테스트·러너 무손상(env 미설정=현행 동작)

**Non-Goals:**

- CF Zero Trust 대시보드 등록(엣지 1차) — 인프라 작업, 이 change는 절차 문서(`docs/EDGE_AUTH.md`)만
- rate limit·helmet(후속 위생)
- GET 라우트 앱레벨 게이트(엣지가 전체를 덮는 설계 — 미들웨어는 라우트 단위 적용이라 후속 확장 가능)

## Decisions

- **D-1 검증 로직 = cfaccess.py 동등 TS 포팅, 의존성 0.** RS256 서명 검증은 `node:crypto.verify`, JWKS는 `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` fetch + 10분 캐시 + kid 미스 시 1회 강제 재조회. aud(배열 포함)·iss·exp/nbf 전부 검증. **email claim 없는 토큰(service token)은 거부** — 사람 사용자만(선례 계승).
- **D-2 게이트 판정 = (CF JWT 풀검증 통과) OR (Bearer가 `FLOWFORGE_WRITE_TOKEN`과 상수시간 일치).** `crypto.timingSafeEqual` 사용. 실패는 401 `{error:"unauthorized"}`(내부 사유 미노출 — 30-security).
- **D-3 개발 모드 = 두 env 모두 부재 시 게이트 통과(현행 동작).** 명시 로그 1줄("write auth disabled — dev mode"). 이 폴백이 없으면 jest·러너·로컬 vite가 전부 죽는다. 프로덕션 강제 여부는 compose env 주입으로 결정되며, 절차 문서에 "대시보드 등록+env 주입을 한 세트"로 못박는다.
- **D-4 적용 지점 = 쓰기 5종 라우트에만 미들웨어 명시 부착**(전역 app.use 아님 — GET 공개는 엣지 소관, 라우트 단위가 실수로 새 쓰기 라우트가 게이트를 빠뜨리는 걸 막진 못하므로 review 관심사로 명시). 미들웨어는 `requireWriteAuth` 단일 export.
- **D-5 CORS = 미들웨어 제거가 기본.** same-origin SPA는 CORS 헤더가 아예 불필요. 크로스 오리진 소비자가 생기면 `FLOWFORGE_CORS_ORIGIN` env 화이트리스트로만 재개(와일드카드 금지).
- **D-6 시크릿 취급**: AUD·토큰 값은 코드/커밋 금지(30-security). compose엔 `${FLOWFORGE_*}` 참조만, 실값은 호스트 `.env`(gitignore 확인).

## Risks / Trade-offs

- env 미설정 배포(대시보드 등록 전) 동안은 현행과 동일한 공개 상태 — 정직하게 문서화하고, 등록·주입 절차를 `docs/EDGE_AUTH.md`로 남긴다(엣지 등록은 사용자/별도 세션 작업).
- JWKS fetch가 기동 후 첫 쓰기 요청에서 발생 — 실패 시 해당 요청 401(가용성보다 안전 우선, 캐시로 상시화).
- CF Access 뒤에서는 SPA 쓰기가 CF 쿠키→cloudflared JWT 헤더 주입으로 자동 통과(웹 코드 무변경) — 단 로컬 직결(:8812) 사용 시엔 토큰 폴백을 써야 한다(문서화).

## 화면 구성 / UI

- 신규 화면 없음. 401 시 기존 상태바 에러 경로 재사용.
