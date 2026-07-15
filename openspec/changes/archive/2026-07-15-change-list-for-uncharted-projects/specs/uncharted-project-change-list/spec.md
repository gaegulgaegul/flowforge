# uncharted-project-change-list

기획 문서(`docs/planning/*`)가 없는 프로젝트의 skeleton 단계에서 그 프로젝트의 활성 change 목록을 노출하고, change 클릭 시 5종 문서 뷰(views)로 진입시키는 능력. 기획 있는 프로젝트의 기존 노드-경유 진입은 불변으로 유지한다.

## ADDED Requirements

### Requirement: 기획 없는 프로젝트의 change 목록 노출

기획 문서가 없는 프로젝트(`hasCharter=false`)의 skeleton 단계에서, 시스템은 그 프로젝트의 **활성 change 목록**을 클릭 가능한 항목으로 SHALL 노출한다. 목록 데이터는 프로젝트 카드가 이미 보유한 `activeChangeNames`를 재사용하며, 추가 서버 조회를 요구하지 않는다.

#### Scenario: 활성 change가 있는 기획-없는 프로젝트

- **WHEN** `hasCharter=false`이고 `activeChangeNames`가 1개 이상인 프로젝트 카드를 열어 skeleton 단계로 진입한다
- **THEN** 그 프로젝트의 활성 change 각각이 클릭 가능한 목록 항목으로 렌더된다
- **AND** 빈 화면이 아니라 change 목록으로 change 문서에 도달할 경로가 화면에 존재한다

#### Scenario: 활성 change가 없는 기획-없는 프로젝트

- **WHEN** `hasCharter=false`이고 `activeChangeNames`가 비어 있는 프로젝트를 연다
- **THEN** change 목록을 억지로 만들지 않고, 활성 change가 없음을 정직하게 표기한다(존재하지 않는 링크를 지어내지 않는다)

### Requirement: change 클릭 시 5종 문서 뷰 진입

change 목록의 항목을 클릭하면, 시스템은 그 change의 5종 문서 뷰(views 단계: PRD·spec-tree·유저플로우·와이어·그래프)로 SHALL 진입시킨다. 진입은 기존 `openChangeViews` 경로를 재사용하며, 프로젝트 키를 실어 딥링크 URL이 복원 가능해야 한다.

#### Scenario: change 항목 클릭 → views 진입

- **WHEN** 기획 없는 프로젝트의 change 목록에서 한 change 항목을 클릭한다
- **THEN** 대시보드가 views 단계로 전환되고 그 change의 문서 뷰(기본 PRD 탭)가 열린다
- **AND** URL에 `?project=<프로젝트키>&change=<change키>&tab=prd` 딥링크가 기록되어 새로고침·뒤로가기로 복원된다

#### Scenario: 딥링크 project는 영문 키로 실린다

- **WHEN** change 항목 클릭으로 views에 진입한다
- **THEN** 딥링크의 `project` 파라미터는 프로젝트의 영문 식별자(`name`)이며 한글 표시명(`displayName`)이 아니다
- **AND** 빈 `project=` 값이나 리터럴 플레이스홀더를 URL에 남기지 않는다

### Requirement: 기획 있는 프로젝트 회귀 없음

이 진입로는 `hasCharter=false` 분기에서만 렌더된다. 기획 문서가 있는 프로젝트의 기존 skeleton 동작(PRD/기능명세/와이어/유저플로우 탭)과 기능명세 노드 경유 change 진입은 시스템이 변경하지 SHALL NOT 한다.

#### Scenario: 기획 있는 프로젝트는 기존대로

- **WHEN** `hasCharter=true`인 프로젝트(예: flowforge)를 열어 skeleton 단계로 진입한다
- **THEN** 기존 planning 탭(PRD·기능명세·와이어·유저플로우)이 그대로 렌더되고, 새 change 목록 섹션은 나타나지 않는다
- **AND** 기능명세 노드 → 상세 패널 → 연관 change 버튼을 통한 기존 change 진입이 정상 동작한다

## TDD Plan

이 change는 flowforge 프론트(`web/src/App.tsx`) 수정이며 web 워크스페이스의 vitest로 검증한다.

- **Red**: 기획 없는 프로젝트(`hasCharter=false`, `activeChangeNames=["a","b"]`) 렌더 시 change 목록 항목이 나타나는지 실패 테스트 작성. change 항목 클릭 시 `openChangeViews`가 `{key, displayName, project}`로 호출되는지(또는 dashStage가 views로 전환되는지) 검증하는 실패 테스트.
- **Green**: skeleton 렌더 블록의 `!hasCharter && activeChangeNames.length > 0` 분기에 change 목록 섹션 추가. 각 항목 onClick = `openChangeViews({ key: name, displayName: name, project: dashProject.name })`.
- **Refactor**: change 목록을 경량 컴포넌트로 분리(선택). 구조 변경과 동작 추가는 분리 커밋.
- **Mock**: 없음(순수 프론트 상호작용). 필요 시 `openChangeViews` 스파이.
- **회귀 가드**: `hasCharter=true` 프로젝트에서 새 목록이 렌더되지 **않음**을 검증하는 테스트(무력화 프로브: 가드를 지우면 red).
