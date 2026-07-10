## ADDED Requirements

### Requirement: 와이어 레이아웃 제안 큐를 읽는다

flowforge는 `GET /api/docs/:project/planning-wireframe-suggestions`로 와이어 레이아웃 제안 큐(`WireScreen2` 제안 사이드카 `*.suggestions.json`)를 반환 SHALL 한다. 큐 파일이 없으면 빈 큐로 200을 반환하고, 깨진 JSON이거나 스키마 위반 항목은 유효한 항목만 필터해 반환한다(절대 throw 하지 않음). 제안 아이템 id가 중복이면 first-occurrence-wins로 dedup 한다. 큐 최상위 구조는 `{ version: 1, suggestions: [...] }`로, 기존 features/userflow/prd 큐와 동형이다.

#### Scenario: 큐 파일 부재 → 빈 큐 200

- **WHEN** 제안 큐 파일이 없는 프로젝트에서 큐를 조회한다
- **THEN** `{ version: 1, suggestions: [] }`로 200을 반환한다(에러 아님)

#### Scenario: 깨진 JSON·스키마 위반 → 유효분만 필터

- **WHEN** 큐 파일이 깨졌거나 일부 항목이 `WireScreen2` 스키마를 위반한다
- **THEN** 유효한 제안만 반환하고 throw 하지 않는다(안전 폴백)

#### Scenario: id 중복 dedup

- **WHEN** 큐에 같은 id 제안이 둘 이상 있다
- **THEN** 먼저 나온 항목만 남기고 dedup 한다

#### Scenario: 제안 아이템은 WireScreen2 레이아웃을 담는다

- **WHEN** 유효한 제안 아이템을 검사한다
- **THEN** id + 대상 화면 id + `WireScreen2` 레이아웃(device·regions·body layout·요소)을 담고 있으며, 선택적 rationale(제안 근거, 표시 전용)을 가질 수 있다

## TDD Plan

- **Red**: 큐 read 함수의 안전 폴백 테스트 — 파일 부재(빈 큐), 깨진 JSON(빈 큐), 스키마 위반 항목 필터, id 중복 dedup. `WireScreen2` 유효성 가드(device∈{desktop,mobile}, body layout∈{grid,stack,tree,form}, 요소 kind 8종).
- **Green**: `readDocsWireframeSuggestions(docsDir)` — features/userflow read 원형(`readDocsFeatureSuggestions`) 복제, throw 금지.
- **Refactor**: 스키마 가드를 generation 스펙의 검증과 공유, 공통 큐 read 헬퍼로 정리.
- Mock 대상: 없음(파일 IO는 실제 tmp 픽스처로 테스트).
