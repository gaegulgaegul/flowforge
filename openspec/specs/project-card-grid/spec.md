# project-card-grid Specification

## Purpose

flowforge 홈 랜딩을 단일 change 진입이 아니라 홈서버에서 스캔한 프로젝트 카드 그리드로 표시하는 capability. change가 있는 모든 프로젝트를 charter `docs/` 유무와 무관하게 노출하고, 각 카드에 charter 유무·change 개수·audit 상태 배지와 한글 표시명을 보여주며 라우팅 키는 영문 슬러그를 유지한다.

## Requirements

### Requirement: 홈 랜딩은 프로젝트 카드 그리드를 표시한다

flowforge의 최상위 랜딩 화면은 홈서버에서 스캔한 프로젝트를 카드 그리드로 표시해야 한다(SHALL). 진입 즉시 단일 change 안으로 들어가지 않는다.

#### Scenario: 홈 진입 시 카드 그리드 렌더

- **WHEN** 사용자가 flowforge 루트(`/`)에 진입한다
- **THEN** 시스템은 `/api/projects`를 호출해 프로젝트 카드 그리드를 렌더하고, 단일 change 뷰로 곧장 진입하지 않는다

#### Scenario: 각 카드가 프로젝트 상태 배지를 표시

- **WHEN** 카드 그리드가 렌더된다
- **THEN** 각 카드는 [charter 유무 · change 개수 · audit 상태] 를 표시한다

### Requirement: change 있는 모든 프로젝트를 노출한다

시스템은 change가 존재하는 모든 홈서버 프로젝트를 카드로 노출해야 한다(SHALL). charter 상주 `docs/` 유무로 프로젝트를 필터링하지 않는다.

#### Scenario: charter 없는 프로젝트도 카드로 노출

- **WHEN** 어떤 프로젝트가 change는 있으나 charter `docs/`가 없다
- **THEN** 시스템은 그 프로젝트를 "뼈대 없음 · change N개" 표시로 카드 그리드에 포함한다(누락하지 않는다)

#### Scenario: charter 없는 프로젝트 카드 클릭은 change 목록으로 이동

- **WHEN** 사용자가 charter 없는 프로젝트 카드를 클릭한다
- **THEN** 시스템은 뼈대 그래프 단계를 건너뛰고 그 프로젝트의 change 목록 화면으로 이동한다

#### Scenario: charter 있는 프로젝트 카드 클릭은 뼈대 그래프로 이동

- **WHEN** 사용자가 charter 있는 프로젝트(🦴) 카드를 클릭한다
- **THEN** 시스템은 그 프로젝트의 charter 뼈대(capability) 그래프 화면으로 이동한다

### Requirement: 프로젝트 표시명은 한글로 보여준다

카드의 프로젝트/기능 표시명은 한글로 표시해야 하며(SHALL), 연결·라우팅에 쓰이는 키는 영문 슬러그를 유지한다.

#### Scenario: 영문 키 프로젝트의 한글 표시명 렌더

- **WHEN** 프로젝트 카드가 렌더된다
- **THEN** 카드 표면 텍스트는 한글 표시명을 사용하되, 클릭 시 라우팅에는 영문 키를 사용한다
