# planning-panel-screen-links

## Purpose

기능명세 상세 패널에서 상세기능이 연결된 화면(N:M)을 표시하는 능력. 원천은 screenRegistry(features.md `<!-- screens: -->` 링크) 읽기전용 소비, 매칭은 상세기능 라벨 문자열 동치만.

## Requirements

### Requirement: screen registry를 API로 노출한다

The system SHALL serve the parsed screen registry via `GET /api/docs/:project/planning-screens`, returning `{ screens, links }` as produced by the existing parser. When the project has no `## 화면목록` section, the response SHALL be an empty registry with HTTP 200.

#### Scenario: 화면목록·링크가 있는 프로젝트는 registry를 반환한다

- **WHEN** features.md에 `## 화면목록`(화면 2개)과 `<!-- screens: -->` 링크가 있는 프로젝트로 `GET /api/docs/:project/planning-screens`를 호출한다
- **THEN** 응답은 화면 2개와 링크(detailLabel·screenIds)를 담은 `{ screens, links }`다

#### Scenario: 화면목록 없는 프로젝트는 빈 registry 200이다

- **WHEN** features.md에 `## 화면목록` 섹션이 없는 프로젝트로 호출한다
- **THEN** 응답은 HTTP 200에 빈 `screens`·`links`이며 에러를 던지지 않는다

#### Scenario: 존재하지 않는 프로젝트·경로조작은 404다

- **WHEN** 존재하지 않는 프로젝트명 또는 `..`이 포함된 프로젝트명으로 호출한다
- **THEN** 응답은 404다

### Requirement: 상세 패널에 연결화면(N:M)을 표시한다

WHEN a detail-feature node is selected, the panel SHALL show the screens linked to that node by matching the node label to `links[].detailLabel` by **string equality only**, resolving screen labels from `registry.screens`. Nodes with no link SHALL omit the section (기존 "있을 때만 렌더" 유지); registry fetch failure SHALL degrade to no screens field without breaking the graph or panel.

#### Scenario: 링크 있는 상세기능 클릭 시 연결화면이 나열된다

- **WHEN** `<!-- screens: a,b -->` 링크가 있는 상세기능 노드를 클릭한다
- **THEN** 상세 패널 "연결된 화면 (N:M)" 섹션에 화면 a·b의 표시 이름(label)이 나열된다

#### Scenario: 링크 없는 상세기능은 섹션이 생략된다

- **WHEN** `<!-- screens: -->` 링크가 없는 상세기능 노드를 클릭한다
- **THEN** 연결화면 섹션은 렌더되지 않는다(빈 섹션·placeholder 없음)

#### Scenario: dangling 화면 id는 id 그대로 강등 표시된다

- **WHEN** 링크의 screenId가 `## 화면목록`에 정의되지 않은 id를 가리킨다
- **THEN** 그 항목은 label 대신 id 문자열로 표시된다(숨기지 않는다)

#### Scenario: registry fetch 실패에도 그래프·패널은 정상 동작한다

- **WHEN** `planning-screens` fetch가 실패한다
- **THEN** 기능명세 그래프와 상세 패널(다른 필드)은 정상 렌더되고, 연결화면 섹션만 생략된다

### Requirement: 화면 칩 클릭은 IA 뷰의 해당 화면으로 딥링크한다

WHEN a screen chip in the feature detail panel is clicked, the UI SHALL switch to the planning IA tab and select the IA screen node whose server-provided raw `screenId` string-equals the chip's screen id (no slug replication, no fuzzy matching), opening the IA detail panel for that node. WHEN no IA node matches, the UI SHALL NOT navigate and SHALL surface a status notice instead.

#### Scenario: 칩 클릭 → IA 탭 + 해당 노드 선택

- **WHEN** 상세기능의 연결화면 칩(화면 A)을 클릭한다
- **THEN** 기획 IA 탭으로 전환되고 화면 A 노드의 IA 상세 패널이 열린다 (기능명세 상세 패널은 닫힘)

#### Scenario: 매칭 실패는 무해

- **WHEN** IA 트리에 없는 화면 id의 칩을 클릭한다
- **THEN** 탭 전환 없이 상태바 안내만 표시되고 화면은 깨지지 않는다

#### Scenario: 링크 없는 상세기능은 기존대로

- **WHEN** 연결화면이 없는 상세기능의 패널을 연다
- **THEN** 화면 섹션은 기존대로 생략된다(딥링크 추가로 인한 회귀 없음)
