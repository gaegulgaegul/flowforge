# planning-features-approval-apply Specification

## Purpose
TBD - created by archiving change planning-approval-edit-ui-features. Update Purpose after archive.
## Requirements
### Requirement: features 속성 제안 개별/일괄 승인·반려 적용

flowforge SHALL provide an endpoint that approves or rejects feature suggestion queue items individually or in bulk, applying approved node attribute changes to `docs/planning/features.md` via **원문 라인 패치**. The endpoint MUST NOT write `features.md` except through approval (승인=사용자 의도). `POST /api/docs/:project/planning-features-suggestions/apply`는 body `{approve: string[], reject: string[]}`(제안 id 목록)를 받는다.

- **승인(approve)**: 각 id의 `nodePath`로 대상 헤더(요구사항/기능/상세기능)를 찾아 그 **헤더 직후 속성 줄만** 새 `(중요도:…, 상태:…)`로 교체한다(속성 줄이 없으면 헤더 직후에 삽입). 서문·산문·capability 주석·다른 노드·헤더 위계는 원문 그대로 보존한다. 반영된 제안은 큐에서 제거한다.
- **반려(reject)**: 반영 없이 큐에서만 제거한다(원본 `features.md` 불변).
- **SSOT 불변식**: `features.md`는 승인을 통해서만 바뀌고, 승인은 노드 **속성만** 바꾼다(label·위계·capability·산문 불변).

응답은 `{applied, rejected, remaining, skipped[], writeFailed?}`를 반환한다. silent drop을 금지한다 — 큐에 없는 id, `features.md`에 없는 nodePath는 `skipped`로 표면화한다. self-roundtrip 불변식(write 전후 노드 개수·capability 키 집합 동일, 대상 노드 속성만 변경) 위반 또는 파싱 실패 시 HTTP 422로 막고 `features.md`를 전혀 쓰지 않는다(원본 보호, writeFailed).

#### Scenario: 단일 노드 속성 승인 → 속성 줄 교체, 산문·capability 보존
- **WHEN** approve에 유효한 제안 id 하나(nodePath=[요구사항, 기능])를 담아 apply 요청
- **THEN** 그 기능 헤더 직후 속성 줄이 제안의 `(중요도:…, 상태:…)`로 교체되고, 그 요구사항의 capability 주석·산문 설명·다른 모든 노드와 위계는 원문 그대로 보존되며, 응답 `applied:1`이고 그 제안은 큐에서 사라진다

#### Scenario: 일괄 승인 (여러 노드 속성 동시 교체)
- **WHEN** approve에 서로 다른 노드를 가리키는 제안 id 여러 개를 담아 apply 요청
- **THEN** 해당 노드들의 속성 줄이 각각 교체되고 응답 `applied`가 그 개수와 일치하며, 반영된 제안들이 모두 큐에서 제거된다

#### Scenario: 반려 — 원본 불변, 큐에서만 제거
- **WHEN** reject에 제안 id를 담아 apply 요청
- **THEN** `features.md`는 바이트 단위로 변경되지 않고, 응답 `rejected`가 증가하며 그 제안은 큐에서 사라진다(remaining 감소)

#### Scenario: 속성 줄이 없는 노드 → 헤더 직후 삽입
- **WHEN** approve 대상 노드가 features.md에서 헤더 직후 속성 줄을 갖고 있지 않을 때(속성 미표기 노드)
- **THEN** 헤더 직후에 새 속성 줄을 삽입하고, self-roundtrip 검증이 노드 개수·capability 불변을 확인해 위계가 깨지지 않는다

#### Scenario: capability 키 보존 불변식 (요구사항 노드 반영 시)
- **WHEN** approve 대상이 요구사항 노드(capability 주석 보유)의 속성 변경일 때
- **THEN** 반영 후에도 그 요구사항의 `<!-- capability: <키> -->` 주석이 그대로 유지되고, write 전후 capability 키 집합이 동일하다(매핑이 깨지지 않는다)

#### Scenario: 미실재 id / 미실재 nodePath — 표면화 (silent drop 금지)
- **WHEN** approve/reject에 큐에 없는 id, 또는 features.md에 없는 nodePath를 가리키는 제안을 담아 요청
- **THEN** 그 id는 `skipped`에 담겨 응답으로 표면화되고, `features.md`는 유효한 승인분만 반영하거나(없으면 불변) 손상되지 않는다

#### Scenario: self-roundtrip 불변식 위반 시 원본 보호
- **WHEN** 승인 반영 결과를 재파싱했을 때 노드 개수 또는 capability 키 집합이 원본과 달라지거나, features.md가 파싱 불가능한 손상 상태
- **THEN** HTTP 422로 막고 `features.md`를 전혀 쓰지 않는다(원본 불변, writeFailed) — 부분 손상된 파일을 남기지 않는다

#### Scenario: 잘못된 요청 body 차단
- **WHEN** body가 `{approve:[], reject:[]}` 형태(문자열 배열 2필드)가 아닐 때
- **THEN** `isPrdApplyRequest`(6a 재사용) 런타임 검증이 걸러 HTTP 400(invalid_request)을 반환한다

#### Scenario: 경로 조작 차단
- **WHEN** project 파라미터에 `..`/슬래시가 포함된 값으로 apply 요청
- **THEN** `resolveDocsDir`가 null→HTTP 404로 막고, docs 루트 밖 파일을 쓰지 않는다

### Requirement: apply는 원문 개행 스타일을 보존한다

WHEN applying approved suggestions to a CRLF document, the system SHALL write the patched document back with its original line endings (only the patched content changes; no whole-file EOL conversion).

#### Scenario: CRLF features.md 승인 후 개행 보존

- **WHEN** CRLF로 저장된 features.md에 속성 승인을 적용한다
- **THEN** 문서의 기존 줄들은 CRLF 그대로이고 교체된 속성 줄만 바뀐다

### Requirement: 큐 재작성은 처리분만 제거한다

WHEN rewriting the suggestion queue after apply, the system SHALL re-read the queue file and remove only the processed (approved/rejected) ids, preserving suggestions added while the apply was in flight.

#### Scenario: apply 도중 추가된 제안이 생존한다

- **WHEN** apply가 시작된 뒤 큐 파일에 신규 제안이 추가되고, apply가 완료된다
- **THEN** 큐에는 처리된 id만 빠지고 신규 제안은 남아 있다

### Requirement: apply 배치 크기를 제한한다

WHEN an apply request's approve+reject ids exceed the batch cap (200), the route SHALL respond 400 without touching the document or queue.

#### Scenario: 초과 배치는 400

- **WHEN** approve+reject 합계 201건으로 apply를 호출한다
- **THEN** 응답은 400이고 문서·큐는 불변이다

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
