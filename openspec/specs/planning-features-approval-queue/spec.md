# planning-features-approval-queue Specification

## Purpose
TBD - created by archiving change planning-approval-edit-ui-features. Update Purpose after archive.
## Requirements
### Requirement: features 속성 제안 큐 읽기

flowforge SHALL provide a read-only endpoint that reads and returns `docs/planning/features.suggestions.json` (기능명세 노드 속성 변경 제안 큐). 제안 큐는 AI(openspec-plan 스킬/봇)가 쓴 노드 단위 속성 변경 제안 배열이며, flowforge는 이를 생성하지 않고 소비만 한다. 큐 파일이 없으면 빈 큐(`{version:1,suggestions:[]}`)를 반환하며 404가 아니다(큐 부재=제안 없음이라는 정상 상태). 읽기는 절대 500으로 죽지 않으며(MUST NOT throw), 경로 조작은 차단한다.

각 제안(`FeatureSuggestion`)은 안정적 `id`(승인/반려 대상 지정), `nodePath`(요구사항/기능/상세기능 label 경로 — 헤더 원문 텍스트 배열), `op`("set-attrs"), 선택 `priority`(낮음|중간|높음)·`status`(시작전|진행중|완료|중단)·`rationale`를 가진다. priority/status가 둘 다 없는 제안은 무의미하므로 걸러낸다.

#### Scenario: 제안 큐가 있는 프로젝트 조회
- **WHEN** `docs/planning/features.suggestions.json`이 있는 프로젝트에 `GET /api/docs/:project/planning-features-suggestions` 요청
- **THEN** HTTP 200과 함께 `{project, queue:{version:1, suggestions:[…]}}`를 반환하고, 각 제안의 id·nodePath·op·priority/status가 그대로 실린다

#### Scenario: 제안 큐가 없는 프로젝트 조회 (빈 큐 폴백)
- **WHEN** 제안 큐 파일이 없지만 planning docs가 있는 프로젝트에 조회 요청
- **THEN** HTTP 200과 함께 `{version:1, suggestions:[]}` 빈 큐를 반환한다(404 아님)

#### Scenario: 깨진 제안 큐 JSON (안전 폴백)
- **WHEN** `features.suggestions.json`이 파싱 불가능한 내용(깨진 JSON)일 때 조회
- **THEN** throw 없이 빈 큐(`{version:1, suggestions:[]}`)를 반환한다(읽기는 절대 500으로 죽지 않는다)

#### Scenario: 경로 조작 차단
- **WHEN** project 파라미터에 `..`나 슬래시가 포함된 값으로 조회
- **THEN** `resolveDocsDir`가 null을 반환해 HTTP 404(docs_not_found)로 막고, docs 루트 밖 파일을 읽지 않는다

#### Scenario: 스키마 검증 — 미인식 op / 빈 속성 / 부정 nodePath는 걸러짐
- **WHEN** 큐에 `op`가 "set-attrs"가 아니거나, priority·status가 둘 다 없거나(무의미), nodePath가 문자열 배열이 아니거나 priority/status 값이 화이트리스트(낮음|중간|높음 / 시작전|진행중|완료|중단) 밖인 항목이 섞여 있을 때 조회
- **THEN** 유효한 제안만 반환하고 미인식 항목은 조용히 제외한다(부정 데이터가 UI로 새지 않는다)

