## ADDED Requirements

### Requirement: 승인된 와이어 제안만 반영한다

flowforge는 `POST /api/docs/:project/planning-wireframe-suggestions/apply`로 `{ approve: string[], reject: string[] }`를 받아, 승인된 제안만 와이어 원천에 반영 SHALL 한다. 반영은 승인된 `WireScreen2` 레이아웃을 프로젝트 와이어 데이터에 반영하는 것이고, `buildDocsPlanningWireframe2`가 이후 그 승인분을 반환한다(더 이상 고정 픽스처가 아님). 반려된 제안은 원천을 건드리지 않고 큐에서만 제거된다. 응답은 `{ applied, rejected, remaining, skipped, writeFailed?, queuePruneFailed? }`로 기존 apply 계약과 동형이다. 배치 상한은 200이다.

#### Scenario: 승인분만 반영, 반려는 큐에서만 제거

- **WHEN** approve/reject id 목록으로 apply를 호출한다
- **THEN** 승인된 제안의 `WireScreen2` 레이아웃만 와이어 원천에 반영되고, 반려분은 원천 불변으로 큐에서 제거되며, applied/rejected/remaining 수를 반환한다

#### Scenario: self-roundtrip 방어 — 쓰기 전 재파싱 검증

- **WHEN** 반영 직전 재파싱해 기존 승인분(다른 화면들)이 보존되는지 확인한다
- **THEN** 불변식(화면 id 집합·구조) 위반 시 422를 반환하고 원본을 보존한다(writeFailed)

#### Scenario: 처리 못 한 id 표면화

- **WHEN** 큐에 없는 id가 approve/reject에 포함된다
- **THEN** 그 id를 skipped에 담아 반환한다(silent drop 금지)

#### Scenario: 문서 반영 성공 + 큐 정리 실패 → 부분반영 고지

- **WHEN** 와이어 원천 반영은 성공했으나 큐 정리(prune)가 실패한다
- **THEN** queuePruneFailed=true로 부분반영을 고지한다

#### Scenario: 배치 상한

- **WHEN** approve/reject 합계가 200을 초과한다
- **THEN** 상한 초과를 거부한다(APPLY_BATCH_CAP)

## TDD Plan

- **Red**: apply 테스트 — 승인분만 반영·반려는 큐에서만 제거, self-roundtrip 위반 시 422+원본 보존, skipped 표면화, queuePruneFailed 부분반영, 배치 상한 거부.
- **Green**: `applyWireframeSuggestions(docsDir, req)` — features/userflow apply 원형(`applyFeatureSuggestions`) 복제. `wireframeInvariantHolds(before, after)` 불변식(화면 id 집합 보존).
- **Refactor**: `buildDocsPlanningWireframe2`가 픽스처 대신 승인분을 반환하도록 교체(1단계 렌더러·라우트·web 무변경 — `WireScreen2[]` 계약만 유지).
- Mock 대상: 없음(파일 IO는 tmp 픽스처).
