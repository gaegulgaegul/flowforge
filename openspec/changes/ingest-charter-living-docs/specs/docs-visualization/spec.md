## ADDED Requirements

### Requirement: 상주/변경 소스 토글
프론트엔드는 상단에 "변경(change) / 상주(docs)" 소스 토글을 제공해야 한다(SHALL). 토글 상태에 따라 프로젝트 목록과 데이터 엔드포인트를 전환하며, 탭 UI(flow/wire/prd)는 두 모드에서 재사용해야 한다(SHALL).

#### Scenario: 변경 → 상주 전환
- **WHEN** 사용자가 소스 토글을 "상주(docs)"로 전환한다
- **THEN** 프론트는 `GET /api/docs/projects` 로 docs 프로젝트 목록을 다시 불러오고 드롭다운을 docs 목록으로 교체한다

#### Scenario: 상주 모드 데이터 소스
- **WHEN** 소스가 "상주(docs)"이고 docs 프로젝트가 선택돼 있다
- **THEN** flow/wire/prd 탭은 `/api/docs/:project/{graph,wireframe,prd}` 에서 데이터를 가져온다(change 엔드포인트가 아니라)

#### Scenario: 상주 → 변경 복귀
- **WHEN** 사용자가 소스 토글을 "변경(change)"으로 되돌린다
- **THEN** 프론트는 기존 `/api/projects` + `/api/changes/:id/*` 동작으로 완전히 복귀하고 docs 기능 도입 이전과 동일하게 동작한다

### Requirement: docs 프로젝트 드롭다운 선택
프론트엔드는 상주 모드에서 docs 프로젝트를 드롭다운으로 선택할 수 있어야 한다(SHALL). 선택을 바꾸면 현재 탭의 데이터를 선택된 docs 프로젝트로 다시 불러와야 한다(SHALL).

#### Scenario: docs 프로젝트 선택 변경
- **WHEN** 사용자가 docs 드롭다운에서 다른 프로젝트(예: ssoksok)를 선택한다
- **THEN** 현재 탭(flow/wire/prd)의 데이터가 선택된 프로젝트의 docs 엔드포인트 응답으로 갱신된다

#### Scenario: docs 프로젝트 없음
- **WHEN** 상주 모드인데 `/api/docs/projects` 가 빈 배열을 반환한다
- **THEN** 드롭다운은 비어 있고 본문은 "상주 문서를 찾을 수 없음" 빈 상태를 표시한다(에러 아님)

### Requirement: flow 탭 docs 그래프 렌더
프론트엔드는 상주 모드 flow 탭에서 `/api/docs/:project/graph` 응답을 ReactFlow 그래프로 렌더해야 한다(SHALL). 명시된 화면 노드와 goto 엣지를 그리며, dangling 엣지(미정의 대상)는 시각적으로 구분해야 한다(SHALL).

#### Scenario: 화면 노드/엣지 렌더
- **WHEN** 상주 모드 flow 탭에서 docs graph 응답에 화면 노드와 goto 엣지가 있다
- **THEN** 각 화면이 노드로, 각 명시 goto 가 엣지로 그려진다

#### Scenario: 노드 클릭으로 화면 강조
- **WHEN** 사용자가 flow 그래프의 화면 노드를 클릭한다
- **THEN** 해당 노드가 선택 강조되고 연결된 엣지가 부각된다(인터랙티브 시각화)

#### Scenario: dangling 엣지 구분 표시
- **WHEN** docs graph 에 `dangling:true` 엣지(명시했으나 대상 화면 미정의)가 있다
- **THEN** 해당 전환이 점선/경고색 등으로 구분 표시되어 대상 누락을 사용자에게 알린다

### Requirement: wire 탭 docs 와이어프레임 + 원본 보기 링크
프론트엔드는 상주 모드 wire 탭에서 `/api/docs/:project/wireframe` 응답을 화면별 와이어프레임으로 렌더해야 한다(SHALL). charter 원본 `wireframe.html` 이 존재하면 "원본 보기" 링크를 노출해야 한다(SHALL).

#### Scenario: 화면별 박스 렌더
- **WHEN** 상주 모드 wire 탭에서 docs wireframe 응답에 화면과 박스가 있다
- **THEN** 각 화면이 모바일 프레임 목업으로, step 이 boxKind 별 박스로 렌더된다

#### Scenario: 원본 보기 링크 클릭
- **WHEN** docs wireframe 응답에 원본 HTML 메타가 있고 사용자가 "원본 보기" 링크를 누른다
- **THEN** charter 가 생성한 원본 `wireframe.html` 이 새 탭(또는 iframe)으로 열려 재렌더 결과와 비교할 수 있다

### Requirement: prd 탭 source별 분기(decision 타임라인)
프론트엔드는 prd 탭을 소스 모드에 따라 분기해야 한다(SHALL). 변경 모드면 기존 5섹션 PRD 를, 상주 모드면 `/api/docs/:project/prd` 의 decision 타임라인을 렌더해야 한다(SHALL). 탭 개수(5개)는 늘리지 않아야 한다(SHALL NOT add tabs).

#### Scenario: 변경 모드 prd
- **WHEN** 소스가 "변경(change)"이고 prd 탭을 연다
- **THEN** 기존 5섹션(overview/value/target/metrics/attributes) PRD 가 렌더된다(동작 불변)

#### Scenario: 상주 모드 decision 타임라인
- **WHEN** 소스가 "상주(docs)"이고 prd 탭을 연다
- **THEN** `## decision:` 이력이 시간순 타임라인(date/why/what/success/status)으로 렌더된다

#### Scenario: superseded decision 흐리게
- **WHEN** decision 타임라인에 status 가 superseded 인 항목이 있다
- **THEN** 해당 항목이 흐리게(deprecated 스타일) 표시되어 현재 유효한 결정과 구분된다

### Requirement: SEED 배지 표시
프론트엔드는 어댑터가 `seed:true` 로 표시한 화면 노드·와이어 박스·decision 항목에 SEED(미검증) 배지를 표시해야 한다(SHALL). `seed` 가 세팅되지 않은 데이터에는 배지를 표시하지 않아야 한다(SHALL NOT).

#### Scenario: SEED 노드 배지
- **WHEN** flow 그래프에 `seed:true` 인 화면 노드가 있다
- **THEN** 해당 노드에 "SEED" 배지(옅은 색/🟡)가 붙어 미검증 데이터임을 경고한다

#### Scenario: 검증 데이터 무배지
- **WHEN** 어떤 화면/박스/decision 의 `seed` 가 미세팅이다
- **THEN** 해당 요소에 SEED 배지가 표시되지 않는다

## TDD Plan

- **Red**:
  - `api.ts`: `fetchDocsProjects`/`fetchDocsGraph`/`fetchDocsWireframe`/`fetchDocsPrd` 가 올바른 docs 엔드포인트 URL 을 호출하는지 실패 테스트.
  - 소스 토글: 토글 상태에 따라 projects fetch 가 `/api/projects` ↔ `/api/docs/projects` 로 전환되는지(컴포넌트 테스트 또는 상태 로직 단위 테스트).
  - SEED 배지: `seed:true` 노드/박스에 배지 렌더, 미세팅이면 미렌더 테스트.
  - decision 타임라인: docs prd 응답 → 타임라인 렌더(superseded 흐림) 테스트.
  - dangling 엣지: `dangling:true` → 구분 스타일 테스트.
- **Green**: 소스 토글 상태·docs fetch 함수·prd 탭 분기·SEED 배지·decision 타임라인 컴포넌트 최소 구현.
- **Refactor**: change/docs 공통 탭 렌더 로직 추출(소스 모드만 주입). 구조 변경은 동작 변경과 분리 커밋(Tidy First).
- **Mock 대상**: API fetch(`fetch`)만 모킹(외부 의존성 경계). ReactFlow/DOM 은 실제 렌더(jsdom).
- **그라운딩(필수)**: 실제 `flowforge/docs/`·`ssoksok/docs/` 를 DOCS_ROOT 로 서버 띄우고, 상주 모드에서 flow/wire/prd 탭 + SEED 배지 + 원본 보기 링크를 브라우저로 직접 관찰(정적 점검 ≠ 올바름).
