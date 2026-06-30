## Context

flowforge는 OpenSpec 기반 계층 대시보드로, "읽어서 비추는 거울"이 정체성이다. capability→change 역방향 인덱스는 이미 구현·archive됨(`capability-change-navigation`):
- `server/src/lib/capabilityIndex.ts` `buildCapabilityIndex(charterCaps, changesRoot)` → `byCapability: Map<string, string[]>` (capabilityKey → change 키 목록). `archive` 디렉토리 스킵, 거짓연결 0(글자단위 set 멤버십).
- `server/src/routes/projects.ts` `GET /api/projects/:project/capabilities/:cap/changes` → 그 capability의 change 목록(한글 제목 매핑).
- `indexFor(dir)`(`projects.ts:63`)가 `parseCharterCapabilities` + `buildCapabilityIndex`를 합성. `resolveProjectDir`로 경로안전, `safe()`로 에러 래핑.

데이터 소스도 전부 존재한다:
- features 서브트리: `buildDocsPlanningFeatures(docsDir)`(`featureTreeBuilder.ts`)가 `docs/planning/features.md`를 파싱하며 `FeatureTreeNode.capability` 필드에 requirement별 capability 키를 담는다.
- 유저플로우: `listDocsUserFlows`/`readDocsUserFlowSpec`(`lib/docs.ts`)로 `docs/planning/user-flow/*.md` 목록·본문을 읽는다. flow는 본문에 `> capability: <키>` 마커로 capability를 선언한다(기획단계 스키마 §91).
- PRD: `buildDocsPlanningPrd(docsDir)`(전체 5섹션, capability 단위로 쪼개져 있지 않음).

현재 갭: capability 클릭 시 `App.tsx`의 `capChanges` 단계가 `CapabilityChangeList`(change 목록)만 렌더한다. features/유저플로우는 프로젝트 단위 `skeleton` 단계에만 있고 capability로 좁혀지지 않는다.

루트 변수 3종 분리: `OPENSPEC_ROOT`(changes.ts, graph 라우트), `DOCS_ROOT`(docs.ts), `PROJECTS_ROOT`(projects.ts). 역방향 인덱스는 `PROJECTS_ROOT`를 타며 `<PROJECTS_ROOT>/<project>/{docs/spec.md, openspec/changes}`를 한 프로젝트 디렉토리 아래에서 합성한다.

## Goals / Non-Goals

**Goals:**
- capability 키 하나에 대한 종합 뷰모델(features 서브트리 + 연결 유저플로우 목록 + 건드리는 change 목록)을 한 응답으로 반환하는 읽기전용 엔드포인트.
- flowforge 웹에서 capability 클릭 시 그 셋을 한 화면에 co-locate.
- 기존 자산 최대 재사용(buildCapabilityIndex/buildDocsPlanningFeatures/listDocsUserFlows/PrdPanel/CapabilityChangeList), 거짓연결 0 불변식 유지.

**Non-Goals:**
- generation(스킬) 변경 없음 — 데이터 소스가 모두 존재하므로 openspec-plan SKILL.md 수정 불필요(이 단계는 순수 뷰).
- docs 쓰기 라우트 추가 없음(읽기전용 유지). 드래그 좌표 overlay 같은 쓰기는 이미 유저플로우 단계에서 끝남.
- capability별 PRD **섹션 분할** 없음 — prd.md는 전체 5섹션 1개라 capability로 쪼갤 데이터가 없다. 통합 화면의 "PRD 맥락"은 features 서브트리(capability 단위로 정확)로 채우고, 전체 PRD는 기존 skeleton 패널에 그대로 둔다. (D 참조)
- 6단계(D3 승인/반려 편집 UI)는 별도 change.

## Decisions

### D1. 종합 엔드포인트 위치 = `GET /api/projects/:project/capabilities/:cap` (projects.ts)
기존 `GET .../capabilities/:cap/changes`와 형제. `indexFor(dir)`/`resolveProjectDir`/`safe()`를 그대로 재사용한다. **대안**: docs.ts에 두기 → 기각(docs.ts는 DOCS_ROOT만 보고 change 인덱스를 모름. 역방향 인덱스는 PROJECTS_ROOT를 타므로 projects.ts가 유일하게 docs+changes를 한 프로젝트 디렉토리에서 합성하는 자리).

### D2. 종합 집계 함수 = capabilityIndex.ts에 신규 순수 함수 추가
`buildCapabilityDetail(cap, charterCaps, changesRoot, featureTree, userFlowMarkers)` 형태. lib/capabilityIndex.ts는 env를 안 읽는 순수 함수(절대경로/데이터 주입식)라 테스트가 임시 픽스처로 쉽다. 라우트가 docsDir에서 featureTree·유저플로우 마커를 읽어 주입한다. **대안**: 라우트에 인라인 → 기각(테스트 어려움, 책임 분산). buildCapabilityIndex 옆이 "역방향 집계" 책임에 부합.

### D3. 유저플로우 capability 연결 = `> capability: <키>` 마커 스캔 (신규 경량 헬퍼)
`listDocsUserFlows`로 stem 목록을 얻고, 각 `readDocsUserFlowSpec`로 본문을 읽어 `> capability: <키>` 줄을 정규식으로 스캔해 일치 stem만 모은다. 라이브러리 불필요(유저플로우 빌더가 이미 라이브러리 없이 정규식 파싱). **대안**: buildDocsPlanningUserFlow로 전체 그래프를 파싱 후 노드별 capability 추출 → 과함(전체 그래프 빌드 불필요, 마커 한 줄만 보면 됨). capability별 subgraph 추출은 Non-Goal(전체 flow를 그대로 보여주고 어느 flow가 이 capability인지만 표시).

### D4. features 서브트리 = buildDocsPlanningFeatures 결과를 capability로 필터
`buildDocsPlanningFeatures(docsDir)`가 반환하는 FeatureTree에서 `capability === cap`인 requirement 노드와 그 children만 추린다(가상 루트 아래 가지 필터). 새 파서 안 만듦. **대안**: features.md 재파싱 → 기각(중복).

### D5. 종합 뷰모델 타입 = shared에 신규, 미사용 `CapabilityNode` 출발점 활용
`shared/src/dashboard-types.ts`의 `CapabilityNode`(현재 런타임 미사용)를 종합 뷰모델 타입의 기반으로 확장하거나 새 `CapabilityDetail` 타입을 추가한다. 기존 `FeatureTree`/`SpecGraph` stem 목록/`ChangeSummary` 타입을 조합. **대안**: 인라인 타입 → 기각(web/server 공유 계약이라 shared가 맞음).

### D6. 웹 = capChanges 단계 렌더 확장(새 단계 신설 안 함)
`App.tsx`의 `openCapability`(`:299`)에서 change 목록뿐 아니라 종합 상세를 fetch하고, `capChanges` 단계 렌더(`:470-477`)를 확장해 features ReactFlow + 유저플로우(목록/링크) + `CapabilityChangeList`를 함께 그린다. skeleton 단계가 이미 쓰는 PrdPanel/features ReactFlow/유저플로우 ReactFlow 패턴을 capability 스코프로 재사용. race 가드 `dashReqToken` 유지. **대안**: 새 `capDetail` DashStage 신설 → 과함(capChanges가 이미 capability 컨텍스트를 들고 있음, 그 자리를 채우는 게 자연스럽고 브레드크럼/뒤로가기도 그대로).

## Risks / Trade-offs

- [features.md/유저플로우가 없는 프로젝트(planning-only 아님)] → 빈 구조 200으로 안전 표면화. features/유저플로우 읽기는 파일 없으면 빈 결과(404 아님). 종합 엔드포인트는 charter capability가 있으면 항상 200.
- [유저플로우 본문을 flow마다 읽어 마커 스캔 = N번 파일 읽기] → flow 수가 적고(프로젝트당 수 개) 읽기전용이라 비용 무시 가능. 필요 시 캐시는 후속 과제.
- [통합 화면이 한 화면에 ReactFlow 2개(features·유저플로우) + 목록을 동시 렌더 → 레이아웃 복잡] → skeleton 단계가 이미 같은 조합을 렌더하므로 검증된 패턴. nodeTypes 상수 컴포넌트 밖(재마운트 방지) 규칙 준수.
- [라이브 서버 OPENSPEC_ROOT=wowa] → 이 change는 PROJECTS_ROOT/DOCS_ROOT 로컬 주입으로만 검증(라이브 미반영, 기존 change들과 동일 제약).

## 화면 구성 / UI

- 화면 구조·흐름·이동의 명세는 `prototype.html` 을 단일 출처로 한다(DESIGN.md 없어 와이어프레임). 이 HTML 은 명세이지 구현물이 아니다 — WebView 로 쓰지 말고 web(React/ReactFlow)으로 같은 화면·흐름을 번역해 구현한다.

## Open Questions

<!-- 없음. 데이터 소스·연결 규칙·재사용 자산 모두 조사로 확정됨. -->
