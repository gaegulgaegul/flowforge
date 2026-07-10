## Why

flowforge Phase 3 — **산출물 구조 재정의**. 세 가지 UX 피드백을 한 묶음으로 해소한다(같은 산출물 레이어를 건드리므로 함께 처리하는 게 응집도가 높다).

1. **기능명세가 다이어그램이라 과하다(피드백1).** 기능명세서 뷰는 지금 ReactFlow 노드-엣지 다이어그램으로 렌더된다(`web/src/FeatureNode.tsx`, `web/src/featureTreeAdapter.ts:105-194`의 dagre `rankdir:"LR"` 좌→우 레이아웃). 그러나 원본 데이터는 순수 계층 트리다 — `shared/src/feature-tree-types.ts:23-68`의 `FeatureTreeNode`는 `children` 중첩만으로 위계를 표현한다(요구사항 > 기능 > 상세기능). 즉 엣지는 부모-자식 계층 외의 정보를 싣지 않는다. 다이어그램은 캔버스 패닝/줌·자동 레이아웃 비용만 크고, 밀도·검색·편집 면에서 **들여쓴 트리/아웃라인 리스트**가 명백히 유리하다.

2. **IA 뷰가 중복이라 뺀다(피드백7, 사용자결정 G2).** 산출물이 5종(PRD·기능명세·유저플로우·IA·와이어)인데, IA(화면구조)는 유저플로우·와이어가 이미 화면을 다루므로 별도 뷰의 가치가 낮다. 5종 → **4종**(PRD·기능명세·유저플로우·와이어)으로 줄인다. 🔴**단, 화면 id 마커(`<!-- screen: id -->`)와 화면 id 데이터는 반드시 존치한다** — 유저플로우·와이어가 이 id를 조인키로 쓴다. 제거하는 것은 IA **렌더**(컴포넌트·라우트·탭)뿐이고, features.md 화면목록 파싱(`server/src/parser/screenRegistry.ts`)은 그대로 둔다.

3. **"기능명세서" 이름이 두 곳에 붙어 혼동된다(피드백11).** "기능명세서" 레이블이 서로 다른 두 계보에 동시에 붙어 있다 — (a) **planning 계보**: `web/src/App.tsx:993`의 planning 탭, `docs/planning/features.md`, openspec-plan이 생성. (b) **change 계보**: `web/src/App.tsx:941`의 change 탭, change의 `specs/<cap>/spec.md`, openspec-propose가 생성. 같은 이름이라 어느 계보인지 UI만으로 구분되지 않는다. (노드 타입은 코드상 이미 분리돼 있다 — `App.tsx:82`의 `specTree` vs `featureTree`.) 레이블만 구분되게 바꾸거나 계보 안내를 붙인다.

## What Changes

- **기능명세 렌더를 다이어그램 → 들여쓴 트리/아웃라인 리스트로 전환**: planning 기능명세(`App.tsx:1031-1043`)와 capability drill-down의 기능명세 서브트리(`App.tsx:1172-1183`) 두 곳의 ReactFlow 기반 `FeatureNode`/`toFeatureTreeFlow` 렌더를 계층 리스트 렌더로 교체한다. 데이터 원천(`FeatureTree`/`FeatureTreeNode` children 중첩)과 서버 파서(featureTreeBuilder)는 무변경 — web 렌더 계층만 교체한다. 상세기능 노드의 연결화면 칩(`featureTreeAdapter.ts:116-128`의 `screenRegistry` 병합)은 리스트에서도 유지한다.
- **IA 뷰 제거(렌더만) + 화면 id 데이터 존치**: change IA 탭("IA 트리", `App.tsx:941`)과 planning IA 탭("화면 구조", `App.tsx:994`)을 제거하고, 그 뒤 렌더 블록(`App.tsx:1048-1067` planning IA, `App.tsx:1225-1229` change IA)·`iaVerbose` 토글(`App.tsx:975-977`)·IA 노드타입 등록(`App.tsx:82`의 `ia: IANode`)·IA 컴포넌트/어댑터(`web/src/IANode.tsx`, `web/src/iaAdapter.ts`, `web/src/IADetailPanel.tsx`)·IA 서버 빌더/라우트(`server/src/parser/iaBuilder.ts`, `planningIaBuilder.ts`, `graph.ts:92`의 `/api/changes/:id/ia`, `docs.ts:179`의 `/api/docs/:project/planning-ia`)를 제거한다. `Tab` 유니언(`App.tsx:89`)과 planTab 유니언(`App.tsx:105`)에서 `"ia"`를 뺀다. 🔴**존치**: `screenRegistry.ts`(features.md 화면목록 파싱)·`/api/docs/:project/planning-screens` 라우트(`docs.ts:160-176`)·`fetchPlanningScreens`(`api.ts:280`)는 무변경 — 유저플로우·와이어·기능명세 연결화면의 조인키 데이터원이다.
- **"기능명세서" 레이블 계보 구분**: change 탭(`App.tsx:941`)과 planning 탭(`App.tsx:993`)의 "기능명세서" 레이블을 서로 구분되게 바꾼다(예: planning="기획 기능명세", change="명세(change)") 또는 계보 안내(툴팁/부제)를 붙인다. 어느 방식이든 UI만으로 두 계보가 구별돼야 한다.
- **산출물 4종화**: 뷰 탭 목록에서 IA가 사라져 change 뷰(`App.tsx:940-946`)와 planning 뷰(`App.tsx:991-996`) 모두 4종(PRD·기능명세·유저플로우·와이어)이 된다.
- **새 의존성 없음**. web 렌더 교체 + 코드 제거만. 새 npm 패키지 도입 없음.

## Capabilities

### New Capabilities
- `flowforge-feature-list-view`: 기능명세서 뷰를 ReactFlow 노드-엣지 다이어그램이 아니라 **들여쓴 계층 트리/아웃라인 리스트**로 렌더하는 능력. 데이터 원천(`FeatureTreeNode` children 중첩)·서버 파서·연결화면 조인은 무변경, web 렌더만 교체한다. planning 기능명세와 capability drill-down 기능명세 두 진입점 모두 적용.
- `flowforge-ia-removal`: IA(화면구조) 뷰를 산출물에서 제거하는 능력(5종→4종). IA 렌더 컴포넌트(`IANode`/`iaAdapter`/`IADetailPanel`)·라우트(`/api/changes/:id/ia`·`/api/docs/:project/planning-ia`)·서버 빌더(`iaBuilder`/`planningIaBuilder`)·탭을 제거한다. 🔴 화면 id 파싱(`screenRegistry.ts`)·`planning-screens` 라우트·화면 id 데이터는 존치해 유저플로우·와이어 조인키를 보존한다(불변식).
- `flowforge-view-labels`: 두 계보에 중복된 "기능명세서" 레이블을 UI에서 구분 가능하게 만드는 능력. planning 계보(openspec-plan 산출)와 change 계보(openspec-propose 산출)가 레이블/안내로 구별된다.

### Modified Capabilities
<!-- 기존 capability(유저플로우·와이어·PRD·화면 레지스트리)는 화면 id 데이터·파싱이 불변이므로 스펙 수정 없음. IA 제거는 그 데이터 원(screenRegistry)을 건드리지 않는다. modified 없음. -->

## Impact

- **web 프론트(주 변경)**: `web/src/App.tsx` — 기능명세 렌더 교체(2곳)·IA 탭/렌더/토글/노드타입/상태 제거·`Tab`/planTab 유니언에서 `"ia"` 제거·레이블 구분. `web/src/FeatureNode.tsx`(리스트 렌더로 대체 or 신규 리스트 컴포넌트로 교체)·`web/src/featureTreeAdapter.ts`(dagre 레이아웃 → 트리 평탄화 유지·좌표계산 제거)·`web/src/IANode.tsx`·`web/src/iaAdapter.ts`·`web/src/IADetailPanel.tsx`(IA 제거) 삭제/교체.
- **server(부 변경)**: `server/src/parser/iaBuilder.ts`·`server/src/parser/planningIaBuilder.ts` 제거. `server/src/routes/graph.ts:92`(`/api/changes/:id/ia`)·`server/src/routes/docs.ts:179`(`/api/docs/:project/planning-ia`) 라우트 제거. `web/src/api.ts:128`(`fetchIA`)·`api.ts:292`(`fetchDocsPlanningIa`) 제거.
- **불변(건드리지 않음) 🔴**: `server/src/parser/screenRegistry.ts`(화면 id 파싱·"병렬 파서, featureTreeBuilder와 완전 분리" — 코드 주석 명시)·`server/src/routes/docs.ts:160-176`(`/api/docs/:project/planning-screens`)·`web/src/api.ts:280`(`fetchPlanningScreens`)·유저플로우·와이어·PRD 뷰. features.md 화면목록(`## 화면목록` + `<!-- screen: id -->`) 파싱 규약 불변.
- **테스트**: 제거 대상 IA 테스트 = `server/src/parser/__tests__/planningIaBuilder.test.ts`. **존치·상시 green 필수** = `server/src/routes/__tests__/docs.planning.test.ts`의 `planning-screens` 케이스(화면 id 골든, 파일 23-25·108-136행에 `<!-- screen: home/settings -->` 마커 검증).
- **harness 무관**: 이 change는 flowforge 코드만 변경한다. openspec-plan/propose 스킬(agentic-harness)은 IA 산출물을 만들지 않으므로 harness 변경 없음. features.md 화면목록 문법도 harness가 강제하지 않는다(flowforge 파서 전담).
- **비가역성 낮음**: 제거는 git으로 되돌릴 수 있고 데이터(features.md 화면목록)를 지우지 않으므로 안전. 회귀 위험은 오직 "IA 제거가 화면 id를 잘못 건드림"뿐 → 화면 id 골든 회귀 0으로 게이트.
