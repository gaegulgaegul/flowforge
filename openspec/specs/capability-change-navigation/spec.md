# capability-change-navigation Specification

## Purpose

charter capability와 change를 `specs/<capability>/` 디렉토리명과 `## capability:` 키의 글자단위 정확 비교로 연결하고, 카드 그리드 → 뼈대 그래프 → change 목록 → 기존 5종 뷰로 이어지는 계층 네비게이션을 제공하는 capability. 유사도 자동추측을 금지하고 미연결 항목을 명시 표시하며, 각 단계에 브레드크럼과 뒤로가기를 둔다.

## Requirements

### Requirement: capability와 change를 specs 디렉토리명 불변ID로 연결한다

시스템은 change의 `specs/<capability>/` 디렉토리명과 charter `docs/spec.md`의 `## capability: <키>`를 **글자단위 정확 비교(set 멤버십)**로 연결해야 한다(SHALL). 새 연결 태그를 만들거나 이름 유사도로 자동추측해서는 안 된다(SHALL NOT).

#### Scenario: 디렉토리명이 capability 키와 일치하면 연결

- **WHEN** 어떤 change의 `specs/<X>/` 디렉토리명이 docs/spec.md의 `## capability: <X>` 키와 글자단위로 일치한다
- **THEN** 시스템은 그 change를 capability `<X>`에 속한 것으로 연결한다

#### Scenario: 유사하지만 다른 이름은 연결하지 않는다

- **WHEN** change의 디렉토리명이 capability 키와 유사하나 글자단위로 다르다
- **THEN** 시스템은 둘을 연결하지 않는다(거짓연결 0 — 유사도 매칭 금지)

#### Scenario: 미연결 항목을 명시 표시한다

- **WHEN** 어떤 change 디렉토리명이 어떤 capability 키와도 일치하지 않는다
- **THEN** 시스템은 그 change를 "미연결" 상태로 명시 표시하고 조용히 누락시키지 않는다

### Requirement: capability 노드 클릭 시 속한 change 목록을 표시한다

charter 뼈대 그래프에서 capability 노드를 클릭하면 시스템은 그 capability에 연결된 change 목록 화면으로 이동해야 한다(SHALL).

#### Scenario: capability 클릭하면 change 목록으로 이동

- **WHEN** 사용자가 뼈대 그래프에서 capability 노드를 클릭한다
- **THEN** 시스템은 그 capability에 연결된 change 목록 화면으로 이동해 change들을 표시한다

#### Scenario: change 없는 capability는 빈 상태를 표시

- **WHEN** 사용자가 연결된 change가 0개인 capability 노드를 클릭한다
- **THEN** 시스템은 "이 capability에 연결된 change 없음" 빈 상태를 표시한다(에러 아님)

### Requirement: change 클릭 시 기존 5종 뷰로 진입한다

capability별 change 목록에서 change를 클릭하면 시스템은 flowforge 기존 5종 뷰(유저플로우·IA·와이어프레임·PRD·기능명세)로 이동해야 한다(SHALL). 신규 뷰를 만들지 않고 기존 `/api/changes/:id/*` 경로를 재사용한다.

#### Scenario: change 클릭하면 5종 뷰 탭으로 이동

- **WHEN** 사용자가 capability별 change 목록에서 change를 클릭한다
- **THEN** 시스템은 그 change의 기존 5종 뷰(`prd|spec|flow|ia|wire` 탭) 화면으로 이동한다

#### Scenario: 5종 뷰는 기존 change 라우트를 재사용

- **WHEN** change 5종 뷰가 렌더된다
- **THEN** 시스템은 기존 `/api/changes/:id/{graph,ia,wireframe,prd,spec-tree}` 응답을 사용하며 신규 빌더를 호출하지 않는다

### Requirement: 계층 네비게이션에 브레드크럼과 뒤로가기를 제공한다

시스템은 카드 그리드 → 뼈대 그래프 → change 목록 → 5종 뷰 각 단계에서 현재 위치를 보여주는 브레드크럼과 상위로 돌아가는 수단을 제공해야 한다(SHALL).

#### Scenario: 깊은 단계에서 브레드크럼으로 상위 이동

- **WHEN** 사용자가 5종 뷰 화면에서 브레드크럼의 상위 항목(프로젝트 또는 capability)을 클릭한다
- **THEN** 시스템은 해당 상위 단계 화면으로 이동한다

#### Scenario: 뒤로가기로 직전 단계 복귀

- **WHEN** 사용자가 뒤로가기를 누른다
- **THEN** 시스템은 네비게이션 히스토리상 직전 단계 화면으로 복귀한다
