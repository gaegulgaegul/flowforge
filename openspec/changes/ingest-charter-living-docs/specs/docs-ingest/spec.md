## ADDED Requirements

### Requirement: DOCS_ROOT 다중 docs 스캔
시스템은 `DOCS_ROOT` 환경변수(기본값 `cwd`) 아래에서 `docs/` 디렉토리에 `user-flow.md` 또는 `PRD.md`를 가진 프로젝트들을 스캔하여 docs 프로젝트 목록을 제공해야 한다(SHALL). 스캔 깊이는 `<DOCS_ROOT>/<project>/docs/` 1단계로 한정하며, 심링크는 추적하지 않아야 한다(SHALL NOT).

#### Scenario: docs 프로젝트 목록 조회
- **WHEN** 클라이언트가 `GET /api/docs/projects` 를 호출한다
- **THEN** 시스템은 `DOCS_ROOT` 아래에서 `docs/user-flow.md` 또는 `docs/PRD.md` 를 가진 프로젝트 식별자 배열을 `{ projects: string[] }` 형태로 반환한다

#### Scenario: docs 없는 환경
- **WHEN** `DOCS_ROOT` 아래에 docs/ 를 가진 프로젝트가 하나도 없다
- **THEN** 시스템은 빈 배열 `{ projects: [] }` 을 200 으로 반환하고 에러를 던지지 않는다

### Requirement: docs 경로 안전(traversal 방지)
시스템은 docs project 식별자를 해석할 때 `..` 를 포함하거나 화이트리스트(`/^[A-Za-z0-9_\-/]+$/`)를 벗어난 입력을 거부하여 `DOCS_ROOT` 밖 파일 접근을 차단해야 한다(SHALL). (invariant: no-traversal)

#### Scenario: 경로 조작 입력 거부
- **WHEN** 클라이언트가 `GET /api/docs/..%2f..%2fetc/graph` 처럼 traversal 을 시도한다
- **THEN** 시스템은 404 `{ error: "docs_not_found" }` 를 반환하고 `DOCS_ROOT` 밖 파일을 읽지 않는다

#### Scenario: 존재하지 않는 project
- **WHEN** 클라이언트가 존재하지 않는 project 의 `GET /api/docs/:project/graph` 를 호출한다
- **THEN** 시스템은 404 `{ error: "docs_not_found" }` 를 반환한다

### Requirement: charter user-flow.md 읽기전용 파싱
시스템은 charter `user-flow.md` 의 라인문법(`## flow:`, `### 화면:`, `- step:`, `- goto:`)을 charter 원본 정규식과 동치인 읽기전용 파서로 해석해야 한다(SHALL). 기존 `specParser.ts`(OpenSpec WHEN/THEN)는 수정하지 않아야 하며(SHALL NOT), charter 산출물 파일도 쓰지 않아야 한다(SHALL NOT). (invariant: readonly)

#### Scenario: flow/화면/step/goto 파싱
- **WHEN** `docs/user-flow.md` 에 `## flow: capture` / `### 화면: 캡처 (Compose, /capture)` / `- step: 사진 촬영` / `- goto: 저장` 이 있다
- **THEN** 파서는 flow="capture", 화면="캡처"(컴포넌트·경로 포함), step="사진 촬영", goto target="저장" 을 구조화 데이터로 반환한다

#### Scenario: 엔드포인트 goto 식별
- **WHEN** user-flow.md 에 `- goto: (POST /api/logs)` 가 있다
- **THEN** 파서는 이 goto 를 화면 전환이 아니라 API 호출(METHOD=POST, path=/api/logs)로 분류한다

### Requirement: user-flow.md → 그래프 직역(휴리스틱 제거)
시스템은 `GET /api/docs/:project/graph` 에서 user-flow.md 를 `@flowforge/shared` 의 `SpecGraph` 로 직역해야 한다(SHALL). 화면은 `GraphNode{kind:"screen"}`, 화면 goto 는 `GraphEdge` 로 매핑하며, 휴리스틱 `isScreenSpec`/`flowTarget` 은 사용하지 않아야 한다(SHALL NOT).

#### Scenario: 화면 → 노드
- **WHEN** user-flow.md 에 `### 화면: 캡처` 가 정의돼 있다
- **THEN** graph 응답에 `GraphNode{ id:"screen-캡처-슬러그", kind:"screen", label:"캡처" }` 가 포함된다

#### Scenario: 명시 goto → 엣지
- **WHEN** "캡처" 화면에 `- goto: 저장` 이 있고 "저장" 화면도 user-flow.md 에 정의돼 있다
- **THEN** graph 응답에 `GraphEdge{ source:"screen-캡처-슬러그", target:"screen-저장-슬러그", dangling:false }` 가 포함된다

#### Scenario: 정의되지 않은 대상 화면(명시 dangling)
- **WHEN** "캡처" 화면에 `- goto: 분석` 이 있으나 "분석" 화면이 user-flow.md 에 정의돼 있지 않다
- **THEN** graph 응답에 `GraphEdge{ source:"screen-캡처-슬러그", target:null, dangling:true }` 가 포함되어 명시된 전환의 대상 누락을 신호한다

### Requirement: user-flow.md → 와이어프레임 재렌더
시스템은 `GET /api/docs/:project/wireframe` 에서 user-flow.md 를 `@flowforge/shared` 의 `Wireframe` 로 변환해야 한다(SHALL). 화면은 `WireScreen`, step 은 `WireBox` 로 매핑하며 `boxKind` 는 charter `charter_wireframe.py` 와 동일한 키워드 규칙을 사용해야 한다(SHALL).

#### Scenario: step → 박스(boxKind)
- **WHEN** "저장" 화면에 `- step: 기록 목록` 과 `- step: 저장 버튼` 이 있다
- **THEN** wireframe 응답의 해당 WireScreen.boxes 에 `{kind:"list", label:"기록 목록"}` 과 `{kind:"button", label:"저장 버튼"}` 이 charter 키워드 규칙대로 포함된다

#### Scenario: charter 원본 wireframe.html 존재 노출
- **WHEN** `docs/wireframe.html` 이 존재한다
- **THEN** wireframe 응답에 원본 HTML 을 가리키는 메타(예: `originalHtml: true` 또는 경로)가 포함되어 프론트가 "원본 보기" 링크를 노출할 수 있다

### Requirement: charter PRD.md decision 타임라인 파싱
시스템은 `GET /api/docs/:project/prd` 에서 `docs/PRD.md` 의 `## decision:` 이력을 시간순 decision 타임라인으로 파싱해야 한다(SHALL). 각 decision 의 `date`/`capability`/`why`/`what`/`success`/`status` 불릿을 보존하며, charter 의 5섹션 매핑(`buildPrd`)은 적용하지 않아야 한다(SHALL NOT).

#### Scenario: decision 이력 파싱
- **WHEN** `docs/PRD.md` 에 `## decision: D1` 과 그 아래 `- date: 2026-06-24` / `- why: ...` / `- status: active` 가 있다
- **THEN** prd 응답에 `{ id:"D1", date:"2026-06-24", why:"...", status:"active" }` 를 포함한 decision 배열이 반환된다

#### Scenario: superseded decision 표시
- **WHEN** 어떤 decision 의 `- status: superseded-by:D5` 이다
- **THEN** prd 응답의 해당 항목 status 가 superseded(by D5)로 표시되어 프론트가 흐리게 렌더할 수 있다

### Requirement: SEED 마킹 보존
시스템은 charter docs 의 SEED(사람검토 전 = 미검증) 마킹을 어댑터 출력에 보존하여, 해당 화면/박스/decision 에 `seed:true` 를 세팅해야 한다(SHALL). SEED 가 없는 데이터는 `seed` 를 세팅하지 않아야 한다(미검증으로 오표시 방지).

#### Scenario: SEED 화면 플래그
- **WHEN** user-flow.md 에서 어떤 화면이 SEED 로 마킹돼 있다
- **THEN** 해당 GraphNode/WireScreen 에 `seed:true` 가 세팅된다

#### Scenario: 검증된 데이터는 seed 미세팅
- **WHEN** 어떤 화면에 SEED 마킹이 없다
- **THEN** 해당 노드/박스의 `seed` 는 undefined(또는 false)로, 미검증 배지가 붙지 않는다

### Requirement: change 경로 하위호환(무손상)
시스템은 docs 기능 추가가 기존 change 경로(`/api/projects`, `/api/changes/:id/*`), 빌더, `specParser`, golden test 에 영향을 주지 않도록 해야 한다(SHALL). docs/ 추가는 additive 이며, 기존 라우트의 응답은 변경되지 않아야 한다(SHALL NOT change).

#### Scenario: 기존 change 라우트 불변
- **WHEN** docs 기능 추가 후 `GET /api/changes/:id/graph` 를 호출한다
- **THEN** 응답 스키마와 내용이 docs 기능 도입 이전과 동일하며 golden test 가 모두 통과한다

## TDD Plan

- **Red**:
  - `docs.ts` 스캔: DOCS_ROOT 픽스처(프로젝트 2개 + docs 없는 디렉토리 1개)에서 `listDocsProjects()` 가 docs 가진 2개만 반환하는지 실패 테스트.
  - traversal: `resolveDocsDir("../../etc")` → null 실패 테스트.
  - `charterUserFlowParser`: flow/화면/step/goto·엔드포인트 goto 파싱 픽스처 실패 테스트(charter 원본 정규식과 동치 케이스).
  - `docsAdapter`: 화면→GraphNode, 명시 goto→edge, 미정의 대상→dangling, step→WireBox(boxKind), SEED→seed:true 실패 테스트.
  - `charterPrdParser`: `## decision:` 배열·superseded 상태 실패 테스트.
  - 라우트: `/api/docs/projects`·`/api/docs/:project/{graph,wireframe,prd}`·404 케이스 실패 테스트.
- **Green**: 위 각 모듈을 최소 구현으로 통과(charter 정규식 읽기전용 TS 포팅, 어댑터 직역, 라우트 마운트).
- **Refactor**: 정규식 상수를 `charterUserFlowParser.ts` 한 곳에 모으고 charter 원본 위치 주석. 경로 안전 유틸을 `changes.ts` 패턴과 공유 가능하면 추출(구조 변경은 동작 변경과 분리 커밋).
- **Mock 대상**: 없음(파일시스템은 픽스처 디렉토리로 실제 읽기 — `*Client`/`*Gateway` 없음). 외부 의존성 없음.
