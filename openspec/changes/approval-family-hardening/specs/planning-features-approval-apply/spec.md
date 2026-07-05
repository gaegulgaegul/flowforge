# planning-features-approval-apply (delta)

## ADDED Requirements

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
