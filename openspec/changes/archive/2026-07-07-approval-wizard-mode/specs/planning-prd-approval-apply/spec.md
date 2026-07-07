# planning-prd-approval-apply (delta)

## MODIFIED Requirements

### Requirement: PRD 승인 UI는 위저드 방식이다

WHEN the PRD suggestion queue is non-empty, the panel SHALL present suggestions as a wizard — one suggestion at a time with its 현재↔제안 diff, a progress indicator (n / N with per-item decision dots), and [승인]/[반려]/[건너뛰기] actions — replacing the previous card-list-with-bulk-bar layout. Bulk capability SHALL survive as wizard escape actions ([남은 것 모두 승인]/[남은 것 모두 반려]).

(직전 요구 "카드 목록 + 상단 일괄 바 + 목록 캡"을 이 위저드 요구가 대체한다 — 사용자 확정 A, 2026-07-06.)

#### Scenario: 진입 즉시 한 건씩

- **WHEN** 제안 N건이 있는 프로젝트의 PRD 뷰를 연다
- **THEN** 첫 제안 1건이 diff와 함께 크게 표시되고, 진행 표시가 "1 / N"이며, 결정하면 자동으로 다음 건으로 넘어간다

#### Scenario: 건너뛰기는 큐에 남는다

- **WHEN** 한 제안을 [건너뛰기]한다
- **THEN** 그 제안은 반영 대상에 포함되지 않고 큐에 남으며, 다음 위저드 진입 때 다시 나타난다

#### Scenario: 탈출구 일괄 결정

- **WHEN** 위저드 도중 [남은 것 모두 승인]을 누른다
- **THEN** 미결정 제안 전부가 승인으로 표시되고 요약 화면으로 이동한다 (서버 반영은 아직 없음)

### Requirement: 반영은 요약에서 한 번, 결정은 이탈을 견딘다

Decisions accumulate client-side during the wizard; the server apply happens exactly once when the user confirms [결정 반영하기] on the summary screen (reusing the existing chunked apply route). Decisions SHALL be checkpointed to localStorage so that re-entering the wizard restores them; checkpointed decisions whose suggestion ids are no longer in the queue SHALL be discarded.

#### Scenario: 요약 확인 후 1회 반영

- **WHEN** 모든 제안을 결정하고 요약에서 [결정 반영하기]를 누른다
- **THEN** 승인/반려 결정이 기존 apply 경로로 1회(청크) 전송되고, 성공하면 문서·큐·화면이 갱신된다

#### Scenario: 이탈 후 재진입 시 결정 복원

- **WHEN** 3건을 결정한 상태에서 화면을 떠났다가 같은 프로젝트 PRD 뷰로 돌아온다
- **THEN** 이전 결정 3건이 복원돼 있고 4번째 제안부터 이어서 검토한다

#### Scenario: 큐가 바뀌면 stale 결정은 폐기

- **WHEN** 체크포인트에 있는 제안 id가 현재 큐에 더 이상 없다
- **THEN** 그 id의 결정은 조용히 폐기되고 현재 큐 기준으로만 진행한다 (없는 id가 apply로 전송되지 않는다)

#### Scenario: 반영 실패 시 결정 보존

- **WHEN** [결정 반영하기]의 서버 호출이 실패한다
- **THEN** 기존 실패 고지 경로가 동작하고 체크포인트는 남아 재시도할 수 있다

## RENAMED Requirements

(없음)

## REMOVED Requirements

(없음)

## TDD Plan

- **Red**: web 테스트 러너 부재(기존 한계) → 결정 상태 모델·stale 폐기 로직을 **순수 함수로 분리**해 server jest에서 검증 가능하게 하거나(shared 유틸), 최소한 위저드 상태 전이(결정→cursor 이동·탈출구·요약 카운트)와 체크포인트 대조(ids 차집합 폐기)를 다루는 단위 테스트를 둔다.
- **Green**: PrdApprovalWizard 구현 + App 배선 + 기존 패널 삭제.
- **Refactor**: 없음(카드 내부 마크업·CSS 재사용).
- Mock 대상: 없음(apply 호출은 기존 api 함수 재사용, 상태 로직은 순수 함수).
