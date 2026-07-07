# planning-panel-screen-links (delta)

## ADDED Requirements

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

## TDD Plan

- **Red**: planningIaBuilder 단위 테스트 — 화면 노드에 `screenId`(원본) 세팅, 상세기능 노드엔 없음.
- **Green**: shared 옵션 필드 + 빌더 1줄 + iaAdapter 전달 + 칩 버튼화 + App 핸들러.
- **Refactor**: 없음.
- Mock 대상: 없음.
