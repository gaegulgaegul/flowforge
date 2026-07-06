# planning-prd-approval-apply

## Purpose

flowforge가 PRD 제안 큐의 항목을 개별/일괄로 승인·반려하고, 승인분만 `docs/planning/prd.md`에 섹션 교체 반영하는 능력. flowforge가 명세 `.md`에 처음으로 쓰는 경로 — SSOT를 "승인을 통해서만 바뀐다"로 재정의(승인=사용자 의도). 반려는 원본 불변.

## Requirements

### Requirement: PRD 제안 개별/일괄 승인·반려 적용

flowforge는 PRD 제안 큐 항목을 개별 또는 일괄로 승인·반려하는 엔드포인트를 SHALL 제공한다. 이 엔드포인트는 승인을 통해서만 `prd.md`를 MUST NOT write except through approval. `POST /api/docs/:project/planning-prd-suggestions/apply`는 body `{approve: string[], reject: string[]}`(제안 id 목록)를 받는다.

- **승인(approve)**: 각 id에 해당하는 제안의 `proposedBody`로 그 `section`을 교체한 새 `prd.md`를 원자적으로 재작성하고, 반영된 제안을 큐에서 제거한다. 첫 H2 앞 서문(H1 title)과 미승인 섹션은 원본 보존.
- **반려(reject)**: 반영 없이 큐에서만 제거한다(원본 `prd.md` 불변).

응답은 `{applied, rejected, remaining, skipped[]}`를 반환한다. silent drop을 금지한다 — 큐에 없는 id는 `skipped`로 표면화한다. `prd.md` 파싱/재직렬화 실패 또는 조립 결과가 5섹션 정합을 깨는 경우 HTTP 422로 막고 `prd.md`를 전혀 쓰지 않는다(원본 보호).

#### Scenario: 단일 제안 승인 → 섹션 교체 반영
- **WHEN** approve에 유효한 제안 id 하나(section=overview)를 담아 apply 요청
- **THEN** `prd.md`의 `## 개요` 섹션 본문이 그 제안의 `proposedBody`로 교체되고, 나머지 4섹션과 H1 title 서문은 원본 그대로 보존되며, 응답 `applied:1`이고 그 제안은 큐에서 사라진다

#### Scenario: 일괄 승인 (여러 섹션 동시 교체)
- **WHEN** approve에 서로 다른 섹션을 가리키는 제안 id 여러 개를 담아 apply 요청
- **THEN** 해당 섹션들이 각 `proposedBody`로 모두 교체되고 응답 `applied`가 그 개수와 일치하며, 반영된 제안들이 모두 큐에서 제거된다

#### Scenario: 반려 — 원본 불변, 큐에서만 제거
- **WHEN** reject에 제안 id를 담아 apply 요청
- **THEN** `prd.md`는 바이트 단위로 변경되지 않고, 응답 `rejected`가 증가하며 그 제안은 큐에서 사라진다(remaining 감소)

#### Scenario: 같은 섹션에 대한 두 승인 — 순서 결정론
- **WHEN** approve에 같은 section을 가리키는 제안 id 두 개를 함께 담아 apply 요청
- **THEN** 큐 배열 순서(뒤에 오는 제안이 최종)로 결정론적으로 반영하고, 어느 값이 남는지 응답으로 확인 가능하며 원본이 깨지지 않는다

#### Scenario: 미실재 id / 미실재 섹션 — 표면화 (silent drop 금지)
- **WHEN** approve/reject에 큐에 없는 id를 담아 요청
- **THEN** 그 id는 `skipped`에 담겨 응답으로 표면화되고, `prd.md`는 유효한 승인분만 반영하거나(없으면 불변) 손상되지 않는다

#### Scenario: proposedBody의 오분리 유발 콘텐츠 차단 (데이터 손상 방어)
- **WHEN** 승인하는 제안의 `proposedBody`에 줄 시작 `## `(가짜 섹션 헤더로 오분리될 수 있는 마크다운)가 포함됨
- **THEN** 조립 결과를 write 전 self-roundtrip 재파싱해 정확히 5섹션으로만 갈리는지 검증하고, 오분리가 감지되면 HTTP 422로 막고 `prd.md`를 쓰지 않는다(원본·큐 보존) — 승인 반영이 prd.md 구조를 절대 깨지 않는다

#### Scenario: PRD 파싱 실패 시 원본 보호
- **WHEN** 승인 반영 중 `prd.md`가 5섹션으로 파싱되지 않는 손상 상태
- **THEN** HTTP 422로 막고 `prd.md`를 전혀 쓰지 않는다(원본 불변) — 부분 손상된 파일을 남기지 않는다

#### Scenario: 잘못된 요청 body 차단
- **WHEN** body가 `{approve:[], reject:[]}` 형태(문자열 배열 2필드)가 아닐 때
- **THEN** `isPrdApplyRequest` 런타임 검증이 걸러 HTTP 400(invalid_request)을 반환한다

#### Scenario: 경로 조작 차단
- **WHEN** project 파라미터에 `..`/슬래시가 포함된 값으로 apply 요청
- **THEN** `resolveDocsDir`가 null→HTTP 404로 막고, docs 루트 밖 파일을 쓰지 않는다

### Requirement: apply는 원문 개행 스타일을 보존한다

WHEN applying approved suggestions to a CRLF document, the system SHALL write the patched document back with its original line endings (only the patched content changes; no whole-file EOL conversion).

#### Scenario: CRLF prd.md 승인 후 개행 보존

- **WHEN** CRLF로 저장된 prd.md에 섹션 교체 승인을 적용한다
- **THEN** 문서의 기존 줄들은 CRLF 그대로이고 교체된 섹션 내용만 바뀐다

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

### Requirement: PRD 승인 패널은 대량 큐 UI 규약을 따른다

WHEN the PRD approval panel renders a suggestion queue, the panel SHALL place the bulk action bar above the card list, SHALL show the pending count in both bulk button labels, and SHALL wrap the card list in the shared capped scroll container (`feature-approval-list`) — matching the features/userflow panels.

#### Scenario: 일괄 바 상단 + 건수 표기

- **WHEN** PRD 제안 큐에 N건이 떠서 패널이 렌더된다
- **THEN** [모두 승인 (N건)]·[모두 반려 (N건)] 바가 카드 목록 위에 있고, 목록은 스크롤 캡 컨테이너 안에 있다

#### Scenario: 3패널 구조 대칭

- **WHEN** PRD·features·userflow 승인 패널을 같은 큐 건수로 렌더한다
- **THEN** 세 패널 모두 동일한 상단 일괄 바/건수 표기/목록 캡 구조를 가진다 (신규 CSS 추가 없이 기존 클래스 재사용)

### Requirement: 큐 재작성 실패는 부분반영 상태로 고지한다

WHEN the document patch write succeeds but the subsequent queue prune write throws, the apply route SHALL still respond 200 with the applied results and SHALL set `queuePruneFailed: true` in the response, and the web client SHALL surface a notice that the document was updated but the queue cleanup failed.

#### Scenario: prune write 실패 시 500 대신 부분 상태 고지

- **WHEN** prd.md 패치는 성공했으나 큐 write가 throw한다
- **THEN** 응답은 200 + `queuePruneFailed: true`이고, 화면에 "문서에는 반영됐지만 큐 정리에 실패했다"는 고지가 뜬다

#### Scenario: 문서 write 실패는 기존대로 실패다

- **WHEN** prd.md 패치 write 자체가 실패한다
- **THEN** 기존 동작(에러 응답, 문서·큐 불변)이 유지된다

### Requirement: 큐 읽기는 중복 id를 제거한다

WHEN reading the suggestion queue, entries with a duplicate `id` SHALL be dropped keeping only the first occurrence, so a single approval can never apply twice.

#### Scenario: 같은 id 2건 승인 1회 = 반영 1회

- **WHEN** 큐 파일에 같은 id의 제안이 2건 있고 그 id를 1회 승인한다
- **THEN** 문서에는 정확히 1회만 반영된다
