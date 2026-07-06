# planning-userflow-approval-edit (delta)

## ADDED Requirements

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
