## ADDED Requirements

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

## TDD Plan

**Red**:
- `writeDocsPlanningFeaturesAttrs(docsDir, patches)` 단위 테스트 — (a) 단일 노드 속성 교체+나머지 보존 (b) 산문·capability·서문 보존 (c) 속성 줄 없는 노드 삽입 (d) 미실재 nodePath 스킵 (e) 불변식 위반(노드 개수 변함)→안 씀 (f) 파싱 실패→안 씀.
- `applyFeatureSuggestions(docsDir, {approve, reject})` 단위 테스트 — 승인 반영·반려 제거·skipped 표면화·writeFailed 구분.
- 라우트 통합 테스트 — POST apply 200(applied/rejected/remaining/skipped)·400(잘못된 body)·404(경로조작)·422(불변식 위반).

**Green**:
- `lib/docs.ts`에 `writeDocsPlanningFeaturesAttrs`(원문 라인 스캔으로 nodePath 헤더 찾기→직후 속성 줄 교체/삽입, 다른 줄 슬라이스 보존, write 전 self-roundtrip 불변식 검증). `applyFeatureSuggestions`(큐 읽기→approve/reject 분리→writeDocsPlanningFeaturesAttrs 호출→큐 재작성→결과). `isPrdApplyRequest`(6a) 재사용.
- `routes/docs.ts`에 POST 라우트(6a apply 라우트 계약 복제).

**Refactor**:
- nodePath 헤더 매칭 로직을 featureTreeBuilder의 헤더 정규식(RE_HEADER/RE_ATTRS)과 정합 유지(구조/동작 커밋 분리).

**Mock 대상**: 없음(임시 픽스처로 실제 파일 왕복 검증 — 승인 후 재조회로 반영·보존 확인).
