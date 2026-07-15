## Tasks

이 change는 flowforge 프론트(`web/src/App.tsx` 중심) 수정이다. 서버 신규 개발 없음(기존 change 목록 데이터 `activeChangeNames` 재사용). web 워크스페이스 vitest로 검증한다. 대부분 같은 파일(App.tsx)을 만지므로 병렬 여지가 적어 Sequential 위주로 구성한다.

### Parallel Group 1 (독립 - 동시 실행 가능: 서로 다른 테스트 파일)

- [x] 1.1 RED: 기획 없는 프로젝트(`hasCharter=false`, `activeChangeNames=["a","b"]`) skeleton 렌더 시 change 목록 항목 2개가 나타나는지 실패 테스트 작성 [parallel] — `web/src/__tests__/uncharted-change-list.test.tsx` (신규)
- [x] 1.2 RED: 기획 있는 프로젝트(`hasCharter=true`) skeleton에는 change 목록 섹션이 렌더되지 **않음**을 검증하는 회귀 실패 테스트 작성 [parallel] — 같은 신규 테스트 파일에 추가하되 1.1과 별 describe 블록. (파일 교집합 있으나 1.1과 함께 작성 가능 시 한 태스크로 병합해도 됨)

### Sequential: change 목록 진입로 구현 (GREEN)

- [x] 2.1 GREEN: `web/src/App.tsx` skeleton 렌더 블록(`dashStage === "skeleton"`, ~993)에 `!dashProject.hasCharter && (dashProject.activeChangeNames?.length ?? 0) > 0`일 때 change 목록 섹션을 렌더. 각 항목 = 클릭 가능한 버튼, onClick = `openChangeViews({ key: name, displayName: name, project: dashProject.name })`. 기존 "기획 문서가 없습니다" 안내문은 "change 목록에서 진입" 취지로 문구 조정. (테스트 실패 시 추측 수정 금지, 근본원인부터)
- [x] 2.2 GREEN: 활성 change 없는 기획-없는 프로젝트는 change 목록을 만들지 않고 "활성 change 없음"을 정직하게 표기(존재하지 않는 링크 미생성). spec의 빈 상태 시나리오 충족.

### Sequential: 회귀·엣지 확인

- [x] 3.1 회귀 확인: `hasCharter=true` 프로젝트(flowforge)의 기존 planning 탭(PRD/features/wire/flow)과 기능명세 노드 경유 change 진입이 불변인지 테스트로 고정. 무력화 프로브(가드 `!hasCharter` 제거 시 회귀 테스트 red) 확인.
- [x] 3.2 딥링크 검증: change 클릭 시 URL에 `?project=<영문키>&change=<key>&tab=prd`가 기록되고 한글 displayName이 아닌 영문 name이 실리는지 확인(빈/플레이스홀더 project 금지).

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [x] 4.1 VERIFY: **PASS** (2026-07-15, `verify.md` 참조). 5단계 게이트 전부 통과 — 빌드 0·타입체크 0·린트 0·테스트(web 16/16·server 545/545 무회귀)·UI 실픽셀. 라이브 재배포(`docker compose up -d --build`) 후 Playwright로 agentic-harness(고아 프로젝트) change 목록 렌더 → 클릭 → PRD 본문 실렌더(8398자) 실증. 브라우저 실요청 4종 전부 200(`?project=agentic-harness`). 시나리오 6/6 PASS. ⚠️최초 FAIL 판정은 검증자 오류(API를 `?project=` 없이 호출해 404 오판)였고 `verify.md` 정정 이력에 기록함.
