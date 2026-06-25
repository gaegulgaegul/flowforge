# flowforge 상주 기능명세 (spec.md)

> 상주 문서 — flowforge의 현재 기능 명세를 단일 출처로 둔다. (charter 예광탄 산출물, 2026-06-23)
> upsert 모드: 기능별 섹션을 현재 상태로 최신화. 출처: `openspec/specs/` + archive change.
> ⚠️ 예광탄 단계 — 두 capability(spec-tree-view, prd-view)만 담음. charter 스킬 정식화 전 수동 생성.

## capability: spec-tree-view

change의 capability·Requirement·Scenario를 `요구사항→기능→상세기능` 3단 트리로 펼쳐 읽기전용으로 표시한다.

### 기능: 기능명세서 3단 트리 파생 (`GET /api/changes/:id/spec-tree`)
- change의 capability→Requirement→Scenario를 3단 트리로 파생해 반환한다.
- 상세기능(Scenario) 노드는 title + WHEN/THEN 요약을 담는다.
- Scenario는 개수가 아니라 개별 노드로 펼친다.
- Scenario 없는 Requirement도 단독 노드로 처리하고 실패하지 않는다.
- 읽기전용 — 트리 편집·저장 기능 없음.
- path traversal(`..`)·존재하지 않는 id → 4xx, 디렉토리 밖 파일 안 읽음.

### 기능: 기능명세서 트리 웹 렌더
- 기능명세서 탭에서 3단 트리를 읽기전용으로 렌더한다(단별 시각 구분).
- 상세기능 노드는 Scenario title + WHEN/THEN 요약을 노출한다.

## capability: prd-view

change의 `proposal.md`+`design.md`를 manyfast 고정 5섹션으로 파생해 읽기전용 PRD로 표시한다.

### 기능: PRD 5섹션 파생 (`GET /api/changes/:id/prd`)
- proposal.md+design.md를 고정 5섹션(overview/value/target/metrics/attributes)으로 파생한다.
- 섹션 순서: 개요→핵심가치→타겟·시나리오→성공지표→속성설정.
- 섹션별 소스 매핑: 개요=proposal `## Why`+`## What Changes`, 핵심가치=proposal `## Why`+design `## Goals / Non-Goals`, 타겟=design `## Context`+`## 화면 구성 / UI`, 성공지표=design `## Risks / Trade-offs`+`## Open Questions`, 속성=proposal `## Impact`.
- 매핑 소스 헤더 없으면 빈 섹션(empty:true)으로 표면화, 내용 지어내지 않음.
- design.md 없으면 4xx 대신 PRD 반환하되 design 기반 섹션만 빈 섹션 처리.
- path traversal(`..`)·존재하지 않는 id → 4xx, 디렉토리 밖 파일 안 읽음.

### 기능: PRD 웹 렌더
- PRD 탭에서 5섹션을 고정 순서로 읽기전용 렌더한다(마크다운).
- 빈 섹션은 "해당 문서에 없음" 플레이스홀더로 시각 구분한다.

## capability: capability-change-navigation

프로젝트의 charter 뼈대(capability)에서 그 capability에 속한 change 목록으로, 다시 change의 5종 뷰로 내려가는 계층 드릴다운 네비게이션. capability↔change 연결은 디렉토리명 불변ID의 글자단위 정확 비교로만 맺는다(유사도 매칭 없음 → 거짓연결 0).

### 기능: capability 목록 파생 (`GET /api/projects/:project/capabilities`)
- assert:endpoint GET /api/projects/:project/capabilities
- assert:symbol buildCapabilityIndex
- assert:symbol parseCharterCapabilities
- 프로젝트의 `docs/spec.md` `## capability: <키>`를 capability 목록으로 파생하고, 각 capability에 연결된 change 키 목록을 함께 반환한다.
- invariant: capability↔change 연결은 change `specs/<dir>` 디렉토리명과 docs `## capability: <키>`의 글자단위 정확 비교(set 멤버십)만 사용한다. 유사도·부분일치 매칭을 쓰지 않는다.
- invariant: 어떤 capability 키와도 일치하지 않는 change는 silent drop 없이 "미연결(unlinked)"로 명시 분류한다.
- invariant: 존재하지 않는 프로젝트는 404, 존재하나 연결 change 없는 capability는 빈 배열(에러 아님)로 응답한다.
- metric: capabilityIndex.test.ts 글자단위 일치(a)·유사이름 비연결(b)·미연결 누락방지 케이스 PASS + projects.test.ts 라우트 PASS.

### 기능: capability별 change 목록 파생 (`GET /api/projects/:project/capabilities/:cap/changes`)
- assert:endpoint GET /api/projects/:project/capabilities/:cap/changes
- capability를 클릭하면 그 capability에 속한 change 목록을 반환한다. 연결 change가 0개면 빈 목록(빈 상태 표시용)을 반환한다.
- invariant: 읽기전용 — `/api/projects/:project/capabilities*`에 쓰기 메서드를 두지 않는다.

### 기능: 계층 드릴다운 + 브레드크럼 웹 렌더
- assert:symbol CapabilityChangeList
- 프로젝트 카드 → 뼈대(capability) → change 목록 → 5종 뷰의 4단 드릴다운을 제공하고, 브레드크럼으로 상위 단계 복귀를 지원한다.
- change 클릭 시 기존 5종 뷰(prd|spec|flow|ia|wire) 경로(`/api/changes/:id/{graph,ia,wireframe,prd,spec-tree}`)를 재사용한다(신규 빌더를 호출하지 않는다).
- metric: web 실픽셀 드릴다운+브레드크럼 시나리오 PASS(카드→skeleton→capChanges→views, 콘솔에러 0).

## capability: korean-display-labels

화면에 보이는 표시명만 한글로 하고, 연결·라우팅에 쓰는 키는 영문 슬러그 그대로 유지한다. 한글화가 불변 ID(연결 키)를 절대 바꾸지 않아 골든·디렉토리 매칭이 깨지지 않는다.

### 기능: capability 한글 표시명 해석
- assert:symbol capabilityLabel
- assert:symbol parseCapabilityLabels
- assert:symbol splitCapabilityLabel
- capability 한글명을 출처 우선순위로 해석한다: 출처1 `docs/spec.md`의 `## capability: 키 — 한글` 병기 → 출처2 flowforge 키→한글 맵 폴백 → 출처3 영문 슬러그 그대로.
- invariant: 한글 해석의 어느 폴백 단계에서도 연결 키(영문)를 변형하지 않는다(key 불변). 표시명은 displayName/koreanLabel 필드, 키는 name/key 필드로 분리한다.
- invariant: 슬러그 내부 하이픈(`project-card-grid`)은 병기 구분자로 오분리되지 않는다 — 공백으로 둘러싼 ` — `/` - `만 키↔라벨 구분자로 인식한다(RE_CAP_LABEL).
- metric: koreanLabels.test.ts 병기/하위호환/슬러그내하이픈 오분리방지/최종폴백(영문키 불변) 케이스 PASS.

### 기능: change 한글 표시명 해석
- assert:symbol changeLabel
- change 한글명은 출처 우선순위로 해석한다: 출처1 `proposal.md`의 사람이 쓴 한글 H1 제목 → 폴백 영문 change 키 그대로(빈 표시 금지).
- invariant: change 키(영문)는 표시명 해석과 무관하게 라우팅·연결의 불변 키로 유지한다.

## capability: project-card-grid

홈서버에서 change를 가진 모든 프로젝트를 카드 그리드로 한눈에 표시하는 랜딩. 단일 change로 곧장 진입하지 않고, 프로젝트 → (charter 뼈대) → change → 5종 뷰의 계층 진입점이 된다.

### 기능: 프로젝트 카드 그리드 파생 (`GET /api/projects`)
- assert:endpoint GET /api/projects
- assert:symbol listProjectCards
- change를 가진 모든 프로젝트를 카드로 반환한다. charter `docs/` 유무와 무관하게 노출한다.
- 각 카드는 한글 표시명·charter 유무·change 개수·audit 상태 배지를 담는다.
- invariant: 프로젝트명(name)은 라우팅·디렉토리 매칭에 쓰이는 영문 불변 키이며, 한글 표시명(displayName)과 분리 유지한다(표시명이 키를 바꾸지 않는다).
- invariant: 프로젝트명에 `..` 또는 영문·숫자·언더스코어·하이픈 외 문자가 있으면 거부한다(경로조작 차단, resolveProjectDir).
- invariant: 읽기전용 — `/api/projects`에 PUT/POST/DELETE 라우트를 두지 않는다.
- metric: server 통합/유닛 테스트 PASS(projects.test.ts 라우트 + lib/__tests__/projects.test.ts 유닛) + 실런타임 카드그리드 렌더(web 실픽셀 PASS).

### 기능: 프로젝트 카드 그리드 웹 렌더
- assert:symbol ProjectGrid
- 홈 랜딩에서 프로젝트들을 카드 그리드로 읽기전용 렌더한다(카드 클릭으로 드릴다운 진입).
- 카드 표면은 displayName(한글)을 쓰고, 카드 클릭은 charter 있으면 뼈대(capability)로·없으면 빈 안내로 분기한다.
