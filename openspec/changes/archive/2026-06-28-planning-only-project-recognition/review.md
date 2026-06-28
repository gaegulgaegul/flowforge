# 배포 전 최종 검토 — planning-only-project-recognition
검토일: 2026-06-28 / 검토 범위: `server/src/lib/docs.ts`(hasDocs OR 추가), `server/src/lib/__tests__/docs.test.ts`, `server/src/routes/__tests__/docs.test.ts` (커밋 761d13d·e9c1532)

> 역할 분리: 이 검토는 **판단** 단계. 실증은 openspec-verify(verify.json)가 수행 — 최종 PASS, 7 scenario 전부 PASS, FAIL/검증안함/검증불충분 0 = **cleanly verified**. review는 재실행하지 않고 그 결과를 입력으로 판단한다.
>
> changeTypes: **backend** (서버 lib/routes 소스, frontend 파일·prototype.html 없음). criteria 3(병목)·4(UX)·7(반응형)은 해당 없음.

## 반드시 수정해야 할 항목
- 없음. verify.json 최종 PASS(치명 0), 보안(경로조작)·예외(404/null) 회귀 없음 확인. critical 티어 발견 없음.

## 수정하면 좋은 항목
- 없음. (아래 "유지" 항목으로 정리 — 굳이 바꿀 가치가 있는 변경 없음.)

## 현재 상태로 유지해도 되는 항목
- **(기준1·2 유지보수/과잉구현)** `hasDocs`에 OR 한 줄(`existsSync(join(docsDir, "planning", "prd.md"))`)만 추가 — `server/src/lib/docs.ts:24-32`. 새 함수·추상화·의존성 0. design 결정1(단일 게이트)·결정2(라우트와 동일 경로 문자열)를 정확히 지킴. `resolveDocsDir`/`listDocsProjects`가 모두 이 게이트를 거쳐 코드 수정 없이 자동 반영(`docs.ts:61,73`). 이보다 작게 만들 수 없는 최소 변경.
- **(기준6 보안)** 경로조작 차단(`project.includes("..") || !/^[A-Za-z0-9_-]+$/`)과 읽기전용 정책 불변. `planning/prd.md` 추가는 `existsSync` 읽기 1회만 — 쓰기 API 0건(static grep 입증). `..`/슬래시/비ASCII/특수문자 거부 회귀 테스트 통과. SQL·XSS·인젝션 벡터 없음(파일 존재 확인뿐).
- **(기준5 예외처리)** 파일/디렉토리 부재 → `resolveDocsDir` null → 라우트 404(500 아님). 기존 try/catch(readdir 실패 시 빈 배열) 그대로. 신규 분기 없음.
- **(테스트)** RED→GREEN 입증(적용 전 4 테스트 실패 → OR 추가 후 통과). 픽스처는 design 결정3대로 기존 패턴 재사용, 하위 디렉토리(`docs/planning/`)만 테스트 내 직접 생성. 회귀 0(server 119/119).

## 리팩토링 추천 항목
- 없음(권장 안 함). OR 3개가 길어지면 배열+`.some()`로 뺄 수 있으나, 3개·1회 호출에선 명시적 OR이 더 읽기 쉽다. 지금 추출은 오히려 과잉. **기준2 관점에서 현 상태가 정답.** (향후 인식 조건이 features.md·user-flow 등으로 늘면 그때 배열화 검토 — 2단계 이후.)

## 적대적 검토 (4 페르소나)
- **파괴자 (Saboteur)**: charter 문서와 `planning/prd.md`가 **둘 다** 있는 프로젝트 → OR이라 그냥 인식(중복 트리거 무해, 우선순위 불필요). `planning/prd.md`가 디렉토리로 존재하는 비정상 케이스 → `existsSync`는 true지만 이후 `buildDocsPlanningPrd`의 `readFileSync`가 EISDIR throw 가능 — 단 이는 **이번 change 밖**(예광탄 라우트가 이미 `safe()` 래퍼로 500→안전 처리, routes/docs.ts:67-82). 이번 인식 변경이 새로 만든 폭발 지점 없음. 동시성: 순수 읽기(공유 상태·쓰기 없음) → race 불가.
- **신입 개발자 (New Hire)**: `hasDocs` docstring을 "charter 산출물 또는 기획 산출물 OR 포함, 인식 경로는 라우트/빌더와 동일"로 보강 — 6개월 뒤도 *왜* planning/prd.md를 넣는지 읽힘(`docs.ts:19-23`). 매직값 없음(`"planning"`,`"prd.md"`는 라우트가 쓰는 동일 리터럴, design 결정2가 일치 근거 박제). 모듈 상단 주석도 갱신. 숨은 가정 없음.
- **보안 감사자 (Security Auditor)**: 공격 표면 = project 파라미터뿐인데 화이트리스트(`/^[A-Za-z0-9_-]+$/`)+`..` 차단이 인식 변경과 **독립적으로 먼저** 걸림(resolveDocsDir:71). planning/prd.md 추가는 그 게이트 *통과 후* 디렉토리 내부 존재 확인이라 새 탈출 경로 0. 민감정보 노출: docs 모듈은 파일 존재만 boolean으로 반환, 내용·경로를 에러로 흘리지 않음(safe-error.js). rate limiting은 기존 docs 라우트 정책 그대로(이번 change 범위 밖).
- **게으른 시니어 (Lazy Senior)**: ①OR 한 줄은 spec THEN(planning-only 인식)을 만족시키는 최소 — YAGNI 통과. ②`hasDocs`라는 기존 단일 게이트 재사용(새로 안 짬). ③④⑤ 표준 `existsSync`/`join`만 사용, 새 의존성 0. ⑥ 별도 `hasPlanning` 함수로 빼지 **않은** 것이 정답(1줄을 함수로 부풀리면 과잉) — design 결정1의 대안B 기각과 일치. **안 짜도 될 코드 없음. diff 줄일 여지 없음.**
- 2+ 페르소나 중복 발견(심각도 상승): 없음. 파괴자가 짚은 "디렉토리형 planning/prd.md → EISDIR"은 이번 change 밖(예광탄 safe() 처리)이라 중복·상승 대상 아님.

## 최종 배포 가능 여부
**배포 가능.** 치명 0, verify 최종 PASS(cleanly verified), 4페르소나 critical 발견 0. design 결정 4개 전부 준수, Non-Goals(features/유저플로우 인식·charter 폐기) 침범 없음. archive 게이트(verify PASS) open.

## 개선 우선순위 (제안)
1. (선택, 2단계 이후) 인식 조건이 features.md·user-flow 등으로 늘면 OR을 배열+`.some()`로 추출 — 지금은 불필요, 늘 때만. (영향: 가독성, 낮음)
- 그 외 즉시 조치 항목 없음.
