# 배포 전 최종 검토 — hierarchical-project-dashboard

## [2026-06-25 재검토 #2] verify PASS 반영 + race 가드 무결성 검증 → **배포 가능**
검토 입력: verify.json **PASS**(server 108/108, web Playwright 헤드리스 20/20, SKIPPED 0). 지난 검토(조건부 verify 기준) 이후 추가된 race 가드 수정 코드(커밋 65899ea)를 신규 검토.

**최종 verdict: 배포 가능** (반드시 수정 0건). code-reviewer 에이전트 재검토 + 3페르소나 적대적 패스.
- ✅ **HIGH-1 해결 검증**: race 가드(`dashReqToken` useRef) 무결 — `.then`/`.catch` 양쪽 토큰 비교 완전(App.tsx:280·286·305·311), 동기 setState 순서(React18 배칭)·토큰 오버플로우(2.8억년)·언마운트 전부 검토, 허점 없음.
- ✅ **HIGH-2 해결 검증**: `setSelected("")` → `if (!selected) return` 가드(App.tsx:150)에 걸려 stale 이중 로드 차단, 부작용 없음.
- **수정하면 좋은(배포 블로커 아님)**: [MEDIUM] AbortController 미사용(dev Strict Mode setState 경고 가능, 프로덕션 단일 App 언마운트 안 됨—실해 없음) / [LOW] listProjectCards labelMap 미주입(displayName 영문 폴백, 한글 표시 필요 시 TODO) / [LOW] dashReqToken 교차핸들러 공유 의도 주석 1줄.
- **리팩토링**: indexFor 매 요청 spec.md 재파싱(홈서버 규모 무해, request 캐시 여지).
- **적대적 3페르소나**: 파괴자(race 가드 못 막는 시나리오 탐색 → 전부 올바르게 처리 확인) / 신입(dashReqToken 공유 의도 주석 보강 권장) / 보안(신규 코드 injection·노출 벡터 0, project/cap JSON 반사라 XSS 불가, resolveProjectDir 정규식+existsSync 이중가드).
- **2+ 페르소나 중복**: 없음(지난 검토의 openProject race는 이번에 수정 확인됨).

---

## [2026-06-25 후속] 리뷰 지적 수정 반영
- ✅ **HIGH-1 해결**: openProject/openCapability에 race 가드(`dashReqToken` useRef) 추가 — 늦게 도착한 응답이 다른 항목 클릭 후 상태를 덮어쓰지 않음(`App.tsx`). useCallback `[]` 이유 주석도 추가.
- ✅ **HIGH-2 해결**: source "change" 전환 시 `setSelected("")` 동기 추가 — stale selected 이중 로드 제거(`App.tsx`).
- ✅ **graph.ts 헤더 주석 갱신**: `/api/projects` → `/api/changes`.
- ⏸ MEDIUM-3(views 로딩상태)·MEDIUM-4(indexFor 캐시): 예광탄 다음 이터레이션으로 보류(배포 블로커 아님).
- 재검증: 타입체크 PASS · web 빌드 PASS · server 108 테스트 PASS(무손상). ⚠️ race 가드 로직은 프론트 테스트 러너 부재로 단위테스트 없음 — 타입/빌드 + 코드리뷰로만 검증(실픽셀 관찰은 여전히 브라우저 부재로 미관찰).

---

검토일: 2026-06-25 / 검토 범위: 이 change의 diff (23파일, +1927/-37) — server/src/lib/{projects,capabilityIndex,koreanLabels}.ts + tests, server/src/routes/{projects,graph}.ts + tests, server/src/index.ts, shared/src/{dashboard-types,index}.ts, web/src/{App,ProjectGrid,CapabilityChangeList}.tsx, web/src/{api.ts,styles.css}

> 판단 입력: verify.json 최종판정 **조건부** (server PASS 10 / web SKIPPED 10 — 실픽셀 브라우저 렌더 미관찰). review는 verify를 재실행하지 않고 판단에만 사용. 정적 코드 리뷰 기준.

## 반드시 수정해야 할 항목
- 없음 (CRITICAL/배포 블로커 0건).

## 수정하면 좋은 항목
- **[HIGH-1] openProject race condition** (`web/src/App.tsx:263`): `useCallback` deps `[]` + fetchCapabilities 비동기. 카드 빠른 연속 클릭 시 늦게 도착한 응답이 다른 프로젝트 컨텍스트에서 `setCapabilities`/`setDashStage` 실행 → 엉뚱한 capability 표시. 표시 오류(데이터 손상 아님). → **이번 루프에서 수정**(cancelled 플래그).
- **[HIGH-2] dashboard→change 전환 시 stale selected 이중 로드** (`web/src/App.tsx:108-138`): change 브랜치가 selected를 동기 초기화 안 함 → 5-view useEffect가 old selected로 1회 + fetchChanges 완료 후 1회 = 이중 fetch. → **이번 루프에서 수정**(`setSelected("")` 1줄).
- **[MEDIUM-3] views 단계 wire/spec/ia 탭 로딩 상태 없음** (`App.tsx:440-461`): null이면 블랭크 화면. 기존 change 모드도 동일한 pre-existing 패턴. → 예광탄 다음 이터레이션.
- **[MEDIUM-4] indexFor 이중 호출** (`server/src/routes/projects.ts:63-70`): /capabilities 와 /:cap/changes가 각각 full re-scan. 홈서버 규모선 체감 없음. → 프로젝트 수 늘면 캐시.

## 현재 상태로 유지해도 되는 항목
- **경로조작 방어 충분**: resolveProjectDir(`projects.ts:30`) `..` 차단 + `^[A-Za-z0-9_-]+$` 화이트리스트. Express 디코딩 후 전달이라 `%2e` 우회 불가.
- **:cap 파라미터 미검증 = 보안 위험 없음**(`projects.ts:102`): Map 룩업에만 사용, 파일 I/O 0, JSON 응답이라 XSS 불가.
- **거짓연결 0 엄격 유지**(`capabilityIndex.ts:86`): `charterCaps.has(capKey)` set 멤버십만, 유사도 매칭 코드 0. 테스트(b)로 실증.
- **라우트 충돌 해결 일관성**: graph.ts `/api/changes` ↔ projects.ts `/api/projects` 분리, api.ts 호출처 일치(grep 확인), 다른 사용처 0.
- **symlink 방어**(`projects.ts:74`): lstatSync 심링크 차단.
- **dashboard→grid 교차오염 방지**(`App.tsx:128-137`): source 전환 시 dashboard 상태 동기 초기화.

## 리팩토링 추천 항목
- **graph.ts 헤더 주석 stale**(`graph.ts:4`): `GET /api/projects` 주석이 rename 후에도 남음. → **이번 루프에서 갱신**.
- **indexFor 반환 타입 미선언**(`projects.ts:63`): 명시하면 리팩토링 시 타입 안내.
- **openProject useCallback `[]` 이유 주석 부재**: 의도(setters stable)인지 실수인지 불명. → **이번 루프에서 주석 추가**.

## 적대적 검토 (3 페르소나)
- **파괴자**: ①openProject race(HIGH-1, 실재현 가능) ②PROJECTS_ROOT 미설정 시 기본 `cwd/..`가 홈 전체 스캔 가능(홈서버 cwd 고정이라 낮은 확률).
- **신입 개발자**: ①openProject deps `[]` 이유 주석 없음 ②indexFor 네이밍 모호 ③`capabilityLabel(key, specLabels, new Map())`의 빈 맵이 "폴백 미동작 버그"로 오해 소지(주석 부재).
- **보안 감사자**: ①/api/projects 무인증 노출 = 설계 의도(개인 로컬 툴), 기존 /api/changes도 동일 → 신규 위험 아님 ②readProposalTitle 전체 파일 로드 = 사용자 자기 파일이라 외부 위협 아님 ③cap 미검증 = Map 룩업이라 위험 없음.
- **2+ 페르소나 중복 발견(심각도 상승)**: openProject race를 파괴자+신입이 함께 지적 → HIGH로 격상(이번 루프 수정 대상).

## 최종 배포 가능 여부
**조건부 가능 (치명 0건)** — 배포 블로커 없음. CRITICAL 0. HIGH-1/HIGH-2는 작은 수정이라 이번 루프에서 처리. web 실픽셀 미관찰(verify SKIP 10)은 환경 제약(브라우저 부재)이며 코드존재+백엔드실증+타입/빌드 PASS 상태 — 후속 브라우저 관찰 게이트 필요.

## 개선 우선순위 (제안)
1. HIGH-1 openProject race 수정(cancelled 플래그) — 데이터 표시 정합성, 이번 루프
2. HIGH-2 source change 전환 setSelected("") — 1줄, 이번 루프
3. graph.ts 헤더 주석 갱신 + openProject 주석 — 문서 정확성, 이번 루프
4. MEDIUM-3 로딩 상태 / MEDIUM-4 캐시 — 예광탄 다음 이터레이션
5. web 실픽셀 브라우저 관찰 — 환경에 브라우저 갖춰지면(사용자/외부PC)
