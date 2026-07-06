# planning-features-approval-apply (delta)

## ADDED Requirements

### Requirement: 큐 재작성 실패는 부분반영 상태로 고지한다

WHEN the features.md patch write succeeds but the subsequent queue prune write throws, the apply route SHALL still respond 200 with the applied results and SHALL set `queuePruneFailed: true` in the response, and the web client SHALL surface a notice that the document was updated but the queue cleanup failed.

#### Scenario: prune write 실패 시 500 대신 부분 상태 고지

- **WHEN** features.md 속성 패치는 성공했으나 큐 write가 throw한다
- **THEN** 응답은 200 + `queuePruneFailed: true`이고, 화면에 부분반영 고지가 뜬다

#### Scenario: 문서 write 실패는 기존대로 실패다

- **WHEN** features.md 패치 write 자체가 실패한다
- **THEN** 기존 동작(에러 응답, 문서·큐 불변)이 유지된다

### Requirement: 큐 읽기는 중복 id를 제거한다

WHEN reading the feature suggestion queue, entries with a duplicate `id` SHALL be dropped keeping only the first occurrence, so a single approval can never apply twice.

#### Scenario: 같은 id 2건 승인 1회 = 반영 1회

- **WHEN** 큐 파일에 같은 id의 제안이 2건 있고 그 id를 1회 승인한다
- **THEN** features.md에는 정확히 1회만 반영된다

## TDD Plan

- **Red**: prune write 실패 주입 apply가 200+`queuePruneFailed` 반환(현재 500이라 실패) / 중복 id 픽스처 읽기가 1건 반환(현재 2건이라 실패).
- **Green**: `pruneFeatureQueue` 호출 try/catch + 결과 필드, read 함수 Set 유일성 필터(prd와 동형).
- **Refactor**: 없음.
- Mock 대상: 없음(실 temp 파일 픽스처).
