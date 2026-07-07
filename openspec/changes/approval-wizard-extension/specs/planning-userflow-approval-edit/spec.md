# planning-userflow-approval-edit (delta)

## MODIFIED Requirements

### Requirement: 유저플로우 탭의 승인 UI는 위저드 방식이다

WHEN the user-flow tab is shown and the current stem's queue is non-empty, the web UI SHALL present suggestions as a wizard above the graph — one edge suggestion at a time (from→to, solid/dotted kind, new-node badge, label, rationale), a progress indicator (n / N with decision dots), [승인]/[반려]/[건너뛰기] actions, and bulk escape actions — replacing the card-list panel (기존 요구 "유저플로우 탭에 승인 패널을 표시한다"의 목록형 카드+개별/일괄 버튼을 대체). Decisions accumulate client-side per stem and apply once from the summary via the existing apply route; after a successful apply the graph and queue SHALL be refetched and decisions reset. Decisions SHALL be checkpointed to localStorage (`uflow-wizard:<project>:<stem>`) with stale ids discarded; switching stem or project SHALL NOT leak decisions or reset signals across stems/projects. An empty queue SHALL render no wizard.

#### Scenario: 큐가 있으면 위저드가 뜨고 반영 후 그래프가 갱신된다

- **WHEN** 제안 2건이 있는 유저플로우 탭에서 2건을 결정하고 요약에서 [결정 반영하기]를 누른다
- **THEN** apply 1회 후 큐 재조회로 위저드가 사라지거나 남은 건만 남고, 그래프 재조회로 승인된 에지가 나타난다

#### Scenario: 빈 큐면 위저드가 렌더되지 않는다

- **WHEN** 큐가 비어 있는 유저플로우 탭을 연다
- **THEN** 위저드는 렌더되지 않고 그래프·드래그 저장 등 기존 동작은 그대로다

#### Scenario: 건너뛰기는 큐에 남고 반영 후 다시 나타난다

- **WHEN** 1건을 [건너뛰기]하고 나머지를 승인해 반영한다
- **THEN** 건너뛴 에지 제안은 반영되지 않고 큐에 남으며, 반영 후 위저드에 카드로 다시 나타난다

#### Scenario: stem 전환은 결정을 침범하지 않는다

- **WHEN** stem A에서 일부 결정 후 stem B로 전환했다가 A로 돌아온다
- **THEN** A의 결정은 복원되고 B의 결정 상태는 A와 무관하다(반영 신호도 stem 간 격리)

## TDD Plan

- **Red**: 상태 모듈은 rename 후 기존 16건 GREEN 유지. stem별 체크포인트 키 파생은 순수 함수면 단위 테스트 1건 추가.
- **Green**: 공용 셸 + userflow 카드 렌더러(에지 표기 재사용) + App 배선(uflowAppliedTick, stem 리마운트 key).
- **Refactor**: 기존 UserFlowApprovalPanel 삭제.
- Mock 대상: 없음.
