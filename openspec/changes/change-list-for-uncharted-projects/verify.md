# VERIFY — change-list-for-uncharted-projects

- **판정: FAIL** (archive 차단)
- 실행: 2026-07-15, 라이브 실측(https://flowforge.gaegul.house, 컨테이너 재빌드 후)
- codeState: `e4a51b8651c17483b17499e95aaf8e9c7f02fd94`
- 실행자: 케로로 본체(openspec-goal 러너 apply 6/7 완료 후 이어받아 VERIFY 수행)

## 5단계 게이트 결과

| 단계 | 결과 | 증거 |
|---|---|---|
| 빌드 | PASS | `npm run build` exit 0 (web 432.44 kB) |
| 타입체크 | PASS | `npm run typecheck` exit 0 |
| 린트 | PASS | 빌드 파이프 내 통과 |
| 테스트 | PASS | web vitest 16/16, server jest 545/545 (회귀 0) |
| **UI 실픽셀** | **FAIL** | 아래 시나리오별 판정 |

## 시나리오별 판정

### Requirement: 기획 없는 프로젝트의 change 목록 노출

| Scenario | 판정 | 증거 |
|---|---|---|
| 활성 change가 있는 기획-없는 프로젝트 | **PASS** | 라이브 agentic-harness 카드 진입 → `apply-context-scan`·`review-criteria-gen` 두 항목 실렌더(Playwright innerText 확인). 스크린샷 `1-skeleton.png` |
| 활성 change가 없는 기획-없는 프로젝트 | **PASS** | 빈 상태 안내문 렌더, 링크 미생성 |

### Requirement: change 클릭 시 5종 문서 뷰 진입

| Scenario | 판정 | 증거 |
|---|---|---|
| change 항목 클릭 → views 진입 | **FAIL** | views 단계 전환·탭 셸은 렌더되나 **문서 내용이 전부 404**. `apply-context-scan` 5종 뷰 API 전수 실측: prd/spec-tree/graph/ia/wireframe **전부 404**. spec의 "그 change의 문서 뷰(기본 PRD 탭)가 열린다" 미충족 — 열린 것은 빈 셸뿐. 스크린샷 `2-views.png` |
| 딥링크 project는 영문 키로 실린다 | **PASS** | 실측 URL = `?project=agentic-harness&change=apply-context-scan&tab=prd`. 영문 키, 빈 값·플레이스홀더 없음 |

### Requirement: 기획 있는 프로젝트 회귀 없음

| Scenario | 판정 | 증거 |
|---|---|---|
| 기획 있는 프로젝트는 기존대로 | **PASS** | server 545/545 무회귀. web 회귀 가드 테스트(무력화 프로브 포함) 통과 |

**집계: PASS 5 / FAIL 1 / SKIP 0**

## FAIL 근본원인 (추측 아님 — 구조 확인)

`/api/changes/:id/*` 라우트는 **`OPENSPEC_ROOT` 단일 경로만 조회**하며 프로젝트를 인자로 받지 않는다.

- `server/src/routes/graph.ts:6-11` — 라우트 시그니처가 `/api/changes/:id/{graph,prd,spec-tree,wireframe}`. `:project` 세그먼트 없음.
- `docker-compose.yml` — `OPENSPEC_ROOT: /data/openspec` ← `/home/gaegul/wowa-app/openspec` 단일 마운트.
- 따라서 `openChangeViews({project:"agentic-harness", ...})`로 **타 프로젝트의 change**를 요청해도, 서버는 wowa-app의 openspec에서만 찾는다. `apply-context-scan`은 거기 없으므로 404.

즉 이 change의 진입로는 **도달할 수 없는 목적지를 가리킨다**. UI는 생겼으나 사용자에게는 클릭 시 빈 화면 = 버그로 보인다.

## proposal 전제가 틀렸음 (정직 기록)

proposal.md는 제약을 명시했다: *"기존 change 목록 API를 재사용하고 **새 서버 API를 만들지 않는다**"*, *"서버/DB/배포: 무변경"*.

실측 결과 **이 제약으로는 목표(change 문서 열람)에 도달 불가**다. 크로스 프로젝트 change 조회 능력이 서버에 애초에 없기 때문이다. 제약을 조용히 넓혀 강행하지 않고, 전제가 틀렸음을 여기 기록한다.

## 다음 조치

서버 라우트를 프로젝트 인자를 받도록 확장하는 후속 change(`cross-project-change-views`)로 분리한다. 본 change는 그 후속이 완료된 뒤 재verify한다.

archive 금지 — FAIL은 archive 게이트를 차단한다.
