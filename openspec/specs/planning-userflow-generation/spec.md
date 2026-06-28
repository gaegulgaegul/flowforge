# planning-userflow-generation

openspec-plan 스킬이 기능명세 다음 단계에서 `docs/planning/user-flow/<group>-vN.md`를 Mermaid flowchart 명세로 생성하는 능력. 화면 흐름을 그래프로 표현하며, 기능명세에 기능이 ≥1 있어야 진행하는 manyfast 순차 게이트의 다음 단계다.

## Requirements

### Requirement: openspec-plan이 유저플로우를 의존성 순서로 생성한다
openspec-plan 스킬은 기능명세서(`docs/planning/features.md`)에 기능이 1개 이상 있는 상태에서 `docs/planning/user-flow/<group>-vN.md`를 생성 SHALL 한다. 기능명세 없이 유저플로우를 단독 생성하지 않는다(manyfast 순차 게이트). 새 목적(흐름)은 새 group, 수정은 같은 group의 새 버전(`-vN`)으로 폴더 누적한다.

#### Scenario: 기능명세 다음 단계로 유저플로우 생성
- **WHEN** `docs/planning/features.md`에 기능이 있는 프로젝트에서 openspec-plan의 유저플로우 단계를 실행한다
- **THEN** `docs/planning/user-flow/<group>-v1.md`가 Mermaid flowchart 코드블록으로 생성된다

### Requirement: 유저플로우는 Mermaid flowchart 문법을 따른다
생성되는 `<group>-vN.md`는 ```mermaid 코드블록 안에 `flowchart` 방향 선언과 노드·엣지를 SHALL 포함한다. 노드는 화면 흐름의 4타입(시작/섹션/페이지/행동)을 Mermaid 노드 모양으로 구분한다(예: 시작=`([텍스트])` stadium, 페이지=`["텍스트"]` 박스, 행동=`{"텍스트"}` 마름모). 엣지는 `A --> B`(이동) 또는 `A -->|라벨| B`(라벨 이동)로 흐름을 표현한다.

#### Scenario: Mermaid flowchart 코드블록 포함
- **WHEN** 생성된 user-flow .md를 본다
- **THEN** ```mermaid 코드블록 안에 `flowchart TD`(또는 LR) 선언과 노드 정의·엣지(`-->`)가 있다

#### Scenario: 노드 타입이 모양으로 구분된다
- **WHEN** 유저플로우의 노드들을 본다
- **THEN** 시작/페이지/행동 등 흐름 타입이 Mermaid 노드 모양(stadium/box/diamond 등)으로 구분돼 있다
