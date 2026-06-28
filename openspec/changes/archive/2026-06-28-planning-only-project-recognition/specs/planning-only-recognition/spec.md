# planning-only-recognition

charter 산출물(`user-flow.md`/`PRD.md`) 없이 `docs/planning/prd.md`만 가진 프로젝트를 flowforge가 docs 프로젝트로 인식하는 능력. 인식 판정은 `hasDocs` 단일 게이트로 수렴하므로 `resolveDocsDir`(단일 해석)와 `listDocsProjects`(전체 스캔) 양쪽에 일관 적용된다.

## ADDED Requirements

### Requirement: planning/prd.md만 있어도 docs 프로젝트로 인식한다
flowforge 서버는 프로젝트의 `docs/` 하위에 `user-flow.md` 또는 `PRD.md` 또는 `planning/prd.md` 중 **하나라도** 있으면 해당 프로젝트를 docs 프로젝트로 인식 SHALL 한다. 인식 판정은 `hasDocs(docsDir)` 함수 한 곳에서 결정되며, `resolveDocsDir`와 `listDocsProjects`는 이 게이트를 거쳐 동일 규칙을 따른다.

#### Scenario: planning-only 프로젝트를 resolveDocsDir이 인식한다
- **WHEN** 프로젝트 `docs/` 아래에 charter 문서 없이 `planning/prd.md`만 존재하고 `resolveDocsDir(project)`를 호출한다
- **THEN** null이 아니라 해당 프로젝트의 docs 절대경로를 반환한다

#### Scenario: planning-only 프로젝트가 listDocsProjects 목록에 포함된다
- **WHEN** `DOCS_ROOT` 아래에 `planning/prd.md`만 가진 프로젝트가 있고 `listDocsProjects()`를 호출한다
- **THEN** 반환 목록에 그 프로젝트 이름이 포함된다

#### Scenario: planning-only 프로젝트에서 planning-prd API가 200을 반환한다
- **WHEN** charter 문서 없이 `<project>/docs/planning/prd.md`만 있는 프로젝트로 `GET /api/docs/<project>/planning-prd`를 호출한다
- **THEN** (이전에는 인식 실패로 404였으나) HTTP 200과 함께 PRD 5섹션을 담은 `prd` 객체를 반환한다

### Requirement: charter 프로젝트 인식은 보존된다
`planning/prd.md` 조건을 OR로 추가하는 것은 인식 범위를 넓힐 뿐이며, 기존 charter 문서(`user-flow.md`/`PRD.md`)를 가진 프로젝트의 인식은 SHALL 그대로 유지된다(회귀 없음).

#### Scenario: charter 문서만 있는 프로젝트는 그대로 인식된다
- **WHEN** `docs/`에 `planning/prd.md` 없이 `user-flow.md`(또는 `PRD.md`)만 있는 프로젝트로 `resolveDocsDir`를 호출한다
- **THEN** 변경 전과 동일하게 docs 절대경로를 반환한다

#### Scenario: docs 문서가 전혀 없는 프로젝트는 인식되지 않는다
- **WHEN** `docs/` 아래에 `user-flow.md`/`PRD.md`/`planning/prd.md`가 모두 없는(예: `notes.md`만 있는) 프로젝트로 `resolveDocsDir`를 호출한다
- **THEN** null을 반환한다(인식 실패)

### Requirement: 경로안전과 읽기전용은 불변이다
인식 범위 확장은 파일 시스템 읽기만 추가할 뿐이며, 경로 조작 방지(`..` 금지 + 단일 세그먼트 화이트리스트)와 읽기전용 정책을 SHALL 유지한다. docs 모듈은 어떤 파일도 쓰지 않는다.

#### Scenario: 경로 조작은 여전히 차단된다
- **WHEN** `resolveDocsDir`에 `..` 포함 문자열이나 슬래시·비ASCII·특수문자가 든 project를 넘긴다
- **THEN** planning-only 인식 추가와 무관하게 null을 반환하고 디렉토리 밖 파일을 읽지 않는다

#### Scenario: planning/prd.md 존재 확인은 읽기 전용이다
- **WHEN** `hasDocs`가 `planning/prd.md` 존재를 확인한다
- **THEN** `existsSync`로 존재만 확인할 뿐 파일을 생성·수정·삭제하지 않는다

## TDD Plan

- **Red**: `docs.test.ts`에 (1) planning-only 프로젝트의 `resolveDocsDir`가 경로 반환 (2) `listDocsProjects` 목록 포함 (3) charter-only 프로젝트 회귀 (4) 셋 다 없으면 null — 실패 테스트 작성. 라우트 레벨은 `routes/__tests__/docs.test.ts`에 planning-only 프로젝트로 200 반환 케이스 추가.
- **Green**: `hasDocs`에 `existsSync(join(docsDir, "planning", "prd.md"))`를 OR로 추가(최소 변경). docstring 한 줄 보강.
- **Refactor**: 불필요. 단일 OR 추가로 충분(과한 추상화 금지).
- **Mock 대상**: 없음. 실제 임시 디렉토리(`mkdtempSync`) 픽스처로 파일 시스템 직접 검증(기존 테스트 패턴 그대로).
