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

### 기능: 카드 audit 상태 = audit.json finalJudgment 매핑
- assert:symbol readAuditStatus
- assert:symbol mapFinalJudgment
- 각 프로젝트의 `<projDir>/docs/audit.json`에서 `finalJudgment`를 읽어 카드 auditStatus로 매핑한다: PASS→clean, FAIL→fail, 조건부→warn, UNVERIFIABLE·미인식·없음→unknown.
- invariant: audit.json 없음·깨진 JSON·필드 없음은 전부 `unknown` 폴백이며 카드 스캔을 중단시키지 않는다(throw 금지).
- invariant: audit.json 내부의 호스트 절대경로(scanRoot 등)는 신뢰하지 않는다 — 읽기 경로는 이미 계산된 projDir로만 구성하고 finalJudgment 필드만 소비한다.
- invariant: audit.json 산출은 openspec-audit 소유 — flowforge는 읽기전용 소비만 한다(산출·스키마 변경 없음).
- metric: 매핑·폴백 유닛 6케이스 + 라우트 통합 테스트 PASS(lib/__tests__/projects.test.ts, routes/__tests__/projects.test.ts) + 실데이터 grounding(flowforge→warn·wowa-app→fail·audit.json 없는 프로젝트→unknown).

### 기능: 프로젝트 카드 그리드 웹 렌더
- assert:symbol ProjectGrid
- 홈 랜딩에서 프로젝트들을 카드 그리드로 읽기전용 렌더한다(카드 클릭으로 드릴다운 진입).
- 카드 표면은 displayName(한글)을 쓰고, 카드 클릭은 charter 있으면 뼈대(capability)로·없으면 빈 안내로 분기한다.
## capability: docs-ingest

charter가 만든 상주 `docs/`(user-flow.md·PRD.md·wireframe.html)를 flowforge의 두 번째 입력 모드로 읽는 읽기전용 백엔드. 화면·goto를 휴리스틱으로 추론하는 대신 charter가 명시한 정답지(ground truth)를 직역해 그래프·와이어프레임·decision 타임라인으로 변환한다. 기존 change 경로(specParser/golden)는 무손상(additive).

### 기능: DOCS_ROOT 다중 docs 스캔 (`GET /api/docs/projects`)
- assert:endpoint GET /api/docs/projects
- assert:symbol listDocsProjects
- `DOCS_ROOT`(기본 cwd) 아래 1단계에서 `docs/user-flow.md` 또는 `docs/PRD.md`를 가진 프로젝트만 `{projects:string[]}`로 반환한다. docs 없으면 빈 배열 200(에러 아님).
- invariant: 스캔 깊이는 `<DOCS_ROOT>/<project>/docs/` 1단계로 한정하고 심링크는 추적하지 않는다.
- metric: docs.test.ts 스캔(픽스처 2프로젝트+docs없는 1개) PASS + 라이브 `GET /api/docs/projects` 200 실증(projects: flowforge/ssoksok/wowa-app).

### 기능: charter user-flow.md → 그래프 직역 (`GET /api/docs/:project/graph`)
- assert:endpoint GET /api/docs/:project/graph
- assert:symbol parseCharterUserFlow
- assert:symbol buildDocsGraph
- charter `user-flow.md` 라인문법(`## flow:`/`### 화면:`/`- step:`/`- goto:`)을 읽기전용 파서로 해석해 `@flowforge/shared` SpecGraph로 직역한다. 화면→`GraphNode{kind:"screen"}`, 명시 goto→`GraphEdge`, 미정의 대상 화면→`dangling:true`, `- goto:(METHOD /path)`→API 호출 엣지.
- invariant: 휴리스틱 `isScreenSpec`/`flowTarget`을 쓰지 않는다(명시 데이터만). 기존 `specParser.ts`(OpenSpec WHEN/THEN)를 개조하지 않고 charter 산출물 파일을 쓰지 않는다(읽기전용).
- invariant: docs project 식별자에 `..` 포함 또는 화이트리스트(`^[A-Za-z0-9_\-/]+$`) 위반 입력은 404로 거부해 DOCS_ROOT 밖 파일 접근을 차단한다(no-traversal).
- metric: docsAdapter/charterUserFlowParser 단위 테스트(화면→노드·goto→엣지·미정의→dangling·엔드포인트 goto 분류) + traversal 거부 테스트 PASS.

### 기능: charter user-flow.md → 와이어프레임 재렌더 (`GET /api/docs/:project/wireframe`)
- assert:endpoint GET /api/docs/:project/wireframe
- assert:symbol buildDocsWireframe
- user-flow.md를 `@flowforge/shared` Wireframe로 변환한다(화면→WireScreen, step→WireBox). boxKind는 charter `charter_wireframe.py`와 동일 키워드 규칙. `docs/wireframe.html` 존재 시 "원본 보기" 링크용 메타(originalHtml)를 포함한다.
- metric: wireframe boxKind 키워드 매핑 + 원본 HTML 메타 테스트 PASS.

### 기능: charter PRD.md → decision 타임라인 (`GET /api/docs/:project/prd`)
- assert:endpoint GET /api/docs/:project/prd
- assert:symbol buildDocsDecisionTimeline
- `docs/PRD.md`의 `## decision:` 이력을 시간순 타임라인으로 파싱한다(date/capability/why/what/success/status 보존). superseded 상태는 표시용으로 보존한다.
- invariant: change 모드의 5섹션 매핑(buildPrd)을 docs 모드에 적용하지 않는다(별도 decision 타임라인).
- metric: decision 배열 파싱 + superseded 상태 테스트 PASS.

### 기능: SEED 마킹 보존 + change 경로 하위호환
- charter docs의 SEED(사람검토 전=미검증) 마킹을 어댑터 출력에 `seed:true`로 보존하고, SEED 없는 데이터는 seed를 세팅하지 않는다(미검증 오표시 방지).
- invariant: docs 기능 추가는 additive — 기존 change 경로(`/api/projects`·`/api/changes/:id/*`)·빌더·specParser·golden test의 응답을 변경하지 않는다(SHALL NOT change). golden test 전부 통과로 보증.
- metric: SEED 플래그 세팅/미세팅 테스트 + golden test PASS(기존 change 라우트 불변), server 전체 81/81 PASS.

## capability: planning-prd-view — 기획 PRD 뷰

flowforge가 `docs/planning/prd.md`(기획 단계 산출물)를 읽어 기존 PrdPanel로 PRD 5섹션을 렌더한다. 새 PRD 파서·컴포넌트를 만들지 않고 기존 5섹션 파서와 PrdPanel을 재사용한다(그림자 아닌 실체 — proposal 변환이 아니라 planning/prd.md 원본).

### 기능: planning PRD 조회 (GET /api/docs/:project/planning-prd)
- assert:endpoint GET /api/docs/:project/planning-prd
- assert:symbol buildDocsPlanningPrd
- invariant:no-traversal resolveDocsDir이 `..` 및 비화이트리스트 project를 차단해 디렉토리 밖 파일 미접근
- invariant:safe-4xx planning/prd.md 없거나 없는 project면 500 아닌 404 반환
- invariant:readonly 읽기전용 조회 — planning PRD를 쓰거나 수정하는 라우트 없음
- behavior: planning/prd.md를 manyfast 5섹션(개요·핵심가치·타겟·시나리오·성공지표·속성설정) Prd로 파싱해 반환
- metric: planning PRD 조회 응답 시간 목표 200ms

## capability: planning-only-recognition — planning-only 프로젝트 인식

charter 산출물(`user-flow.md`/`PRD.md`) 없이 `docs/planning/prd.md`만 가진 planning-only 프로젝트도 flowforge가 docs 프로젝트로 인식한다. 인식 판정은 내부 `hasDocs` 단일 게이트로 수렴하므로 `resolveDocsDir`(단일 해석)·`listDocsProjects`(전체 스캔)가 동일 규칙을 따른다.

### 기능: planning-only 프로젝트 인식
- assert:symbol resolveDocsDir
- assert:symbol listDocsProjects
- invariant:readonly 인식은 파일 존재 확인(existsSync)뿐 — docs 모듈은 어떤 파일도 쓰거나 수정하지 않음(쓰기 라우트/함수 부재)
- invariant:no-traversal resolveDocsDir이 `..` 및 비화이트리스트 project를 차단해 디렉토리 밖 파일 미접근(인식 범위 확장과 무관하게 불변)
- behavior: hasDocs가 user-flow.md / PRD.md(charter) 또는 planning/prd.md(기획) 중 하나라도 있으면 docs 프로젝트로 인정한다. planning/prd.md OR 추가는 인식 범위를 넓힐 뿐 charter 프로젝트 인식을 보존한다.
- metric: planning-only 프로젝트 인식 후 planning PRD 조회까지 추가 지연 0(인식 게이트는 existsSync 1회)

## capability: planning-features-view — 기획 기능명세 뷰

flowforge가 `docs/planning/features.md`(기획 단계 산출물)를 읽어 전용 FeatureTree로 3단 트리(요구사항→기능→상세기능)를 파싱하고 ReactFlow로 렌더한다. change spec.md용 SpecTree와 분리한다(타입 전략 B) — features 전용 타입·빌더·렌더 컴포넌트를 두고 change spec-tree는 무수정.

### 기능: planning features 조회 (GET /api/docs/:project/planning-features)
- assert:endpoint GET /api/docs/:project/planning-features
- assert:symbol buildDocsPlanningFeatures
- invariant:no-traversal resolveDocsDir이 `..` 및 비화이트리스트 project를 차단해 디렉토리 밖 파일 미접근
- invariant:safe-4xx features.md 없거나 없는 project면 500 아닌 404 반환
- invariant:readonly 읽기전용 조회 — features.md를 쓰거나 수정하는 라우트 없음(readFileSync만)
- behavior: features.md를 헤더 레벨(##/###/####)로 3단 위계 파싱, 요구사항에 capability 키(`<!-- capability: -->`)·노드에 중요도/상태 속성을 채운 FeatureTree로 반환
- metric: planning features 조회 응답 시간 목표 200ms

### 기능: 동작 시나리오 WHEN/THEN 저작·표시 (planning-when-then-authoring)
- assert:symbol buildDocsPlanningFeatures
- behavior: features.md 노드 헤더 아래 `<!-- when: -->` `<!-- then: -->` 인라인 주석을 RE_WHEN/RE_THEN(RE_MEMO 동형)으로 파싱해 FeatureNode.when?/then?(additive 옵셔널·첫 매치·빈 값 무시)에 싣고, 상세 패널이 (when||then)일 때만 ⚡ 시나리오 섹션 렌더(지어내지 않음). 주석 부재는 필드 없음·섹션 미표시(회귀 0)
- invariant: capability/memo 주석과 네임스페이스 미충돌(접두어 명시 분리), featureTreeBuilder 내부만 수정(specParser/graphBuilder/screenRegistry 무저촉)
- metric: featureTreeBuilder 단위(양쪽·단측·부재·빈값) + verify 실픽셀(상세 패널 표시·회귀) + 라이브 API grounding PASS(2026-07-08)
## capability: planning-userflow-view — 기획 유저플로우 뷰

flowforge가 `docs/planning/user-flow/<group>-vN.md`의 Mermaid flowchart를 mermaid 라이브러리 없이 정규식으로 파싱해 공용 SpecGraph(노드+엣지)로 렌더하고, 드래그한 좌표를 `<group>-vN.overlay.json`에 저장한다(docs 첫 쓰기). SpecGraph 타입·web graphAdapter/SpecNode 4타입을 재사용한다(타입 분리 안 함). 명세 .md는 읽기만 하고, overlay JSON에만 쓴다.

### 기능: 유저플로우 그래프 조회 (GET /api/docs/:project/planning-user-flow)
- assert:endpoint GET /api/docs/:project/planning-user-flow
- assert:symbol buildDocsPlanningUserFlow
- assert:symbol listDocsUserFlows
- invariant:no-traversal resolveDocsDir이 `..` 및 비화이트리스트 project를, group/version은 파일명 화이트리스트가 차단해 디렉토리 밖 파일 미접근
- invariant:safe-4xx user-flow 파일/버전이 없으면 500 아닌 404 반환
- behavior: Mermaid flowchart 노드 모양(([..]) stadium→start, ["..."] box→screen, {"..."} diamond→action 등)·엣지(`-->`, `-->|라벨|`)를 정규식으로 파싱해 SpecGraph로 변환, 저장된 layout과 버전 목록을 함께 반환
- metric: planning user-flow 그래프 조회 응답 시간 목표 200ms

### 기능: 드래그 좌표 저장 (PUT /api/docs/:project/planning-user-flow/layout)
- assert:endpoint PUT /api/docs/:project/planning-user-flow/layout
- assert:symbol writeDocsUserFlowOverlay
- invariant:no-traversal project=resolveDocsDir, group/version=파일명 화이트리스트로 디렉토리 밖 쓰기 차단
- invariant:safe-4xx isLayoutOverlay 검증 실패(좌표 아닌 body)·토큰 부정이면 4xx 반환하고 파일 미작성
- behavior: 드래그 좌표(LayoutOverlay)를 `<group>-vN.overlay.json`에만 기록하고 명세 .md는 변경하지 않음, 재조회 시 저장 좌표가 dagre 자동배치보다 우선 적용
- metric: 좌표 저장 PUT 성공률 목표 100%(유효 body 기준)

## capability: planning-capability-detail — capability 통합 상세 뷰

capability 키 하나에 대해 그 capability의 features 서브트리(`docs/planning/features.md`에서 capability 일치 요구사항 가지만), 연결된 유저플로우 stem 목록(`> capability:` 마커 선언 flow), 그 capability를 건드리는 change 목록(역방향 인덱스 byCapability 재사용)을 한 응답으로 묶어 제공한다. flowforge 웹은 capability 클릭 시 이 셋을 한 화면에 co-locate해 렌더(change 목록 단독이 아니라 features·유저플로우와 함께). 연결은 capability 키 글자단위 정확 비교만(유사도 금지, 거짓연결 0).

### 기능: capability 종합 상세 조회 (GET /api/projects/:project/capabilities/:cap)
- assert:endpoint GET /api/projects/:project/capabilities/:cap
- assert:symbol buildCapabilityDetail
- invariant:no-traversal resolveProjectDir이 `..` 및 비화이트리스트 project를, isValidCapKey가 비화이트리스트 capability 키를 차단해 디렉토리 밖 미접근
- invariant:safe-4xx 없는 project는 404, 잘못된 capability 키는 400 — 500 아닌 4xx로 거부하고 내부 에러 미노출
- invariant:readonly 읽기전용 종합 조회 — features.md·유저플로우·change를 읽기만 함(쓰기 라우트 없음)
- behavior: features는 일치 capability 요구사항 가지만 필터, 유저플로우는 `> capability:` 마커 선언 stem만, changes는 byCapability 재사용 — 연결 0개여도 빈 구조로 200
- metric: capability 종합 상세 조회 응답 시간 목표 200ms

## capability: planning-prd-approval-apply — PRD 제안 승인/반려 적용

flowforge가 PRD 제안 큐 항목을 개별/일괄로 승인·반려하고 승인분만 `docs/planning/prd.md`에 섹션 교체 반영하는 능력. flowforge가 명세 .md에 처음 쓰는 경로 — SSOT를 "승인을 통해서만 바뀐다"로 재정의(반려=원본 불변). 조립 결과를 write 전 self-roundtrip 재파싱해 5섹션 정합이 깨지면(proposedBody의 `## ` 오분리 등) 422로 막고 원본을 보호한다.

### 기능: 승인/반려 적용 (POST /api/docs/:project/planning-prd-suggestions/apply)
- assert:endpoint POST /api/docs/:project/planning-prd-suggestions/apply
- assert:symbol applyPrdSuggestions
- assert:symbol writeDocsPlanningPrd
- assert:symbol isPrdApplyRequest
- invariant:no-traversal resolveDocsDir이 `..` 및 비화이트리스트 project를 차단해 docs 루트 밖 쓰기 미발생
- invariant:safe-4xx 잘못된 body는 400, 경로 조작은 404, prd.md 파싱실패·오분리 감지는 422로 막고 파일 미작성(원본 보호)
- behavior: approve id의 section을 proposedBody로 교체해 prd.md 원자적 재작성(H1 서문·미승인 섹션 보존) 후 큐에서 제거, reject는 반영 없이 큐에서 제거, 미실재 id는 skipped로 표면화, write 전 self-roundtrip으로 5섹션 정합 검증
- metric: 승인 반영 후 prd.md 5섹션 무결성 유지율 목표 100%

### 기능: 승인 apply 견고화 — prd (approval-family-hardening)
- assert:symbol detectEol
- assert:symbol restoreEol
- invariant: 원문 개행 스타일 보존 — CRLF 문서에 승인 반영해도 전 파일 EOL 전환이 일어나지 않는다(혼합 개행은 any-CRLF-wins 결정론).
- invariant: 큐 재작성은 쓰기 직전 재독본에서 처리 id만 차집합 — apply 진행 중 추가된 신규 제안을 통삭제하지 않는다.
- invariant: apply 배치 상한(APPLY_BATCH_CAP=200, shared 단일 정의) 초과는 400 batch_too_large, 문서·큐 무접촉. 웹은 청크 분할 전송으로 어떤 큐 크기에도 일괄 동작.
- metric: 상주 엣지 테스트(빈 문서·혼합 EOL·특수문자 id prune·non-string id 필터) + 라우트 상한 테스트 PASS.

### 기능: 승인 UI/큐 위생 (approval-ui-debt-cleanup)
- invariant: 큐 재작성(prune) write 실패는 500이 아니라 200 + `queuePruneFailed: true`로 표면화 — 문서 패치는 이미 성공했으므로 부분 상태를 은폐하지 않는다(문서 write 자체 실패는 기존대로 에러). 웹은 이 필드를 보고 "문서 반영·큐 정리 실패"를 고지.
- invariant: 큐 읽기는 중복 id를 첫 항목 승리로 제거 — 같은 id 2건 + 승인 1회가 이중 반영되지 않는다.
- metric: prune 실패 주입 테스트(200+queuePruneFailed)·중복 id dedup 테스트 PASS

### 기능: PRD 승인 위저드 (approval-wizard-mode — 목록형 패널을 대체)
- assert:symbol nextPendingId
- assert:symbol reconcileCheckpoint
- assert:symbol applyPayload
- behavior: 큐가 비어있지 않으면 위저드로 1건씩 제시(진행 n/N·결정 점·승인/반려/건너뛰기·하단 [남은 것 모두 승인/반려] 탈출구), 건너뛴 제안은 반영에서 제외되고 큐에 남아 다음 진입 때 재등장
- behavior: 결정은 클라이언트에 쌓이고 요약의 [결정 반영하기] 1회로 기존 청크 apply 경로에 전송, localStorage 체크포인트(prd-wizard:<project>)로 이탈 후 재진입 시 복원, 현재 큐에 없는 id의 결정은 폐기(stale 안전)
- invariant: 반영 실패 시 결정·체크포인트 보존(재시도 가능), 반영 성공 시에만 결정 리셋(skip 잔존 큐가 요약에 갇히지 않음) — cross-project tick 격리로 다른 프로젝트 결정 불침범
- metric: 상태 모듈 단위 테스트 16건 + verify 실픽셀 7시나리오(진입 즉시 1건·건너뛰기 잔존·탈출구·요약 1회 반영·재진입 복원·stale 폐기·실패 보존) PASS (2026-07-06)
## capability: planning-prd-approval-queue — PRD 제안 큐 읽기

flowforge가 `docs/planning/prd.suggestions.json`(AI/스킬이 쓴 PRD 갱신 제안 큐)을 읽어 반환하는 읽기전용 능력. 큐가 없으면 빈 큐(version:1, suggestions:[])를 200으로 반환하고(404 아님), 깨진 JSON·미인식 항목은 안전 폴백(빈 큐/필터)한다. flowforge는 큐를 생성하지 않고 소비만 한다(제안 생성 주체=외부 스킬).

### 기능: PRD 제안 큐 조회 (GET /api/docs/:project/planning-prd-suggestions)
- assert:endpoint GET /api/docs/:project/planning-prd-suggestions
- assert:symbol readDocsPrdSuggestions
- invariant:no-traversal resolveDocsDir이 `..` 및 비화이트리스트 project를 차단해 docs 루트 밖 파일 미접근
- invariant:safe-4xx 경로 조작 project는 404, 큐 파일 부재는 빈 큐 200(읽기는 절대 500으로 죽지 않음)
- behavior: prd.suggestions.json을 JSON.parse 후 isValidPrdSuggestion(section 5키·op=replace만)으로 필터해 유효 제안만 반환, 파일 없음·깨진 JSON은 빈 큐로 폴백
- metric: 제안 큐 조회 응답 시간 목표 200ms

## capability: planning-feature-audit-badge

기획 기능명세 뷰 요구사항 노드에 capability 단위 audit 판정 배지(정합/불합/미감사)를 표시하고, 노드 클릭 상세 패널에 audit 상세(판정·건수·FAIL claim)를 노출하는 능력. 데이터 원천은 저장된 docs/audit.json items[](읽기전용 소비), 매칭은 capability 영문 키 문자열 동치만(거짓 연결 0).

### 기능: audit capability 집계 API (`GET /api/docs/:project/audit-capabilities`)
- assert:endpoint GET /api/docs/:project/audit-capabilities
- assert:symbol aggregateAuditItems
- assert:symbol readAuditCapabilities
- audit.json items[]를 capability 키별로 집계한다: FAIL≥1→fail / FAIL 0·PASS≥1→clean / 그 외(항목 없음·전부 UNVERIFIABLE)→unknown. UNVERIFIABLE은 판정을 깎지 않고 건수로만 노출한다.
- invariant: audit.json 없음·깨진 JSON·items 비배열은 빈 맵 폴백(HTTP 200)이며 throw하지 않는다.
- invariant: audit.json 내부 경로(scanRoot 등)는 신뢰하지 않는다 — 읽기 경로는 검증된 projDir 기준으로만 구성하고 items[]의 capability·verdict·kind·claim·reason만 소비한다.
- invariant: 읽기전용 — audit.json 산출은 openspec-audit 소유, flowforge는 소비만 한다.
- metric: auditSummary 단위(집계·폴백) + 라우트 통합 테스트 PASS(auditSummary.test.ts, docs.planning.test.ts) + 라이브 실픽셀(요구사항 노드 배지·패널 audit 섹션·콘솔 0).

### 기능: 요구사항 노드 audit 배지 + 상세 패널 audit 섹션 (web)
- assert:symbol fetchAuditCapabilities
- 요구사항 노드만 capability 키 동치로 배지(clean→정합/fail→불합 N/unknown→미감사)를 렌더하고, 기능·상세기능 노드는 배지를 렌더하지 않는다. audit fetch 실패는 배지 없음 강등(그래프 렌더 유지).
- 상세 패널 audit 섹션은 판정·PASS/FAIL/검증불가 건수를 표시하고, fail일 때만 FAIL claim(·reason)을 텍스트로 나열한다(HTML 주입 금지).
- metric: 라이브 실픽셀 grounding — 배지 분포(정합/미감사)·패널 3케이스(정합 건수/미감사/비요구사항 생략)·콘솔 에러 0.

## capability: planning-panel-screen-links

기능명세 상세 패널에서 상세기능이 연결된 화면(N:M)을 표시하는 능력. 원천은 screenRegistry(features.md `<!-- screens: -->` 링크) 읽기전용 소비, 매칭은 상세기능 라벨 문자열 동치만(거짓 연결 0).

### 기능: screen registry 노출 API (`GET /api/docs/:project/planning-screens`)
- assert:endpoint GET /api/docs/:project/planning-screens
- assert:symbol fetchPlanningScreens
- 파싱된 screen registry(`{ screens, links }`)를 그대로 반환한다. `## 화면목록` 섹션이 없으면 빈 registry 200.
- invariant: 파서(screenRegistry.ts) 무수정 — 라우트는 buildScreenRegistry 결과 소비만 한다.
- invariant:safe-4xx 존재하지 않는 프로젝트·경로조작(`..`)은 404, 화면목록 부재는 빈 registry 200(읽기는 500으로 죽지 않음).
- metric: 라우트 통합 테스트 PASS(docs.planning.test.ts — registry 반환·빈 registry·404) + 라이브 재조회.

### 기능: 상세 패널 연결화면(N:M) 표시 (web)
- 상세기능 노드 라벨 ↔ `links[].detailLabel` 문자열 동치로 화면 목록(`{id,label}`)을 파생하고, 화면 label은 registry.screens에서 해석한다. dangling 화면 id는 label 대신 id로 강등 표시(숨기지 않음).
- 링크 없는 상세기능은 섹션을 생략한다(빈 섹션·placeholder 없음). registry fetch 실패는 필드 없음 강등(그래프·패널 렌더 유지).
- metric: 라이브 실픽셀 grounding — 링크 있는 상세기능 화면 나열·링크 없는 노드 섹션 생략·콘솔 에러 0.

### 기능: 화면 칩 → IA 딥링크 (panel-screen-deeplink)
- assert:symbol buildPlanningIaTreeFromRegistry
- behavior: IA 화면 노드는 서버가 실어주는 원본 screenId(additive)를 보유하고, 상세 패널 화면 칩 클릭은 그 값의 문자열 동치로만 대상 노드를 찾아 기획 IA 탭 전환+노드 상세 패널 오픈(slug 복제·퍼지 매칭 금지)
- invariant: 매칭 실패 시 탭 전환 없이 상태바 안내만 — 저작 오류(화면목록↔IA 불일치)를 숨기지 않되 화면 불파괴
- metric: planningIaBuilder screenId 단위 테스트 + 라이브 실픽셀(칩 클릭→IA 탭+노드 선택, 2026-07-07) PASS
## capability: planning-userflow-approval-edit

유저플로우 문서(docs/planning/user-flow/<stem>.md)에 대한 에지 추가 제안을 per-stem 사이드카 큐(<stem>.suggestions.json)로 받고, 승인분만 결정론 검증 + self-roundtrip 방어를 거쳐 Mermaid에 append 반영하는 능력. 반려·검증 위반은 문서를 건드리지 않는다. 기존 줄은 한 줄도 수정하지 않는다(append-only — 인라인 노드 정의 SSOT 보호).

### 기능: 제안 큐 조회 API (`GET /api/docs/:project/planning-user-flow-suggestions`)
- assert:endpoint GET /api/docs/:project/planning-user-flow-suggestions
- assert:symbol readUserFlowSuggestions
- per-stem 큐를 반환한다. 파일 부재는 빈 큐 200, 깨진 JSON·무효 제안은 필터.
- invariant:safe-4xx 존재하지 않는 프로젝트·경로조작·불안전 stem은 404, 읽기는 500으로 죽지 않는다.
- metric: userFlowDocs 단위 + 라우트 통합 테스트 PASS.

### 기능: 승인 apply API (`POST .../planning-user-flow-suggestions/apply`)
- assert:endpoint POST /api/docs/:project/planning-user-flow-suggestions/apply
- assert:symbol applyUserFlowSuggestions
- assert:symbol userFlowInvariantHolds
- 승인분만 첫 mermaid 블록 닫는 펜스 직전에 에지 줄 append. 계약은 6a/6b의 PrdApplyRequest/PrdApplyResult 재사용.
- invariant: 결정론 검증(from/to 존재·newNode id 충돌·라벨 금지문자·중복 에지 멱등) 위반은 해당 제안만 skipped로 사유와 함께 표면화 — 배치 전체를 죽이지 않는다(제안별 사전 roundtrip 포함).
- invariant: self-roundtrip 방어 — append 후 재파싱해 기존 노드·에지 완전 보존 + 승인분 에지만 정확히 추가됐을 때만 write, 위반 시 422·원본 보존·큐 유지(무력화 프로브 테스트 존치).
- invariant: 반려는 문서 바이트 불변, 큐에서만 제거.
- metric: 단위(검증·append·방어·무력화 프로브) + 통합 테스트 PASS + 실픽셀 grounding(개별 승인=1줄 append·반려=문서 불변).

### 기능: 유저플로우 탭 승인 위저드 (web — approval-wizard-extension이 목록형 패널 대체)
- assert:symbol UserFlowApprovalWizard
- assert:symbol fetchUserFlowSuggestions
- 큐가 비어있지 않으면 그래프 위에 위저드(에지 카드 from→to·실선/점선·라벨·rationale·신규 화면 뱃지 1건씩)를 렌더, 빈 큐면 미렌더. 반영 성공 후 그래프·큐 재조회.
- invariant: stem 전환·apply 재조회는 dashReqToken race 가드를 지킨다(stale 응답이 화면을 덮지 않는다).
- metric: 실픽셀 grounding — 카드 렌더·개별/일괄 승인·반려·빈 큐 패널 소멸·콘솔 에러 0.

### 기능: 승인 apply 견고화 — userflow (approval-family-hardening)
- assert:symbol detectEol
- assert:symbol restoreEol
- invariant: 원문 개행 스타일 보존 — CRLF 문서에 승인 반영해도 전 파일 EOL 전환이 일어나지 않는다(혼합 개행은 any-CRLF-wins 결정론).
- invariant: 큐 재작성은 쓰기 직전 재독본에서 처리 id만 차집합 — apply 진행 중 추가된 신규 제안을 통삭제하지 않는다.
- invariant: apply 배치 상한(APPLY_BATCH_CAP=200, shared 단일 정의) 초과는 400 batch_too_large, 문서·큐 무접촉. 웹은 청크 분할 전송으로 어떤 큐 크기에도 일괄 동작.
- metric: 상주 엣지 테스트(빈 문서·혼합 EOL·특수문자 id prune·non-string id 필터) + 라우트 상한 테스트 PASS.
- assert:symbol findFirstMermaidBlock
- invariant: append 위치와 재파싱이 같은 mermaid 블록을 본다(블록 판별을 파서 한 곳으로 단일화 — mermaid-example 선행 문서 오도 skipped 해소).

### 기능: 승인 UI/큐 위생 (approval-ui-debt-cleanup)
- invariant: 큐 재작성(prune) write 실패는 500이 아니라 200 + `queuePruneFailed: true`로 표면화 — 승인분이 큐에 고아로 남아 재승인이 duplicate-edge로 영문 없이 skipped되는 경로를 고지로 막는다(문서 write 자체 실패는 기존대로 에러).
- invariant: 큐 읽기는 중복 id를 첫 항목 승리로 제거 — 같은 id 2건 + 승인 1회에 에지가 2줄 append되지 않는다.
- behavior: skip 사유 단언은 정확한 `"<id>: <reason>"` 문자열 매칭으로 테스트에 박제 — 사유 회귀가 조용히 통과하지 못한다
- metric: prune 실패 주입(200+queuePruneFailed)·중복 id=에지 1줄·사유 정확 단언 테스트 PASS

### 기능: 승인 위저드 (approval-wizard-extension — 목록형 패널을 대체, 공용 셸)
- behavior: 큐가 비어있지 않으면 위저드로 1건씩 제시(진행 n/N·결정 점·승인/반려/건너뛰기·[남은 것 모두 승인/반려] 탈출구), 건너뛴 제안은 반영 제외·큐 잔존·다음 진입 때 재등장, 요약 [결정 반영하기] 1회로 기존 청크 apply 경로 호출
- behavior: 결정은 localStorage 체크포인트(uflow-wizard:<project>:<stem>)로 이탈을 견디고, 현재 큐에 없는 id·비열거형 결정값은 폐기, 반영 실패=결정 보존·성공=리셋, 프로젝트·stem(버전) 간 격리
- metric: verify 실픽셀 시나리오 + 공용 상태 모듈(wizard-state) 단위 테스트 16 PASS (2026-07-07)
## capability: planning-features-approval-apply — 기능명세 속성 제안 승인/반려 적용

flowforge가 기능명세 제안 큐(features.suggestions.json) 항목을 개별/일괄로 승인·반려하고, 승인분만 docs/planning/features.md의 해당 노드 속성 줄(중요도·상태)을 제자리 교체 반영하는 능력(6b-features). 반려는 원본 불변. write 전 재파싱 fingerprint(노드 수·capability 키 집합) 비교로 구조 불변을 검증하고 위반 시 422로 원본을 보호한다.

### 기능: 승인/반려 적용 (POST /api/docs/:project/planning-features-suggestions/apply)
- assert:endpoint POST /api/docs/:project/planning-features-suggestions/apply
- assert:symbol applyFeatureSuggestions
- assert:symbol structureInvariantHolds
- invariant:safe-4xx 잘못된 body 400, 경로조작 404, 구조 불변 위반은 422로 막고 파일 미작성(원본 보호 — 무력화 프로브 테스트 존치).
- invariant: 동일 label 형제 모호성·미실재 id는 skipped로 표면화(silent drop 금지).
- behavior: 승인 노드의 속성 줄만 제자리 교체(라벨·본문·자식 불변), 반려는 큐에서만 제거.
- metric: featureDocs 단위 + 라우트 통합 테스트 PASS + 실픽셀 grounding(승인 반영·반려 불변).

### 기능: 승인 apply 견고화 — features (approval-family-hardening)
- assert:symbol detectEol
- assert:symbol restoreEol
- invariant: 원문 개행 스타일 보존 — CRLF 문서에 승인 반영해도 전 파일 EOL 전환이 일어나지 않는다(혼합 개행은 any-CRLF-wins 결정론).
- invariant: 큐 재작성은 쓰기 직전 재독본에서 처리 id만 차집합 — apply 진행 중 추가된 신규 제안을 통삭제하지 않는다.
- invariant: apply 배치 상한(APPLY_BATCH_CAP=200, shared 단일 정의) 초과는 400 batch_too_large, 문서·큐 무접촉. 웹은 청크 분할 전송으로 어떤 큐 크기에도 일괄 동작.
- metric: 상주 엣지 테스트(빈 문서·혼합 EOL·특수문자 id prune·non-string id 필터) + 라우트 상한 테스트 PASS.

### 기능: 승인 UI/큐 위생 (approval-ui-debt-cleanup)
- invariant: 큐 재작성(prune) write 실패는 500이 아니라 200 + `queuePruneFailed: true`로 표면화 — 부분 상태(문서 반영·큐 정리 실패)를 은폐하지 않는다(문서 write 자체 실패는 기존대로 에러).
- invariant: 큐 읽기는 중복 id를 첫 항목 승리로 제거 — 같은 id 2건 + 승인 1회가 이중 반영되지 않는다.
- metric: prune 실패 주입(200+queuePruneFailed)·중복 id dedup 테스트 PASS

### 기능: 승인 위저드 (approval-wizard-extension — 목록형 패널을 대체, 공용 셸)
- behavior: 큐가 비어있지 않으면 위저드로 1건씩 제시(진행 n/N·결정 점·승인/반려/건너뛰기·[남은 것 모두 승인/반려] 탈출구), 건너뛴 제안은 반영 제외·큐 잔존·다음 진입 때 재등장, 요약 [결정 반영하기] 1회로 기존 청크 apply 경로 호출
- behavior: 결정은 localStorage 체크포인트(features-wizard:<project>)로 이탈을 견디고, 현재 큐에 없는 id·비열거형 결정값은 폐기, 반영 실패=결정 보존·성공=리셋, 프로젝트 간 격리
- metric: verify 실픽셀 시나리오 + 공용 상태 모듈(wizard-state) 단위 테스트 16 PASS (2026-07-07)

## capability: cross-project-change-views — 타 프로젝트 change 5종 뷰 해석

프로젝트 카드 드릴다운으로 진입한 change의 5종 뷰(graph·ia·wireframe·prd·spec-tree)와 layout 저장을 그 프로젝트의 openspec/changes 하위에서 해석하는 능력. `?project=` 부재 시 글로벌 루트(하위호환 100%). 기획문서 없는 프로젝트는 skeleton에 change 목록(capability별)을 조건부 노출해 진입로를 보장한다.

### 기능: 프로젝트 컨텍스트 change 해석 (GET /api/changes/:id/* ?project=)
- assert:symbol resolveChangeDir
- assert:symbol resolveProjectDir
- invariant:no-traversal project는 화이트리스트 정규식(영숫자·하이픈·언더스코어)만 통과 — dotfile(.ssh)·유니코드·공백·`..`은 404, 루트 밖 파일시스템 접근 없음
- invariant:safe-4xx 미지·조작 프로젝트는 404(존재 오라클 최소화), change 부재도 404 — 5xx로 새지 않음
- behavior: ?project= 있으면 그 프로젝트 openspec/changes에서 change를 해석하고, 없으면 기존 글로벌 루트 동작 그대로(하위호환). web은 카드 드릴다운의 project를 5종 fetch+layout 저장에 부착(withProject)
- metric: 라우트 통합 테스트(2프로젝트 픽스처 200·미지정 불변·dotfile/조작 404) + 라이브 실측(wowa change 뷰 200·.ssh 프로빙 404, 2026-07-07) PASS

## capability: api-write-auth — 쓰기 라우트 2차 인증 게이트

flowforge 쓰기 라우트(승인 apply 3종 + layout 저장 2종)에 origin측 2차 인증을 강제하는 능력. env 미설정 시 현행 개발 모드(무손상), 프로덕션 env 주입 시 강제. 엣지(CF Zero Trust) 1차 방어는 별도 인프라(docs/EDGE_AUTH.md).

### 기능: 쓰기 게이트 미들웨어 (requireWriteAuth)
- assert:symbol requireWriteAuth
- assert:symbol verifyCfAccessJwt
- assert:symbol cfAccessConfig
- invariant:safe-4xx 게이트 활성 시 무자격 쓰기(layout PUT 2종·apply POST 3종)는 401 `{error:"unauthorized"}`(내부 사유 미노출), 미들웨어가 핸들러 앞이라 대상 파일·큐 불변
- invariant: CF Access JWT는 RS256 서명(alg 핀=none/confusion 차단)·aud(배열 포함)·iss·exp/nbf(±60s skew)·email claim 필수(service token 거부)를 전부 검증, 실패는 fail-closed null. 서명 먼저 검증 후 claims(위조 서명이 claims 미도달)
- invariant: 토큰 폴백은 timingSafeEqual 상수시간 비교(길이 불일치도 상수시간 경로 — 길이 오라클 차단)
- behavior: 게이트 판정=(CF Access JWT 풀검증 통과) OR (Bearer가 FLOWFORGE_WRITE_TOKEN 상수시간 일치). 두 env(AUD+TEAM_DOMAIN, WRITE_TOKEN) 모두 부재면 통과(개발 모드). GET 라우트는 게이트 밖(엣지 소관). node:crypto만 사용(신규 npm 의존성 0)
- metric: cfAccess 단위 테스트(RSA 픽스처: 유효·위조·만료·nbf·aud불일치·email부재·JWKS캐시/회전) + 게이트 통합 + 격리 서버 실동작(무자격 5종 401·토큰 200·GET 200·dev모드) PASS(2026-07-08). CF JWT 라이브 실증은 CF Zero Trust 등록 후 별도(인프라 후속)

### 기능: CORS 화이트리스트 (corsMiddleware)
- assert:symbol corsMiddleware
- assert:symbol parseCorsOrigins
- invariant: 와일드카드 CORS 미방출 — FLOWFORGE_CORS_ORIGIN 미설정 시 미들웨어 미부착(Access-Control-Allow-Origin 헤더 없음), `*` 입력조차 화이트리스트에서 제거
- metric: 격리 서버 실측 — 임의 Origin에 CORS 헤더 부재 확인(2026-07-08)
