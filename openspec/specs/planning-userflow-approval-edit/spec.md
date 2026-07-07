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

### Requirement: 유저플로우 탭의 승인 UI는 위저드 방식이다

WHEN the user-flow tab is shown and the current stem's queue is non-empty, the web UI SHALL present suggestions as a wizard above the graph — one edge suggestion at a time (from→to, solid/dotted kind, new-node badge, label, rationale), a progress indicator (n / N with decision dots), [승인]/[반려]/[건너뛰기] actions, and bulk escape actions — replacing the card-list panel . Decisions accumulate client-side per stem and apply once from the summary via the existing apply route; after a successful apply the graph and queue SHALL be refetched and decisions reset. Decisions SHALL be checkpointed to localStorage (`uflow-wizard:<project>:<stem>`) with stale ids discarded; switching stem or project SHALL NOT leak decisions or reset signals across stems/projects. An empty queue SHALL render no wizard.

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

### Requirement: apply는 원문 개행 스타일을 보존한다

WHEN applying approved edge suggestions to a CRLF document, the system SHALL append the edge line with the document's original line endings and SHALL NOT convert the whole file's EOL.

#### Scenario: CRLF 유저플로우 문서 승인 후 개행 보존

- **WHEN** CRLF로 저장된 <stem>.md에 에지 추가 승인을 적용한다
- **THEN** 기존 줄들은 CRLF 그대로이고 append된 에지 줄만 추가된다

### Requirement: 큐 재작성은 처리분만 제거한다

WHEN rewriting the per-stem queue after apply, the system SHALL re-read the queue file and remove only processed ids, preserving in-flight additions.

#### Scenario: apply 도중 추가된 제안이 생존한다

- **WHEN** apply 시작 후 큐에 신규 제안이 추가되고 apply가 완료된다
- **THEN** 큐에는 처리된 id만 빠지고 신규 제안은 남는다

### Requirement: apply 배치 크기를 제한한다

WHEN approve+reject ids exceed the batch cap (200), the route SHALL respond 400 without touching document or queue.

#### Scenario: 초과 배치는 400

- **WHEN** 201건 배치로 apply를 호출한다
- **THEN** 응답은 400이고 문서·큐 불변이다

### Requirement: append 위치와 재파싱은 같은 mermaid 블록을 본다

The append target block SHALL be determined by the same block-detection logic the parser uses, so a preceding non-mermaid fence (e.g. ```` ```mermaid-example ````) cannot split append target from parse target.

#### Scenario: mermaid-example 블록이 선행해도 유효 제안이 반영된다

- **WHEN** 문서에 ```` ```mermaid-example ```` 블록이 진짜 ```` ```mermaid ```` 블록보다 앞에 있고 유효 제안을 승인한다
- **THEN** 에지는 진짜 mermaid 블록에 append되고 정상 반영된다(오도 사유 skipped가 아니다)

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
