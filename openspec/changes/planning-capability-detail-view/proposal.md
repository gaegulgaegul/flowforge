## Why

flowforge는 이미 capability→change 역방향 인덱스를 갖췄다(`buildCapabilityIndex`, `GET /api/projects/:project/capabilities/:cap/changes`). capability를 클릭하면 그 capability를 건드리는 change 목록(`CapabilityChangeList`)으로 드릴다운된다. 하지만 그 화면은 **change 목록만** 보여준다 — 사용자가 한 capability를 들여다볼 때 정작 묻는 "이 기능이 뭐고(PRD/features), 어떤 화면 흐름을 타고(유저플로우), 어떤 변경이 건드리나(change들)"가 **세 군데로 흩어져** 있다(프로젝트 단위 skeleton 화면의 PRD/features/유저플로우 패널 + 별도 capChanges 단계). 한 capability의 기획 맥락과 구현 변경을 **한 화면에 co-locate**하는 통합 drill-down이 없다. 이것이 OpenSpec 기획단계 본구현 5단계(`project_openspec_planning_stage` §85, §147)의 남은 부분이다.

## What Changes

- capability를 클릭하면 그 capability **한 개**의 종합 상세를 반환하는 신규 백엔드 종합 뷰모델·엔드포인트를 추가한다:
  - 그 capability에 속한 **features 서브트리**(`docs/planning/features.md`의 requirement 노드 중 `capability` 키가 일치하는 가지)
  - 그 capability와 연결된 **유저플로우** 목록(`docs/planning/user-flow/`에서 `> capability: <키>` 마커로 선언한 flow stem)
  - 그 capability를 **건드리는 change 목록**(기존 역방향 인덱스 `byCapability` 재사용 — 재구현 없음)
- flowforge 웹의 capability 드릴다운(`capChanges` 단계)을 확장해, change 목록 **옆에** 위 세 가지를 한 화면에 함께 렌더한다. 데이터 소스·연결 규칙은 전부 기존 자산 재사용.
- 연결은 기존 불변식 유지: **capability 키 글자단위 정확 비교만**(유사도 매칭 금지, 거짓연결 0). 미연결/빈 상태는 명시적으로 표면화한다.
- docs는 읽기전용 유지 — 이 change는 신규 쓰기 라우트를 추가하지 않는다.

## Capabilities

### New Capabilities
- `planning-capability-detail`: capability 키 하나에 대해 features 서브트리 + 연결 유저플로우 목록 + 건드리는 change 목록을 한 응답으로 묶는 종합 뷰모델과, 그것을 한 화면에 co-locate해 렌더하는 flowforge drill-down 뷰.

### Modified Capabilities
<!-- 기존 capability의 요구사항(spec-level behavior) 변경 없음. 기존 역방향 인덱스(capability-change-navigation)는 그대로 재사용만 함 — 동작 변경 없음. -->

## Impact

- **server**: `server/src/lib/capabilityIndex.ts`에 capability 단위 종합 함수 추가(기존 `buildCapabilityIndex`의 `byCapability` 재사용), `server/src/routes/projects.ts`에 신규 종합 엔드포인트 `GET /api/projects/:project/capabilities/:cap`. features 서브트리는 `buildDocsPlanningFeatures`(`FeatureTreeNode.capability`) 필터, 유저플로우는 `listDocsUserFlows` + `> capability:` 마커 스캔 재사용.
- **web**: `web/src/App.tsx`의 `capChanges` 단계 렌더 확장(또는 capability 클릭 시 종합 fetch), `web/src/api.ts`에 신규 클라이언트 함수. 기존 `PrdPanel`/features ReactFlow/유저플로우 ReactFlow/`CapabilityChangeList` 컴포넌트 재사용.
- **shared**: capability 종합 뷰모델 타입(미사용 중인 `CapabilityNode` 타입을 출발점으로 활용 가능).
- **불변식**: 읽기전용(no-traversal, readonly, safe-4xx), 거짓연결 0(글자단위 매칭).
- 의존성 추가 없음. 라이브 서버(8812)는 `OPENSPEC_ROOT`가 wowa를 가리키므로 로컬 검증만(DOCS_ROOT/PROJECTS_ROOT 로컬 주입).
