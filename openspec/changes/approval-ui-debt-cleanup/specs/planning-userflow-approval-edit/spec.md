# planning-userflow-approval-edit (delta)

## ADDED Requirements

### Requirement: 큐 재작성 실패는 부분반영 상태로 고지한다

WHEN the user-flow document append succeeds but the subsequent queue prune write throws, the apply route SHALL still respond 200 with the applied results and SHALL set `queuePruneFailed: true` in the response, and the web client SHALL surface a notice that the document was updated but the queue cleanup failed — preventing the orphan-queue path where re-approving a stale suggestion is permanently skipped as duplicate-edge with no explanation.

#### Scenario: prune write 실패 시 500 대신 부분 상태 고지

- **WHEN** user-flow 문서 append는 성공했으나 큐 write가 throw한다
- **THEN** 응답은 200 + `queuePruneFailed: true`이고, 화면에 부분반영 고지가 뜬다

#### Scenario: 문서 write 실패는 기존대로 실패다

- **WHEN** user-flow 문서 write 자체가 실패한다
- **THEN** 기존 동작(에러 응답, 문서·큐 불변)이 유지된다

### Requirement: 큐 읽기는 중복 id를 제거한다

WHEN reading the user-flow suggestion queue, entries with a duplicate `id` SHALL be dropped keeping only the first occurrence, so a single approval can never append the same edge twice.

#### Scenario: 같은 id 2건 승인 1회 = 에지 1줄

- **WHEN** 큐 파일에 같은 id의 에지 제안이 2건 있고 그 id를 1회 승인한다
- **THEN** Mermaid 문서에는 에지가 정확히 1줄만 추가된다

### Requirement: skip 사유 단언은 정확 문자열로 박제된다

The apply skip-reason tests SHALL assert the exact `"<id>: <reason>"` entry strings (not merely counts or substrings), so a reason regression cannot pass unnoticed.

#### Scenario: 사유 문자열 회귀가 테스트로 잡힌다

- **WHEN** skip 사유 문자열 형식이나 사유 값이 코드에서 바뀐다
- **THEN** 해당 단언 테스트가 실패한다

## TDD Plan

- **Red**: prune write 실패 주입 apply가 200+`queuePruneFailed` 반환(현재 500이라 실패) / 중복 id 픽스처 승인이 에지 1줄만 append(현재 2줄이라 실패) / cd29898 느슨 단언 2건을 정확 문자열로 조이면 그대로 GREEN이어야 함(조이는 과정에서 현 동작 확인).
- **Green**: `pruneUserFlowQueue` 호출 try/catch + 결과 필드, read 함수 Set 유일성 필터(3-lib 동형).
- **Refactor**: 없음.
- Mock 대상: 없음(실 temp 파일 픽스처).
