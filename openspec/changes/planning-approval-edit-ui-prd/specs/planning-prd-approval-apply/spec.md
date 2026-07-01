## ADDED Requirements

### Requirement: PRD 제안 개별/일괄 승인·반려 적용

flowforge SHALL provide an endpoint that approves or rejects PRD suggestion queue items individually or in bulk. The endpoint MUST NOT write `prd.md` except through approval (승인=사용자 의도). `POST /api/docs/:project/planning-prd-suggestions/apply`는 body `{approve: string[], reject: string[]}`(제안 id 목록)를 받는다.

- **승인(approve)**: 각 id에 해당하는 제안의 `proposedBody`로 그 `section`을 교체한 새 `prd.md`를 원자적으로 재작성하고, 반영된 제안을 큐에서 제거한다.
- **반려(reject)**: 반영 없이 큐에서만 제거한다(원본 `prd.md` 불변).
- **SSOT 재정의**: `prd.md`는 승인을 통해서만 바뀐다(승인=사용자 의도). 승인 없이는 명세가 불변이다.

응답은 `{applied: number(교체된 섹션 수), rejected: number, remaining: number(남은 제안 수), skipped: string[](처리 못 한 id)}`를 반환한다. silent drop을 금지한다 — 큐에 없는 id, 원본에 없는 섹션을 가리키는 op는 `skipped`로 표면화한다.

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
- **WHEN** approve/reject에 큐에 없는 id, 또는 원본 `prd.md`에 없는 섹션을 가리키는 제안을 담아 요청
- **THEN** 그 id는 `skipped`에 담겨 응답으로 표면화되고, `prd.md`는 유효한 승인분만 반영하거나(없으면 불변) 손상되지 않는다

#### Scenario: PRD 파싱 실패 시 원본 보호
- **WHEN** 승인 반영 중 `prd.md`가 5섹션으로 파싱되지 않는 손상 상태이거나 재직렬화가 실패할 상황
- **THEN** HTTP 422로 막고 `prd.md`를 전혀 쓰지 않는다(원본 불변) — 부분 손상된 파일을 남기지 않는다

#### Scenario: 잘못된 요청 body 차단
- **WHEN** body가 `{approve:[], reject:[]}` 형태(문자열 배열 2필드)가 아닐 때
- **THEN** `isPrdApplyRequest` 런타임 검증이 걸러 HTTP 400(invalid_request)을 반환한다

#### Scenario: 경로 조작 차단
- **WHEN** project 파라미터에 `..`/슬래시가 포함된 값으로 apply 요청
- **THEN** `resolveDocsDir`가 null→HTTP 404로 막고, docs 루트 밖 파일을 쓰지 않는다

## TDD Plan

**Red**:
- `writeDocsPlanningPrd(docsDir, sectionReplacements)` 단위 테스트 — (a) 단일 섹션 교체+나머지 보존 (b) H1 title 서문 보존 (c) 미실재 섹션 스킵 (d) 파싱 실패→쓰지 않음.
- `applyPrdSuggestions(docsDir, {approve, reject})` 단위 테스트 — 승인 반영·반려 제거·skipped 표면화·같은 섹션 순서 결정론.
- 라우트 통합 테스트 — POST apply 200(applied/rejected/remaining/skipped)·400(잘못된 body)·404(경로조작)·422(파싱 실패).

**Green**:
- `lib/docs.ts`에 `writeDocsPlanningPrd`(원본 읽어 첫 H2 앞 서문 보존 + 5섹션 조립, 승인 섹션만 교체, 원자적 write). `applyPrdSuggestions`(큐 읽기→approve/reject 분리→writeDocsPlanningPrd 호출→큐 재작성). `isPrdApplyRequest` body 검증(isLayoutOverlay 패턴 복제).
- `routes/docs.ts`에 POST 라우트.

**Refactor**:
- 섹션 조립 로직을 `buildDocsPlanningPrd`의 splitSections 역방향으로 정합 유지(구조/동작 커밋 분리).

**Mock 대상**: 없음(임시 픽스처로 실제 파일 왕복 검증 — 승인 후 재조회로 반영 확인).
