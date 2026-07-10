## ADDED Requirements

### Requirement: 외부 스킬이 와이어 레이아웃 제안을 생성한다

외부 openspec-plan 계열 스킬은 기능명세(`docs/planning/features.md`)에 기능이 1개 이상 있고 유저플로우가 존재하는 상태에서, 기능명세·유저플로우·화면목록을 입력 맥락으로 삼아 `WireScreen2[]` 와이어 레이아웃 제안을 생성 SHALL 한다. 생성 주체는 flowforge 밖(스킬)이며, flowforge 서버는 LLM을 호출하지 않는다. 생성 결과는 flowforge가 소비할 제안 큐(`planning-wireframe-approval-queue`)로 전달된다. 화면목록 없이, 또는 기능명세 없이 와이어를 단독 생성하지 않는다(manyfast 순차 게이트).

#### Scenario: 원천 3종에서 레이아웃 생성

- **WHEN** 기능명세·유저플로우·화면목록이 존재하는 프로젝트에서 스킬이 와이어 생성을 수행한다
- **THEN** 각 화면에 대해 device·regions(topbar/sidebar/bottombar/body)·body layout·요소(kind/label/goto)를 채운 `WireScreen2` 제안이 만들어진다

#### Scenario: 화면 id는 화면목록과 정합한다

- **WHEN** 생성된 `WireScreen2.id`를 검사한다
- **THEN** 화면목록 `<!-- screen: id -->`의 화면 id와 공유되어 유저플로우·IA와 정합하며, 요소의 goto는 유효한 화면 id를 가리킨다

#### Scenario: 순차 게이트 — 선행 문서 없으면 생성 안 함

- **WHEN** 기능명세 또는 화면목록이 비어 있는 상태에서 생성이 시도된다
- **THEN** 와이어를 단독 생성하지 않는다(선행 문서 게이트)

#### Scenario: 생성 주체는 flowforge 밖

- **WHEN** flowforge 서버 코드를 검사한다
- **THEN** 서버에 LLM/생성 호출이 없고, 와이어 원천은 스킬이 큐로 전달한 제안이다(flowforge는 읽기 거울)

## TDD Plan

이 capability는 flowforge 밖 스킬의 생성 계약을 정의한다(생성 로직 자체는 이 change 범위 밖). flowforge 측에서 검증 가능한 것:
- **Red**: 생성 제안이 `WireScreen2` 스키마(device·regions·body layout·요소 kind 8종)를 만족하는지 검증하는 스키마 가드 테스트. goto가 존재하는 화면 id를 가리키는지 정합 테스트.
- **Green**: 큐 read 시 스키마 위반 제안을 안전 폴백(필터)하는 최소 가드.
- **Refactor**: 스키마 가드를 approval-queue의 read 검증과 공유.
- Mock 대상: 없음(생성은 외부 스킬, flowforge는 산출 JSON만 소비). 스킬 호출을 flowforge가 하지 않으므로 `*Client` Mock도 없음.
