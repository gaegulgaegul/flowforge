# planning-features-view

## Purpose

flowforge가 `docs/planning/features.md`(기획 단계 산출물)를 읽어 전용 `FeatureTree`로 파싱하고 ReactFlow 트리로 렌더하는 능력. 타입 전략 B(분리) — 기존 change spec-tree(`SpecTree`) 타입·렌더와 독립이다.

## Requirements

### Requirement: flowforge가 features.md를 FeatureTree로 파싱해 제공한다
flowforge 서버는 `docs/planning/features.md`를 읽어 3단 트리 `FeatureTree`(요구사항→기능→상세기능)로 파싱해 API로 SHALL 제공한다. 각 노드는 kind(requirement/feature/detail)·label·priority·status를 가지며, 요구사항 노드는 capability 키를 추가로 가진다. 라우트는 `GET /api/docs/:project/planning-features`이며 `{ project, tree }` 형태를 반환한다. 기존 change spec-tree(`SpecTree`) 타입·빌더·렌더는 수정하지 않는다(분리).

#### Scenario: planning features 조회 성공
- **WHEN** `DOCS_ROOT` 아래 `<project>/docs/planning/features.md`가 존재하고 `GET /api/docs/<project>/planning-features`를 호출한다
- **THEN** HTTP 200과 함께 3단 위계(requirement→feature→detail)를 담은 `tree`(FeatureTree)를 반환한다

#### Scenario: 요구사항 노드에 capability 키가 보존된다
- **WHEN** features.md 요구사항에 `<!-- capability: payment -->` 주석이 있는 상태로 조회한다
- **THEN** 해당 requirement 노드의 capability 필드가 `payment`로 채워져 반환된다(매핑 출발점)

#### Scenario: 노드 속성(중요도·상태)이 파싱된다
- **WHEN** features.md 노드에 `(중요도: 높음, 상태: 진행중)`이 표기된 상태로 조회한다
- **THEN** 해당 노드의 priority가 `높음`, status가 `진행중`으로 파싱돼 반환된다

#### Scenario: 파일 없으면 안전한 4xx
- **WHEN** `<project>/docs/planning/features.md`가 없거나 존재하지 않는 project로 호출한다
- **THEN** 500이 아니라 404로 안전하게 응답한다

#### Scenario: 경로 조작 차단
- **WHEN** project 파라미터에 `..` 등 경로 조작 문자가 포함된다
- **THEN** 기존 `resolveDocsDir` 경로안전 검증으로 차단하고 디렉토리 밖 파일을 읽지 않는다

### Requirement: 전용 렌더로 features 트리를 시각화한다
web은 `FeatureTree`를 전용 컴포넌트(`FeatureNode`)와 어댑터(`featureTreeAdapter`)로 ReactFlow 트리로 SHALL 렌더한다. change spec-tree 렌더(`SpecTreeNode`/`specTreeAdapter`)를 재사용·수정하지 않는다(분리). 노드는 kind별로 구분되고 priority/status/capability가 시각적으로 드러난다.

#### Scenario: 기능명세 트리가 화면에 렌더된다
- **WHEN** features.md가 있는 프로젝트를 열고 기능명세 뷰로 전환한다
- **THEN** 요구사항→기능→상세기능 3단 트리가 ReactFlow로 그려지고 각 노드에 priority/status가, 요구사항에 capability 키가 보인다

#### Scenario: change spec-tree 렌더에 영향 없음
- **WHEN** planning-features-view를 추가한 뒤 기존 change spec-tree 뷰를 연다
- **THEN** SpecTree 타입·specTreeBuilder·SpecTreeNode 렌더가 변경 전과 동일하게 동작한다(회귀 없음)

### Requirement: 읽기전용·경로안전 불변
features 조회는 파일 읽기만 하며 어떤 파일도 쓰거나 수정하지 않는다. 경로 조작 방지(`..` 금지 + 화이트리스트)는 기존 `resolveDocsDir`를 그대로 거쳐 SHALL 유지된다.

#### Scenario: planning-features 조회는 읽기 전용이다
- **WHEN** `buildDocsPlanningFeatures`가 features.md를 읽는다
- **THEN** `readFileSync`로 읽기만 할 뿐 파일을 생성·수정·삭제하지 않고, planning features를 쓰는 라우트도 없다

### Requirement: features 노드는 WHEN/THEN 시나리오를 저작·표시한다

WHEN a features.md node carries `<!-- when: … -->` and/or `<!-- then: … -->` inline comments below its header, the parser SHALL read them into `FeatureNode.when?`/`then?` (additive optional — absent when the comment is absent, same as memo), and the feature detail panel SHALL render the WHEN/THEN section only when at least one is present (fabricating nothing). WHEN neither comment exists, node data and the panel SHALL be unchanged (backward compatible).

#### Scenario: when/then 저작 → 상세 패널 표시

- **WHEN** 상세기능 헤더 아래에 `<!-- when: 저장 클릭 -->` `<!-- then: 목록으로 이동 -->`을 저작한 노드를 상세 패널에서 연다
- **THEN** 패널의 ⚡ 시나리오(WHEN/THEN) 섹션에 그 문구가 표시된다

#### Scenario: 한쪽만 있어도 렌더

- **WHEN** when만 있고 then이 없는(또는 반대) 노드를 연다
- **THEN** 있는 쪽만 표시되고 없는 쪽은 생략된다(빈 태그 없음)

#### Scenario: 주석 부재 = 현행 동작

- **WHEN** when/then 주석이 없는 기존 노드를 파싱·렌더한다
- **THEN** FeatureNode에 when/then 필드가 없고 상세 패널에 WHEN/THEN 섹션이 뜨지 않는다(회귀 0)
