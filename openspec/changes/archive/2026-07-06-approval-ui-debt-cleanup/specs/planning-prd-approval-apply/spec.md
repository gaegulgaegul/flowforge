# planning-prd-approval-apply (delta)

## ADDED Requirements

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

## TDD Plan

- **Red**: (1) prune write를 실패하도록 주입(spy/권한)한 apply 호출이 200+`queuePruneFailed`를 반환하는지 — 현재는 500이라 실패. (2) 중복 id 픽스처 큐 읽기가 1건만 반환하는지 — 현재는 2건이라 실패.
- **Green**: prune 호출 try/catch + 결과 필드(docs.ts), read 함수 Set 유일성 필터.
- **Refactor**: 없음(골격 추상화 금지 — 3-lib 동형 유지).
- Mock 대상: 없음(실 temp 파일 픽스처).
