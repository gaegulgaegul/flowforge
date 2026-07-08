# cross-project-change-views (delta)

## ADDED Requirements

### Requirement: change 5종 뷰는 프로젝트 컨텍스트로 해석된다

WHEN a change view route (graph·ia·wireframe·prd·spec-tree GET, layout PUT) receives an optional `?project=<name>` query, the server SHALL resolve the change under that project's `openspec/changes/` directory, validating the project against the existing whitelist (PROJECTS_ROOT 1-depth real directory, `..` rejected) — an invalid or unknown project SHALL yield 404 without filesystem probing outside the root. WHEN the query is absent, resolution SHALL use the current global root unchanged (backward compatible).

#### Scenario: 타 프로젝트 change 뷰가 열린다

- **WHEN** PROJECTS_ROOT 하위 다른 프로젝트의 change id로 `?project=`를 붙여 graph를 요청한다
- **THEN** 그 프로젝트의 openspec/changes에서 해석된 그래프가 200으로 반환된다

#### Scenario: project 부재 = 기존 동작 불변

- **WHEN** `?project=` 없이 기존 URL로 요청한다
- **THEN** 현행 글로벌 루트 기준 동작(응답·404 조건)이 그대로다

#### Scenario: 경로 조작은 차단된다

- **WHEN** `project=../..` 또는 존재하지 않는 프로젝트로 요청한다
- **THEN** 404이며 루트 밖 파일시스템 접근이 발생하지 않는다

### Requirement: web은 change 진입 컨텍스트를 뷰 호출에 전달한다

WHEN a change is opened from a project card drill-down, the web client SHALL carry that project name and attach it to all five view fetches and the layout save; a change opened without project context SHALL keep current behavior.

#### Scenario: 카드 경유 change 클릭 → 5종 뷰 로드

- **WHEN** wowa-app 카드에서 change를 클릭한다
- **THEN** 5종 뷰가 404 없이 그 프로젝트의 산출물로 렌더된다

#### Scenario: 읽기전용 프로젝트의 배치 저장은 무해 실패

- **WHEN** 읽기전용 마운트 프로젝트에서 노드를 드래그해 배치 저장이 실패한다
- **THEN** 상태바 안내만 표시되고 뷰·문서·데이터는 불변이다

## TDD Plan

- **Red**: (1) resolveChangeDir(rootDir 지정) 단위 — 프로젝트 루트 기준 해석·`..` 차단 (2) 라우트 통합 — `?project=` 200 / 미지정 기존 동작 / 조작 404.
- **Green**: changes.ts 시그니처 확장 + graph.ts 7 라우트 project 처리 + 검증 재사용 + web 전달.
- **Refactor**: 없음.
- Mock 대상: 없음(temp 픽스처 프로젝트 2개).
