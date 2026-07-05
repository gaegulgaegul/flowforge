# planning-feature-audit-badge

기획 기능명세 뷰 요구사항 노드에 capability 단위 audit 판정 배지를 표시하고, 상세 패널에 audit 상세를 노출하는 능력. 데이터 원천은 저장된 `docs/audit.json` `items[]`(읽기전용 소비), 매칭은 capability 영문 키 문자열 동치만.

## ADDED Requirements

### Requirement: audit items를 capability 단위로 집계해 제공한다

The system SHALL aggregate `<projDir>/docs/audit.json` `items[]` per capability key and serve the result via `GET /api/docs/:project/audit-capabilities`. Aggregation SHALL be deterministic: `fail` when the capability has ≥1 FAIL item, `clean` when it has 0 FAIL and ≥1 PASS, `unknown` otherwise (no items or all UNVERIFIABLE). UNVERIFIABLE items SHALL NOT degrade the status and SHALL be exposed only as a count.

#### Scenario: FAIL 1건 이상 capability는 fail로 집계된다

- **WHEN** audit.json의 어떤 capability items에 FAIL 판정이 1건 이상 있다
- **THEN** `GET /api/docs/:project/audit-capabilities` 응답에서 그 capability의 `status`는 `fail`이고 `fail` 건수가 함께 담긴다

#### Scenario: FAIL 0건·PASS 있는 capability는 clean으로 집계된다

- **WHEN** 어떤 capability items가 PASS와 UNVERIFIABLE로만 구성된다(FAIL 0건, PASS ≥ 1건)
- **THEN** 그 capability의 `status`는 `clean`이며 UNVERIFIABLE 건수는 `unverifiable` 필드로만 노출된다

#### Scenario: 검증가능 항목이 없는 capability는 unknown이다

- **WHEN** 어떤 capability items가 전부 UNVERIFIABLE이다
- **THEN** 그 capability의 `status`는 `unknown`이다

#### Scenario: audit.json 없음·깨짐은 빈 맵 폴백한다

- **WHEN** 프로젝트에 `docs/audit.json`이 없거나 JSON 파싱이 실패하거나 `items`가 배열이 아니다
- **THEN** 응답은 빈 집계 맵(HTTP 200)이며 에러를 던지지 않는다

#### Scenario: audit.json 내부 경로는 신뢰하지 않는다

- **WHEN** audit.json에 호스트 절대경로(`scanRoot` 등)가 담겨 있다
- **THEN** 시스템은 그 경로를 무시하고 이미 검증된 projDir 기준으로만 파일을 읽으며, `items[]`의 필요 필드(capability·verdict·kind·claim·reason)만 소비한다

### Requirement: 요구사항 노드에 audit 배지를 표시한다

The planning features view SHALL render an audit badge on each requirement node by matching the node's capability key to the aggregated audit map by **string equality only**. Requirement nodes without audit data SHALL show a `미감사`(unknown) badge; non-requirement nodes (기능·상세기능) SHALL NOT render an audit badge.

#### Scenario: 감사 데이터 있는 요구사항 노드에 판정 배지가 뜬다

- **WHEN** 기획 기능명세 뷰가 렌더되고 어떤 요구사항 노드의 capability 키가 audit 집계 맵에 존재한다
- **THEN** 그 노드에 집계 status에 대응하는 배지(clean→`정합`, fail→`불합 N`)가 표시된다

#### Scenario: 감사 데이터 없는 요구사항 노드는 미감사 배지가 뜬다

- **WHEN** 어떤 요구사항 노드의 capability 키가 audit 집계 맵에 없다
- **THEN** 그 노드에 `미감사` 배지가 표시된다(숨기지 않는다)

#### Scenario: 기능·상세기능 노드에는 audit 배지가 없다

- **WHEN** 기획 기능명세 뷰가 렌더된다
- **THEN** capability 키가 없는 기능·상세기능 노드에는 audit 배지가 렌더되지 않는다

#### Scenario: audit 데이터 로드 실패에도 그래프는 정상 렌더된다

- **WHEN** `audit-capabilities` fetch가 실패한다
- **THEN** 기능명세 그래프는 배지 없이 정상 렌더되고 콘솔 치명 에러 없이 동작한다

### Requirement: 상세 패널에 audit 상세를 노출한다

WHEN a requirement node is selected, the detail panel SHALL show an audit section with the aggregated status, PASS/FAIL/UNVERIFIABLE counts, and — only when status is `fail` — the failing items' claims. Claims SHALL be rendered as text (no HTML injection).

#### Scenario: 요구사항 노드 클릭 시 audit 섹션이 뜬다

- **WHEN** 감사 데이터가 있는 요구사항 노드를 클릭한다
- **THEN** 상세 패널에 판정과 PASS/FAIL/검증불가 건수가 표시된다

#### Scenario: fail 상태면 FAIL claim 목록이 나열된다

- **WHEN** 집계 status가 `fail`인 요구사항 노드를 클릭한다
- **THEN** 상세 패널 audit 섹션에 FAIL 항목의 claim(과 reason)이 텍스트로 나열된다

#### Scenario: clean·unknown이면 claim 목록은 생략된다

- **WHEN** 집계 status가 `clean` 또는 `unknown`인 요구사항 노드를 클릭한다
- **THEN** audit 섹션에 판정·건수만 표시되고 claim 목록은 렌더되지 않는다

## TDD Plan

- **Red**: `auditSummary` 단위 — (a) FAIL≥1→fail (b) PASS만+UNVERIFIABLE→clean (c) 전부 UNVERIFIABLE→unknown (d) 파일없음/깨진 JSON/items 비배열→빈 맵 (e) 소비 필드 외 무시. 라우트 통합 — audit.json 픽스처로 `GET /api/docs/:project/audit-capabilities` 집계 맵 단언 + 존재하지 않는 프로젝트 404.
- **Green**: `server/src/lib/auditSummary.ts` 집계 순수 함수 + 리더(폴백), `routes/docs.ts` 라우트 1개.
- **Refactor**: web 병합은 어댑터 파생 함수로 분리(기존 path·childRefs 파생과 나란히).
- Mock 대상 없음(파일 IO는 임시 픽스처로 실경로 테스트 — 기존 projects.test 패턴).
