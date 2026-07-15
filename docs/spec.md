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

## capability: planning-features-approval-queue — 기능명세 속성 제안 큐 읽기

flowforge가 `docs/planning/features.suggestions.json`(AI/스킬이 쓴 기능명세 노드 속성 변경 제안 큐)을 읽어 반환하는 읽기전용 능력. 큐가 없으면 빈 큐(version:1, suggestions:[])를 200으로 반환하고(404 아님), 깨진 JSON·미인식 항목은 안전 폴백(빈 큐/필터)한다. flowforge는 큐를 생성하지 않고 소비만 한다(제안 생성 주체=외부 스킬).

### 기능: 기능명세 제안 큐 조회 (GET /api/docs/:project/planning-features-suggestions)
- assert:endpoint GET /api/docs/:project/planning-features-suggestions
- assert:symbol readDocsFeatureSuggestions
- invariant:no-traversal resolveDocsDir이 `..` 및 비화이트리스트 project를 차단해 docs 루트 밖 파일 미접근
- invariant:safe-4xx 경로 조작 project는 404, 큐 파일 부재는 빈 큐 200(읽기는 절대 500으로 죽지 않음)
- behavior: features.suggestions.json을 JSON.parse 후 op="set-attrs"·nodePath=string[]·priority/status 어휘(낮음|중간|높음 / 시작전|진행중|완료|중단) 검증으로 필터해 유효 제안만 반환, priority·status 둘 다 없는 무의미 제안은 제외, id 중복은 first-occurrence-wins dedup, 파일 없음·깨진 JSON은 빈 큐로 폴백
- metric: 제안 큐 조회 응답 시간 목표 200ms

## capability: planning-prd-generation — 기획 PRD 생성 (openspec-plan 스킬)

openspec-plan 스킬이 기획 단계 산출물 중 PRD를 사용자 입력으로부터 생성해 대상 프로젝트의 `docs/planning/prd.md`에 쓴다(예광탄 슬라이스 — PRD 생성만, 기능명세/유저플로우/와이어는 후속 change). 생성 주체는 flowforge가 아니라 스킬이므로 flowforge 코드엔 생성 라우트/심볼이 없다(flowforge는 생성된 산출물을 읽어 표시·승인만 한다). audit assert 대상 없음 — 요구사항을 behavior/metric으로만 기술한다.

### 기능: PRD 5섹션 고정 스키마 생성
- behavior: openspec-plan이 사용자 입력으로부터 PRD를 만들어 `docs/planning/prd.md`에 쓰고, manyfast 원형 5섹션(`## 개요`·`## 핵심가치`·`## 타겟·시나리오`·`## 성공지표`·`## 속성설정`)을 이 순서·이 제목 고정으로 둔다
- behavior: 입력에 근거가 없는 섹션은 그럴듯하게 지어내지 않고 비어있음을 표면화한다(빈 섹션 또는 "(미정)" 표기)
- behavior: PRD는 신규 디렉토리 `docs/planning/`에만 쓰고 기존 charter 상주문서(`docs/spec.md`·`docs/PRD.md`)를 수정·덮어쓰지 않는다
- metric: 생성된 prd.md에 고정 5섹션이 지정 순서로 존재(flowforge planning-prd-view가 이 5섹션을 파싱해 렌더 가능)

## capability: planning-features-generation — 기획 기능명세 생성 (openspec-plan 스킬)

openspec-plan 스킬이 PRD 생성 다음 단계에서 `docs/planning/features.md`를 manyfast식 3단 트리 기능명세서로 생성한다(기획↔구현 매핑의 출발점 — 요구사항별 capability 키). 생성 주체는 flowforge가 아니라 스킬이므로 flowforge 코드엔 생성 라우트/심볼이 없다(flowforge는 생성된 features.md를 읽어 트리로 렌더·승인만 한다 — planning-features-view 참조). audit assert 대상 없음 — behavior/metric으로만 기술한다.

### 기능: features.md를 의존성 순서로 3단 트리 스키마 생성
- behavior: openspec-plan은 PRD(`docs/planning/prd.md`)가 있는 상태에서만 features.md를 생성하고, PRD 없이 features 단독 생성을 하지 않는다(manyfast 순차 게이트). PRD의 개요·핵심가치를 입력 맥락으로 요구사항을 도출한다
- behavior: 생성된 features.md는 3단 위계(요구사항 `## ` → 기능 `### ` → 상세기능 `#### `)를 따르고, 각 요구사항 헤더 직후 줄에 capability 키 주석 `<!-- capability: <영문키> -->`를 둔다(kebab-case, change의 `specs/<키>/` 디렉토리명과 일치 가능)
- behavior: 각 노드(요구사항/기능/상세기능)에 중요도(낮음|중간|높음)·상태(시작전|진행중|완료|중단) 속성을 헤더 끝 또는 직후 줄에 표기한다
- metric: 생성된 features.md가 flowforge planning-features-view의 FeatureTree 파서로 3단 트리+capability 키+속성으로 파싱 가능

## capability: planning-userflow-generation — 기획 유저플로우 생성 (openspec-plan 스킬)

openspec-plan 스킬이 기능명세 다음 단계에서 `docs/planning/user-flow/<group>-vN.md`를 Mermaid flowchart 명세로 생성한다(화면 흐름을 그래프로 표현). 기능명세에 기능이 ≥1 있어야 진행하는 manyfast 순차 게이트의 다음 단계다. 생성 주체는 flowforge가 아니라 스킬이므로 flowforge 코드엔 생성 라우트/심볼이 없다(flowforge는 생성된 .md를 읽어 SpecGraph로 렌더·좌표 저장만 한다 — planning-userflow-view 참조). audit assert 대상 없음 — behavior/metric으로만 기술한다.

### 기능: 유저플로우를 의존성 순서로 Mermaid flowchart 생성
- behavior: openspec-plan은 기능명세(`docs/planning/features.md`)에 기능이 1개 이상 있는 상태에서만 유저플로우를 생성하고, 기능명세 없이 단독 생성을 하지 않는다(manyfast 순차 게이트). 새 목적(흐름)은 새 group, 수정은 같은 group의 새 버전(`-vN`)으로 폴더 누적한다
- behavior: 생성된 `<group>-vN.md`는 mermaid 코드블록 안에 `flowchart TD`(또는 LR) 방향 선언과 노드·엣지를 담고, 노드는 흐름 4타입(시작=`([..])` stadium, 페이지=`["..."]` box, 행동=`{"..."}` diamond 등)을 Mermaid 노드 모양으로 구분한다
- behavior: 엣지는 `A --> B`(이동) 또는 `A -->|라벨| B`(라벨 이동)로 흐름을 표현한다
- metric: 생성된 user-flow .md가 flowforge planning-userflow-view의 정규식 파서로 SpecGraph(노드+엣지)로 변환 가능

## capability: planning-wireframe-device — 디바이스 프레임 와이어 렌더

flowforge 기획 와이어를 디바이스 프레임(데스크탑/모바일) 안에 화면 레이아웃을 배치 렌더하는 능력(manyfast식 로우피델리티). 요소를 세로 목록이 아니라 실제 화면처럼 배치한다. 이 단계 원천=픽스처(사람 저작 없음, AI 생성은 후속). 폐기된 element 세로박스 접근을 대체한다.

### 기능: WireScreen2 레이아웃 제공 (GET /api/docs/:project/planning-wireframe)
- assert:endpoint GET /api/docs/:project/planning-wireframe
- assert:symbol buildDocsPlanningWireframe2
- invariant:readonly 레이아웃은 고정 픽스처 반환(docsDir는 프로젝트 정합용, 데이터는 프로젝트 무관)·features.md 쓰기 없음
- invariant:no-traversal resolveDocsDir이 `..`·비화이트리스트 project 차단
- behavior: WireScreen2[]{id, title, device(desktop|mobile), regions(topbar/sidebar/bottombar/body), body.layout(grid|stack|tree|form), 요소 kind/label/goto} 반환. 모바일 요소 goto는 모바일 화면을 가리켜 디바이스 흐름 유지(프레임이 데스크탑으로 튀지 않음)
- metric: 픽스처 단위 테스트(디바이스별 영역·모바일 goto 무결·layout 다양성) + 라이브 실픽셀(데스크탑 상단/사이드/본문 배치·모바일 하단바·요소 클릭 디바이스 흐름 유지, 목업 대조) PASS(2026-07-08)

### 기능: 디바이스 프레임 렌더러 (web WireframeDeviceFrame)
- assert:symbol WireframeDeviceFrame
- behavior: 데스크탑=브라우저 크롬+상단 메뉴+사이드+본문(grid/stack/tree/form), 모바일=폰 프레임+상단 타이틀+본문+하단 메뉴바. 회색조 로우피델리티, 요소 goto 클릭 이동, 디바이스 토글·화면 목록. 기존 WireframePanel(change 경로)과 병존(golden·change 와이어 무저촉)
- metric: 라이브 실픽셀 grounding — 목업(wireframe-mockup-deploy)과 시각 대조로 "세로 목록 아님·화면 배치 맞음" 확인

## capability: flowforge-change-entry

skeleton 단계에서 change 목록(capability별)을 프로젝트의 기획문서(docs/planning/) 유무와 무관하게 항상 노출한다. 이전 `planTabsAvail.length === 0` 게이트가 기획문서 있는 프로젝트에서 change 5종 뷰 진입로를 통째로 숨기던 부작용을 제거했다. change 목록에서 capability→change→5종 뷰로 내려가는 진입 경로는 기존 openCapability→openChangeViews 흐름을 재사용한다.

### 기능: change 목록 무조건 렌더 (기획문서 유무 무관)
- change 목록 블록(`<section class="dash-changes-section">` — h3 + capability별 `dash-cap` 버튼)은 skeleton 단계에서 게이트 없이 항상 렌더된다. `planTabsAvail`(기획문서 존재 배열)이 change 목록 노출을 막지 않는다.
- invariant: 기획문서 존재 배열(planTabsAvail)이 change 목록 노출을 막지 않는다(게이트 없이 항상 렌더).
- invariant: 기획문서 있는 프로젝트는 기획 탭 바(`planTabsAvail.length > 0`)와 change 목록이 형제로 병존 렌더된다.
- invariant: 기획문서 없는 프로젝트는 `planTabsAvail.length === 0`이라 기획 탭/섹션은 안 뜨고 change 목록만 렌더된다(게이트 제거 전과 픽셀 동일 — 회귀 없음).
- invariant: 그래프 탭(dash-body--wide, overflow:hidden)에서도 change 목록 section이 `flex:0 0 auto`+`max-height:40vh`+`overflow-y:auto`로 그래프 캔버스(min-height:480px)에 덮이지 않고 독립 스크롤로 전 항목 도달된다. 그래프 section은 overflow:hidden으로 change 영역을 침범하지 않는다.
- metric: gstack 라이브 실픽셀 — flowforge(기획문서 있음) PRD 탭·그래프 탭(기능명세/유저플로우) 모두 기획 탭+change 목록 병존 확인, agentic-harness(기획문서 없음) change 목록만 노출 무회귀 확인 PASS.

### 기능: change 목록에서 5종 뷰 진입
- change 목록의 capability 버튼 클릭 시 `openCapability`가 그 capability의 change 상세(capChanges)로 이동하고, change 클릭 시 `openChangeViews`가 5종 뷰(views) + PRD 탭 활성으로 진입한다.
- invariant: capability 클릭→capChanges 이동, change 클릭→views+PRD 탭 활성 흐름(openCapability→openChangeViews)이 신규 데이터·라우트 없이 재사용된다.
- invariant: 진입 경로는 신규 데이터·라우트 없이 기존 openCapability→capChanges→openChangeViews→views 흐름을 재사용한다.
- metric: gstack 라이브 — capability 클릭→capChanges 이동, change 클릭→views+PRD 탭 활성(change 있는 capability는 wowa-app로 실증) PASS.

### 기능: change·capability 부재의 안전 표면화
- change나 capability가 없어도 빈 화면 대신 상태를 명시 표면화한다.
- invariant: capability 0개 프로젝트는 "표시할 capability가 없습니다" 안내를 change 목록 자리에 노출한다.
- invariant: change 0개 capability는 "change 0개"로 표기되고, 클릭 시 빈 상세로 진입하되 오류 없이 처리된다.
- metric: gstack 라이브 — capability 0개(agentic-harness) 안내 노출, change 0개 capability 표기·빈 상세 안전 처리 확인 PASS.

## capability: flowforge-change-node-mapping — 노드에 연관 change in-place 매핑

기획 기능명세·화면 구조(IA) 트리의 노드에 그 노드 capability와 연관된 change만 in-place로 매핑(배지)하고, 배지 항목 클릭 시 그 change의 5종 뷰로 진입시키는 능력. 매핑은 charter(docs/spec.md) capability ∩ change의 specs/<dir> 조인으로 파생하며, 요구사항 노드는 서버 파생, 하위 기능·상세기능은 상속, 화면 노드는 상세기능↔화면 링크 역경유로 파생한다. 표시·진입만 하는 읽기전용(노드에서 change 편집·추가·삭제 UI 없음).

### 기능: 요구사항 노드 연관 change 파생 API (`GET /api/docs/:project/planning-features`)
- assert:endpoint GET /api/docs/:project/planning-features
- assert:symbol attachLinkedChanges
- assert:symbol buildCapabilityIndex
- 요구사항 노드에 그 capability의 연관 change(byCapability 조회)를 linkedChanges로 부여한다. 연관 change 0개면 필드 미부착(빈 배열이 아니라 undefined — 비파괴 옵셔널).
- 기능·빈 capability 노드·가상 루트엔 미부착한다(요구사항+capability 있고 연관 change>0일 때만).
- invariant:readonly 표시·진입만 — 노드에서 change를 편집·추가·삭제하지 않는다(쓰기 라우트 없음).
- invariant: null 트리·capability 없음·changesRoot 부재·readdirSync 실패는 크래시 없이 빈 처리한다(early return·try/catch).
- behavior: capability→change 매핑을 노드 트리에 파생 부여한다(요구사항 부여·하위 상속·화면 역경유 합집합·연관 0개 빈 처리).
- metric: server Jest 파생 테스트 4건 PASS(capabilityIndex.test.ts) + 라이브 실픽셀(요구사항 노드 change 배지·미표시 대비·콘솔 0).

### 기능: 하위 노드 상속 + 화면 역경유 파생 (web adapter)
- featureTreeAdapter가 각 요구사항의 linkedChanges를 그 서브트리(자신·기능·상세기능) 전체에 상속한다(linkedChangesById 맵, 조건부 부착).
- iaAdapter가 화면 id→연결 상세기능→상위 요구사항 linkedChanges를 역경유해 화면 노드에 합집합(중복 제거)으로 부착한다(toIAFlow의 changeMapping 옵션, 화면 노드에만).
- behavior: 상세기능은 상위 capability change와 연결 화면 change의 합집합을 표시한다(중복 제거).
- metric: 라이브 실픽셀 grounding — 서브트리 상속 4노드 배지(DOM .feature-tree-change=4, 클리핑 0) + IA 화면 노드 배지(기능명세 화면·기획 뷰) + 미연관 노드 미표시.

### 기능: 노드 change 배지 + 상세 패널 진입 (web 렌더)
- assert:symbol FeatureDetailPanel
- FeatureNode·IANode는 linkedChanges.length>0인 노드에만 "change N" 배지(span)를 렌더한다(클릭 액션 없음, 표시 신호만). 연관 0개면 미표시.
- FeatureDetailPanel·IADetailPanel의 "연관 change" 섹션은 각 change를 button으로 렌더하고, 클릭 시 onOpenChange로 그 change의 5종 뷰(PRD 탭)에 진입한다(openChangeViews 재사용, 딥링크 URL 기록).
- invariant:readonly 배지·섹션은 표시·진입만 — 편집·추가·삭제 UI 없음.
- behavior: 전역 change 목록(dash-changes-section)은 렌더하지 않는다(연관 매핑으로 대체).
- metric: 라이브 실픽셀 grounding — 배지 클릭 후 상세 패널→5종 뷰 PRD 탭 진입+딥링크 URL(?project=&change=&tab=prd)+패널 닫힘, 전역 목록 DOM 부재, 콘솔 에러 0.

## capability: flowforge-wireframe-html-contract — WireDoc HTML 계약

harness(외부 openspec-plan 계열 스킬)가 flowforge에 넘길 화면별 HTML 산출물의 데이터 계약이다. 화면 하나 = 자족적 HTML 문서(id·title·device·html)이며, 자산은 인라인/data URI로 임베드하고 외부 호스트 참조·부모 오리진 통신·top-level navigation을 전제하지 않는다(sandbox·CSP가 거부). **생성 주체는 flowforge 밖(스킬)이고 flowforge 서버는 LLM을 호출하지 않는다**(읽기 거울). 따라서 flowforge의 책임은 생성이 아니라 **스키마 가드로 계약을 검증**하고, 위반·손상 문서를 안전 폴백/거부하는 것이다.

### 기능: WireDoc 스키마 가드 (`isValidWireDoc`)
- assert:symbol isValidWireDoc
- assert:symbol WireDoc
- `isValidWireDoc(v)`가 원천 read 시 각 화면 항목이 계약 스키마(id·title은 string, device는 `'desktop'|'mobile'`, html은 string)를 만족하는지 검증하는 타입가드다. 배열 read 경로는 `parsed.every(isValidWireDoc)`로 전량 검증하고, 하나라도 위반하면 null 반환(안전 폴백)해 렌더가 죽지 않게 한다. `WireDoc` 타입(shared)이 이 계약의 단일 원천이며, 서버·web·테스트가 같은 스키마를 공유한다.
- invariant: 생성 주체는 flowforge 밖 — flowforge 서버 코드에 LLM/생성 호출(`*Client` 등)이 없고, 와이어 원천은 스킬이 전달한 HTML 문서다. flowforge는 스키마 가드로 검증만 한다.
- invariant: 계약(자족성·화면 id 정합)을 위반하거나 손상된 문서가 와도 격리(sandbox + 헤더 CSP)는 항상 유지하고, 검증 실패 문서는 안전 폴백(필터/거부)으로 처리한다 — 보안 우선.
- metric: wireDocs.test.ts("isValidWireDoc (화면별 HTML 문서 스키마 가드)": 정상 통과·html 타입오류/누락·id/title 타입오류 거부) PASS + 외부 호스트 참조 문서가 렌더 시 CSP로 차단됨(외부 로드 0) 실측.

## capability: flowforge-wireframe-html-render — 와이어 HTML 문서 렌더

와이어 뷰를 좌표 없는 요소 박스(폐기된 `WireScreen2` elements)가 아니라 **화면별 실 HTML 문서**로 렌더한다(BREAKING). 각 화면은 자족적 HTML 문서(id·title·device·html)이며, sandbox iframe의 `src`(서버 라우트)로 로드해 실제 마크업·폼·입력이 동작하도록 렌더한다. flowforge 서버는 LLM을 호출하지 않고(읽기 거울), 승인분 HTML 원천이 있으면 그것을, 없거나 깨졌으면 픽스처/빈 상태로 안전 폴백한다.

### 기능: 화면별 HTML 문서 목록 (`GET /api/docs/:project/planning-wireframe`)
- assert:endpoint GET /api/docs/:project/planning-wireframe
- assert:symbol buildDocsPlanningWireframe2
- `buildDocsPlanningWireframe2(dir)`가 승인분 HTML 원천(없으면 픽스처 폴백)에서 화면별 문서 `WireDoc[]`를 만들어 `{project, screens}`로 반환한다. 각 화면은 좌표 없는 요소 배열이 아니라 id·title·device·html(문서 문자열)을 담는다(새 계약, 이전 요소 배열 스키마와 BREAKING). docs 미존재 project는 404(docs_not_found).
- invariant: 렌더 원천은 화면별 HTML 문서다 — 승인분 원천이 없거나 JSON이 깨져도 렌더는 throw하지 않고 빈 상태(또는 최소 폴백 문서)로 안전 처리한다.
- metric: wireDocs.test.ts(buildDocsPlanningWireframe2 계약·안전 폴백) + docsWireDoc.test.ts(라우트 응답) PASS + 라이브 와이어 뷰 실픽셀 실증.

### 기능: 화면 HTML 문서 서빙 (`GET /api/docs/:project/planning-wireframe/:screenId/doc`)
- assert:endpoint GET /api/docs/:project/planning-wireframe/:screenId/doc
- assert:symbol buildDocsPlanningWireframe2
- iframe이 srcdoc이 아니라 src로 로드하도록, screenId에 매칭되는 승인분 화면 문서 HTML을 `text/html`로 **무변형** 서빙한다(미매칭=404 wire_doc_not_found). CSP는 문서 내용과 무관하게 응답 헤더로 강제하므로 적대적 HTML의 meta 주입 우회를 원천 제거한다(상세는 flowforge-wireframe-sandbox-security).
- invariant: 문서 HTML은 서버가 파싱·변형하지 않고 그대로 서빙한다 — 격리는 응답 헤더 CSP + sandbox iframe이 담당하고, 문서 자체는 헤더를 바꿀 수 없다.
- metric: docsWireDoc.test.ts("200 text/html + WIRE_DOC_CSP 헤더 + 본문 무변형", 미매칭 404) PASS.

### 기능: 디바이스 프레임 안 iframe 렌더 (web `WireframeDeviceFrame`)
- assert:symbol WireframeDeviceFrame
- assert:symbol buildDocsPlanningWireframe2
- `WireframeDeviceFrame`가 데스크탑(브라우저 크롬)·모바일(폰 프레임) 프레임 셸과 화면 탭·디바이스 토글은 유지하되, 프레임 본문을 화면 HTML 문서 iframe(`<iframe src sandbox=...>`)으로 채운다. 폐기된 `WireScreen2` 요소 박스 렌더러(`wf-df-el--*`)는 planning 와이어 경로에서 제거됐고, iframe HTML 렌더러가 원천이다. 핀 피드백 오버레이는 iframe **위** 레이어에 위치하고 좌표(xPct/yPct)는 iframe 표면 바운딩 박스 기준으로 계산한다(sandbox 내부 DOM 접근 불가).
- invariant: 게으름 위계 — 디바이스 프레임 크롬(토글·탭)은 재사용하고 본문만 iframe로 교체한다(프레임 셸 재작성 금지).
- metric: WireframeDeviceFrame 컴포넌트가 `sandbox={WIRE_IFRAME_SANDBOX}` + `src`로 iframe을 렌더함을 코드 실증(WireframeDeviceFrame.tsx:89~94) + 라이브 폼·입력 실동작 실증.

## capability: flowforge-wireframe-sandbox-security — sandbox iframe·CSP 격리

신뢰되지 않은 AI 생성 와이어 HTML을 sandbox iframe + 응답 Content-Security-Policy 헤더로 격리해, 문서가 부모 오리진(flowforge 앱의 쿠키·localStorage·DOM·토큰)에 접근하거나 외부 네트워크로 데이터를 유출하지 못하게 한다. 이 change의 핵심 보안 재설계는 CSP를 `<meta>` 주입에서 **HTTP 응답 헤더**로 전환한 것으로, 브라우저가 문서 내용과 무관하게 CSP를 적용하므로 적대적 HTML의 정규식 마스킹 우회를 원천 제거한다. 미승인 제안 미리보기는 원천에 없는 임시 HTML이라 추측 불가한 단기 토큰 URL로 서빙한다(TTL·크기·개수 상한으로 DoS 방어).

### 기능: 앱 CSP 보안 헤더 미들웨어 (`cspHeaders`)
- assert:symbol cspHeaders
- 무의존 최소 미들웨어 `cspHeaders`를 `app.use(cspHeaders)`(index.ts:15)로 모든 응답에 적용해, flowforge 앱 응답에 CSP 헤더(`WIRE_APP_CSP`)를 세팅한다. `frame-ancestors 'self'`로 clickjacking(신뢰되지 않은 상위 프레임 임베드)을 막고, `X-Frame-Options: SAMEORIGIN`·`X-Content-Type-Options: nosniff`(구형 폴백)도 세팅한다. CSP 값은 shared 단일 원천(`WIRE_APP_CSP`)에서 가져와 렌더러·테스트와 drift를 막는다.
- invariant: 문서용 CSP(`WIRE_DOC_CSP`)는 `default-src 'none'`·`connect-src 'none'`로 외부 script/style/img/font·fetch/XHR/WebSocket 로드를 차단하고 인라인 자산만 허용하며, 정책 문자열에 외부 URL(`https?://`)을 포함하지 않는다(네트워크 유출 표면 제거).
- invariant: sandbox 값(`WIRE_IFRAME_SANDBOX`)에는 `allow-scripts`는 있고 `allow-same-origin`은 **없다** — 둘을 동시에 주면 sandbox가 무력화되어 부모 오리진 접근이 열린다.
- metric: wireDocs.test.ts(보안 상수 단일 원천: allow-same-origin 미부여·CSP 외부 차단·frame-ancestors 'self' 검증) + docsWireDoc.test.ts(응답 CSP 헤더 = WIRE_DOC_CSP 불변, 적대적 페이로드에도 불변) PASS.

### 기능: 미승인 제안 미리보기 토큰 (`POST /api/docs/:project/planning-wireframe/preview`)
- assert:endpoint POST /api/docs/:project/planning-wireframe/preview
- assert:symbol putWirePreview
- 원천에 없는 미승인 제안·crosslink 임시 HTML을 렌더 직전 POST로 짧게 저장하고 추측 불가한 토큰(`crypto.randomUUID()`)을 발급해 `src=.../preview/:token/doc`로 로드한다. 저장분도 승인분과 **동일하게** text/html + WIRE_DOC_CSP 헤더로 서빙된다(격리 동일). 크기 상한 초과 시 `putWirePreview`가 null을 반환해 413(payload_too_large)로 거부한다.
- invariant: 미리보기는 TTL(기본 5분, get 시 lazy 만료)·개수 상한(200)·단일 HTML 바이트 상한(512KB)으로 메모리 DoS를 막는다. write가 아니라 read 규약과 동형(추측 불가 토큰·상한)이라 requireWriteAuth 없이 안전하다. 저장 HTML은 파싱·변형·meta 주입 없이 그대로 보관·서빙한다(우회 벡터 원천 제거).
- metric: wirePreview.test.ts(TTL 만료·개수/바이트 상한 거부·토큰 추측불가·lazy 삭제) PASS.

## capability: planning-audit-trigger — 감사 실행 트리거

미감사(unknown)·경고(warn) 프로젝트에서 사용자가 openspec-audit을 직접 실행할 수 있게 하는 "감사 진행" 트리거다. flowforge 컨테이너는 홈을 읽기전용(RO)으로 마운트하고 python3·git이 없어 audit을 직접 실행할 수 없다. 그래서 flowforge는 얇은 인증 프록시로만 동작해 openspec-reports 호스트 워커 큐에 잡을 enqueue하고, 실제 결정적 실행(audit_scan → audit_match → generate_report)과 `audit.json` 갱신은 워커가 담당한다.

### 기능: 감사 실행 큐잉 (`POST /api/docs/:project/audit-run`)
- assert:endpoint POST /api/docs/:project/audit-run
- assert:symbol triggerAudit
- 인증(requireWriteAuth) 게이트와 프로젝트 키 화이트리스트를 통과한 요청에 대해 `triggerAudit`이 openspec-reports 큐에 `{project, action:"audit"}` 잡을 enqueue한다. flowforge는 큐에 넣기만 하고 audit을 직접 실행하지 않는다(RO 마운트·도구 부재). 성공 시 202(큐잉됨)를 반환하고, 연타는 debounce로 202 관용 처리한다.
- invariant: project 키는 `resolveProjectDir` 화이트리스트(`..`·슬래시·미등록·심링크 차단)로 재검증하고, 위반 입력은 잡을 큐잉하지 않고 400으로 거부한다(공개 RCE 트리거 방지).
- invariant: 프로덕션 인증(CF Access JWT 또는 Bearer WRITE_TOKEN)이 활성이어야 라우트가 열린다 — 무인증 요청은 401로 거부하고 잡을 큐잉하지 않는다. 큐 오류·워커 401은 502로 매핑한다.
- metric: auditRun.test.ts(라우트: 202 큐잉·400 경로조작·401 무인증·502 큐오류) + auditTrigger.test.ts(triggerAudit 분기: ok/invalid_project/debounced/unauthorized/queue_error) PASS.

### 기능: 미감사 상태에 감사 버튼 노출 + 재조회 (web `runAudit`)
- assert:symbol runAudit
- assert:symbol triggerAudit
- web는 auditStatus가 unknown/warn일 때만 "🔍 감사 진행" 버튼(data-testid="audit-run-btn")을 노출하고, 클릭 시 `runAudit(project)`가 audit-run 라우트를 호출한다. 202 이후 폴링으로 audit 판정을 재조회해 UI에 갱신 표시한다(감사 중… → 완료 후 재조회). 정합(clean) 프로젝트에는 버튼을 강제 노출하지 않는다.
- invariant: 판정(PASS/FAIL/UNVERIFIABLE)은 flowforge/web/LLM이 아니라 워커 내부의 결정적 파이썬 3-step(route/symbol 문자열 매칭)이 산출한다 — flowforge는 그 저장본(audit.json)을 읽어 표시만 한다(읽기 거울).
- metric: web `runAudit`(api.ts:233)이 audit-run 라우트를 호출하고, App.tsx의 버튼(App.tsx:973~979, audit-run-btn)이 unknown/warn 게이트로 렌더됨을 코드 실증 + 라이브 감사 후 판정 갱신 실증.

## capability: flowforge-mapping-basis-shift — capability↔change 매핑 원천 전환

`flowforge-change-node-mapping`이 신설한 노드↔change 매핑 파생의 **데이터 조인 기준**만 분리해 고친 아키텍처 뒷정리다. 매핑 진실의 원천을 폐기 방향인 charter(`docs/spec.md`)에서 `docs/planning/features.md`의 요구사항 capability(`<!-- capability: 키 -->`)로 전환하고, 활성 change만 스캔하던 것을 archive된 change까지 포함하도록 완화한다. UI(배지·상세패널·진입)는 불변이며 데이터 조인 기준만 바뀐다. 목적은 "라이브 실데이터에서 노드 배지 0"의 근본 원인(활성 change의 specs/dir이 features.md capability와 교집합 0 + 구현 change는 이미 archive로 이동) 해소다.

### 기능: features.md capability를 매핑 조인 원천으로 파싱
- assert:symbol parseFeatureCapabilities
- `docs/planning/features.md`의 `<!-- capability: 키 -->` 마커를 읽어 capability 키 집합을 뽑는 순수 파서다(`server/src/lib/capabilityIndex.ts`). charter(`docs/spec.md`)의 `## capability:` 파서(`parseCharterCapabilities`)를 대체하는 새 조인 원천으로, features.md에 선언된 capability를 진실의 원천으로 삼아 change의 `specs/<dir>`과 조인한다.
- invariant: 매핑 기준 전환은 `capabilityIndex` 조인에 한정된다 — `graph.ts`·`koreanLabels.ts`·`changes.ts`·`projects.ts` 등 docs/spec.md의 다른 소비자와 wowa-app 등 타 프로젝트 planning 뷰를 회귀시키지 않는다.
- metric: server jest capabilityIndex.test.ts 22/22 PASS(parseFeatureCapabilities 키 추출 + wowa-app 무저촉 케이스 포함).

### 기능: archive된 change도 매핑 스캔에 포함
- `buildCapabilityIndex`가 `openspec/changes/archive/<dated-change>/`(archive 래퍼 1단계 하강)도 change로 스캔에 포함한다(활성 전용이던 것을 완화). 완료돼 archive된 change가 구현한 capability도 노드 배지로 표시되며, archive 하위 링크에만 `archived:true`를 옵셔널로 실어 활성 링크 형태를 바꾸지 않는다(비파괴). ⚠️ `buildCapabilityIndex` 심볼 자체는 `capability-change-navigation`에서 이미 assert 중이므로 여기서는 archive 스캔 불변식으로만 서술한다(중복 assert 회피).
- invariant: archive/ 아래는 dated change 래퍼로 취급해 한 단계 더 내려가 각각을 change로 처리한다(`changeKey === "archive"` 분기, D2). archive 미매칭 change도 활성과 동일 규칙으로 unlinked에 표면화한다(silent drop 금지).
- invariant: archive 완화가 활성 change 링크를 오염시키지 않는다 — 활성 change 링크에는 `archived`가 참이 되지 않는다.
- metric: capabilityIndex.test.ts의 D2 케이스 PASS — "활성+archive가 같은 capability를 구현하면 둘 다 병합해 담는다", "archive 미매칭 change도 unlinked로 표면화", "활성 change 링크는 archived가 참이 아니다".

## capability: flowforge-screen-crosslink — 화면 id 조인키 상호참조

유저플로우 화면(page) 노드를 선택하면, 그 화면 id를 조인키로 (a)대응 와이어프레임 프리뷰/딥링크와 (b)그 화면을 연결화면으로 가진 기능명세 상세기능 목록을 상세 패널 안에 상호참조로 표시하는 읽기전용 오버레이다. 화면 id는 유저플로우·IA·와이어·기능명세가 공유하는 기존 조인키(`features.md` 화면목록 `<!-- screen: id -->`)를 활용한다. 각 산출물의 렌더링 자체는 불변이며 상호참조 섹션만 추가된다. 피드백9(유저플로우에서 와이어 안 보임)와 피드백12(노드가 어떤 기능과 연관됐는지 모름)를 해소한다.

### 기능: 화면 id → 상세기능 역인덱스 + 와이어 lookup (web 헬퍼)
- assert:symbol buildScreenToDetailLabels
- assert:symbol detailLabelsForScreen
- assert:symbol buildWireById
- assert:symbol wireForScreen
- `screenRegistry.links`(상세기능→화면 N:M 정방향 링크)를 화면 id 기준으로 역인덱싱해 `Map<screenId, detailLabel[]>`를 만들고(`buildScreenToDetailLabels`/`detailLabelsForScreen`), `planningWireScreens`에서 화면 id로 와이어(`WireScreen2`)를 조회한다(`buildWireById`/`wireForScreen`). 모두 `web/src/screenCrosslink.ts`의 순수 헬퍼다.
- invariant: 화면 id 매칭이 0개이거나 dangling(레지스트리·와이어 어디에도 없는 id)이면 빈 배열/undefined를 반환해 크래시 없이 빈 상태로 처리한다(숨기되 앱을 깨뜨리지 않음).
- metric: web vitest screenCrosslink.test.ts 8/8 PASS(정상 N:M 역인덱스·같은 화면 다중 상세기능·매칭 0개→빈배열·dangling·id로 와이어 조회).

### 기능: 유저플로우 상세 패널 화면 허브 상호참조 (web 컴포넌트)
- assert:symbol FlowDetailPanel
- assert:symbol ScreenCrosslinkData
- `FlowDetailPanel`이 화면(page) 종류 노드일 때만 기존 흐름(전이) 섹션에 더해 "연관 와이어프레임"(`WireframeDeviceFrame` 프리뷰/wire 탭 딥링크)·"연관 기능명세"(상세기능 라벨 목록) 섹션을 그린다. App이 화면 id 조인으로 계산한 `ScreenCrosslinkData`를 넘기며, 화면 노드가 아니거나 데이터가 없으면 undefined로 섹션을 미노출한다. ⚠️ 화면 id 원천 라우트(`GET /api/docs/:project/planning-screens` + `fetchPlanningScreens`)는 `planning-panel-screen-links` capability에서 이미 assert 중이므로 여기서 재assert하지 않는다.
- invariant: 화면(page) 종류가 아닌 노드(시작·섹션·행동)에서는 상호참조 섹션이 표시되지 않고 기존 흐름 섹션만 정상 렌더된다(기존 유저플로우 상세 패널 동작 완전 보존, 회귀 0).
- invariant: 이 capability는 읽기 상호참조(보기·딥링크)만 신설한다 — 유저플로우에서 와이어/기능을 편집하거나 양방향 링크를 추가하는 쓰기 경로는 없다.
- metric: FlowDetailPanel.test.tsx PASS(화면 노드 선택 시 상호참조 섹션 렌더, 화면 아님/연결 0개→미노출) + 라이브 재빌드 후 화면 노드 클릭 시 와이어 프리뷰·기능 목록 표시 Playwright 실픽셀 실증.

## capability: flowforge-feature-list-view — 기능명세 리스트 뷰

기능명세서 뷰를 ReactFlow 노드-엣지 다이어그램이 아니라 **들여쓴 계층 트리/아웃라인 리스트**로 렌더하는 능력이다. 원본 데이터(`FeatureTreeNode`의 children 중첩)·서버 파서(featureTreeBuilder)·연결화면 조인은 무변경이고, web 렌더 계층만 교체한다. planning 기능명세와 capability drill-down 기능명세 두 진입점 모두에 적용되며, 다이어그램이 싣던 표시 정보(타입 태그·priority/status 뱃지·capability 칩·audit 뱃지·연결화면 칩·메모)를 무손실로 보존한다.

### 기능: 기능명세를 들여쓴 계층 리스트로 렌더 (web 컴포넌트)
- assert:symbol FeatureListView
- assert:symbol toFeatureTreeList
- assert:symbol FeatureListItemFlat
- `toFeatureTreeList`(`web/src/featureTreeAdapter.ts`)가 `FeatureTree.root.children`을 `children` 깊이만큼 depth를 실은 평탄 리스트 항목(`FeatureListItemFlat`)으로 변환하고, `FeatureListView`(`web/src/FeatureListView.tsx`)가 그 항목들을 depth만큼 들여쓴 트리/아웃라인 리스트로 렌더한다. dagre 자동 레이아웃(`rankdir:"LR"`)과 캔버스 패닝/줌은 이 뷰에서 쓰지 않는다.
- invariant: 데이터 원천(`shared`의 `FeatureTree`/`FeatureTreeNode`)과 서버 파서는 변경하지 않는다 — 렌더 방식만 리스트로 바뀐다(순수 web 렌더 교체, additive).
- invariant: 상세기능 노드의 연결화면 칩은 리스트에서도 화면 레지스트리(`featureTreeAdapter`의 `screenRegistry` 조인)와 동일 화면 id로 붙는다(조인 회귀 0).
- metric: 서버 featureTreeBuilder·`FeatureTree` 타입 무변경을 grep/타입체크로 확인 + `FeatureListView`/`toFeatureTreeList`/`FeatureListItemFlat` export 존재(featureTreeAdapter.ts:110·68, FeatureListView.tsx:119) + web 빌드 PASS + 라이브 재빌드 후 리스트 렌더·다이어그램 부재·뱃지/칩 보존 Playwright 실픽셀 실증. ⚠️ 이 web 렌더 영역은 순수 리스트 어댑터 단위테스트가 없어(`toFeatureTreeList` 전용 테스트 없음) 검증 근거는 타입체크·빌드·산출물 관찰이다(테스트 PASS 주장 아님 — 정직 표기).

## capability: flowforge-view-labels — 뷰 라벨 계보 구별

두 계보에 중복으로 붙어 있던 "기능명세서" 레이블을 UI에서 구분 가능하게 만드는 능력이다. planning 계보(`docs/planning/features.md`, openspec-plan 산출)와 change 계보(change의 `specs/<cap>/spec.md`, openspec-propose 산출)가 같은 이름이라 UI만으로 구별되지 않던 혼동(피드백11)을 해소한다. 노드 타입은 코드상 이미 분리돼 있으나(`App.tsx`의 `specTree` vs `featureTree`) 레이블이 같아 혼동됐으므로, 탭 레이블 문자열만 서로 구별되게 바꾼다.

### 기능: change 탭과 planning 탭의 기능명세 레이블 구별 (UI 문자열)
- invariant: change 뷰의 기능명세 탭 레이블(`명세(change)`)과 planning 뷰의 기획 기능명세 탭 레이블(`기획 기능명세`)이 서로 다른 문자열로, 어느 계보의 기능명세인지 UI만으로 식별된다(둘 다 그냥 "기능명세서"로 표기되지 않는다).
- invariant: planning 계보(features.md·openspec-plan)와 change 계보(spec.md·openspec-propose)가 레이블로 구별된다.
- ⚠️ assert 대상 없음(UI 문자열): 이 capability는 endpoint도 named export symbol도 아닌 순수 UI 레이블 문자열(`web/src/App.tsx`의 `tabBtn("spec", "명세(change)")` / `planTabBtn("features", "기획 기능명세")`)이라 assert:endpoint/assert:symbol 대상이 없다. audit 문자열 대조 대상이 아니므로 억지 symbol assert를 넣지 않고 불변식+metric 서술로만 검증한다.
- metric: 두 탭 레이블이 서로 다른 문자열임을 grep으로 확인(`web/src/App.tsx:945` `명세(change)` / `:998` `기획 기능명세`) + web 빌드 PASS + 라이브 UI에서 change 뷰·planning 뷰의 두 기능명세 레이블이 구별돼 보이는지 Playwright 실픽셀 관찰. 노드타입 분리(`specTree` vs `featureTree`)는 이미 코드상 되어 있어 무변경 확인.

## capability: uncharted-project-change-list — 기획 없는 프로젝트의 change 목록 진입로

기획 문서(`docs/planning/*`)가 없는 프로젝트(`hasCharter=false`)의 skeleton 단계에 그 프로젝트의 활성 change 목록을 노출해, 클릭 시 기존 5종 문서 뷰(views)로 진입시키는 능력이다. change 를 기능명세 노드 경유로만 열도록 바꾼 설계(`flowforge-change-node-mapping`)가 기획 문서 없는 프로젝트를 놓쳐(노드 생성 근거인 `features.md` 자체가 없어 skeleton 이 빈 화면) change 도달 경로가 끊겼던 것을 잇는다. 서버 신규 API 없이 프로젝트 카드가 이미 싣는 데이터를 재사용하며, 기획 있는 프로젝트의 기존 노드-경유 진입은 불변으로 유지한다.

### 기능: 기획 없는 프로젝트 skeleton 에 활성 change 목록 렌더 (web 컴포넌트)
- assert:symbol UnchartedChangeList
- assert:symbol UnchartedChangeListProps
- `UnchartedChangeList`(`web/src/UnchartedChangeList.tsx`)가 `hasCharter=false` 일 때만 활성 change 목록을 클릭 가능한 항목으로 렌더하고, `App.tsx` skeleton 블록이 이를 배선한다. `hasCharter=true` 면 `null` 을 반환해 기획 있는 프로젝트의 기존 planning 탭 렌더에 관여하지 않는다.
- invariant: 진입로 데이터는 `ProjectCard.allActiveChangeNames`(전량)를 쓰고 카드 칩용 `activeChangeNames`(2개 상한)를 쓰지 않는다 — 잘린 목록을 쓰면 상한 초과 change 가 도달 불가로 남아 이 capability 의 목적을 배반한다.
- invariant: 활성 change 가 없으면 목록·링크를 만들지 않고 "활성 change 없음"을 표기한다(존재하지 않는 링크 미생성).
- invariant: `hasCharter` 게이팅은 컴포넌트 내부(`if (hasCharter) return null`)에서 하며, 호출부는 `?? true`(안전측=미렌더)로 폴백한다.
- metric: `UnchartedChangeList` export 존재(`web/src/UnchartedChangeList.tsx:12`) + web vitest 16 PASS(hasCharter=true 시 미렌더 회귀 가드 포함, 무력화 프로브로 가드 실효성 확인) + 라이브 재배포 후 Playwright 실픽셀 실증(wowa-wt-dashboard 활성 change 4개 전량 렌더, 기획 있는 flowforge 는 목록 섹션 부재).

### 기능: 카드 칩(상한)과 진입로(전량)의 change 목록 분리 (서버 스캔)
- assert:symbol listProjectCards
- `listProjectCards`(`server/src/lib/projects.ts:149`)가 `ProjectCard` 에 두 필드를 병렬로 싣는다: `activeChangeNames`(카드 칩 표시용, `scan.active.slice(0, 2)`)와 `allActiveChangeNames`(진입로용, `scan.active` 전량). 카드 그리드의 칩 레이아웃은 상한을 유지하면서 진입로는 모든 활성 change 에 도달 가능해야 하기 때문이다.
- invariant: `allActiveChangeNames` 는 절단하지 않는다 — 절단 시 상한 초과 change 가 화면에서 도달 불가가 된다(2026-07-15 review BLOCK 으로 실측 확인: 고아 프로젝트 4개 중 3개가 활성 change 3~4개 보유).
- invariant: 카드 칩(`web/src/ProjectGrid.tsx`)은 계속 `activeChangeNames` 를 참조해 그리드 레이아웃 회귀가 없다.
- metric: `listProjectCards` export 존재(`server/src/lib/projects.ts:149`) + server jest 548 PASS(신규 3케이스: 상한 초과 시 칩 2개·전량 4개 / 상한 이하 시 동일 / 활성 0 시 빈 배열) + 무력화 프로브(전량 필드를 `slice(0,2)` 로 되돌리면 1건 red) + 라이브 `GET /api/projects` 실측(wowa-wt-dashboard: 칩 2개, 전량 4개).

### 기능: change 클릭 시 5종 문서 뷰 딥링크 진입 (기존 경로 재사용)
- invariant: 진입 경로는 `App.tsx` 내부의 기존 `openChangeViews` 콜백을 재사용하며 새 진입 경로를 만들지 않는다(컴포넌트 지역 `useCallback`이라 export 심볼 assert 대상이 아님 — 검증은 아래 metric 의 라이브 실픽셀로 한다).
- change 목록 항목 클릭이 기존 `openChangeViews`(`web/src/App.tsx:831`)를 호출해 views 단계로 전환하고 기본 PRD 탭을 연다. 프로젝트 키를 실어 딥링크 `?project=<영문키>&change=<change키>&tab=prd` 가 기록되며, 서버는 이미 `?project=` 쿼리로 크로스 프로젝트 change 조회를 지원한다(`cross-project-change-views`, archive 2026-07-08).
- invariant: 딥링크의 `project` 는 프로젝트 영문 식별자(`name`)이며 한글 표시명(`displayName`)이나 빈 값·플레이스홀더를 싣지 않는다.
- invariant: 이 capability 는 서버 신규 API 를 만들지 않는다 — 기존 `/api/changes/:id/*?project=` 를 그대로 쓴다.
- metric: 라이브 실픽셀 실증(이전 도달 불가였던 3번째 change `implement-ios-app` 클릭 → 브라우저 실요청 prd/spec-tree/graph/wireframe 4종 200 → PRD 본문 6517자 렌더, URL `?project=wowa-wt-dashboard&change=implement-ios-app&tab=prd`).
