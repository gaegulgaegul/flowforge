## ADDED Requirements

### Requirement: 기능명세서 3단 트리 파생
시스템은 change의 capability·Requirement·Scenario를 `요구사항(capability) → 기능(Requirement) → 상세기능(Scenario)` 3단 트리로 파생해 SHALL 반환한다. 상세기능 노드는 Scenario title과 WHEN/THEN 요약을 담는다. 파생은 spec.md를 단방향으로 읽으며, 트리를 편집·저장하는 기능은 제공하지 않는다.

#### Scenario: capability·Requirement·Scenario가 있는 change의 3단 트리 파생
- **WHEN** 클라이언트가 `GET /api/changes/:id/spec-tree`를 호출하고 해당 change의 `specs/` 하위에 capability 디렉토리와 각 `spec.md`의 Requirement·Scenario가 존재한다
- **THEN** 서버는 루트(change) 아래 1단 노드(요구사항=capability), 그 아래 2단 노드(기능=Requirement), 그 아래 3단 노드(상세기능=Scenario)를 가진 트리를 반환하고, 각 3단 노드는 Scenario title과 WHEN/THEN 요약 텍스트를 포함한다

#### Scenario: Scenario를 count가 아니라 노드로 펼침
- **WHEN** 어떤 Requirement에 Scenario가 N개 있다
- **THEN** spec-tree는 그 Requirement 아래에 N개의 상세기능 노드를 펼쳐 보여준다(기존 IA 트리처럼 N이라는 숫자 하나로 접지 않는다)

#### Scenario: Scenario가 없는 Requirement
- **WHEN** 어떤 Requirement에 Scenario가 하나도 없다
- **THEN** 해당 기능 노드는 상세기능 자식 없이 단독 노드로 반환되고 트리 생성은 실패하지 않는다

#### Scenario: 존재하지 않는 change id
- **WHEN** 클라이언트가 존재하지 않거나 경로 조작(`..`)이 포함된 change id로 spec-tree를 요청한다
- **THEN** 서버는 안전 오류(4xx)를 반환하고 change 디렉토리 밖의 파일을 읽지 않는다

### Requirement: 기능명세서 트리 표시
웹 클라이언트는 기능명세서 탭에서 3단 트리를 읽기전용으로 SHALL 렌더한다. 사용자는 노드를 편집하거나 중요도·상태 같은 속성을 변경할 수 없다.

#### Scenario: 기능명세서 탭 선택 시 3단 트리 렌더
- **WHEN** 사용자가 change를 선택하고 기능명세서 탭을 누른다
- **THEN** 화면에 요구사항→기능→상세기능 3단 위계가 트리로 표시되고, 단별로 시각적으로 구분된다

#### Scenario: 상세기능 노드의 WHEN/THEN 노출
- **WHEN** 사용자가 상세기능(Scenario) 노드를 본다
- **THEN** 노드는 Scenario title과 함께 WHEN/THEN 요약을 표시한다

## TDD Plan

- **Red**: `specTreeBuilder.buildSpecTree(changeDir)`가 capability/Requirement/Scenario를 3단 트리로 변환하고 Scenario를 노드로 펼치는지 검증(Scenario 0개·다수 케이스, WHEN/THEN 요약 포함 여부).
- **Green**: 기존 `specParser.parseSpecText`로 Requirement/Scenario를 얻고, `iaBuilder`의 capability 수집 패턴을 재사용하되 Scenario를 leaf 노드로 변환. 새 타입 `SpecTreeNode`(kind: requirement|feature|detail).
- **Refactor**: iaBuilder와 capability 수집 로직이 중복되면 공통 헬퍼로 추출(동치 골든 테스트 깨지지 않게 iaBuilder 출력은 불변 유지).
- **Mock 대상**: 없음(픽스처 디렉토리로 파일시스템 실제 읽기).
