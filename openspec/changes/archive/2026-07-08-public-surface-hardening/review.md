# 배포 전 최종 검토 — public-surface-hardening
검토일: 2026-07-08 / 검토 범위: 이 change 커밋 diff(3c9911c·7b82b27·112e540·9b0b010·8f0780d) — `server/src/lib/cfAccess.ts`(신규)·`requireWriteAuth.ts`(신규)·`corsOptions.ts`(신규) + `routes/graph.ts`·`routes/docs.ts`(미들웨어 부착 6곳)·`index.ts`(cors 교체)·`docker-compose.yml`(env)·`docs/EDGE_AUTH.md`(신규). 앱 전체 아님.

## review criteria brief
- changeTypes: **backend + infra**(server 소스 + compose/문서, frontend 변경 0)
- criteria: 1 in·2 in·3 in·**4 out(frontend 변경 없음)**·5 in·6 in(핵심)·**7 out(frontend 변경 없음)**·8 in·9 in·10 in
- ruleSets: resolvedFrom `~/.claude/rules/` · selected 30-security·20-testing·70-adversarial-review·10-coding-style · absent 없음
- designYardsticks: decisions D-1(의존성0 TS포팅)·D-2(게이트 판정 OR)·D-3(env 미설정=dev 모드)·D-4(쓰기 5종만 명시 부착)·D-5(CORS 제거 기본)·D-6(시크릿 커밋 금지) / nonGoals CF 대시보드 등록·rate limit·GET 앱레벨 게이트
- specsVerifyFocus: verify SKIPPED 1건 = "유효 CF Access JWT → 쓰기 허용"(라이브 엣지 JWKS 미프로비저닝)
- adversarialScope: full change scope (NOT narrowed by this brief)

## 반드시 수정해야 할 항목
- 없음

## 수정하면 좋은 항목
- **[낮음] JWKS 캐시가 fail-open은 아니나 fetch 실패 시 상시 401.** `cfAccess.ts:199-201` fetch/파싱 실패는 fail-closed(안전)지만, 팀 도메인 일시 장애 시 CF JWT 경로 쓰기가 전부 막힌다(토큰 폴백은 여전히 동작하므로 완전 중단은 아님). 캐시된 JWKS가 있으면 TTL 만료 후에도 stale 재사용을 허용하는 grace 옵션은 후속 고려. 현재는 안전 우선이 정당(보안 change).
- **[낮음] `defaultFetchJwks` 시그니처와 호출 불일치 흔적.** `cfAccess.ts:79` `defaultFetchJwks(url)`는 인자를 받는데 `:184`에서 `() => defaultFetchJwks(cfg.jwksUrl)`로 감싸 호출 — 정상 동작이나, 함수가 url을 받으면서 이름은 default라 약간 혼동. 기능 무해.

## 현재 상태로 유지해도 되는 항목
- **alg 핀 + fail-closed 일관** — `cfAccess.ts:163` `header.alg !== "RS256"` 거부(none/alg-confusion 방어), 서명·aud·iss·exp·nbf·email 각 실패가 전부 `return null`(내부 사유 미노출). 검증 순서도 서명 먼저 → claims(위조 서명이 claims 검사에 도달 못 함).
- **상수시간 토큰 비교** — `requireWriteAuth.ts:29-38` 길이 불일치도 timingSafeEqual 경로를 타 길이 오라클 차단.
- **미들웨어가 핸들러 앞** — 쓰기 6곳(graph 1·docs 5) 전부 `requireWriteAuth`가 `safe(handler)` 앞. 401 시 핸들러 미실행 = 파일 불변 구조적 보장(격리 서버 실측: 무자격 5종 401).
- **CORS 와일드카드 필터** — `corsOptions.ts:18` `s !== "*"`로 `*` 입력조차 화이트리스트에서 제거.
- **email claim 필수(service token 거부)** — `cfAccess.ts:224` 사람 사용자만 쓰기(권한 확대 차단, 선례 계승).
- **시크릿 취급** — compose는 `${...:-}` 참조만(값 커밋 0), `.gitignore`에 `.env`·`.env.*` 확인, EDGE_AUTH.md도 실값 대신 자리표시.

## 리팩토링 추천 항목
- 없음(3파일 각 30~230줄, 단일 책임 명확).

## 적대적 검토 (4 페르소나 — 보안 change라 특히 적대적)
- **파괴자**: JWKS fetch 타임아웃(8s)·네트워크 실패 → fail-closed 401(토큰 폴백 생존). kid 회전 → 강제 재조회 1회로 대응. **터지는 지점 못 찾음** — 모든 실패 경로가 null/401로 수렴(fail-open 없음). 유일 가용성 리스크는 JWKS 장애 시 CF 경로 401인데 이건 설계된 안전 선택.
- **신입 개발자**: 각 함수에 의도 주석(alg 핀·fail-closed·상수시간 근거) 잘 달림. `defaultFetchJwks` 이름-인자 미스매치(위 낮음)만 소소한 혼동. 매직 넘버(JWKS_TTL·SKEW·TIMEOUT)는 상수로 추출됨.
- **보안 감사자**: **공격 벡터 탐색** — ①alg=none/HS256 confusion → alg 핀으로 차단(:163) ②서명 없이 claims만 → 서명 먼저 검증(:198), 실패 시 claims 미도달 ③aud 스푸핑 → 정확 일치(:209) ④만료 토큰 → exp+skew(:216), exp 누락도 fail(0<now) ⑤service token 권한 확대 → email 필수(:224) ⑥토큰 타이밍 → 상수시간 ⑦401 사유 노출 → `{error:"unauthorized"}` 고정. **뚫는 벡터 못 찾음.** 단 잔존 표면: origin(:8812)이 컨테이너 네트워크에 노출 — 이건 엣지 CF Access(1차 방어)가 덮어야 하고, 이 change는 2차(origin)까지만 = 설계된 범위.
- **게으른 시니어**: cfAccess를 npm(jose/jwks-rsa) 대신 node:crypto로 직접 짠 게 과잉인가? → **정당**(D-1: 신규 의존성 0 명시 결정, 90-tech-evaluation 부합, ~230줄로 검증 범위 좁음, 선례 cfaccess.py 동형). requireWriteAuth·corsOptions도 각각 단일 책임 최소 구현. "안 짜도 될 코드" 없음 — 무인증 공개라는 실제 결함을 닫는 최소 코드.
- 2+ 페르소나 중복 발견(심각도 상승): 없음.

## 최종 배포 가능 여부

**배포 가능**

- 코드(쓰기 게이트 5종·CF JWT 검증·토큰 폴백·CORS·dev 모드)는 격리 서버 실동작(무자격 5종 401·올바른 토큰 200·GET 200·CORS 헤더 부재·dev 모드 통과)과 단위 테스트 384/384로 실증. 치명 0.
- verify "조건부"의 유일 사유 = **CF Access JWT 라이브 실증 SKIPPED**. 이는 코드 결함이 아니라 **CF Zero Trust 대시보드 등록(인프라)이 선행돼야 실증 가능한 항목**이며, `docs/EDGE_AUTH.md` 절차로 남겼다. CF JWT 검증 로직 자체는 RSA 픽스처 단위 테스트로 통과. **사용자가 이 상태(SKIPPED=인프라 후속)로 archive를 승인**(2026-07-08, "1번").
- 이 change로 **무인증 원격 쓰기라는 실제 코드 부채는 닫힌다**(env 주입 시 강제). 엣지 등록은 EDGE_AUTH.md대로 언제든 얹는 인프라 후속.

## 개선 우선순위 (제안)
1. (인프라 후속·코드 아님) CF Zero Trust에 flowforge.gaegul.house 등록 + 호스트 .env 주입 → env 활성 시 쓰기 게이트가 실제로 강제된다(EDGE_AUTH.md). 이걸 하기 전까지는 현행과 동일한 무인증 공개 — 정직 인지.
2. (낮음) JWKS stale-grace 옵션 — 팀 도메인 일시 장애 시 CF 경로 가용성 향상(현재는 안전 우선). 후속.
3. (낮음) `defaultFetchJwks` 네이밍 정리.
