# planning-features-approval-apply (delta)

## ADDED Requirements

### Requirement: features 승인 UI는 위저드 방식이다

WHEN the feature suggestion queue is non-empty, the web UI SHALL present suggestions as a wizard — one suggestion at a time showing its nodePath and attribute before/after, a progress indicator (n / N with decision dots), [승인]/[반려]/[건너뛰기] actions, and bulk escape actions ([남은 것 모두 승인]/[남은 것 모두 반려]) — replacing the card-list panel. Decisions accumulate client-side and apply once from the summary via the existing chunked apply route; decisions SHALL be checkpointed to localStorage (`features-wizard:<project>`) with stale ids discarded against the current queue; a failed apply SHALL preserve decisions and a successful apply SHALL reset them.

#### Scenario: 진입 즉시 한 건씩 + 요약 1회 반영

- **WHEN** 속성 제안 N건이 있는 기능명세 탭을 열고 전부 결정한 뒤 요약에서 [결정 반영하기]를 누른다
- **THEN** 위저드가 1건씩 제시되고("1 / N"부터), 승인/반려 결정이 기존 apply 경로로 1회 전송되며 features.md·큐·화면이 갱신된다

#### Scenario: 건너뛰기는 큐에 남고 반영 후 다시 나타난다

- **WHEN** 1건을 [건너뛰기]하고 나머지를 승인해 반영한다
- **THEN** 건너뛴 제안은 반영되지 않고 큐에 남으며, 반영 후 위저드에 카드로 다시 나타난다(요약에 갇히지 않음)

#### Scenario: 이탈 후 재진입 복원 + 반영 실패 결정 보존

- **WHEN** 일부 결정 후 화면을 떠났다 돌아오거나, [결정 반영하기]의 서버 호출이 실패한다
- **THEN** 결정이 복원/보존되어 이어서 진행하거나 재시도할 수 있다

## TDD Plan

- **Red**: 셸 일반화 후에도 상태 모듈 단위 테스트 16건 GREEN 유지(rename만) — features 전용 신규 로직은 카드 렌더러뿐이라 상태 테스트 추가 불요, UI는 verify 실픽셀.
- **Green**: 공용 셸 + features 카드 렌더러 + App 배선(featAppliedTick).
- **Refactor**: 기존 FeatureApprovalPanel 삭제.
- Mock 대상: 없음.
