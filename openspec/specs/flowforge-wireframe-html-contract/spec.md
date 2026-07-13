# flowforge-wireframe-html-contract

## Purpose

harness(openspec-plan 계열 스킬)가 생성해 flowforge에 전달할 화면별 HTML 산출물의 계약을 정의한다. 화면 id(유저플로우/IA 정합)·디바이스·문서 구조·인라인 자산·허용/금지 요소를 규정하며, 생성 주체는 flowforge 밖(스킬)이고 flowforge는 이 계약을 만족하는 HTML 문서를 소비·렌더만 한다(읽기 거울 원칙 유지). 전달 문서는 sandbox·CSP 제약 아래 렌더 가능하도록 자족적이어야 한다.

## Requirements

### Requirement: harness가 화면별 HTML 문서를 생성해 flowforge에 전달한다

외부 openspec-plan 계열 스킬 SHALL, 기능명세·유저플로우·화면목록을 입력 맥락으로 삼아 **화면별 HTML/JS 문서**를 생성하고, 이를 flowforge가 소비할 원천으로 전달한다. 생성 주체는 flowforge 밖(스킬)이며 flowforge 서버는 LLM을 호출하지 않는다(읽기 거울 원칙 유지). 각 문서는 화면 하나의 실제 마크업이며, 좌표 없는 요소 박스(폐기된 `WireScreen2` elements)가 아니다. openspec-plan의 현재 와이어 단계는 "로우피델리티 박스 5종 HTML"을 명시(SKILL.md:276)하므로, 이 계약에 맞춰 **화면별 실 HTML/JS 문서 생성**으로 확장되어야 한다(harness 짝작업, 생성 로직 자체는 이 change 밖).

#### Scenario: 원천 3종에서 화면별 HTML 생성

- **WHEN** 기능명세·유저플로우·화면목록이 존재하는 프로젝트에서 스킬이 와이어 생성을 수행한다
- **THEN** 각 화면에 대해 id·title·device·html(문서 문자열)을 담은 화면 항목이 만들어진다

#### Scenario: 화면 id는 화면목록과 정합한다

- **WHEN** 생성된 화면 id를 검사한다
- **THEN** 화면목록 `<!-- screen: id -->`·유저플로우·IA의 화면 id와 공유되어 정합하며, 문서 내 화면 전환 링크는 유효한 화면 id를 가리킨다

#### Scenario: 생성 주체는 flowforge 밖

- **WHEN** flowforge 서버 코드를 검사한다
- **THEN** 서버에 LLM/생성 호출이 없고, 와이어 원천은 스킬이 전달한 HTML 문서다

### Requirement: 전달되는 HTML 문서는 자족적이고 sandbox 제약을 만족한다

harness가 전달하는 화면 HTML 문서 SHALL, sandbox·CSP 제약 아래에서 렌더 가능하도록 자족적이어야 한다 — 자산(CSS/JS/이미지)은 인라인/data URI로 임베드하고 외부 호스트 참조에 의존하지 않는다(CSP가 외부 로드를 차단하므로 외부 참조는 렌더되지 않는다). 문서는 상위 프레임 접근·top-level navigation·부모 오리진 통신을 전제하지 않는다(sandbox에서 거부됨). flowforge는 받은 문서가 이 제약을 만족하지 않아도 격리는 유지하되(보안 우선), 검증 실패 문서는 안전 폴백/거부로 처리한다.

#### Scenario: 자산은 인라인 임베드

- **WHEN** 전달된 HTML 문서의 자산 참조를 검사한다
- **THEN** CSS/JS/이미지가 인라인 또는 data URI로 임베드되어 있고 외부 CDN/호스트 의존이 없다(외부 참조는 CSP로 차단되어 렌더 안 됨)

#### Scenario: 문서는 부모 접근을 전제하지 않는다

- **WHEN** 전달된 HTML 문서의 스크립트를 검사한다
- **THEN** `window.parent`·top-level navigation·부모 오리진 통신에 의존하지 않고 iframe 안에서 자족적으로 동작한다

#### Scenario: 제약 위반 문서 안전 처리

- **WHEN** 전달된 문서가 계약(자족성·화면 id 정합)을 위반하거나 손상되었다
- **THEN** flowforge는 격리(sandbox)를 유지한 채 그 문서를 안전 폴백/거부로 처리하고 렌더가 죽지 않는다

## TDD Plan

이 capability는 flowforge 밖 스킬의 생성 계약을 정의한다(생성 로직 자체는 이 change 범위 밖). flowforge 측에서 검증 가능한 것:

- **Red**: 전달된 화면 항목이 계약 스키마(id·title·device·html string)를 만족하는지 검증하는 스키마 가드 테스트. 화면 id가 화면목록과 정합하는지 확인. 외부 호스트 참조를 담은 문서가 렌더 시 CSP로 차단됨을 실측(외부 로드 0).
- **Green**: 큐/원천 read 시 계약 위반 문서를 안전 폴백(필터/거부)하는 최소 가드. 격리는 항상 유지.
- **Refactor**: 스키마 가드를 렌더 원천 read 검증과 공유.
- **Mock 대상**: 없음(생성은 외부 스킬, flowforge는 산출 HTML만 소비). 스킬 호출을 flowforge가 하지 않으므로 `*Client` Mock도 없다. 문서는 테스트 픽스처로 직접 주입한다.
