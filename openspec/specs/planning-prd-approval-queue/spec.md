# planning-prd-approval-queue

flowforge가 `docs/planning/prd.suggestions.json`(PRD 갱신 제안 큐)을 읽어 반환하는 읽기전용 능력. 제안 큐는 AI(openspec-plan 스킬/봇)가 쓴 섹션 단위 제안 배열이며, flowforge는 이를 생성하지 않고 소비만 한다(manyfast 수정-승인 루프의 읽기 측).

## Requirements

### Requirement: PRD 제안 큐 읽기

flowforge는 `docs/planning/prd.suggestions.json`(PRD 갱신 제안 큐)을 읽어 반환하는 읽기전용 엔드포인트를 SHALL 제공한다. 제안 큐 파일이 없으면 빈 큐(`{version:1,suggestions:[]}`)를 반환하며 404가 아니다(큐 부재=제안 없음이라는 정상 상태). 읽기는 절대 500으로 죽지 않으며(MUST NOT throw), 경로 조작은 차단한다.

각 제안(`PrdSuggestion`)은 안정적 `id`(승인/반려 대상 지정), `section`(기존 `PrdSectionKey` 5키 중 하나: overview|value|target|metrics|attributes), `op`("replace"), `proposedBody`(그 섹션의 새 마크다운 본문), 선택 `rationale`를 가진다. 라우트는 `GET /api/docs/:project/planning-prd-suggestions`이며 `{ project, queue }` 형태를 반환한다.

#### Scenario: 제안 큐가 있는 프로젝트 조회
- **WHEN** `docs/planning/prd.suggestions.json`이 있는 프로젝트에 `GET /api/docs/:project/planning-prd-suggestions` 요청
- **THEN** HTTP 200과 함께 `{project, queue:{version:1, suggestions:[…]}}`를 반환하고, 각 제안의 id·section·op·proposedBody가 그대로 실린다

#### Scenario: 제안 큐가 없는 프로젝트 조회 (빈 큐 폴백)
- **WHEN** 제안 큐 파일이 없지만 planning docs가 있는 프로젝트에 조회 요청
- **THEN** HTTP 200과 함께 `{version:1, suggestions:[]}` 빈 큐를 반환한다(404 아님)

#### Scenario: 깨진 제안 큐 JSON (안전 폴백)
- **WHEN** `prd.suggestions.json`이 파싱 불가능한 내용(깨진 JSON)일 때 조회
- **THEN** throw 없이 빈 큐(`{version:1, suggestions:[]}`)를 반환한다(읽기는 절대 500으로 죽지 않는다)

#### Scenario: 경로 조작 차단
- **WHEN** project 파라미터에 `..`나 슬래시가 포함된 값으로 조회
- **THEN** `resolveDocsDir`가 null을 반환해 HTTP 404(docs_not_found)로 막고, docs 루트 밖 파일을 읽지 않는다

#### Scenario: 스키마 검증 — 미인식 section/op는 걸러짐
- **WHEN** 큐에 `section`이 5키가 아니거나 `op`가 "replace"가 아닌 항목이 섞여 있을 때 조회
- **THEN** 유효한 제안만 반환하고 미인식 항목은 조용히 제외한다(부정 데이터가 UI로 새지 않는다)
