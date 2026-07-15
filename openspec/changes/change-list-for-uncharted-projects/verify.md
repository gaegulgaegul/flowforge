# VERIFY — change-list-for-uncharted-projects

- **판정: PASS** (archive 게이트 통과)
- 실행: 2026-07-15, 라이브 실측(https://flowforge.gaegul.house, 컨테이너 재빌드 후)
- codeState: `d74ba7e` 시점 소스 기준(이후 verify 산출물 커밋으로 HEAD 이동 시 재바인딩 필요)
- 실행자: 케로로 본체(openspec-goal 러너 apply 6/7 완료 후 이어받아 VERIFY 수행)

## 정정 이력 (중요 — 최초 FAIL 판정은 검증자 오류였음)

이 문서의 최초 버전(커밋 `d74ba7e`)은 **FAIL**로 기록했으나 **그 판정 자체가 틀렸다**. 정정 사유를 숨기지 않고 남긴다.

- 최초 FAIL 근거: "5종 뷰 API가 전부 404 → 크로스 프로젝트 change 조회 불가".
- **실제**: 검증자(나)가 API를 `?project=` **인자 없이** 호출해 404를 받고, 이를 서버 미지원으로 단정했다. 서버는 이미 크로스 프로젝트를 지원한다(`resolveChangeFromReq`, `server/src/routes/graph.ts:37-45`, archive `2026-07-08-cross-project-change-views`).
- **결정적 증거**: 브라우저가 라이브에서 실제로 보낸 요청을 Playwright `response` 이벤트로 포착한 결과 — 전부 200:
  ```
  200 /api/changes/apply-context-scan/prd?project=agentic-harness
  200 /api/changes/apply-context-scan/spec-tree?project=agentic-harness
  200 /api/changes/apply-context-scan/wireframe?project=agentic-harness
  200 /api/changes/apply-context-scan/graph?project=agentic-harness
  ```
  PRD 본문도 실제 렌더됨(본문 8398자, 개요/핵심가치 등 섹션 존재).
- 교훈: **검증 실패를 코드 결함으로 단정하기 전에 내 검증 방법부터 의심하라.** UI가 보내는 실제 요청을 봤어야 했다(추측 경로로 API를 때려 404→오판). 이는 [[project_flowforge_worktree_merge]] 2026-07-13 기록의 동일 함정 재발이다.

## 5단계 게이트 결과

| 단계 | 결과 | 증거 |
|---|---|---|
| 빌드 | PASS | `npm run build` exit 0 (web 432.44 kB) |
| 타입체크 | PASS | `npm run typecheck` exit 0 |
| 린트 | PASS | 빌드 파이프 내 통과 |
| 테스트 | PASS | web vitest 16/16, server jest 545/545 (회귀 0) |
| UI 실픽셀 | PASS | 라이브 재배포(`docker compose up -d --build`) 후 Playwright 실측 |

## 시나리오별 판정

### Requirement: 기획 없는 프로젝트의 change 목록 노출

| Scenario | 판정 | 증거 |
|---|---|---|
| 활성 change가 있는 기획-없는 프로젝트 | PASS | 라이브 agentic-harness 카드 진입 → `apply-context-scan`·`review-criteria-gen` 두 항목 실렌더 |
| 활성 change가 없는 기획-없는 프로젝트 | PASS | 빈 상태 안내문 렌더, 링크 미생성 |

### Requirement: change 클릭 시 5종 문서 뷰 진입

| Scenario | 판정 | 증거 |
|---|---|---|
| change 항목 클릭 → views 진입 | PASS | 클릭 → views 전환 → PRD 탭 열림. 브라우저 실요청 4종 전부 200, PRD 본문 8398자 실렌더 |
| 딥링크 project는 영문 키로 실린다 | PASS | 실측 URL = `?project=agentic-harness&change=apply-context-scan&tab=prd`. 영문 키, 빈 값·플레이스홀더 없음 |

### Requirement: 기획 있는 프로젝트 회귀 없음

| Scenario | 판정 | 증거 |
|---|---|---|
| 기획 있는 프로젝트는 기존대로 | PASS | server 545/545 무회귀. web 회귀 가드 테스트(무력화 프로브 포함) 통과 |

**집계: PASS 6 / FAIL 0 / SKIP 0**

## 검증 중 발견한 별건 결함 (이 change 범위 밖 — 후속 대상)

`PUT /api/changes/:id/layout?project=<타프로젝트>` 가 **HTTP 500**을 반환한다. 이 change의 시나리오에는 없으나(읽기 전용 진입로), 크로스 프로젝트 기능 전반의 실결함이므로 기록한다.

- 근본원인: `PROJECTS_ROOT`(`/home/gaegul` → `/data/docs-root`)가 **RO 마운트**인데 `writeOverlay()`(`server/src/lib/changes.ts:88-92`)가 `<change>/viz/` 를 `mkdirSync` 시도 → EROFS → generic 500.
- 컨테이너 내부 실측: `mkdir: can't create directory '/data/docs-root/agentic-harness/openspec/changes/apply-context-scan/viz': Read-only file system`
- 테스트가 못 잡는 이유: `graphCrossProject.test.ts:110-127`이 쓰기 가능한 `mkdtempSync` tmp 루트를 쓰므로 프로덕션 RO 조건을 재현하지 못한다(픽스처가 프로덕션보다 관대).
- 선례: `WIREFRAME_FEEDBACK_ROOT`(`docker-compose.yml:23-26`)가 동일한 RO-홈 문제를 전용 RW 볼륨으로 푼 전례.
- ⚠️ 홈 마운트를 RW로 뒤집는 해법은 지양(`server/src/lib/projects.ts:36-37`에 무인증 홈 전체 마운트의 의도적 보안 경계로 명시됨).
- 사용자 도달 가능성: **확인 못 함** — web이 layout 저장 시 `project`를 싣는지 미추적.

→ 후속 change 후보: `cross-project-layout-persistence`.

## 다음 단계

archive 게이트 통과. `/openspec-review` 후 `/openspec-archive`.
