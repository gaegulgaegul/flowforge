# planning-prd-view

## Purpose

flowforge가 `docs/planning/prd.md`(기획 단계 산출물)를 읽어 기존 PrdPanel로 PRD 5섹션을 렌더하는 능력.

## Requirements

### Requirement: flowforge가 docs/planning/prd.md를 읽어 PRD를 제공한다
flowforge 서버는 `docs/planning/prd.md`를 읽어 기존 `Prd`(5섹션) 구조로 파싱해 API로 SHALL 제공한다. 새 PRD 파서를 만들지 않고 기존 PRD 5섹션 파서를 재사용한다. 라우트는 `GET /api/docs/:project/planning-prd`이며 `{ project, prd }` 형태를 반환한다.

#### Scenario: planning PRD 조회 성공
- **WHEN** `DOCS_ROOT` 아래에 `<project>/docs/planning/prd.md`가 존재하고 `GET /api/docs/<project>/planning-prd`를 호출한다
- **THEN** HTTP 200과 함께 5섹션(개요·핵심가치·타겟·시나리오·성공지표·속성설정)을 담은 `prd` 객체를 반환한다

#### Scenario: 파일 없으면 안전한 4xx
- **WHEN** `<project>/docs/planning/prd.md`가 없거나 존재하지 않는 project로 호출한다
- **THEN** 500이 아니라 404로 안전하게 응답한다

#### Scenario: 경로 조작 차단
- **WHEN** project 파라미터에 `..` 등 경로 조작 문자가 포함된다
- **THEN** 기존 `resolveDocsDir` 경로안전 검증으로 차단하고 디렉토리 밖 파일을 읽지 않는다

### Requirement: 렌더된 PRD는 docs/planning/prd.md 원본을 비춘다
flowforge 웹은 위 API로 받은 PRD를 기존 `PrdPanel`로 SHALL 렌더한다. 렌더 결과는 change의 `proposal.md`를 변환한 것이 아니라 `docs/planning/prd.md` 원본의 내용이어야 한다(그림자가 아닌 실체).

#### Scenario: PrdPanel에 5섹션 렌더
- **WHEN** 웹이 planning PRD를 받아 화면에 표시한다
- **THEN** 기존 PrdPanel 컴포넌트로 5섹션이 화면에 렌더된다(새 컴포넌트 없이 재사용)

#### Scenario: 원본 내용 일치
- **WHEN** `docs/planning/prd.md`에만 있는 고유 문구를 렌더 화면에서 확인한다
- **THEN** 그 문구가 화면에 나타난다(= proposal.md 변환이 아니라 planning/prd.md 원본을 읽음)
