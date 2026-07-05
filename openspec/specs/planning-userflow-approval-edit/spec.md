# planning-userflow-approval-edit

## Purpose

유저플로우 문서(docs/planning/user-flow/<stem>.md)에 대한 에지 추가 제안을 per-stem 사이드카 큐로 받고, 승인분만 결정론 검증 + self-roundtrip 방어를 거쳐 Mermaid에 append 반영하는 능력. 반려·검증 위반은 문서를 건드리지 않는다.

## Requirements

### Requirement: 에지 추가 제안 큐를 조회한다

The system SHALL serve the per-stem suggestion queue via `GET /api/docs/:project/planning-user-flow-suggestions?flow=<stem>`. A missing queue file SHALL return an empty queue with HTTP 200; a malformed queue file SHALL be filtered to valid suggestions only.

#### Scenario: 큐 파일이 있으면 제안 목록을 반환한다

- **WHEN** `<stem>.suggestions.json`에 유효한 add-edge 제안 2건이 있는 프로젝트로 조회한다
- **THEN** 응답 큐에 그 2건이 담긴다

#### Scenario: 큐 파일 부재는 빈 큐 200이다

- **WHEN** `<stem>.suggestions.json`이 없는 프로젝트로 조회한다
- **THEN** 응답은 HTTP 200에 빈 제안 목록이며 404가 아니다

#### Scenario: 깨진 큐·무효 제안은 걸러진다

- **WHEN** 큐 파일이 깨진 JSON이거나 필수 필드가 빠진 제안이 섞여 있다
- **THEN** 깨진 파일은 빈 큐로, 무효 제안은 제외하고 유효분만 반환하며 에러를 던지지 않는다

### Requirement: 승인분만 검증을 거쳐 Mermaid에 append 반영한다

WHEN `POST .../planning-user-flow-suggestions/apply?flow=<stem>` receives approve/reject id lists, the system SHALL apply only approved suggestions by appending one edge line per suggestion at the end of the first mermaid code block (before the closing fence), reusing the 6a/6b request/response contract (`PrdApplyRequest`/`PrdApplyResult`). Rejected suggestions SHALL be removed from the queue without touching the document. Deterministic validation failures SHALL surface the suggestion in `skipped` without aborting the whole apply.

#### Scenario: 기존 노드 간 happy 에지 승인이 문서에 반영된다

- **WHEN** 기존 노드 A→B 실선 에지 제안을 승인한다
- **THEN** 문서의 mermaid 블록 끝에 `A -->|라벨| B` 형태의 줄이 추가되고, 재조회한 유저플로우 그래프에 그 에지(kind happy)가 나타난다

#### Scenario: 신규 화면 노드로의 에지케이스 에지 승인이 반영된다

- **WHEN** 기존 노드 A에서 신규 노드(`newNode { id, label }`)로 가는 점선(edgecase) 제안을 승인한다
- **THEN** `A -.->|라벨| NewId["라벨"]` 형태의 줄이 추가되고, 재조회 그래프에 신규 화면 노드와 kind edgecase 에지가 나타난다

#### Scenario: 반려는 문서를 건드리지 않고 큐에서만 제거된다

- **WHEN** 제안을 반려한다
- **THEN** 문서 내용은 바이트 단위로 불변이고, 그 제안만 큐에서 사라진다

#### Scenario: 검증 위반 제안은 skipped로 표면화된다

- **WHEN** 존재하지 않는 from 노드, 기존 id와 충돌하는 newNode id, 또는 `"`·`|`·개행이 든 라벨을 가진 제안을 승인한다
- **THEN** 그 제안은 문서에 반영되지 않고 `skipped`에 사유와 함께 담기며, 같은 apply의 다른 유효 제안은 정상 반영된다

#### Scenario: 이미 존재하는 에지 제안은 멱등 skipped다

- **WHEN** 문서에 이미 있는 from·to·kind 동일 에지를 다시 승인한다
- **THEN** 중복 줄을 추가하지 않고 `skipped`로 표면화된다

### Requirement: self-roundtrip 방어가 쓰기를 게이트한다

Before writing, the system SHALL re-parse the patched lines and verify: parsing succeeds, every pre-existing node (id and label) is preserved, every pre-existing edge (from·to·kind·label) is preserved, and exactly the approved edges were added as proposed. Any violation SHALL cancel the write (HTTP 422, `writeFailed: true`), keep the original document intact, and keep the queue unchanged.

#### Scenario: 방어 위반 시 422와 원본 보존

- **WHEN** append 결과가 기존 노드/에지를 보존하지 못하는 상태가 된다(방어 로직이 감지)
- **THEN** 응답은 422이고 문서와 큐는 변경 전 그대로다

#### Scenario: 방어 무력화 프로브 — 방어가 항상 통과하도록 조작되면 테스트가 실패한다

- **WHEN** self-roundtrip 방어를 무조건 통과(return true)로 바꾼다
- **THEN** 방어 커버 테스트가 red가 된다(방어가 실제로 게이트임을 증명)

### Requirement: 유저플로우 탭에 승인 패널을 표시한다

WHEN the user-flow tab is shown and the current stem's queue is non-empty, the web UI SHALL render an approval panel above the graph with per-suggestion cards (from→to, solid/dotted kind, label, rationale) and individual/bulk approve·reject actions. After a successful apply, the graph and queue SHALL be refetched. An empty queue SHALL render no panel.

#### Scenario: 큐가 있으면 패널이 뜨고 승인 후 그래프가 갱신된다

- **WHEN** 제안 2건이 있는 유저플로우 탭에서 1건을 승인한다
- **THEN** apply 후 큐 재조회로 카드가 1건으로 줄고, 그래프 재조회로 승인된 에지가 나타난다

#### Scenario: 빈 큐면 패널이 렌더되지 않는다

- **WHEN** 큐가 비어 있는 유저플로우 탭을 연다
- **THEN** 승인 패널은 렌더되지 않고 그래프·드래그 저장 등 기존 동작은 그대로다

